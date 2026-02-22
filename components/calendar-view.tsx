"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Heart,
  Link2,
  Image,
  Forward,
  Reply,
  X,
} from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"

interface CalendarViewProps {
  messages: TelegramMessage[]
  initialYear: number
  initialMonth: number
  onClose: () => void
  onDayClick?: (date: Date, messages: TelegramMessage[]) => void
  onPostClick?: (message: TelegramMessage) => void
}

interface DayStats {
  date: Date
  count: number
  reactions: number
  links: number
  media: number
  forwarded: number
  replies: number
  messages: TelegramMessage[]
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function CalendarView({
  messages,
  initialYear,
  initialMonth,
  onClose,
  onDayClick,
  onPostClick,
}: CalendarViewProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Group messages by day
  const dayMap = useMemo(() => {
    const map = new Map<string, TelegramMessage[]>()
    for (const msg of messages) {
      const d = new Date(msg.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(msg)
    }
    return map
  }, [messages])

  // Compute available year/month range
  const dateRange = useMemo(() => {
    if (messages.length === 0) return { minYear: year, maxYear: year, months: new Set<string>() }
    const months = new Set<string>()
    let minYear = Infinity
    let maxYear = -Infinity
    for (const msg of messages) {
      const d = new Date(msg.date)
      const y = d.getFullYear()
      minYear = Math.min(minYear, y)
      maxYear = Math.max(maxYear, y)
      months.add(`${y}-${d.getMonth()}`)
    }
    return { minYear, maxYear, months }
  }, [messages, year])

  // Stats for current month
  const monthDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month)
    const days: (DayStats | null)[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${month}-${day}`
      const msgs = dayMap.get(key) || []
      const regularMsgs = msgs.filter((m) => m.type === "message")

      let reactions = 0
      for (const m of regularMsgs) {
        if (m.reactions) {
          for (const r of m.reactions) reactions += r.count
        }
      }

      days.push({
        date: new Date(year, month, day),
        count: regularMsgs.length,
        reactions,
        links: regularMsgs.filter((m) => {
          const text = getMessageText(m)
          return text.includes("http://") || text.includes("https://")
        }).length,
        media: regularMsgs.filter((m) => m.photo || m.file || m.media_type).length,
        forwarded: regularMsgs.filter((m) => m.forwarded_from).length,
        replies: regularMsgs.filter((m) => m.reply_to_message_id).length,
        messages: regularMsgs,
      })
    }

    return days
  }, [year, month, dayMap])

  // Max post count for heat intensity
  const maxCount = useMemo(
    () => Math.max(1, ...monthDays.map((d) => d?.count || 0)),
    [monthDays]
  )

  // Month totals
  const monthTotals = useMemo(() => {
    let count = 0
    let reactions = 0
    let links = 0
    let media = 0
    let forwarded = 0
    let replies = 0
    for (const d of monthDays) {
      if (!d) continue
      count += d.count
      reactions += d.reactions
      links += d.links
      media += d.media
      forwarded += d.forwarded
      replies += d.replies
    }
    return { count, reactions, links, media, forwarded, replies }
  }, [monthDays])

  // Navigation
  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
    setSelectedDay(null)
  }

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
    setSelectedDay(null)
  }

  const firstDay = getFirstDayOfWeek(year, month)
  const daysInMonth = getDaysInMonth(year, month)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const selectedDayStats = selectedDay !== null ? monthDays[selectedDay - 1] : null

  // Years with data
  const yearsWithData = useMemo(() => {
    const years = new Set<number>()
    for (const key of dateRange.months) {
      years.add(parseInt(key.split("-")[0]))
    }
    return Array.from(years).sort()
  }, [dateRange.months])

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {MONTH_NAMES[month]}
              </h2>

              {/* Year selector */}
              <div className="flex items-center gap-1">
                {yearsWithData.map((y) => (
                  <button
                    key={y}
                    onClick={() => {
                      setYear(y)
                      setSelectedDay(null)
                    }}
                    className={`rounded-md px-2.5 py-1 text-sm font-mono transition-all ${
                      y === year
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToNextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close calendar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Month summary stats */}
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6 mb-6">
          {[
            { icon: MessageSquare, label: "Posts", value: monthTotals.count },
            { icon: Heart, label: "Reactions", value: monthTotals.reactions },
            { icon: Link2, label: "Links", value: monthTotals.links },
            { icon: Image, label: "Media", value: monthTotals.media },
            { icon: Forward, label: "Forwarded", value: monthTotals.forwarded },
            { icon: Reply, label: "Replies", value: monthTotals.replies },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-lg bg-card border border-border/50 px-3 py-2"
            >
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground font-mono">
                  {item.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDay + 1
              const isValidDay = dayNum >= 1 && dayNum <= daysInMonth
              const dayStats = isValidDay ? monthDays[dayNum - 1] : null
              const isSelected = isValidDay && selectedDay === dayNum
              const hasData = dayStats && dayStats.count > 0
              const intensity = hasData ? dayStats.count / maxCount : 0

              return (
                <button
                  key={i}
                  disabled={!isValidDay}
                  onClick={() => {
                    if (isValidDay) {
                      setSelectedDay(isSelected ? null : dayNum)
                      if (dayStats && onDayClick) {
                        onDayClick(dayStats.date, dayStats.messages)
                      }
                    }
                  }}
                  className={`relative flex flex-col items-start border-b border-r border-border/50 p-2 min-h-[90px] md:min-h-[110px] transition-all text-left ${
                    !isValidDay
                      ? "bg-secondary/20 cursor-default"
                      : isSelected
                        ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
                        : hasData
                          ? "hover:bg-secondary/50 cursor-pointer"
                          : "cursor-default"
                  }`}
                >
                  {isValidDay && (
                    <>
                      <span
                        className={`text-xs font-mono ${
                          hasData ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}
                      >
                        {dayNum}
                      </span>

                      {hasData && (
                        <div className="flex flex-col gap-1 mt-auto w-full">
                          {/* Heat bar */}
                          <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.max(8, intensity * 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-2.5 w-2.5 text-primary" />
                            <span className="text-[10px] font-mono font-medium text-foreground">
                              {dayStats.count}
                            </span>
                          </div>

                          {dayStats.reactions > 0 && (
                            <div className="flex items-center gap-1">
                              <Heart className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {dayStats.reactions.toLocaleString()}
                              </span>
                            </div>
                          )}

                          {dayStats.media > 0 && (
                            <div className="flex items-center gap-1">
                              <Image className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {dayStats.media}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day detail panel */}
        {selectedDayStats && selectedDayStats.count > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {selectedDayStats.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 md:grid-cols-6 mb-4">
              {[
                { icon: MessageSquare, label: "Posts", value: selectedDayStats.count },
                { icon: Heart, label: "Reactions", value: selectedDayStats.reactions },
                { icon: Link2, label: "Links", value: selectedDayStats.links },
                { icon: Image, label: "Media", value: selectedDayStats.media },
                { icon: Forward, label: "Forwarded", value: selectedDayStats.forwarded },
                { icon: Reply, label: "Replies", value: selectedDayStats.replies },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5"
                >
                  <item.icon className="h-3 w-3 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium font-mono text-foreground">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Message previews */}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-auto">
              {selectedDayStats.messages.slice(0, 20).map((msg) => {
                const text = getMessageText(msg)
                const time = new Date(msg.date).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                let reactionCount = 0
                if (msg.reactions) {
                  for (const r of msg.reactions) reactionCount += r.count
                }

                return (
                  <button
                    key={msg.id}
                    onClick={() => onPostClick?.(msg)}
                    className="flex gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-left transition-colors hover:bg-secondary/60 cursor-pointer w-full"
                  >
                    <span className="text-muted-foreground/60 font-mono shrink-0 pt-0.5">
                      {time}
                    </span>
                    <p className="text-secondary-foreground/80 line-clamp-2 flex-1 min-w-0">
                      {text || (msg.photo ? "[Photo]" : msg.file ? "[File]" : "[Media]")}
                    </p>
                    {reactionCount > 0 && (
                      <span className="text-muted-foreground/60 font-mono shrink-0 pt-0.5">
                        {reactionCount.toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
              {selectedDayStats.messages.length > 20 && (
                <p className="text-[10px] text-muted-foreground text-center py-1">
                  +{selectedDayStats.messages.length - 20} more messages
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quick month navigation */}
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {MONTH_NAMES.map((name, idx) => {
            const hasData = dateRange.months.has(`${year}-${idx}`)
            return (
              <button
                key={name}
                onClick={() => {
                  setMonth(idx)
                  setSelectedDay(null)
                }}
                disabled={!hasData}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  idx === month
                    ? "bg-primary text-primary-foreground"
                    : hasData
                      ? "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      : "text-muted-foreground/30 cursor-not-allowed"
                }`}
              >
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
