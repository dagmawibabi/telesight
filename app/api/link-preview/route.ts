import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  try {
    const parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Invalid protocol" },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Telesight/1.0; +https://telesight.app)",
        Accept: "text/html",
      },
      redirect: "follow",
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}` },
        { status: 502 }
      )
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html")) {
      // Not an HTML page, return minimal info
      return NextResponse.json(
        {
          url,
          domain: parsed.hostname,
          title: null,
          description: null,
          image: null,
          favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
          siteName: null,
        },
        {
          headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
        }
      )
    }

    // Only read first 50kb to avoid large payloads
    const reader = res.body?.getReader()
    let html = ""
    const decoder = new TextDecoder()
    let bytesRead = 0
    const MAX_BYTES = 50_000

    if (reader) {
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        bytesRead += value.length
      }
      reader.cancel()
    }

    const getMetaContent = (property: string): string | null => {
      // Match og:, twitter:, or name= meta tags
      const patterns = [
        new RegExp(
          `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`,
          "i"
        ),
      ]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match?.[1]) return decodeHTMLEntities(match[1])
      }
      return null
    }

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)

    const ogImage = getMetaContent("og:image") || getMetaContent("twitter:image")
    let image = ogImage
    if (image && !image.startsWith("http")) {
      // Resolve relative image URLs
      try {
        image = new URL(image, url).href
      } catch {
        image = null
      }
    }

    const data = {
      url,
      domain: parsed.hostname,
      title:
        getMetaContent("og:title") ||
        getMetaContent("twitter:title") ||
        (titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : null),
      description:
        getMetaContent("og:description") ||
        getMetaContent("twitter:description") ||
        getMetaContent("description"),
      image,
      favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
      siteName: getMetaContent("og:site_name"),
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
}
