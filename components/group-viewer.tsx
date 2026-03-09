"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { GroupHeader } from "./group-header"
import { FilterToolbar, type FilterType, type DisplayToggles } from "./filter-toolbar"
import { GroupMasonryGrid } from "./group-masonry-grid"
import { HashtagHeader } from "./hashtag-header"
import type { TelegramExport, TelegramMessage, SortDirection } from "@/lib/telegram-types"
import { getMessageText, groupByMonth } from "@/lib/telegram-types"
import {
  computeGroupStats,
  extractTopics,
  type Topic,
} from "@/lib/group-analytics"
import { ArrowLeft, FolderOpen, Check, List, Calendar } from "lucide-react"
import { buildMediaFileMap, type MediaFileMap } from "@/hooks/use-media-url"
import { CalendarView } from "./calendar-view"
import { PostDetailView } from "./post-detail-view"
import { StatsView } from "./stats-view"
import { ReplyGraphView } from "./reply-graph-view"
import { MediaGallery } from "./media-gallery"
import { InsightsView } from "./insights-view"
import { MemberAnalyticsView } from "./member-analytics-view"
import { ThreadedView } from "./threaded-view"
import { GitBranch } from "lucide-react"
import { ConflictView } from "./conflict-view"
import { SentimentView } from "./sentiment-view"
import { FraudView } from "./fraud-view"
import { UserProfilesView } from "./user-profiles-view"
import { ReportsView } from "./reports-view"
import { AIChatWidget } from "./ai-chat-widget"

interface GroupViewerProps {
  data: TelegramExport
  onReset: () => void
  mediaFileMap: MediaFileMap | null
  folderName: string | null
  onMediaFolderLoaded: (map: MediaFileMap, folderName: string) => void
}

export function GroupViewer({ data, onReset, mediaFileMap, folderName, onMediaFolderLoaded }: GroupViewerProps) {
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
  const [membersOpen, setMembersOpen] = useState(false)
  const [sentimentOpen, setSentimentOpen] = useState(false)
  const [fraudOpen, setFraudOpen] = useState(false)
  const [userProfilesOpen, setUserProfilesOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [displayToggles, setDisplayToggles] = useState<DisplayToggles>({
    showMedia: true,
    showLinkPreviews: true,
  })

  // View mode: chronological vs topic-based vs threaded
  const [viewMode, setViewMode] = useState<"chronological" | "topics" | "threaded">("chronological")
  const [activeTopic, setActiveTopic] = useState<number | null>(null)

  const stats = useMemo(() => computeGroupStats(data), [data])
  const topics = useMemo(() => extractTopics(data.messages), [data.messages])

  const messageMap = useMemo(() => {
    const map = new Map<number, TelegramMessage>()
    for (const msg of data.messages) map.set(msg.id, msg)
    return map
  }, [data.messages])

  const filteredMessages = useMemo(() => {
    let msgs = data.messages

    // If topic view with a selected topic, filter to topic messages
    if (viewMode === "topics" && activeTopic !== null) {
      msgs = msgs.filter(
        (m) => m.reply_to_message_id === activeTopic || m.id === activeTopic
      )
    }

    switch (activeFilter) {
      case "has_links":
        msgs = msgs.filter((m) => {
          if (m.type !== "message") return false
          const text = getMessageText(m)
          return text.includes("http://") || text.includes("https://")
        })
        break
      case "has_reactions":
        msgs = msgs.filter((m) => m.type === "message" && m.reactions && m.reactions.length > 0)
        break
      case "forwarded":
        msgs = msgs.filter((m) => m.type === "message" && m.forwarded_from)
        break
      case "replies":
        msgs = msgs.filter((m) => m.type === "message" && m.reply_to_message_id)
        break
      case "service":
        msgs = msgs.filter((m) => m.type === "service")
        break
      default:
        break
    }

    if (activeHashtag) {
      const tag = activeHashtag.toLowerCase()
      msgs = msgs.filter((m) => getMessageText(m).toLowerCase().includes(tag))
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      msgs = msgs.filter((m) => {
        const text = getMessageText(m).toLowerCase()
        const from = (m.from || m.actor || "").toLowerCase()
        return text.includes(query) || from.includes(query)
      })
    }

    return msgs
  }, [data.messages, activeFilter, searchQuery, activeHashtag, viewMode, activeTopic])

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

  const clearHashtag = useCallback(() => { setActiveHashtag(null) }, [])
  const openCalendar = useCallback((year: number, month: number) => { setCalendarOpen({ year, month }) }, [])
  const openPost = useCallback((msg: TelegramMessage) => { setSelectedPost(msg) }, [])

  const handleReplyNavigate = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary/50")
      setTimeout(() => { el.classList.remove("ring-2", "ring-primary/50") }, 2000)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <GroupHeader
        stats={stats}
        onStatsClick={() => setStatsOpen(true)}
        onGraphClick={() => setGraphOpen(true)}
        onGalleryClick={() => setGalleryOpen(true)}
        onInsightsClick={() => setInsightsOpen(true)}
        onMembersClick={() => setMembersOpen(true)}
        onSentimentClick={() => setSentimentOpen(true)}
        onFraudClick={() => setFraudOpen(true)}
        onUserProfilesClick={() => setUserProfilesOpen(true)}
        onReportsClick={() => setReportsOpen(true)}
      />

      {/* Topic/Chronological toggle bar */}
      <div className="sticky top-[105px] md:top-[117px] z-[25] border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
              <button
                onClick={() => { setViewMode("chronological"); setActiveTopic(null) }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "chronological" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Chronological
              </button>
              <button
                onClick={() => setViewMode("topics")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "topics" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Topics
              </button>
              <button
                onClick={() => setViewMode("threaded")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "threaded" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Threaded
              </button>
            </div>

            {/* Topic pills in topic and threaded modes */}
            {(viewMode === "topics" || viewMode === "threaded") && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
                <button
                  onClick={() => setActiveTopic(null)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    activeTopic === null ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  All Topics
                </button>
                {topics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTopic(t.id)}
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      activeTopic === t.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    {t.title}
                    <span className="ml-1 font-mono text-muted-foreground/60">{t.messageCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
        <HashtagHeader hashtag={activeHashtag} messages={filteredMessages} onClear={clearHashtag} />
      )}

      {viewMode === "threaded" ? (
        <ThreadedView
          messages={filteredMessages}
          topics={topics}
          activeTopic={activeTopic}
          mediaFileMap={mediaFileMap}
          onPostClick={openPost}
          onHashtagClick={handleHashtagClick}
          showMedia={displayToggles.showMedia}
          showLinkPreviews={displayToggles.showLinkPreviews}
        />
      ) : (
        <GroupMasonryGrid
          monthGroups={monthGroups}
          messageMap={messageMap}
          topics={topics}
          onHashtagClick={handleHashtagClick}
          mediaFileMap={mediaFileMap}
          onMonthClick={openCalendar}
          onPostClick={openPost}
          showMedia={displayToggles.showMedia}
          showLinkPreviews={displayToggles.showLinkPreviews}
          viewMode={viewMode}
          activeTopic={activeTopic}
        />
      )}

      {/* Stats overlay */}
      {statsOpen && (
        <StatsView
          messages={data.messages}
          onClose={() => setStatsOpen(false)}
          onPostClick={(msg) => { setStatsOpen(false); openPost(msg) }}
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
          onPostClick={(msg) => { setGalleryOpen(false); openPost(msg) }}
        />
      )}

      {/* Insights overlay */}
      {insightsOpen && (
        <InsightsView messages={data.messages} onClose={() => setInsightsOpen(false)} />
      )}

      {/* Member analytics overlay */}
      {membersOpen && (
        <MemberAnalyticsView
          messages={data.messages}
          onClose={() => setMembersOpen(false)}
          onPostClick={(msg) => { setMembersOpen(false); openPost(msg) }}
        />
      )}

      {/* Sentiment Analysis overlay */}
      {sentimentOpen && (
        <SentimentView
          messages={data.messages}
          onClose={() => setSentimentOpen(false)}
          onPostClick={(msg) => {
            setSentimentOpen(false)
            openPost(msg)
          }}
          mediaFileMap={mediaFileMap}
        />
      )}

      {/* Fraud detection overlay */}
      {fraudOpen && (
        <FraudView
          messages={data.messages}
          onClose={() => setFraudOpen(false)}
          onPostClick={(msg) => {
            setFraudOpen(false)
            openPost(msg)
          }}
          mediaFileMap={mediaFileMap}
        />
      )}

      {/* User Profiles overlay */}
      {userProfilesOpen && (
        <UserProfilesView
          messages={data.messages}
          onClose={() => setUserProfilesOpen(false)}
        />
      )}

      {/* Reports overlay */}
      {reportsOpen && (
        <ReportsView
          messages={data.messages}
          onClose={() => setReportsOpen(false)}
        />
      )}

      {/* Post detail overlay */}
      {selectedPost && (
        <PostDetailView
          message={selectedPost}
          allMessages={data.messages}
          channelName={data.name}
          replyToMessage={selectedPost.reply_to_message_id ? messageMap.get(selectedPost.reply_to_message_id) : undefined}
          mediaFileMap={mediaFileMap}
          onClose={() => setSelectedPost(null)}
          onHashtagClick={(tag) => { setSelectedPost(null); handleHashtagClick(tag) }}
          onReplyNavigate={(id) => { setSelectedPost(null); handleReplyNavigate(id) }}
          onPostClick={(msg) => { setSelectedPost(msg) }}
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
      {/* AI Chat - Puter.js (free, no API key) */}
      <AIChatWidget messages={data.messages} />
    </div>
  )
}
