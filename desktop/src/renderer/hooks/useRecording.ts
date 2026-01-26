import { useState, useCallback, useEffect, useRef } from "react"

export type RecordingStatus = "idle" | "recording" | "stopping"

interface RecordingState {
  status: RecordingStatus
  duration: number
  error: string | null
  sampleRate: number | null
}

interface UseRecordingOptions {
  onError?: (error: string) => void
  onStopped?: (audioLength: number, duration: number) => void
}

export function useRecording(options: UseRecordingOptions = {}) {
  const { onError, onStopped } = options

  const [state, setState] = useState<RecordingState>({
    status: "idle",
    duration: 0,
    error: null,
    sampleRate: null,
  })

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Listen for recording errors from Python
  useEffect(() => {
    const unsubscribe = window.python.onRecordingError((error: string) => {
      setState((prev) => ({
        ...prev,
        status: "idle",
        error,
      }))
      onError?.(error)

      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    })

    return () => unsubscribe()
  }, [onError])

  // Start recording
  const startRecording = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null, status: "recording" }))

    try {
      const result = await window.python.startRecording({ sampleRate: 16000 })

      if (result.started) {
        startTimeRef.current = Date.now()

        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
            setState((prev) => ({ ...prev, duration: elapsed }))
          }
        }, 1000)

        setState((prev) => ({
          ...prev,
          status: "recording",
          sampleRate: result.actualSampleRate || 16000,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: "Failed to start recording",
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: errorMessage,
      }))
      onError?.(errorMessage)
    }
  }, [onError])

  // Stop recording
  const stopRecording = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "stopping" }))

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    try {
      const result = await window.python.stopRecording()

      setState((prev) => ({
        ...prev,
        status: "idle",
      }))

      if (result.stopped) {
        onStopped?.(result.audioLength || 0, result.durationSec || 0)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: errorMessage,
      }))
      onError?.(errorMessage)
      throw error
    }
  }, [onError, onStopped])

  // Reset state
  const reset = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    startTimeRef.current = null
    setState({
      status: "idle",
      duration: 0,
      error: null,
      sampleRate: null,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  return {
    ...state,
    isRecording: state.status === "recording",
    isStopping: state.status === "stopping",
    isIdle: state.status === "idle",
    startRecording,
    stopRecording,
    reset,
  }
}
