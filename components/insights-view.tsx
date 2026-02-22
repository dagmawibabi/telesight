"use client"

import { useMemo, useEffect } from "react"
import { format } from "date-fns"
import {
  X,
  Lightbulb,
  Clock,
  Calendar,
  TrendingUp,
  Hash,
  Image,
  Forward,
  Heart,
  Type,
  Target,
  Zap,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { ActivityHeatmap } from "./activity-heatmap"
import { computeMemberStats, type MemberStat } from "@/lib/group-analytics"
import { Users, MessageSquare as MsgIcon, Reply as ReplyIcon } from "lucide-react"

interface InsightsViewProps {
  messages: TelegramMessage[]
  onClose: () => void
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function hourLabel(h: number): string {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

interface Insight {
  icon: React.ElementType
  title: string
  description: string
  type: "tip" | "warning" | "info"
}

interface EngagementByHour {
  hour: number
  label: string
  avgReactions: number
  postCount: number
}

interface EngagementByDay {
  day: number
  label: string
  avgReactions: number
  postCount: number
}

interface FormatPerformance {
  format: string
  count: number
  avgReactions: number
  topEmoji: string | null
}

interface KeywordPerformance {
  word: string
  count: number
  avgReactions: number
}

function computeInsightsData(messages: TelegramMessage[]) {
  const posts = messages.filter((m) => m.type === "message")

  // ─── Engagement by hour ───────────────────────────────────────
  const hourBuckets: { reactions: number; count: number }[] = Array.from(
    { length: 24 },
    () => ({ reactions: 0, count: 0 })
  )
  // ─── Engagement by day ────────────────────────────────────────
  const dayBuckets: { reactions: number; count: number }[] = Array.from(
    { length: 7 },
    () => ({ reactions: 0, count: 0 })
  )

  // ─── Format performance ───────────────────────────────────────
  const formatMap = new Map<string, { reactions: number; count: number; emojiMap: Map<string, number> }>()

  // ─── Keyword tracking ─────────────────────────────────────────
  const wordReactions = new Map<string, { totalReactions: number; count: number }>()

  const stopWords = new Set([
    "that", "this", "with", "from", "have", "been", "will", "your", "what",
    "when", "where", "which", "their", "there", "would", "could", "should",
    "about", "after", "before", "being", "between", "both", "each", "also",
    "than", "then", "them", "they", "into", "just", "very", "some", "more",
    "only", "over", "such", "like", "http", "https", "were", "does", "done",
    "make", "made", "much", "many", "most", "other", "these", "those", "here",
  ])

  // ─── Length buckets ────────────────────────────────────────────
  const lengthBuckets = [
    { label: "Short (< 100)", min: 0, max: 100, reactions: 0, count: 0 },
    { label: "Medium (100-300)", min: 100, max: 300, reactions: 0, count: 0 },
    { label: "Long (300-600)", min: 300, max: 600, reactions: 0, count: 0 },
    { label: "Very Long (600+)", min: 600, max: Infinity, reactions: 0, count: 0 },
  ]

  for (const msg of posts) {
    const d = new Date(msg.date)
    const reactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
    const text = getMessageText(msg)

    // Hour
    hourBuckets[d.getHours()].reactions += reactions
    hourBuckets[d.getHours()].count++

    // Day
    dayBuckets[d.getDay()].reactions += reactions
    dayBuckets[d.getDay()].count++

    // Format
    let fmt: string
    if (msg.photo) fmt = "Photo"
    else if (msg.media_type === "video_file" || msg.mime_type?.startsWith("video/")) fmt = "Video"
    else if (msg.media_type === "animation") fmt = "GIF"
    else if (msg.media_type === "sticker") fmt = "Sticker"
    else if (msg.media_type === "audio_file" || msg.mime_type?.startsWith("audio/")) fmt = "Audio"
    else if (msg.forwarded_from) fmt = "Forwarded"
    else if (text.includes("http://") || text.includes("https://")) fmt = "With Links"
    else fmt = "Text Only"

    if (!formatMap.has(fmt)) formatMap.set(fmt, { reactions: 0, count: 0, emojiMap: new Map() })
    const fentry = formatMap.get(fmt)!
    fentry.reactions += reactions
    fentry.count++
    if (msg.reactions) {
      for (const r of msg.reactions) {
        fentry.emojiMap.set(r.emoji, (fentry.emojiMap.get(r.emoji) || 0) + r.count)
      }
    }

    // Keywords (only for posts with reactions, to find high-engagement keywords)
    if (reactions > 0) {
      const words = text
        .toLowerCase()
        .replace(/[^\w\s\u0400-\u04FF]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !stopWords.has(w))

      const unique = new Set(words)
      for (const w of unique) {
        if (!wordReactions.has(w)) wordReactions.set(w, { totalReactions: 0, count: 0 })
        const e = wordReactions.get(w)!
        e.totalReactions += reactions
        e.count++
      }
    }

    // Length buckets
    for (const bucket of lengthBuckets) {
      if (text.length >= bucket.min && text.length < bucket.max) {
        bucket.reactions += reactions
        bucket.count++
        break
      }
    }
  }

  // ─── Compile results ───────────────────────────────────────────

  const hourlyEngagement: EngagementByHour[] = hourBuckets.map((b, i) => ({
    hour: i,
    label: hourLabel(i),
    avgReactions: b.count > 0 ? Math.round((b.reactions / b.count) * 10) / 10 : 0,
    postCount: b.count,
  }))

  const dailyEngagement: EngagementByDay[] = dayBuckets.map((b, i) => ({
    day: i,
    label: DAY_SHORT[i],
    avgReactions: b.count > 0 ? Math.round((b.reactions / b.count) * 10) / 10 : 0,
    postCount: b.count,
  }))

  const formatPerformance: FormatPerformance[] = Array.from(formatMap.entries())
    .map(([fmt, data]) => {
      let topEmoji: string | null = null
      let maxE = 0
      for (const [emoji, count] of data.emojiMap) {
        if (count > maxE) {
          maxE = count
          topEmoji = emoji
        }
      }
      return {
        format: fmt,
        count: data.count,
        avgReactions: data.count > 0 ? Math.round((data.reactions / data.count) * 10) / 10 : 0,
        topEmoji,
      }
    })
    .sort((a, b) => b.avgReactions - a.avgReactions)

  const keywordPerformance: KeywordPerformance[] = Array.from(wordReactions.entries())
    .filter(([, data]) => data.count >= 3) // At least 3 posts to be significant
    .map(([word, data]) => ({
      word,
      count: data.count,
      avgReactions: Math.round((data.totalReactions / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.avgReactions - a.avgReactions)
    .slice(0, 20)

  const lengthPerf = lengthBuckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      label: b.label,
      avgReactions: Math.round((b.reactions / b.count) * 10) / 10,
      count: b.count,
    }))

  // ─── Generate actionable insights ────────────────────────────

  const insights: Insight[] = []

  // Best hour
  const bestHour = hourlyEngagement.reduce((a, b) => (b.avgReactions > a.avgReactions ? b : a), hourlyEngagement[0])
  const worstHour = hourlyEngagement.filter((h) => h.postCount > 0).reduce((a, b) => (b.avgReactions < a.avgReactions ? b : a), hourlyEngagement[0])
  if (bestHour.avgReactions > 0) {
    insights.push({
      icon: Clock,
      title: `Best posting time: ${bestHour.label}`,
      description: `Posts at ${bestHour.label} get ${bestHour.avgReactions} avg reactions, ${Math.round((bestHour.avgReactions / Math.max(worstHour.avgReactions, 0.1)) * 100 - 100)}% more than the worst hour (${worstHour.label}).`,
      type: "tip",
    })
  }

  // Best day
  const bestDay = dailyEngagement.reduce((a, b) => (b.avgReactions > a.avgReactions ? b : a), dailyEngagement[0])
  if (bestDay.avgReactions > 0) {
    insights.push({
      icon: Calendar,
      title: `Best day: ${DAY_NAMES[bestDay.day]}`,
      description: `${DAY_NAMES[bestDay.day]} posts average ${bestDay.avgReactions} reactions with ${bestDay.postCount.toLocaleString()} posts.`,
      type: "tip",
    })
  }

  // Best format
  if (formatPerformance.length > 0) {
    const best = formatPerformance[0]
    insights.push({
      icon: Image,
      title: `Top format: ${best.format}`,
      description: `"${best.format}" posts average ${best.avgReactions} reactions per post (${best.count.toLocaleString()} total).${best.topEmoji ? ` Most popular reaction: ${best.topEmoji}` : ""}`,
      type: "tip",
    })
  }

  // Best length
  if (lengthPerf.length > 0) {
    const bestLen = lengthPerf.reduce((a, b) => (b.avgReactions > a.avgReactions ? b : a))
    insights.push({
      icon: Type,
      title: `Optimal length: ${bestLen.label}`,
      description: `Posts in the "${bestLen.label}" range get ${bestLen.avgReactions} avg reactions (${bestLen.count.toLocaleString()} posts).`,
      type: "tip",
    })
  }

  // Top keywords
  if (keywordPerformance.length >= 3) {
    const top3 = keywordPerformance.slice(0, 3)
    insights.push({
      icon: Hash,
      title: "High-performing keywords",
      description: `Posts containing "${top3[0].word}", "${top3[1].word}", or "${top3[2].word}" tend to get higher engagement.`,
      type: "info",
    })
  }

  // Forwarded vs original
  const fwdFormat = formatPerformance.find((f) => f.format === "Forwarded")
  const textFormat = formatPerformance.find((f) => f.format === "Text Only")
  if (fwdFormat && textFormat) {
    if (fwdFormat.avgReactions > textFormat.avgReactions) {
      insights.push({
        icon: Forward,
        title: "Forwarded content outperforms originals",
        description: `Forwarded posts average ${fwdFormat.avgReactions} reactions vs ${textFormat.avgReactions} for text-only originals.`,
        type: "info",
      })
    } else {
      insights.push({
        icon: Target,
        title: "Original content wins",
        description: `Original text posts (${textFormat.avgReactions} avg) outperform forwarded content (${fwdFormat.avgReactions} avg). Keep creating original posts.`,
        type: "tip",
      })
    }
  }

  return {
    hourlyEngagement,
    dailyEngagement,
    formatPerformance,
    keywordPerformance,
    lengthPerf,
    insights,
    totalPosts: posts.length,
    totalReactions: posts.reduce((s, m) => s + (m.reactions?.reduce((s2, r) => s2 + r.count, 0) || 0), 0),
  }
}

function InsightTooltip({
  active,
  payload,
  labelKey,
  valueKey,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  labelKey: string
  valueKey: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground">{data.payload[labelKey]}</p>
      <p className="text-muted-foreground font-mono">
        {data.value.toLocaleString()} avg reactions
      </p>
      {data.payload.postCount != null && (
        <p className="text-muted-foreground/60 font-mono text-[10px]">
          {data.payload.postCount.toLocaleString()} posts
        </p>
      )}
    </div>
  )
}

// ─── Stable member color ────────────────────────────────────────────────────

const MEMBER_PALETTE = [
  "oklch(0.75 0.15 180)",
  "oklch(0.75 0.15 280)",
  "oklch(0.75 0.15 30)",
  "oklch(0.7 0.15 140)",
  "oklch(0.7 0.15 350)",
  "oklch(0.75 0.15 230)",
  "oklch(0.7 0.15 60)",
  "oklch(0.7 0.15 310)",
]

function memberColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return MEMBER_PALETTE[Math.abs(h) % MEMBER_PALETTE.length]
}

// ─── Member Breakdown ───────────────────────────────────────────────────────

function MemberBreakdownSection({
  members,
  primaryColor,
}: {
  members: MemberStat[]
  primaryColor: string
}) {
  const top10 = members.slice(0, 10)
  const maxMessages = top10[0]?.messageCount || 1

  // Compute share of voice
  const totalMessages = members.reduce((s, m) => s + m.messageCount, 0)

  // Activity diversity: how many different hours each person posts in
  const topContributor = top10[0]
  const topReactor = [...members].sort((a, b) => b.reactionsSent - a.reactionsSent)[0]
  const longestWriter = [...members].sort((a, b) => b.avgMessageLength - a.avgMessageLength)[0]

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
        <Users className="h-3.5 w-3.5" />
        Member Breakdown
      </h2>

      {/* Quick member highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {topContributor && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top Contributor</p>
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
                style={{ backgroundColor: memberColor(topContributor.name) }}
              >
                {topContributor.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{topContributor.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {topContributor.messageCount.toLocaleString()} msgs ({Math.round((topContributor.messageCount / totalMessages) * 100)}%)
                </p>
              </div>
            </div>
          </div>
        )}
        {topReactor && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Most Reactions Sent</p>
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
                style={{ backgroundColor: memberColor(topReactor.name) }}
              >
                {topReactor.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{topReactor.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{topReactor.reactionsSent.toLocaleString()} reactions sent</p>
              </div>
            </div>
          </div>
        )}
        {longestWriter && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Longest Messages</p>
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
                style={{ backgroundColor: memberColor(longestWriter.name) }}
              >
                {longestWriter.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{longestWriter.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{longestWriter.avgMessageLength} avg chars/msg</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top 10 member bar chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Member</div>
          <div className="col-span-2 text-right">Messages</div>
          <div className="col-span-1 text-right">Replies</div>
          <div className="col-span-2 text-right">Reactions</div>
          <div className="col-span-3">Share</div>
        </div>
        {top10.map((member, i) => {
          const pct = Math.round((member.messageCount / totalMessages) * 100)
          const color = memberColor(member.name)
          return (
            <div
              key={member.id}
              className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-b-0"
            >
              <div className="col-span-1 text-xs font-mono text-muted-foreground/50">{i + 1}</div>
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground truncate">{member.name}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-mono text-foreground">{member.messageCount.toLocaleString()}</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-xs font-mono text-muted-foreground">{member.repliesCount}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-mono text-muted-foreground">
                  {member.reactionsReceived}
                  {member.topEmojisUsed[0] && (
                    <span className="ml-1">{member.topEmojisUsed[0].emoji}</span>
                  )}
                </span>
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(member.messageCount / maxMessages) * 100}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity heatmap per top members */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {top10.slice(0, 4).map((member) => {
          const color = memberColor(member.name)
          const max = Math.max(...member.topHours, 1)
          const peakHour = member.topHours.indexOf(Math.max(...member.topHours))
          const activeHoursCount = member.topHours.filter((h) => h > 0).length

          return (
            <div key={member.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background"
                  style={{ backgroundColor: color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground">{member.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                  peak: {peakHour}:00
                </span>
              </div>

              {/* Hourly sparkline */}
              <div className="flex items-end gap-px h-10 w-full mb-1.5">
                {member.topHours.map((count, hour) => (
                  <div
                    key={hour}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${(count / max) * 100}%`,
                      minHeight: count > 0 ? 2 : 0,
                      backgroundColor: color,
                      opacity: hour === peakHour ? 0.9 : 0.35,
                    }}
                    title={`${hour}:00 - ${count} messages`}
                  />
                ))}
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-muted-foreground/40 font-mono">0:00</span>
                <span className="text-[9px] text-muted-foreground/40 font-mono">12:00</span>
                <span className="text-[9px] text-muted-foreground/40 font-mono">23:00</span>
              </div>

              {/* Mini stats */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MsgIcon className="h-3 w-3" />{member.messageCount} msgs
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ReplyIcon className="h-3 w-3" />{member.repliesCount} replies
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {activeHoursCount}h active
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function InsightsView({ messages, onClose }: InsightsViewProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const data = useMemo(() => computeInsightsData(messages), [messages])

  // Detect group mode: multiple unique senders
  const memberStats = useMemo(() => {
    const senders = new Set<string>()
    for (const m of messages) {
      if (m.type === "message" && m.from) senders.add(m.from)
      if (senders.size > 2) break
    }
    if (senders.size > 2) return computeMemberStats(messages)
    return null
  }, [messages])

  const isGroup = memberStats !== null && memberStats.length > 1

  const primaryColor = "oklch(0.7 0.15 180)"
  const mutedColor = "oklch(0.35 0.02 260)"

  const bestHour = data.hourlyEngagement.reduce((a, b) =>
    b.avgReactions > a.avgReactions ? b : a,
    data.hourlyEngagement[0]
  )
  const bestDay = data.dailyEngagement.reduce((a, b) =>
    b.avgReactions > a.avgReactions ? b : a,
    data.dailyEngagement[0]
  )

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Content Insights
              </h1>
              <p className="text-xs text-muted-foreground">
                Data-driven recommendations from {data.totalPosts.toLocaleString()} posts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close insights"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-8">
        {/* Activity Heatmap */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Posting Activity
          </h2>
          <ActivityHeatmap messages={messages} />
        </section>

        {/* Per-member Breakdown (groups only) */}
        {isGroup && memberStats && (
          <MemberBreakdownSection members={memberStats} primaryColor={primaryColor} />
        )}

        {/* Key Insights cards */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Key Recommendations
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.insights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 flex gap-3 ${
                  insight.type === "tip"
                    ? "border-primary/20 bg-primary/5"
                    : insight.type === "warning"
                      ? "border-destructive/20 bg-destructive/5"
                      : "border-border bg-card"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  insight.type === "tip" ? "bg-primary/10" : "bg-secondary"
                }`}>
                  <insight.icon className={`h-4 w-4 ${
                    insight.type === "tip" ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{insight.title}</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Engagement by Hour chart */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Avg Reactions by Posting Hour
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyEngagement} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<InsightTooltip labelKey="label" valueKey="avgReactions" />} cursor={false} />
                  <Bar dataKey="avgReactions" radius={[4, 4, 0, 0]}>
                    {data.hourlyEngagement.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={entry.hour === bestHour.hour ? primaryColor : mutedColor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Engagement by Day chart */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Avg Reactions by Day of Week
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyEngagement} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<InsightTooltip labelKey="label" valueKey="avgReactions" />} cursor={false} />
                  <Bar dataKey="avgReactions" radius={[6, 6, 0, 0]}>
                    {data.dailyEngagement.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.day === bestDay.day ? primaryColor : mutedColor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Format Performance */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <Image className="h-3.5 w-3.5" />
            Format Performance
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              <div className="col-span-4">Format</div>
              <div className="col-span-2 text-right">Posts</div>
              <div className="col-span-3 text-right">Avg Reactions</div>
              <div className="col-span-1 text-center">Top</div>
              <div className="col-span-2 text-right">Rating</div>
            </div>
            {data.formatPerformance.map((fp, i) => {
              const maxAvg = data.formatPerformance[0]?.avgReactions || 1
              return (
                <div
                  key={fp.format}
                  className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border/40 last:border-b-0"
                >
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      {i === 0 && <ArrowUp className="h-3 w-3 text-primary" />}
                      {i === data.formatPerformance.length - 1 && data.formatPerformance.length > 1 && (
                        <ArrowDown className="h-3 w-3 text-destructive" />
                      )}
                      <span className="text-sm font-medium text-foreground">{fp.format}</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-mono text-muted-foreground">
                      {fp.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-sm font-mono font-medium text-foreground">
                      {fp.avgReactions}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    {fp.topEmoji && <span className="text-sm">{fp.topEmoji}</span>}
                  </div>
                  <div className="col-span-2">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${(fp.avgReactions / maxAvg) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Post Length Performance */}
        {data.lengthPerf.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Type className="h-3.5 w-3.5" />
              Post Length vs Engagement
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.lengthPerf} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                    />
                    <Tooltip content={<InsightTooltip labelKey="label" valueKey="avgReactions" />} cursor={false} />
                    <Bar dataKey="avgReactions" fill={primaryColor} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Top Keywords */}
        {data.keywordPerformance.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Hash className="h-3.5 w-3.5" />
              High-Engagement Keywords
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Words that appear in posts with above-average reactions (min 3 posts)
            </p>
            <div className="flex flex-wrap gap-2">
              {data.keywordPerformance.map((kw) => (
                <div
                  key={kw.word}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">{kw.word}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono text-primary">{kw.avgReactions} avg</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{kw.count} posts</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
