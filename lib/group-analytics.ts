import type { TelegramMessage, TelegramExport } from "./telegram-types"
import { getMessageText } from "./telegram-types"

// ─── Topics ─────────────────────────────────────────────────────────────────

export interface Topic {
  id: number
  title: string
  messageCount: number
  lastActive: Date
}

export function extractTopics(messages: TelegramMessage[]): Topic[] {
  const topicMap = new Map<number, { title: string; count: number; lastDate: Date }>()

  // Find topic_created service messages
  for (const msg of messages) {
    if (msg.type === "service" && msg.action === "topic_created" && msg.title) {
      topicMap.set(msg.id, {
        title: msg.title,
        count: 0,
        lastDate: new Date(msg.date),
      })
    }
  }

  // Count messages per topic (by reply_to_message_id matching a topic root)
  for (const msg of messages) {
    if (msg.type === "message" && msg.reply_to_message_id) {
      const topicId = msg.reply_to_message_id
      if (topicMap.has(topicId)) {
        const topic = topicMap.get(topicId)!
        topic.count++
        const d = new Date(msg.date)
        if (d > topic.lastDate) topic.lastDate = d
      }
    }
  }

  return Array.from(topicMap.entries())
    .map(([id, data]) => ({
      id,
      title: data.title,
      messageCount: data.count,
      lastActive: data.lastDate,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
}

export function getTopicForMessage(
  msg: TelegramMessage,
  topics: Topic[]
): Topic | null {
  if (!msg.reply_to_message_id) return null
  return topics.find((t) => t.id === msg.reply_to_message_id) || null
}

// ─── Member Stats ───────────────────────────────────────────────────────────

export interface MemberStat {
  name: string
  id: string
  messageCount: number
  reactionsSent: number
  reactionsReceived: number
  mediaCount: number
  repliesCount: number
  firstMessage: Date
  lastMessage: Date
  avgMessageLength: number
  topHours: number[] // length 24
  topEmojisUsed: { emoji: string; count: number }[]
}

export function computeMemberStats(messages: TelegramMessage[]): MemberStat[] {
  const memberMap = new Map<
    string,
    {
      name: string
      id: string
      messages: number
      reactionsSent: number
      reactionsReceived: number
      media: number
      replies: number
      first: Date
      last: Date
      totalLength: number
      hours: number[]
      emojiMap: Map<string, number>
    }
  >()

  const ensure = (name: string, id: string) => {
    if (!memberMap.has(id)) {
      memberMap.set(id, {
        name,
        id,
        messages: 0,
        reactionsSent: 0,
        reactionsReceived: 0,
        media: 0,
        replies: 0,
        first: new Date("2999-01-01"),
        last: new Date("1970-01-01"),
        totalLength: 0,
        hours: new Array(24).fill(0),
        emojiMap: new Map(),
      })
    }
    return memberMap.get(id)!
  }

  for (const msg of messages) {
    if (msg.type !== "message") continue
    const fromName = msg.from || msg.actor || "Unknown"
    const fromId = msg.from_id || msg.actor_id || fromName

    const member = ensure(fromName, fromId)
    member.messages++
    const d = new Date(msg.date)
    if (d < member.first) member.first = d
    if (d > member.last) member.last = d
    member.hours[d.getHours()]++
    member.totalLength += getMessageText(msg).length

    if (msg.photo || msg.file || msg.media_type) member.media++
    if (msg.reply_to_message_id) member.replies++

    // Reactions received
    if (msg.reactions) {
      for (const r of msg.reactions) {
        member.reactionsReceived += r.count
        // Track who sent reactions (from "recent" array)
        if (r.recent) {
          for (const recent of r.recent) {
            const sender = ensure(recent.from, recent.from_id)
            sender.reactionsSent++
            const em = sender.emojiMap
            em.set(r.emoji, (em.get(r.emoji) || 0) + 1)
          }
        }
      }
    }
  }

  return Array.from(memberMap.values())
    .map((m) => ({
      name: m.name,
      id: m.id,
      messageCount: m.messages,
      reactionsSent: m.reactionsSent,
      reactionsReceived: m.reactionsReceived,
      mediaCount: m.media,
      repliesCount: m.replies,
      firstMessage: m.first,
      lastMessage: m.last,
      avgMessageLength: m.messages > 0 ? Math.round(m.totalLength / m.messages) : 0,
      topHours: m.hours,
      topEmojisUsed: Array.from(m.emojiMap.entries())
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
}

// ─── Interaction Map ────────────────────────────────────────────────────────

export interface InteractionEdge {
  from: string
  fromId: string
  to: string
  toId: string
  replyCount: number
  reactionCount: number
}

export function computeInteractionMap(messages: TelegramMessage[]): InteractionEdge[] {
  const msgMap = new Map<number, TelegramMessage>()
  for (const msg of messages) {
    msgMap.set(msg.id, msg)
  }

  const edgeMap = new Map<string, InteractionEdge>()
  const edgeKey = (a: string, b: string) => [a, b].sort().join("__")

  for (const msg of messages) {
    if (msg.type !== "message") continue
    const fromId = msg.from_id || msg.actor_id || ""
    const fromName = msg.from || msg.actor || "Unknown"

    // Reply interactions
    if (msg.reply_to_message_id) {
      const parent = msgMap.get(msg.reply_to_message_id)
      if (parent && parent.from_id && parent.from_id !== fromId) {
        const key = edgeKey(fromId, parent.from_id)
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            from: fromName,
            fromId,
            to: parent.from || "Unknown",
            toId: parent.from_id,
            replyCount: 0,
            reactionCount: 0,
          })
        }
        edgeMap.get(key)!.replyCount++
      }
    }

    // Reaction interactions
    if (msg.reactions) {
      for (const r of msg.reactions) {
        if (r.recent) {
          for (const recent of r.recent) {
            if (recent.from_id !== fromId) {
              const key = edgeKey(fromId, recent.from_id)
              if (!edgeMap.has(key)) {
                edgeMap.set(key, {
                  from: fromName,
                  fromId,
                  to: recent.from,
                  toId: recent.from_id,
                  replyCount: 0,
                  reactionCount: 0,
                })
              }
              edgeMap.get(key)!.reactionCount++
            }
          }
        }
      }
    }
  }

  return Array.from(edgeMap.values()).sort(
    (a, b) => b.replyCount + b.reactionCount - (a.replyCount + a.reactionCount)
  )
}

// ─── Group Stats ────────────────────────────────────────────────────────────

export interface GroupStats {
  name: string
  type: string
  totalMessages: number
  totalServiceMessages: number
  totalMembers: number
  dateRange: { start: string; end: string }
  topReactions: { emoji: string; count: number }[]
  totalReactions: number
  messagesWithLinks: number
  messagesWithMedia: number
  forwardedMessages: number
  repliedMessages: number
  topicCount: number
}

export function computeGroupStats(data: TelegramExport): GroupStats {
  const messages = data.messages.filter((m) => m.type === "message")
  const serviceMessages = data.messages.filter((m) => m.type === "service")

  const members = new Set<string>()
  for (const msg of messages) {
    if (msg.from) members.add(msg.from)
  }

  const reactionMap = new Map<string, number>()
  let totalReactions = 0
  for (const msg of messages) {
    if (msg.reactions) {
      for (const r of msg.reactions) {
        reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + r.count)
        totalReactions += r.count
      }
    }
  }

  const topReactions = Array.from(reactionMap.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const dates = data.messages.map((m) => m.date).sort()
  const topicCount = serviceMessages.filter((m) => m.action === "topic_created").length

  return {
    name: data.name,
    type: data.type,
    totalMessages: messages.length,
    totalServiceMessages: serviceMessages.length,
    totalMembers: members.size,
    dateRange: {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
    },
    topReactions,
    totalReactions,
    messagesWithLinks: messages.filter((m) => {
      const text = getMessageText(m)
      return text.includes("http://") || text.includes("https://")
    }).length,
    messagesWithMedia: messages.filter(
      (m) => m.photo || m.file || m.media_type
    ).length,
    forwardedMessages: messages.filter((m) => m.forwarded_from).length,
    repliedMessages: messages.filter((m) => m.reply_to_message_id).length,
    topicCount,
  }
}
