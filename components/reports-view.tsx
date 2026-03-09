"use client"

import { useState } from "react"
import {
  X,
  FileText,
  Download,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileCode,
  FileType,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useHuggingFaceToken } from "@/hooks/use-hf-token"
import { HFTokenDialog } from "./hf-token-dialog"

interface ReportsViewProps {
  messages: TelegramMessage[]
  onClose: () => void
}

export function ReportsView({ messages, onClose }: ReportsViewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<any>(null)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const { token, hasToken } = useHuggingFaceToken()

  const generateReport = async () => {
    if (!hasToken) {
      setTokenDialogOpen(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const messageData = messages
        .filter(m => m.type === "message")
        .map(m => ({
          id: m.id.toString(),
          text: getMessageText(m),
          from: m.from || "Unknown",
          date: m.date,
        }))

      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messageData,
          token,
          stats: {
            totalMessages: messages.length,
            conflicts: 0,
            manipulation: 0,
            fraudDetected: 0,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Report generation failed")
      }

      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadHTML = () => {
    if (!report?.html) return
    downloadFile(report.html, `telesight-report-${new Date().toISOString().split("T")[0]}.html`, "text/html")
  }

  const downloadMarkdown = () => {
    if (!report?.markdown) return
    downloadFile(report.markdown, `telesight-report-${new Date().toISOString().split("T")[0]}.md`, "text/markdown")
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      <HFTokenDialog
        isOpen={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSave={() => {}}
        hasExistingToken={hasToken}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-teal-500/20">
              <FileText className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Export Reports
              </h1>
              <p className="text-xs text-muted-foreground">
                Generate and download analysis reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-500 transition-all hover:bg-green-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5" />
                  {hasToken ? "Generate Report" : "Add HF Token"}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {!hasToken && !report && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <FileText className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-medium">No Report Available</p>
            <p className="text-sm">Add your Hugging Face token to generate reports</p>
            <button
              onClick={() => setTokenDialogOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Key className="h-4 w-4" />
              Add Token
            </button>
          </div>
        )}

        {report && (
          <>
            {/* Report Summary */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{report.report?.title || "Analysis Report"}</h2>
                  <p className="text-sm text-muted-foreground">
                    Generated: {new Date(report.timestamp).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    report.report?.riskLevel === "high"
                      ? "bg-red-500/10 text-red-500"
                      : report.report?.riskLevel === "medium"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-green-500/10 text-green-500"
                  }`}
                >
                  {(report.report?.riskLevel || "low").toUpperCase()} RISK
                </span>
              </div>
              <p className="text-muted-foreground">{report.report?.summary || "Analysis completed"}</p>

              {/* Key Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold">{report.stats?.totalMessages || 0}</div>
                  <div className="text-xs text-muted-foreground">Messages</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold text-red-500">{report.stats?.conflicts || 0}</div>
                  <div className="text-xs text-muted-foreground">Conflicts</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold text-purple-500">{report.stats?.manipulation || 0}</div>
                  <div className="text-xs text-muted-foreground">Manipulation</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold text-orange-500">{report.stats?.fraudDetected || 0}</div>
                  <div className="text-xs text-muted-foreground">Fraud</div>
                </div>
              </div>
            </div>

            {/* Download Options */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <button
                onClick={downloadHTML}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-green-500/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                  <FileCode className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">Download HTML Report</h3>
                  <p className="text-xs text-muted-foreground">
                    Full formatted report with charts and styling
                  </p>
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
              </button>

              <button
                onClick={downloadMarkdown}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-green-500/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileType className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">Download Markdown</h3>
                  <p className="text-xs text-muted-foreground">
                    Plain text format for easy sharing
                  </p>
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Report Preview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Report Preview</h3>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="space-y-4">
                  {report.report?.sections?.map((section: any, i: number) => (
                    <div key={i}>
                      <h4 className="font-medium text-foreground">{section.title}</h4>
                      <p className="text-muted-foreground">{section.content}</p>
                    </div>
                  ))}
                </div>

                {report.report?.recommendations && report.report.recommendations.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-foreground mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {report.report.recommendations.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
