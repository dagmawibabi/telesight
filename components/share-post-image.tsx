"use client"

import { useState, useRef, useCallback } from "react"
import { format } from "date-fns"
import { toPng } from "html-to-image"
import {
  X,
  Download,
  Copy,
  Check,
  Palette,
  Type,
  Maximize,
  Heart,
} from "lucide-react"
import type { TelegramMessage, MessageText } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"

interface SharePostImageProps {
  message: TelegramMessage
  channelName?: string
  onClose: () => void
}

const THEMES = [
  { id: "dark", label: "Dark", bg: "#0f1117", fg: "#f0f0f0", accent: "#38bdf8", card: "#1a1d27", muted: "#9ca3af" },
  { id: "light", label: "Light", bg: "#ffffff", fg: "#111827", accent: "#2563eb", card: "#f9fafb", muted: "#6b7280" },
  { id: "midnight", label: "Midnight", bg: "#0a0e1a", fg: "#e2e8f0", accent: "#818cf8", card: "#111827", muted: "#94a3b8" },
  { id: "forest", label: "Forest", bg: "#0a1a0f", fg: "#e2f0e6", accent: "#34d399", card: "#0f2517", muted: "#86b89a" },
  { id: "sunset", label: "Sunset", bg: "#1a0a0a", fg: "#fde2e2", accent: "#f97316", card: "#271010", muted: "#c4868a" },
  { id: "ocean", label: "Ocean", bg: "#0a1520", fg: "#e0f0ff", accent: "#06b6d4", card: "#0d1f30", muted: "#7eb4d2" },
] as const

const FONT_SIZES = [
  { id: "sm", label: "S", size: 14 },
  { id: "md", label: "M", size: 16 },
  { id: "lg", label: "L", size: 18 },
  { id: "xl", label: "XL", size: 22 },
] as const

const PADDINGS = [
  { id: "compact", label: "Compact", value: 24 },
  { id: "normal", label: "Normal", value: 40 },
  { id: "spacious", label: "Spacious", value: 60 },
] as const

function renderPlainTextParts(parts: MessageText[]): string {
  return parts.map((p) => (typeof p === "string" ? p : p.text)).join("")
}

export function SharePostImage({ message, channelName, onClose }: SharePostImageProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState(THEMES[0])
  const [fontSize, setFontSize] = useState(FONT_SIZES[1])
  const [padding, setPadding] = useState(PADDINGS[1])
  const [showReactions, setShowReactions] = useState(true)
  const [showDate, setShowDate] = useState(true)
  const [showChannel, setShowChannel] = useState(true)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const text = getMessageText(message)
  const totalReactions = message.reactions?.reduce((s, r) => s + r.count, 0) || 0

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return null
    return toPng(cardRef.current, {
      quality: 1,
      pixelRatio: 2,
      cacheBust: true,
      fontEmbedCSS: "",
      skipFonts: true,
    })
  }, [])

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const dataUrl = await generateImage()
      if (!dataUrl) return
      const link = document.createElement("a")
      link.download = `post-${message.id}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setDownloading(false)
    }
  }, [generateImage, message.id])

  const handleCopy = useCallback(async () => {
    try {
      const dataUrl = await generateImage()
      if (!dataUrl) return
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: download instead
      handleDownload()
    }
  }, [generateImage, handleDownload])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground transition-all hover:text-foreground"
        aria-label="Close share"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-6 max-h-[90vh] overflow-y-auto px-4 py-8 w-full max-w-3xl">
        {/* Customization bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          {/* Theme picker */}
          <div className="flex items-center gap-1.5 rounded-lg bg-card border border-border p-1.5">
            <Palette className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                className={`h-6 w-6 rounded-md border-2 transition-all ${
                  theme.id === t.id ? "border-primary scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: t.bg }}
                title={t.label}
              />
            ))}
          </div>

          {/* Font size */}
          <div className="flex items-center gap-1 rounded-lg bg-card border border-border p-1.5">
            <Type className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            {FONT_SIZES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontSize(f)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                  fontSize.id === f.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Padding */}
          <div className="flex items-center gap-1 rounded-lg bg-card border border-border p-1.5">
            <Maximize className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            {PADDINGS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPadding(p)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                  padding.id === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-card border border-border p-1.5">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                showReactions ? "bg-primary/20 text-primary" : "text-muted-foreground/50"
              }`}
            >
              <Heart className="h-3 w-3" /> Reactions
            </button>
            <button
              onClick={() => setShowDate(!showDate)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                showDate ? "bg-primary/20 text-primary" : "text-muted-foreground/50"
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setShowChannel(!showChannel)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                showChannel ? "bg-primary/20 text-primary" : "text-muted-foreground/50"
              }`}
            >
              Channel
            </button>
          </div>
        </div>

        {/* Preview card */}
        <div
          ref={cardRef}
          style={{
            backgroundColor: theme.bg,
            padding: `${padding.value}px`,
            maxWidth: 560,
            width: "100%",
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          {/* Channel name header */}
          {showChannel && channelName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: theme.accent + "20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: theme.accent,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.fg,
                  letterSpacing: "-0.01em",
                }}
              >
                {channelName}
              </span>
            </div>
          )}

          {/* Main text */}
          <div
            style={{
              fontSize: fontSize.size,
              lineHeight: 1.6,
              color: theme.fg,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              letterSpacing: "-0.01em",
            }}
          >
            {text.slice(0, 800)}
            {text.length > 800 ? "..." : ""}
          </div>

          {/* Reactions */}
          {showReactions && message.reactions && message.reactions.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 20,
              }}
            >
              {message.reactions.map((r, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: theme.card,
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 13,
                  }}
                >
                  <span>{r.emoji}</span>
                  <span style={{ color: theme.muted, fontFamily: "monospace", fontSize: 11 }}>
                    {r.count.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          {showDate && (
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: `1px solid ${theme.muted}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 11, color: theme.muted, fontFamily: "monospace" }}>
                {format(new Date(message.date), "MMMM d, yyyy 'at' HH:mm")}
              </span>
              <span style={{ fontSize: 11, color: theme.muted, fontFamily: "monospace" }}>
                #{message.id}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Generating..." : "Download PNG"}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg bg-card border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/30"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-primary" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
