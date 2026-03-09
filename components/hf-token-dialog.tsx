"use client"

import { useState } from "react"
import { X, Key, ExternalLink, AlertCircle, Check } from "lucide-react"

interface HFTokenDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (token: string) => void
  hasExistingToken: boolean
}

export function HFTokenDialog({ isOpen, onClose, onSave, hasExistingToken }: HFTokenDialogProps) {
  const [token, setToken] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const validateAndSave = async () => {
    if (!token.trim()) {
      setError("Please enter a token")
      return
    }

    setIsValidating(true)
    setError(null)
    setSuccess(false)

    try {
      // Test the token by checking model availability
      const response = await fetch(`/api/sentiment/analyze?token=${encodeURIComponent(token.trim())}&model=sentiment`)
      
      if (response.status === 401) {
        setError("Invalid token. Please check your Hugging Face access token.")
        setIsValidating(false)
        return
      }

      if (!response.ok) {
        setError("Could not validate token. Please try again.")
        setIsValidating(false)
        return
      }

      const data = await response.json()
      
      if (data.status === "error") {
        setError(data.message || "Token validation failed")
        setIsValidating(false)
        return
      }

      // Token is valid
      setSuccess(true)
      onSave(token.trim())
      
      // Close after a brief delay to show success
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setToken("")
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed")
    } finally {
      setIsValidating(false)
    }
  }

  const clearAndClose = () => {
    setToken("")
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {hasExistingToken ? "Update" : "Add"} Hugging Face Token
              </h2>
              <p className="text-sm text-muted-foreground">
                Required for AI sentiment analysis and chat
              </p>
            </div>
          </div>
          <button
            onClick={clearAndClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setError(null)
              }}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              disabled={isValidating || success}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Your token is stored locally and never shared.
            </p>
          </div>

          {/* Help link */}
          <a
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary transition-colors hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Get your free token from Hugging Face
          </a>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-500">
              <Check className="h-4 w-4" />
              <span>Token validated and saved!</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={clearAndClose}
            disabled={isValidating || success}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={validateAndSave}
            disabled={isValidating || success || !token.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isValidating ? "Validating..." : success ? "Saved!" : "Save Token"}
          </button>
        </div>
      </div>
    </div>
  )
}
