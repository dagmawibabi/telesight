"use client"

import { useState, useEffect } from "react"

/**
 * A map of relativePath -> objectURL built from user-selected folder files.
 * This is populated once when the user picks a folder via <input webkitdirectory>.
 */
export type MediaFileMap = Map<string, string>

export function useMediaUrl(
  fileMap: MediaFileMap | null,
  relativePath: string | undefined | null
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!fileMap || !relativePath) {
      setUrl(null)
      return
    }

    // Skip placeholder strings from Telegram
    if (relativePath.startsWith("(File not included")) {
      setUrl(null)
      return
    }

    // Normalize path separators and try to find the file
    const normalized = relativePath.replace(/\\/g, "/")

    // Try exact match first
    if (fileMap.has(normalized)) {
      setUrl(fileMap.get(normalized)!)
      return
    }

    // Try without leading directory (e.g. "photos/photo.jpg" stored as just the webkitRelativePath)
    // The webkitRelativePath includes the root folder name, e.g. "ChatExport/photos/photo.jpg"
    // We need to match the suffix
    for (const [key, value] of fileMap) {
      if (key.endsWith(`/${normalized}`) || key === normalized) {
        setUrl(value)
        return
      }
    }

    setUrl(null)
  }, [fileMap, relativePath])

  return url
}

/**
 * Build a MediaFileMap from a FileList obtained via <input webkitdirectory>.
 * Indexes all files by their webkitRelativePath, creating object URLs.
 */
export function buildMediaFileMap(files: FileList): MediaFileMap {
  const map: MediaFileMap = new Map()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const objectUrl = URL.createObjectURL(file)
    map.set(path, objectUrl)
  }
  return map
}
