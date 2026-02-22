"use client"

import { useMemo, useState } from "react"
import { ChannelHeader } from "./channel-header"
import { FilterToolbar, type FilterType } from "./filter-toolbar"
import { MasonryGrid } from "./masonry-grid"
import type { TelegramExport, TelegramMessage, SortDirection } from "@/lib/telegram-types"
import {
  computeStats,
  getMessageText,
  groupByMonth,
} from "@/lib/telegram-types"
import { ArrowLeft } from "lucide-react"

interface ChannelViewerProps {
  data: TelegramExport
  onReset: () => void
}

export function ChannelViewer({ data, onReset }: ChannelViewerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [sortDirection, setSortDirection] = useState<SortDirection>("newest")

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
  }, [data.messages, activeFilter, searchQuery])

  const monthGroups = useMemo(
    () => groupByMonth(filteredMessages, sortDirection),
    [filteredMessages, sortDirection]
  )

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
      <MasonryGrid monthGroups={monthGroups} messageMap={messageMap} />

      {/* Back button */}
      <div className="fixed bottom-6 right-6 z-50">
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
