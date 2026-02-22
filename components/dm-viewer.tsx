"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { format, isToday, isYesterday, isSameDay } from "date-fns"
import {
  ArrowLeft,
  FolderOpen,
  Check,
  Search,
  BarChart3,
  Lightbulb,
  X,
  ChevronDown,
  MessageSquare,
  Heart,
  Reply,
  Link2,
  Image,
  Forward,
  Share2,
  ImageIcon,
  Calendar,
  GitBranch,
  MessageCircle,
} from "lucide-react"
import type { TelegramExport, TelegramMessage } from "@/lib/telegram-types"
import { getMessageText, getDMParticipants, computeStats } from "@/lib/telegram-types"
import { buildMediaFileMap, useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"
import { StatsView } from "./stats-view"
import { InsightsView } from "./insights-view"
import { PostDetailView } from "./post-detail-view"
import { LinkPreview } from "./link-preview"
import { ReplyGraphView } from "./reply-graph-view"
import { MediaGallery } from "./media-gallery"
import { CalendarView } from "./calendar-view"
import { ThreadedView } from "./threaded-view"

interface DMViewerProps {
  data: TelegramExport
  onReset: () => void
  mediaFileMap: MediaFileMap | null
  folderName: string | null
  onMediaFolderLoaded: (map: MediaFileMap, folderName: string) => void
}

// ─── Date separator ─────────────────────────────────────────────────────────

function formatDateSeparator(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "EEEE, MMMM d, yyyy")
}

// ─── Chat bubble ────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  isMe,
  showAvatar,
  senderName,
  color,
  mediaFileMap,
  onReplyClick,
  replyPreview,
  onPostClick,
}: {
  message: TelegramMessage
  isMe: boolean
  showAvatar: boolean
  senderName: string
  color: string
  mediaFileMap: MediaFileMap | null
  onReplyClick?: (id: number) => void
  replyPreview?: TelegramMessage | null
  onPostClick?: (msg: TelegramMessage) => void
}) {
  const text = getMessageText(message)
  const photoPath = message.photo || (message.file && message.media_type === "video_file" ? message.thumbnail : null)
  const mediaUrl = useMediaUrl(mediaFileMap, photoPath)
  const reactions = message.reactions || []
  const totalReactions = reactions.reduce((s, r) => s + r.count, 0)
  const hasLinks = text.includes("http://") || text.includes("https://")
  const links = hasLinks ? text.match(/https?:\/\/[^\s)]+/g) || [] : []
  const time = format(new Date(message.date), "h:mm a")
  const isEdited = !!message.edited

  // Short emoji-only message gets larger rendering
  const isEmojiOnly = /^[\p{Emoji}\s]{1,8}$/u.test(text.trim()) && text.trim().length <= 8

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex items-end gap-2 max-w-[85%] md:max-w-[65%] group transition-all ${
        isMe ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 w-7">
        {showAvatar ? (
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-background"
            style={{ backgroundColor: color }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="w-7" />
        )}
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-0.5">
        {/* Reply preview */}
        {replyPreview && (
          <button
            onClick={() => onReplyClick?.(replyPreview.id)}
            className={`flex items-start gap-1.5 rounded-t-xl px-3 py-1.5 text-[10px] leading-tight border border-b-0 cursor-pointer transition-colors max-w-full ${
              isMe
                ? "bg-primary/5 border-primary/20 text-primary/70 rounded-br-none self-end hover:bg-primary/10"
                : "bg-secondary/60 border-border text-muted-foreground rounded-bl-none hover:bg-secondary"
            }`}
          >
            <Reply className="h-3 w-3 shrink-0 mt-0.5 rotate-180" />
            <span className="truncate">{getMessageText(replyPreview).slice(0, 80)}</span>
          </button>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 cursor-pointer transition-shadow hover:shadow-md ${
            isMe
              ? `bg-primary text-primary-foreground ${replyPreview ? "rounded-tr-sm" : ""}`
              : `bg-card border border-border text-foreground ${replyPreview ? "rounded-tl-sm" : ""}`
          }`}
          onClick={() => onPostClick?.(message)}
        >
          {/* Photo */}
          {mediaUrl && (
            <div className="mb-2 -mx-1 -mt-0.5 rounded-xl overflow-hidden">
              <img
                src={mediaUrl}
                alt=""
                className="w-full max-h-72 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Text */}
          {text && (
            isEmojiOnly ? (
              <p className="text-3xl leading-tight">{text}</p>
            ) : (
              <p className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                isMe ? "text-primary-foreground" : "text-foreground"
              }`}>
                {text}
              </p>
            )
          )}

          {/* Link preview */}
          {links.length > 0 && (
            <div className="mt-2">
              <LinkPreview url={links[0]} />
            </div>
          )}

          {/* Time + edited */}
          <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "justify-end" : ""}`}>
            {isEdited && (
              <span className={`text-[9px] italic ${isMe ? "text-primary-foreground/50" : "text-muted-foreground/50"}`}>
                edited
              </span>
            )}
            <span className={`text-[9px] ${isMe ? "text-primary-foreground/50" : "text-muted-foreground/50"}`}>
              {time}
            </span>
          </div>
        </div>

        {/* Reactions */}
        {totalReactions > 0 && (
          <div className={`flex items-center gap-1 ${isMe ? "justify-end" : ""}`}>
            {reactions.map((r, i) => (
              <span
                key={i}
                className="flex items-center gap-0.5 rounded-full bg-secondary/80 border border-border px-1.5 py-0.5 text-[10px]"
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-muted-foreground font-mono">{r.count}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DM Header ──────────────────────────────────────────────────────────────

function DMHeader({
  chatName,
  participants,
  messageCount,
  dateRange,
  totalReactions,
  onStatsClick,
  onInsightsClick,
  onGraphClick,
  onGalleryClick,
  onCalendarClick,
}: {
  chatName: string
  participants: [string, string]
  messageCount: number
  dateRange: { start: string; end: string }
  totalReactions: number
  onStatsClick: () => void
  onInsightsClick: () => void
  onGraphClick: () => void
  onGalleryClick: () => void
  onCalendarClick: () => void
}) {
  const startDate = dateRange.start ? format(new Date(dateRange.start), "MMM d, yyyy") : ""
  const endDate = dateRange.end ? format(new Date(dateRange.end), "MMM d, yyyy") : ""

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-3">
        {/* Row 1: Avatar + info + action buttons */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {/* Dual avatar */}
            <div className="relative flex items-center">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-background border-2 border-background z-10"
                style={{ backgroundColor: "oklch(0.7 0.15 180)" }}
              >
                {participants[0].charAt(0).toUpperCase()}
              </div>
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-background border-2 border-background -ml-3"
                style={{ backgroundColor: "oklch(0.7 0.15 30)" }}
              >
                {participants[1].charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground text-balance">
                {chatName}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {participants[0]} & {participants[1]} &middot; {startDate} &mdash; {endDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onStatsClick}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stats</span>
            </button>
            <button
              onClick={onInsightsClick}
              className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Insights</span>
            </button>
            <button
              onClick={onGraphClick}
              className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Graph</span>
            </button>
            <button
              onClick={onGalleryClick}
              className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gallery</span>
            </button>
            <button
              onClick={onCalendarClick}
              className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>

        {/* Row 2: Quick stats */}
        <div className="mt-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {messageCount.toLocaleString()} messages
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Heart className="h-3 w-3" />
            {totalReactions.toLocaleString()} reactions
          </span>
          {participants.map((p, i) => {
            const color = i === 0 ? "oklch(0.7 0.15 180)" : "oklch(0.7 0.15 30)"
            return (
              <span key={p} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {p.split(" ")[0]}
              </span>
            )
          })}
        </div>
      </div>
    </header>
  )
}

// ─── Main DM Viewer ─────────────────────────────────────────────────────────

export function DMViewer({
  data,
  onReset,
  mediaFileMap,
  folderName,
  onMediaFolderLoaded,
}: DMViewerProps) {
  const folderInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState<{ year: number; month: number } | null>(null)
  const [selectedPost, setSelectedPost] = useState<TelegramMessage | null>(null)
  const [viewMode, setViewMode] = useState<"bubble" | "threaded">("bubble")

  const participants = useMemo(
    () => getDMParticipants(data.messages) || [data.name, "You"],
    [data]
  )

  const stats = useMemo(() => computeStats(data), [data])

  // First sender -> left side, second sender -> right side ("me")
  const [personA, personB] = participants
  const colorA = "oklch(0.7 0.15 180)"
  const colorB = "oklch(0.7 0.15 30)"

  const messageMap = useMemo(() => {
    const map = new Map<number, TelegramMessage>()
    for (const msg of data.messages) map.set(msg.id, msg)
    return map
  }, [data.messages])

  const filteredMessages = useMemo(() => {
    let msgs = data.messages.filter((m) => m.type === "message")
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      msgs = msgs.filter((m) => {
        const text = getMessageText(m).toLowerCase()
        const from = (m.from || "").toLowerCase()
        return text.includes(q) || from.includes(q)
      })
    }
    // Sort chronologically (oldest first for chat view)
    return [...msgs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [data.messages, searchQuery])

  // Group messages by date for separators
  const messagesWithDates = useMemo(() => {
    const result: { type: "date"; date: Date; key: string }[] | { type: "msg"; message: TelegramMessage; key: string }[] = []
    let lastDate: string | null = null

    for (const msg of filteredMessages) {
      const d = new Date(msg.date)
      const dateKey = format(d, "yyyy-MM-dd")
      if (dateKey !== lastDate) {
        ;(result as { type: string; date?: Date; message?: TelegramMessage; key: string }[]).push({
          type: "date",
          date: d,
          key: `date-${dateKey}`,
        })
        lastDate = dateKey
      }
      ;(result as { type: string; date?: Date; message?: TelegramMessage; key: string }[]).push({
        type: "msg",
        message: msg,
        key: `msg-${msg.id}`,
      })
    }
    return result as ({ type: "date"; date: Date; key: string } | { type: "msg"; message: TelegramMessage; key: string })[]
  }, [filteredMessages])

  const handleReplyClick = useCallback((id: number) => {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary/40")
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 2000)
    }
  }, [])

  // Scroll to bottom on first load
  useEffect(() => {
    chatEndRef.current?.scrollIntoView()
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header group: header + toolbar stay together */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <DMHeader
          chatName={data.name}
          participants={participants}
          messageCount={filteredMessages.length}
          dateRange={stats.dateRange}
          totalReactions={stats.totalReactions}
          onStatsClick={() => setStatsOpen(true)}
          onInsightsClick={() => setInsightsOpen(true)}
          onGraphClick={() => setGraphOpen(true)}
          onGalleryClick={() => setGalleryOpen(true)}
          onCalendarClick={() => {
            const lastMsg = data.messages.filter(m => m.type === "message").sort((a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]
            const d = lastMsg ? new Date(lastMsg.date) : new Date()
            setCalendarOpen({ year: d.getFullYear(), month: d.getMonth() })
          }}
        />

        {/* Secondary toolbar: toggle + search */}
        <div className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 md:px-6 py-1.5 flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-0.5">
            <button
              onClick={() => setViewMode("bubble")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === "bubble" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Bubble
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

          {/* Search */}
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 min-w-0"
                autoFocus
              />
              {searchQuery && (
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{filteredMessages.length} results</span>
              )}
              <button
                onClick={() => { setShowSearch(false); setSearchQuery("") }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1">
        {viewMode === "threaded" ? (
          <ThreadedView
            messages={filteredMessages}
            topics={[]}
            activeTopic={null}
            mediaFileMap={mediaFileMap}
            onPostClick={setSelectedPost}
            onHashtagClick={() => {}}
            showMedia={true}
            showLinkPreviews={true}
          />
        ) : (
          <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 flex flex-col gap-1.5">
            {messagesWithDates.map((item, idx) => {
              if (item.type === "date") {
                return (
                  <div key={item.key} className="flex items-center justify-center my-4">
                    <div className="rounded-full bg-secondary/60 border border-border px-4 py-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatDateSeparator(item.date)}
                      </span>
                    </div>
                  </div>
                )
              }

              const msg = item.message
              const isMe = msg.from === personB
              const senderName = isMe ? personB : personA
              const color = isMe ? colorB : colorA

              // Show avatar if first message or different sender from previous message
              let showAvatar = true
              if (idx > 0) {
                const prevItem = messagesWithDates[idx - 1]
                if (prevItem.type === "msg" && prevItem.message.from === msg.from) {
                  showAvatar = false
                }
              }

              const replyPreview = msg.reply_to_message_id
                ? messageMap.get(msg.reply_to_message_id) || null
                : null

              return (
                <ChatBubble
                  key={item.key}
                  message={msg}
                  isMe={isMe}
                  showAvatar={showAvatar}
                  senderName={senderName}
                  color={color}
                  mediaFileMap={mediaFileMap}
                  onReplyClick={handleReplyClick}
                  replyPreview={replyPreview}
                  onPostClick={setSelectedPost}
                />
              )
            })}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Stats overlay */}
      {statsOpen && (
        <StatsView
          messages={data.messages}
          onClose={() => setStatsOpen(false)}
          onPostClick={(msg) => { setStatsOpen(false); setSelectedPost(msg) }}
        />
      )}

      {/* Insights overlay */}
      {insightsOpen && (
        <InsightsView messages={data.messages} onClose={() => setInsightsOpen(false)} />
      )}

      {/* Data graph overlay */}
      {graphOpen && (
        <ReplyGraphView
          messages={data.messages}
          onClose={() => setGraphOpen(false)}
          onPostClick={(msg) => {
            setGraphOpen(false)
            setSelectedPost(msg)
          }}
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
          onPostClick={setSelectedPost}
        />
      )}

      {/* Post detail */}
      {selectedPost && (
        <PostDetailView
          message={selectedPost}
          allMessages={data.messages}
          channelName={data.name}
          replyToMessage={selectedPost.reply_to_message_id ? messageMap.get(selectedPost.reply_to_message_id) : undefined}
          mediaFileMap={mediaFileMap}
          onClose={() => setSelectedPost(null)}
          onHashtagClick={() => {}}
          onReplyNavigate={handleReplyClick}
          onPostClick={setSelectedPost}
        />
      )}

      {/* Floating controls */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary/30"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
        <button
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg transition-all hover:text-foreground hover:border-primary/30 cursor-pointer"
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
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New file
        </button>
      </div>

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
    </div>
  )
}
