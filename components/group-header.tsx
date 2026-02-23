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
  Users,
  Hash,
  Flame,
  Brain,
  Shield,
  User,
  FileText,
} from "lucide-react"
import type { GroupStats } from "@/lib/group-analytics"

interface GroupHeaderProps {
  stats: GroupStats
  onStatsClick?: () => void
  onGraphClick?: () => void
  onGalleryClick?: () => void
  onInsightsClick?: () => void
  onMembersClick?: () => void
  onSentimentClick?: () => void
  onFraudClick?: () => void
  onUserProfilesClick?: () => void
  onReportsClick?: () => void
}

export function GroupHeader({
  stats,
  onStatsClick,
  onGraphClick,
  onGalleryClick,
  onInsightsClick,
  onMembersClick,
  onSentimentClick,
  onFraudClick,
  onUserProfilesClick,
  onReportsClick,
}: GroupHeaderProps) {
  const startDate = stats.dateRange.start
    ? format(new Date(stats.dateRange.start), "MMM yyyy")
    : ""
  const endDate = stats.dateRange.end
    ? format(new Date(stats.dateRange.end), "MMM yyyy")
    : ""

  const statItems = [
    { icon: MessageSquare, label: "Messages", value: stats.totalMessages.toLocaleString() },
    { icon: Users, label: "Members", value: stats.totalMembers.toLocaleString() },
    { icon: Heart, label: "Reactions", value: stats.totalReactions.toLocaleString() },
    { icon: Hash, label: "Topics", value: stats.topicCount.toLocaleString() },
    { icon: Image, label: "Media", value: stats.messagesWithMedia.toLocaleString() },
    { icon: Reply, label: "Replies", value: stats.repliedMessages.toLocaleString() },
  ]

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground text-balance">
                {stats.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {startDate} &mdash; {endDate} &middot; Group &middot;{" "}
                {stats.totalMembers} members
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onMembersClick && (
              <button
                onClick={onMembersClick}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
              >
                <Users className="h-3.5 w-3.5" />
                Members
              </button>
            )}
            {onStatsClick && (
              <button
                onClick={onStatsClick}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-primary/30"
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
            {onSentimentClick && (
              <button
                onClick={onSentimentClick}
                className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-500 transition-all hover:bg-purple-500/20"
              >
                <Brain className="h-3.5 w-3.5" />
                Sentiment
              </button>
            )}
            {onFraudClick && (
              <button
                onClick={onFraudClick}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/20"
              >
                <Shield className="h-3.5 w-3.5" />
                Fraud
              </button>
            )}
            {onUserProfilesClick && (
              <button
                onClick={onUserProfilesClick}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-500 transition-all hover:bg-blue-500/20"
              >
                <User className="h-3.5 w-3.5" />
                Users
              </button>
            )}
            {onReportsClick && (
              <button
                onClick={onReportsClick}
                className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-500 transition-all hover:bg-green-500/20"
              >
                <FileText className="h-3.5 w-3.5" />
                Reports
              </button>
            )}
          </div>

          {stats.topReactions.length > 0 && (
            <div className="flex items-center gap-2">
              {stats.topReactions.slice(0, 5).map((r) => (
                <span key={r.emoji} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                  <span>{r.emoji}</span>
                  <span className="text-muted-foreground font-mono">{r.count.toLocaleString()}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
          {statItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground font-mono">{item.value}</span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}
