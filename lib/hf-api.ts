// Hugging Face Inference API integration
const HF_API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf"

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
 * Send chat message to Hugging Face Inference API
 */
export async function sendHFMessage(
  token: string,
  messages: HFMessage[],
  maxTokens = 512
): Promise<string> {
  // Format messages for Llama 2 chat format
  const prompt = formatLlama2Chat(messages)

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false,
      },
      options: {
        wait_for_model: true,
        use_cache: false,
      },
    }),
  })

  if (!response.ok) {
    const isRateLimit = response.status === 429
    const errorText = await response.text().catch(() => "Unknown error")
    throw new HFAPIError(
      `API Error: ${response.status} - ${errorText}`,
      response.status,
      isRateLimit
    )
  }

  const result = await response.json()
  
  // Handle different response formats
  if (Array.isArray(result) && result[0]?.generated_text) {
    return result[0].generated_text.trim()
  }
  
  if (result.generated_text) {
    return result.generated_text.trim()
  }

  throw new HFAPIError("Unexpected response format from API")
}

/**
 * Format messages for Llama 2 chat format
 * Llama 2 uses: <s>[INST] <<SYS>>\n{system}\n<</SYS>>\n\n{user} [/INST] {assistant} </s>
 */
function formatLlama2Chat(messages: HFMessage[]): string {
  const systemMessage = messages.find(m => m.role === "system")
  const chatMessages = messages.filter(m => m.role !== "system")
  
  let prompt = "<s>"
  
  // Add system message if present
  if (systemMessage) {
    prompt += `[INST] <<SYS>>\n${systemMessage.content}\n<</SYS>>\n\n`
  } else {
    prompt += `[INST] `
  }
  
  // Add conversation
  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i]
    
    if (msg.role === "user") {
      if (i > 0) {
        // Continue conversation after first response
        prompt += `<s>[INST] ${msg.content} [/INST]`
      } else {
        prompt += `${msg.content} [/INST]`
      }
    } else if (msg.role === "assistant") {
      prompt += ` ${msg.content} </s>`
    }
  }
  
  return prompt
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
 * Check if model is available/warm
 */
export async function checkModelStatus(token: string): Promise<boolean> {
  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: "<s>[INST] Hi [/INST]",
        parameters: { max_new_tokens: 5 },
      }),
    })
    
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get Hugging Face token from localStorage
 */
export function getHFToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("hf_token")
}
