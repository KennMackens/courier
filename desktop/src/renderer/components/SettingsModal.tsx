import * as React from "react"
import { RefreshCw, Trash2, CheckCircle2, AlertCircle, ChevronDown, LogOut, User as UserIcon, Heart, HelpCircle, Bird, Mic, MicOff, Volume2 } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Settings,
  LANGUAGE_OPTIONS,
  WHISPER_MODEL_OPTIONS,
  RECORDING_THRESHOLD_OPTIONS,
} from "@/hooks/useSettings"
import { useModelManager } from "@/hooks/useModelManager"
import { useAuth } from "@/contexts/AuthContext"
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
  micStatus: "unknown" | "active" | "denied" | "not_granted"
  micTooltip?: string | null
  onMicClick?: () => void
  isSystemAudioOnly?: boolean
  systemAudioAvailable?: boolean
}

type SettingsTab = "recording" | "transcription" | "enhancement" | "account"

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "recording", label: "Recording" },
  { id: "transcription", label: "Transcription" },
  { id: "enhancement", label: "Enhancement" },
  { id: "account", label: "Account" },
]

type AccountType = "unknown" | "early_bird" | "friend" | "paid"

const accountTypeMeta: Record<AccountType, { label: string; description: string; icon: React.ReactNode; badgeClass: string; iconBg: string }> = {
  early_bird: {
    label: "Early Bird",
    description: "Free access",
    icon: <Bird className="h-5 w-5 text-amber-11" />,
    badgeClass: "bg-amber-2 text-slate-12 border border-amber-6 shadow-md",
    iconBg: "bg-amber-4/50",
  },
  friend: {
    label: "Friend of Otto",
    description: "Lifetime free access",
    icon: <Heart className="h-5 w-5 text-pink-11" />,
    badgeClass: "bg-pink-2 text-slate-12 border border-pink-6 shadow-md",
    iconBg: "bg-pink-4/50",
  },
  paid: {
    label: "Paid",
    description: "Billing when available",
    icon: <UserIcon className="h-5 w-5 text-jade-11" />,
    badgeClass: "bg-jade-2 text-slate-12 border border-jade-6 shadow-md",
    iconBg: "bg-jade-4/50",
  },
  unknown: {
    label: "Account type pending",
    description: "Awaiting assignment",
    icon: <HelpCircle className="h-5 w-5 text-slate-10" />,
    badgeClass: "bg-slate-2 text-slate-11 border border-slate-6",
    iconBg: "bg-slate-3/60",
  },
}

function AccountBadge({ accountType }: { accountType: AccountType }) {
  const meta = accountTypeMeta[accountType] ?? accountTypeMeta.unknown
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-lg", meta.badgeClass)}>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full shadow-sm", meta.iconBg)}>
        {meta.icon}
      </div>
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-slate-12">{meta.label}</p>
        <p className="text-xs text-slate-10">{meta.description}</p>
      </div>
    </div>
  )
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  isLoading,
  isSaving,
  error,
  onSave,
  micStatus,
  micTooltip,
  onMicClick,
  isSystemAudioOnly,
  systemAudioAvailable = false,
}: SettingsModalProps) {
  // Local form state (for cancel behavior)
  const [formState, setFormState] = React.useState<Settings>(settings)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("transcription")
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<string | null>(null)

  // Auth state
  const { user, userProfile, signOut: authSignOut } = useAuth()

  // Model manager for MLX models
  const modelManager = useModelManager()
  const downloadedModelIds = React.useMemo(
    () => new Set(modelManager.downloadedModels.map((model) => model.modelId)),
    [modelManager.downloadedModels]
  )

  const getLabel = <T extends { value: string; label: string }>(options: readonly T[], value: string) =>
    options.find((o) => o.value === value)?.label || value

  // Ollama models state (deprecated, kept for advanced users)
  const [ollamaModels, setOllamaModels] = React.useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)
  const [showAdvancedOllama, setShowAdvancedOllama] = React.useState(false)

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
      modelManager.checkModelStatus()
      modelManager.loadModels()
    }
  }, [open])

  // Only sync form state when modal opens, not on settings changes (to avoid resetting user edits)
  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    // Only sync when modal transitions from closed to open
    if (open && !prevOpenRef.current) {
      setFormState(settings)
      setActiveTab("transcription")
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

  // Handle model deletion with fallback for active model
  const handleDeleteModel = async (modelId: string) => {
    const isActiveModel = formState.mlxModel === modelId
    const deleted = await modelManager.deleteModel(modelId)

    if (deleted && isActiveModel) {
      // Find another downloaded model to fallback to
      const remainingModels = modelManager.downloadedModels.filter(
        (m) => m.modelId !== modelId
      )
      if (remainingModels.length > 0) {
        // Auto-select the first remaining model
        updateField("mlxModel", remainingModels[0].modelId)
      } else {
        // No models left - clear selection (will trigger ModelRequiredBanner via isModelReady)
        updateField("mlxModel", "")
      }
    }

    setConfirmingDeleteId(null)
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

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const totalTabs = SETTINGS_TABS.length
    if (totalTabs === 0) {
      return
    }

    const currentIndex = Math.max(
      0,
      SETTINGS_TABS.findIndex((tab) => tab.id === activeTab)
    )

    let nextIndex: number | null = null

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % totalTabs
        break
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + totalTabs) % totalTabs
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = totalTabs - 1
        break
      default:
        break
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = SETTINGS_TABS[nextIndex]
    setActiveTab(nextTab.id)
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[92vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="text-sm text-slate-10">
            Configure transcription, enhancement, appearance, and account settings.
          </DialogDescription>
        </DialogHeader>
        <DialogClose />
        <div className="px-6 border-b border-slate-6">
          <div
            className="flex flex-wrap items-center gap-x-8 gap-y-3"
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="horizontal"
            onKeyDown={handleTabKeyDown}
          >
            {SETTINGS_TABS.map((tab, index) => {
              const isActive = activeTab === tab.id
              const tabId = `settings-tab-${tab.id}`
              const panelId = `settings-panel-${tab.id}`
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={panelId}
                  id={tabId}
                  tabIndex={isActive ? 0 : -1}
                  ref={(node) => {
                    tabRefs.current[index] = node
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative py-3 text-sm font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-9 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-1",
                    isActive ? "text-jade-11" : "text-slate-10 hover:text-slate-12"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-jade-9 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 py-4 px-6">
              {/* Error display */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {activeTab === "transcription" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-transcription"
                  aria-labelledby="settings-tab-transcription"
                >
                  <div className="space-y-5">
                    {/* Language */}
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={formState.language}
                        onValueChange={(value) => updateField("language", value)}
                      >
                        <SelectTrigger id="language">
                          <span className="truncate text-left">
                            {getLabel(LANGUAGE_OPTIONS, formState.language)}
                          </span>
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
                          <span className="truncate text-left">
                            {getLabel(WHISPER_MODEL_OPTIONS, formState.whisperModel)}
                          </span>
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

                    {/* Recording Threshold */}
                    <div className="space-y-2">
                      <Label htmlFor="recordingThreshold">Minimum Recording Duration</Label>
                      <Select
                        value={String(formState.recordingThreshold)}
                        onValueChange={(value) => updateField("recordingThreshold", Number(value))}
                      >
                        <SelectTrigger id="recordingThreshold">
                          <SelectValue placeholder="Select threshold" />
                        </SelectTrigger>
                        <SelectContent>
                          {RECORDING_THRESHOLD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-10">
                        Recordings shorter than this will prompt to keep or discard
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "recording" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-recording"
                  aria-labelledby="settings-tab-recording"
                >
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-12">Microphone</p>
                    <div
                      className={cn(
                        "relative flex items-center justify-between p-3 rounded-lg border overflow-hidden",
                        micStatus === "active"
                          ? "bg-slate-1 border-slate-6"
                          : "bg-amber-3/40 border-amber-7"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-0 h-full w-1",
                          micStatus === "active" ? "bg-jade-9" : "bg-amber-9"
                        )}
                      />
                      <div className="flex items-center gap-3 pl-2">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            micStatus === "active" ? "bg-jade-4" : "bg-amber-4"
                          )}
                        >
                          {micStatus === "active" ? (
                            <Mic className="h-5 w-5 text-jade-12" />
                          ) : (
                            <MicOff className="h-5 w-5 text-amber-12" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-nowrap">
                            <p
                              className={cn(
                                "text-sm font-semibold whitespace-nowrap",
                                micStatus === "active" ? "text-jade-12" : "text-amber-12"
                              )}
                            >
                              {micStatus === "active" && "Microphone ready"}
                              {micStatus === "denied" && "Microphone blocked"}
                              {micStatus === "not_granted" && "Permission required"}
                              {micStatus === "unknown" && "Status unknown"}
                            </p>
                              <span
                                className={cn(
                                  "text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0",
                                  micStatus === "active"
                                  ? "text-jade-11 border-jade-7 bg-jade-3"
                                  : "text-red-11 border-red-6 bg-red-3"
                                )}
                              >
                                {micStatus === "active" ? "Ready" : "Action needed"}
                              </span>
                          </div>
                          <p className="text-xs text-slate-11">
                            {micTooltip ||
                              (micStatus === "active"
                                ? "Otto can access your microphone."
                                : "Open System Settings to adjust microphone permissions.")}
                          </p>
                        </div>
                      </div>
                      {micStatus !== "active" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onMicClick}
                          disabled={!onMicClick}
                          className="relative z-10"
                        >
                          Open System Settings
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3 pt-1">
                      <p className="text-sm font-semibold text-slate-12">System Audio</p>
                      <div
                        className={cn(
                          "relative flex items-center justify-between p-3 rounded-lg border overflow-hidden",
                          systemAudioAvailable
                            ? "bg-slate-1 border-slate-6"
                            : "bg-amber-3/40 border-amber-7"
                        )}
                      >
                        {!systemAudioAvailable && (
                          <span className="absolute left-0 top-0 h-full w-1 bg-amber-9" />
                        )}
                        <div className="flex items-center gap-3 pl-2">
                          <div className="flex h-10 w-10 items-center justify-center">
                            <Volume2
                              className={cn(
                                "h-5 w-5",
                                systemAudioAvailable ? "text-jade-12" : "text-amber-12"
                              )}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  systemAudioAvailable ? "text-jade-12" : "text-amber-12"
                                )}
                              >
                                {systemAudioAvailable ? "System audio ready" : "Permission required"}
                              </p>
                              <span
                                className={cn(
                                  "text-[11px] px-2 py-0.5 rounded-full border",
                                  systemAudioAvailable
                                  ? "text-jade-11 border-jade-7 bg-jade-3"
                                  : "text-red-11 border-red-6 bg-red-3"
                                )}
                              >
                                {systemAudioAvailable ? "Ready" : "Action needed"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-11">
                              {systemAudioAvailable
                                ? "Otto can record your system audio."
                                : "Allow Screen & System Audio Recording in System Settings."}
                            </p>
                          </div>
                        </div>
                        {!systemAudioAvailable && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onMicClick}
                            disabled={!onMicClick}
                            className="relative z-10"
                          >
                            Open System Settings
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "enhancement" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-enhancement"
                  aria-labelledby="settings-tab-enhancement"
                >
                  <div className="space-y-5">
                    {/* Unified Model List */}
                    <div className="space-y-3">
                      <p className="text-xs text-slate-10">
                        AI models for note enhancement:
                      </p>
                      {modelManager.availableModels.length > 0 ? (
                        modelManager.availableModels.map((model) => {
                          const isInstalled = downloadedModelIds.has(model.id)
                          const isActive = formState.mlxModel === model.id && isInstalled
                          const isDownloading =
                            modelManager.isDownloading && modelManager.downloadingModelId === model.id
                          const isConfirmingDelete = confirmingDeleteId === model.id
                          const sizeLabel = model.size_gb ? `~${model.size_gb} GB` : "Size unknown"
                          const downloadedModel = modelManager.downloadedModels.find(
                            (m) => m.modelId === model.id
                          )
                          const installedSizeLabel = downloadedModel?.size || sizeLabel

                          return (
                            <div
                              key={model.id}
                              className={cn(
                                "flex flex-col gap-2 p-2 rounded border transition-colors",
                                isActive
                                  ? "bg-jade-2/40 border-jade-7"
                                  : "bg-slate-2 border-slate-5"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-medium text-slate-11 truncate">
                                      {model.name}
                                    </p>
                                    {isActive && (
                                      <span className="flex items-center gap-1 text-[11px] text-jade-11 font-medium">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-9 truncate">
                                    {model.description}
                                  </p>
                                  <p className="text-[11px] text-slate-8">
                                    {isInstalled ? installedSizeLabel : sizeLabel}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Not installed: Install button */}
                                  {!isInstalled && !isDownloading && (
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      onClick={() => modelManager.downloadModel(model.id)}
                                      disabled={modelManager.isDownloading}
                                    >
                                      Install
                                    </Button>
                                  )}

                                  {/* Downloading: show Downloading button */}
                                  {isDownloading && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled
                                    >
                                      Downloading
                                    </Button>
                                  )}

                                  {/* Installed but not active: Set Active button + trash */}
                                  {isInstalled && !isActive && !isDownloading && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateField("mlxModel", model.id)}
                                      >
                                        Set Active
                                      </Button>
                                      {isConfirmingDelete ? (
                                        <div className="flex items-center gap-1 text-xs">
                                          <span className="text-slate-11">Delete?</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteModel(model.id)}
                                            className="text-red-11 hover:text-red-12 hover:bg-red-3 px-2 h-7"
                                          >
                                            Yes
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setConfirmingDeleteId(null)}
                                            className="text-slate-11 hover:text-slate-12 px-2 h-7"
                                          >
                                            No
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setConfirmingDeleteId(model.id)}
                                          className="text-red-11 hover:text-red-12 hover:bg-red-3"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  )}

                                  {/* Active: trash icon only */}
                                  {isInstalled && isActive && !isDownloading && (
                                    <>
                                      {isConfirmingDelete ? (
                                        <div className="flex items-center gap-1 text-xs">
                                          <span className="text-slate-11">Delete?</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteModel(model.id)}
                                            className="text-red-11 hover:text-red-12 hover:bg-red-3 px-2 h-7"
                                          >
                                            Yes
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setConfirmingDeleteId(null)}
                                            className="text-slate-11 hover:text-slate-12 px-2 h-7"
                                          >
                                            No
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setConfirmingDeleteId(model.id)}
                                          className="text-red-11 hover:text-red-12 hover:bg-red-3"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {isDownloading && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-slate-9">
                                    <span>Downloading</span>
                                    <span>
                                      {modelManager.downloadedSize || "0.0 MB"}
                                      {modelManager.totalSize && modelManager.totalSize !== "unknown" && modelManager.totalSize !== "0.0 MB"
                                        ? ` / ${modelManager.totalSize}`
                                        : ""}
                                    </span>
                                  </div>
                                  <Progress
                                    value={modelManager.downloadProgress}
                                    indeterminate={!modelManager.totalSize || modelManager.totalSize === "unknown" || modelManager.totalSize === "0.0 MB"}
                                    className="h-1.5"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-xs text-slate-10">
                          No available models found.
                        </div>
                      )}

                      {/* Download Error */}
                      {modelManager.hasDownloadError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertDescription className="text-xs">
                            {modelManager.downloadError}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>

                  {/* Advanced Ollama Settings (Collapsed) */}
                  <Collapsible open={showAdvancedOllama} onOpenChange={setShowAdvancedOllama}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-slate-10">
                        <span className="text-xs">Advanced: Ollama (deprecated)</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedOllama && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-2">
                      <p className="text-xs text-slate-10">
                        Ollama is no longer required. Local MLX inference is used by default.
                        These settings are kept for advanced users who prefer Ollama.
                      </p>

                      {/* Ollama Endpoint */}
                      <div className="space-y-2">
                        <Label htmlFor="ollamaEndpoint" className="text-xs text-slate-10">Ollama Endpoint</Label>
                        <Input
                          id="ollamaEndpoint"
                          type="url"
                          value={formState.ollamaEndpoint}
                          onChange={(e) => updateField("ollamaEndpoint", e.target.value)}
                          placeholder="http://localhost:11434"
                          className={cn(
                            "text-sm",
                            !isValidEndpoint &&
                              formState.ollamaEndpoint &&
                              "border-red-6 focus-visible:ring-red-7"
                          )}
                        />
                      </div>

                      {/* Ollama Model */}
                      <div className="space-y-2">
                        <Label htmlFor="ollamaModel" className="text-xs text-slate-10">Ollama Model</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formState.ollamaModel}
                            onValueChange={(value) => updateField("ollamaModel", value)}
                            disabled={isLoadingModels}
                          >
                            <SelectTrigger id="ollamaModel" className="flex-1 text-sm">
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
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {activeTab === "account" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-account"
                  aria-labelledby="settings-tab-account"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-6 bg-slate-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-12">Dark Mode</p>
                      <p className="text-xs text-slate-10">
                        Toggle the app theme between dark and light.
                      </p>
                    </div>
                    <Switch
                      checked={formState.theme === "dark"}
                      onCheckedChange={(checked) => updateField("theme", checked ? "dark" : "light")}
                      aria-label="Toggle dark mode"
                    />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-12">Account</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-2 border border-slate-6">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-jade-3">
                          <UserIcon className="h-5 w-5 text-jade-11" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-12 truncate">
                            {userProfile?.displayName || user?.email?.split('@')[0] || 'User'}
                          </p>
                          <p className="text-xs text-slate-10 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Account Type Badge */}
                    <AccountBadge accountType={userProfile?.accountType || "unknown"} />

                    {/* Sign Out Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-center text-red-11 hover:text-red-12 hover:bg-red-3"
                      onClick={async () => {
                        try {
                          await authSignOut()
                          onOpenChange(false)
                        } catch (err) {
                          console.error('Sign out error:', err)
                        }
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
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
