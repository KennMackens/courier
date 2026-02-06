import * as React from "react"
import { RefreshCw, Trash2, CheckCircle2, AlertCircle, ChevronDown, LogOut, User as UserIcon, Heart, HelpCircle, Bird } from "lucide-react"
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
  THEME_OPTIONS,
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
}

type SettingsTab = "transcription" | "enhancement" | "appearance" | "account"

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "transcription", label: "Transcription" },
  { id: "enhancement", label: "Enhancement" },
  { id: "appearance", label: "Appearance" },
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
}: SettingsModalProps) {
  // Local form state (for cancel behavior)
  const [formState, setFormState] = React.useState<Settings>(settings)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("transcription")
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  // Auth state
  const { user, userProfile, signOut: authSignOut } = useAuth()

  // Model manager for MLX models
  const modelManager = useModelManager()
  const downloadedModelIds = React.useMemo(
    () => new Set(modelManager.downloadedModels.map((model) => model.modelId)),
    [modelManager.downloadedModels]
  )
  const availableModelNames = React.useMemo(() => {
    const map = new Map<string, string>()
    modelManager.availableModels.forEach((model) => {
      map.set(model.id, model.name)
    })
    return map
  }, [modelManager.availableModels])

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

              {activeTab === "enhancement" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-enhancement"
                  aria-labelledby="settings-tab-enhancement"
                >
                  <div className="space-y-5">
                    {/* Model Status */}
                    <div className="space-y-3">
                      {/* Downloaded Models List with Delete */}
                      <div className="space-y-2">
                        <p className="text-xs text-slate-10">
                          Select a model to make it active:
                        </p>
                        {modelManager.downloadedModels.length > 0 ? (
                          modelManager.downloadedModels.map((model) => (
                            <div
                              key={model.modelId}
                              role="button"
                              tabIndex={0}
                              onClick={() => updateField("mlxModel", model.modelId)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  updateField("mlxModel", model.modelId)
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between p-2 rounded border transition-colors",
                                "bg-slate-2 border-slate-5 hover:border-slate-7 cursor-pointer",
                                formState.mlxModel === model.modelId && "border-jade-7 bg-jade-2/40"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-11 truncate">
                                  {availableModelNames.get(model.modelId) ||
                                    model.modelId.split("/").pop()}
                                </p>
                                <p className="text-xs text-slate-9">{model.size}</p>
                              </div>
                              {formState.mlxModel === model.modelId && (
                                <div className="flex items-center gap-1 text-xs text-jade-11 font-medium">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  modelManager.deleteModel(model.modelId)
                                }}
                                className="text-red-11 hover:text-red-12 hover:bg-red-3 ml-2"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-10">
                            No downloaded models yet.
                          </div>
                        )}
                      </div>

                      {/* Available Models */}
                      <div className="space-y-2">
                        <p className="text-xs text-slate-10">Available models:</p>
                        {modelManager.availableModels.length > 0 ? (
                          modelManager.availableModels.map((model) => {
                            const isInstalled = downloadedModelIds.has(model.id)
                            const isDownloading = modelManager.isDownloading && modelManager.downloadingModelId === model.id
                            const sizeLabel = model.size_gb ? `~${model.size_gb} GB` : "Size unknown"
                            return (
                              <div
                                key={model.id}
                                className="flex items-center justify-between gap-3 p-2 rounded bg-slate-2 border border-slate-5"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-11 truncate">
                                    {model.name}
                                  </p>
                                  <p className="text-xs text-slate-9 truncate">
                                    {model.description}
                                  </p>
                                  <p className="text-[11px] text-slate-8">{sizeLabel}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant={isInstalled ? "outline" : "default"}
                                  size="sm"
                                  onClick={() => modelManager.downloadModel(model.id)}
                                  disabled={isInstalled || modelManager.isDownloading}
                                >
                                  {isInstalled ? "Installed" : isDownloading ? "Downloading" : "Install"}
                                </Button>
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-xs text-slate-10">
                            No available models found.
                          </div>
                        )}
                      </div>

                      {/* Download Progress */}
                      {modelManager.isDownloading && (
                        <div className="space-y-2">
                          <Progress value={modelManager.downloadProgress} className="h-2" />
                          <div className="flex justify-between text-xs text-slate-10">
                            <span>
                              {modelManager.downloadedSize} / {modelManager.totalSize || "..."}
                            </span>
                            <span>{modelManager.downloadSpeed}</span>
                          </div>
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

              {activeTab === "appearance" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-appearance"
                  aria-labelledby="settings-tab-appearance"
                >
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
              )}

              {activeTab === "account" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="settings-panel-account"
                  aria-labelledby="settings-tab-account"
                >
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
