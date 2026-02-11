import { useState, useCallback, useEffect, useRef } from "react"

export type TranscriptionStatus = "idle" | "transcribing" | "complete" | "error"

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

interface TranscriptionState {
  status: TranscriptionStatus
  transcript: string
  totalTranscript: string
  transcriptSegments: TranscriptSegment[]
  totalTranscriptSegments: TranscriptSegment[]
  progress: number
  error: string | null
}

interface TranscriptionProgress {
  status?: string
  progress?: number
  partial?: string
  message?: string
}

interface UseTranscriptionOptions {
  onProgress?: (progress: TranscriptionProgress) => void
  onComplete?: (transcript: string, transcriptSegments: TranscriptSegment[]) => void
  onError?: (error: string) => void
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const { onProgress, onComplete, onError } = options

  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    transcript: "",
    totalTranscript: "",
    transcriptSegments: [],
    totalTranscriptSegments: [],
    progress: 0,
    error: null,
  })

  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Setup progress listener
  useEffect(() => {
    const unsubscribe = window.python.onTranscribeProgress((progress: TranscriptionProgress) => {
      onProgress?.(progress)

      if (progress.status === "transcribing") {
        setState((prev) => ({
          ...prev,
          status: "transcribing",
          progress: progress.progress || 0,
        }))
      } else if (progress.status === "partial" && progress.partial) {
        setState((prev) => ({
          ...prev,
          transcript: progress.partial || "",
        }))
      }
    })

    unsubscribeRef.current = unsubscribe
    return () => unsubscribe()
  }, [onProgress])

  // Transcribe audio
  const transcribe = useCallback(
    async (params?: { language?: string; model?: string }) => {
      setState((prev) => ({
        ...prev,
        status: "transcribing",
        progress: 0,
        error: null,
      }))

      try {
        const result = await window.python.transcribe(params)
        const transcriptSegments = result.transcriptSegments || []
        const totalTranscriptSegments = result.totalTranscriptSegments || transcriptSegments

        setState((prev) => ({
          ...prev,
          status: "complete",
          transcript: result.transcript || "",
          totalTranscript: result.totalTranscript || result.transcript || "",
          transcriptSegments,
          totalTranscriptSegments,
          progress: 100,
        }))

        onComplete?.(result.totalTranscript || result.transcript || "", totalTranscriptSegments)
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Transcription failed"

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

  // Append to transcript (for multiple recordings in session)
  const appendTranscript = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      totalTranscript: prev.totalTranscript
        ? `${prev.totalTranscript}\n\n${text}`
        : text,
    }))
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState({
      status: "idle",
      transcript: "",
      totalTranscript: "",
      transcriptSegments: [],
      totalTranscriptSegments: [],
      progress: 0,
      error: null,
    })
  }, [])

  // Set transcript manually
  const setTranscript = useCallback((transcript: string) => {
    setState((prev) => ({
      ...prev,
      transcript,
      totalTranscript: transcript,
      transcriptSegments: [],
      totalTranscriptSegments: [],
    }))
  }, [])

  return {
    ...state,
    isTranscribing: state.status === "transcribing",
    isComplete: state.status === "complete",
    hasError: state.status === "error",
    transcribe,
    appendTranscript,
    clearTranscript,
    setTranscript,
  }
}
