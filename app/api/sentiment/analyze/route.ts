import { NextRequest, NextResponse } from "next/server"

// Hugging Face Inference Providers endpoint (for gpt-oss models)
const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Scoring rules for sentiment analysis
const SENTIMENT_SCORING_RULES = `You are a sentiment analysis expert. Analyze the message and rate it based on these rules:

SCORING CRITERIA:
- Score 0.0-0.3 (NEGATIVE): Contains anger, frustration, hate, annoyance, complaints, negative words, multiple exclamation marks, ALL CAPS shouting
- Score 0.4-0.6 (NEUTRAL): Normal conversation, questions, factual statements, mixed emotions, general chat
- Score 0.7-1.0 (POSITIVE): Contains happiness, excitement, gratitude, compliments, positive words, good emojis

RESPONSE FORMAT:
Return ONLY JSON: {"sentiment": "positive|negative|neutral", "score": 0.XX, "reason": "brief"}

Analyze this:`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, token } = body

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

    // Process messages using prompt-based analysis
    const results = await Promise.all(
      messages.map(async (msg: { text: string; id: string }) => {
        try {
          const prompt = `${SENTIMENT_SCORING_RULES}\n"${msg.text}"`

          const response = await fetch(HF_INFERENCE_API, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-oss-120b:cerebras",
              messages: [
                { role: "system", content: "Return only valid JSON." },
                { role: "user", content: prompt }
              ],
              max_tokens: 60,
              temperature: 0.1,
            }),
          })

          if (!response.ok) {
            return { id: msg.id, text: msg.text, sentiment: "neutral", score: 0.5, error: `API: ${response.status}` }
          }

          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ""

          // Parse JSON from response
          let result
          try {
            const jsonMatch = content.match(/\{[^}]+\}/)
            result = jsonMatch ? JSON.parse(jsonMatch[0]) : { sentiment: "neutral", score: 0.5, reason: "Parse error" }
          } catch {
            result = { sentiment: "neutral", score: 0.5, reason: "Parse error" }
          }

          return {
            id: msg.id,
            text: msg.text,
            sentiment: result.sentiment || "neutral",
            score: Math.max(0, Math.min(1, result.score || 0.5)),
            reason: result.reason || "",
          }
        } catch (error) {
          return { id: msg.id, text: msg.text, sentiment: "neutral", score: 0.5, error: true }
        }
      })
    )

    const stats = {
      total: results.length,
      positive: results.filter(r => r.sentiment === "positive" || r.score > 0.6).length,
      negative: results.filter(r => r.sentiment === "negative" || r.score < 0.4).length,
      neutral: results.filter(r => r.sentiment === "neutral" || (r.score >= 0.4 && r.score <= 0.6)).length,
      avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    }

    return NextResponse.json({ results, stats })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) return NextResponse.json({ error: "Token required" }, { status: 401 })

  try {
    const response = await fetch(HF_INFERENCE_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:cerebras",
        messages: [{ role: "user", content: "Test" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "API ready with scoring rules" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
