import { NextRequest, NextResponse } from "next/server"

const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Conflict detection scoring rules
const CONFLICT_SCORING_RULES = `You are a conflict and argument detection expert. Analyze this message for hostile, aggressive, or confrontational language:

DETECTION CRITERIA:
- HIGH CONFLICT (Score 0.7-1.0): Direct insults, name-calling, aggressive threats, hostile attacks, "you're an idiot", "shut up", "get lost", profanity directed at person
- MEDIUM CONFLICT (Score 0.4-0.6): Disagreement with frustration, "I disagree strongly", "that's wrong", "you don't understand", defensive tone, passive-aggressive
- LOW CONFLICT (Score 0.2-0.3): Mild disagreement, debate, "I think differently", factual correction without hostility
- NO CONFLICT (Score 0.0-0.1): Normal conversation, agreement, questions, neutral statements

INDICATORS:
- All caps shouting
- Multiple exclamation marks (anger)
- Words: hate, stupid, idiot, dumb, moron, loser, ridiculous, absurd, terrible, worst
- Confrontational: "you always", "you never", "why can't you", "this is your fault"

RESPONSE FORMAT:
Return ONLY JSON: {"conflict": true|false, "intensity": "none|low|medium|high", "score": 0.XX, "reason": "brief explanation", "keywords": ["word1", "word2"]}

Analyze this message:`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, token } = body

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 })
    }

    const results = await Promise.all(
      messages.map(async (msg: { text: string; id: string; from?: string; date?: string }) => {
        try {
          const prompt = `${CONFLICT_SCORING_RULES}\n"${msg.text}"`

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
              max_tokens: 80,
              temperature: 0.1,
            }),
          })

          if (!response.ok) {
            return {
              id: msg.id,
              message: { id: msg.id, text: msg.text, from: msg.from || "Unknown", date: msg.date || new Date().toISOString() },
              conflict: false,
              intensity: "none",
              score: 0,
              error: `API: ${response.status}`,
            }
          }

          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ""

          let result
          try {
            const jsonMatch = content.match(/\{[^}]+\}/)
            result = jsonMatch ? JSON.parse(jsonMatch[0]) : { conflict: false, intensity: "none", score: 0, reason: "", keywords: [] }
          } catch {
            result = { conflict: false, intensity: "none", score: 0, reason: "Parse error", keywords: [] }
          }

          return {
            id: msg.id,
            message: {
              id: msg.id,
              text: msg.text,
              from: msg.from || "Unknown",
              date: msg.date || new Date().toISOString(),
            },
            conflict: result.conflict || false,
            intensity: result.intensity || "none",
            score: Math.max(0, Math.min(1, result.score || 0)),
            reasons: result.keywords || [result.reason || ""],
          }
        } catch (error) {
          return {
            id: msg.id,
            message: { id: msg.id, text: msg.text, from: msg.from || "Unknown", date: new Date().toISOString() },
            conflict: false,
            intensity: "none",
            score: 0,
            error: true,
          }
        }
      })
    )

    // Calculate stats
    const conflictResults = results.filter(r => r.conflict)
    const stats = {
      total: results.length,
      conflicts: conflictResults.length,
      byIntensity: {
        high: conflictResults.filter(r => r.intensity === "high").length,
        medium: conflictResults.filter(r => r.intensity === "medium").length,
        low: conflictResults.filter(r => r.intensity === "low").length,
      },
      topContributors: calculateTopContributors(conflictResults),
    }

    return NextResponse.json({ results, stats })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}

function calculateTopContributors(conflicts: any[]) {
  const contributorMap = new Map<string, { count: number; score: number }>()
  
  for (const c of conflicts) {
    const from = c.message?.from || "Unknown"
    const existing = contributorMap.get(from)
    if (existing) {
      existing.count += 1
      existing.score += c.score
    } else {
      contributorMap.set(from, { count: 1, score: c.score })
    }
  }
  
  return Array.from(contributorMap.entries())
    .map(([name, data]) => ({ name, count: data.count, score: data.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
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
        messages: [{ role: "user", content: "Test conflict detection" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "Conflict detection API ready" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
