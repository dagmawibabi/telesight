"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  X,
  Shield,
  AlertTriangle,
  Link,
  DollarSign,
  UserX,
  Clock,
  MessageSquare,
  Users,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import type { MediaFileMap } from "@/hooks/use-media-url"
import { useMediaUrl } from "@/hooks/use-media-url"
import { findFraud, getFraudStats, getFraudTypeDescription, getFraudSeverityColor, type FraudType } from "@/lib/fraud-detector"

interface FraudViewProps {
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

// ─── Message Card ─────────────────────────────────────────────────────────────

function MessageCard({
  message,
  onClick,
  mediaFileMap,
  badge,
}: {
  message: TelegramMessage
  onClick: () => void
  mediaFileMap?: MediaFileMap | null
  badge?: React.ReactNode
}) {
  const text = getMessageText(message)
  const photoUrl = useMediaUrl(mediaFileMap ?? null, message.photo)

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {badge}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {format(new Date(message.date), "MMM d, HH:mm")}
        </span>
      </div>

      {message.from && (
        <p className="text-xs font-medium text-foreground mb-2">
          {message.from}
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

      <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">
        {text}
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FraudView({
  messages,
  onClose,
  onPostClick,
  mediaFileMap,
}: FraudViewProps) {
  const [minSeverity, setMinSeverity] = useState<"low" | "medium" | "high" | "critical">("low")
  const [selectedTypes, setSelectedTypes] = useState<FraudType[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Get fraud data
  const stats = useMemo(() => getFraudStats(messages), [messages])
  
  const frauds = useMemo(() => findFraud(messages, { 
    minSeverity,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    maxResults: 50 
  }), [messages, minSeverity, selectedTypes])

  const fraudTypes: FraudType[] = [
    "phishing", "money_request", "impersonation", "urgency", "suspicious_link"
  ]

  const toggleType = (type: FraudType) => {
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Shield className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Fraud & Scam Detection
              </h1>
              <p className="text-xs text-muted-foreground">
                Phishing, money scams, impersonation detection
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
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
          <StatCard
            icon={AlertTriangle}
            label="Total Detected"
            value={stats.total}
            sub={`${stats.bySeverity.critical} critical alerts`}
            color="text-red-500"
          />
          <StatCard
            icon={Link}
            label="Phishing"
            value={stats.byType.phishing}
            sub="Fake login / malicious links"
            color="text-blue-500"
          />
          <StatCard
            icon={DollarSign}
            label="Money Scams"
            value={stats.byType.money_request}
            sub="Urgent money requests"
            color="text-green-500"
          />
          <StatCard
            icon={UserX}
            label="Impersonation"
            value={stats.byType.impersonation}
            sub="Fake admin/support"
            color="text-purple-500"
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showFilters && (
            <div className="mt-3 space-y-4 rounded-xl border border-border bg-card p-4">
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Minimum severity:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {(["low", "medium", "high", "critical"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setMinSeverity(level)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all capitalize ${
                        minSeverity === level
                          ? level === "critical"
                            ? "bg-red-500/20 text-red-600"
                            : level === "high"
                            ? "bg-orange-500/20 text-orange-600"
                            : level === "medium"
                            ? "bg-yellow-500/20 text-yellow-600"
                            : "bg-blue-500/20 text-blue-600"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Fraud types:</span>
                <div className="flex flex-wrap gap-1">
                  {fraudTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`rounded-md px-3 py-1.5 text-sm transition-all ${
                        selectedTypes.includes(type)
                          ? "bg-red-500/20 text-red-600"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {getFraudTypeDescription(type)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {frauds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Shield className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-medium">No fraud patterns detected</p>
            <p className="text-sm">Your conversation appears safe</p>
            {(selectedTypes.length > 0 || minSeverity !== "low") && (
              <button
                onClick={() => { setMinSeverity("low"); setSelectedTypes([]); }}
                className="text-sm text-primary hover:underline mt-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {frauds.map((fraud) => {
              const Icon = fraud.type === "phishing" ? Link 
                : fraud.type === "money_request" ? DollarSign 
                : fraud.type === "impersonation" ? UserX 
                : fraud.type === "urgency" ? Clock 
                : AlertTriangle

              return (
                <MessageCard
                  key={fraud.message.id}
                  message={fraud.message}
                  onClick={() => onPostClick?.(fraud.message)}
                  mediaFileMap={mediaFileMap}
                  badge={
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${getFraudSeverityColor(fraud.severity)}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {fraud.severity}
                      </span>
                      <span className="rounded-full bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground">
                        {getFraudTypeDescription(fraud.type)}
                      </span>
                    </div>
                  }
                />
              )
            })}
          </div>
        )}

        {/* Top Contributors (for groups) */}
        {stats.topContributors.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Top Fraudulent Senders
            </h3>
            <div className="space-y-2">
              {stats.topContributors.map((contributor, i) => (
                <div
                  key={contributor.name}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card"
                >
                  <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {contributor.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {contributor.count} alerts · Score: {contributor.totalScore}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/60"
                        style={{
                          width: `${(contributor.totalScore / stats.topContributors[0].totalScore) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
