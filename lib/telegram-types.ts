export interface TelegramExport {
  name: string
  type: string
  id: number
  messages: TelegramMessage[]
}

export interface TextEntity {
  type: string
  text: string
  document_id?: string
  collapsed?: boolean
  href?: string
}

export type MessageText = string | TextEntity

export interface ReactionRecent {
  from: string
  from_id: string
  date: string
}

export interface Reaction {
  type: string
  count: number
  emoji: string
  recent?: ReactionRecent[]
}

export interface TodoItem {
  text: string
  id: number
}

export interface TodoList {
  title: string
  others_can_append?: boolean
  others_can_complete?: boolean
  answers: TodoItem[]
}

export interface ContactInfo {
  first_name?: string
  last_name?: string
  phone_number?: string
}

export interface TelegramMessage {
  id: number
  type: "message" | "service"
  date: string
  date_unixtime: string
  edited?: string
  edited_unixtime?: string
  from?: string
  from_id?: string
  actor?: string
  actor_id?: string
  action?: string
  title?: string
  text: string | MessageText[]
  text_entities: TextEntity[]
  reply_to_message_id?: number
  forwarded_from?: string
  forwarded_from_id?: string
  photo?: string
  photo_file_size?: number
  width?: number
  height?: number
  file?: string
  file_name?: string
  file_size?: number
  media_type?: string
  mime_type?: string
  duration_seconds?: number
  reactions?: Reaction[]
  sticker_emoji?: string
  thumbnail?: string
  // Group-specific fields
  todo_list?: TodoList
  contact_information?: ContactInfo
  contact_vcard?: string
  members?: string[]
  inviter?: string
  message_id?: number
  new_title?: string
  new_icon_emoji_id?: string
}

export type ExportType = "channel" | "group" | "dm"

export function detectExportType(data: TelegramExport): ExportType {
  const t = data.type?.toLowerCase() || ""

  // Explicit personal chat type
  if (t.includes("personal_chat") || t === "private") {
    return "dm"
  }

  // Group types
  if (
    t.includes("supergroup") ||
    t.includes("private_group") ||
    t.includes("basic_group") ||
    t.includes("public_group")
  ) {
    return "group"
  }

  // Heuristic: count unique senders using from_id (more reliable than from)
  const senders = new Set<string>()
  for (const msg of data.messages) {
    // Use from_id if available, fallback to from
    const senderId = msg.from_id || msg.from
    if (senderId) senders.add(senderId)
    if (senders.size > 2) return "group"
  }

  // Exactly 2 senders = DM
  if (senders.size === 2) return "dm"

  return "channel"
}

/** For DMs, extract the two participants */
export function getDMParticipants(messages: TelegramMessage[]): [string, string] | null {
  const senders = new Map<string, string>() // id -> name
  for (const m of messages) {
    if (m.type === "message" && m.from && m.from_id) {
      if (!senders.has(m.from_id)) senders.set(m.from_id, m.from)
      if (senders.size >= 2) break
    }
  }
  const names = Array.from(senders.values())
  if (names.length === 2) return [names[0], names[1]]
  return null
}

export interface ChannelStats {
  name: string
  type: string
  totalMessages: number
  totalServiceMessages: number
  dateRange: { start: string; end: string }
  topReactions: { emoji: string; count: number }[]
  totalReactions: number
  messagesWithLinks: number
  messagesWithMedia: number
  forwardedMessages: number
  repliedMessages: number
}

export interface MonthGroup {
  key: string
  label: string
  messages: TelegramMessage[]
}

export function getMessageText(msg: TelegramMessage): string {
  if (typeof msg.text === "string") return msg.text
  if (Array.isArray(msg.text)) {
    return msg.text
      .map((part) => (typeof part === "string" ? part : part.text))
      .join("")
  }
  return ""
}

export function computeStats(data: TelegramExport): ChannelStats {
  const messages = data.messages.filter((m) => m.type === "message")
  const serviceMessages = data.messages.filter((m) => m.type === "service")

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

  return {
    name: data.name,
    type: data.type,
    totalMessages: messages.length,
    totalServiceMessages: serviceMessages.length,
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
  }
}

export type SortDirection = "newest" | "oldest"

export function groupByMonth(
  messages: TelegramMessage[],
  sortDirection: SortDirection = "newest"
): MonthGroup[] {
  const groups = new Map<string, TelegramMessage[]>()

  for (const msg of messages) {
    const date = new Date(msg.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(msg)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) =>
      sortDirection === "newest" ? b.localeCompare(a) : a.localeCompare(b)
    )
    .map(([key, msgs]) => {
      const [year, month] = key.split("-")
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const sortedMsgs =
        sortDirection === "newest"
          ? [...msgs].sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
          : msgs
      return {
        key,
        label: date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        }),
        messages: sortedMsgs,
      }
    })
}
