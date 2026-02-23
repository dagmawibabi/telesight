"use client"

import { useMemo, useState, useEffect } from "react"
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
  Key,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import type { MediaFileMap } from "@/hooks/use-media-url"
import { useMediaUrl } from "@/hooks/use-media-url"
import { useHuggingFaceToken } from "@/hooks/use-hf-token"
import { HFTokenDialog } from "./hf-token-dialog"

interface FraudViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
  mediaFileMap?: MediaFileMap | null
}

type FraudType = "phishing" | "money_request" | "impersonation" | "urgency" | "suspicious_link" | "none"

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
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [hfAnalysis, setHfAnalysis] = useState<{
    loading: boolean
    results: { 
      id: string
      text: string
      from: string
      fraudType: string
      score: number
      severity: string
      reason: string
    }[] | null
    stats: {
      total: number
      fraudDetected: number
      phishing: number
      moneyScams: number
      impersonation: number
      bySeverity: { critical: number; moderate: number; mild: number; safe: number }
    } | null
    error: string | null
  }>({ loading: false, results: null, stats: null, error: null })

  const { token, hasToken } = useHuggingFaceToken()

  // Run HF fraud analysis
  const runHFFraudAnalysis = async () => {
    if (!hasToken) {
      setTokenDialogOpen(true)
      return
    }

    setHfAnalysis({ loading: true, results: null, stats: null, error: null })

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .slice(-100)
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
          from: m.from || "Unknown",
        }))

      const response = await fetch("/api/fraud/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messageData, token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed")
      }

      setHfAnalysis({
        loading: false,
        results: data.results,
        stats: data.stats,
        error: null,
      })
    } catch (err) {
      setHfAnalysis({
        loading: false,
        results: null,
        stats: null,
        error: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  }

  // Auto-run on mount if token exists
  useEffect(() => {
    if (hasToken) {
      runHFFraudAnalysis()
    }
  }, [hasToken])

  // Filter results
  const filteredResults = useMemo(() => {
    if (!hfAnalysis.results) return []
    return hfAnalysis.results.filter(r => {
      const severityMatch = 
        minSeverity === "low" ? true :
        minSeverity === "medium" ? ["medium", "high", "critical"].includes(r.severity) :
        minSeverity === "high" ? ["high", "critical"].includes(r.severity) :
        r.severity === "critical"
      const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(r.fraudType as FraudType)
      return severityMatch && typeMatch && r.score > 0.4
    })
  }, [hfAnalysis.results, minSeverity, selectedTypes])

  const fraudTypes: FraudType[] = ["phishing", "money_request", "impersonation", "urgency", "suspicious_link"]

  const toggleType = (type: FraudType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const getFraudTypeDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      phishing: "Phishing Attempt",
      money_request: "Money Scam",
      impersonation: "Impersonation",
      urgency: "Urgency Tactics",
      suspicious_link: "Suspicious Link",
      none: "No Fraud",
    }
    return descriptions[type] || type
  }

  const getFraudSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      critical: "text-red-600 bg-red-500/10 border-red-500/20",
      high: "text-orange-600 bg-orange-500/10 border-orange-500/20",
      moderate: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
      mild: "text-blue-600 bg-blue-500/10 border-blue-500/20",
      safe: "text-green-600 bg-green-500/10 border-green-500/20",
    }
    return colors[severity] || colors.safe
  }

  const stats = hfAnalysis.stats || {
    total: 0,
    fraudDetected: 0,
    phishing: 0,
    moneyScams: 0,
    impersonation: 0,
    bySeverity: { critical: 0, moderate: 0, mild: 0, safe: 0 },
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
          <div className="flex items-center gap-2">
            <button
              onClick={runHFFraudAnalysis}
              disabled={hfAnalysis.loading}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/20 disabled:opacity-50"
            >
              {hfAnalysis.loading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
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
            value={stats.phishing}
            sub="Fake login / malicious links"
            color="text-blue-500"
          />
          <StatCard
            icon={DollarSign}
            label="Money Scams"
            value={stats.moneyScams}
            sub="Urgent money requests"
            color="text-green-500"
          />
          <StatCard
            icon={UserX}
            label="Impersonation"
            value={stats.impersonation}
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
        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Shield className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-medium">
              {hfAnalysis.loading ? "Analyzing with Hugging Face AI..." : "No fraud patterns detected"}
            </p>
            <p className="text-sm">
              {hfAnalysis.loading ? "Please wait..." : hfAnalysis.results ? "Your conversation appears safe" : "Click 'HF Analysis' to analyze"}
            </p>
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
            {filteredResults.map((fraud) => {
              const Icon = fraud.fraudType === "phishing" ? Link 
                : fraud.fraudType === "money_request" ? DollarSign 
                : fraud.fraudType === "impersonation" ? UserX 
                : fraud.fraudType === "urgency" ? Clock 
                : AlertTriangle

              return (
                <div
                  key={fraud.id}
                  className="rounded-xl border border-border bg-card p-4 transition-all hover:border-red-500/30 hover:shadow-sm cursor-pointer"
                  onClick={() => {
                    const msg = messages.find(m => m.id.toString() === fraud.id)
                    if (msg) onPostClick?.(msg)
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${getFraudSeverityColor(fraud.severity)}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {fraud.severity}
                      </span>
                      <span className="rounded-full bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground">
                        {getFraudTypeDescription(fraud.fraudType)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {(fraud.score * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">From: {fraud.from}</p>
                  <p className="text-sm text-foreground/80 line-clamp-3">{fraud.text}</p>
                  {fraud.reason && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{fraud.reason}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Top Contributors (for groups) */}
        {stats.fraudDetected > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Top Fraudulent Senders
            </h3>
            <div className="space-y-2">
              {filteredResults.slice(0, 5).map((fraud, i) => (
                <div
                  key={fraud.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card"
                >
                  <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {fraud.from}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {(fraud.score * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/60"
                        style={{
                          width: `${fraud.score * 100}%`,
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

      {/* Token Dialog */}
      <HFTokenDialog
        isOpen={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSave={() => {}}
        hasExistingToken={hasToken}
      />
    </div>
  )
}
