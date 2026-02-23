import { NextRequest, NextResponse } from "next/server"

const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Manipulation detection scoring rules
const MANIPULATION_SCORING_RULES = `You are a psychological manipulation and emotional abuse detection expert. Analyze this message for manipulative patterns:

DETECTION CRITERIA:
- GASLIGHTING (Score 0.7-1.0): "You're imagining things", "That never happened", "You're too sensitive", "You're crazy", denying reality, making someone doubt their memory/perception
- GUILT TRIPPING (Score 0.7-1.0): "After all I've done for you", "You owe me", "I sacrificed everything", "You never appreciate me", "You make me suffer"
- PASSIVE AGGRESSIVE (Score 0.5-0.8): Sarcasm, backhanded compliments, "I'm fine" when clearly not, silent treatment, "Whatever", indirect hostility
- CONTROLLING (Score 0.7-1.0): "You can't do that", "Who gave you permission", "You need my approval", "Don't talk to them", isolating commands
- DISMISSIVE/INVALIDATING (Score 0.5-0.8): "It's not a big deal", "You're overreacting", "Others have it worse", "Stop being dramatic", minimizing feelings
- PLAYING VICTIM (Score 0.6-0.9): "Everyone is against me", "I'm always the bad guy", "Nobody understands me", "I can't do anything right"

SEVERITY:
- CRITICAL (0.85-1.0): Clear, harmful manipulation requiring intervention
- SEVERE (0.7-0.84): Strong manipulative patterns present
- MODERATE (0.5-0.69): Some concerning language, possible manipulation
- MILD (0.3-0.49): Slight manipulation hints, worth noting
- NONE (0.0-0.29): Normal conversation

RESPONSE FORMAT:
Return ONLY JSON: {"manipulation": true|false, "types": ["type1", "type2"], "severity": "none|mild|moderate|severe|critical", "score": 0.XX, "reason": "brief explanation"}

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
          const prompt = `${MANIPULATION_SCORING_RULES}\n"${msg.text}"`

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
              manipulation: false,
              types: [],
              severity: "none",
              score: 0,
              error: `API: ${response.status}`,
            }
          }

          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ""

          let result
          try {
            const jsonMatch = content.match(/\{[^}]+\}/)
            result = jsonMatch ? JSON.parse(jsonMatch[0]) : { manipulation: false, types: [], severity: "none", score: 0, reason: "" }
          } catch {
            result = { manipulation: false, types: [], severity: "none", score: 0, reason: "Parse error" }
          }

          return {
            id: msg.id,
            message: {
              id: msg.id,
              text: msg.text,
              from: msg.from || "Unknown",
              date: msg.date || new Date().toISOString(),
            },
            manipulation: result.manipulation || false,
            types: result.types || [],
            severity: result.severity || "none",
            score: Math.max(0, Math.min(1, result.score || 0)),
            reasons: [result.reason || ""],
          }
        } catch (error) {
          return {
            id: msg.id,
            message: { id: msg.id, text: msg.text, from: msg.from || "Unknown", date: new Date().toISOString() },
            manipulation: false,
            types: [],
            severity: "none",
            score: 0,
            error: true,
          }
        }
      })
    )

    // Calculate stats
    const manipResults = results.filter(r => r.manipulation)
    const stats = {
      total: results.length,
      manipulation: manipResults.length,
      byType: {
        gaslighting: manipResults.filter(r => r.types.includes("gaslighting")).length,
        guilt_tripping: manipResults.filter(r => r.types.includes("guilt_tripping")).length,
        passive_aggressive: manipResults.filter(r => r.types.includes("passive_aggressive")).length,
        controlling: manipResults.filter(r => r.types.includes("controlling")).length,
        dismissive: manipResults.filter(r => r.types.includes("dismissive")).length,
        victimhood: manipResults.filter(r => r.types.includes("victimhood")).length,
      },
      bySeverity: {
        critical: manipResults.filter(r => r.severity === "critical").length,
        severe: manipResults.filter(r => r.severity === "severe").length,
        moderate: manipResults.filter(r => r.severity === "moderate").length,
        mild: manipResults.filter(r => r.severity === "mild").length,
      },
      topContributors: calculateTopContributors(manipResults),
    }

    return NextResponse.json({ results, stats })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}

function calculateTopContributors(manipulations: any[]) {
  const contributorMap = new Map<string, { count: number; score: number }>()
  
  for (const m of manipulations) {
    const from = m.message?.from || "Unknown"
    const existing = contributorMap.get(from)
    if (existing) {
      existing.count += 1
      existing.score += m.score
    } else {
      contributorMap.set(from, { count: 1, score: m.score })
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
        messages: [{ role: "user", content: "Test manipulation detection" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "Manipulation detection API ready" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
