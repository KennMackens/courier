import { useState, useCallback, useEffect } from "react"

export interface Settings {
  language: string
  whisperModel: string
  ollamaModel: string
  ollamaEndpoint: string
  availableModels: string[]
  theme: "light" | "dark" | "system"
}

const DEFAULT_SETTINGS: Settings = {
  language: "nl",
  whisperModel: "medium",
  ollamaModel: "llama3",
  ollamaEndpoint: "http://localhost:11434",
  availableModels: ["tiny", "base", "small", "medium", "large-v3"],
  theme: "system",
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

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await window.python.getSettings()

        // Merge with defaults and add theme from localStorage
        const storedTheme = localStorage.getItem("courier-theme") as Settings["theme"] | null

        setSettingsState({
          ...DEFAULT_SETTINGS,
          ...result,
          theme: storedTheme || DEFAULT_SETTINGS.theme,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load settings"
        setError(errorMessage)
        onError?.(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [onError])

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
          localStorage.setItem("courier-theme", theme)
        }

        // Save Python settings
        await window.python.setSettings(pythonSettings)

        // Update local state
        setSettingsState((prev) => ({
          ...prev,
          ...newSettings,
        }))

        onSaved?.()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to save settings"
        setError(errorMessage)
        onError?.(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [onError, onSaved]
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
        ollamaModel: DEFAULT_SETTINGS.ollamaModel,
        ollamaEndpoint: DEFAULT_SETTINGS.ollamaEndpoint,
      })

      localStorage.setItem("courier-theme", DEFAULT_SETTINGS.theme)
      setSettingsState(DEFAULT_SETTINGS)
      onSaved?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset settings"
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }, [onError, onSaved])

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
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
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
