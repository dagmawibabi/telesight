import { NextRequest, NextResponse } from "next/server"
import { isIP } from "net"

// ---------------------------------------------------------------------------
// In-memory cache – avoids re-fetching the same URL within the TTL window.
// Entries are evicted lazily on read and proactively when the cache exceeds
// its max size to prevent unbounded memory growth.
// ---------------------------------------------------------------------------
interface CacheEntry {
  data: LinkPreviewResponse
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_MAX_SIZE = 500

function getCached(key: string): LinkPreviewResponse | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  // Move to end so the Map maintains true LRU order
  cache.delete(key)
  cache.set(key, entry)
  return entry.data
}

function setCached(key: string, data: LinkPreviewResponse) {
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ---------------------------------------------------------------------------
// SSRF protection – block fetches to private / reserved IP ranges.
// ---------------------------------------------------------------------------
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^::ffff:/i,
]

function isPrivateHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return true
  }

  const bare = hostname.replace(/^\[|\]$/g, "")
  if (isIP(bare)) {
    return PRIVATE_IP_RANGES.some((re) => re.test(bare))
  }
  return false
}

// ---------------------------------------------------------------------------
// Response type – richer than before
// ---------------------------------------------------------------------------
interface LinkPreviewResponse {
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 })
  }

  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json(
      { error: "Requests to private networks are not allowed" },
      { status: 403 }
    )
  }

  // Check cache first
  const cached = getCached(url)
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Cache": "HIT",
      },
    })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Telesight/1.0; +https://telesight.app)",
        Accept: "text/html, application/xhtml+xml",
      },
      redirect: "follow",
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${res.status}` },
        { status: 502 }
      )
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      const minimal: LinkPreviewResponse = {
        url,
        canonicalUrl: null,
        domain: parsed.hostname,
        title: null,
        description: null,
        image: null,
        favicon: buildFaviconUrl(parsed.hostname),
        siteName: null,
        type: null,
        themeColor: null,
        author: null,
        publishedTime: null,
        twitterCard: null,
      }
      setCached(url, minimal)
      return NextResponse.json(minimal, {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "X-Cache": "MISS",
        },
      })
    }

    const html = await readBounded(res, 64_000)
    const meta = (prop: string) => getMetaContent(html, prop)

    // Resolve image URL
    let image =
      meta("og:image") || meta("twitter:image") || meta("twitter:image:src")
    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, url).href
      } catch {
        image = null
      }
    }

    // Parse actual favicon from HTML, fallback to Google's service
    const favicon = parseFavicon(html, url) || buildFaviconUrl(parsed.hostname)

    // Canonical URL
    const canonicalUrl =
      meta("og:url") || parseCanonical(html, url) || null

    const data: LinkPreviewResponse = {
      url,
      canonicalUrl,
      domain: parsed.hostname,
      title:
        meta("og:title") ||
        meta("twitter:title") ||
        parseTitle(html),
      description:
        meta("og:description") ||
        meta("twitter:description") ||
        meta("description"),
      image,
      favicon,
      siteName: meta("og:site_name"),
      type: meta("og:type") || null,
      themeColor: meta("theme-color") || null,
      author:
        meta("article:author") ||
        meta("author") ||
        meta("article:writer") ||
        null,
      publishedTime:
        meta("article:published_time") ||
        meta("article:published") ||
        meta("date") ||
        null,
      twitterCard: meta("twitter:card") || null,
    }

    setCached(url, data)

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Cache": "MISS",
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readBounded(
  res: Response,
  maxBytes: number
): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""

  let html = ""
  const decoder = new TextDecoder()
  let bytesRead = 0

  while (bytesRead < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value, { stream: true })
    bytesRead += value.length
  }
  reader.cancel()
  return html
}

function getMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escapeRegex(property)}["']`,
      "i"
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHTMLEntities(match[1])
  }
  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? decodeHTMLEntities(m[1].trim()) : null
}

function parseFavicon(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const href = match[1]
      if (href.startsWith("http")) return href
      try {
        return new URL(href, baseUrl).href
      } catch {
        continue
      }
    }
  }
  return null
}

function parseCanonical(html: string, baseUrl: string): string | null {
  const m = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
  )
  if (!m?.[1]) return null
  const href = m[1]
  if (href.startsWith("http")) return href
  try {
    return new URL(href, baseUrl).href
  } catch {
    return null
  }
}

function buildFaviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
}
