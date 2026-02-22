"use client"

import { useState } from "react"
import { UploadScreen } from "@/components/upload-screen"
import { ChannelViewer } from "@/components/channel-viewer"
import type { TelegramExport } from "@/lib/telegram-types"
import type { MediaFileMap } from "@/hooks/use-media-url"

export default function Home() {
  const [data, setData] = useState<TelegramExport | null>(null)
  const [mediaFileMap, setMediaFileMap] = useState<MediaFileMap | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)

  if (!data) {
    return (
      <UploadScreen
        onDataLoaded={setData}
        onMediaFolderLoaded={(map, name) => {
          setMediaFileMap(map)
          setFolderName(name)
        }}
        folderName={folderName}
      />
    )
  }

  return (
    <ChannelViewer
      data={data}
      onReset={() => {
        setData(null)
        setMediaFileMap(null)
        setFolderName(null)
      }}
      mediaFileMap={mediaFileMap}
      folderName={folderName}
      onMediaFolderLoaded={(map, name) => {
        setMediaFileMap(map)
        setFolderName(name)
      }}
    />
  )
}
