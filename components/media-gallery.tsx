"use client"

import { useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import {
  X,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Play,
  Heart,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"

type MediaCategory = "photos" | "videos" | "music" | "other"

interface MediaGalleryProps {
  messages: TelegramMessage[]
  mediaFileMap: MediaFileMap | null
  onClose: () => void
  onPostClick?: (message: TelegramMessage) => void
}

interface MediaItem {
  message: TelegramMessage
  category: MediaCategory
  path: string | null
  thumbPath: string | null
  label: string
}

function categorizeMedia(messages: TelegramMessage[]): MediaItem[] {
  const items: MediaItem[] = []

  for (const msg of messages) {
    if (msg.type !== "message") continue

    const isVideo =
      msg.media_type === "video_file" || msg.mime_type?.startsWith("video/")
    const isAnimation = msg.media_type === "animation"
    const isSticker = msg.media_type === "sticker"
    const isAudio =
      msg.media_type === "audio_file" ||
      msg.media_type === "voice_message" ||
      msg.mime_type?.startsWith("audio/")

    if (msg.photo) {
      items.push({
        message: msg,
        category: "photos",
        path: msg.photo,
        thumbPath: msg.thumbnail || null,
        label: "Photo",
      })
    } else if (isVideo || isAnimation) {
      items.push({
        message: msg,
        category: "videos",
        path: msg.file || null,
        thumbPath: msg.thumbnail || null,
        label: isAnimation ? "GIF" : "Video",
      })
    } else if (isAudio) {
      items.push({
        message: msg,
        category: "music",
        path: msg.file || null,
        thumbPath: null,
        label: msg.file_name || "Audio",
      })
    } else if (isSticker) {
      items.push({
        message: msg,
        category: "other",
        path: msg.file || null,
        thumbPath: msg.thumbnail || null,
        label: `Sticker ${msg.sticker_emoji || ""}`,
      })
    } else if (msg.file) {
      items.push({
        message: msg,
        category: "other",
        path: msg.file,
        thumbPath: msg.thumbnail || null,
        label: msg.file_name || "File",
      })
    }
  }

  return items.sort(
    (a, b) =>
      new Date(b.message.date).getTime() - new Date(a.message.date).getTime()
  )
}

// Single media tile component that uses the hook for URL resolution
function MediaTile({
  item,
  mediaFileMap,
  onPostClick,
}: {
  item: MediaItem
  mediaFileMap: MediaFileMap | null
  onPostClick?: (message: TelegramMessage) => void
}) {
  const resolvedUrl = useMediaUrl(mediaFileMap, item.path)
  const thumbUrl = useMediaUrl(mediaFileMap, item.thumbPath)
  const displayUrl = thumbUrl || resolvedUrl

  const reactions = item.message.reactions?.reduce((s, r) => s + r.count, 0) || 0
  const text = getMessageText(item.message)

  if (item.category === "music") {
    return (
      <button
        onClick={() => onPostClick?.(item.message)}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/30 cursor-pointer w-full"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Music className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate">
            {item.label}
          </span>
          {item.message.duration_seconds != null && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {Math.floor(item.message.duration_seconds / 60)}:
              {String(Math.round(item.message.duration_seconds % 60)).padStart(2, "0")}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(item.message.date), "MMM d, yyyy")}
          </span>
        </div>
        {reactions > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" />
            <span className="font-mono">{reactions}</span>
          </div>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={() => onPostClick?.(item.message)}
      className="group relative aspect-square rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30 cursor-pointer"
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={item.label}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-secondary/30">
          {item.category === "videos" ? (
            <Film className="h-8 w-8 text-muted-foreground/30" />
          ) : item.category === "photos" ? (
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground/30" />
          )}
        </div>
      )}

      {/* Video play indicator */}
      {item.category === "videos" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
            <Play className="h-4 w-4 text-foreground ml-0.5" />
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent p-2.5 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-foreground/80 font-mono">
            #{item.message.id}
          </span>
          {reactions > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-foreground/80">
              <Heart className="h-2.5 w-2.5" />
              <span className="font-mono">{reactions}</span>
            </div>
          )}
        </div>
        {text && (
          <p className="text-[10px] text-foreground/60 truncate mt-0.5">
            {text.slice(0, 60)}
          </p>
        )}
      </div>
    </button>
  )
}

const CATEGORIES: { id: MediaCategory; label: string; icon: React.ElementType }[] = [
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Film },
  { id: "music", label: "Music", icon: Music },
  { id: "other", label: "Other", icon: FileText },
]

export function MediaGallery({
  messages,
  mediaFileMap,
  onClose,
  onPostClick,
}: MediaGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<MediaCategory>("photos")

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const allMedia = useMemo(() => categorizeMedia(messages), [messages])

  const categoryCounts = useMemo(() => {
    const counts: Record<MediaCategory, number> = { photos: 0, videos: 0, music: 0, other: 0 }
    for (const item of allMedia) counts[item.category]++
    return counts
  }, [allMedia])

  const filtered = useMemo(
    () => allMedia.filter((item) => item.category === activeCategory),
    [allMedia, activeCategory]
  )

  // Auto-select first category with content
  useEffect(() => {
    if (categoryCounts[activeCategory] === 0) {
      const first = CATEGORIES.find((c) => categoryCounts[c.id] > 0)
      if (first) setActiveCategory(first.id)
    }
  }, [categoryCounts, activeCategory])

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Media Gallery</h1>
              <p className="text-xs text-muted-foreground">
                {allMedia.length.toLocaleString()} items total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeCategory === cat.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
                <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                  {categoryCounts[cat.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            {CATEGORIES.find((c) => c.id === activeCategory)?.icon &&
              (() => {
                const Icon = CATEGORIES.find((c) => c.id === activeCategory)!.icon
                return <Icon className="h-10 w-10 text-muted-foreground/30" />
              })()}
            <p className="text-sm">
              No {activeCategory} found in this channel
            </p>
          </div>
        ) : activeCategory === "music" ? (
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            {filtered.map((item) => (
              <MediaTile
                key={item.message.id}
                item={item}
                mediaFileMap={mediaFileMap}
                onPostClick={onPostClick}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((item) => (
              <MediaTile
                key={item.message.id}
                item={item}
                mediaFileMap={mediaFileMap}
                onPostClick={onPostClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
