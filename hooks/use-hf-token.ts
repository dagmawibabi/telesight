"use client"

import { useState, useEffect, useCallback } from "react"

const HF_TOKEN_KEY = "hf_token"

export function useHuggingFaceToken() {
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(HF_TOKEN_KEY)
    if (stored) {
      setTokenState(stored)
    }
    setIsLoading(false)
  }, [])

  // Save token to localStorage
  const setToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(HF_TOKEN_KEY, newToken)
    } else {
      localStorage.removeItem(HF_TOKEN_KEY)
    }
    setTokenState(newToken)
  }, [])

  // Clear token
  const clearToken = useCallback(() => {
    localStorage.removeItem(HF_TOKEN_KEY)
    setTokenState(null)
  }, [])

  // Check if token is set
  const hasToken = !!token

  return {
    token,
    setToken,
    clearToken,
    hasToken,
    isLoading,
  }
}
