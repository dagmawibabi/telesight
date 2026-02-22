"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  X,
  Brain,
  Shield,
  AlertTriangle,
  MessageSquare,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import {
  findManipulation,
  getManipulationStats,
  getManipulationTypeDescription,
  getSeverityColor,
  type ManipulationResult,
  type ManipulationType,
} from "@/lib/manipulation-detector"
import type { MediaFileMap } from "@/hooks/use-media-url"
import { useMediaUrl } from "@/hooks/use-media-url"

interface ManipulationViewProps {
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

// ─── Severity Badge ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: "mild" | "moderate" | "severe" }) {
  const labels = {
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
  }

  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSeverityColor(severity)}`}>
      <Shield className="h-3 w-3" />
      {labels[severity]}
    </span>
  )
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ManipulationType }) {
  return (
    <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
      {getManipulationTypeDescription(type)}
    </span>
  )
}

// ─── Manipulation Card ─────────────────────────────────────────────────────────

function ManipulationCard({
  result,
  onClick,
  mediaFileMap,
}: {
  result: ManipulationResult
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
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={result.severity} />
          {result.types.map(type => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {format(new Date(result.message.date), "MMM d, HH:mm")}
        </span>
      </div>

      {result.message.from && (
        <p className="text-xs font-medium text-foreground mb-2">
          {result.message.from}
        </p>
      )}

      {photoUrl && (
        <div className="mb-2 rounded-lg overflow-hidden">
          <img
            src={photoUrl}
            alt=""
            className="w-full max-h-48 object-cover"
            loading="lazy"
          />
        </div>
      )}

      <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap mb-3">
        {text}
      </p>

      <div className="flex flex-wrap gap-1">
        {result.reasons.map((reason, i) => (
          <span
            key={i}
            className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {reason}
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Score: {result.score.toFixed(1)}</span>
        <span>·</span>
        <span>Sentiment: {result.sentimentScore > 0 ? "+" : ""}{result.sentimentScore}</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ManipulationView({
  messages,
  onClose,
  onPostClick,
  mediaFileMap,
}: ManipulationViewProps) {
  const [minSeverity, setMinSeverity] = useState<"mild" | "moderate" | "severe">("mild")
  const [selectedTypes, setSelectedTypes] = useState<ManipulationType[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const stats = useMemo(() => getManipulationStats(messages), [messages])

  const filteredResults = useMemo(() => {
    return findManipulation(messages, {
      minSeverity,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      maxResults: 50,
    })
  }, [messages, minSeverity, selectedTypes])

  const manipulationTypes: ManipulationType[] = [
    "gaslighting",
    "guilt_tripping",
    "passive_aggressive",
    "controlling",
    "dismissive",
    "victimhood",
  ]

  const toggleType = (type: ManipulationType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <Brain className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Behavior Analysis
              </h1>
              <p className="text-xs text-muted-foreground">
                Detecting manipulative communication patterns
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
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
          <StatCard
            icon={AlertTriangle}
            label="Detected"
            value={stats.totalManipulation}
            sub={`${(stats.manipulationRate * 100).toFixed(1)}% of messages`}
            color="text-purple-500"
          />
          <StatCard
            icon={Shield}
            label="Severe"
            value={stats.bySeverity.severe}
            sub={`${stats.bySeverity.moderate} moderate · ${stats.bySeverity.mild} mild`}
            color="text-red-500"
          />
          <StatCard
            icon={MessageSquare}
            label="Types Found"
            value={Object.values(stats.byType).filter(c => c > 0).length}
            sub="Different manipulation categories"
            color="text-orange-500"
          />
          <StatCard
            icon={BarChart3}
            label="Avg Score"
            value={stats.averageScore.toFixed(1)}
            sub="Severity rating"
            color="text-blue-500"
          />
        </div>

        {/* Type Breakdown */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            By Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {manipulationTypes.map(type => {
              const count = stats.byType[type]
              if (count === 0) return null
              return (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">
                    {getManipulationTypeDescription(type)}
                  </span>
                  <span className="text-xs font-medium font-mono">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Contributors (for groups) */}
        {stats.topContributors.length > 1 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Most Frequent
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {stats.topContributors.map((contributor, i) => (
                <div
                  key={contributor.name}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0"
                >
                  <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {contributor.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono ml-2">
                        {contributor.count} messages · {contributor.score.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500/60 transition-all"
                        style={{
                          width: `${(contributor.score / stats.topContributors[0].score) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showFilters && (
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-4">
              {/* Severity Filter */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Minimum severity:</span>
                <div className="flex items-center gap-1">
                  {(["mild", "moderate", "severe"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setMinSeverity(level)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all capitalize ${
                        minSeverity === level
                          ? level === "severe"
                            ? "bg-red-500/20 text-red-600"
                            : level === "moderate"
                            ? "bg-orange-500/20 text-orange-600"
                            : "bg-yellow-500/20 text-yellow-600"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Categories:</span>
                <div className="flex flex-wrap gap-1">
                  {manipulationTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                        selectedTypes.includes(type)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {getManipulationTypeDescription(type)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-3">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Shield className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm">No manipulative patterns detected at this level</p>
              <button
                onClick={() => { setMinSeverity("mild"); setSelectedTypes([]); }}
                className="text-xs text-primary hover:underline"
              >
                Show all messages
              </button>
            </div>
          ) : (
            filteredResults.map((result) => (
              <ManipulationCard
                key={result.message.id}
                result={result}
                onClick={() => onPostClick?.(result.message)}
                mediaFileMap={mediaFileMap}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
