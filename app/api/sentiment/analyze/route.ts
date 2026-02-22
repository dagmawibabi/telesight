import { NextRequest, NextResponse } from "next/server"

// Hugging Face Inference API endpoint for sentiment analysis
const HF_INFERENCE_API = "https://api-inference.huggingface.co/models"

// Recommended models for sentiment analysis
const SENTIMENT_MODELS = {
  // Use simple text classification model
  sentiment: "distilbert-base-uncased-finetuned-sst-2-english",
  // Emotion detection
  emotion: "j-hartmann/emotion-english-distilroberta-base",
  // Toxicity detection
  toxicity: "unitary/toxic-bert",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, token, type = "sentiment" } = body

    if (!token) {
      return NextResponse.json(
        { error: "Hugging Face token required" },
        { status: 401 }
      )
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      )
    }

    const model = SENTIMENT_MODELS[type as keyof typeof SENTIMENT_MODELS] || SENTIMENT_MODELS.sentiment

    // Process messages in batches to avoid rate limits
    const results = await Promise.all(
      messages.map(async (msg: { text: string; id: string }) => {
        try {
          const response = await fetch(`${HF_INFERENCE_API}/${model}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: msg.text }),
          })

          if (!response.ok) {
            // If model is loading, return a default response
            if (response.status === 503) {
              return {
                id: msg.id,
                text: msg.text,
                sentiment: "neutral",
                score: 0.5,
                loading: true,
              }
            }

            if (response.status === 401) {
              return {
                id: msg.id,
                text: msg.text,
                sentiment: "neutral",
                score: 0.5,
                error: "Invalid token. Please check your Hugging Face access token.",
              }
            }

            if (response.status === 403) {
              return {
                id: msg.id,
                text: msg.text,
                sentiment: "neutral",
                score: 0.5,
                error: "Token doesn't have access to this model. Please check your token permissions.",
              }
            }

            if (response.status === 410) {
              return {
                id: msg.id,
                text: msg.text,
                sentiment: "neutral",
                score: 0.5,
                error: "Model is deprecated or unavailable. Please check the Hugging Face model hub for alternatives.",
              }
            }

            throw new Error(`HF API error: ${response.status}`)
          }

          const data = await response.json()
          
          // Parse different model outputs
          let sentiment = "neutral"
          let score = 0.5

          if (Array.isArray(data) && data.length > 0) {
            // Standard classification output
            const predictions = data[0]
            if (Array.isArray(predictions)) {
              // Multi-class output
              const topPrediction = predictions.reduce((a, b) => 
                a.score > b.score ? a : b
              )
              sentiment = topPrediction.label.toLowerCase()
              score = topPrediction.score
            } else {
              // Single output
              sentiment = predictions.label?.toLowerCase() || "neutral"
              score = predictions.score || 0.5
            }
          }

          return {
            id: msg.id,
            text: msg.text,
            sentiment,
            score,
          }
        } catch (error) {
          console.error(`Error analyzing message ${msg.id}:`, error)
          return {
            id: msg.id,
            text: msg.text,
            sentiment: "neutral",
            score: 0.5,
            error: true,
          }
        }
      })
    )

    // Calculate aggregated statistics
    const stats = {
      total: results.length,
      positive: results.filter(r => r.sentiment === "positive" || r.score > 0.6).length,
      negative: results.filter(r => r.sentiment === "negative" || r.score < 0.4).length,
      neutral: results.filter(r => r.sentiment === "neutral" || (r.score >= 0.4 && r.score <= 0.6)).length,
      avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    }

    return NextResponse.json({ results, stats })
  } catch (error) {
    console.error("Sentiment analysis error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    )
  }
}

// Health check endpoint to verify model availability
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const modelType = searchParams.get("model") || "sentiment"

  if (!token) {
    return NextResponse.json(
      { error: "Token required" },
      { status: 401 }
    )
  }

  const model = SENTIMENT_MODELS[modelType as keyof typeof SENTIMENT_MODELS] || SENTIMENT_MODELS.sentiment

  try {
    // Test the model with a simple request
    const response = await fetch(`${HF_INFERENCE_API}/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: "This is a test." }),
    })

    if (response.status === 503) {
      return NextResponse.json({
        status: "loading",
        message: "Model is currently loading, please try again in a few seconds",
      })
    }

    // Handle 410 Gone - model deprecated/unavailable
    if (response.status === 410) {
      return NextResponse.json({
        status: "ready",
        message: "Token is valid (model endpoint deprecated but token works)",
        model,
      })
    }

    if (response.ok) {
      return NextResponse.json({
        status: "ready",
        message: "Model is available",
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
