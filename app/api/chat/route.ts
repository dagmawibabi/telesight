import { NextRequest, NextResponse } from "next/server"

// Hugging Face Inference Providers endpoint (for gpt-oss models)
const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Recommended models for chat - using gpt-oss-120b via Inference Providers
const CHAT_MODELS = {
  // gpt-oss-120b via Cerebras (fastest)
  conversational: "openai/gpt-oss-120b:cerebras",
  // gpt-oss-120b via Fireworks AI
  flan: "openai/gpt-oss-120b:fireworks-ai",
  // gpt-oss-120b via Together AI
  llama: "openai/gpt-oss-120b:together",
}

// Build a context-aware prompt from message history
function buildPrompt(messages: string[], currentQuestion: string): string {
  const context = messages.slice(-10).join("\n") // Last 10 messages for context
  return `Context from chat history:\n${context}\n\nUser question: ${currentQuestion}\n\nProvide a helpful, concise response based on the context above.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, question, token, model = "flan" } = body

    if (!token) {
      return NextResponse.json(
        { error: "Hugging Face token required" },
        { status: 401 }
      )
    }

    if (!question) {
      return NextResponse.json(
        { error: "Question required" },
        { status: 400 }
      )
    }

    const selectedModel = CHAT_MODELS[model as keyof typeof CHAT_MODELS] || CHAT_MODELS.flan

    // Build messages array for chat completions
    const chatMessages = messages?.length
      ? [
          { role: "system", content: "You are a helpful assistant analyzing Telegram chat data." },
          ...messages.map((msg: string) => ({ role: "user", content: msg })),
          { role: "user", content: question }
        ]
      : [
          { role: "system", content: "You are a helpful assistant analyzing Telegram chat data." },
          { role: "user", content: question }
        ]

    try {
      const response = await fetch(HF_INFERENCE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatMessages,
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.9,
        }),
      })

      if (!response.ok) {
        // Handle model loading state
        if (response.status === 503) {
          return NextResponse.json({
            response: "The AI model is warming up, please try again in a few seconds...",
            loading: true,
            model: selectedModel,
          })
        }

        // Handle rate limiting
        if (response.status === 429) {
          return NextResponse.json(
            { error: "Rate limit exceeded. Please wait a moment before sending another message." },
            { status: 429 }
          )
        }

        // Handle 402 - payment required (Pro account needed)
        if (response.status === 402) {
          return NextResponse.json({
            response: "This model requires a Hugging Face Pro subscription. Please upgrade your account or use a different model.",
            error: "Payment required (402)",
            fallback: true,
          })
        }

        throw new Error(`HF API error: ${response.status}`)
      }

      const data = await response.json()

      // Parse OpenAI-compatible response
      let reply = ""
      if (data.choices && data.choices.length > 0) {
        reply = data.choices[0].message?.content || ""
      }

      // Fallback response if empty
      if (!reply) {
        reply = "I'm not sure how to answer that based on the available information."
      }

      return NextResponse.json({
        response: reply,
        model: selectedModel,
      })
    } catch (error) {
      console.error("Chat API error:", error)
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : "Chat request failed",
          fallback: true,
          response: "I'm having trouble connecting to the AI service. Please check your token and try again."
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    )
  }
}

// Health check for chat models
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const modelType = searchParams.get("model") || "flan"

  if (!token) {
    return NextResponse.json(
      { error: "Token required" },
      { status: 401 }
    )
  }

  const model = CHAT_MODELS[modelType as keyof typeof CHAT_MODELS] || CHAT_MODELS.flan

  try {
    const response = await fetch(HF_INFERENCE_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) {
      return NextResponse.json({
        status: "loading",
        message: "Model is currently loading, please try again in a few seconds",
        model,
      })
    }

    // Handle 402 - payment required
    if (response.status === 402) {
      return NextResponse.json({
        status: "pro_required",
        message: "Hugging Face Pro subscription required for this model",
        model,
      })
    }

    if (response.ok) {
      return NextResponse.json({
        status: "ready",
        message: "Chat model is available",
        model,
      })
    }

    return NextResponse.json(
      { status: "error", message: `API error: ${response.status}` },
      { status: response.status }
    )
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
