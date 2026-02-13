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

const UI_PROGRESS_UPDATE_INTERVAL_MS = 2000
const UI_PARTIAL_UPDATE_INTERVAL_MS = 2000
const UI_PROGRESS_MIN_DELTA = 2

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
  const lastProgressUiUpdateAtRef = useRef(0)
  const lastProgressValueRef = useRef(0)
  const lastPartialUiUpdateAtRef = useRef(0)

  // Setup progress listener
  useEffect(() => {
    const unsubscribe = window.python.onTranscribeProgress((progress: TranscriptionProgress) => {
      onProgress?.(progress)

      if (progress.status === "transcribing") {
        const nextProgress = Math.max(0, progress.progress || 0)
        const now = Date.now()
        const progressJumped = Math.abs(nextProgress - lastProgressValueRef.current) >= UI_PROGRESS_MIN_DELTA
        const intervalElapsed = now - lastProgressUiUpdateAtRef.current >= UI_PROGRESS_UPDATE_INTERVAL_MS
        const shouldUpdate =
          lastProgressUiUpdateAtRef.current === 0 ||
          progressJumped ||
          intervalElapsed ||
          nextProgress >= 100

        if (!shouldUpdate) {
          return
        }

        lastProgressUiUpdateAtRef.current = now
        lastProgressValueRef.current = nextProgress

        setState((prev) => ({
          ...prev,
          status: "transcribing",
          progress: nextProgress,
        }))
      } else if (progress.status === "partial" && progress.partial) {
        const now = Date.now()
        if (
          lastPartialUiUpdateAtRef.current !== 0 &&
          now - lastPartialUiUpdateAtRef.current < UI_PARTIAL_UPDATE_INTERVAL_MS
        ) {
          return
        }
        lastPartialUiUpdateAtRef.current = now

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
      lastProgressUiUpdateAtRef.current = 0
      lastProgressValueRef.current = 0
      lastPartialUiUpdateAtRef.current = 0

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
        lastProgressUiUpdateAtRef.current = Date.now()
        lastProgressValueRef.current = 100

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
    lastProgressUiUpdateAtRef.current = 0
    lastProgressValueRef.current = 0
    lastPartialUiUpdateAtRef.current = 0

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
