"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { format } from "date-fns"
import {
  X,
  MessageSquare,
  Heart,
  Image,
  Reply,
  Clock,
  Users,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import {
  computeMemberStats,
  computeInteractionMap,
  type MemberStat,
  type InteractionEdge,
} from "@/lib/group-analytics"

// Stable color palette for member nodes
const NODE_COLORS = [
  "#22d3ee", "#a78bfa", "#fb923c", "#34d399",
  "#f472b6", "#60a5fa", "#fbbf24", "#e879f9",
  "#2dd4bf", "#f87171", "#a3e635", "#818cf8",
]

function hashNodeColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return NODE_COLORS[Math.abs(hash) % NODE_COLORS.length]
}

interface MemberAnalyticsViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (msg: TelegramMessage) => void
}

// ─── Activity Sparkline ─────────────────────────────────────────────────────

function ActivitySparkline({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1)
  return (
    <div className="flex items-end gap-px h-8 w-full">
      {hours.map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-primary/40 transition-all hover:bg-primary/70"
          style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 2 : 0 }}
          title={`${i}:00 - ${count} messages`}
        />
      ))}
    </div>
  )
}

// ─── Interaction Graph ──────────────────────────────────────────────────────

function InteractionGraph({
  edges,
  members,
}: {
  edges: InteractionEdge[]
  members: MemberStat[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Layout nodes in a circle
  const nodePositions = useMemo(() => {
    const uniqueMembers = members.filter((m) => m.messageCount > 0)
    const positions = new Map<string, { x: number; y: number; name: string; color: string; messages: number }>()
    const cx = 300
    const cy = 250
    const radius = Math.min(200, 80 + uniqueMembers.length * 15)

    uniqueMembers.forEach((member, i) => {
      const angle = (2 * Math.PI * i) / uniqueMembers.length - Math.PI / 2
      positions.set(member.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        name: member.name,
        color: hashNodeColor(member.name),
        messages: member.messageCount,
      })
    })
    return positions
  }, [members])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 600 * dpr
    canvas.height = 500 * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, 600, 500)

    // Draw edges
    const maxStrength = Math.max(...edges.map((e) => e.replyCount + e.reactionCount), 1)
    for (const edge of edges) {
      const from = nodePositions.get(edge.fromId)
      const to = nodePositions.get(edge.toId)
      if (!from || !to) continue

      const strength = edge.replyCount + edge.reactionCount
      const opacity = 0.15 + 0.6 * (strength / maxStrength)
      const width = 0.5 + 3 * (strength / maxStrength)

      const isHovered = hoveredNode === edge.fromId || hoveredNode === edge.toId
      ctx.strokeStyle = isHovered
        ? `rgba(99, 170, 255, ${Math.min(opacity + 0.3, 1)})`
        : `rgba(120, 120, 140, ${opacity})`
      ctx.lineWidth = isHovered ? width + 1 : width
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }

    // Draw nodes
    const maxMessages = Math.max(...Array.from(nodePositions.values()).map((n) => n.messages), 1)
    for (const [id, node] of nodePositions) {
      const radius = 8 + 16 * (node.messages / maxMessages)
      const isHovered = hoveredNode === id

      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + (isHovered ? 3 : 0), 0, 2 * Math.PI)
      ctx.fillStyle = isHovered ? node.color : node.color + "cc"
      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = node.color
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Labels
      ctx.font = `${isHovered ? "bold " : ""}11px system-ui, sans-serif`
      ctx.fillStyle = isHovered ? "#fff" : "#aaa"
      ctx.textAlign = "center"
      ctx.fillText(node.name.split(" ")[0], node.x, node.y + radius + 14)
    }
  }, [nodePositions, edges, hoveredNode])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = 600 / rect.width
      const scaleY = 500 / rect.height
      const mx = (e.clientX - rect.left) * scaleX
      const my = (e.clientY - rect.top) * scaleY

      let closest: string | null = null
      let closestDist = 30
      for (const [id, node] of nodePositions) {
        const d = Math.sqrt((mx - node.x) ** 2 + (my - node.y) ** 2)
        if (d < closestDist) {
          closestDist = d
          closest = id
        }
      }
      setHoveredNode(closest)
    },
    [nodePositions]
  )

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={500}
        className="w-full rounded-lg bg-secondary/20 border border-border/50"
        style={{ aspectRatio: "6/5" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
      />
      {hoveredNode && nodePositions.get(hoveredNode) && (
        <div className="absolute top-3 right-3 rounded-lg bg-card/95 border border-border px-3 py-2 text-xs backdrop-blur-sm">
          <p className="font-semibold text-foreground">{nodePositions.get(hoveredNode)!.name}</p>
          <p className="text-muted-foreground">{nodePositions.get(hoveredNode)!.messages} messages</p>
        </div>
      )}
    </div>
  )
}

// ─── Member Card ────────────────────────────────────────────────────────────

function MemberCard({
  member,
  rank,
  expanded,
  onToggle,
}: {
  member: MemberStat
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const color = hashNodeColor(member.name)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-xs font-mono text-muted-foreground/50 w-6 text-right shrink-0">
          {rank}
        </span>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-background"
          style={{ backgroundColor: color }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />{member.messageCount}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />{member.reactionsReceived}
            </span>
            <span className="flex items-center gap-1">
              <Image className="h-3 w-3" />{member.mediaCount}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 flex flex-col gap-3">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/40 p-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                <Reply className="h-3 w-3" />Replies
              </div>
              <span className="text-sm font-semibold text-foreground font-mono">{member.repliesCount}</span>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                <Zap className="h-3 w-3" />Reactions Sent
              </div>
              <span className="text-sm font-semibold text-foreground font-mono">{member.reactionsSent}</span>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />Avg Length
              </div>
              <span className="text-sm font-semibold text-foreground font-mono">{member.avgMessageLength} chars</span>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />Active Since
              </div>
              <span className="text-xs font-medium text-foreground">
                {member.firstMessage.getFullYear() > 2990
                  ? "N/A"
                  : format(member.firstMessage, "MMM d, yyyy")}
              </span>
            </div>
          </div>

          {/* Top emojis used */}
          {member.topEmojisUsed.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Favorite Reactions</p>
              <div className="flex items-center gap-1.5">
                {member.topEmojisUsed.map((e) => (
                  <span key={e.emoji} className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-xs">
                    <span>{e.emoji}</span>
                    <span className="font-mono text-muted-foreground">{e.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity by hour */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Activity by Hour</p>
            <ActivitySparkline hours={member.topHours} />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-muted-foreground/40 font-mono">0:00</span>
              <span className="text-[9px] text-muted-foreground/40 font-mono">12:00</span>
              <span className="text-[9px] text-muted-foreground/40 font-mono">23:00</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main View ──────────────────────────────────────────────────────────────

export function MemberAnalyticsView({ messages, onClose }: MemberAnalyticsViewProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [tab, setTab] = useState<"leaderboard" | "graph">("leaderboard")

  const memberStats = useMemo(() => computeMemberStats(messages), [messages])
  const interactionEdges = useMemo(() => computeInteractionMap(messages), [messages])

  // Stats summary
  const totalMembers = memberStats.length
  const mostActive = memberStats[0]
  const mostReacted = [...memberStats].sort((a, b) => b.reactionsReceived - a.reactionsReceived)[0]

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Member Analytics</h2>
              <p className="text-xs text-muted-foreground">{totalMembers} members analyzed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-secondary transition-colors"
            aria-label="Close member analytics"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Quick highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Most Active</p>
            {mostActive && (
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-background"
                  style={{ backgroundColor: hashNodeColor(mostActive.name) }}
                >
                  {mostActive.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{mostActive.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{mostActive.messageCount} messages</p>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Most Reacted To</p>
            {mostReacted && (
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-background"
                  style={{ backgroundColor: hashNodeColor(mostReacted.name) }}
                >
                  {mostReacted.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{mostReacted.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{mostReacted.reactionsReceived} reactions</p>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Strongest Connection</p>
            {interactionEdges[0] && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background border-2 border-card"
                    style={{ backgroundColor: hashNodeColor(interactionEdges[0].from) }}
                  >
                    {interactionEdges[0].from.charAt(0)}
                  </div>
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background border-2 border-card"
                    style={{ backgroundColor: hashNodeColor(interactionEdges[0].to) }}
                  >
                    {interactionEdges[0].to.charAt(0)}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {interactionEdges[0].from.split(" ")[0]} &harr; {interactionEdges[0].to.split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {interactionEdges[0].replyCount} replies, {interactionEdges[0].reactionCount} reactions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1 w-fit mb-4">
          <button
            onClick={() => setTab("leaderboard")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "leaderboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setTab("graph")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Interaction Graph
          </button>
        </div>

        {tab === "leaderboard" ? (
          <div className="flex flex-col gap-2">
            {memberStats.map((member, i) => (
              <MemberCard
                key={member.id}
                member={member}
                rank={i + 1}
                expanded={expandedMember === member.id}
                onToggle={() =>
                  setExpandedMember(expandedMember === member.id ? null : member.id)
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <InteractionGraph edges={interactionEdges} members={memberStats} />
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
                Top Interactions
              </h3>
              <div className="flex flex-col gap-2">
                {interactionEdges.slice(0, 10).map((edge, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <span className="text-[10px] font-mono text-muted-foreground/50 w-4 text-right">{i + 1}</span>
                    <div className="flex -space-x-1.5">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background border-2 border-card"
                        style={{ backgroundColor: hashNodeColor(edge.from) }}
                      >
                        {edge.from.charAt(0)}
                      </div>
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background border-2 border-card"
                        style={{ backgroundColor: hashNodeColor(edge.to) }}
                      >
                        {edge.to.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground">
                        {edge.from.split(" ")[0]} &harr; {edge.to.split(" ")[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Reply className="h-3 w-3" />{edge.replyCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />{edge.reactionCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
