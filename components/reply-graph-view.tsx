"use client"

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react"
import { X, GitBranch, Share2, ArrowUpDown, Maximize2, Minimize2 } from "lucide-react"
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force"
import type { TelegramMessage } from "@/lib/telegram-types"
import { buildReplyGraph, buildForwardGraph, type GraphNode, type GraphEdge, type ReplyGraphData, type ForwardGraphData } from "@/lib/reply-graph"
import { format } from "date-fns"

interface ReplyGraphViewProps {
  messages: TelegramMessage[]
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
}

// Color palette for chains
const CHAIN_COLORS = [
  "#4dd0e1", // teal (primary-like)
  "#f06292", // pink
  "#ffb74d", // orange
  "#81c784", // green
  "#ba68c8", // purple
  "#4fc3f7", // light blue
  "#fff176", // yellow
  "#e57373", // red
  "#a1887f", // brown
  "#90a4ae", // blue-grey
]

function getChainColor(chainId: number): string {
  return CHAIN_COLORS[(chainId - 1) % CHAIN_COLORS.length]
}

export type GraphMode = "replies" | "forwards"

export function ReplyGraphView({ messages, onClose, onPostClick }: ReplyGraphViewProps) {
  const [mode, setMode] = useState<GraphMode>("replies")
  const [includeCrossChannel, setIncludeCrossChannel] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedChain, setSelectedChain] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null)
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingRef = useRef<GraphNode | null>(null)
  const panningRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])

  const graphData = useMemo(
    () => mode === "replies"
      ? buildReplyGraph(messages, includeCrossChannel)
      : buildForwardGraph(messages),
    [messages, includeCrossChannel, mode]
  )

  // Reset selection when mode changes
  useEffect(() => {
    setSelectedNode(null)
    setSelectedChain(null)
    setHoveredNode(null)
  }, [mode])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedNode) {
          setSelectedNode(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, selectedNode])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Setup simulation
  useEffect(() => {
    if (graphData.nodes.length === 0) return

    const nodes = graphData.nodes.map((n) => ({ ...n }))
    const edges = graphData.edges.map((e) => ({ ...e }))
    nodesRef.current = nodes
    edgesRef.current = edges

    const nodeMap = new Map<number, GraphNode>()
    for (const n of nodes) nodeMap.set(n.id, n)

    // Resolve source/target refs for d3
    const links = edges.map((e) => ({
      source: nodeMap.get(e.source) as SimulationNodeDatum,
      target: nodeMap.get(e.target) as SimulationNodeDatum,
    })) as SimulationLinkDatum<GraphNode>[]

    const sim = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(links)
          .id((d) => d.id)
          .distance(60)
          .strength(0.8)
      )
      .force("charge", forceManyBody<GraphNode>().strength(-120).distanceMax(400))
      .force("center", forceCenter(0, 0).strength(0.05))
      .force("collision", forceCollide<GraphNode>().radius((d) => d.radius + 4))
      .force("x", forceX<GraphNode>(0).strength(0.02))
      .force("y", forceY<GraphNode>(0).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.4)

    simRef.current = sim

    // Store resolved edges
    for (let i = 0; i < edges.length; i++) {
      edges[i].sourceNode = (links[i].source as unknown) as GraphNode
      edges[i].targetNode = (links[i].target as unknown) as GraphNode
    }

    return () => {
      sim.stop()
    }
  }, [graphData])

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function render() {
      const cvs = canvasRef.current
      if (!cvs) return
      const c = cvs.getContext("2d")
      if (!c) return

      const dpr = window.devicePixelRatio || 1
      const rect = cvs.getBoundingClientRect()
      cvs.width = rect.width * dpr
      cvs.height = rect.height * dpr
      c.scale(dpr, dpr)

      const w = rect.width
      const h = rect.height
      const t = transformRef.current

      c.clearRect(0, 0, w, h)
      c.save()
      c.translate(w / 2 + t.x, h / 2 + t.y)
      c.scale(t.k, t.k)

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const hovered = hoveredNode
      const selected = selectedNode
      const filterChain = selectedChain

      // Draw edges
      for (const edge of edges) {
        const src = edge.sourceNode || (edge.source as unknown as GraphNode)
        const tgt = edge.targetNode || (edge.target as unknown as GraphNode)
        if (!src?.x || !tgt?.x) continue

        const isHighlighted =
          filterChain != null
            ? src.chainId === filterChain
            : hovered
              ? src.id === hovered.id || tgt.id === hovered.id
              : true

        const alpha = filterChain != null
          ? (src.chainId === filterChain ? 0.7 : 0.04)
          : hovered
            ? (isHighlighted ? 0.7 : 0.08)
            : 0.25

        c.beginPath()
        c.moveTo(src.x, src.y)
        c.lineTo(tgt.x, tgt.y)
        c.strokeStyle = getChainColor(src.chainId)
        c.globalAlpha = alpha
        c.lineWidth = isHighlighted ? 2 : 1
        c.stroke()
        c.globalAlpha = 1

        // Arrow head
        if (isHighlighted && alpha > 0.3) {
          const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x)
          const arrowLen = 8
          const ax = tgt.x - Math.cos(angle) * (tgt.radius + 4)
          const ay = tgt.y - Math.sin(angle) * (tgt.radius + 4)
          c.beginPath()
          c.moveTo(ax, ay)
          c.lineTo(
            ax - arrowLen * Math.cos(angle - Math.PI / 7),
            ay - arrowLen * Math.sin(angle - Math.PI / 7)
          )
          c.lineTo(
            ax - arrowLen * Math.cos(angle + Math.PI / 7),
            ay - arrowLen * Math.sin(angle + Math.PI / 7)
          )
          c.closePath()
          c.fillStyle = getChainColor(src.chainId)
          c.globalAlpha = alpha
          c.fill()
          c.globalAlpha = 1
        }
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue

        const isActive =
          filterChain != null
            ? node.chainId === filterChain
            : hovered
              ? node.chainId === hovered.chainId
              : true

        const dimmed = filterChain != null
          ? node.chainId !== filterChain
          : hovered
            ? !isActive
            : false

        const color = getChainColor(node.chainId)

        // Glow for hovered/selected
        if (node === hovered || node === selected) {
          c.beginPath()
          c.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
          c.fillStyle = color
          c.globalAlpha = 0.2
          c.fill()
          c.globalAlpha = 1
        }

        // Node circle
        c.beginPath()
        c.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        c.fillStyle = node.isForwardedReply ? "rgba(120,120,120,0.5)" : color
        c.globalAlpha = dimmed ? 0.1 : 0.85
        c.fill()
        c.globalAlpha = 1

        // Border
        c.strokeStyle = dimmed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.3)"
        c.lineWidth = node === hovered || node === selected ? 2 : 1
        c.stroke()

        // ID label for larger nodes
        if (node.radius > 10 && !dimmed && t.k > 0.5) {
          c.fillStyle = "rgba(255,255,255,0.9)"
          c.font = `${Math.max(8, node.radius * 0.7)}px Inter, sans-serif`
          c.textAlign = "center"
          c.textBaseline = "middle"
          c.fillText(`${node.id}`, node.x, node.y)
        }
      }

      c.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [graphData, hoveredNode, selectedNode, selectedChain])

  // Mouse interactions
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const t = transformRef.current
    const cx = rect.width / 2
    const cy = rect.height / 2
    return {
      x: (sx - rect.left - cx - t.x) / t.k,
      y: (sy - rect.top - cy - t.y) / t.k,
    }
  }, [])

  const findNode = useCallback((wx: number, wy: number): GraphNode | null => {
    const nodes = nodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (n.x == null || n.y == null) continue
      const dx = wx - n.x
      const dy = wy - n.y
      if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) {
        return n
      }
    }
    return null
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    const node = findNode(x, y)
    if (node) {
      draggingRef.current = node
      node.fx = node.x
      node.fy = node.y
      simRef.current?.alphaTarget(0.3).restart()
    } else {
      panningRef.current = true
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [screenToWorld, findNode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingRef.current) {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      draggingRef.current.fx = x
      draggingRef.current.fy = y
    } else if (panningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      transformRef.current.x += dx
      transformRef.current.y += dy
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    } else {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      const node = findNode(x, y)
      setHoveredNode(node)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? "pointer" : "grab"
      }
    }
  }, [screenToWorld, findNode])

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current.fx = null
      draggingRef.current.fy = null
      simRef.current?.alphaTarget(0)
      draggingRef.current = null
    }
    panningRef.current = false
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    const node = findNode(x, y)
    if (node) {
      setSelectedNode(node)
    } else {
      setSelectedNode(null)
      setSelectedChain(null)
    }
  }, [screenToWorld, findNode])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.92 : 1.08
    const newK = Math.max(0.1, Math.min(5, transformRef.current.k * delta))

    // Zoom towards mouse
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left - rect.width / 2
    const my = e.clientY - rect.top - rect.height / 2

    const t = transformRef.current
    t.x = mx - (mx - t.x) * (newK / t.k)
    t.y = my - (my - t.y) * (newK / t.k)
    t.k = newK
  }, [])

  const resetView = useCallback(() => {
    transformRef.current = { x: 0, y: 0, k: 1 }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Share2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Data Graph</h2>
            <p className="text-xs text-muted-foreground">
              {graphData.nodes.length} nodes &middot; {graphData.edges.length} edges &middot; {graphData.chains.length} {mode === "replies" ? "chains" : "sources"}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-0.5 ml-2">
            <button
              onClick={() => setMode("replies")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                mode === "replies"
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              Self-Replies
            </button>
            <button
              onClick={() => setMode("forwards")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                mode === "forwards"
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              Forwards
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle cross-channel (only for replies mode) */}
          {mode === "replies" && (
            <button
              onClick={() => setIncludeCrossChannel((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                includeCrossChannel
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Cross-channel
            </button>
          )}

          <button
            onClick={resetView}
            className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Reset
          </button>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative">
          {graphData.nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Share2 className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {mode === "forwards"
                  ? "No forwarded messages found in this export."
                  : includeCrossChannel
                    ? "No reply relationships found"
                    : "No self-replies found. Try enabling cross-channel replies."}
              </p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
              onWheel={handleWheel}
              style={{ cursor: "grab" }}
            />
          )}

          {/* Hover tooltip */}
          {hoveredNode && !selectedNode && (
            <div className="absolute left-4 bottom-4 max-w-xs rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getChainColor(hoveredNode.chainId) }}
                />
                <span className="text-xs font-mono text-muted-foreground">#{hoveredNode.id}</span>
                {hoveredNode.isForwardedReply && (
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">external</span>
                )}
              </div>
              <p className="text-xs text-foreground line-clamp-2">{hoveredNode.text}</p>
              {hoveredNode.date.getTime() > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {format(hoveredNode.date, "MMM d, yyyy HH:mm")}
                </p>
              )}
              {hoveredNode.reactionCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {hoveredNode.reactionCount.toLocaleString()} reactions
                </p>
              )}
            </div>
          )}
        </div>

        {/* Side panel: chain list + selected node detail */}
        <aside className="w-80 border-l border-border bg-card/50 flex flex-col shrink-0 overflow-hidden">
          {selectedNode ? (
            <SelectedNodePanel
              node={selectedNode}
              graphData={graphData}
              onClose={() => setSelectedNode(null)}
              onViewPost={() => {
                if (!selectedNode.isForwardedReply) {
                  onPostClick?.(selectedNode.message)
                }
              }}
              onMemberPostClick={(node) => {
                if (!node.isForwardedReply) {
                  onPostClick?.(node.message)
                }
              }}
            />
          ) : (
            <ChainListPanel
              graphData={graphData}
              selectedChain={selectedChain}
              mode={mode}
              onChainSelect={(id) => setSelectedChain(selectedChain === id ? null : id)}
              onNodeSelect={setSelectedNode}
              onPostClick={(node) => {
                if (!node.isForwardedReply) {
                  onPostClick?.(node.message)
                }
              }}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

// --- Side panel: selected node detail ---
function SelectedNodePanel({
  node,
  graphData,
  onClose,
  onViewPost,
  onMemberPostClick,
}: {
  node: GraphNode
  graphData: ReplyGraphData
  onClose: () => void
  onViewPost: () => void
  onMemberPostClick: (node: GraphNode) => void
}) {
  // Find the chain this node belongs to
  const chain = graphData.chains.find((c) => c.id === node.chainId)
  const color = getChainColor(node.chainId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-foreground">Message #{node.id}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Content preview */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Content</p>
          <p className="text-sm text-foreground leading-relaxed">
            {node.text || (node.hasMedia ? "[Media content]" : "[Empty message]")}
          </p>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Details</p>
          <div className="grid grid-cols-2 gap-2">
            {node.date.getTime() > 0 && (
              <MetaItem label="Date" value={format(node.date, "MMM d, yyyy")} />
            )}
            {node.date.getTime() > 0 && (
              <MetaItem label="Time" value={format(node.date, "HH:mm:ss")} />
            )}
            <MetaItem label="Reactions" value={node.reactionCount.toLocaleString()} />
            <MetaItem label="Has Media" value={node.hasMedia ? "Yes" : "No"} />
            <MetaItem label="Chain" value={`#${node.chainId} (${chain?.nodes.length || 0} msgs)`} />
            <MetaItem label="Chain Depth" value={`${chain?.depth || 0} levels`} />
            {node.isForwardedReply && (
              <MetaItem label="Type" value="External" />
            )}
            {node.message.from && (
              <MetaItem label="From" value={node.message.from} />
            )}
          </div>
        </div>

        {/* Chain members */}
        {chain && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
              Chain Members ({chain.nodes.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {chain.nodes
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onMemberPostClick(n)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors w-full text-left cursor-pointer ${
                      n.id === node.id
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-mono text-muted-foreground w-10 shrink-0">#{n.id}</span>
                    <span className="text-foreground truncate flex-1">{n.text.slice(0, 50) || "[media]"}</span>
                    {n.reactionCount > 0 && (
                      <span className="text-muted-foreground/60 font-mono shrink-0">{n.reactionCount}</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* View full post button */}
      {!node.isForwardedReply && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onViewPost}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
          >
            View Full Post
          </button>
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground truncate">{value}</p>
    </div>
  )
}

// --- Side panel: chain list ---
function ChainListPanel({
  graphData,
  selectedChain,
  mode,
  onChainSelect,
  onNodeSelect,
  onPostClick,
}: {
  graphData: ReplyGraphData | ForwardGraphData
  selectedChain: number | null
  mode: GraphMode
  onChainSelect: (id: number) => void
  onNodeSelect: (node: GraphNode) => void
  onPostClick: (node: GraphNode) => void
}) {
  const isForwards = mode === "forwards"
  const forwardData = isForwards ? (graphData as ForwardGraphData) : null

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold text-foreground mb-1">
          {isForwards ? "Forward Sources" : "Reply Chains"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {isForwards
            ? `${forwardData?.totalForwarded || 0} forwarded messages from ${forwardData?.sources.length || 0} sources`
            : `${graphData.selfReplyCount} self-replies \u00b7 ${graphData.crossChannelReplyCount} cross-channel`
          }
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-border">
        <div className="rounded-lg bg-secondary/30 px-2.5 py-2 text-center">
          <p className="text-lg font-semibold text-foreground font-mono">{graphData.chains.length}</p>
          <p className="text-[10px] text-muted-foreground">{isForwards ? "Sources" : "Chains"}</p>
        </div>
        <div className="rounded-lg bg-secondary/30 px-2.5 py-2 text-center">
          <p className="text-lg font-semibold text-foreground font-mono">
            {graphData.chains.length > 0 ? graphData.chains[0].nodes.length : 0}
          </p>
          <p className="text-[10px] text-muted-foreground">{isForwards ? "Top Source" : "Longest"}</p>
        </div>
        <div className="rounded-lg bg-secondary/30 px-2.5 py-2 text-center">
          <p className="text-lg font-semibold text-foreground font-mono">
            {isForwards
              ? graphData.nodes.filter(n => !n.isForwardedReply).length
              : graphData.chains.length > 0
                ? Math.max(...graphData.chains.map((c) => c.depth))
                : 0}
          </p>
          <p className="text-[10px] text-muted-foreground">{isForwards ? "Messages" : "Max Depth"}</p>
        </div>
        <div className="rounded-lg bg-secondary/30 px-2.5 py-2 text-center">
          <p className="text-lg font-semibold text-foreground font-mono">
            {graphData.chains.length > 0
              ? isForwards
                ? (graphData.nodes.filter(n => !n.isForwardedReply).length / graphData.chains.length).toFixed(1)
                : (graphData.nodes.length / graphData.chains.length).toFixed(1)
              : 0}
          </p>
          <p className="text-[10px] text-muted-foreground">Avg Size</p>
        </div>
      </div>

      {/* Chain list */}
      <div className="flex-1 overflow-y-auto">
        {graphData.chains.map((chain) => {
          const color = getChainColor(chain.id)
          const isActive = selectedChain === chain.id
          const rootNode = chain.nodes.find((n) => n.id === chain.rootId)
          const totalReactions = chain.nodes.reduce((s, n) => s + n.reactionCount, 0)

          return (
            <button
              key={chain.id}
              onClick={() => onChainSelect(chain.id)}
              className={`w-full flex flex-col gap-1.5 px-4 py-3 text-left border-b border-border/50 transition-colors ${
                isActive ? "bg-primary/5" : "hover:bg-secondary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium text-foreground">
                  {isForwards
                    ? `${chain.nodes.length - 1} fwd`
                    : `${chain.nodes.length} messages`}
                </span>
                {!isForwards && (
                  <span className="text-[10px] text-muted-foreground">
                    depth {chain.depth}
                  </span>
                )}
                {totalReactions > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                    {totalReactions.toLocaleString()} reactions
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 pl-4">
                {isForwards
                  ? rootNode?.text || "[unknown source]"
                  : rootNode?.text || "[root message]"}
              </p>

              {/* Chain nodes preview (only when active) */}
              {isActive && (
                <div className="mt-1 space-y-1 pl-4">
                  {chain.nodes
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .slice(0, 8)
                    .map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-1 w-full rounded-md bg-secondary/30 text-[10px] text-left hover:bg-secondary/50 transition-colors"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPostClick(n)
                          }}
                          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 cursor-pointer"
                        >
                          <span className="font-mono text-muted-foreground shrink-0">#{n.id}</span>
                          <span className="truncate text-foreground/80">{n.text.slice(0, 40) || "[media]"}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onNodeSelect(n)
                          }}
                          className="px-1.5 py-1 text-muted-foreground/50 hover:text-primary shrink-0 cursor-pointer"
                          title="Show in graph"
                        >
                          <Share2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  {chain.nodes.length > 8 && (
                    <p className="text-[10px] text-muted-foreground/60 pl-2">
                      +{chain.nodes.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
