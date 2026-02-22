"use client"

import { useState, useMemo } from "react"
import { UploadScreen } from "@/components/upload-screen"
import { ChannelViewer } from "@/components/channel-viewer"
import { GroupViewer } from "@/components/group-viewer"
import { DMViewer } from "@/components/dm-viewer"
import type { TelegramExport } from "@/lib/telegram-types"
import { detectExportType, type ExportType } from "@/lib/telegram-types"
import type { MediaFileMap } from "@/hooks/use-media-url"

export default function Home() {
  const [data, setData] = useState<TelegramExport | null>(null)
  const [mediaFileMap, setMediaFileMap] = useState<MediaFileMap | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)

  const exportType: ExportType | null = useMemo(
    () => (data ? detectExportType(data) : null),
    [data]
  )

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

  const sharedProps = {
    data,
    onReset: () => {
      setData(null)
      setMediaFileMap(null)
      setFolderName(null)
    },
    mediaFileMap,
    folderName,
    onMediaFolderLoaded: (map: MediaFileMap, name: string) => {
      setMediaFileMap(map)
      setFolderName(name)
    },
  }

  if (exportType === "dm") {
    return <DMViewer {...sharedProps} />
  }

  if (exportType === "group") {
    return <GroupViewer {...sharedProps} />
  }

  return <ChannelViewer {...sharedProps} />
}
