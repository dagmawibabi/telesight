import type { TelegramMessage } from "./telegram-types"
import { getMessageText } from "./telegram-types"

export interface GraphNode {
  id: number
  message: TelegramMessage
  text: string
  date: Date
  reactionCount: number
  hasMedia: boolean
  isForwardedReply: boolean
  // d3-force simulation fields
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  // visual
  radius: number
  chainId: number
}

export interface GraphEdge {
  source: number
  sourceNode?: GraphNode
  targetNode?: GraphNode
  target: number
}

export interface ReplyChain {
  id: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  rootId: number
  depth: number
}

export interface ReplyGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  chains: ReplyChain[]
  selfReplyCount: number
  crossChannelReplyCount: number
}

/**
 * Build a reply graph from messages.
 * selfOnly = true: only show messages replying to another message in the same channel
 * selfOnly = false: also include replies referencing messages not found in this export (cross-channel)
 */
export function buildReplyGraph(
  messages: TelegramMessage[],
  includeCrossChannel: boolean
): ReplyGraphData {
  const messageMap = new Map<number, TelegramMessage>()
  for (const msg of messages) {
    messageMap.set(msg.id, msg)
  }

  // Find all reply relationships
  const replyMessages = messages.filter(
    (m) => m.type === "message" && m.reply_to_message_id != null
  )

  let selfReplyCount = 0
  let crossChannelReplyCount = 0

  const nodeIds = new Set<number>()
  const edges: GraphEdge[] = []

  for (const msg of replyMessages) {
    const targetId = msg.reply_to_message_id!
    const targetExists = messageMap.has(targetId)

    if (targetExists) {
      selfReplyCount++
      nodeIds.add(msg.id)
      nodeIds.add(targetId)
      edges.push({ source: targetId, target: msg.id })
    } else {
      crossChannelReplyCount++
      if (includeCrossChannel) {
        nodeIds.add(msg.id)
        // Create a phantom node for the missing target
        nodeIds.add(targetId)
        edges.push({ source: targetId, target: msg.id })
      }
    }
  }

  // Build nodes
  const nodes: GraphNode[] = []
  for (const id of nodeIds) {
    const msg = messageMap.get(id)
    const text = msg ? getMessageText(msg) : "[External message]"
    const reactionCount = msg?.reactions?.reduce((s, r) => s + r.count, 0) || 0
    const hasMedia = !!(msg?.photo || msg?.file || msg?.media_type)

    nodes.push({
      id,
      message: msg || createPhantomMessage(id),
      text: text.slice(0, 120),
      date: msg ? new Date(msg.date) : new Date(0),
      reactionCount,
      hasMedia,
      isForwardedReply: !messageMap.has(id),
      radius: Math.max(6, Math.min(20, 6 + Math.sqrt(reactionCount) * 1.5)),
      chainId: 0,
    })
  }

  // Build adjacency list to find connected components (chains)
  const adj = new Map<number, number[]>()
  for (const id of nodeIds) {
    adj.set(id, [])
  }
  for (const edge of edges) {
    adj.get(edge.source)!.push(edge.target)
    adj.get(edge.target)!.push(edge.source)
  }

  // BFS to find chains
  const visited = new Set<number>()
  const chains: ReplyChain[] = []
  let chainId = 0

  const nodeMap = new Map<number, GraphNode>()
  for (const node of nodes) {
    nodeMap.set(node.id, node)
  }

  for (const startId of nodeIds) {
    if (visited.has(startId)) continue
    chainId++

    const queue = [startId]
    visited.add(startId)
    const chainNodeIds: number[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      chainNodeIds.push(current)
      const node = nodeMap.get(current)
      if (node) node.chainId = chainId

      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    // Compute depth: find the root (node with no incoming edge in this chain)
    const chainEdges = edges.filter(
      (e) => chainNodeIds.includes(e.source) && chainNodeIds.includes(e.target)
    )
    const hasIncoming = new Set(chainEdges.map((e) => e.target))
    const roots = chainNodeIds.filter((id) => !hasIncoming.has(id))
    const rootId = roots[0] || chainNodeIds[0]

    // BFS depth from root
    let maxDepth = 0
    const depthQueue: [number, number][] = [[rootId, 0]]
    const depthVisited = new Set<number>([rootId])
    while (depthQueue.length > 0) {
      const [cid, depth] = depthQueue.shift()!
      maxDepth = Math.max(maxDepth, depth)
      for (const e of chainEdges) {
        if (e.source === cid && !depthVisited.has(e.target)) {
          depthVisited.add(e.target)
          depthQueue.push([e.target, depth + 1])
        }
      }
    }

    chains.push({
      id: chainId,
      nodes: chainNodeIds.map((id) => nodeMap.get(id)!),
      edges: chainEdges,
      rootId,
      depth: maxDepth,
    })
  }

  // Sort chains: biggest first
  chains.sort((a, b) => b.nodes.length - a.nodes.length)

  return {
    nodes,
    edges,
    chains,
    selfReplyCount,
    crossChannelReplyCount,
  }
}

function createPhantomMessage(id: number): TelegramMessage {
  return {
    id,
    type: "message",
    date: "1970-01-01T00:00:00",
    date_unixtime: "0",
    text: "[External / missing message]",
    text_entities: [],
  }
}

// ─── Forwarded Sources Graph ────────────────────────────────────────────────

export interface ForwardSource {
  name: string
  count: number
  totalReactions: number
  messages: TelegramMessage[]
  firstDate: Date
  lastDate: Date
}

export interface ForwardGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  chains: ReplyChain[]
  sources: ForwardSource[]
  totalForwarded: number
  selfReplyCount: number
  crossChannelReplyCount: number
}

/**
 * Build a graph of forwarded sources.
 * Each unique forwarded_from becomes a hub node, connected to all messages forwarded from it.
 */
export function buildForwardGraph(messages: TelegramMessage[]): ForwardGraphData {
  const forwarded = messages.filter(
    (m) => m.type === "message" && m.forwarded_from
  )

  // Group by source
  const sourceMap = new Map<string, TelegramMessage[]>()
  for (const msg of forwarded) {
    const src = msg.forwarded_from!
    if (!sourceMap.has(src)) sourceMap.set(src, [])
    sourceMap.get(src)!.push(msg)
  }

  const sources: ForwardSource[] = []
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  let chainId = 0

  // Sort sources by count descending
  const sortedSources = Array.from(sourceMap.entries())
    .sort((a, b) => b[1].length - a[1].length)

  for (const [sourceName, msgs] of sortedSources) {
    chainId++
    const totalReactions = msgs.reduce((s, m) => {
      return s + (m.reactions?.reduce((rs, r) => rs + r.count, 0) || 0)
    }, 0)

    const dates = msgs.map((m) => new Date(m.date)).sort((a, b) => a.getTime() - b.getTime())

    sources.push({
      name: sourceName,
      count: msgs.length,
      totalReactions,
      messages: msgs,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    })

    // Create hub node for the source
    const hubId = -(chainId * 10000) // negative IDs for source hubs
    const hubNode: GraphNode = {
      id: hubId,
      message: createPhantomMessage(hubId),
      text: sourceName,
      date: dates[0],
      reactionCount: totalReactions,
      hasMedia: false,
      isForwardedReply: true,
      radius: Math.max(10, Math.min(30, 10 + Math.sqrt(msgs.length) * 3)),
      chainId,
    }
    nodes.push(hubNode)

    // Create a node for each forwarded message
    const chainNodes: GraphNode[] = [hubNode]
    for (const msg of msgs) {
      const reactionCount = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
      const msgNode: GraphNode = {
        id: msg.id,
        message: msg,
        text: getMessageText(msg).slice(0, 120),
        date: new Date(msg.date),
        reactionCount,
        hasMedia: !!(msg.photo || msg.file || msg.media_type),
        isForwardedReply: false,
        radius: Math.max(5, Math.min(16, 5 + Math.sqrt(reactionCount) * 1.2)),
        chainId,
      }
      nodes.push(msgNode)
      chainNodes.push(msgNode)
      edges.push({ source: hubId, target: msg.id })
    }
  }

  // Build chains (each source = one chain)
  const chains: ReplyChain[] = sortedSources.map(([, msgs], idx) => {
    const cId = idx + 1
    const hubId = -(cId * 10000)
    const chainNodeList = nodes.filter((n) => n.chainId === cId)
    const chainEdgeList = edges.filter(
      (e) => e.source === hubId
    )
    return {
      id: cId,
      nodes: chainNodeList,
      edges: chainEdgeList,
      rootId: hubId,
      depth: 1,
    }
  })

  return {
    nodes,
    edges,
    chains,
    sources,
    totalForwarded: forwarded.length,
    selfReplyCount: 0,
    crossChannelReplyCount: 0,
  }
}
