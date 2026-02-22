"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  X,
  AlertTriangle,
  Flame,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Skull,
  Zap,
  BarChart3,
  Users,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import {
  findConflicts,
  findHeatedExchanges,
  getConflictStats,
  type ConflictResult,
} from "@/lib/conflict-detector"
import { useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"

interface ConflictViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
  mediaFileMap?: MediaFileMap | null
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-muted-foreground",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary ${color}`}>
        <Icon className="h-4 w-4" />
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

// ─── Intensity Badge ─────────────────────────────────────────────────────────

function IntensityBadge({ intensity }: { intensity: "low" | "medium" | "high" }) {
  const colors = {
    low: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    high: "bg-red-500/10 text-red-600 border-red-500/20",
  }

  const icons = {
    low: AlertTriangle,
    medium: Flame,
    high: Skull,
  }

  const Icon = icons[intensity]

  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[intensity]}`}
    >
      <Icon className="h-3 w-3" />
      {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
    </span>
  )
}

// ─── Conflict Message Card ────────────────────────────────────────────────────

function ConflictCard({
  result,
  onClick,
  mediaFileMap,
}: {
  result: ConflictResult
  onClick: () => void
  mediaFileMap?: MediaFileMap | null
}) {
  const text = getMessageText(result.message)
  const photoUrl = useMediaUrl(mediaFileMap ?? null, result.message.photo)

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <IntensityBadge intensity={result.intensity} />
          <span className="text-[10px] text-muted-foreground font-mono">
            Score: {result.score}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(result.message.date), "MMM d, HH:mm")}
        </span>
      </div>

      {result.message.from && (
        <p className="mt-2 text-xs font-medium text-foreground">
          {result.message.from}
        </p>
      )}

      {photoUrl && (
        <div className="mt-2 rounded-lg overflow-hidden">
          <img
            src={photoUrl}
            alt=""
            className="w-full max-h-48 object-cover"
            loading="lazy"
          />
        </div>
      )}

      <p className="mt-2 text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">
        {text}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {result.reasons.map((reason, i) => (
          <span
            key={i}
            className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {reason}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Exchange Card ───────────────────────────────────────────────────────────

function ExchangeCard({
  exchange,
  onMessageClick,
  isExpanded,
  onToggle,
  mediaFileMap,
}: {
  exchange: ReturnType<typeof findHeatedExchanges>[0]
  onMessageClick: (msg: TelegramMessage) => void
  isExpanded: boolean
  onToggle: () => void
  mediaFileMap?: MediaFileMap | null
}) {
  const duration = Math.ceil(
    (exchange.endTime.getTime() - exchange.startTime.getTime()) / 60000
  )

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
            <Zap className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              Heated Exchange
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format(exchange.startTime, "MMM d, HH:mm")} -{" "}
              {format(exchange.endTime, "HH:mm")} · {duration} min ·{" "}
              {exchange.messages.length} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            Intensity: {exchange.intensity}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4 space-y-3">
          {exchange.messages.map((result) => (
            <ConflictCard
              key={result.message.id}
              result={result}
              onClick={() => onMessageClick(result.message)}
              mediaFileMap={mediaFileMap}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConflictView({
  messages,
  onClose,
  onPostClick,
  mediaFileMap,
}: ConflictViewProps) {
  const [activeTab, setActiveTab] = useState<"messages" | "exchanges">("messages")
  const [expandedExchange, setExpandedExchange] = useState<number | null>(null)
  const [minIntensity, setMinIntensity] = useState<"low" | "medium" | "high">("low")

  const stats = useMemo(() => getConflictStats(messages), [messages])
  const conflicts = useMemo(() => findConflicts(messages), [messages])
  const exchanges = useMemo(() => findHeatedExchanges(messages), [messages])

  const filteredConflicts = useMemo(() => {
    const minScore = minIntensity === "high" ? 8 : minIntensity === "medium" ? 4 : 2
    return conflicts.filter((c) => c.score >= minScore)
  }, [conflicts, minIntensity])

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Conflict Detection
              </h1>
              <p className="text-xs text-muted-foreground">
                AI-powered analysis of tense messages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex gap-1 border-b border-transparent">
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "messages"
                  ? "border-red-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Messages
              <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                {filteredConflicts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("exchanges")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "exchanges"
                  ? "border-red-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-4 w-4" />
              Exchanges
              <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                {exchanges.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
          <StatCard
            icon={AlertTriangle}
            label="Total Conflicts"
            value={stats.totalConflicts}
            sub={`${(stats.conflictRate * 100).toFixed(1)}% of messages`}
            color="text-red-500"
          />
          <StatCard
            icon={Flame}
            label="High Intensity"
            value={stats.byIntensity.high}
            sub={`${stats.byIntensity.medium} medium · ${stats.byIntensity.low} low`}
            color="text-orange-500"
          />
          <StatCard
            icon={Clock}
            label="Heated Exchanges"
            value={stats.heatedExchanges}
            sub="Back-and-forth conflicts"
            color="text-yellow-500"
          />
          <StatCard
            icon={BarChart3}
            label="Avg Score"
            value={stats.averageScore.toFixed(1)}
            sub="Conflict severity"
            color="text-blue-500"
          />
        </div>

        {/* Top Contributors (for groups) */}
        {stats.topContributors.length > 1 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Most Active in Conflicts
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {stats.topContributors.map(([name, score], i) => (
                <div
                  key={name}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0"
                >
                  <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono ml-2">
                        {score.toFixed(0)} pts
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/60 transition-all"
                        style={{
                          width: `${(score / stats.topContributors[0][1]) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Minimum intensity:</span>
          <div className="flex items-center gap-1">
            {(["low", "medium", "high"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setMinIntensity(level)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  minIntensity === level
                    ? level === "high"
                      ? "bg-red-500/20 text-red-600"
                      : level === "medium"
                      ? "bg-orange-500/20 text-orange-600"
                      : "bg-yellow-500/20 text-yellow-600"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "messages" ? (
          <div className="space-y-3">
            {filteredConflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No conflicts found at this intensity level</p>
                <button
                  onClick={() => setMinIntensity("low")}
                  className="text-xs text-primary hover:underline"
                >
                  Show all messages
                </button>
              </div>
            ) : (
              filteredConflicts.map((result) => (
                <ConflictCard
                  key={result.message.id}
                  result={result}
                  onClick={() => onPostClick?.(result.message)}
                  mediaFileMap={mediaFileMap}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {exchanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <Zap className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No heated exchanges detected</p>
                <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
                  Exchanges are consecutive negative messages within 10 minutes
                </p>
              </div>
            ) : (
              exchanges.map((exchange, idx) => (
                <ExchangeCard
                  key={idx}
                  exchange={exchange}
                  onMessageClick={(msg) => onPostClick?.(msg)}
                  isExpanded={expandedExchange === idx}
                  onToggle={() =>
                    setExpandedExchange(expandedExchange === idx ? null : idx)
                  }
                  mediaFileMap={mediaFileMap}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
