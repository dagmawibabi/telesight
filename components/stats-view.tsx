"use client"

import { useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import {
  X,
  MessageSquare,
  Heart,
  Link2,
  Image,
  Forward,
  Reply,
  Clock,
  Calendar,
  Type,
  Hash,
  Flame,
  Zap,
  TrendingUp,
  BarChart3,
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
  AreaChart,
  Area,
} from "recharts"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import {
  computeAnalytics,
  computeHashtagAnalytics,
  type OverviewInsights,
  type HashtagStat,
} from "@/lib/analytics"
import { getTopPosts, type TopPost } from "@/lib/post-scoring"
import { Download, Trophy, Award } from "lucide-react"

interface StatsViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xl font-semibold font-mono text-foreground leading-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
        {sub && (
          <span className="text-[10px] text-muted-foreground/60">{sub}</span>
        )}
      </div>
    </div>
  )
}

// ─── Highlight card ─────────────────────────────────────────────────────────

function HighlightCard({
  label,
  value,
  emoji,
}: {
  label: string
  value: string
  emoji?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <span className="text-xs text-primary/70 font-medium uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {emoji && <span className="text-lg">{emoji}</span>}
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  )
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  labelKey,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: Record<string, unknown> }>
  labelKey: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground">
        {data.payload[labelKey] as string}
      </p>
      <p className="text-muted-foreground font-mono">
        {data.value.toLocaleString()} posts
      </p>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function StatsView({ messages, onClose, onPostClick }: StatsViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "hashtags" | "top-posts">("overview")
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined)
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined)

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

  const insights = useMemo(
    () => computeAnalytics(messages, selectedYear, selectedMonth),
    [messages, selectedYear, selectedMonth]
  )

  const hashtagStats = useMemo(
    () => computeHashtagAnalytics(messages),
    [messages]
  )

  const topPosts = useMemo(
    () => getTopPosts(messages, 30),
    [messages]
  )

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]

  const filterLabel = selectedYear
    ? selectedMonth !== undefined
      ? `${MONTHS[selectedMonth]} ${selectedYear}`
      : `${selectedYear}`
    : "All Time"

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Analytics
              </h1>
              <p className="text-xs text-muted-foreground">{filterLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close stats"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex gap-1 border-b border-transparent">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "overview"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("hashtags")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "hashtags"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Hashtags
              <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                {hashtagStats.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("top-posts")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "top-posts"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Top Posts
              <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                {topPosts.length}
              </span>
            </button>

            {/* CSV Export */}
            <div className="ml-auto">
              <button
                onClick={() => exportCsv(messages)}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {activeTab === "overview" ? (
          <OverviewTab
            insights={insights}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            months={MONTHS}
          />
        ) : activeTab === "top-posts" ? (
          <TopPostsTab topPosts={topPosts} onPostClick={onPostClick} />
        ) : (
          <HashtagTab stats={hashtagStats} />
        )}
      </div>
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({
  insights,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  months,
}: {
  insights: OverviewInsights
  selectedYear?: number
  selectedMonth?: number
  onYearChange: (y: number | undefined) => void
  onMonthChange: (m: number | undefined) => void
  months: string[]
}) {
  const { time, content } = insights

  // Chart colors
  const primaryColor = "oklch(0.7 0.15 180)"
  const mutedColor = "oklch(0.35 0.02 260)"

  return (
    <div className="flex flex-col gap-8">
      {/* Year / Month selectors */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              onYearChange(undefined)
              onMonthChange(undefined)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedYear === undefined
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All Time
          </button>
          {insights.years.map((y) => (
            <button
              key={y}
              onClick={() => {
                onYearChange(y)
                onMonthChange(undefined)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium font-mono transition-all ${
                selectedYear === y
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {selectedYear && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => onMonthChange(undefined)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                selectedMonth === undefined
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {months.map((m, i) => (
              <button
                key={m}
                onClick={() => onMonthChange(i)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  selectedMonth === i
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* General Stats Grid */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          General
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={MessageSquare}
            label="Total Posts"
            value={time.hourly.reduce((s, h) => s + h.count, 0)}
            sub={`~${time.avgPerDay}/day`}
          />
          <StatCard
            icon={Heart}
            label="Total Reactions"
            value={content.totalReactions}
            sub={content.postsWithReactions > 0
              ? `${Math.round(content.totalReactions / content.postsWithReactions)} avg/post`
              : undefined
            }
          />
          <StatCard
            icon={Type}
            label="Total Words"
            value={content.totalWords}
            sub={`~${content.avgWordsPerPost} per post`}
          />
          <StatCard
            icon={Zap}
            label="Total Characters"
            value={content.totalCharacters}
            sub={`~${content.avgLength} avg length`}
          />
        </div>
      </section>

      {/* Content breakdown */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Content Breakdown
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={Image} label="With Media" value={content.postsWithMedia} />
          <StatCard icon={Link2} label="With Links" value={content.postsWithLinks} />
          <StatCard icon={Heart} label="With Reactions" value={content.postsWithReactions} />
          <StatCard icon={Forward} label="Forwarded" value={content.postsForwarded} />
          <StatCard icon={Reply} label="Replies" value={content.postsWithReplies} />
        </div>
      </section>

      {/* Time Highlights */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Time Highlights
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HighlightCard
            label="Peak Hour"
            value={`${time.peakHour.label} (${time.peakHour.count.toLocaleString()} posts)`}
          />
          <HighlightCard
            label="Quietest Hour"
            value={`${time.quietHour.label} (${time.quietHour.count.toLocaleString()} posts)`}
          />
          <HighlightCard
            label="Busiest Day"
            value={`${time.peakDay.label} (${time.peakDay.count.toLocaleString()} posts)`}
          />
          <HighlightCard
            label="Quietest Day"
            value={`${time.quietDay.label} (${time.quietDay.count.toLocaleString()} posts)`}
          />
          <HighlightCard
            label="Busiest Month"
            value={`${time.peakMonth.label} (${time.peakMonth.count.toLocaleString()})`}
          />
          <HighlightCard
            label="Avg per Day"
            value={`${time.avgPerDay} posts`}
          />
          <HighlightCard
            label="Longest Streak"
            value={`${time.longestStreak} days`}
            emoji={time.longestStreak > 30 ? undefined : undefined}
          />
          <HighlightCard
            label="Longest Gap"
            value={
              time.longestGap > 0
                ? `${time.longestGap} days (${time.longestGapStart ? format(new Date(time.longestGapStart), "MMM d, yyyy") : "-"})`
                : "No gaps"
            }
          />
        </div>
      </section>

      {/* Hourly Chart */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Posting by Hour
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={time.hourly} barCategoryGap="12%">
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
                <Tooltip content={<CustomTooltip labelKey="label" />} cursor={false} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {time.hourly.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={
                        entry.hour === time.peakHour.hour
                          ? primaryColor
                          : mutedColor
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Day of Week Chart */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          Posting by Day of Week
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={time.dayOfWeek} barCategoryGap="18%">
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
                <Tooltip content={<CustomTooltip labelKey="label" />} cursor={false} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {time.dayOfWeek.map((entry) => (
                    <Cell
                      key={entry.day}
                      fill={
                        entry.day === time.peakDay.day
                          ? primaryColor
                          : mutedColor
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Monthly Trend */}
      {time.monthly.length > 1 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Monthly Trend
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={time.monthly}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={primaryColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(time.monthly.length / 12))}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip labelKey="label" />} cursor={false} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={primaryColor}
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Yearly breakdown */}
      {time.yearly.length > 1 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Yearly Breakdown
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={time.yearly} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip labelKey="year" />} cursor={false} />
                  <Bar dataKey="count" fill={primaryColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Top forwarded sources */}
      {content.topForwardedFrom.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <Forward className="h-3.5 w-3.5" />
            Top Forwarded Sources
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {content.topForwardedFrom.map((source, i) => {
              const maxCount = content.topForwardedFrom[0].count
              return (
                <div
                  key={source.name}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0"
                >
                  <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {source.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono ml-2">
                        {source.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{
                          width: `${(source.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Hashtag Tab ────────────────────────────────────────────────────────────

function HashtagTab({ stats }: { stats: HashtagStat[] }) {
  const [sortBy, setSortBy] = useState<"count" | "reactions">("count")

  const sorted = useMemo(() => {
    return [...stats].sort((a, b) =>
      sortBy === "count"
        ? b.count - a.count
        : b.totalReactions - a.totalReactions
    )
  }, [stats, sortBy])

  const maxCount = sorted[0]?.count || 1
  const maxReactions = sorted.reduce((m, s) => Math.max(m, s.totalReactions), 1)

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Hash className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm">No hashtags found in this channel</p>
      </div>
    )
  }

  // Top 10 for chart
  const chartData = sorted.slice(0, 15).map((s) => ({
    tag: s.tag,
    count: s.count,
    reactions: s.totalReactions,
  }))

  const primaryColor = "oklch(0.7 0.15 180)"

  return (
    <div className="flex flex-col gap-8">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Hash}
          label="Unique Hashtags"
          value={stats.length}
        />
        <StatCard
          icon={Flame}
          label="Most Used"
          value={sorted[0]?.tag || "-"}
          sub={sorted[0] ? `${sorted[0].count} posts` : undefined}
        />
        <StatCard
          icon={Heart}
          label="Most Reacted Hashtag"
          value={
            [...stats].sort((a, b) => b.totalReactions - a.totalReactions)[0]
              ?.tag || "-"
          }
          sub={
            [...stats].sort((a, b) => b.totalReactions - a.totalReactions)[0]
              ? `${[...stats].sort((a, b) => b.totalReactions - a.totalReactions)[0].totalReactions.toLocaleString()} reactions`
              : undefined
          }
        />
        <StatCard
          icon={MessageSquare}
          label="Total Hashtag Uses"
          value={stats.reduce((s, h) => s + h.count, 0)}
        />
      </div>

      {/* Top hashtags chart */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Top Hashtags
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" barCategoryGap="14%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.25 0.005 260)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  tick={{ fill: "oklch(0.6 0 0)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<CustomTooltip labelKey="tag" />} cursor={false} />
                <Bar dataKey="count" fill={primaryColor} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Sort toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <button
          onClick={() => setSortBy("count")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            sortBy === "count"
              ? "bg-primary/20 text-primary"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Post count
        </button>
        <button
          onClick={() => setSortBy("reactions")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            sortBy === "reactions"
              ? "bg-primary/20 text-primary"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Reactions
        </button>
      </div>

      {/* Full list */}
      <section>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            <div className="col-span-4">Hashtag</div>
            <div className="col-span-2 text-right">Posts</div>
            <div className="col-span-2 text-right">Reactions</div>
            <div className="col-span-2 text-center">Top</div>
            <div className="col-span-2 text-right">Active</div>
          </div>

          {sorted.map((stat) => {
            const firstDate = format(new Date(stat.firstUsed), "MMM yy")
            const lastDate = format(new Date(stat.lastUsed), "MMM yy")
            const dateRange =
              firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`

            return (
              <div
                key={stat.tag}
                className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-secondary/20 transition-colors"
              >
                <div className="col-span-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {stat.tag}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/50 transition-all"
                      style={{
                        width: `${(stat.count / maxCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-mono font-medium text-foreground">
                    {stat.count.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-mono text-muted-foreground">
                    {stat.totalReactions.toLocaleString()}
                  </span>
                  {stat.totalReactions > 0 && (
                    <div className="mt-1 h-0.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-chart-4/50 transition-all"
                        style={{
                          width: `${(stat.totalReactions / maxReactions) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  {stat.topReaction ? (
                    <span className="text-sm">
                      {stat.topReaction.emoji}{" "}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {stat.topReaction.count.toLocaleString()}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">-</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[11px] text-muted-foreground">
                    {dateRange}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─── CSV Export ─────────────────────────────────────────────────────────────

function exportCsv(messages: TelegramMessage[]) {
  const posts = messages.filter((m) => m.type === "message")
  const headers = [
    "ID", "Date", "Time", "From", "Text", "Reactions Total",
    "Reactions Detail", "Has Media", "Media Type", "Is Forwarded",
    "Forwarded From", "Reply To", "Links", "Hashtags",
  ]

  const rows = posts.map((msg) => {
    const text = getMessageText(msg)
    const d = new Date(msg.date)
    const totalReactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
    const reactionsDetail = msg.reactions
      ? msg.reactions.map((r) => `${r.emoji}:${r.count}`).join("; ")
      : ""
    const hasMedia = msg.photo || msg.file || msg.media_type ? "Yes" : "No"
    const links: string[] = []
    const hashtags: string[] = []
    if (Array.isArray(msg.text)) {
      for (const part of msg.text) {
        if (typeof part !== "string") {
          if (part.type === "link") links.push(part.text)
          if (part.type === "text_link" && part.href) links.push(part.href)
          if (part.type === "hashtag") hashtags.push(part.text)
        }
      }
    }

    return [
      msg.id,
      format(d, "yyyy-MM-dd"),
      format(d, "HH:mm:ss"),
      msg.from || msg.actor || "",
      `"${text.replace(/"/g, '""').replace(/\n/g, " ")}"`,
      totalReactions,
      `"${reactionsDetail}"`,
      hasMedia,
      msg.media_type || "",
      msg.forwarded_from ? "Yes" : "No",
      msg.forwarded_from || "",
      msg.reply_to_message_id || "",
      `"${links.join("; ")}"`,
      `"${hashtags.join("; ")}"`,
    ]
  })

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `telegram-export-${format(new Date(), "yyyy-MM-dd")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Top Posts Tab ──────────────────────────────────────────────────────────

function TopPostsTab({
  topPosts,
  onPostClick,
}: {
  topPosts: TopPost[]
  onPostClick?: (message: TelegramMessage) => void
}) {
  if (topPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Trophy className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm">No posts with reactions found</p>
      </div>
    )
  }

  const maxReactions = topPosts[0]?.totalReactions || 1

  return (
    <div className="flex flex-col gap-6">
      {/* Podium top 3 */}
      {topPosts.length >= 3 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" />
            Most Engaging Posts
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {topPosts.slice(0, 3).map((tp, i) => {
              const text = getMessageText(tp.message)
              const medalColors = [
                "border-yellow-500/40 bg-yellow-500/5",
                "border-gray-400/40 bg-gray-400/5",
                "border-amber-700/40 bg-amber-700/5",
              ]
              const medalLabels = ["1st", "2nd", "3rd"]
              return (
                <button
                  key={tp.message.id}
                  onClick={() => onPostClick?.(tp.message)}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:scale-[1.02] cursor-pointer ${medalColors[i]}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">{medalLabels[i]}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      #{tp.message.id}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 line-clamp-3">
                    {text.slice(0, 200) || (tp.message.photo ? "[Photo]" : "[Media]")}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-lg font-bold font-mono text-foreground">
                      {tp.totalReactions.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">reactions</span>
                    {tp.message.reactions && (
                      <div className="flex gap-1 ml-auto">
                        {tp.message.reactions.slice(0, 3).map((r, ri) => (
                          <span key={ri} className="text-sm">{r.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(tp.message.date), "MMM d, yyyy")}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Full list */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          All Top Posts
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Post</div>
            <div className="col-span-2 text-right">Reactions</div>
            <div className="col-span-2 text-center">Top</div>
            <div className="col-span-2 text-right">Date</div>
          </div>

          {topPosts.map((tp, i) => {
            const text = getMessageText(tp.message)
            return (
              <button
                key={tp.message.id}
                onClick={() => onPostClick?.(tp.message)}
                className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-secondary/20 transition-colors w-full text-left cursor-pointer"
              >
                <div className="col-span-1">
                  <span className="text-xs font-mono text-muted-foreground/50">
                    {i + 1}
                  </span>
                </div>
                <div className="col-span-5 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {text.slice(0, 100) || (tp.message.photo ? "[Photo]" : "[Media]")}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${(tp.totalReactions / maxReactions) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-mono font-medium text-foreground">
                    {tp.totalReactions.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  {tp.message.reactions && (
                    <div className="flex gap-0.5 justify-center">
                      {tp.message.reactions.slice(0, 3).map((r, ri) => (
                        <span key={ri} className="text-xs">{r.emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(tp.message.date), "MMM d, yy")}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
