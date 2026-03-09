// Puter.js AI API - Free, no API key needed, works in browser
// Load script: <script src="https://js.puter.com/v2/"></script>

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (message: string, options?: { model?: string; stream?: boolean }) => Promise<PuterResponse>
      }
    }
  }
}

interface PuterResponse {
  message?: string | { content?: string }
  index?: number
  finish_reason?: string
  usage?: unknown
  via_ai_chat_service?: boolean
  toString?: () => string
  valueOf?: () => unknown
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export class AIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AIError"
  }
}

/**
 * Load Puter.js script dynamically
 */
export function loadPuterScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Puter in server environment"))
      return
    }

    // Already loaded
    if (window.puter?.ai) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = "https://js.puter.com/v2/"
    script.async = true
    script.onload = () => {
      // Wait for puter to initialize
      const checkPuter = setInterval(() => {
        if (window.puter?.ai) {
          clearInterval(checkPuter)
          resolve()
        }
      }, 100)

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkPuter)
        if (!window.puter?.ai) {
          reject(new Error("Puter.js failed to load"))
        }
      }, 10000)
    }
    script.onerror = () => reject(new Error("Failed to load Puter.js script"))
    document.head.appendChild(script)
  })
}

/**
 * Check if Puter AI is ready
 */
export function isPuterReady(): boolean {
  return typeof window !== "undefined" && !!window.puter?.ai
}

/**
 * Send chat message via Puter AI (free, no API key)
 */
export async function sendAIMessage(
  messages: ChatMessage[],
  model = "gpt-5-nano"
): Promise<string> {
  if (!isPuterReady()) {
    await loadPuterScript()
  }

  if (!window.puter?.ai) {
    throw new AIError("AI service not available")
  }

  // Build prompt from messages
  const systemMessage = messages.find(m => m.role === "system")
  const userMessage = messages.find(m => m.role === "user")
  
  const prompt = systemMessage 
    ? `${systemMessage.content}\n\nQuestion: ${userMessage?.content || ""}`
    : userMessage?.content || ""

  try {
    const response = await window.puter.ai.chat(prompt, { model })
    // Puter returns an object with message property
    if (typeof response === "object" && response !== null) {
      // Handle different response formats
      if (typeof response.message === "string") {
        return response.message
      }
      if (response.message && typeof response.message === "object" && "content" in response.message) {
        return (response.message as { content?: string }).content || ""
      }
      if (response.toString && typeof response.toString === "function") {
        return response.toString()
      }
      // Fallback: stringify and extract
      const str = JSON.stringify(response)
      return str.slice(0, 500) // Prevent huge error messages
    }
    return String(response)
  } catch (err) {
    throw new AIError(err instanceof Error ? err.message : "Failed to get AI response")
  }
}

/**
 * Build context from Telegram messages for the AI
 */
export function buildChatContext(
  messages: { from?: string; text?: string; date: string }[],
  question: string
): ChatMessage[] {
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
5. Always reference message dates when mentioning specific messages

Answer the user's question based on the context above.`

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
  // Extract keywords (simple approach)
  const keywords = question
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !["what", "when", "where", "which", "find", "tell", "about", "from", "this", "that", "with", "have", "sent", "they", "them", "their", "there", "then", "than"].includes(w))
  
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
