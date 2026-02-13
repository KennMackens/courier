import { useState, useCallback, useEffect, useRef } from "react"

export type RecordingStatus = "idle" | "recording" | "stopping"
export type MicStatus = "unknown" | "active" | "denied" | "not_granted"

interface RecordingState {
  status: RecordingStatus
  duration: number
  error: string | null
  sampleRate: number | null
  micStatus: MicStatus
  micWarning: string | null
}

interface UseRecordingOptions {
  onError?: (error: string) => void
  onStopped?: (audioLength: number, duration: number) => void
}

const MIC_TOOLTIP = "Microphone access needed. Click to open System Settings and allow access."

export function useRecording(options: UseRecordingOptions = {}) {
  const { onError, onStopped } = options

  const [state, setState] = useState<RecordingState>({
    status: "idle",
    duration: 0,
    error: null,
    sampleRate: null,
    micStatus: "unknown",
    micWarning: null,
  })

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const permissionPollRef = useRef<NodeJS.Timeout | null>(null)
  const onErrorRef = useRef(onError)
  const onStoppedRef = useRef(onStopped)

  onErrorRef.current = onError
  onStoppedRef.current = onStopped

  // Listen for recording errors from Python
  useEffect(() => {
    const unsubscribeError = window.python.onRecordingError((data: { message: string }) => {
      const message = data?.message || "Recording error"
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: message,
        micStatus: "denied",
        micWarning: MIC_TOOLTIP,
      }))
      onErrorRef.current?.(message)

      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    })

    const unsubscribeWarning = window.python.onRecordingWarning((data: { message: string }) => {
      const message = data?.message || MIC_TOOLTIP
      setState((prev) => ({
        ...prev,
        micStatus: "denied",
        micWarning: message,
      }))
    })

    return () => {
      unsubscribeError()
      unsubscribeWarning()
    }
  }, [])

  // Poll permission while recording to reflect mid-session changes
  useEffect(() => {
    if (state.status === "recording") {
      permissionPollRef.current = setInterval(async () => {
        try {
          const perm = await window.python.checkPermission()
          // Only downgrade when permission is revoked; do not auto-upgrade to avoid false positives
          if (!perm.granted) {
            setState((prev) => ({
              ...prev,
              micStatus: "denied",
              micWarning: MIC_TOOLTIP,
            }))
          }
        } catch {
          // ignore polling errors
        }
      }, 3000)
    } else if (permissionPollRef.current) {
      clearInterval(permissionPollRef.current)
      permissionPollRef.current = null
    }

    return () => {
      if (permissionPollRef.current) {
        clearInterval(permissionPollRef.current)
        permissionPollRef.current = null
      }
    }
  }, [state.status])

  // Start recording
  const startRecording = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }))

    try {
      // Preflight permission check
      const perm = await window.python.checkPermission()

      setState((prev) => ({
        ...prev,
        status: "recording",
        micStatus: perm.granted ? "unknown" : "not_granted",
        micWarning: perm.granted ? null : MIC_TOOLTIP,
      }))

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
          micStatus: result.microphoneActive ? "active" : "denied",
          micWarning: result.microphoneActive ? null : MIC_TOOLTIP,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: "Failed to start recording",
          micStatus: "unknown",
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: errorMessage,
        micStatus: "unknown",
      }))
      onErrorRef.current?.(errorMessage)
    }
  }, [])

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
        onStoppedRef.current?.(result.audioLength || 0, result.durationSec || 0)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: errorMessage,
      }))
      onErrorRef.current?.(errorMessage)
      throw error
    }
  }, [])

  // Reset state
  const reset = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    if (permissionPollRef.current) {
      clearInterval(permissionPollRef.current)
      permissionPollRef.current = null
    }
    startTimeRef.current = null
    setState({
      status: "idle",
      duration: 0,
      error: null,
      sampleRate: null,
      micStatus: "unknown",
      micWarning: null,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      if (permissionPollRef.current) {
        clearInterval(permissionPollRef.current)
      }
    }
  }, [])

  return {
    ...state,
    isRecording: state.status === "recording",
    isStopping: state.status === "stopping",
    isIdle: state.status === "idle",
    hasMicAccess: state.micStatus === "active",
    isSystemAudioOnly: state.status === "recording" && state.micStatus !== "active",
    startRecording,
    stopRecording,
    reset,
  }
}
