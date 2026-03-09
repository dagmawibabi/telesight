"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send, Loader2, Bot, User, AlertCircle, Key } from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { useHuggingFaceToken } from "@/hooks/use-hf-token"
import { HFTokenDialog } from "./hf-token-dialog"

interface AIChatWidgetProps {
  messages: TelegramMessage[]
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isLoading?: boolean
}

export function AIChatWidget({ messages }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I can help you analyze this conversation using Hugging Face AI. Ask me things like:\n• \"Find when I mentioned WhatsApp\"\n• \"Summarize the main topics\"\n• \"Who sent the most messages?\"\n• \"Find any arguments or conflicts\"",
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { token, hasToken, setToken } = useHuggingFaceToken()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    if (!hasToken) {
      setTokenDialogOpen(true)
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    const loadingMessage: ChatMessage = {
      id: "loading",
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    }

    setChatMessages(prev => [...prev, userMessage, loadingMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      // Build context from messages
      const messageTexts = messages
        .filter(m => m.type === "message")
        .slice(-50) // Last 50 messages for context
        .map(m => `${m.from}: ${getMessageText(m)}`)

      // Call backend API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messageTexts,
          question: userMessage.content,
          token,
          model: "flan",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response")
      }

      // Replace loading message with actual response
      setChatMessages(prev => 
        prev.filter(m => m.id !== "loading").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: data.response || "I couldn't process that request.",
          timestamp: new Date(),
        })
      )
    } catch (err) {
      setChatMessages(prev => prev.filter(m => m.id !== "loading"))
      setError(err instanceof Error ? err.message : "Failed to get response. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Token Dialog */}
      <HFTokenDialog
        isOpen={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSave={setToken}
        hasExistingToken={hasToken}
      />

      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          aria-label="Open AI Chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
                <p className="text-[10px] text-muted-foreground">
                  {hasToken ? "Powered by Hugging Face" : "Token required"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTokenDialogOpen(true)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={hasToken ? "Update token" : "Add token"}
              >
                <Key className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "user"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  } ${msg.isLoading ? "animate-pulse" : ""}`}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* No token warning */}
          {!hasToken && !error && (
            <div className="mx-4 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-700 flex items-center gap-2">
                <Key className="h-3 w-3" />
                <span>Hugging Face token required. </span>
                <button
                  onClick={() => setTokenDialogOpen(true)}
                  className="font-medium underline hover:no-underline"
                >
                  Add token
                </button>
              </p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasToken ? "Ask about the conversation..." : "Add token to use chat..."}
                disabled={!hasToken || isLoading}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!hasToken || !input.trim() || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
              Powered by Hugging Face • <button onClick={() => setTokenDialogOpen(true)} className="underline hover:no-underline">{hasToken ? "Token saved" : "Add token"}</button>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
