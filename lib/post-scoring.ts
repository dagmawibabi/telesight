import type { TelegramMessage } from "./telegram-types"
import { getMessageText } from "./telegram-types"

// ─── Post Engagement Score ──────────────────────────────────────────────────

export interface PostScore {
  total: number
  breakdown: {
    reactions: number
    textLength: number
    media: number
    links: number
    replies: number
    forwarded: number
  }
  percentile: number
  label: string
}

/**
 * Compute an engagement score for a single post, relative to all posts.
 * Score is 0-100.
 */
export function computePostScore(
  message: TelegramMessage,
  allMessages: TelegramMessage[]
): PostScore {
  const totalReactions = message.reactions?.reduce((s, r) => s + r.count, 0) || 0
  const text = getMessageText(message)
  const textLen = text.length
  const hasMedia = message.photo || message.file || message.media_type ? 1 : 0
  const hasLinks = (text.includes("http://") || text.includes("https://")) ? 1 : 0
  const isReply = message.reply_to_message_id ? 1 : 0
  const isForwarded = message.forwarded_from ? 1 : 0

  // Get max values for normalization
  const posts = allMessages.filter((m) => m.type === "message")
  let maxReactions = 0
  let maxTextLen = 0
  for (const m of posts) {
    const r = m.reactions?.reduce((s, r) => s + r.count, 0) || 0
    if (r > maxReactions) maxReactions = r
    const t = getMessageText(m).length
    if (t > maxTextLen) maxTextLen = t
  }

  // Weight: reactions=50, text=20, media=10, links=8, replies=7, forwarded=5
  const breakdown = {
    reactions: maxReactions > 0 ? Math.round((totalReactions / maxReactions) * 50) : 0,
    textLength: maxTextLen > 0 ? Math.round(Math.min(textLen / Math.max(maxTextLen * 0.3, 1), 1) * 20) : 0,
    media: hasMedia * 10,
    links: hasLinks * 8,
    replies: isReply * 7,
    forwarded: isForwarded * 5,
  }

  const total = Math.min(
    100,
    breakdown.reactions +
    breakdown.textLength +
    breakdown.media +
    breakdown.links +
    breakdown.replies +
    breakdown.forwarded
  )

  // Percentile
  const allScores = posts.map((m) => {
    const r = m.reactions?.reduce((s, r) => s + r.count, 0) || 0
    const t = getMessageText(m).length
    const hm = m.photo || m.file || m.media_type ? 1 : 0
    const hl = (getMessageText(m).includes("http://") || getMessageText(m).includes("https://")) ? 1 : 0
    const ir = m.reply_to_message_id ? 1 : 0
    const ifwd = m.forwarded_from ? 1 : 0
    return Math.min(
      100,
      (maxReactions > 0 ? Math.round((r / maxReactions) * 50) : 0) +
      (maxTextLen > 0 ? Math.round(Math.min(t / Math.max(maxTextLen * 0.3, 1), 1) * 20) : 0) +
      hm * 10 + hl * 8 + ir * 7 + ifwd * 5
    )
  })
  allScores.sort((a, b) => a - b)
  const rank = allScores.filter((s) => s <= total).length
  const percentile = Math.round((rank / Math.max(allScores.length, 1)) * 100)

  let label: string
  if (percentile >= 95) label = "Exceptional"
  else if (percentile >= 80) label = "Strong"
  else if (percentile >= 60) label = "Above Average"
  else if (percentile >= 40) label = "Average"
  else if (percentile >= 20) label = "Below Average"
  else label = "Low"

  return { total, breakdown, percentile, label }
}

// ─── Similar Posts ──────────────────────────────────────────────────────────

export interface SimilarPost {
  message: TelegramMessage
  score: number
  reasons: string[]
}

/**
 * Find posts similar to a given post using hashtags + keyword overlap.
 */
export function findSimilarPosts(
  target: TelegramMessage,
  allMessages: TelegramMessage[],
  limit: number = 6
): SimilarPost[] {
  const targetText = getMessageText(target).toLowerCase()

  // Extract hashtags
  const targetHashtags = new Set<string>()
  if (Array.isArray(target.text)) {
    for (const part of target.text) {
      if (typeof part !== "string" && part.type === "hashtag") {
        targetHashtags.add(part.text.toLowerCase())
      }
    }
  }
  const hashtagMatches = targetText.match(/#[\w\u0400-\u04FF]+/gi)
  if (hashtagMatches) {
    for (const h of hashtagMatches) targetHashtags.add(h.toLowerCase())
  }

  // Extract significant keywords (>4 chars, not common words)
  const stopWords = new Set([
    "that", "this", "with", "from", "have", "been", "will", "your", "what",
    "when", "where", "which", "their", "there", "would", "could", "should",
    "about", "after", "before", "being", "between", "both", "each", "also",
    "than", "then", "them", "they", "into", "just", "very", "some", "more",
    "only", "over", "such", "like", "http", "https", "were", "does", "done",
    "make", "made", "much", "many", "most", "other", "these", "those",
  ])

  const targetWords = new Set(
    targetText
      .replace(/[^\w\s\u0400-\u04FF]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w))
  )

  const candidates: SimilarPost[] = []

  const posts = allMessages.filter(
    (m) => m.type === "message" && m.id !== target.id
  )

  for (const msg of posts) {
    const msgText = getMessageText(msg).toLowerCase()
    let score = 0
    const reasons: string[] = []

    // Hashtag overlap
    const msgHashtags = new Set<string>()
    if (Array.isArray(msg.text)) {
      for (const part of msg.text) {
        if (typeof part !== "string" && part.type === "hashtag") {
          msgHashtags.add(part.text.toLowerCase())
        }
      }
    }
    const mhm = msgText.match(/#[\w\u0400-\u04FF]+/gi)
    if (mhm) {
      for (const h of mhm) msgHashtags.add(h.toLowerCase())
    }

    let sharedHashtags = 0
    const matchedTags: string[] = []
    for (const tag of targetHashtags) {
      if (msgHashtags.has(tag)) {
        sharedHashtags++
        matchedTags.push(tag)
      }
    }
    if (sharedHashtags > 0) {
      score += sharedHashtags * 30
      reasons.push(`${sharedHashtags} shared hashtag${sharedHashtags > 1 ? "s" : ""}: ${matchedTags.slice(0, 3).join(", ")}`)
    }

    // Keyword overlap
    const msgWords = new Set(
      msgText
        .replace(/[^\w\s\u0400-\u04FF]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !stopWords.has(w))
    )

    let sharedWords = 0
    for (const w of targetWords) {
      if (msgWords.has(w)) sharedWords++
    }
    if (sharedWords > 0 && targetWords.size > 0) {
      const wordScore = Math.min(40, Math.round((sharedWords / Math.max(targetWords.size, 1)) * 40))
      score += wordScore
      reasons.push(`${sharedWords} shared keyword${sharedWords > 1 ? "s" : ""}`)
    }

    // Same forward source bonus
    if (target.forwarded_from && msg.forwarded_from === target.forwarded_from) {
      score += 15
      reasons.push(`Same source: ${target.forwarded_from}`)
    }

    // Similar media type bonus
    if (target.media_type && msg.media_type === target.media_type) {
      score += 5
      reasons.push("Same media type")
    }

    if (score > 10) {
      candidates.push({ message: msg, score, reasons })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ─── Top Posts ───────────────────────────────────────────────────────────────

export interface TopPost {
  message: TelegramMessage
  totalReactions: number
  score: number
}

export function getTopPosts(
  messages: TelegramMessage[],
  limit: number = 20
): TopPost[] {
  const posts = messages.filter((m) => m.type === "message")

  return posts
    .map((msg) => {
      const totalReactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0
      const text = getMessageText(msg)
      // Simple score: reactions weight heavily, plus text engagement
      const score = totalReactions * 10 + (text.length > 100 ? 5 : 0) + (msg.photo ? 3 : 0)
      return { message: msg, totalReactions, score }
    })
    .filter((p) => p.totalReactions > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
