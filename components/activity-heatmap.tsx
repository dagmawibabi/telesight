"use client"

import { useMemo, useState } from "react"
import type { TelegramMessage } from "@/lib/telegram-types"

interface ActivityHeatmapProps {
  messages: TelegramMessage[]
  onDayClick?: (date: Date) => void
}

interface DayData {
  date: Date
  count: number
  key: string
}

export function ActivityHeatmap({ messages, onDayClick }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null)

  const { weeks, maxCount, monthLabels, totalDays, activeDays, dateRange } = useMemo(() => {
    // Group messages by date key
    const dayMap = new Map<string, number>()
    let minDate: Date | null = null
    let maxDate: Date | null = null

    for (const msg of messages) {
      if (msg.type !== "message") continue
      const d = new Date(msg.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      dayMap.set(key, (dayMap.get(key) || 0) + 1)
      if (!minDate || d < minDate) minDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (!maxDate || d > maxDate) maxDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    }

    if (!minDate || !maxDate) {
      return { weeks: [], maxCount: 0, monthLabels: [], totalDays: 0, activeDays: 0, dateRange: "" }
    }

    // Start from the Sunday of the week containing minDate
    const start = new Date(minDate)
    start.setDate(start.getDate() - start.getDay())

    // End at the Saturday of the week containing maxDate
    const end = new Date(maxDate)
    end.setDate(end.getDate() + (6 - end.getDay()))

    const weeks: DayData[][] = []
    let currentWeek: DayData[] = []
    let max = 0
    let totalDays = 0
    let activeDays = 0
    const current = new Date(start)

    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
      const count = dayMap.get(key) || 0
      max = Math.max(max, count)
      totalDays++
      if (count > 0) activeDays++

      currentWeek.push({
        date: new Date(current),
        count,
        key,
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }

      current.setDate(current.getDate() + 1)
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    // Month labels: find the first week where each month starts
    const monthLabels: { label: string; weekIndex: number }[] = []
    let lastMonth = -1
    for (let w = 0; w < weeks.length; w++) {
      // Use first day of week that's on the 1st-7th of a month
      for (const day of weeks[w]) {
        const m = day.date.getMonth()
        if (m !== lastMonth) {
          lastMonth = m
          monthLabels.push({
            label: day.date.toLocaleDateString("en-US", { month: "short" }),
            weekIndex: w,
          })
          break
        }
      }
    }

    const dateRange = `${minDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${maxDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

    return { weeks, maxCount: max, monthLabels, totalDays, activeDays, dateRange }
  }, [messages])

  if (weeks.length === 0) return null

  const cellSize = 11
  const cellGap = 2
  const step = cellSize + cellGap

  function getColor(count: number): string {
    if (count === 0) return "var(--secondary)"
    const intensity = count / maxCount
    if (intensity < 0.25) return "oklch(0.45 0.1 180)"
    if (intensity < 0.5) return "oklch(0.55 0.12 180)"
    if (intensity < 0.75) return "oklch(0.65 0.14 180)"
    return "oklch(0.75 0.16 180)"
  }

  return (
    <div className="border-b border-border bg-card/30 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium text-foreground">Posting Activity</p>
            <p className="text-[10px] text-muted-foreground">{dateRange}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{activeDays} active days</span>
              <span className="text-border">/</span>
              <span>{totalDays} total</span>
              <span className="text-border">/</span>
              <span>{((activeDays / Math.max(1, totalDays)) * 100).toFixed(0)}% active</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map((level, i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: level === 0 ? "var(--secondary)" : getColor(level * maxCount),
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: weeks.length * step + 30 }}>
            {/* Month labels */}
            <div className="flex mb-1" style={{ paddingLeft: 30 }}>
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="text-[10px] text-muted-foreground absolute"
                  style={{ left: 30 + m.weekIndex * step }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex gap-0 mt-4" style={{ paddingLeft: 30 }}>
              {/* Day-of-week labels */}
              <div className="flex flex-col absolute left-4" style={{ gap: cellGap }}>
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                  <div
                    key={i}
                    className="text-[9px] text-muted-foreground flex items-center"
                    style={{ height: cellSize }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: cellGap }}>
                  {week.map((day) => (
                    <div
                      key={day.key}
                      className="rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-foreground/30"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: getColor(day.count),
                      }}
                      onClick={() => onDayClick?.(day.date)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const container = e.currentTarget.closest(".overflow-x-auto")?.getBoundingClientRect()
                        if (container) {
                          setTooltip({
                            x: rect.left - container.left + rect.width / 2,
                            y: rect.top - container.top - 4,
                            day,
                          })
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none z-10 rounded-lg bg-popover border border-border px-2.5 py-1.5 shadow-lg"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <p className="text-xs font-medium text-foreground whitespace-nowrap">
                  {tooltip.day.count === 0
                    ? "No posts"
                    : `${tooltip.day.count} post${tooltip.day.count !== 1 ? "s" : ""}`}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {tooltip.day.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
