"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { toPng } from "html-to-image"
import {
  X,
  Download,
  Copy,
  Check,
  Type,
  Maximize,
  Heart,
  Link2,
  ImageIcon,
  Forward,
  Gauge,
  Hash as HashIcon,
  Pencil,
  Camera,
} from "lucide-react"
import type { TelegramMessage, MessageText } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { computePostScore } from "@/lib/post-scoring"

interface SharePostImageProps {
  message: TelegramMessage
  allMessages?: TelegramMessage[]
  channelName?: string
  onClose: () => void
}

const PRESET_THEMES = [
  { id: "dark", label: "Dark", bg: "#0f1117", fg: "#f0f0f0", accent: "#38bdf8", card: "#1a1d27", muted: "#9ca3af" },
  { id: "light", label: "Light", bg: "#ffffff", fg: "#111827", accent: "#2563eb", card: "#f3f4f6", muted: "#6b7280" },
  { id: "midnight", label: "Midnight", bg: "#0a0e1a", fg: "#e2e8f0", accent: "#818cf8", card: "#111827", muted: "#94a3b8" },
  { id: "forest", label: "Forest", bg: "#0a1a0f", fg: "#e2f0e6", accent: "#34d399", card: "#0f2517", muted: "#86b89a" },
  { id: "sunset", label: "Sunset", bg: "#1a0a0a", fg: "#fde2e2", accent: "#f97316", card: "#271010", muted: "#c4868a" },
  { id: "ocean", label: "Ocean", bg: "#0a1520", fg: "#e0f0ff", accent: "#06b6d4", card: "#0d1f30", muted: "#7eb4d2" },
  { id: "lavender", label: "Lavender", bg: "#1a1225", fg: "#ede9f6", accent: "#a78bfa", card: "#221a30", muted: "#a89cc4" },
  { id: "rose", label: "Rose", bg: "#1a0f14", fg: "#fde8ef", accent: "#f472b6", card: "#26141c", muted: "#c48a9f" },
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

function extractLinks(msg: TelegramMessage): string[] {
  const urls: string[] = []
  if (Array.isArray(msg.text)) {
    for (const part of msg.text) {
      if (typeof part !== "string") {
        if (part.type === "link" && part.text.startsWith("http")) urls.push(part.text)
        if (part.type === "text_link" && part.href?.startsWith("http")) urls.push(part.href)
      }
    }
  }
  return [...new Set(urls)]
}

function extractHashtags(msg: TelegramMessage): string[] {
  const tags: string[] = []
  if (Array.isArray(msg.text)) {
    for (const part of msg.text) {
      if (typeof part !== "string" && part.type === "hashtag") tags.push(part.text)
    }
  }
  return tags
}

export function SharePostImage({ message, allMessages, channelName, onClose }: SharePostImageProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Theme state
  const [activePreset, setActivePreset] = useState(PRESET_THEMES[0].id)
  const [customBg, setCustomBg] = useState("")
  const [customFg, setCustomFg] = useState("")
  const [customAccent, setCustomAccent] = useState("")
  const [useCustomColors, setUseCustomColors] = useState(false)

  const [fontSize, setFontSize] = useState(FONT_SIZES[1])
  const [padding, setPadding] = useState(PADDINGS[1])

  // Toggle state
  const [showReactions, setShowReactions] = useState(true)
  const [showDate, setShowDate] = useState(true)
  const [showChannel, setShowChannel] = useState(true)
  const [showPostId, setShowPostId] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
  const [showMediaIndicator, setShowMediaIndicator] = useState(true)
  const [showForwardedFrom, setShowForwardedFrom] = useState(true)
  const [showScore, setShowScore] = useState(true)
  const [showHashtags, setShowHashtags] = useState(true)
  const [showEditedDate, setShowEditedDate] = useState(true)

  // Profile picture
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const text = getMessageText(message)
  const totalReactions = message.reactions?.reduce((s, r) => s + r.count, 0) || 0
  const links = extractLinks(message)
  const hashtags = extractHashtags(message)
  const hasMedia = !!(message.photo || message.file || message.media_type)
  const postScore = allMessages ? computePostScore(message, allMessages) : null

  // Resolve theme
  const preset = PRESET_THEMES.find((t) => t.id === activePreset) || PRESET_THEMES[0]
  const theme = useCustomColors
    ? {
        bg: customBg || preset.bg,
        fg: customFg || preset.fg,
        accent: customAccent || preset.accent,
        card: preset.card,
        muted: preset.muted,
      }
    : preset

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const handleProfilePicUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setProfilePicUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

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
      handleDownload()
    }
  }, [generateImage, handleDownload])

  const font = "'Inter', 'Segoe UI', system-ui, sans-serif"
  const mono = "'SF Mono', 'Fira Code', 'Consolas', monospace"

  return (
    <div className="fixed inset-0 z-[80] flex bg-background/95 backdrop-blur-md">
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground transition-all hover:text-foreground"
        aria-label="Close share"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Controls panel */}
        <div className="w-80 shrink-0 border-r border-border bg-card/50 overflow-y-auto p-5 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-foreground">Share as Image</h2>

          {/* Theme presets */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Theme</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setActivePreset(t.id); setUseCustomColors(false) }}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all border ${
                    !useCustomColors && activePreset === t.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-secondary/30"
                  }`}
                >
                  <div
                    className="h-6 w-full rounded-md border border-border/30"
                    style={{ backgroundColor: t.bg }}
                  >
                    <div
                      className="h-1.5 w-3 rounded-full mt-1 ml-1"
                      style={{ backgroundColor: t.accent }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom color picker */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Custom Colors</h3>
              <button
                onClick={() => {
                  setUseCustomColors(!useCustomColors)
                  if (!useCustomColors) {
                    setCustomBg(preset.bg)
                    setCustomFg(preset.fg)
                    setCustomAccent(preset.accent)
                  }
                }}
                className={`h-5 w-9 rounded-full transition-colors ${
                  useCustomColors ? "bg-primary" : "bg-secondary"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-card shadow-sm transition-transform ${
                    useCustomColors ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            {useCustomColors && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">Background</span>
                  <input
                    type="color"
                    value={customBg || preset.bg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="h-7 w-7 rounded border border-border cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/50">{customBg || preset.bg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">Text</span>
                  <input
                    type="color"
                    value={customFg || preset.fg}
                    onChange={(e) => setCustomFg(e.target.value)}
                    className="h-7 w-7 rounded border border-border cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/50">{customFg || preset.fg}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">Accent</span>
                  <input
                    type="color"
                    value={customAccent || preset.accent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="h-7 w-7 rounded border border-border cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/50">{customAccent || preset.accent}</span>
                </label>
              </div>
            )}
          </section>

          {/* Profile picture */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Channel Avatar</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative h-10 w-10 rounded-full border border-dashed border-border hover:border-primary/40 transition-colors flex items-center justify-center overflow-hidden cursor-pointer"
              >
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-4 w-4 text-muted-foreground/50" />
                )}
              </button>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-foreground/80">
                  {profilePicUrl ? "Picture set" : "Upload image"}
                </span>
                {profilePicUrl && (
                  <button
                    onClick={() => setProfilePicUrl(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePicUpload}
              />
            </div>
          </section>

          {/* Font size */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              <span className="flex items-center gap-1.5"><Type className="h-3 w-3" /> Font Size</span>
            </h3>
            <div className="flex gap-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontSize(f)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    fontSize.id === f.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Padding */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              <span className="flex items-center gap-1.5"><Maximize className="h-3 w-3" /> Padding</span>
            </h3>
            <div className="flex gap-1">
              {PADDINGS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPadding(p)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    padding.id === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Content toggles */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Include</h3>
            <div className="flex flex-col gap-1.5">
              {([
                { label: "Channel name", icon: <Type className="h-3 w-3" />, value: showChannel, set: setShowChannel },
                { label: "Post ID", icon: <HashIcon className="h-3 w-3" />, value: showPostId, set: setShowPostId },
                { label: "Date & time", icon: <Pencil className="h-3 w-3" />, value: showDate, set: setShowDate },
                { label: "Edited date", icon: <Pencil className="h-3 w-3" />, value: showEditedDate, set: setShowEditedDate, disabled: !message.edited },
                { label: "Reactions", icon: <Heart className="h-3 w-3" />, value: showReactions, set: setShowReactions, disabled: !message.reactions?.length },
                { label: "Links", icon: <Link2 className="h-3 w-3" />, value: showLinks, set: setShowLinks, disabled: links.length === 0 },
                { label: "Media indicator", icon: <ImageIcon className="h-3 w-3" />, value: showMediaIndicator, set: setShowMediaIndicator, disabled: !hasMedia },
                { label: "Forwarded from", icon: <Forward className="h-3 w-3" />, value: showForwardedFrom, set: setShowForwardedFrom, disabled: !message.forwarded_from },
                { label: "Engagement score", icon: <Gauge className="h-3 w-3" />, value: showScore, set: setShowScore, disabled: !postScore },
                { label: "Hashtags", icon: <HashIcon className="h-3 w-3" />, value: showHashtags, set: setShowHashtags, disabled: hashtags.length === 0 },
              ] as const).map((item) => (
                <button
                  key={item.label}
                  onClick={() => !item.disabled && item.set(!item.value)}
                  disabled={item.disabled}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all text-left ${
                    item.disabled
                      ? "opacity-30 cursor-not-allowed"
                      : item.value
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <div className={`h-3.5 w-6 rounded-full transition-colors ${item.value && !item.disabled ? "bg-primary" : "bg-secondary"}`}>
                    <div className={`h-2.5 w-2.5 rounded-full bg-card shadow-sm transition-transform mt-0.5 ${item.value && !item.disabled ? "translate-x-3" : "translate-x-0.5"}`} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Generating..." : "Download PNG"}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/30"
            >
              {copied ? (
                <><Check className="h-4 w-4 text-primary" /> Copied</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy to Clipboard</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex items-center justify-center overflow-y-auto p-8 bg-secondary/10">
          <div
            ref={cardRef}
            style={{
              backgroundColor: theme.bg,
              padding: `${padding.value}px`,
              maxWidth: 560,
              width: "100%",
              fontFamily: font,
              borderRadius: 16,
            }}
          >
            {/* Channel header */}
            {showChannel && channelName && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                {profilePicUrl ? (
                  <img
                    src={profilePicUrl}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: theme.accent + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: theme.accent }} />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.fg, fontFamily: font }}>
                    {channelName}
                  </span>
                  {showPostId && (
                    <span style={{ fontSize: 10, color: theme.muted, fontFamily: mono }}>
                      Post #{message.id}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Post ID standalone (when channel is hidden) */}
            {showPostId && !showChannel && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: theme.muted, fontFamily: mono }}>
                  #{message.id}
                </span>
              </div>
            )}

            {/* Forwarded from */}
            {showForwardedFrom && message.forwarded_from && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 14,
                padding: "6px 12px",
                borderRadius: 8,
                backgroundColor: theme.card,
                fontFamily: font,
              }}>
                <span style={{ fontSize: 11, color: theme.muted }}>Forwarded from</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: theme.fg }}>{message.forwarded_from}</span>
              </div>
            )}

            {/* Media indicator */}
            {showMediaIndicator && hasMedia && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 14,
                padding: "6px 12px",
                borderRadius: 8,
                backgroundColor: theme.accent + "15",
                fontFamily: font,
              }}>
                <span style={{ fontSize: 11, color: theme.accent, fontWeight: 500 }}>
                  {message.photo ? "Photo" :
                    message.media_type === "video_file" ? "Video" :
                    message.media_type === "animation" ? "GIF" :
                    message.media_type === "sticker" ? `Sticker ${message.sticker_emoji || ""}` :
                    message.media_type === "voice_message" ? "Voice" :
                    message.media_type === "audio_file" ? "Audio" : "Attachment"}
                  {message.file_name ? ` - ${message.file_name}` : ""}
                  {message.duration_seconds ? ` (${message.duration_seconds}s)` : ""}
                </span>
              </div>
            )}

            {/* Main text */}
            <div style={{
              fontSize: fontSize.size,
              lineHeight: 1.6,
              color: theme.fg,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              letterSpacing: "-0.01em",
              fontFamily: font,
            }}>
              {text.slice(0, 800)}
              {text.length > 800 ? "..." : ""}
            </div>

            {/* Links */}
            {showLinks && links.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 16 }}>
                {links.slice(0, 3).map((link, i) => {
                  const domain = new URL(link).hostname.replace(/^www\./, "")
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 10px",
                        borderRadius: 6,
                        backgroundColor: theme.card,
                        fontFamily: font,
                      }}
                    >
                      <span style={{ fontSize: 10, color: theme.accent, fontWeight: 500 }}>{domain}</span>
                      <span style={{ fontSize: 9, color: theme.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {link.replace(/^https?:\/\//, "").slice(0, 60)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Hashtags */}
            {showHashtags && hashtags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 14 }}>
                {hashtags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      backgroundColor: theme.accent + "15",
                      fontSize: 11,
                      fontWeight: 500,
                      color: theme.accent,
                      fontFamily: font,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Reactions */}
            {showReactions && message.reactions && message.reactions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
                {message.reactions.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      backgroundColor: theme.card, borderRadius: 8,
                      padding: "4px 10px", fontSize: 13,
                      fontFamily: font,
                    }}
                  >
                    <span>{r.emoji}</span>
                    <span style={{ color: theme.muted, fontFamily: mono, fontSize: 11 }}>
                      {r.count.toLocaleString()}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Engagement score */}
            {showScore && postScore && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                marginTop: 16, padding: "8px 14px",
                borderRadius: 10, backgroundColor: theme.card,
                fontFamily: font,
              }}>
                <svg width="32" height="32" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={theme.card} strokeWidth="3.5"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={theme.accent} strokeWidth="3.5"
                    strokeDasharray={`${postScore.total}, 100`} strokeLinecap="round"
                  />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.fg, fontFamily: mono }}>
                    {postScore.total}/100
                  </span>
                  <span style={{ fontSize: 10, color: theme.muted, fontFamily: font }}>
                    {postScore.label} - Top {100 - postScore.percentile}%
                  </span>
                </div>
              </div>
            )}

            {/* Footer: date + edited */}
            {(showDate || showEditedDate) && (
              <div style={{
                marginTop: 20, paddingTop: 14,
                borderTop: `1px solid ${theme.muted}20`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: font,
              }}>
                {showDate && (
                  <span style={{ fontSize: 11, color: theme.muted, fontFamily: mono }}>
                    {format(new Date(message.date), "MMMM d, yyyy 'at' HH:mm")}
                  </span>
                )}
                {showEditedDate && message.edited && (
                  <span style={{ fontSize: 10, color: theme.muted, fontFamily: mono, fontStyle: "italic" }}>
                    edited {format(new Date(message.edited), "MMM d, HH:mm")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
