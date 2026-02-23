import type { TelegramMessage } from "./telegram-types"
import { getMessageText } from "./telegram-types"

export type FraudType = "phishing" | "money_request" | "impersonation" | "urgency" | "suspicious_link"

export interface FraudResult {
  message: TelegramMessage
  type: FraudType
  severity: "low" | "medium" | "high" | "critical"
  score: number
  reasons: string[]
  matchedPatterns: string[]
}

// Suspicious URL patterns
const SUSPICIOUS_DOMAINS = [
  "bit.ly", "tinyurl", "t.co", "goo.gl", "ow.ly", "short.link",
  "login-", "verify-", "secure-", "account-", "update-",
  "telegram-security", "telegram-verify", "tg-official",
  "free-nitro", "discord-gift", "steam-gift",
  "binance-", "coinbase-", "crypto-", "wallet-",
  "paypal-verify", "banking-", "secure-bank",
]

const PHISHING_KEYWORDS = [
  "click here to verify", "confirm your account", "suspicious activity",
  "account will be suspended", "verify your identity", "login to continue",
  "update your information", "security alert", "unusual login",
  "confirm password", "validate account", "reactivate account",
]

// Money scam patterns
const MONEY_KEYWORDS = [
  "send me", "transfer", "wire money", "send money", "pay me",
  "urgent payment", "immediately", "asap", "right now", "don't delay",
  "family emergency", "hospital", "accident", "stuck in",
  "lost my wallet", "phone died", "stranded", "need help",
  "double your money", "guaranteed return", "investment opportunity",
  "crypto opportunity", "forex trading", "binary options",
  "send $", "send €", "send £", "transfer $", "wire $",
  "bitcoin", "ethereum", "crypto", "usdt", "tether",
  "western union", "moneygram", "gift card", "itunes card",
]

// Impersonation patterns
const IMPERSONATION_PATTERNS = [
  "i am the admin", "i'm the admin", "this is official",
  "telegram support", "telegram team", "official team",
  "as your admin", "channel owner", "group administrator",
  "i work for telegram", "telegram staff", "support team",
  "verify your account", "mandatory verification",
  "dm me to verify", "message me privately", "don't tell anyone",
]

// Urgency patterns (common in scams)
const URGENCY_PATTERNS = [
  "act now", "limited time", "expires soon", "last chance",
  "only today", "24 hours only", "urgent", "emergency",
  "hurry", "don't wait", "immediately", "right away",
  "quickly", "as soon as possible", "time sensitive",
]

/**
 * Check if URL is suspicious
 */
function checkSuspiciousUrl(text: string): { isSuspicious: boolean; urls: string[]; reasons: string[] } {
  const urlRegex = /https?:\/\/[^\s)]+/gi
  const urls = text.match(urlRegex) || []
  const reasons: string[] = []
  
  for (const url of urls) {
    const lowerUrl = url.toLowerCase()
    
    // Check for suspicious domains
    for (const domain of SUSPICIOUS_DOMAINS) {
      if (lowerUrl.includes(domain)) {
        reasons.push(`Suspicious domain: ${domain}`)
      }
    }
    
    // Check for URL shorteners (often used to hide malicious links)
    if (/bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|short\.link/i.test(lowerUrl)) {
      reasons.push("URL shortener detected (hides real destination)")
    }
    
    // Check for IP addresses instead of domain names
    if (/https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) {
      reasons.push("Direct IP address link (suspicious)")
    }
    
    // Check for mixed characters (homograph attacks)
    if (/[а-яА-Я]/.test(lowerUrl) && /[a-zA-Z]/.test(url)) {
      reasons.push("Mixed alphabet characters (possible spoofing)")
    }
    
    // Check for @ symbols in URL (credential stuffing pattern)
    if (url.includes("@") && url.includes("http")) {
      reasons.push("URL contains @ symbol (credential stuffing)")
    }
  }
  
  return { isSuspicious: reasons.length > 0, urls, reasons }
}

/**
 * Check for money request scams
 */
function checkMoneyRequest(text: string): { detected: boolean; reasons: string[]; score: number } {
  const lowerText = text.toLowerCase()
  const reasons: string[] = []
  let score = 0
  
  // Check for direct money keywords
  for (const keyword of MONEY_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      reasons.push(`Money keyword: "${keyword}"`)
      score += 3
    }
  }
  
  // Check for specific amounts
  const amountPattern = /\$?\d+\s*(usd|eur|gbp|btc|eth)?|\$\d+/gi
  if (amountPattern.test(text)) {
    reasons.push("Specific amount mentioned")
    score += 2
  }
  
  // Check for urgency + money combination
  const hasUrgency = URGENCY_PATTERNS.some(p => lowerText.includes(p.toLowerCase()))
  const hasMoney = MONEY_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))
  
  if (hasUrgency && hasMoney) {
    reasons.push("Urgency + money request combination (high risk)")
    score += 5
  }
  
  // Check for emotional manipulation words
  const emotionalWords = ["please help", "beg you", "desperate", "emergency", "family"]
  for (const word of emotionalWords) {
    if (lowerText.includes(word)) {
      reasons.push(`Emotional manipulation: "${word}"`)
      score += 2
    }
  }
  
  return { detected: score > 0, reasons, score }
}

/**
 * Check for impersonation attempts
 */
function checkImpersonation(text: string, sender?: string): { detected: boolean; reasons: string[]; score: number } {
  const lowerText = text.toLowerCase()
  const reasons: string[] = []
  let score = 0
  
  // Check impersonation patterns
  for (const pattern of IMPERSONATION_PATTERNS) {
    if (lowerText.includes(pattern.toLowerCase())) {
      reasons.push(`Impersonation claim: "${pattern}"`)
      score += 4
    }
  }
  
  // Check for authority claims
  const authorityWords = ["official", "administrator", "moderator", "support", "staff"]
  for (const word of authorityWords) {
    if (lowerText.includes(word) && lowerText.includes("i am") || lowerText.includes("i'm")) {
      reasons.push(`Authority claim: "${word}"`)
      score += 3
    }
  }
  
  // Check for verification demands
  if (lowerText.includes("verify") && (lowerText.includes("account") || lowerText.includes("profile"))) {
    reasons.push("Demands account verification")
    score += 3
  }
  
  // Check for requests to DM privately
  if (/(dm|message)\s+me\s+privately?|contact\s+me\s+privately?|don't\s+tell/i.test(lowerText)) {
    reasons.push("Requests private communication (isolation tactic)")
    score += 4
  }
  
  return { detected: score > 0, reasons, score }
}

/**
 * Check for phishing patterns
 */
function checkPhishing(text: string): { detected: boolean; reasons: string[]; score: number } {
  const lowerText = text.toLowerCase()
  const reasons: string[] = []
  let score = 0
  
  // Check phishing keywords
  for (const keyword of PHISHING_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      reasons.push(`Phishing phrase: "${keyword}"`)
      score += 3
    }
  }
  
  // Check for login credential requests
  if (/password|login|credential|username/i.test(text)) {
    reasons.push("Requests credentials or login info")
    score += 5
  }
  
  // Check for threats about account suspension
  if (/suspended|disabled|blocked|banned\s+permanently/i.test(lowerText)) {
    reasons.push("Threatens account suspension")
    score += 4
  }
  
  return { detected: score > 0, reasons, score }
}

/**
 * Analyze a single message for fraud
 */
export function analyzeMessageForFraud(message: TelegramMessage): FraudResult | null {
  if (message.type !== "message") return null
  
  const text = getMessageText(message)
  if (!text || text.length < 5) return null
  
  const reasons: string[] = []
  const matchedPatterns: string[] = []
  let totalScore = 0
  let primaryType: FraudType = "suspicious_link"
  let maxSeverityScore = 0
  
  // Check for suspicious URLs
  const urlCheck = checkSuspiciousUrl(text)
  if (urlCheck.isSuspicious) {
    reasons.push(...urlCheck.reasons)
    matchedPatterns.push("suspicious_url")
    totalScore += urlCheck.reasons.length * 2
    
    // Check if URL + phishing keywords together
    const phishingCheck = checkPhishing(text)
    if (phishingCheck.detected) {
      primaryType = "phishing"
      totalScore += phishingCheck.score
      maxSeverityScore = Math.max(maxSeverityScore, phishingCheck.score)
      reasons.push(...phishingCheck.reasons)
    }
  }
  
  // Check for money requests
  const moneyCheck = checkMoneyRequest(text)
  if (moneyCheck.detected) {
    primaryType = "money_request"
    totalScore += moneyCheck.score
    maxSeverityScore = Math.max(maxSeverityScore, moneyCheck.score)
    reasons.push(...moneyCheck.reasons)
    matchedPatterns.push("money_request")
  }
  
  // Check for impersonation
  const impersonationCheck = checkImpersonation(text, message.from)
  if (impersonationCheck.detected) {
    // If money is also involved, keep money_request as primary
    if (primaryType !== "money_request") {
      primaryType = "impersonation"
    }
    totalScore += impersonationCheck.score
    maxSeverityScore = Math.max(maxSeverityScore, impersonationCheck.score)
    reasons.push(...impersonationCheck.reasons)
    matchedPatterns.push("impersonation")
  }
  
  // Check for urgency (adds to severity)
  const urgencyCheck = text.toLowerCase().includes("urgent") || 
                      text.toLowerCase().includes("emergency") ||
                      text.toLowerCase().includes("immediately")
  if (urgencyCheck) {
    totalScore += 2
    reasons.push("Uses urgency language")
    matchedPatterns.push("urgency")
  }
  
  // Determine severity
  let severity: "low" | "medium" | "high" | "critical"
  if (totalScore >= 10) severity = "critical"
  else if (totalScore >= 7) severity = "high"
  else if (totalScore >= 4) severity = "medium"
  else severity = "low"
  
  // Only return if score is significant
  if (totalScore < 3) return null
  
  return {
    message,
    type: primaryType,
    severity,
    score: totalScore,
    reasons,
    matchedPatterns,
  }
}

/**
 * Find all fraud patterns in messages
 */
export function findFraud(
  messages: TelegramMessage[],
  options: {
    minSeverity?: "low" | "medium" | "high" | "critical"
    maxResults?: number
    types?: FraudType[]
  } = {}
): FraudResult[] {
  const { minSeverity = "low", maxResults = 50, types } = options
  
  const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 }
  const minLevel = severityLevels[minSeverity]
  
  const results: FraudResult[] = []
  
  for (const message of messages) {
    const fraud = analyzeMessageForFraud(message)
    if (!fraud) continue
    
    // Filter by severity
    if (severityLevels[fraud.severity] < minLevel) continue
    
    // Filter by type if specified
    if (types && !types.includes(fraud.type)) continue
    
    results.push(fraud)
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score)
  
  return results.slice(0, maxResults)
}

/**
 * Get fraud statistics
 */
export function getFraudStats(messages: TelegramMessage[]) {
  const allFraud = findFraud(messages, { maxResults: 1000 })
  
  const byType: Record<FraudType, number> = {
    phishing: 0,
    money_request: 0,
    impersonation: 0,
    urgency: 0,
    suspicious_link: 0,
  }
  
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 }
  
  for (const fraud of allFraud) {
    byType[fraud.type]++
    bySeverity[fraud.severity]++
  }
  
  // Get top contributors (senders of fraudulent messages)
  const senderScores = new Map<string, { count: number; totalScore: number }>()
  for (const fraud of allFraud) {
    const sender = fraud.message.from || "Unknown"
    const existing = senderScores.get(sender) || { count: 0, totalScore: 0 }
    existing.count++
    existing.totalScore += fraud.score
    senderScores.set(sender, existing)
  }
  
  const topContributors = Array.from(senderScores.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
  
  return {
    total: allFraud.length,
    byType,
    bySeverity,
    topContributors,
  }
}

/**
 * Get fraud type description
 */
export function getFraudTypeDescription(type: FraudType): string {
  const descriptions: Record<FraudType, string> = {
    phishing: "Phishing Attempt",
    money_request: "Money Scam",
    impersonation: "Impersonation",
    urgency: "Urgency Tactics",
    suspicious_link: "Suspicious Link",
  }
  return descriptions[type]
}

/**
 * Get severity color
 */
export function getFraudSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-600 bg-red-500/10 border-red-500/20"
    case "high": return "text-orange-600 bg-orange-500/10 border-orange-500/20"
    case "medium": return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20"
    case "low": return "text-blue-600 bg-blue-500/10 border-blue-500/20"
    default: return "text-muted-foreground bg-secondary"
  }
}

/**
 * Get fraud type icon color
 */
export function getFraudTypeColor(type: FraudType): string {
  switch (type) {
    case "phishing": return "text-red-500"
    case "money_request": return "text-green-500"
    case "impersonation": return "text-purple-500"
    case "urgency": return "text-orange-500"
    case "suspicious_link": return "text-blue-500"
    default: return "text-muted-foreground"
  }
}
