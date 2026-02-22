"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { Forward, Reply, ExternalLink, Eye, CheckSquare } from "lucide-react"
import type { TelegramMessage, MessageText } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"
import { LinkPreview } from "./link-preview"

// Stable color palette for member names
const MEMBER_COLORS = [
  "oklch(0.75 0.15 180)", // teal
  "oklch(0.75 0.15 280)", // purple
  "oklch(0.75 0.15 30)",  // orange
  "oklch(0.7 0.15 140)",  // green
  "oklch(0.7 0.15 350)",  // pink
  "oklch(0.75 0.15 230)", // blue
  "oklch(0.7 0.15 60)",   // gold
  "oklch(0.7 0.15 310)",  // magenta
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

function extractUrls(msg: TelegramMessage): string[] {
  const urls: string[] = []
  if (Array.isArray(msg.text)) {
    for (const part of msg.text) {
      if (typeof part === "string") continue
      if (part.type === "link" && part.text.startsWith("http")) urls.push(part.text)
      else if (part.type === "text_link" && part.href?.startsWith("http")) urls.push(part.href)
    }
  } else if (typeof msg.text === "string") {
    const matches = msg.text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g)
    if (matches) urls.push(...matches)
  }
  return [...new Set(urls)]
}

function renderTextParts(
  parts: MessageText[],
  onHashtagClick?: (hashtag: string) => void,
  showLinkPreviews: boolean = true,
): React.ReactNode[] {
  return parts.map((part, i) => {
    if (typeof part === "string") return <span key={i}>{part}</span>

    switch (part.type) {
      case "link":
        if (!showLinkPreviews) return <span key={i} className="text-muted-foreground break-all">{part.text}</span>
        return (
          <a key={i} href={part.text} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline break-all inline-flex items-center gap-1">
            <span className="truncate max-w-[200px] inline-block align-bottom">{part.text.replace(/^https?:\/\//, "").split("/")[0]}</span>
            <ExternalLink className="h-3 w-3 inline-block shrink-0" />
          </a>
        )
      case "bold": return <strong key={i} className="font-semibold">{part.text}</strong>
      case "italic": return <em key={i} className="italic">{part.text}</em>
      case "strikethrough": return <del key={i} className="line-through text-muted-foreground">{part.text}</del>
      case "code": return <code key={i} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-primary">{part.text}</code>
      case "pre": return <pre key={i} className="mt-2 overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs">{part.text}</pre>
      case "mention": return <span key={i} className="text-primary font-medium">{part.text}</span>
      case "hashtag":
        return (
          <button key={i} onClick={(e) => { e.stopPropagation(); onHashtagClick?.(part.text) }}
            className="text-primary hover:underline cursor-pointer font-medium">{part.text}</button>
        )
      case "blockquote": return <blockquote key={i} className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{part.text}</blockquote>
      case "spoiler":
        return (
          <span key={i} className="group/spoiler cursor-pointer relative inline">
            <span className="bg-muted-foreground/80 text-transparent rounded-sm px-0.5 transition-all group-hover/spoiler:bg-transparent group-hover/spoiler:text-foreground select-none group-hover/spoiler:select-auto">
              {part.text}
            </span>
            <Eye className="h-3 w-3 text-muted-foreground/50 inline-block ml-0.5 group-hover/spoiler:hidden" />
          </span>
        )
      case "text_link":
        if (!showLinkPreviews) return <span key={i} className="text-muted-foreground">{part.text}</span>
        return <a key={i} href={part.href || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{part.text}</a>
      default: return <span key={i}>{part.text}</span>
    }
  })
}

interface GroupMessageCardProps {
  message: TelegramMessage
  replyToMessage?: TelegramMessage
  onReplyClick?: (id: number) => void
  onHashtagClick?: (hashtag: string) => void
  mediaFileMap?: MediaFileMap | null
  onPostClick?: (message: TelegramMessage) => void
  showMedia?: boolean
  showLinkPreviews?: boolean
  topicLabel?: string
}

export function GroupMessageCard({
  message,
  replyToMessage,
  onReplyClick,
  onHashtagClick,
  mediaFileMap,
  onPostClick,
  showMedia = true,
  showLinkPreviews = true,
  topicLabel,
}: GroupMessageCardProps) {
  const text = getMessageText(message)
  const hasMedia = !!(message.photo || message.media_type || message.file)
  const senderName = message.from || message.actor || "Unknown"
  const senderColor = hashColor(senderName)

  const photoUrl = useMediaUrl(mediaFileMap ?? null, message.photo)
  const fileUrl = useMediaUrl(mediaFileMap ?? null, message.file)
  const thumbnailUrl = useMediaUrl(mediaFileMap ?? null, message.thumbnail)
  const isVideo = message.media_type === "video_file" || message.mime_type?.startsWith("video/")
  const isSticker = message.media_type === "sticker"
  const resolvedMediaUrl = photoUrl || fileUrl
  const urls = useMemo(() => extractUrls(message), [message])

  return (
    <article
      onClick={() => onPostClick?.(message)}
      className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:bg-card/80 flex flex-col gap-2.5 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPostClick?.(message) } }}
    >
      {/* Sender + topic row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar circle */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-background"
            style={{ backgroundColor: senderColor }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold truncate" style={{ color: senderColor }}>
            {senderName}
          </span>
        </div>
        {topicLabel && (
          <span className="shrink-0 rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
            {topicLabel}
          </span>
        )}
      </div>

      {/* Reply indicator */}
      {message.reply_to_message_id && replyToMessage && (
        <button
          onClick={(e) => { e.stopPropagation(); onReplyClick?.(message.reply_to_message_id!) }}
          className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-left transition-colors hover:bg-primary/10 w-full"
        >
          <Reply className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-medium text-primary">
              {replyToMessage.from || "Unknown"}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {getMessageText(replyToMessage).slice(0, 80)}
            </span>
          </div>
        </button>
      )}

      {/* Forwarded from */}
      {message.forwarded_from && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Forward className="h-3 w-3" />
          <span>Forwarded from</span>
          <span className="font-medium text-foreground">{message.forwarded_from}</span>
        </div>
      )}

      {/* Todo list */}
      {message.todo_list && (
        <div className="rounded-lg bg-secondary/40 border border-border/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{message.todo_list.title}</span>
          </div>
          <div className="flex flex-col gap-1">
            {message.todo_list.answers.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded-sm border border-border/80 shrink-0" />
                <span className="text-xs text-foreground/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media */}
      {hasMedia && showMedia && (
        <>
          {resolvedMediaUrl ? (
            <div className="rounded-lg overflow-hidden bg-secondary/30 -mx-1" onClick={(e) => e.stopPropagation()}>
              {isVideo ? (
                <video src={resolvedMediaUrl} poster={thumbnailUrl || undefined} controls playsInline className="w-full max-h-[400px] object-contain" />
              ) : isSticker ? (
                <img src={resolvedMediaUrl} alt={message.sticker_emoji || "Sticker"} className="w-32 h-32 object-contain mx-auto my-1" loading="lazy" />
              ) : (
                <img src={resolvedMediaUrl} alt="Photo" className="w-full max-h-[400px] object-contain" loading="lazy" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </div>
              <span>{message.photo ? "Photo" : isVideo ? "Video" : "File"} attached</span>
            </div>
          )}
        </>
      )}

      {/* Contact info */}
      {message.contact_information && (
        <div className="rounded-lg bg-secondary/40 border border-border/60 p-3 text-xs">
          <p className="font-medium text-foreground">
            {message.contact_information.first_name} {message.contact_information.last_name}
          </p>
          {message.contact_information.phone_number && (
            <p className="text-muted-foreground font-mono">{message.contact_information.phone_number}</p>
          )}
        </div>
      )}

      {/* Message text */}
      {text && (
        <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
          {typeof message.text === "string" ? (
            <span>{message.text}</span>
          ) : Array.isArray(message.text) ? (
            renderTextParts(message.text as MessageText[], onHashtagClick, showLinkPreviews)
          ) : null}
        </div>
      )}

      {/* Link previews */}
      {showLinkPreviews && urls.length > 0 && (
        <div className="flex flex-col">
          {urls.slice(0, 2).map((u) => (
            <LinkPreview key={u} url={u} />
          ))}
        </div>
      )}

      {/* Reactions */}
      {message.reactions && message.reactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {message.reactions.map((r, i) => (
            <span key={`${r.emoji}-${i}`} className="flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-xs">
              <span>{r.emoji}</span>
              <span className="font-mono text-muted-foreground">{r.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 font-mono">#{message.id}</span>
          <time className="text-[10px] text-muted-foreground font-mono">
            {format(new Date(message.date), "MMM d, yyyy 'at' HH:mm")}
          </time>
        </div>
        {message.edited && (
          <span className="text-[10px] text-muted-foreground/60 italic" title={message.edited}>
            edited {format(new Date(message.edited), "MMM d 'at' HH:mm")}
          </span>
        )}
      </div>
    </article>
  )
}
