"use client"

import { useMemo, useCallback, useRef, useEffect, useState } from "react"
import { MessageCard } from "./message-card"
import { ServiceCard } from "./service-card"
import type { TelegramMessage, MonthGroup } from "@/lib/telegram-types"
import { useIsMobile } from "@/hooks/use-mobile"
import type { MediaFileMap } from "@/hooks/use-media-url"

interface MasonryGridProps {
  monthGroups: MonthGroup[]
  messageMap: Map<number, TelegramMessage>
  onHashtagClick?: (hashtag: string) => void
  mediaFileMap?: MediaFileMap | null
}

const BATCH_SIZE = 40

export function MasonryGrid({ monthGroups, messageMap, onHashtagClick, mediaFileMap }: MasonryGridProps) {
  const isMobile = useIsMobile()
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const allMessages = useMemo(() => {
    const result: { type: "month-header"; label: string; key: string }[] | { type: "message"; message: TelegramMessage; key: string }[] = []
    const flat: Array<
      | { type: "month-header"; label: string; key: string }
      | { type: "message"; message: TelegramMessage; key: string }
    > = []
    for (const group of monthGroups) {
      flat.push({
        type: "month-header",
        label: group.label,
        key: `header-${group.key}`,
      })
      for (const msg of group.messages) {
        flat.push({
          type: "message",
          message: msg,
          key: `msg-${msg.id}`,
        })
      }
    }
    return flat
  }, [monthGroups])

  const visibleItems = useMemo(
    () => allMessages.slice(0, visibleCount),
    [allMessages, visibleCount]
  )

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [monthGroups])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < allMessages.length) {
          setVisibleCount((prev) =>
            Math.min(prev + BATCH_SIZE, allMessages.length)
          )
        }
      },
      { rootMargin: "400px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, allMessages.length])

  const handleReplyClick = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary/50")
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/50")
      }, 2000)
    }
  }, [])

  const columns = isMobile ? 1 : 3
  const columnItems: Array<
    Array<
      | { type: "month-header"; label: string; key: string }
      | { type: "message"; message: TelegramMessage; key: string }
    >
  > = Array.from({ length: columns }, () => [])

  const columnHeights = new Array(columns).fill(0)

  for (const item of visibleItems) {
    if (item.type === "month-header") {
      // month headers span all columns, put them in column 0 only
      // but we want them to appear as full-width separators
      const minCol = columnHeights.indexOf(Math.min(...columnHeights))
      columnItems[minCol].push(item)
      columnHeights[minCol] += 1
    } else {
      const minCol = columnHeights.indexOf(Math.min(...columnHeights))
      columnItems[minCol].push(item)
      const textLen =
        typeof item.message.text === "string"
          ? item.message.text.length
          : Array.isArray(item.message.text)
            ? item.message.text
                .map((p) => (typeof p === "string" ? p : p.text))
                .join("").length
            : 0
      const hasReply = item.message.reply_to_message_id ? 2 : 0
      const hasMedia = item.message.photo || item.message.media_type ? 3 : 0
      const hasReactions =
        item.message.reactions && item.message.reactions.length > 0 ? 1 : 0
      columnHeights[minCol] +=
        Math.ceil(textLen / 60) + hasReply + hasMedia + hasReactions + 2
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div
        className={`grid gap-4 ${columns === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}
      >
        {columnItems.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-4">
            {col.map((item) => {
              if (item.type === "month-header") {
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                      {item.label}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                )
              }

              const msg = item.message
              if (msg.type === "service") {
                return (
                  <div key={item.key} id={`msg-${msg.id}`}>
                    <ServiceCard message={msg} />
                  </div>
                )
              }

              return (
                <div
                  key={item.key}
                  id={`msg-${msg.id}`}
                  className="transition-all duration-300"
                >
                  <MessageCard
                    message={msg}
                    replyToMessage={
                      msg.reply_to_message_id
                        ? messageMap.get(msg.reply_to_message_id)
                        : undefined
                    }
                    onReplyClick={handleReplyClick}
                    onHashtagClick={onHashtagClick}
                    mediaFileMap={mediaFileMap}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      {visibleCount < allMessages.length && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1 w-1 animate-pulse rounded-full bg-primary" />
            <span>Loading more messages...</span>
          </div>
        </div>
      )}

      {visibleCount >= allMessages.length && allMessages.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="text-xs text-muted-foreground/50">
            End of channel history
          </span>
        </div>
      )}
    </div>
  )
}
