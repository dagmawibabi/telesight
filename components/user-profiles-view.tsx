"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  X,
  User,
  AlertTriangle,
  Shield,
  Brain,
  BarChart3,
  MessageSquare,
  Clock,
  TrendingUp,
  Download,
  Key,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useHuggingFaceToken } from "@/hooks/use-hf-token"
import { HFTokenDialog } from "./hf-token-dialog"

interface UserProfilesViewProps {
  messages: TelegramMessage[]
  onClose: () => void
}

interface UserProfile {
  user: string
  totalMessages: number
  avgMessageLength: number
  mostActiveHour: number
  conflictTendency: number
  manipulation: number
  positivity: number
  dominance: number
  emotionalStability: number
  overallRisk: "low" | "medium" | "high"
  summary: string
  topTraits: string[]
  messages: { id: string; text: string; date: string }[]
}

export function UserProfilesView({ messages, onClose }: UserProfilesViewProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const { token, hasToken } = useHuggingFaceToken()

  useEffect(() => {
    if (hasToken && messages.length > 0) {
      analyzeUsers()
    }
  }, [hasToken, messages.length])

  const analyzeUsers = async () => {
    if (!hasToken) {
      setTokenDialogOpen(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
          from: m.from || "Unknown",
          date: m.date,
        }))

      const response = await fetch("/api/user-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messageData, token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed")
      }

      setProfiles(data.profiles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (risk: string) => {
    const colors = {
      low: "text-green-500 bg-green-500/10 border-green-500/20",
      medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
      high: "text-red-500 bg-red-500/10 border-red-500/20",
    }
    return colors[risk as keyof typeof colors] || colors.low
  }

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? "PM" : "AM"
    const h = hour % 12 || 12
    return `${h} ${ampm}`
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      <HFTokenDialog
        isOpen={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSave={() => {}}
        hasExistingToken={hasToken}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <User className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                User Behavior Profiles
              </h1>
              <p className="text-xs text-muted-foreground">
                AI-powered behavioral analysis per user
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={analyzeUsers}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-500 transition-all hover:bg-blue-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5" />
                  {hasToken ? "Analyze Users" : "Add HF Token"}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {!hasToken && !loading && profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <User className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-medium">No Analysis Available</p>
            <p className="text-sm">Add your Hugging Face token to analyze user behavior</p>
            <button
              onClick={() => setTokenDialogOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Key className="h-4 w-4" />
              Add Token
            </button>
          </div>
        )}

        {profiles.length > 0 && (
          <>
            {/* Risk Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-green-500">
                  {profiles.filter(p => p.overallRisk === "low").length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Low Risk</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-yellow-500">
                  {profiles.filter(p => p.overallRisk === "medium").length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Medium Risk</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-red-500">
                  {profiles.filter(p => p.overallRisk === "high").length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">High Risk</div>
              </div>
            </div>

            {/* User Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {profiles.map((profile) => (
                <div
                  key={profile.user}
                  onClick={() => setSelectedUser(profile)}
                  className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{profile.user}</h3>
                        <p className="text-xs text-muted-foreground">
                          {profile.totalMessages} messages · Avg {profile.avgMessageLength} chars
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getRiskColor(profile.overallRisk)}`}>
                      {profile.overallRisk}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {profile.summary}
                  </p>

                  {/* Trait Scores */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground">Conflict</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${profile.conflictTendency * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono">
                        {(profile.conflictTendency * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground">Manipulation</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${profile.manipulation * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono">
                        {(profile.manipulation * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground">Positivity</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${profile.positivity * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono">
                        {(profile.positivity * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Top Traits */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {profile.topTraits.slice(0, 3).map((trait) => (
                      <span
                        key={trait}
                        className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground capitalize"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* User Detail Modal */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedUser(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{selectedUser.user}</h2>
                    <p className="text-sm text-muted-foreground">
                      Most active at {formatHour(selectedUser.mostActiveHour)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Detailed Scores */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Conflict Tendency</span>
                  </div>
                  <div className="text-2xl font-bold">{(selectedUser.conflictTendency * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Manipulation</span>
                  </div>
                  <div className="text-2xl font-bold">{(selectedUser.manipulation * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Positivity</span>
                  </div>
                  <div className="text-2xl font-bold">{(selectedUser.positivity * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Dominance</span>
                  </div>
                  <div className="text-2xl font-bold">{(selectedUser.dominance * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border bg-card p-4 mb-6">
                <h4 className="font-medium mb-2">Behavioral Summary</h4>
                <p className="text-sm text-muted-foreground">{selectedUser.summary}</p>
              </div>

              {/* Recent Messages */}
              <div>
                <h4 className="font-medium mb-3">Recent Messages</h4>
                <div className="space-y-2">
                  {selectedUser.messages.slice(-5).map((msg) => (
                    <div key={msg.id} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-sm text-foreground line-clamp-2">{msg.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(msg.date), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
