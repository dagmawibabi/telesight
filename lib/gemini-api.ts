// Google Gemini API - works directly in browser (no CORS issues)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent"

export interface HFMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface HFChatResponse {
  generated_text: string
}

export class HFAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRateLimit = false
  ) {
    super(message)
    this.name = "HFAPIError"
  }
}

/**
 * Send chat message to Gemini API (direct from browser)
 */
export async function sendHFMessage(
  token: string,
  messages: HFMessage[],
  maxTokens = 512
): Promise<string> {
  // Build prompt from messages
  const systemMessage = messages.find(m => m.role === "system")
  const userMessage = messages.find(m => m.role === "user")
  
  const prompt = systemMessage 
    ? `${systemMessage.content}\n\nQuestion: ${userMessage?.content || ""}`
    : userMessage?.content || ""

  const response = await fetch(`${GEMINI_API_URL}?key=${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      }
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }))
    const isRateLimit = response.status === 429
    throw new HFAPIError(
      errorData.error?.message || `API Error: ${response.status}`,
      response.status,
      isRateLimit
    )
  }

  const result = await response.json()
  
  if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text.trim()
  }

  throw new HFAPIError("Unexpected response format from API")
}

/**
 * Build context from Telegram messages for the AI
 */
export function buildChatContext(
  messages: { from?: string; text?: string; date: string }[],
  question: string
): HFMessage[] {
  // Get relevant messages (search for keywords from question)
  const relevant = findRelevantMessages(messages, question)
  
  // Build summary of conversation
  const summary = buildConversationSummary(relevant)
  
  const systemPrompt = `You are an AI assistant helping analyze Telegram chat exports. You have access to the following conversation context:

${summary}

When answering:
1. Be specific about who said what and when
2. Quote relevant message text when possible
3. If you can't find the information, say so clearly
4. Help the user find specific messages or understand conversation patterns
5. Always reference message IDs or dates when mentioning specific messages`

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ]
}

/**
 * Find relevant messages based on keywords from the question
 */
function findRelevantMessages(
  messages: { from?: string; text?: string; date: string }[],
  question: string
): { from?: string; text?: string; date: string; id?: number }[] {
  // Extract keywords (simple approach - could be improved with NLP)
  const keywords = question
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !["what", "when", "where", "which", "find", "tell", "about", "from", "this", "that", "with", "have", "sent"].includes(w))
  
  // Score messages by keyword matches
  const scored = messages
    .filter(m => m.text)
    .map((m, idx) => {
      const text = m.text!.toLowerCase()
      let score = 0
      
      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 1
      }
      
      return { ...m, score, id: idx + 1 }
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20) // Top 20 most relevant
  
  return scored
}

/**
 * Build a text summary of conversation for context
 */
function buildConversationSummary(
  messages: { from?: string; text?: string; date: string; id?: number }[]
): string {
  if (messages.length === 0) {
    return "No specific messages found matching the query. The conversation has messages but none appear directly relevant."
  }

  const summary = messages
    .slice(0, 15) // Limit to 15 messages for token efficiency
    .map(m => {
      const date = new Date(m.date).toLocaleDateString()
      const sender = m.from || "Unknown"
      const text = m.text?.slice(0, 200) || "" // Truncate long messages
      const truncated = m.text && m.text.length > 200 ? "..." : ""
      return `[${date}] ${sender}: "${text}${truncated}"`
    })
    .join("\n")

  return `Relevant Messages:\n${summary}`
}

/**
 * Check if Gemini API is working
 */
export async function checkModelStatus(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
      }),
    })
    
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get API token from localStorage
 */
export function getHFToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("hf_token")
}
