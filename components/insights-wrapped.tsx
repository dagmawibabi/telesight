"use client"

import { useMemo, useRef, useState, useCallback } from "react"
import { toPng } from "html-to-image"
import {
  X,
  Download,
  Copy,
  Check,
  MessageSquare,
  Heart,
  Clock,
  TrendingUp,
  Zap,
  Calendar,
  Users,
  Hash,
  Image as ImageIcon,
  Forward,
  BarChart3,
  type LucideIcon,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText, getDMParticipants } from "@/lib/telegram-types"
import { computeMemberStats, type MemberStat } from "@/lib/group-analytics"

interface InsightsWrappedProps {
  messages: TelegramMessage[]
  onClose: () => void
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function hourLabel(h: number): string {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

interface WrappedData {
  totalPosts: number
  totalReactions: number
  totalMedia: number
  totalLinks: number
  totalForwarded: number
  avgReactionsPerPost: number
  bestHour: { hour: number; label: string; avg: number }
  bestDay: { day: number; label: string; avg: number }
  topReactions: { emoji: string; count: number }[]
  topFormat: { format: string; avg: number } | null
  topKeywords: { word: string; avg: number }[]
  hourDistribution: number[]
  dayDistribution: number[]
  streakDays: number
  dateRange: { start: string; end: string }
  // Group-specific
  isGroup: boolean
  memberCount: number
  topMembers: { name: string; messages: number; pct: number }[]
  topReactor: { name: string; count: number } | null
  // DM-specific
  isDM: boolean
  dmParticipants: [string, string] | null
  dmSplit: { nameA: string; nameB: string; countA: number; countB: number; pctA: number } | null
}

function computeWrappedData(messages: TelegramMessage[]): WrappedData {
  const posts = messages.filter((m) => m.type === "message")
  const totalPosts = posts.length

  let totalReactions = 0
  const reactionMap = new Map<string, number>()
  const hourBuckets = Array.from({ length: 24 }, () => ({ reactions: 0, count: 0 }))
  const dayBuckets = Array.from({ length: 7 }, () => ({ reactions: 0, count: 0 }))
  const daySet = new Set<string>()
  const formatMap = new Map<string, { reactions: number; count: number }>()
  const wordReactions = new Map<string, { total: number; count: number }>()

  const stopWords = new Set([
    "that", "this", "with", "from", "have", "been", "will", "your", "what",
    "when", "where", "which", "their", "there", "would", "could", "should",
    "about", "after", "before", "being", "between", "both", "each", "also",
    "than", "then", "them", "they", "into", "just", "very", "some", "more",
    "only", "over", "such", "like", "http", "https", "were", "does", "done",
  ])

  let earliest = Infinity
  let latest = -Infinity

  for (const msg of posts) {
    const d = new Date(msg.date)
    const ts = d.getTime()
    if (ts < earliest) earliest = ts
    if (ts > latest) latest = ts

    const reactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
    const text = getMessageText(msg)
    totalReactions += reactions

    hourBuckets[d.getHours()].reactions += reactions
    hourBuckets[d.getHours()].count++
    dayBuckets[d.getDay()].reactions += reactions
    dayBuckets[d.getDay()].count++
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)

    if (msg.reactions) {
      for (const r of msg.reactions) {
        reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + r.count)
      }
    }

    // Format
    let fmt: string
    if (msg.photo) fmt = "Photo"
    else if (msg.media_type === "video_file" || msg.mime_type?.startsWith("video/")) fmt = "Video"
    else if (msg.media_type === "animation") fmt = "GIF"
    else if (msg.forwarded_from) fmt = "Forwarded"
    else if (text.includes("http://") || text.includes("https://")) fmt = "With Links"
    else fmt = "Text Only"

    if (!formatMap.has(fmt)) formatMap.set(fmt, { reactions: 0, count: 0 })
    const f = formatMap.get(fmt)!
    f.reactions += reactions
    f.count++

    // Keywords
    if (reactions > 0) {
      const words = text.toLowerCase().replace(/[^\w\s\u0400-\u04FF]/g, " ").split(/\s+/)
        .filter((w) => w.length > 4 && !stopWords.has(w))
      for (const w of new Set(words)) {
        if (!wordReactions.has(w)) wordReactions.set(w, { total: 0, count: 0 })
        const e = wordReactions.get(w)!
        e.total += reactions
        e.count++
      }
    }
  }

  // Best hour/day
  const hourly = hourBuckets.map((b, i) => ({
    hour: i, label: hourLabel(i),
    avg: b.count > 0 ? Math.round((b.reactions / b.count) * 10) / 10 : 0,
  }))
  const daily = dayBuckets.map((b, i) => ({
    day: i, label: DAY_SHORT[i],
    avg: b.count > 0 ? Math.round((b.reactions / b.count) * 10) / 10 : 0,
  }))

  // For DMs, rank by volume; for channels/groups, rank by avg reactions
  const bestHour = isDM
    ? hourly.reduce((a, b) => (hourBuckets[b.hour].count > hourBuckets[a.hour].count ? b : a), hourly[0])
    : hourly.reduce((a, b) => (b.avg > a.avg ? b : a), hourly[0])
  const bestDay = isDM
    ? daily.reduce((a, b) => (dayBuckets[b.day].count > dayBuckets[a.day].count ? b : a), daily[0])
    : daily.reduce((a, b) => (b.avg > a.avg ? b : a), daily[0])

  const formatPerf = Array.from(formatMap.entries())
    .map(([fmt, d]) => ({ format: fmt, avg: d.count > 0 ? Math.round((d.reactions / d.count) * 10) / 10 : 0 }))
    .sort((a, b) => b.avg - a.avg)

  const topKw = Array.from(wordReactions.entries())
    .filter(([, d]) => d.count >= 3)
    .map(([w, d]) => ({ word: w, avg: Math.round((d.total / d.count) * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  // Streak
  const sortedDays = Array.from(daySet).sort()
  let maxStreak = 0, currentStreak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1].replace(/-/g, "/"))
    const curr = new Date(sortedDays[i].replace(/-/g, "/"))
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diff === 1) currentStreak++
    else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 1 }
  }
  maxStreak = Math.max(maxStreak, currentStreak)

  // Group detection
  const senders = new Set<string>()
  for (const m of posts) {
    if (m.from) senders.add(m.from)
  }
  const isGroup = senders.size > 2
  const isDM = senders.size === 2
  const dmParticipants = getDMParticipants(messages)
  let dmSplit: WrappedData["dmSplit"] = null

  if (isDM && dmParticipants) {
    const [nameA, nameB] = dmParticipants
    const countA = posts.filter((m) => m.from === nameA).length
    const countB = posts.filter((m) => m.from === nameB).length
    const total = countA + countB
    dmSplit = {
      nameA, nameB, countA, countB,
      pctA: total > 0 ? Math.round((countA / total) * 100) : 50,
    }
  }

  let topMembers: WrappedData["topMembers"] = []
  let topReactor: WrappedData["topReactor"] = null

  if (isGroup) {
    const memberStats = computeMemberStats(messages)
    const totalM = memberStats.reduce((s, m) => s + m.messageCount, 0)
    topMembers = memberStats.slice(0, 5).map((m) => ({
      name: m.name,
      messages: m.messageCount,
      pct: Math.round((m.messageCount / totalM) * 100),
    }))
    const topR = [...memberStats].sort((a, b) => b.reactionsSent - a.reactionsSent)[0]
    if (topR && topR.reactionsSent > 0) {
      topReactor = { name: topR.name, count: topR.reactionsSent }
    }
  }

  const startDate = earliest !== Infinity ? new Date(earliest) : new Date()
  const endDate = latest !== -Infinity ? new Date(latest) : new Date()

  return {
    totalPosts,
    totalReactions,
    totalMedia: posts.filter((m) => m.photo || m.file || m.media_type).length,
    totalLinks: posts.filter((m) => { const t = getMessageText(m); return t.includes("http://") || t.includes("https://") }).length,
    totalForwarded: posts.filter((m) => m.forwarded_from).length,
    avgReactionsPerPost: totalPosts > 0 ? Math.round((totalReactions / totalPosts) * 10) / 10 : 0,
    bestHour,
    bestDay,
    topReactions: Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5),
    topFormat: formatPerf[0] || null,
    topKeywords: topKw,
    hourDistribution: hourBuckets.map((b) => b.count),
    dayDistribution: dayBuckets.map((b) => b.count),
    streakDays: maxStreak,
    dateRange: {
      start: startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      end: endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    },
    isGroup,
    memberCount: senders.size,
    topMembers,
    topReactor,
    isDM,
    dmParticipants,
    dmSplit,
  }
}

const MEMBER_COLORS = [
  "#4dd0e1", "#ba68c8", "#ff8a65", "#66bb6a", "#ef5350",
]

export function InsightsWrapped({ messages, onClose }: InsightsWrappedProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const stats = useMemo(() => computeWrappedData(messages), [messages])
  const maxHour = Math.max(1, ...stats.hourDistribution)
  const maxDay = Math.max(1, ...stats.dayDistribution)

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return null
    return toPng(cardRef.current, {
      quality: 1,
      pixelRatio: 2,
      cacheBust: true,
      fontEmbedCSS: "",
      skipFonts: true,
    })
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const url = await generateImage()
      if (!url) return
      const a = document.createElement("a")
      a.href = url
      a.download = `insights-wrapped-${Date.now()}.png`
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = async () => {
    try {
      const url = await generateImage()
      if (!url) return
      const res = await fetch(url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  // Inline style helpers for the card
  const sectionBg = "rgba(255,255,255,0.035)"
  const sectionBorder = "1px solid rgba(255,255,255,0.06)"
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: "#5a7a90", textTransform: "uppercase",
    letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8,
    display: "flex", alignItems: "center", gap: 6,
  }
  const bigNum: React.CSSProperties = {
    fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em",
  }
  const smallNum: React.CSSProperties = {
    fontSize: 17, fontWeight: 600, lineHeight: 1,
  }
  const subtext: React.CSSProperties = {
    fontSize: 10, color: "#5a7a90", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.04em",
  }
  const accentColor = stats.isGroup ? "#ba68c8" : stats.isDM ? "#f48fb1" : "#4dd0e1"
  const accentColorDim = stats.isGroup ? "rgba(186,104,200,0.3)" : stats.isDM ? "rgba(244,143,177,0.3)" : "rgba(77,208,225,0.3)"

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Insights Wrapped</h2>
            <p className="text-xs text-muted-foreground">
              {stats.isDM ? "DM" : stats.isGroup ? "Group" : "Channel"} summary -- {stats.dateRange.start} to {stats.dateRange.end}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/25"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Exporting..." : "Download PNG"}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Exportable card */}
        <div
          ref={cardRef}
          style={{
            background: stats.isGroup
              ? "linear-gradient(145deg, #0f0a1a 0%, #15102a 40%, #0f0a1a 100%)"
              : stats.isDM
                ? "linear-gradient(145deg, #1a0a14 0%, #1e1020 40%, #1a0a14 100%)"
                : "linear-gradient(145deg, #0a0f1a 0%, #0d1520 40%, #0a1a18 100%)",
            borderRadius: 20,
            padding: 36,
            color: "#e0e8f0",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Title */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColorDim})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BarChart3 style={{ width: 16, height: 16, color: "#0a0f1a" }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {stats.isDM ? "DM" : stats.isGroup ? "Group" : "Channel"} Wrapped
                </div>
                <div style={{ fontSize: 10, color: "#5a7a90", letterSpacing: "0.08em", fontWeight: 500 }}>
                  {stats.dateRange.start} -- {stats.dateRange.end}
                </div>
              </div>
            </div>
          </div>

          {/* Big numbers row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
            {[
              { label: "Messages", value: stats.totalPosts.toLocaleString() },
              { label: stats.isDM ? "Media Shared" : "Reactions", value: stats.isDM ? stats.totalMedia.toLocaleString() : stats.totalReactions.toLocaleString() },
              { label: stats.isGroup ? "Members" : stats.isDM ? "Days Active" : "Media", value: stats.isGroup ? stats.memberCount.toLocaleString() : stats.isDM ? stats.streakDays.toLocaleString() : stats.totalMedia.toLocaleString() },
            ].map((item) => (
              <div key={item.label} style={{
                background: sectionBg, borderRadius: 12, padding: "14px 12px", border: sectionBorder,
              }}>
                <div style={bigNum}>{item.value}</div>
                <div style={subtext}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div style={{ display: "grid", gridTemplateColumns: stats.isDM ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
            {(stats.isDM ? [
              { label: "Links", value: stats.totalLinks.toLocaleString() },
              { label: "Reactions", value: stats.totalReactions.toLocaleString() },
              { label: "Streak", value: `${stats.streakDays} days` },
            ] : [
              { label: "Media", value: stats.totalMedia.toLocaleString() },
              { label: "Links", value: stats.totalLinks.toLocaleString() },
              { label: "Forwarded", value: stats.totalForwarded.toLocaleString() },
              { label: stats.isGroup ? "Avg Length" : "Avg/Post", value: stats.isGroup ? `${Math.round(stats.totalPosts > 0 ? stats.totalReactions / stats.totalPosts : 0)}` : `${stats.avgReactionsPerPost}` },
            ]).map((item) => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.025)", borderRadius: 10, padding: "10px 8px",
                border: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={smallNum}>{item.value}</div>
                <div style={{ ...subtext, fontSize: 9 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Hourly distribution */}
          <div style={{
            background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
          }}>
            <div style={labelStyle}>
              <Clock style={{ width: 11, height: 11, color: accentColor }} />
              {stats.isDM ? "Chat Activity" : "Posting Hours"}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 44 }}>
              {stats.hourDistribution.map((count, h) => (
                <div key={h} style={{
                  flex: 1, height: `${Math.max(2, (count / maxHour) * 44)}px`,
                  borderRadius: 2,
                  background: h === stats.bestHour.hour ? accentColor : count > 0 ? accentColorDim : "rgba(255,255,255,0.04)",
                }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 8, color: "#3a5a6a" }}>12am</span>
              <span style={{ fontSize: 8, color: "#3a5a6a" }}>6am</span>
              <span style={{ fontSize: 8, color: "#3a5a6a" }}>12pm</span>
              <span style={{ fontSize: 8, color: "#3a5a6a" }}>6pm</span>
              <span style={{ fontSize: 8, color: "#3a5a6a" }}>11pm</span>
            </div>
          </div>

          {/* Highlights grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {/* Best posting time */}
            <div style={{ background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder }}>
              <div style={labelStyle}>
                <Zap style={{ width: 11, height: 11, color: accentColor }} />
                {stats.isDM ? "Most Active Hour" : "Best Hour"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.bestHour.label}</div>
              <div style={subtext}>{stats.isDM ? `${stats.hourDistribution[stats.bestHour.hour]} messages` : `${stats.bestHour.avg} avg reactions`}</div>
            </div>

            {/* Best day */}
            <div style={{ background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder }}>
              <div style={labelStyle}>
                <Calendar style={{ width: 11, height: 11, color: accentColor }} />
                {stats.isDM ? "Most Active Day" : "Best Day"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{WEEKDAYS[stats.bestDay.day]}</div>
              <div style={subtext}>{stats.isDM ? `${stats.dayDistribution[stats.bestDay.day]} messages` : `${stats.bestDay.avg} avg reactions`}</div>
            </div>

            {/* Top format (channels only) */}
            {!stats.isDM && stats.topFormat && (
              <div style={{ background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder }}>
                <div style={labelStyle}>
                  <ImageIcon style={{ width: 11, height: 11, color: accentColor }} />
                  Top Format
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.topFormat.format}</div>
                <div style={subtext}>{stats.topFormat.avg} avg reactions</div>
              </div>
            )}

            {/* Streak */}
            <div style={{ background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder }}>
              <div style={labelStyle}>
                <TrendingUp style={{ width: 11, height: 11, color: accentColor }} />
                Longest Streak
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.streakDays} day{stats.streakDays !== 1 ? "s" : ""}</div>
              <div style={subtext}>{stats.isDM ? "Consecutive chatting" : "Consecutive posting"}</div>
            </div>
          </div>

          {/* Day of week mini chart */}
          <div style={{
            background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
          }}>
            <div style={labelStyle}>
              <Calendar style={{ width: 11, height: 11, color: accentColor }} />
              Posts by Day of Week
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 36 }}>
              {stats.dayDistribution.map((count, d) => (
                <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{
                    width: "100%", borderRadius: 3,
                    height: `${Math.max(3, (count / maxDay) * 36)}px`,
                    background: d === stats.bestDay.day ? accentColor : count > 0 ? accentColorDim : "rgba(255,255,255,0.04)",
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {DAY_SHORT.map((d) => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#3a5a6a" }}>{d}</div>
              ))}
            </div>
          </div>

          {/* Top reactions */}
          {stats.topReactions.length > 0 && (
            <div style={{
              background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
            }}>
              <div style={labelStyle}>
                <Heart style={{ width: 11, height: 11, color: accentColor }} />
                {stats.isDM ? "Reactions Used" : "Top Reactions"}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {stats.topReactions.map((r) => (
                  <div key={r.emoji} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 20 }}>{r.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {r.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DM-specific: conversation balance */}
          {stats.isDM && stats.dmSplit && (
            <div style={{
              background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
            }}>
              <div style={labelStyle}>
                <Users style={{ width: 11, height: 11, color: accentColor }} />
                Conversation Balance
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#4dd0e1", color: "#0a0f1a", flexShrink: 0,
                  }}>
                    {stats.dmSplit.nameA.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{stats.dmSplit.nameA.split(" ")[0]}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: accentColor }}>
                  {stats.dmSplit.pctA}% &mdash; {100 - stats.dmSplit.pctA}%
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: "row-reverse" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#ff8a65", color: "#0a0f1a", flexShrink: 0,
                  }}>
                    {stats.dmSplit.nameB.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{stats.dmSplit.nameB.split(" ")[0]}</span>
                </div>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${stats.dmSplit.pctA}%`, background: "#4dd0e1" }} />
                <div style={{ width: `${100 - stats.dmSplit.pctA}%`, background: "#ff8a65" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "#5a7a90", fontVariantNumeric: "tabular-nums" }}>
                  {stats.dmSplit.countA.toLocaleString()} msgs
                </span>
                <span style={{ fontSize: 9, color: "#5a7a90", fontVariantNumeric: "tabular-nums" }}>
                  {stats.dmSplit.countB.toLocaleString()} msgs
                </span>
              </div>
            </div>
          )}

          {/* Top keywords (channels only) */}
          {!stats.isDM && stats.topKeywords.length > 0 && (
            <div style={{
              background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
            }}>
              <div style={labelStyle}>
                <Hash style={{ width: 11, height: 11, color: accentColor }} />
                High-Engagement Words
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stats.topKeywords.map((kw) => (
                  <span key={kw.word} style={{
                    background: `rgba(${stats.isGroup ? "186,104,200" : "77,208,225"},0.1)`,
                    border: `1px solid rgba(${stats.isGroup ? "186,104,200" : "77,208,225"},0.2)`,
                    borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 500, color: accentColor,
                  }}>
                    {kw.word} ({kw.avg} avg)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Group-specific: Top members */}
          {stats.isGroup && stats.topMembers.length > 0 && (
            <div style={{
              background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 18,
            }}>
              <div style={labelStyle}>
                <Users style={{ width: 11, height: 11, color: accentColor }} />
                Top Contributors
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.topMembers.map((m, i) => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 11, fontSize: 10, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: MEMBER_COLORS[i % MEMBER_COLORS.length], color: "#0a0f1a", flexShrink: 0,
                    }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.name}
                        </span>
                        <span style={{ fontSize: 10, color: "#5a7a90", fontVariantNumeric: "tabular-nums", marginLeft: 8, flexShrink: 0 }}>
                          {m.messages.toLocaleString()} ({m.pct}%)
                        </span>
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 2, width: `${m.pct}%`,
                          background: MEMBER_COLORS[i % MEMBER_COLORS.length], opacity: 0.7,
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group: top reactor */}
          {stats.isGroup && stats.topReactor && (
            <div style={{
              background: sectionBg, borderRadius: 12, padding: 14, border: sectionBorder, marginBottom: 0,
            }}>
              <div style={labelStyle}>
                <Heart style={{ width: 11, height: 11, color: accentColor }} />
                Most Active Reactor
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.topReactor.name}</div>
              <div style={subtext}>{stats.topReactor.count.toLocaleString()} reactions sent</div>
            </div>
          )}

          {/* Footer watermark */}
          <div style={{
            marginTop: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 9, color: "#3a5060", letterSpacing: "0.05em" }}>
              TELESIGHT WRAPPED
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
