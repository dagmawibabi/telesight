import { NextRequest, NextResponse } from "next/server"

// Hugging Face Inference API
const HF_INFERENCE_API = "https://api-inference.huggingface.co/models"

// Recommended models for chat/conversation
const CHAT_MODELS = {
  // OpenAI GPT-OSS 20B - open weight model
  conversational: "openai/gpt-oss-20b",
  // OpenAI GPT-OSS 20B
  flan: "openai/gpt-oss-20b",
  // OpenAI GPT-OSS 20B
  llama: "openai/gpt-oss-20b",
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

    // Build prompt with context
    const prompt = messages?.length 
      ? buildPrompt(messages, question)
      : question

    try {
      const response = await fetch(`${HF_INFERENCE_API}/${selectedModel}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          inputs: prompt,
          parameters: {
            max_length: 512,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
          },
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

        // Handle 410 - model deprecated/unavailable
        if (response.status === 410) {
          return NextResponse.json({
            response: "The AI model is currently unavailable. The model may have been deprecated. Please try a different model or check the Hugging Face model hub.",
            error: "Model deprecated (410)",
            fallback: true,
          })
        }

        throw new Error(`HF API error: ${response.status}`)
      }

      const data = await response.json()

      // Parse different model response formats
      let reply = ""
      if (Array.isArray(data) && data.length > 0) {
        reply = data[0].generated_text || data[0].summary_text || ""
      } else if (typeof data === "object") {
        reply = data.generated_text || data.summary_text || data.answer || JSON.stringify(data)
      }

      // Clean up the response - remove the prompt echo if present
      reply = reply.replace(prompt, "").trim()

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
    const response = await fetch(`${HF_INFERENCE_API}/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        inputs: "Hello",
        parameters: { max_length: 10 }
      }),
    })

    if (response.status === 503) {
      return NextResponse.json({
        status: "loading",
        message: "Model is currently loading, please try again in a few seconds",
        model,
      })
    }

    // Handle 410 - model deprecated
    if (response.status === 410) {
      return NextResponse.json({
        status: "ready",
        message: "Token is valid (model may be deprecated)",
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
