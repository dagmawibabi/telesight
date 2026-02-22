"use client"

import { useMemo, useState, useCallback } from "react"
import { ChannelHeader } from "./channel-header"
import { FilterToolbar, type FilterType } from "./filter-toolbar"
import { MasonryGrid } from "./masonry-grid"
import { HashtagHeader } from "./hashtag-header"
import type { TelegramExport, TelegramMessage, SortDirection } from "@/lib/telegram-types"
import {
  computeStats,
  getMessageText,
  groupByMonth,
} from "@/lib/telegram-types"
import { ArrowLeft, FolderOpen, Check } from "lucide-react"
import { buildMediaFileMap, type MediaFileMap } from "@/hooks/use-media-url"
import { useRef } from "react"

interface ChannelViewerProps {
  data: TelegramExport
  onReset: () => void
  mediaFileMap: MediaFileMap | null
  folderName: string | null
  onMediaFolderLoaded: (map: MediaFileMap, folderName: string) => void
}

export function ChannelViewer({ data, onReset, mediaFileMap, folderName, onMediaFolderLoaded }: ChannelViewerProps) {
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [sortDirection, setSortDirection] = useState<SortDirection>("newest")
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null)

  const stats = useMemo(() => computeStats(data), [data])

  const messageMap = useMemo(() => {
    const map = new Map<number, TelegramMessage>()
    for (const msg of data.messages) {
      map.set(msg.id, msg)
    }
    return map
  }, [data.messages])

  const filteredMessages = useMemo(() => {
    let msgs = data.messages

    // Apply filter
    switch (activeFilter) {
      case "has_links": {
        msgs = msgs.filter((m) => {
          if (m.type !== "message") return false
          const text = getMessageText(m)
          return text.includes("http://") || text.includes("https://")
        })
        break
      }
      case "has_reactions":
        msgs = msgs.filter(
          (m) =>
            m.type === "message" && m.reactions && m.reactions.length > 0
        )
        break
      case "forwarded":
        msgs = msgs.filter(
          (m) => m.type === "message" && m.forwarded_from
        )
        break
      case "replies":
        msgs = msgs.filter(
          (m) => m.type === "message" && m.reply_to_message_id
        )
        break
      case "service":
        msgs = msgs.filter((m) => m.type === "service")
        break
      default:
        break
    }

    // Apply hashtag filter
    if (activeHashtag) {
      const tag = activeHashtag.toLowerCase()
      msgs = msgs.filter((m) => {
        const text = getMessageText(m).toLowerCase()
        return text.includes(tag)
      })
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      msgs = msgs.filter((m) => {
        const text = getMessageText(m).toLowerCase()
        const from = (m.from || m.actor || "").toLowerCase()
        const forwarded = (m.forwarded_from || "").toLowerCase()
        return (
          text.includes(query) ||
          from.includes(query) ||
          forwarded.includes(query)
        )
      })
    }

    return msgs
  }, [data.messages, activeFilter, searchQuery, activeHashtag])

  const monthGroups = useMemo(
    () => groupByMonth(filteredMessages, sortDirection),
    [filteredMessages, sortDirection]
  )

  const handleHashtagClick = useCallback((hashtag: string) => {
    setActiveHashtag(hashtag)
    setActiveFilter("all")
    setSearchQuery("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const clearHashtag = useCallback(() => {
    setActiveHashtag(null)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <ChannelHeader stats={stats} />
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        resultCount={filteredMessages.length}
        sortDirection={sortDirection}
        onSortChange={setSortDirection}
      />
      {activeHashtag && (
        <HashtagHeader
          hashtag={activeHashtag}
          messages={filteredMessages}
          onClear={clearHashtag}
        />
      )}
      <MasonryGrid
        monthGroups={monthGroups}
        messageMap={messageMap}
        onHashtagClick={handleHashtagClick}
        mediaFileMap={mediaFileMap}
      />

      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is a non-standard attribute
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            const map = buildMediaFileMap(files)
            const firstPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || ""
            const rootName = firstPath.split("/")[0] || "folder"
            onMediaFolderLoaded(map, rootName)
          }
        }}
      />

      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        <button
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary/30 cursor-pointer"
          aria-label="Set export folder for media"
        >
          {folderName ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[120px] truncate">{folderName}</span>
            </>
          ) : (
            <>
              <FolderOpen className="h-3.5 w-3.5" />
              Media folder
            </>
          )}
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary/30"
          aria-label="Upload different file"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New file
        </button>
      </div>
    </div>
  )
}
