import { NextRequest, NextResponse } from "next/server"

const HF_INFERENCE_API = "https://router.huggingface.co/v1/chat/completions"

// Report generation prompt
const REPORT_GENERATION_RULES = `You are a professional report writer. Create a comprehensive analysis report based on the provided data.

REPORT STRUCTURE:
1. EXECUTIVE SUMMARY: Brief overview of findings
2. KEY STATISTICS: Total messages, conflicts, manipulations, frauds
3. TOP CONCERNS: Most serious issues found
4. USER PROFILES: High-risk users summary
5. RECOMMENDATIONS: Suggested actions
6. DETAILED FINDINGS: Breakdown by category

TONE: Professional, objective, actionable

RESPONSE FORMAT:
Return ONLY JSON with report sections:
{"title": "Telesight Analysis Report", "date": "ISO date", "summary": "executive summary", "sections": [{"title": "Section Name", "content": "detailed content"}], "recommendations": ["rec1", "rec2"], "riskLevel": "low|medium|high"}

Generate report from this data:`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, stats, userProfiles, token, format = "json" } = body

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 401 })
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 })
    }

    // Prepare data summary for AI
    const dataSummary = {
      totalMessages: messages.length,
      stats: stats || {},
      highRiskUsers: userProfiles?.filter((p: any) => p.overallRisk === "high") || [],
      sampleMessages: messages.slice(-20).map((m: any) => ({
        from: m.from,
        text: m.text?.substring(0, 100),
      })),
    }

    const prompt = `${REPORT_GENERATION_RULES}\n${JSON.stringify(dataSummary, null, 2)}`

    // Generate AI report
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
        max_tokens: 800,
        temperature: 0.3,
      }),
    })

    let report = {
      title: "Telesight Analysis Report",
      date: new Date().toISOString(),
      summary: "Analysis completed successfully",
      sections: [],
      recommendations: [],
      riskLevel: "low",
    }

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ""
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          report = { ...report, ...parsed }
        }
      } catch {
        // Use default report structure
      }
    }

    // Generate HTML version
    const htmlReport = generateHTMLReport(report, stats, userProfiles)
    
    // Generate Markdown version
    const markdownReport = generateMarkdownReport(report, stats, userProfiles)

    return NextResponse.json({
      report,
      html: htmlReport,
      markdown: markdownReport,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}

function generateHTMLReport(report: any, stats: any, userProfiles: any[]) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .risk-high { color: #e53e3e; }
    .risk-medium { color: #d69e2e; }
    .risk-low { color: #38a169; }
    .user-card { border-left: 4px solid #667eea; padding: 15px; margin: 10px 0; background: #f7fafc; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .stat-box { background: #edf2f7; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #2d3748; }
    .stat-label { font-size: 12px; color: #718096; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <p>Generated: ${new Date(report.date).toLocaleString()}</p>
    <p>Risk Level: <span class="risk-${report.riskLevel}">${report.riskLevel.toUpperCase()}</span></p>
  </div>
  
  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.summary}</p>
  </div>

  <div class="section">
    <h2>Key Statistics</h2>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-value">${stats?.totalMessages || 0}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats?.conflicts || 0}</div>
        <div class="stat-label">Conflicts</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats?.manipulation || 0}</div>
        <div class="stat-label">Manipulation</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats?.fraudDetected || 0}</div>
        <div class="stat-label">Fraud Alerts</div>
      </div>
    </div>
  </div>

  ${report.sections.map((s: any) => `
  <div class="section">
    <h2>${s.title}</h2>
    <p>${s.content}</p>
  </div>
  `).join('')}

  ${userProfiles?.length ? `
  <div class="section">
    <h2>User Profiles</h2>
    ${userProfiles.map((p: any) => `
    <div class="user-card">
      <h3>${p.user} <span class="risk-${p.overallRisk}">(${p.overallRisk.toUpperCase()} RISK)</span></h3>
      <p>${p.summary}</p>
      <p><strong>Traits:</strong> ${p.topTraits?.join(', ')}</p>
      <p>Messages: ${p.totalMessages} | Avg Length: ${p.avgMessageLength} chars</p>
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${report.recommendations?.length ? `
  <div class="section">
    <h2>Recommendations</h2>
    <ul>
      ${report.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

</body>
</html>`
}

function generateMarkdownReport(report: any, stats: any, userProfiles: any[]) {
  return `# ${report.title}

**Generated:** ${new Date(report.date).toLocaleString()}  
**Risk Level:** ${report.riskLevel.toUpperCase()}

---

## Executive Summary

${report.summary}

## Key Statistics

| Metric | Count |
|--------|-------|
| Total Messages | ${stats?.totalMessages || 0} |
| Conflicts | ${stats?.conflicts || 0} |
| Manipulation | ${stats?.manipulation || 0} |
| Fraud Alerts | ${stats?.fraudDetected || 0} |
| Users Analyzed | ${userProfiles?.length || 0} |
| High Risk Users | ${userProfiles?.filter((p: any) => p.overallRisk === "high").length || 0} |

## User Profiles

${userProfiles?.map((p: any) => `
### ${p.user} (${p.overallRisk.toUpperCase()} RISK)

- **Summary:** ${p.summary}
- **Traits:** ${p.topTraits?.join(', ')}
- **Total Messages:** ${p.totalMessages}
- **Conflict Tendency:** ${(p.conflictTendency * 100).toFixed(0)}%
- **Manipulation Score:** ${(p.manipulation * 100).toFixed(0)}%
- **Positivity:** ${(p.positivity * 100).toFixed(0)}%
`).join('\n') || 'No user profiles available'}

## Recommendations

${report.recommendations?.map((r: string) => `- ${r}`).join('\n') || '- No recommendations generated'}

---

*Report generated by Telesight AI Analysis*
`.trim()
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
        messages: [{ role: "user", content: "Test report generation" }],
        max_tokens: 10,
      }),
    })

    if (response.status === 503) return NextResponse.json({ status: "loading" })
    if (response.status === 402) return NextResponse.json({ status: "pro_required", message: "HF Pro required" })
    if (response.ok) return NextResponse.json({ status: "ready", message: "Report generation API ready" })
    return NextResponse.json({ status: "error", message: `API: ${response.status}` }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 })
  }
}
