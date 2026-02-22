"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send, Settings, Loader2, Bot, User } from "lucide-react"
import type { TelegramMessage } from "@/lib/telegram-types"
import { getMessageText } from "@/lib/telegram-types"
import { sendHFMessage, buildChatContext, HFAPIError, getHFToken } from "@/lib/hf-api"

interface HFChatWidgetProps {
  messages: TelegramMessage[]
  onOpenSettings: () => void
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isLoading?: boolean
}

export function HFChatWidget({ messages, onOpenSettings }: HFChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I can help you analyze this conversation. Ask me things like:\n• \"Find when I mentioned WhatsApp\"\n• \"Summarize the main topics\"\n• \"Who sent the most messages?\"\n• \"Find any arguments or conflicts\"",
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const token = typeof window !== "undefined" ? getHFToken() : null

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

    if (!token) {
      setError("Please set your Hugging Face token first. Click the settings icon.")
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
      const messageData = messages
        .filter(m => m.type === "message")
        .map(m => ({
          from: m.from,
          text: getMessageText(m),
          date: m.date,
        }))

      const context = buildChatContext(messageData, userMessage.content)
      
      const response = await sendHFMessage(token, context, 512)

      // Replace loading message with actual response
      setChatMessages(prev => 
        prev.filter(m => m.id !== "loading").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        })
      )
    } catch (err) {
      setChatMessages(prev => prev.filter(m => m.id !== "loading"))
      
      if (err instanceof HFAPIError) {
        if (err.isRateLimit) {
          setError("Rate limit reached. Please wait a minute and try again.")
        } else if (err.statusCode === 401) {
          setError("Invalid token. Please check your Hugging Face token.")
        } else {
          setError(err.message)
        }
      } else {
        setError("Failed to get response. Please try again.")
      }
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

  const hasToken = !!token

  return (
    <>
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
                  {hasToken ? "Ready to help" : "Token required"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenSettings}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
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
            <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* No token warning */}
          {!hasToken && !error && (
            <div className="mx-4 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-700">
                Set your Hugging Face token to start chatting.{" "}
                <button
                  onClick={onOpenSettings}
                  className="font-medium underline hover:text-amber-800"
                >
                  Open settings
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
                placeholder={hasToken ? "Ask about the conversation..." : "Set token first..."}
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
              Powered by Hugging Face • Free tier available
            </p>
          </div>
        </div>
      )}
    </>
  )
}
