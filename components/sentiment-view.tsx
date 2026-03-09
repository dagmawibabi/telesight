"use client"

import { useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import {
  X,
  Brain,
  Flame,
  Shield,
  MessageSquare,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Filter,
  AlertTriangle,
  Key,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import type { MediaFileMap } from "@/hooks/use-media-url"
import { useMediaUrl } from "@/hooks/use-media-url"
import { findConflicts, getConflictStats } from "@/lib/conflict-detector"
import { findManipulation, getManipulationStats, getManipulationTypeDescription, getSeverityColor, type ManipulationType } from "@/lib/manipulation-detector"
import { useHuggingFaceToken } from "@/hooks/use-hf-token"
import { HFTokenDialog } from "./hf-token-dialog"

interface SentimentViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
  mediaFileMap?: MediaFileMap | null
}

type TabType = "conflicts" | "manipulation" | "overview" | "hf_analysis"

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

export function SentimentView({
  messages,
  onClose,
  onPostClick,
  mediaFileMap,
}: SentimentViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [minSeverity, setMinSeverity] = useState<"mild" | "moderate" | "severe">("mild")
  const [selectedTypes, setSelectedTypes] = useState<ManipulationType[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [hfAnalysis, setHfAnalysis] = useState<{
    loading: boolean
    results: { id: string; text: string; sentiment: string; score: number }[] | null
    error: string | null
  }>({ loading: false, results: null, error: null })

  const { token, hasToken } = useHuggingFaceToken()

  // Auto-run HF analysis when token exists
  useEffect(() => {
    if (hasToken && messages.length > 0) {
      runHFConflictAnalysis()
      runHFManipulationAnalysis()
    }
  }, [hasToken, messages.length])

  // Run Hugging Face conflict analysis
  const runHFConflictAnalysis = async () => {
    if (!hasToken) return

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .slice(-100)
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
          from: m.from || "Unknown",
          date: m.date,
        }))

      const response = await fetch("/api/conflict/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messageData, token }),
      })

      const data = await response.json()
      if (response.ok) {
        // Store conflict results in state (could add dedicated state for this)
        console.log("HF Conflict analysis:", data)
      }
    } catch (err) {
      console.error("Conflict analysis failed:", err)
    }
  }

  // Run Hugging Face manipulation analysis
  const runHFManipulationAnalysis = async () => {
    if (!hasToken) return

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .slice(-100)
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
          from: m.from || "Unknown",
          date: m.date,
        }))

      const response = await fetch("/api/manipulation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messageData, token }),
      })

      const data = await response.json()
      if (response.ok) {
        // Store manipulation results in state
        console.log("HF Manipulation analysis:", data)
      }
    } catch (err) {
      console.error("Manipulation analysis failed:", err)
    }
  }

  // Get data from both detectors
  const conflictStats = useMemo(() => getConflictStats(messages), [messages])
  const manipulationStats = useMemo(() => getManipulationStats(messages), [messages])
  
  const conflicts = useMemo(() => findConflicts(messages, { maxResults: 50 }), [messages])
  const manipulations = useMemo(() => findManipulation(messages, { 
    minSeverity,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    maxResults: 50 
  }), [messages, minSeverity, selectedTypes])

  const manipulationTypes: ManipulationType[] = [
    "gaslighting", "guilt_tripping", "passive_aggressive", 
    "controlling", "dismissive", "victimhood"
  ]

  const toggleType = (type: ManipulationType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const totalIssues = conflicts.length + manipulations.length

  // Run Hugging Face sentiment analysis
  const runHFAnalysis = async () => {
    if (!hasToken) {
      setTokenDialogOpen(true)
      return
    }

    setHfAnalysis({ loading: true, results: null, error: null })

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .slice(-100) // Last 100 messages
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
        }))

      const response = await fetch("/api/sentiment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messageData,
          token,
          type: "sentiment",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed")
      }

      setHfAnalysis({ loading: false, results: data.results, error: null })
    } catch (err) {
      setHfAnalysis({
        loading: false,
        results: null,
        error: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Token Dialog */}
      <HFTokenDialog
        isOpen={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSave={(token) => {}}
        hasExistingToken={hasToken}
      />
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/20 to-purple-500/20">
              <Brain className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Sentiment Analysis
              </h1>
              <p className="text-xs text-muted-foreground">
                Conflicts, manipulation patterns & emotional tone
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runHFAnalysis}
              disabled={hfAnalysis.loading}
              className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-500 transition-all hover:bg-purple-500/20 disabled:opacity-50"
            >
              {hfAnalysis.loading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5" />
                  {hasToken ? "HF Analysis" : "Add HF Token"}
                </>
              )}
            </button>
            <button
              onClick={() => setTokenDialogOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Manage token"
            >
              <Key className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("conflicts")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "conflicts"
                  ? "bg-red-500/20 text-red-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flame className="h-3 w-3" />
              Conflicts ({conflicts.length})
            </button>
            <button
              onClick={() => setActiveTab("manipulation")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "manipulation"
                  ? "bg-purple-500/20 text-purple-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="h-3 w-3" />
              Behavior ({manipulations.length})
            </button>
            {hfAnalysis.results && (
              <button
                onClick={() => setActiveTab("hf_analysis")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === "hf_analysis"
                    ? "bg-green-500/20 text-green-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Brain className="h-3 w-3" />
                HF ({hfAnalysis.results.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
              <StatCard
                icon={AlertTriangle}
                label="Total Issues"
                value={totalIssues}
                sub={`${conflicts.length} conflicts + ${manipulations.length} behavior`}
                color="text-orange-500"
              />
              <StatCard
                icon={Flame}
                label="Conflicts"
                value={conflicts.length}
                sub={`${conflictStats.byIntensity.high} high severity`}
                color="text-red-500"
              />
              <StatCard
                icon={Shield}
                label="Manipulation"
                value={manipulations.length}
                sub={`${manipulationStats.bySeverity.severe} severe`}
                color="text-purple-500"
              />
              <StatCard
                icon={BarChart3}
                label="Rate"
                value={`${((totalIssues / Math.max(messages.filter(m => m.type === "message").length, 1)) * 100).toFixed(1)}%`}
                sub="of all messages"
                color="text-blue-500"
              />
            </div>

            {/* Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Conflict Breakdown */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  Conflict Intensity
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "High", count: conflictStats.byIntensity.high, color: "bg-red-500" },
                    { label: "Medium", count: conflictStats.byIntensity.medium, color: "bg-orange-500" },
                    { label: "Low", count: conflictStats.byIntensity.low, color: "bg-yellow-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${item.color}`}
                            style={{ 
                              width: `${conflicts.length > 0 ? (item.count / conflicts.length) * 100 : 0}%` 
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-6 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manipulation Breakdown */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  Behavior Types
                </h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {manipulationTypes.map(type => {
                    const count = manipulationStats.byType[type]
                    if (count === 0) return null
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{getManipulationTypeDescription(type)}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  })}
                  {manipulations.length === 0 && (
                    <p className="text-xs text-muted-foreground">No manipulation patterns detected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Contributors (for groups) */}
            {(conflictStats.topContributors.length > 1 || manipulationStats.topContributors.length > 1) && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Most Active in Negative Interactions
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {conflictStats.topContributors.slice(0, 3).map((contributor, i) => (
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
                            {contributor.count} msgs · {contributor.score.toFixed(1)} pts
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-500/60"
                            style={{
                              width: `${(contributor.score / conflictStats.topContributors[0].score) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Conflicts Tab */}
        {activeTab === "conflicts" && (
          <>
            {conflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <Flame className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No conflicts detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <MessageCard
                    key={conflict.message.id}
                    message={conflict.message}
                    onClick={() => onPostClick?.(conflict.message)}
                    mediaFileMap={mediaFileMap}
                    badge={
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        conflict.intensity === "high" 
                          ? "text-red-600 bg-red-500/10 border-red-500/20" 
                          : conflict.intensity === "medium"
                          ? "text-orange-600 bg-orange-500/10 border-orange-500/20"
                          : "text-yellow-600 bg-yellow-500/10 border-yellow-500/20"
                      }`}>
                        <Flame className="h-3 w-3" />
                        {conflict.intensity}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Manipulation Tab */}
        {activeTab === "manipulation" && (
          <>
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
                <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
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

                  <div>
                    <span className="text-xs text-muted-foreground mb-2 block">Types:</span>
                    <div className="flex flex-wrap gap-1">
                      {manipulationTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleType(type)}
                          className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                            selectedTypes.includes(type)
                              ? "bg-purple-500/20 text-purple-600"
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

            {manipulations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <Shield className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No manipulation patterns detected</p>
                <button
                  onClick={() => { setMinSeverity("mild"); setSelectedTypes([]); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {manipulations.map((m) => (
                  <MessageCard
                    key={m.message.id}
                    message={m.message}
                    onClick={() => onPostClick?.(m.message)}
                    mediaFileMap={mediaFileMap}
                    badge={
                      <>
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSeverityColor(m.severity)}`}>
                          <Shield className="h-3 w-3" />
                          {m.severity}
                        </span>
                        {m.types.slice(0, 2).map(type => (
                          <span key={type} className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {getManipulationTypeDescription(type)}
                          </span>
                        ))}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* HF Analysis Tab */}
        {activeTab === "hf_analysis" && hfAnalysis.results && (
          <>
            {/* HF Stats Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
              <StatCard
                icon={BarChart3}
                label="HF Analyzed"
                value={hfAnalysis.results.length}
                sub="messages processed"
                color="text-green-500"
              />
              <StatCard
                icon={Brain}
                label="Positive"
                value={hfAnalysis.results.filter(r => r.sentiment === "positive" || r.score > 0.6).length}
                sub="high confidence"
                color="text-blue-500"
              />
              <StatCard
                icon={Flame}
                label="Negative"
                value={hfAnalysis.results.filter(r => r.sentiment === "negative" || r.score < 0.4).length}
                sub="low scores"
                color="text-red-500"
              />
              <StatCard
                icon={Shield}
                label="Neutral"
                value={hfAnalysis.results.filter(r => r.sentiment === "neutral" || (r.score >= 0.4 && r.score <= 0.6)).length}
                sub="middle range"
                color="text-yellow-500"
              />
            </div>

            {/* HF Results List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <Brain className="h-3.5 w-3.5" />
                Hugging Face AI Analysis Results
              </h3>
              {hfAnalysis.results.slice(0, 20).map((result) => (
                <div
                  key={result.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-card"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    result.sentiment === "positive" || result.score > 0.6
                      ? "bg-blue-500/10 text-blue-500"
                      : result.sentiment === "negative" || result.score < 0.4
                      ? "bg-red-500/10 text-red-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}>
                    {result.sentiment === "positive" || result.score > 0.6 ? (
                      <Brain className="h-4 w-4" />
                    ) : result.sentiment === "negative" || result.score < 0.4 ? (
                      <Flame className="h-4 w-4" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium capitalize ${
                        result.sentiment === "positive" || result.score > 0.6
                          ? "text-blue-500"
                          : result.sentiment === "negative" || result.score < 0.4
                          ? "text-red-500"
                          : "text-yellow-500"
                      }`}>
                        {result.sentiment} ({(result.score * 100).toFixed(0)}%)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ID: {result.id}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate">
                      {result.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
