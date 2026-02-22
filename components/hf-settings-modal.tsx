"use client"

import { useState, useEffect } from "react"
import { X, Key, Bot, Save, ExternalLink, AlertCircle } from "lucide-react"

interface HFSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HFSettingsModal({ isOpen, onClose }: HFSettingsModalProps) {
  const [token, setToken] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem("hf_token")
      if (stored) setToken(stored)
    }
  }, [isOpen])

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem("hf_token", token.trim())
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 1500)
    } else {
      localStorage.removeItem("hf_token")
      onClose()
    }
  }

  const handleClear = () => {
    localStorage.removeItem("hf_token")
    setToken("")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI Chat Settings</h2>
            <p className="text-xs text-muted-foreground">
              Connect to Hugging Face for AI-powered chat
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Your token is stored locally in your browser. Never share it with anyone.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Hugging Face Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="hf_xxxxx..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Get your token from{" "}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                huggingface.co/settings/tokens
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear token
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {saved ? (
                  <>
                    <Save className="h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function getHFToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("hf_token")
}
