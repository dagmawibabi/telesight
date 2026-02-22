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
  Link2,
  Image as ImageIcon,
  Forward,
  Clock,
  TrendingUp,
  Zap,
  Calendar,
  Hash,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"

interface CalendarWrappedProps {
  messages: TelegramMessage[]
  scope: { type: "year"; year: number } | { type: "month"; year: number; month: number } | { type: "day"; year: number; month: number; day: number }
  onClose: () => void
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface WrappedStats {
  totalPosts: number
  totalReactions: number
  totalMedia: number
  totalLinks: number
  totalForwarded: number
  topReactions: { emoji: string; count: number }[]
  busiestHour: { hour: number; count: number }
  busiestDayOfWeek: { day: number; count: number }
  longestPost: { id: number; length: number; preview: string }
  topHashtags: { tag: string; count: number }[]
  streakDays: number
  avgPostsPerDay: number
  topPost: { id: number; reactions: number; preview: string } | null
  hourDistribution: number[]
  scopeLabel: string
  scopeSublabel: string
}

function computeWrappedStats(
  messages: TelegramMessage[],
  scope: CalendarWrappedProps["scope"]
): WrappedStats {
  // Filter messages to scope
  const filtered = messages.filter((m) => {
    if (m.type !== "message") return false
    const d = new Date(m.date)
    if (scope.type === "year") return d.getFullYear() === scope.year
    if (scope.type === "month") return d.getFullYear() === scope.year && d.getMonth() === scope.month
    return d.getFullYear() === scope.year && d.getMonth() === scope.month && d.getDate() === scope.day
  })

  // Basic counts
  const totalPosts = filtered.length
  let totalReactions = 0
  const reactionMap = new Map<string, number>()
  const hourCounts = new Array(24).fill(0)
  const dowCounts = new Array(7).fill(0)
  const daySet = new Set<string>()
  const hashtagMap = new Map<string, number>()

  let longestPost = { id: 0, length: 0, preview: "" }
  let topPost: { id: number; reactions: number; preview: string } | null = null

  for (const msg of filtered) {
    const text = getMessageText(msg)
    const d = new Date(msg.date)
    hourCounts[d.getHours()]++
    dowCounts[d.getDay()]++
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)

    // Reactions
    const msgReactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
    totalReactions += msgReactions
    if (msg.reactions) {
      for (const r of msg.reactions) {
        reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + r.count)
      }
    }

    // Top post
    if (!topPost || msgReactions > topPost.reactions) {
      topPost = { id: msg.id, reactions: msgReactions, preview: text.slice(0, 100) }
    }

    // Longest
    if (text.length > longestPost.length) {
      longestPost = { id: msg.id, length: text.length, preview: text.slice(0, 100) }
    }

    // Hashtags
    const tags = text.match(/#\w+/g) || []
    for (const tag of tags) {
      const lower = tag.toLowerCase()
      hashtagMap.set(lower, (hashtagMap.get(lower) || 0) + 1)
    }
  }

  // Busiest hour
  let busiestHour = { hour: 0, count: 0 }
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > busiestHour.count) {
      busiestHour = { hour: h, count: hourCounts[h] }
    }
  }

  // Busiest day of week
  let busiestDow = { day: 0, count: 0 }
  for (let d = 0; d < 7; d++) {
    if (dowCounts[d] > busiestDow.count) {
      busiestDow = { day: d, count: dowCounts[d] }
    }
  }

  // Streak calculation
  const sortedDays = Array.from(daySet).sort()
  let maxStreak = 0
  let currentStreak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1].replace(/-/g, "/"))
    const curr = new Date(sortedDays[i].replace(/-/g, "/"))
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diff === 1) {
      currentStreak++
    } else {
      maxStreak = Math.max(maxStreak, currentStreak)
      currentStreak = 1
    }
  }
  maxStreak = Math.max(maxStreak, currentStreak)

  // Scope labels
  let scopeLabel = ""
  let scopeSublabel = ""
  if (scope.type === "year") {
    scopeLabel = `${scope.year}`
    scopeSublabel = "Year in Review"
  } else if (scope.type === "month") {
    scopeLabel = `${MONTH_NAMES[scope.month]} ${scope.year}`
    scopeSublabel = "Month in Review"
  } else {
    scopeLabel = new Date(scope.year, scope.month, scope.day).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    })
    scopeSublabel = "Day in Review"
  }

  return {
    totalPosts,
    totalReactions,
    totalMedia: filtered.filter((m) => m.photo || m.file || m.media_type).length,
    totalLinks: filtered.filter((m) => {
      const t = getMessageText(m)
      return t.includes("http://") || t.includes("https://")
    }).length,
    totalForwarded: filtered.filter((m) => m.forwarded_from).length,
    topReactions: Array.from(reactionMap.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    busiestHour,
    busiestDayOfWeek: busiestDow,
    longestPost,
    topHashtags: Array.from(hashtagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    streakDays: maxStreak,
    avgPostsPerDay: daySet.size > 0 ? totalPosts / daySet.size : 0,
    topPost,
    hourDistribution: hourCounts,
    scopeLabel,
    scopeSublabel,
  }
}

export function CalendarWrapped({ messages, scope, onClose }: CalendarWrappedProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const stats = useMemo(() => computeWrappedStats(messages, scope), [messages, scope])

  const maxHour = Math.max(1, ...stats.hourDistribution)

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
      a.download = `wrapped-${scope.type}-${stats.scopeLabel.replace(/\s+/g, "-").toLowerCase()}.png`
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
    } catch {
      // fallback
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Wrapped</h2>
            <p className="text-xs text-muted-foreground">{stats.scopeSublabel}</p>
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

        {/* The exportable card */}
        <div
          ref={cardRef}
          style={{
            background: "linear-gradient(135deg, #0a0f1a 0%, #0d1520 40%, #0a1a18 100%)",
            borderRadius: 20,
            padding: 40,
            color: "#e8edf5",
            fontFamily: "Inter, system-ui, sans-serif",
            minHeight: 600,
          }}
        >
          {/* Title section */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #4dd0e1, #26a69a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}>
                <Calendar style={{ width: 16, height: 16, color: "#0a0f1a" }} />
              </div>
              <div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}>
                  {stats.scopeLabel}
                </div>
                <div style={{
                  fontSize: 11,
                  color: "#6b8299",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontWeight: 600,
                }}>
                  {stats.scopeSublabel}
                </div>
              </div>
            </div>
          </div>

          {/* Big numbers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 28,
          }}>
            {[
              { label: "Posts", value: stats.totalPosts.toLocaleString(), icon: "msg" },
              { label: "Reactions", value: stats.totalReactions.toLocaleString(), icon: "heart" },
              { label: "Media", value: stats.totalMedia.toLocaleString(), icon: "img" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "16px 14px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 11, color: "#6b8299", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Secondary stats row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}>
            {[
              { label: "Links shared", value: stats.totalLinks.toLocaleString() },
              { label: "Forwarded", value: stats.totalForwarded.toLocaleString() },
              { label: "Avg/day", value: stats.avgPostsPerDay.toFixed(1) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  padding: "12px",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: "#6b8299", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Hour distribution bar chart */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            padding: 16,
            border: "1px solid rgba(255,255,255,0.05)",
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 11, color: "#6b8299", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Posting hours
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
              {stats.hourDistribution.map((count, h) => (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    height: `${Math.max(2, (count / maxHour) * 48)}px`,
                    borderRadius: 2,
                    background: h === stats.busiestHour.hour
                      ? "#4dd0e1"
                      : count > 0
                        ? "rgba(77, 208, 225, 0.3)"
                        : "rgba(255,255,255,0.05)",
                    transition: "height 0.3s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "#4a6070" }}>12am</span>
              <span style={{ fontSize: 9, color: "#4a6070" }}>6am</span>
              <span style={{ fontSize: 9, color: "#4a6070" }}>12pm</span>
              <span style={{ fontSize: 9, color: "#4a6070" }}>6pm</span>
              <span style={{ fontSize: 9, color: "#4a6070" }}>11pm</span>
            </div>
          </div>

          {/* Highlights row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Zap style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Peak Hour
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {stats.busiestHour.hour === 0
                  ? "12 AM"
                  : stats.busiestHour.hour < 12
                    ? `${stats.busiestHour.hour} AM`
                    : stats.busiestHour.hour === 12
                      ? "12 PM"
                      : `${stats.busiestHour.hour - 12} PM`}
              </div>
              <div style={{ fontSize: 10, color: "#6b8299", marginTop: 2 }}>
                {stats.busiestHour.count} posts at this hour
              </div>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <TrendingUp style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Longest Streak
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {stats.streakDays} day{stats.streakDays !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 10, color: "#6b8299", marginTop: 2 }}>
                Consecutive posting days
              </div>
            </div>
          </div>

          {/* Busiest day of week */}
          {scope.type !== "day" && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Clock style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Busiest Day
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {WEEKDAYS[stats.busiestDayOfWeek.day]}
              </div>
              <div style={{ fontSize: 10, color: "#6b8299", marginTop: 2 }}>
                {stats.busiestDayOfWeek.count} posts on {WEEKDAYS[stats.busiestDayOfWeek.day]}s
              </div>
            </div>
          )}

          {/* Top reactions */}
          {stats.topReactions.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Heart style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Top Reactions
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {stats.topReactions.map((r) => (
                  <div key={r.emoji} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 18 }}>{r.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top hashtags */}
          {stats.topHashtags.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Hash style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Top Hashtags
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stats.topHashtags.map((h) => (
                  <span
                    key={h.tag}
                    style={{
                      background: "rgba(77, 208, 225, 0.1)",
                      border: "1px solid rgba(77, 208, 225, 0.2)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#4dd0e1",
                    }}
                  >
                    {h.tag} ({h.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top post */}
          {stats.topPost && stats.topPost.reactions > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <TrendingUp style={{ width: 12, height: 12, color: "#4dd0e1" }} />
                <span style={{ fontSize: 10, color: "#6b8299", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Most Popular Post
                </span>
                <span style={{ fontSize: 10, color: "#4dd0e1", marginLeft: "auto", fontWeight: 600 }}>
                  {stats.topPost.reactions.toLocaleString()} reactions
                </span>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: "#a0b0c0" }}>
                {stats.topPost.preview}
                {stats.topPost.preview.length >= 100 ? "..." : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
