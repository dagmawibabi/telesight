import type { TelegramMessage } from "./telegram-types"
import { getMessageText } from "./telegram-types"

// Manipulation pattern categories with professional terminology
export type ManipulationType = 
  | "gaslighting" 
  | "guilt_tripping" 
  | "passive_aggressive" 
  | "controlling" 
  | "dismissive" 
  | "victimhood"

interface ManipulationPattern {
  type: ManipulationType
  phrases: string[]
  indicators: RegExp[]
  severityWeight: number
  description: string
}

const MANIPULATION_PATTERNS: ManipulationPattern[] = [
  {
    type: "gaslighting",
    phrases: [
      "you're too sensitive",
      "you're imagining things",
      "that never happened",
      "you're overreacting",
      "you're being dramatic",
      "you're crazy",
      "you're paranoid",
      "i never said that",
      "you're making things up",
      "it's all in your head",
      "you're confused",
      "you must be misremembering",
    ],
    indicators: [
      /you('re| are)\s+(too\s+)?(sensitive|emotional|dramatic)/i,
      /you('re| are)\s+(imagining|making\s+up|confused|paranoid|crazy)/i,
      /that\s+(never|didn't)\s+happen/i,
      /i\s+never\s+said\s+that/i,
      /it'?s?\s+all\s+in\s+your\s+head/i,
      /you'?re?\s+overreacting/i,
      /you\s+must\s+be\s+misremembering/i,
    ],
    severityWeight: 3,
    description: "Undermining someone's perception of reality"
  },
  {
    type: "guilt_tripping",
    phrases: [
      "after all i've done",
      "after everything i've done for you",
      "i sacrificed",
      "i gave up so much",
      "you owe me",
      "you never appreciate",
      "you don't care about",
      "i do so much for you",
      "look at everything i've done",
      "you never think about my feelings",
      "i'm always the one who",
      "you never do anything for me",
    ],
    indicators: [
      /after\s+(all|everything)\s+i('ve| have)\s+done/i,
      /i\s+(sacrificed|gave\s+up)/i,
      /you\s+(owe|owe\s+me)/i,
      /you\s+never\s+(appreciate|care\s+about|think\s+about)/i,
      /i\s+do\s+so\s+much/i,
      /look\s+at\s+everything/i,
      /i'm\s+always\s+the\s+one/i,
    ],
    severityWeight: 2,
    description: "Using obligation and guilt to control behavior"
  },
  {
    type: "passive_aggressive",
    phrases: [
      "i'm fine",
      "whatever you want",
      "do what you want",
      "it's fine",
      "sure",
      "fine",
      "whatever",
      "as you wish",
      "if that's what you want",
      "i don't care",
      "do whatever",
    ],
    indicators: [
      /^(i['`]?m?\s+fine|it['`]?s?\s+fine)[.!]*$/i,
      /^(whatever|sure|fine)[.!]*$/i,
      /whatever\s+you\s+want/i,
      /do\s+what\s+you\s+want/i,
      /as\s+you\s+wish/i,
      /if\s+that['`]?s?\s+what\s+you\s+want/i,
      /i\s+don['`]?t?\s+care/i,
    ],
    severityWeight: 1.5,
    description: "Indirect expression of hostility or resentment"
  },
  {
    type: "controlling",
    phrases: [
      "you shouldn't wear",
      "you shouldn't do",
      "why are you wearing",
      "who were you talking to",
      "where were you",
      "who is that",
      "don't talk to",
      "don't see",
      "i don't want you to",
      "you can't",
      "you're not allowed",
      "i forbid",
    ],
    indicators: [
      /you\s+shouldn['`]?t?\s+(wear|do|go|talk)/i,
      /why\s+are\s+you\s+(wearing|talking|going)/i,
      /who\s+(were|are)\s+you\s+(talking|with|seeing)/i,
      /where\s+(were|are)\s+you/i,
      /don['`]?t?\s+(talk|see|go|do)/i,
      /i\s+don['`]?t?\s+want\s+you\s+to/i,
      /you\s+(can['`]?t?|cannot|are\s+not\s+allowed)/i,
      /i\s+forbid/i,
    ],
    severityWeight: 2.5,
    description: "Restricting autonomy and monitoring behavior"
  },
  {
    type: "dismissive",
    phrases: [
      "get over it",
      "move on",
      "it's not a big deal",
      "you're being ridiculous",
      "stop complaining",
      "everyone deals with",
      "just relax",
      "calm down",
      "don't be so",
      "it's just",
      "you always",
      "you never",
    ],
    indicators: [
      /get\s+over\s+it/i,
      /move\s+on/i,
      /it['`]?s?\s+not\s+a\s+big\s+deal/i,
      /you['`]?re?\s+being\s+ridiculous/i,
      /stop\s+(complaining|whining)/i,
      /everyone\s+deals\s+with/i,
      /just\s+(relax|calm\s+down)/i,
      /don['`]?t?\s+be\s+so/i,
      /it['`]?s?\s+just\s+(a|an)/i,
      /you\s+always/i,
      /you\s+never/i,
    ],
    severityWeight: 2,
    description: "Minimizing feelings and invalidating concerns"
  },
  {
    type: "victimhood",
    phrases: [
      "no one understands",
      "i'm always the victim",
      "everyone is against me",
      "why does this always happen to me",
      "nothing ever goes my way",
      "i can't catch a break",
      "everyone leaves me",
      "no one cares about me",
      "i'm all alone",
      "poor me",
      "you don't know what it's like",
    ],
    indicators: [
      /no\s+one\s+(understands|cares|gets\s+it)/i,
      /i['`]?m?\s+always\s+the\s+victim/i,
      /everyone\s+is\s+against\s+me/i,
      /why\s+does\s+this\s+always\s+happen\s+to\s+me/i,
      /nothing\s+ever\s+goes\s+my\s+way/i,
      /i\s+can['`]?t?\s+catch\s+a\s+break/i,
      /everyone\s+leaves\s+me/i,
      /i['`]?m?\s+all\s+alone/i,
      /poor\s+me/i,
      /you\s+don['`]?t?\s+know\s+what\s+it['`]?s?\s+like/i,
    ],
    severityWeight: 1.5,
    description: "Presenting oneself as perpetual victim to gain sympathy"
  },
]

export interface ManipulationResult {
  message: TelegramMessage
  score: number
  severity: "mild" | "moderate" | "severe"
  types: ManipulationType[]
  reasons: string[]
  sentimentScore: number
}

/**
 * Analyze a message for manipulative language patterns
 */
function analyzeMessageForManipulation(message: TelegramMessage): ManipulationResult | null {
  const text = getMessageText(message)
  if (!text || text.length < 3) return null

  const lowerText = text.toLowerCase()
  let totalScore = 0
  const detectedTypes: ManipulationType[] = []
  const reasons: string[] = []

  // Check each manipulation pattern category
  for (const pattern of MANIPULATION_PATTERNS) {
    let typeScore = 0
    let typeDetected = false

    // Check for phrase matches
    for (const phrase of pattern.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        typeScore += pattern.severityWeight
        if (!typeDetected) {
          detectedTypes.push(pattern.type)
          typeDetected = true
        }
        reasons.push(`${pattern.description} ("${phrase}")`)
      }
    }

    // Check for regex indicators
    for (const indicator of pattern.indicators) {
      if (indicator.test(text)) {
        typeScore += pattern.severityWeight * 0.5
        if (!typeDetected) {
          detectedTypes.push(pattern.type)
          typeDetected = true
        }
      }
    }

    totalScore += typeScore
  }

  // Determine severity level
  let severity: "mild" | "moderate" | "severe" = "mild"
  if (totalScore >= 6) severity = "severe"
  else if (totalScore >= 3) severity = "moderate"

  // Minimum threshold - must have detected at least one type
  if (detectedTypes.length === 0) return null

  return {
    message,
    score: Math.round(totalScore * 10) / 10,
    severity,
    types: detectedTypes,
    reasons: reasons.slice(0, 3), // Limit to top 3 reasons
    sentimentScore: 0,
  }
}

/**
 * Find messages containing manipulative language
 */
export function findManipulation(
  messages: TelegramMessage[],
  options: {
    minSeverity?: "mild" | "moderate" | "severe"
    maxResults?: number
    types?: ManipulationType[]
  } = {}
): ManipulationResult[] {
  const { minSeverity = "mild", maxResults = 50, types } = options

  const severityLevels = { mild: 1, moderate: 2, severe: 3 }
  const minLevel = severityLevels[minSeverity]

  const results: ManipulationResult[] = []

  for (const msg of messages) {
    if (msg.type !== "message") continue

    const analysis = analyzeMessageForManipulation(msg)
    if (!analysis) continue

    // Filter by severity
    if (severityLevels[analysis.severity] < minLevel) continue

    // Filter by type if specified
    if (types && !analysis.types.some(t => types.includes(t))) continue

    results.push(analysis)
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, maxResults)
}

/**
 * Get manipulation statistics
 */
export function getManipulationStats(messages: TelegramMessage[]) {
  const manipulations = findManipulation(messages)

  const byType = {
    gaslighting: 0,
    guilt_tripping: 0,
    passive_aggressive: 0,
    controlling: 0,
    dismissive: 0,
    victimhood: 0,
  }

  const bySeverity = {
    mild: 0,
    moderate: 0,
    severe: 0,
  }

  // Top contributors (for group chats)
  const contributorMap = new Map<string, { count: number; score: number }>()

  for (const m of manipulations) {
    // Count by type
    for (const type of m.types) {
      byType[type]++
    }

    // Count by severity
    bySeverity[m.severity]++

    // Track contributors
    const from = m.message.from || "Unknown"
    const existing = contributorMap.get(from)
    if (existing) {
      existing.count++
      existing.score += m.score
    } else {
      contributorMap.set(from, { count: 1, score: m.score })
    }
  }

  const topContributors = Array.from(contributorMap.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }))

  return {
    totalManipulation: manipulations.length,
    totalMessages: messages.filter(m => m.type === "message").length,
    manipulationRate: manipulations.length / Math.max(messages.filter(m => m.type === "message").length, 1),
    byType,
    bySeverity,
    topContributors,
    averageScore: manipulations.length > 0
      ? manipulations.reduce((sum, m) => sum + m.score, 0) / manipulations.length
      : 0,
  }
}

/**
 * Get human-readable description of manipulation type
 */
export function getManipulationTypeDescription(type: ManipulationType): string {
  const descriptions: Record<ManipulationType, string> = {
    gaslighting: "Gaslighting",
    guilt_tripping: "Guilt Tripping",
    passive_aggressive: "Passive Aggressive",
    controlling: "Controlling Behavior",
    dismissive: "Dismissive/Invalidating",
    victimhood: "Playing Victim",
  }
  return descriptions[type]
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: "mild" | "moderate" | "severe"): string {
  const colors = {
    mild: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
    moderate: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    severe: "text-red-600 bg-red-500/10 border-red-500/20",
  }
  return colors[severity]
}
