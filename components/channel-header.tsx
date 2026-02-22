"use client"

import { format } from "date-fns"
import {
  MessageSquare,
  Link2,
  Image,
  Forward,
  Reply,
  Heart,
  BarChart3,
  Share2,
  Images,
  Lightbulb,
} from "lucide-react"
import type { ChannelStats } from "@/lib/telegram-types"

interface ChannelHeaderProps {
  stats: ChannelStats
  onStatsClick?: () => void
  onGraphClick?: () => void
  onGalleryClick?: () => void
  onInsightsClick?: () => void
}

export function ChannelHeader({ stats, onStatsClick, onGraphClick, onGalleryClick, onInsightsClick }: ChannelHeaderProps) {
  const startDate = stats.dateRange.start
    ? format(new Date(stats.dateRange.start), "MMM yyyy")
    : ""
  const endDate = stats.dateRange.end
    ? format(new Date(stats.dateRange.end), "MMM yyyy")
    : ""

  const statItems = [
    {
      icon: MessageSquare,
      label: "Messages",
      value: stats.totalMessages.toLocaleString(),
    },
    {
      icon: Heart,
      label: "Reactions",
      value: stats.totalReactions.toLocaleString(),
    },
    {
      icon: Link2,
      label: "With Links",
      value: stats.messagesWithLinks.toLocaleString(),
    },
    {
      icon: Image,
      label: "Media",
      value: stats.messagesWithMedia.toLocaleString(),
    },
    {
      icon: Forward,
      label: "Forwarded",
      value: stats.forwardedMessages.toLocaleString(),
    },
    {
      icon: Reply,
      label: "Replies",
      value: stats.repliedMessages.toLocaleString(),
    },
  ]

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <div className="h-3 w-3 rounded-sm bg-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground text-balance">
                {stats.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {startDate} &mdash; {endDate} &middot;{" "}
                {stats.type.replace("_", " ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onStatsClick && (
              <button
                onClick={onStatsClick}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </button>
            )}
            {onGraphClick && (
              <button
                onClick={onGraphClick}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
              >
                <Share2 className="h-3.5 w-3.5" />
                Data Graph
              </button>
            )}
            {onGalleryClick && (
              <button
                onClick={onGalleryClick}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
              >
                <Images className="h-3.5 w-3.5" />
                Gallery
              </button>
            )}
            {onInsightsClick && (
              <button
                onClick={onInsightsClick}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Insights
              </button>
            )}
          </div>

          {stats.topReactions.length > 0 && (
            <div className="flex items-center gap-2">
              {stats.topReactions.slice(0, 5).map((r) => (
                <span
                  key={r.emoji}
                  className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
                >
                  <span>{r.emoji}</span>
                  <span className="text-muted-foreground font-mono">
                    {r.count.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2"
            >
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground font-mono">
                  {item.value}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}
