import { useState, useCallback, useEffect, useRef } from "react"

export interface Settings {
  language: string
  whisperModel: string
  mlxModel: string
  availableModels: string[]
  theme: "light" | "dark" | "system"
  recordingThreshold: number // Minimum recording duration in seconds
  performanceMode: "balanced" | "low_cpu"
}

const DEFAULT_SETTINGS: Settings = {
  language: "nl",
  whisperModel: "medium",
  mlxModel: "pdelobelle/fietje-2-chat-mlx-6Bit",
  availableModels: ["tiny", "base", "small", "medium", "large-v3"],
  theme: "system",
  recordingThreshold: 30, // Default 30 seconds
  performanceMode: "low_cpu",
}

interface UseSettingsOptions {
  onError?: (error: string) => void
  onSaved?: () => void
}

export function useSettings(options: UseSettingsOptions = {}) {
  const { onError, onSaved } = options

  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onErrorRef = useRef(onError)
  const onSavedRef = useRef(onSaved)

  onErrorRef.current = onError
  onSavedRef.current = onSaved

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await window.python.getSettings()

        // Merge with defaults and add theme from localStorage
        const storedTheme = localStorage.getItem("otto-theme") as Settings["theme"] | null

        setSettingsState({
          ...DEFAULT_SETTINGS,
          ...result,
          theme: storedTheme || DEFAULT_SETTINGS.theme,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load settings"
        setError(errorMessage)
        onErrorRef.current?.(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save settings
  const saveSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      setIsSaving(true)
      setError(null)

      try {
        // Separate theme from Python settings
        const { theme, ...pythonSettings } = newSettings

        // Save theme to localStorage
        if (theme) {
          localStorage.setItem("otto-theme", theme)
        }

        // Save Python settings
        await window.python.setSettings(pythonSettings)

        // Update local state
        setSettingsState((prev) => ({
          ...prev,
          ...newSettings,
        }))

        onSavedRef.current?.()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to save settings"
        setError(errorMessage)
        onErrorRef.current?.(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  // Update single setting
  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettingsState((prev) => ({
        ...prev,
        [key]: value,
      }))
    },
    []
  )

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    setIsSaving(true)
    try {
      await window.python.setSettings({
        language: DEFAULT_SETTINGS.language,
        whisperModel: DEFAULT_SETTINGS.whisperModel,
        mlxModel: DEFAULT_SETTINGS.mlxModel,
        recordingThreshold: DEFAULT_SETTINGS.recordingThreshold,
        performanceMode: DEFAULT_SETTINGS.performanceMode,
      })

      localStorage.setItem("otto-theme", DEFAULT_SETTINGS.theme)
      setSettingsState(DEFAULT_SETTINGS)
      onSavedRef.current?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset settings"
      setError(errorMessage)
      onErrorRef.current?.(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }, [])

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveSettings,
    updateSetting,
    resetToDefaults,
    DEFAULT_SETTINGS,
  }
}

// Language options
export const LANGUAGE_OPTIONS = [
  { value: "nl", label: "Dutch" },
] as const

// Whisper model options
export const WHISPER_MODEL_OPTIONS = [
  { value: "tiny", label: "Tiny", description: "Fastest, lowest accuracy" },
  { value: "base", label: "Base", description: "Fast, basic accuracy" },
  { value: "small", label: "Small", description: "Balanced speed/accuracy" },
  { value: "medium", label: "Medium", description: "Good accuracy (recommended)" },
  { value: "large-v3", label: "Large v3", description: "Best accuracy, slowest" },
] as const

// Theme options
export const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const

// Recording threshold options (in seconds)
export const RECORDING_THRESHOLD_OPTIONS = [
  { value: 0, label: "Disabled" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
] as const

// CPU/performance presets for transcription runtime
export const PERFORMANCE_MODE_OPTIONS = [
  { value: "balanced", label: "Balanced", description: "Faster transcription, moderate CPU usage" },
  { value: "low_cpu", label: "Low CPU", description: "Lower CPU load, slower transcription" },
] as const
