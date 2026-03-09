import { NextRequest, NextResponse } from "next/server"

const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// User behavior analysis scoring rules
const BEHAVIOR_PROFILE_RULES = `You are a user behavior analysis expert. Analyze this user's messages and create a behavioral profile.

ANALYZE FOR:
1. CONFLICT TENDENCY: Does this user often argue, disagree, or create conflicts? (Score 0-1)
2. MANIPULATION PATTERNS: Do they use guilt-tripping, gaslighting, passive-aggressive language? (Score 0-1)
3. POSITIVITY: Are their messages generally positive, supportive, helpful? (Score 0-1)
4. DOMINANCE: Do they dominate conversations, interrupt, talk over others? (Score 0-1)
5. EMOTIONAL_STABILITY: Are they calm or volatile/escalating? (Score 0-1, higher = more stable)

OVERALL RISK ASSESSMENT:
- LOW (0-0.3): Healthy communication patterns
- MEDIUM (0.3-0.6): Some concerning patterns
- HIGH (0.6-1.0): Problematic behavior patterns

RESPONSE FORMAT:
Return ONLY JSON: {"conflictTendency": 0.XX, "manipulation": 0.XX, "positivity": 0.XX, "dominance": 0.XX, "emotionalStability": 0.XX, "overallRisk": "low|medium|high", "summary": "brief behavioral description", "topTraits": ["trait1", "trait2", "trait3"]}

Analyze this user's messages:`

interface UserMessages {
  user: string
  messages: { id: string; text: string; date: string }[]
}

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

    // Group messages by user
    const userMap = new Map<string, { id: string; text: string; date: string }[]>()
    
    for (const msg of messages) {
      const from = msg.from || "Unknown"
      if (!userMap.has(from)) {
        userMap.set(from, [])
      }
      userMap.get(from)!.push({
        id: msg.id.toString(),
        text: msg.text,
        date: msg.date || new Date().toISOString(),
      })
    }

    // Analyze each user
    const profiles = await Promise.all(
      Array.from(userMap.entries()).map(async ([user, userMessages]) => {
        try {
          // Limit to last 50 messages per user for analysis
          const recentMessages = userMessages.slice(-50)
          const messageTexts = recentMessages.map(m => `"${m.text}"`).join("\n")
          
          const prompt = `${BEHAVIOR_PROFILE_RULES}\nUser: ${user}\nMessages:\n${messageTexts}`

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
              max_tokens: 150,
              temperature: 0.2,
            }),
          })

          let profile = {
            conflictTendency: 0,
            manipulation: 0,
            positivity: 0.5,
            dominance: 0,
            emotionalStability: 0.5,
            overallRisk: "low",
            summary: "Neutral communication style",
            topTraits: ["neutral"],
          }

          if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || ""
            
            try {
              const jsonMatch = content.match(/\{[^}]+\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                profile = {
                  conflictTendency: Math.max(0, Math.min(1, parsed.conflictTendency || 0)),
                  manipulation: Math.max(0, Math.min(1, parsed.manipulation || 0)),
                  positivity: Math.max(0, Math.min(1, parsed.positivity || 0.5)),
                  dominance: Math.max(0, Math.min(1, parsed.dominance || 0)),
                  emotionalStability: Math.max(0, Math.min(1, parsed.emotionalStability || 0.5)),
                  overallRisk: parsed.overallRisk || "low",
                  summary: parsed.summary || "Neutral communication style",
                  topTraits: parsed.topTraits || ["neutral"],
                }
              }
            } catch {
              // Use default profile
            }
          }

          // Calculate additional stats
          const totalMessages = userMessages.length
          const avgMessageLength = userMessages.reduce((sum, m) => sum + m.text.length, 0) / totalMessages
          
          // Activity hours
          const hours = userMessages.map(m => new Date(m.date).getHours())
          const mostActiveHour = mode(hours)
          
          return {
            user,
            totalMessages,
            avgMessageLength: Math.round(avgMessageLength),
            mostActiveHour,
            ...profile,
            messages: recentMessages.slice(-5), // Include last 5 for reference
          }
        } catch (error) {
          return {
            user,
            totalMessages: userMessages.length,
            avgMessageLength: 0,
            mostActiveHour: 0,
            conflictTendency: 0,
            manipulation: 0,
            positivity: 0.5,
            dominance: 0,
            emotionalStability: 0.5,
            overallRisk: "low",
            summary: "Error analyzing user",
            topTraits: ["unknown"],
            messages: [],
          }
        }
      })
    )

    // Sort by overall risk (high to low)
    const sortedProfiles = profiles.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 }
      return riskOrder[b.overallRisk as keyof typeof riskOrder] - riskOrder[a.overallRisk as keyof typeof riskOrder]
    })

    return NextResponse.json({ 
      profiles: sortedProfiles,
      totalUsers: profiles.length,
      highRiskUsers: profiles.filter(p => p.overallRisk === "high").length,
      mediumRiskUsers: profiles.filter(p => p.overallRisk === "medium").length,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}

function mode(arr: number[]): number {
  const frequency = new Map<number, number>()
  let maxCount = 0
  let maxValue = arr[0]
  
  for (const num of arr) {
    const count = (frequency.get(num) || 0) + 1
    frequency.set(num, count)
    if (count > maxCount) {
      maxCount = count
      maxValue = num
    }
  }
  
  return maxValue
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
        messages: [{ role: "user", content: "Test user profiles" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "User profiles API ready" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
