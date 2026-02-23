"use client"

import { ExternalLink, Play, Calendar, User } from "lucide-react"
import useSWR from "swr"

interface LinkPreviewData {
  url: string
  canonicalUrl: string | null
  domain: string
  title: string | null
  description: string | null
  image: string | null
  favicon: string | null
  siteName: string | null
  type: string | null
  themeColor: string | null
  author: string | null
  publishedTime: string | null
  twitterCard: string | null
}

const fetcher = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const VIDEO_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
]

function isVideoDomain(domain: string): boolean {
  return VIDEO_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  )
}

function formatDate(raw: string): string | null {
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return null
  }
}

interface LinkPreviewProps {
  url: string
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const { data, isLoading } = useSWR<LinkPreviewData | null>(
    `/api/link-preview?url=${encodeURIComponent(url)}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60 * 60 * 1000,
      errorRetryCount: 1,
    }
  )

  if (isLoading) {
    return (
      <div className="mt-2 rounded-lg border border-border/60 bg-secondary/20 p-3 animate-pulse">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 rounded-md bg-secondary/60" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="h-3 w-3/4 rounded bg-secondary/60" />
            <div className="h-2.5 w-full rounded bg-secondary/40" />
            <div className="h-2.5 w-1/2 rounded bg-secondary/40" />
          </div>
        </div>
      </div>
    )
  }

  if (!data || (!data.title && !data.description && !data.image)) {
    return null
  }

  const domain = (data.domain || new URL(data.url).hostname).replace(/^www\./, "")
  const isVideo =
    data.type === "video" ||
    data.type === "video.other" ||
    isVideoDomain(domain)
  const isLargeCard =
    data.image &&
    (data.twitterCard === "summary_large_image" ||
      data.type === "article" ||
      isVideo)

  const formattedDate = data.publishedTime
    ? formatDate(data.publishedTime)
    : null

  const validColor =
    data.themeColor && /^(#[0-9a-f]{3,8}|rgb|hsl|oklch|oklab|lch|lab|color)\b/i.test(data.themeColor)
      ? data.themeColor
      : null
  const accentStyle = validColor
    ? { borderLeftColor: validColor, borderLeftWidth: "3px" }
    : undefined

  if (isLargeCard) {
    return (
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-2 flex flex-col rounded-lg border border-border/60 bg-secondary/20 overflow-hidden transition-colors hover:bg-secondary/40 hover:border-border group/link"
        style={accentStyle}
      >
        {data.image && (
          <div className="relative w-full aspect-[1.91/1] bg-secondary/30 overflow-hidden">
            <img
              src={data.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              crossOrigin="anonymous"
              onError={(e) => {
                const parent = e.currentTarget.parentElement
                if (parent) parent.style.display = "none"
              }}
            />
            {isVideo && (
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/link:bg-black/30 transition-colors">
                <div className="rounded-full bg-black/60 p-3 backdrop-blur-sm group-hover/link:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-white fill-white" />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1 p-3 min-w-0">
          <div className="flex items-center gap-1.5">
            {data.favicon && (
              <img
                src={data.favicon}
                alt=""
                className="h-3.5 w-3.5 rounded-sm shrink-0"
                loading="lazy"
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = "none"
                }}
              />
            )}
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium truncate">
              {data.siteName || domain}
            </span>
          </div>
          {data.title && (
            <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
              {data.title}
            </p>
          )}
          {data.description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
              {data.description}
            </p>
          )}
          {(data.author || formattedDate) && (
            <div className="flex items-center gap-3 mt-0.5">
              {data.author && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <User className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[120px]">{data.author}</span>
                </span>
              )}
              {formattedDate && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Calendar className="h-2.5 w-2.5" />
                  {formattedDate}
                </span>
              )}
            </div>
          )}
        </div>
      </a>
    )
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex rounded-lg border border-border/60 bg-secondary/20 overflow-hidden transition-colors hover:bg-secondary/40 hover:border-border group/link"
      style={accentStyle}
    >
      {data.image && (
        <div className="shrink-0 w-[120px] min-h-[80px] bg-secondary/30 relative overflow-hidden">
          <img
            src={data.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            crossOrigin="anonymous"
            onError={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) parent.style.display = "none"
            }}
          />
        </div>
      )}
      <div className="flex flex-col gap-1 p-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {data.favicon && (
            <img
              src={data.favicon}
              alt=""
              className="h-3.5 w-3.5 rounded-sm shrink-0"
              loading="lazy"
              onError={(e) => {
                ;(e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          )}
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium truncate">
            {data.siteName || domain}
          </span>
        </div>
        {data.title && (
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {data.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50 truncate">
            {domain}
          </span>
        </div>
      </div>
    </a>
  )
}
