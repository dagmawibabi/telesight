import { NextRequest, NextResponse } from "next/server"

const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Fraud detection scoring rules
const FRAUD_SCORING_RULES = `You are a fraud and scam detection expert. Analyze this message for:

DETECTION CRITERIA:
- PHISHING (Score 0.7-1.0): Contains suspicious links, fake login pages, requests for passwords/credentials, "verify your account", "click here to confirm"
- MONEY SCAM (Score 0.7-1.0): Urgent money requests, "send me $500", "I need help financially", "pay me urgently", advance fee scams, lottery/inheritance scams
- IMPERSONATION (Score 0.7-1.0): Pretending to be admin, "I'm the CEO", fake authority, "this is official", "on behalf of the team"
- URGENCY TACTICS (Score 0.5-0.7): Excessive urgency, "act now", "limited time", "don't tell anyone", "keep this secret"
- SUSPICIOUS LINKS (Score 0.5-0.7): Shortened URLs, bit.ly, suspicious domains, mismatched links

SCORING:
- 0.0-0.3: SAFE - Normal conversation, no suspicious content
- 0.4-0.6: MILD - Some concerns but not clearly fraudulent
- 0.7-0.85: MODERATE - Likely fraudulent, specific warning signs present
- 0.86-1.0: CRITICAL - Clear fraud/scam indicators

RESPONSE FORMAT:
Return ONLY JSON: {"fraudType": "phishing|money_scam|impersonation|urgency|suspicious|none", "score": 0.XX, "reason": "brief explanation", "severity": "safe|mild|moderate|critical"}

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
      messages.map(async (msg: { text: string; id: string; from?: string }) => {
        try {
          const prompt = `${FRAUD_SCORING_RULES}\n"${msg.text}"`

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
              text: msg.text,
              from: msg.from,
              fraudType: "none",
              score: 0,
              severity: "safe",
              error: `API: ${response.status}`,
            }
          }

          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ""

          let result
          try {
            const jsonMatch = content.match(/\{[^}]+\}/)
            result = jsonMatch ? JSON.parse(jsonMatch[0]) : { fraudType: "none", score: 0, reason: "Parse error", severity: "safe" }
          } catch {
            result = { fraudType: "none", score: 0, reason: "Parse error", severity: "safe" }
          }

          return {
            id: msg.id,
            text: msg.text,
            from: msg.from || "Unknown",
            fraudType: result.fraudType || "none",
            score: Math.max(0, Math.min(1, result.score || 0)),
            severity: result.severity || "safe",
            reason: result.reason || "",
          }
        } catch (error) {
          return { id: msg.id, text: msg.text, from: msg.from || "Unknown", fraudType: "none", score: 0, severity: "safe", error: true }
        }
      })
    )

    // Calculate stats
    const fraudResults = results.filter(r => r.score > 0.4)
    const stats = {
      total: results.length,
      fraudDetected: fraudResults.length,
      phishing: fraudResults.filter(r => r.fraudType === "phishing").length,
      moneyScams: fraudResults.filter(r => r.fraudType === "money_scam").length,
      impersonation: fraudResults.filter(r => r.fraudType === "impersonation").length,
      bySeverity: {
        critical: results.filter(r => r.severity === "critical").length,
        moderate: results.filter(r => r.severity === "moderate").length,
        mild: results.filter(r => r.severity === "mild").length,
        safe: results.filter(r => r.severity === "safe").length,
      }
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
        messages: [{ role: "user", content: "Test fraud detection" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "Fraud detection API ready" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
