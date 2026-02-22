"use client"

import { useCallback, useRef } from "react"
import { Upload, FolderOpen, Check } from "lucide-react"
import type { TelegramExport } from "@/lib/telegram-types"
import { buildMediaFileMap, type MediaFileMap } from "@/hooks/use-media-url"

interface UploadScreenProps {
  onDataLoaded: (data: TelegramExport) => void
  onMediaFolderLoaded: (map: MediaFileMap, folderName: string) => void
  folderName: string | null
}

export function UploadScreen({ onDataLoaded, onMediaFolderLoaded, folderName }: UploadScreenProps) {
  const folderInputRef = useRef<HTMLInputElement>(null)
  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          if (json.messages && Array.isArray(json.messages)) {
            onDataLoaded(json as TelegramExport)
          } else {
            alert("Invalid Telegram export file. Missing 'messages' array.")
          }
        } catch {
          alert("Failed to parse JSON file.")
        }
      }
      reader.readAsText(file)
    },
    [onDataLoaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith(".json")) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 max-w-lg text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <div className="h-3 w-3 rounded-sm bg-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Telegrid
            </h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
            Import your Telegram channel or group export to visualize messages,
            analytics, and media in a beautiful interface.
          </p>
        </div>

        {/* Primary: Select export folder */}
        <div className="flex flex-col items-center gap-3 w-full">
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is a non-standard attribute
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = e.target.files
              if (!files || files.length === 0) return

              const map = buildMediaFileMap(files)
              const firstPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || ""
              const rootName = firstPath.split("/")[0] || "folder"
              onMediaFolderLoaded(map, rootName)

              // Look for a JSON file at the root level of the export folder
              for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ""
                const parts = relPath.split("/")
                // Root-level JSON file: "FolderName/result.json" (depth = 2)
                if (parts.length === 2 && file.name.endsWith(".json")) {
                  try {
                    const text = await file.text()
                    const json = JSON.parse(text)
                    if (json.messages && Array.isArray(json.messages)) {
                      onDataLoaded(json as TelegramExport)
                      return
                    }
                  } catch {
                    // Not a valid Telegram export JSON, ignore
                  }
                }
              }
            }}
          />
          <button
            onClick={() => folderInputRef.current?.click()}
            className="group relative flex w-full cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-8 py-12 transition-all hover:border-primary/50 hover:bg-card"
          >
            {folderName ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-foreground">{folderName}</span>
                  <span className="text-xs text-muted-foreground">folder selected, loading...</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-foreground">
                    Select your export folder
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Auto-detects result.json and media files
                  </span>
                </div>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-xs text-muted-foreground/50">or drop a JSON file</span>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        {/* Secondary: Drop JSON only */}
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="group relative flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 px-8 py-8 transition-all hover:border-primary/30 hover:bg-card/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/60 transition-colors group-hover:bg-primary/10">
            <Upload className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              JSON file only (no media)
            </span>
          </div>
          <input
            type="file"
            accept=".json"
            onChange={handleChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Upload Telegram export JSON file"
          />
        </label>

        <p className="text-xs text-muted-foreground/60">
          Export from Telegram Desktop: Settings &rarr; Advanced &rarr; Export
          Telegram Data
        </p>
      </div>
    </main>
  )
}
