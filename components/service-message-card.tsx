"use client"

import { format } from "date-fns"
import {
  UserPlus,
  Users,
  ArrowRightLeft,
  Pin,
  Pencil,
  MessageSquarePlus,
  Link,
  CheckSquare,
  Hash,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"

interface ServiceMessageCardProps {
  message: TelegramMessage
}

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  create_group: { icon: Users, label: "Created group", color: "text-primary" },
  migrate_to_supergroup: {
    icon: ArrowRightLeft,
    label: "Migrated to supergroup",
    color: "text-muted-foreground",
  },
  migrate_from_group: {
    icon: ArrowRightLeft,
    label: "Migrated from group",
    color: "text-muted-foreground",
  },
  invite_members: {
    icon: UserPlus,
    label: "Invited members",
    color: "text-emerald-400",
  },
  join_group_by_link: {
    icon: Link,
    label: "Joined via link",
    color: "text-emerald-400",
  },
  topic_created: {
    icon: MessageSquarePlus,
    label: "Created topic",
    color: "text-sky-400",
  },
  topic_edit: {
    icon: Pencil,
    label: "Edited topic",
    color: "text-amber-400",
  },
  pin_message: {
    icon: Pin,
    label: "Pinned a message",
    color: "text-amber-400",
  },
  edit_group_title: {
    icon: Pencil,
    label: "Changed group title",
    color: "text-amber-400",
  },
  todo_completions: {
    icon: CheckSquare,
    label: "Completed todo items",
    color: "text-emerald-400",
  },
}

export function ServiceMessageCard({ message }: ServiceMessageCardProps) {
  const action = message.action || "unknown"
  const config = ACTION_CONFIG[action] || {
    icon: Hash,
    label: action.replace(/_/g, " "),
    color: "text-muted-foreground",
  }
  const Icon = config.icon
  const actor = message.actor || message.from || "System"

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 bg-secondary/20 px-4 py-2.5 my-1">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary ${config.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-foreground">{actor}</span>
          <span className="text-xs text-muted-foreground">{config.label}</span>
          {message.title && (
            <span className="text-xs font-semibold text-foreground">
              &ldquo;{message.title}&rdquo;
            </span>
          )}
          {message.members && message.members.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {message.members.join(", ")}
            </span>
          )}
          {message.new_title && (
            <span className="text-xs font-semibold text-foreground">
              &ldquo;{message.new_title}&rdquo;
            </span>
          )}
        </div>
        <time className="text-[10px] text-muted-foreground/60 font-mono">
          {format(new Date(message.date), "MMM d, yyyy 'at' HH:mm")}
        </time>
      </div>
    </div>
  )
}
