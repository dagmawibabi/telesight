"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { format } from "date-fns"
import { MessageSquare, ChevronDown, ChevronRight, Forward, Reply, ExternalLink, Eye, CheckSquare } from "lucide-react"
import type { TelegramMessage, MessageText } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useMediaUrl, type MediaFileMap } from "@/hooks/use-media-url"
import type { Topic } from "@/lib/group-analytics"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ThreadNode {
  message: TelegramMessage
  children: ThreadNode[]
  depth: number
}

interface ThreadedViewProps {
  messages: TelegramMessage[]
  topics: Topic[]
  activeTopic: number | null
  mediaFileMap?: MediaFileMap | null
  onPostClick?: (message: TelegramMessage) => void
  onHashtagClick?: (hashtag: string) => void
  showMedia?: boolean
  showLinkPreviews?: boolean
  currentUser?: string | null
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const MEMBER_COLORS = [
  "oklch(0.75 0.15 180)",
  "oklch(0.75 0.15 280)",
  "oklch(0.75 0.15 30)",
  "oklch(0.7 0.15 140)",
  "oklch(0.7 0.15 350)",
  "oklch(0.75 0.15 230)",
  "oklch(0.7 0.15 60)",
  "oklch(0.7 0.15 310)",
]

const THREAD_DEPTH_COLORS = [
  "oklch(0.6 0.12 180)",
  "oklch(0.6 0.12 250)",
  "oklch(0.6 0.12 30)",
  "oklch(0.6 0.12 140)",
  "oklch(0.6 0.12 310)",
  "oklch(0.6 0.12 60)",
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

// ─── Tree Builder ───────────────────────────────────────────────────────────

function buildThreads(
  messages: TelegramMessage[],
  topics: Topic[],
  activeTopic: number | null
): ThreadNode[] {
  const topicIds = new Set(topics.map((t) => t.id))
  const msgMap = new Map<number, TelegramMessage>()
  const childrenMap = new Map<number, TelegramMessage[]>()

  // Only include actual messages (not service)
  const filtered = messages.filter((m) => m.type === "message")
  for (const msg of filtered) msgMap.set(msg.id, msg)

  // Group children by parent
  for (const msg of filtered) {
    if (msg.reply_to_message_id) {
      const parentId = msg.reply_to_message_id
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
      childrenMap.get(parentId)!.push(msg)
    }
  }

  // Find root messages: either no reply_to, or reply_to a topic root
  const rootMessages = filtered.filter((msg) => {
    if (!msg.reply_to_message_id) return true
    // If replying to a topic root, treat as root of the topic thread
    if (topicIds.has(msg.reply_to_message_id)) {
      if (activeTopic !== null) return msg.reply_to_message_id === activeTopic
      return true
    }
    // If the parent is not in our message set, treat as root
    if (!msgMap.has(msg.reply_to_message_id)) return true
    return false
  })

  // If filtering by topic, also include only messages whose chain leads to that topic
  let roots = rootMessages
  if (activeTopic !== null) {
    const topicMsgIds = new Set<number>()
    // BFS: find all messages in this topic's tree
    const queue = roots.filter(
      (m) => m.reply_to_message_id === activeTopic
    )
    for (const m of queue) topicMsgIds.add(m.id)
    let idx = 0
    while (idx < queue.length) {
      const current = queue[idx++]
      const children = childrenMap.get(current.id) || []
      for (const child of children) {
        if (!topicMsgIds.has(child.id)) {
          topicMsgIds.add(child.id)
          queue.push(child)
        }
      }
    }
    roots = roots.filter((m) => topicMsgIds.has(m.id))
  }

  // Build trees recursively
  function buildNode(msg: TelegramMessage, depth: number): ThreadNode {
    const children = (childrenMap.get(msg.id) || [])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return {
      message: msg,
      depth,
      children: children.map((c) => buildNode(c, depth + 1)),
    }
  }

  // Sort roots by latest activity (most recent message in thread)
  function getLatestDate(node: ThreadNode): number {
    let latest = new Date(node.message.date).getTime()
    for (const child of node.children) {
      latest = Math.max(latest, getLatestDate(child))
    }
    return latest
  }

  const trees = roots.map((m) => buildNode(m, 0))
  trees.sort((a, b) => getLatestDate(b) - getLatestDate(a))
  return trees
}

function countNodes(node: ThreadNode): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0)
}

// ─── Thread Message ─────────────────────────────────────────────────────────

function ThreadMessage({
  node,
  onPostClick,
  onHashtagClick,
  mediaFileMap,
  showMedia,
  showLinkPreviews,
  isLast,
  currentUser,
}: {
  node: ThreadNode
  onPostClick?: (msg: TelegramMessage) => void
  onHashtagClick?: (hashtag: string) => void
  mediaFileMap?: MediaFileMap | null
  showMedia?: boolean
  showLinkPreviews?: boolean
  isLast: boolean
  currentUser?: string | null
}) {
  const msg = node.message
  const text = getMessageText(msg)
  const senderName = msg.from || msg.actor || "Unknown"
  const isMe = !!(currentUser && senderName.toLowerCase() === currentUser.toLowerCase())
  const senderColor = hashColor(senderName)
  const threadColor = THREAD_DEPTH_COLORS[node.depth % THREAD_DEPTH_COLORS.length]
  const hasChildren = node.children.length > 0
  const [collapsed, setCollapsed] = useState(node.depth > 3 && node.children.length > 0)

  const photoUrl = useMediaUrl(mediaFileMap ?? null, msg.photo)
  const resolvedMediaUrl = photoUrl
  const hasMedia = !!(msg.photo || msg.media_type || msg.file)

  const totalReactions = msg.reactions?.reduce((s, r) => s + r.count, 0) || 0

  return (
    <div className="flex gap-0">
      {/* Thread connector column */}
      {node.depth > 0 && (
        <div className="flex flex-col items-center w-6 shrink-0 relative">
          {/* Vertical line from parent */}
          <div
            className="w-0.5 absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              backgroundColor: threadColor,
              opacity: 0.3,
              height: isLast ? "20px" : "100%",
            }}
          />
          {/* Horizontal connector to message */}
          <div
            className="h-0.5 absolute top-5 left-1/2"
            style={{
              backgroundColor: threadColor,
              opacity: 0.3,
              width: "12px",
            }}
          />
          {/* Node dot */}
          <div
            className="h-2 w-2 rounded-full absolute top-[16px] left-1/2 -translate-x-1/2 z-[1]"
            style={{ backgroundColor: threadColor }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Message card */}
        <div
          onClick={() => onPostClick?.(msg)}
          className={`group/thread rounded-lg border p-3 transition-all cursor-pointer ${
            isMe
              ? "border-primary/30 bg-primary/[0.08] hover:border-primary/40 hover:bg-primary/[0.12]"
              : "border-border bg-card hover:border-primary/20 hover:bg-card/80"
          }`}
          style={{
            borderLeftWidth: node.depth > 0 ? "2px" : undefined,
            borderLeftColor: node.depth > 0 ? threadColor : undefined,
          }}
        >
          {/* Sender row */}
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background"
              style={{ backgroundColor: senderColor }}
            >
              {senderName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold truncate" style={{ color: senderColor }}>
              {senderName}
            </span>
            <time className="text-[10px] text-muted-foreground/60 font-mono ml-auto shrink-0">
              {format(new Date(msg.date), "MMM d, HH:mm")}
            </time>
          </div>

          {/* Forwarded */}
          {msg.forwarded_from && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
              <Forward className="h-2.5 w-2.5" />
              <span>fwd from <span className="font-medium text-foreground/80">{msg.forwarded_from}</span></span>
            </div>
          )}

          {/* Media thumbnail */}
          {hasMedia && showMedia && resolvedMediaUrl && (
            <div className="rounded-md overflow-hidden bg-secondary/30 mb-2 max-h-48" onClick={(e) => e.stopPropagation()}>
              <img src={resolvedMediaUrl} alt="" className="w-full max-h-48 object-cover" loading="lazy" />
            </div>
          )}

          {/* Todo list */}
          {msg.todo_list && (
            <div className="rounded-md bg-secondary/40 border border-border/60 p-2 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckSquare className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-semibold text-foreground">{msg.todo_list.title}</span>
              </div>
              {msg.todo_list.answers.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-1.5 ml-1">
                  <div className="h-3 w-3 rounded-sm border border-border/80 shrink-0" />
                  <span className="text-[10px] text-foreground/80 truncate">{item.text}</span>
                </div>
              ))}
              {msg.todo_list.answers.length > 3 && (
                <span className="text-[9px] text-muted-foreground ml-5">+{msg.todo_list.answers.length - 3} more</span>
              )}
            </div>
          )}

          {/* Message text */}
          {text && (
            <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words line-clamp-6">
              {text}
            </p>
          )}

          {/* Reactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-2">
              {msg.reactions.map((r, i) => (
                <span key={`${r.emoji}-${i}`} className="flex items-center gap-0.5 rounded-full bg-secondary/70 px-1.5 py-0.5 text-[10px]">
                  <span>{r.emoji}</span>
                  <span className="font-mono text-muted-foreground">{r.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Thread metadata */}
          {node.depth === 0 && hasChildren && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono">
                {countNodes(node) - 1} {countNodes(node) - 1 === 1 ? "reply" : "replies"}
              </span>
              {totalReactions > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {totalReactions} reactions
                </span>
              )}
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && (
          <div className="mt-1">
            {node.children.length > 2 && node.depth > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1 ml-2 mb-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {collapsed
                  ? `Show ${node.children.length} replies`
                  : `${node.children.length} replies`}
              </button>
            )}
            {!collapsed && (
              <div className="flex flex-col gap-1.5 ml-1 relative">
                {node.children.map((child, i) => (
                  <ThreadMessage
                    key={child.message.id}
                    node={child}
                    onPostClick={onPostClick}
                    onHashtagClick={onHashtagClick}
                    mediaFileMap={mediaFileMap}
                    showMedia={showMedia}
                    showLinkPreviews={showLinkPreviews}
                    isLast={i === node.children.length - 1}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Threaded View ─────────────────────────────────────────────────────

const BATCH_SIZE = 20

export function ThreadedView({
  messages,
  topics,
  activeTopic,
  mediaFileMap,
  onPostClick,
  onHashtagClick,
  showMedia = true,
  showLinkPreviews = true,
  currentUser,
}: ThreadedViewProps) {
  const threads = useMemo(
    () => buildThreads(messages, topics, activeTopic),
    [messages, topics, activeTopic]
  )

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setVisibleCount(BATCH_SIZE), [threads])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < threads.length) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, threads.length))
        }
      },
      { rootMargin: "400px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, threads.length])

  const visibleThreads = threads.slice(0, visibleCount)

  if (threads.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm">No threads found</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            {threads.length} conversation {threads.length === 1 ? "thread" : "threads"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {visibleThreads.map((thread) => (
          <div
            key={thread.message.id}
            className="rounded-xl border border-border/50 bg-secondary/10 p-3"
          >
            <ThreadMessage
              node={thread}
              onPostClick={onPostClick}
              onHashtagClick={onHashtagClick}
              mediaFileMap={mediaFileMap}
              showMedia={showMedia}
              showLinkPreviews={showLinkPreviews}
              isLast={false}
              currentUser={currentUser}
            />
          </div>
        ))}
      </div>

      {visibleCount < threads.length && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1 w-1 animate-pulse rounded-full bg-primary" />
            <span>Loading more threads...</span>
          </div>
        </div>
      )}

      {visibleCount >= threads.length && threads.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="text-xs text-muted-foreground/50">All threads loaded</span>
        </div>
      )}
    </div>
  )
}
