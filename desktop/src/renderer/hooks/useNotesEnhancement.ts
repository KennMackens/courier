import { useState, useCallback, useEffect, useRef } from "react"

export type EnhancementStatus = "idle" | "enhancing" | "complete" | "error"

interface EnhancementState {
  status: EnhancementStatus
  enhancedNotes: string
  error: string | null
}

interface UseNotesEnhancementOptions {
  onToken?: (token: string) => void
  onComplete?: (notes: string) => void
  onError?: (error: string) => void
}

export function useNotesEnhancement(options: UseNotesEnhancementOptions = {}) {
  const { onToken, onComplete, onError } = options

  const [state, setState] = useState<EnhancementState>({
    status: "idle",
    enhancedNotes: "",
    error: null,
  })

  const enhancedNotesRef = useRef("")

  // Setup token listener
  useEffect(() => {
    const unsubscribe = window.python.onEnhanceToken((data: { token: string }) => {
      const { token } = data
      onToken?.(token)

      // Accumulate tokens
      enhancedNotesRef.current += token
      setState((prev) => ({
        ...prev,
        enhancedNotes: enhancedNotesRef.current,
      }))
    })

    return () => unsubscribe()
  }, [onToken])

  // Enhance notes
  const enhanceNotes = useCallback(
    async (params: { notes: string; transcript?: string; language?: string }) => {
      // Reset accumulated notes
      enhancedNotesRef.current = ""

      setState({
        status: "enhancing",
        enhancedNotes: "",
        error: null,
      })

      try {
        const result = await window.python.enhanceNotes(params)

        const finalNotes = enhancedNotesRef.current

        setState({
          status: "complete",
          enhancedNotes: finalNotes,
          error: null,
        })

        onComplete?.(finalNotes)
        return { notes: finalNotes, complete: result.complete }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Enhancement failed"

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }))

        onError?.(errorMessage)
        throw error
      }
    },
    [onComplete, onError]
  )

  // Clear enhanced notes
  const clearEnhancedNotes = useCallback(() => {
    enhancedNotesRef.current = ""
    setState({
      status: "idle",
      enhancedNotes: "",
      error: null,
    })
  }, [])

  // Set enhanced notes manually
  const setEnhancedNotes = useCallback((notes: string) => {
    enhancedNotesRef.current = notes
    setState((prev) => ({
      ...prev,
      enhancedNotes: notes,
    }))
  }, [])

  return {
    ...state,
    isEnhancing: state.status === "enhancing",
    isComplete: state.status === "complete",
    hasError: state.status === "error",
    enhanceNotes,
    clearEnhancedNotes,
    setEnhancedNotes,
  }
}
