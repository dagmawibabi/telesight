"use client"

import { Search, X, ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react"
import type { SortDirection } from "@/lib/telegram-types"

export type FilterType =
  | "all"
  | "has_links"
  | "has_reactions"
  | "forwarded"
  | "replies"
  | "service"

interface FilterToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  resultCount: number
  sortDirection: SortDirection
  onSortChange: (direction: SortDirection) => void
}

const filters: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "has_links", label: "Links" },
  { value: "has_reactions", label: "Reactions" },
  { value: "forwarded", label: "Forwarded" },
  { value: "replies", label: "Replies" },
  { value: "service", label: "Events" },
]

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  resultCount,
  sortDirection,
  onSortChange,
}: FilterToolbarProps) {
  return (
    <div className="sticky top-[105px] z-20 border-b border-border bg-background/80 backdrop-blur-sm md:top-[117px]">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-secondary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onFilterChange(f.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    activeFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-border/50 mx-1" />

            <button
              onClick={() =>
                onSortChange(sortDirection === "newest" ? "oldest" : "newest")
              }
              className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
              aria-label={`Sort by ${sortDirection === "newest" ? "oldest first" : "newest first"}`}
            >
              {sortDirection === "newest" ? (
                <ArrowDownNarrowWide className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              )}
              <span>{sortDirection === "newest" ? "Newest" : "Oldest"}</span>
            </button>

            <span className="text-xs text-muted-foreground font-mono ml-1">
              {resultCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
