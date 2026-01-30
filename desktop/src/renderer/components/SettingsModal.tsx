import * as React from "react"
import { RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Settings,
  LANGUAGE_OPTIONS,
  WHISPER_MODEL_OPTIONS,
  THEME_OPTIONS,
} from "@/hooks/useSettings"
import { applyTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onSave: (settings: Partial<Settings>) => Promise<void>
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  isLoading,
  isSaving,
  error,
  onSave,
}: SettingsModalProps) {
  // Local form state (for cancel behavior)
  const [formState, setFormState] = React.useState<Settings>(settings)

  // Ollama models state
  const [ollamaModels, setOllamaModels] = React.useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)

  // Fetch available Ollama models
  const fetchOllamaModels = React.useCallback(async () => {
    setIsLoadingModels(true)
    try {
      const result = await window.python.getOllamaModels()
      setOllamaModels(result.models || [])
    } catch (err) {
      console.error("Failed to fetch Ollama models:", err)
      setOllamaModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }, [])

  // Fetch models when modal opens
  React.useEffect(() => {
    if (open) {
      fetchOllamaModels()
    }
  }, [open, fetchOllamaModels])

  // Only sync form state when modal opens, not on settings changes (to avoid resetting user edits)
  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    // Only sync when modal transitions from closed to open
    if (open && !prevOpenRef.current) {
      setFormState(settings)
    }
    prevOpenRef.current = open
  }, [open, settings])

  // Handle form field changes
  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }))

    // Apply theme immediately for preview
    if (key === "theme") {
      applyTheme(value as Settings["theme"])
    }
  }

  // Handle save
  const handleSave = async () => {
    try {
      await onSave(formState)
      onOpenChange(false)
    } catch (err) {
      // Error is handled by the hook
    }
  }

  // Handle cancel
  const handleCancel = () => {
    // Revert theme if it was changed
    if (formState.theme !== settings.theme) {
      applyTheme(settings.theme)
    }
    setFormState(settings)
    onOpenChange(false)
  }

  // Validate Ollama endpoint
  const isValidEndpoint = React.useMemo(() => {
    try {
      new URL(formState.ollamaEndpoint)
      return true
    } catch {
      return false
    }
  }, [formState.ollamaEndpoint])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure transcription, AI, and appearance settings.
          </DialogDescription>
        </DialogHeader>
        <DialogClose />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6 py-4 px-6 max-h-[60vh] overflow-y-auto">
            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Transcription Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-12">
                Transcription
              </h3>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={formState.language}
                  onValueChange={(value) => updateField("language", value)}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Whisper Model */}
              <div className="space-y-2">
                <Label htmlFor="whisperModel">Whisper Model</Label>
                <Select
                  value={formState.whisperModel}
                  onValueChange={(value) => updateField("whisperModel", value)}
                >
                  <SelectTrigger id="whisperModel">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {WHISPER_MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-slate-9">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-12">AI</h3>

              {/* Ollama Endpoint */}
              <div className="space-y-2">
                <Label htmlFor="ollamaEndpoint">Ollama Endpoint</Label>
                <Input
                  id="ollamaEndpoint"
                  type="url"
                  value={formState.ollamaEndpoint}
                  onChange={(e) => updateField("ollamaEndpoint", e.target.value)}
                  placeholder="http://localhost:11434"
                  className={cn(
                    !isValidEndpoint &&
                      formState.ollamaEndpoint &&
                      "border-red-6 focus-visible:ring-red-7"
                  )}
                />
                {!isValidEndpoint && formState.ollamaEndpoint && (
                  <p className="text-xs text-red-11">
                    Please enter a valid URL
                  </p>
                )}
              </div>

              {/* Ollama Model */}
              <div className="space-y-2">
                <Label htmlFor="ollamaModel">Ollama Model</Label>
                <div className="flex gap-2">
                  <Select
                    value={formState.ollamaModel}
                    onValueChange={(value) => updateField("ollamaModel", value)}
                    disabled={isLoadingModels}
                  >
                    <SelectTrigger id="ollamaModel" className="flex-1">
                      <SelectValue placeholder={isLoadingModels ? "Loading..." : "Select model"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          {isLoadingModels ? "Loading..." : "No models available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={fetchOllamaModels}
                    disabled={isLoadingModels}
                    title="Refresh models"
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoadingModels && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Appearance Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-12">Appearance</h3>

              {/* Theme */}
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={formState.theme}
                  onValueChange={(value) =>
                    updateField("theme", value as Settings["theme"])
                  }
                >
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="relative z-20">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="z-20">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !isValidEndpoint || isLoading}
            className="z-20"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
