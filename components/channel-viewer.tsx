"use client"

import { useMemo, useState, useCallback } from "react"
import { ChannelHeader } from "./channel-header"
import { FilterToolbar, type FilterType, type DisplayToggles } from "./filter-toolbar"
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
import { CalendarView } from "./calendar-view"
import { PostDetailView } from "./post-detail-view"
import { StatsView } from "./stats-view"
import { ReplyGraphView } from "./reply-graph-view"
import { MediaGallery } from "./media-gallery"
import { InsightsView } from "./insights-view"


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
  const [calendarOpen, setCalendarOpen] = useState<{ year: number; month: number } | null>(null)
  const [selectedPost, setSelectedPost] = useState<TelegramMessage | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [displayToggles, setDisplayToggles] = useState<DisplayToggles>({
    showMedia: true,
    showLinkPreviews: true,
  })

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

  const openCalendar = useCallback((year: number, month: number) => {
    setCalendarOpen({ year, month })
  }, [])

  const openPost = useCallback((msg: TelegramMessage) => {
    setSelectedPost(msg)
  }, [])

  const handleReplyNavigate = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary/50")
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/50")
      }, 2000)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <ChannelHeader
        stats={stats}
        onStatsClick={() => setStatsOpen(true)}
        onGraphClick={() => setGraphOpen(true)}
        onGalleryClick={() => setGalleryOpen(true)}
        onInsightsClick={() => setInsightsOpen(true)}
      />
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        resultCount={filteredMessages.length}
        sortDirection={sortDirection}
        onSortChange={setSortDirection}
        displayToggles={displayToggles}
        onDisplayToggleChange={setDisplayToggles}
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
        onMonthClick={openCalendar}
        onPostClick={openPost}
        showMedia={displayToggles.showMedia}
        showLinkPreviews={displayToggles.showLinkPreviews}
      />

      {/* Stats overlay */}
      {statsOpen && (
        <StatsView
          messages={data.messages}
          onClose={() => setStatsOpen(false)}
          onPostClick={(msg) => {
            setStatsOpen(false)
            openPost(msg)
          }}
        />
      )}

      {/* Reply graph overlay */}
      {graphOpen && (
        <ReplyGraphView
          messages={data.messages}
          onClose={() => setGraphOpen(false)}
          onPostClick={openPost}
        />
      )}

      {/* Media gallery overlay */}
      {galleryOpen && (
        <MediaGallery
          messages={data.messages}
          mediaFileMap={mediaFileMap}
          onClose={() => setGalleryOpen(false)}
          onPostClick={(msg) => {
            setGalleryOpen(false)
            openPost(msg)
          }}
        />
      )}

      {/* Insights overlay */}
      {insightsOpen && (
        <InsightsView
          messages={data.messages}
          onClose={() => setInsightsOpen(false)}
        />
      )}

      {/* Post detail overlay */}
      {selectedPost && (
        <PostDetailView
          message={selectedPost}
          allMessages={data.messages}
          channelName={data.name}
          replyToMessage={
            selectedPost.reply_to_message_id
              ? messageMap.get(selectedPost.reply_to_message_id)
              : undefined
          }
          mediaFileMap={mediaFileMap}
          onClose={() => setSelectedPost(null)}
          onHashtagClick={(tag) => {
            setSelectedPost(null)
            handleHashtagClick(tag)
          }}
          onReplyNavigate={(id) => {
            setSelectedPost(null)
            handleReplyNavigate(id)
          }}
          onPostClick={(msg) => {
            setSelectedPost(msg)
          }}
        />
      )}

      {/* Calendar overlay */}
      {calendarOpen && (
        <CalendarView
          messages={data.messages}
          initialYear={calendarOpen.year}
          initialMonth={calendarOpen.month}
          onClose={() => setCalendarOpen(null)}
          onPostClick={openPost}
        />
      )}

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
