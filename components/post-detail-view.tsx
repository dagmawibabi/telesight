"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import {
  X,
  Forward,
  Reply,
  ExternalLink,
  Eye,
  Calendar,
  Clock,
  Hash,
  FileText,
  Image as ImageIcon,
  Film,
  ChevronDown,
  ChevronUp,
  Braces,
  Pencil,
  ArrowRight,
  Gauge,
  Sparkles,
} from "lucide-react"
import type { TelegramMessage, MessageText } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"
import { LinkPreview } from "./link-preview"
import { computePostScore, findSimilarPosts, type PostScore, type SimilarPost } from "@/lib/post-scoring"
import { SharePostImage } from "./share-post-image"
import { Share } from "lucide-react"

interface PostDetailViewProps {
  message: TelegramMessage
  allMessages?: TelegramMessage[]
  channelName?: string
  replyToMessage?: TelegramMessage
  mediaFileMap?: MediaFileMap | null
  onClose: () => void
  onHashtagClick?: (hashtag: string) => void
  onReplyNavigate?: (id: number) => void
  onPostClick?: (message: TelegramMessage) => void
}

function renderDetailTextParts(
  parts: MessageText[],
  onHashtagClick?: (hashtag: string) => void
): React.ReactNode[] {
  return parts.map((part, i) => {
    if (typeof part === "string") {
      return <span key={i}>{part}</span>
    }
    switch (part.type) {
      case "link":
        return (
          <a
            key={i}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all inline-flex items-center gap-1"
          >
            <span>{part.text}</span>
            <ExternalLink className="h-3.5 w-3.5 inline-block shrink-0" />
          </a>
        )
      case "bold":
        return (
          <strong key={i} className="font-semibold">
            {part.text}
          </strong>
        )
      case "italic":
        return (
          <em key={i} className="italic">
            {part.text}
          </em>
        )
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-secondary px-2 py-1 font-mono text-sm text-primary"
          >
            {part.text}
          </code>
        )
      case "pre":
        return (
          <pre
            key={i}
            className="mt-3 overflow-x-auto rounded-xl bg-secondary/80 p-4 font-mono text-sm leading-relaxed"
          >
            {part.text}
          </pre>
        )
      case "mention":
        return (
          <span key={i} className="text-primary font-medium">
            {part.text}
          </span>
        )
      case "hashtag":
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              onHashtagClick?.(part.text)
            }}
            className="text-primary hover:underline cursor-pointer font-medium"
          >
            {part.text}
          </button>
        )
      case "blockquote":
        return (
          <blockquote
            key={i}
            className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground my-2"
          >
            {part.text}
          </blockquote>
        )
      case "spoiler":
        return (
          <span
            key={i}
            className="group/spoiler cursor-pointer relative inline"
          >
            <span className="bg-muted-foreground/80 text-transparent rounded-sm px-0.5 transition-all group-hover/spoiler:bg-transparent group-hover/spoiler:text-foreground select-none group-hover/spoiler:select-auto">
              {part.text}
            </span>
            <Eye className="h-3 w-3 text-muted-foreground/50 inline-block ml-0.5 group-hover/spoiler:hidden" />
          </span>
        )
      case "text_link":
        return (
          <a
            key={i}
            href={part.href || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {part.text}
          </a>
        )
      default:
        return <span key={i}>{part.text}</span>
    }
  })
}

function getPlainText(msg: TelegramMessage): string {
  if (typeof msg.text === "string") return msg.text
  if (Array.isArray(msg.text)) {
    return msg.text
      .map((p) => (typeof p === "string" ? p : p.text))
      .join("")
  }
  return ""
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex items-center gap-2 min-w-[120px] text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function MediaRenderer({ message, mediaFileMap }: { message: TelegramMessage; mediaFileMap?: MediaFileMap | null }) {
  const photoUrl = useMediaUrl(mediaFileMap ?? null, message.photo)
  const fileUrl = useMediaUrl(mediaFileMap ?? null, message.file)
  const thumbnailUrl = useMediaUrl(mediaFileMap ?? null, message.thumbnail)

  const isVideo = message.media_type === "video_file" || message.mime_type?.startsWith("video/")
  const isAnimation = message.media_type === "animation"
  const isSticker = message.media_type === "sticker"
  const resolvedUrl = photoUrl || fileUrl

  if (!message.photo && !message.media_type && !message.file) return null

  if (resolvedUrl) {
    return (
      <div className="rounded-xl overflow-hidden bg-secondary/30 border border-border/50">
        {isVideo || isAnimation ? (
          <video
            src={resolvedUrl}
            poster={thumbnailUrl || undefined}
            controls={isVideo}
            autoPlay={isAnimation}
            loop={isAnimation}
            muted={isAnimation}
            playsInline
            className="w-full max-h-[500px] object-contain"
          />
        ) : isSticker ? (
          message.mime_type === "video/webm" ? (
            <video
              src={resolvedUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-40 h-40 object-contain mx-auto my-4"
            />
          ) : (
            <img
              src={resolvedUrl}
              alt={message.sticker_emoji || "Sticker"}
              className="w-40 h-40 object-contain mx-auto my-4"
            />
          )
        ) : (
          <img
            src={resolvedUrl}
            alt="Photo"
            className="w-full max-h-[500px] object-contain"
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary/30 border border-border/50 px-5 py-4 text-muted-foreground">
      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
        {message.photo || isSticker ? (
          <ImageIcon className="h-5 w-5" />
        ) : isVideo || isAnimation ? (
          <Film className="h-5 w-5" />
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground/80">
          {message.photo
            ? "Photo"
            : isSticker
              ? `Sticker ${message.sticker_emoji || ""}`
              : isVideo
                ? "Video"
                : isAnimation
                  ? "GIF"
                  : "File"}
        </span>
        {message.file_name && (
          <span className="text-xs">{message.file_name}</span>
        )}
        {message.duration_seconds && (
          <span className="text-xs">{message.duration_seconds}s duration</span>
        )}
      </div>
    </div>
  )
}

export function PostDetailView({
  message,
  allMessages,
  channelName,
  replyToMessage,
  mediaFileMap,
  onClose,
  onHashtagClick,
  onReplyNavigate,
  onPostClick,
}: PostDetailViewProps) {
  const [showRawJson, setShowRawJson] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const postScore = useMemo(
    () => allMessages ? computePostScore(message, allMessages) : null,
    [message, allMessages]
  )

  const similarPosts = useMemo(
    () => allMessages ? findSimilarPosts(message, allMessages, 6) : [],
    [message, allMessages]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const text = getPlainText(message)
  const totalReactions = message.reactions?.reduce((sum, r) => sum + r.count, 0) || 0

  // Extract links from text entities
  const links: string[] = []
  if (Array.isArray(message.text)) {
    for (const part of message.text) {
      if (typeof part !== "string") {
        if (part.type === "link") links.push(part.text)
        if (part.type === "text_link" && part.href) links.push(part.href)
      }
    }
  }
  if (message.text_entities) {
    for (const ent of message.text_entities) {
      if (ent.type === "link") links.push(ent.text)
      if (ent.type === "text_link" && ent.href) links.push(ent.href)
    }
  }
  const uniqueLinks = [...new Set(links)]

  // Extract hashtags
  const hashtags: string[] = []
  if (Array.isArray(message.text)) {
    for (const part of message.text) {
      if (typeof part !== "string" && part.type === "hashtag") {
        hashtags.push(part.text)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-background/95 backdrop-blur-md">
      {/* Action buttons */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-2">
        <button
          onClick={() => setShowShare(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
          aria-label="Share as image"
          title="Share as image"
        >
          <Share className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
          aria-label="Close post detail"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="w-full max-w-2xl px-4 py-12">
        {/* Post ID badge */}
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-xs text-muted-foreground/50">#{message.id}</span>
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-xs text-muted-foreground">
            {message.type === "service" ? "Service Event" : "Post"}
          </span>
        </div>

        {/* Post Score */}
        {postScore && (
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Engagement Score</h3>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="oklch(0.25 0.005 260)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="oklch(0.7 0.15 180)"
                    strokeWidth="3"
                    strokeDasharray={`${postScore.total}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold font-mono text-foreground">{postScore.total}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">{postScore.label}</span>
                <span className="text-xs text-muted-foreground">
                  Top {100 - postScore.percentile}% of all posts
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Reactions", value: postScore.breakdown.reactions, max: 50 },
                { label: "Text", value: postScore.breakdown.textLength, max: 20 },
                { label: "Media", value: postScore.breakdown.media, max: 10 },
                { label: "Links", value: postScore.breakdown.links, max: 8 },
                { label: "Reply", value: postScore.breakdown.replies, max: 7 },
                { label: "Forward", value: postScore.breakdown.forwarded, max: 5 },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    <span className="text-[10px] font-mono text-foreground">{item.value}/{item.max}</span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${(item.value / item.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reply indicator */}
        {message.reply_to_message_id && (
          <button
            onClick={() => {
              onClose()
              setTimeout(() => onReplyNavigate?.(message.reply_to_message_id!), 100)
            }}
            className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 mb-6 w-full text-left transition-colors hover:bg-primary/10 group"
          >
            <Reply className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-xs font-medium text-primary">
                Replying to #{message.reply_to_message_id}
              </span>
              {replyToMessage && (
                <span className="text-sm text-muted-foreground line-clamp-2">
                  {getPlainText(replyToMessage)}
                </span>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5" />
          </button>
        )}

        {/* Forwarded from */}
        {message.forwarded_from && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-4 py-2.5 mb-6 text-sm">
            <Forward className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Forwarded from</span>
            <span className="font-medium text-foreground">{message.forwarded_from}</span>
          </div>
        )}

        {/* Media */}
        <div className="mb-6">
          <MediaRenderer message={message} mediaFileMap={mediaFileMap} />
        </div>

        {/* Main text content */}
        {text && (
          <div className="mb-8">
            <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {typeof message.text === "string" ? (
                <span>{message.text}</span>
              ) : Array.isArray(message.text) ? (
                renderDetailTextParts(message.text as MessageText[], onHashtagClick)
              ) : null}
            </div>
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Reactions ({totalReactions.toLocaleString()})
            </h3>
            <div className="flex flex-wrap gap-2">
              {message.reactions.map((r, i) => (
                <div
                  key={`${r.emoji}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2"
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {r.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links with rich previews */}
        {uniqueLinks.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Links ({uniqueLinks.length})
            </h3>
            <div className="flex flex-col gap-3">
              {uniqueLinks.map((link) => (
                <LinkPreview key={link} url={link} />
              ))}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Hashtags
            </h3>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onClose()
                    setTimeout(() => onHashtagClick?.(tag), 100)
                  }}
                  className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Similar Posts */}
        {similarPosts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Similar Posts ({similarPosts.length})
            </h3>
            <div className="flex flex-col gap-2">
              {similarPosts.map((sp) => {
                const spText = getMessageText(sp.message)
                const spReactions = sp.message.reactions?.reduce((s, r) => s + r.count, 0) || 0
                return (
                  <button
                    key={sp.message.id}
                    onClick={() => {
                      onPostClick?.(sp.message)
                    }}
                    className="flex flex-col gap-1.5 rounded-xl bg-card border border-border p-3.5 text-left transition-all hover:border-primary/30 cursor-pointer w-full"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/50">
                        #{sp.message.id}
                      </span>
                      <div className="flex items-center gap-2">
                        {spReactions > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {spReactions.toLocaleString()} reactions
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-primary/70">
                          {sp.score}% match
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">
                      {spText.slice(0, 150) || (sp.message.photo ? "[Photo]" : "[Media]")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sp.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(sp.message.date), "MMM d, yyyy 'at' HH:mm")}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Metadata section */}
        <div className="border-t border-border/50 pt-6 mb-8">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Metadata
          </h3>
          <div className="divide-y divide-border/30">
            <MetaRow icon={<Hash className="h-3.5 w-3.5" />} label="ID">
              <span className="font-mono">{message.id}</span>
            </MetaRow>

            <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Date">
              {format(new Date(message.date), "EEEE, MMMM d, yyyy")}
            </MetaRow>

            <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Time">
              {format(new Date(message.date), "HH:mm:ss")}
              {message.date_unixtime && (
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  (unix: {message.date_unixtime})
                </span>
              )}
            </MetaRow>

            {message.edited && (
              <MetaRow icon={<Pencil className="h-3.5 w-3.5" />} label="Edited">
                {format(new Date(message.edited), "EEEE, MMMM d, yyyy 'at' HH:mm:ss")}
                {message.edited_unixtime && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    (unix: {message.edited_unixtime})
                  </span>
                )}
              </MetaRow>
            )}

            {(message.from || message.actor) && (
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Author">
                <span>{message.from || message.actor}</span>
                {(message.from_id || message.actor_id) && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {message.from_id || message.actor_id}
                  </span>
                )}
              </MetaRow>
            )}

            {message.forwarded_from && (
              <MetaRow icon={<Forward className="h-3.5 w-3.5" />} label="Forwarded">
                <span>{message.forwarded_from}</span>
                {message.forwarded_from_id && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {message.forwarded_from_id}
                  </span>
                )}
              </MetaRow>
            )}

            {message.photo && (
              <MetaRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="Photo">
                <span className="font-mono text-xs break-all">{message.photo}</span>
                {message.width && message.height && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {message.width} x {message.height}
                  </span>
                )}
                {message.photo_file_size && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({(message.photo_file_size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </MetaRow>
            )}

            {message.file && (
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="File">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs break-all">{message.file}</span>
                  {message.file_name && (
                    <span className="text-xs text-muted-foreground">{message.file_name}</span>
                  )}
                  {message.file_size && (
                    <span className="text-xs text-muted-foreground">
                      {message.file_size > 1048576
                        ? `${(message.file_size / 1048576).toFixed(1)} MB`
                        : `${(message.file_size / 1024).toFixed(1)} KB`}
                    </span>
                  )}
                </div>
              </MetaRow>
            )}

            {message.media_type && (
              <MetaRow icon={<Film className="h-3.5 w-3.5" />} label="Media Type">
                <span>{message.media_type}</span>
                {message.mime_type && (
                  <span className="ml-2 text-xs text-muted-foreground">{message.mime_type}</span>
                )}
                {message.duration_seconds != null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {message.duration_seconds}s
                  </span>
                )}
              </MetaRow>
            )}

            {message.sticker_emoji && (
              <MetaRow icon={<span className="text-sm">{message.sticker_emoji}</span>} label="Sticker">
                {message.sticker_emoji}
              </MetaRow>
            )}

            {message.action && (
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Action">
                <span className="font-mono text-xs">{message.action}</span>
              </MetaRow>
            )}
          </div>
        </div>

        {/* Raw JSON toggle */}
        <div className="border-t border-border/50 pt-6 mb-12">
          <button
            onClick={() => setShowRawJson((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Braces className="h-4 w-4" />
            <span className="font-medium">Raw JSON</span>
            {showRawJson ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showRawJson && (
            <div className="mt-4 rounded-xl bg-secondary/50 border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                <span className="text-xs text-muted-foreground font-mono">message #{message.id}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(message, null, 2))
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground/80 max-h-[500px] overflow-y-auto">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Share as image overlay */}
      {showShare && (
        <SharePostImage
          message={message}
          allMessages={allMessages}
          channelName={channelName}
          mediaFileMap={mediaFileMap}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
