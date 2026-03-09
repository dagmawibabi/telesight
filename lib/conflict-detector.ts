import type { TelegramMessage } from "./telegram-types"
import { getMessageText } from "./telegram-types"

// Conflict/conflict patterns - aggressive language indicators
const CONFLICT_WORDS = [
  "hate", "stupid", "idiot", "dumb", "moron", "loser", "shut up",
  "annoying", "frustrating", "ridiculous", "absurd", "nonsense",
  "wrong", "incorrect", "stupid", "terrible", "awful", "horrible",
  "disagree", "objection", "unacceptable", "unfair", "bias",
  "attack", "insult", "offensive", "rude", "disrespect",
  "liar", "lying", "false", "fake", "nonsense", "bullshit",
  "damn", "hell", "crap", "suck", "screw", "piss", "angry",
  "mad", "furious", "irritated", "annoyed", "upset", "disappointed"
]

// Patterns indicating heated exchange
const ANGRY_PATTERNS = {
  allCapsWord: /[A-Z]{4,}/g,  // 4+ consecutive caps
  multipleExclaim: /!{2,}/g,   // 2+ exclamation marks
  multipleQuestion: /\?{2,}/g, // 2+ question marks
  capsRatio: (text: string) => {
    const caps = (text.match(/[A-Z]/g) || []).length
    const total = text.replace(/\s/g, "").length
    return total > 0 ? caps / total : 0
  }
}

export interface ConflictResult {
  message: TelegramMessage
  score: number
  reasons: string[]
  sentiment: number
  intensity: "low" | "medium" | "high"
}

/**
 * Analyze a single message for conflict indicators
 */
function analyzeMessage(message: TelegramMessage): ConflictResult | null {
  const text = getMessageText(message)
  if (!text || text.length < 3) return null

  const lowerText = text.toLowerCase()
  const reasons: string[] = []
  let score = 0

  // Count conflict words
  const conflictMatches = CONFLICT_WORDS.filter(word => lowerText.includes(word))
  if (conflictMatches.length > 0) {
    score += conflictMatches.length * 2
    reasons.push(`${conflictMatches.length} negative words`)
  }

  // Check for all caps words (shouting)
  const capsWords = text.match(ANGRY_PATTERNS.allCapsWord) || []
  if (capsWords.length > 0) {
    score += capsWords.length * 3
    reasons.push(`${capsWords.length} ALL CAPS words`)
  }

  // Check caps ratio
  const capsRatio = ANGRY_PATTERNS.capsRatio(text)
  if (capsRatio > 0.3) {
    score += 4
    reasons.push("High caps ratio (shouting)")
  }

  // Multiple exclamation marks
  const exclaimMatches = text.match(ANGRY_PATTERNS.multipleExclaim)
  if (exclaimMatches) {
    score += 3
    reasons.push("Multiple exclamation marks")
  }

  // Multiple question marks (frustration/disbelief)
  const questionMatches = text.match(ANGRY_PATTERNS.multipleQuestion)
  if (questionMatches) {
    score += 2
    reasons.push("Multiple question marks")
  }

  // Negation + negative word combo ("not good" is negative)
  const negationPattern = /\b(not|never|no|nothing|nobody|nowhere|neither|nor)\b.*\b(good|right|correct|fair|true|agree|accept)\b/i
  if (negationPattern.test(text)) {
    score += 2
    reasons.push("Negation pattern")
  }

  // Short angry responses
  if (text.length < 20 && (/^(no|nah|nope|wrong|false|never|stop|quit|enough|whatever)[!.]?$/i.test(text) || 
      text.split(/[.!?]/).filter(s => s.trim()).length === 1)) {
    score += 1
    if (conflictMatches.length > 0) reasons.push("Short negative response")
  }

  // Determine intensity
  let intensity: "low" | "medium" | "high" = "low"
  if (score >= 8) intensity = "high"
  else if (score >= 4) intensity = "medium"

  // Minimum threshold
  if (score < 2) return null

  return {
    message,
    score,
    reasons,
    sentiment: 0,
    intensity
  }
}

/**
 * Find messages with conflict indicators
 */
export function findConflicts(
  messages: TelegramMessage[],
  options: {
    minScore?: number
    maxResults?: number
  } = {}
): ConflictResult[] {
  const { minScore = 2, maxResults = 50 } = options

  const results: ConflictResult[] = []

  for (const msg of messages) {
    if (msg.type !== "message") continue

    const analysis = analyzeMessage(msg)
    if (analysis && analysis.score >= minScore) {
      results.push(analysis)
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, maxResults)
}

/**
 * Find heated exchanges (consecutive negative messages)
 */
export function findHeatedExchanges(
  messages: TelegramMessage[],
  windowMinutes: number = 10
): Array<{
  messages: ConflictResult[]
  startTime: Date
  endTime: Date
  intensity: number
}> {
  const conflicts = findConflicts(messages, { minScore: 2 })
  if (conflicts.length < 2) return []

  const exchanges: Array<{
    messages: ConflictResult[]
    startTime: Date
    endTime: Date
    intensity: number
  }> = []

  let currentExchange: ConflictResult[] = []

  for (let i = 0; i < conflicts.length; i++) {
    const current = conflicts[i]
    const currentTime = new Date(current.message.date)

    if (currentExchange.length === 0) {
      currentExchange.push(current)
      continue
    }

    const lastInExchange = currentExchange[currentExchange.length - 1]
    const lastTime = new Date(lastInExchange.message.date)
    const diffMinutes = (currentTime.getTime() - lastTime.getTime()) / 60000

    if (diffMinutes <= windowMinutes) {
      currentExchange.push(current)
    } else {
      if (currentExchange.length >= 2) {
        const totalScore = currentExchange.reduce((sum, m) => sum + m.score, 0)
        exchanges.push({
          messages: [...currentExchange],
          startTime: new Date(currentExchange[0].message.date),
          endTime: new Date(currentExchange[currentExchange.length - 1].message.date),
          intensity: totalScore
        })
      }
      currentExchange = [current]
    }
  }

  // Don't forget the last exchange
  if (currentExchange.length >= 2) {
    const totalScore = currentExchange.reduce((sum, m) => sum + m.score, 0)
    exchanges.push({
      messages: [...currentExchange],
      startTime: new Date(currentExchange[0].message.date),
      endTime: new Date(currentExchange[currentExchange.length - 1].message.date),
      intensity: totalScore
    })
  }

  // Sort by intensity
  exchanges.sort((a, b) => b.intensity - a.intensity)

  return exchanges
}

/**
 * Quick stats about conflicts
 */
export function getConflictStats(messages: TelegramMessage[]) {
  const conflicts = findConflicts(messages)
  const exchanges = findHeatedExchanges(messages)

  const byIntensity = {
    high: conflicts.filter(c => c.intensity === "high").length,
    medium: conflicts.filter(c => c.intensity === "medium").length,
    low: conflicts.filter(c => c.intensity === "low").length
  }

  // Top contributors to conflicts (for group chats)
  const contributorMap = new Map<string, { count: number; score: number }>()
  for (const c of conflicts) {
    const from = c.message.from || "Unknown"
    const existing = contributorMap.get(from)
    if (existing) {
      existing.count += 1
      existing.score += c.score
    } else {
      contributorMap.set(from, { count: 1, score: c.score })
    }
  }
  const topContributors = Array.from(contributorMap.entries())
    .map(([name, data]) => ({ name, count: data.count, score: data.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return {
    totalConflicts: conflicts.length,
    totalMessages: messages.filter(m => m.type === "message").length,
    conflictRate: conflicts.length / Math.max(messages.filter(m => m.type === "message").length, 1),
    byIntensity,
    heatedExchanges: exchanges.length,
    topContributors,
    averageScore: conflicts.length > 0 
      ? conflicts.reduce((sum, c) => sum + c.score, 0) / conflicts.length 
      : 0
  }
}
