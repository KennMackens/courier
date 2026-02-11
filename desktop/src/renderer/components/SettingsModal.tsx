import * as React from "react"
import {
  Trash2,
  CheckCircle2,
  LogOut,
  User as UserIcon,
  Heart,
  HelpCircle,
  Bird,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Settings,
  LANGUAGE_OPTIONS,
  WHISPER_MODEL_OPTIONS,
  RECORDING_THRESHOLD_OPTIONS,
  THEME_OPTIONS,
} from "@/hooks/useSettings"
import { useModelManager } from "@/hooks/useModelManager"
import { useAuth } from "@/contexts/AuthContext"
import { applyTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import {
  settingsStyles,
  SettingsTabNav,
  SettingsPanel,
  SettingsSection,
  SettingsField,
  SettingsStatusCard,
  type SettingsTabOption,
  type SettingsStatusTone,
} from "@/components/settings"

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
  defaultTab?: SettingsTab
}

type SettingsTab = "recording" | "transcription" | "enhancement" | "account"

const SETTINGS_TABS: SettingsTabOption<SettingsTab>[] = [
  { id: "recording", label: "Recording" },
  { id: "transcription", label: "Transcription" },
  { id: "enhancement", label: "Enhancement" },
  { id: "account", label: "Account" },
]

type AccountType = "unknown" | "early_bird" | "friend" | "paid"

const accountTypeMeta: Record<
  AccountType,
  {
    label: string
    description: string
    icon: React.ReactNode
    tone: SettingsStatusTone
    badgeLabel?: string
  }
> = {
  early_bird: {
    label: "Early Bird",
    description: "Free access",
    icon: <Bird className="h-5 w-5 text-amber-11" />,
    tone: "warning",
    badgeLabel: "Free",
  },
  friend: {
    label: "Friend of Otto",
    description: "Lifetime free access",
    icon: <Heart className="h-5 w-5 text-pink-11" />,
    tone: "accent",
    badgeLabel: "Lifetime",
  },
  paid: {
    label: "Paid",
    description: "Billing when available",
    icon: <UserIcon className="h-5 w-5 text-jade-11" />,
    tone: "ready",
    badgeLabel: "Paid",
  },
  unknown: {
    label: "Account type pending",
    description: "Awaiting assignment",
    icon: <HelpCircle className="h-5 w-5 text-slate-10" />,
    tone: "neutral",
    badgeLabel: "Pending",
  },
}

function AccountBadge({ accountType }: { accountType: AccountType }) {
  const meta = accountTypeMeta[accountType] ?? accountTypeMeta.unknown

  return (
    <SettingsStatusCard
      title={meta.label}
      description={meta.description}
      icon={meta.icon}
      tone={meta.tone}
      badgeLabel={meta.badgeLabel}
    />
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
  defaultTab,
}: SettingsModalProps) {
  // Local form state (for cancel behavior)
  const [formState, setFormState] = React.useState<Settings>(settings)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("transcription")
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<string | null>(null)

  // Auth state
  const { user, userProfile, signOut: authSignOut } = useAuth()

  // Model manager for MLX models
  const modelManager = useModelManager()
  const { checkModelStatus, loadModels } = modelManager
  const downloadedModelIds = React.useMemo(
    () => new Set(modelManager.downloadedModels.map((model) => model.modelId)),
    [modelManager.downloadedModels]
  )

  const getLabel = <T extends { value: string; label: string }>(options: readonly T[], value: string) =>
    options.find((o) => o.value === value)?.label || value

  // Fetch models when modal opens
  React.useEffect(() => {
    if (open) {
      checkModelStatus()
      loadModels()
    }
  }, [open, checkModelStatus, loadModels])

  // Only sync form state when modal opens, not on settings changes (to avoid resetting user edits)
  const prevOpenRef = React.useRef(false)
  const isInitializedRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    // Only sync when modal transitions from closed to open
    if (open && !prevOpenRef.current) {
      setFormState(settings)
      setActiveTab(defaultTab || "transcription")
      // Mark as not initialized yet (will be set after first render)
      isInitializedRef.current = false
      // Set initialized after a tick to skip the initial formState set
      setTimeout(() => {
        isInitializedRef.current = true
      }, 0)
    }
    prevOpenRef.current = open
  }, [open, settings, defaultTab])

  // Auto-save with debounce
  React.useEffect(() => {
    // Skip if not initialized (initial load) or modal is closed
    if (!isInitializedRef.current || !open) return

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save by 300ms
    saveTimeoutRef.current = setTimeout(() => {
      onSave(formState).catch(() => {
        // Error is handled by the hook
      })
    }, 300)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [formState, open, onSave])

  // Handle form field changes
  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }))

    // Apply theme immediately
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
        // Keep selected model ID so user can reinstall the same supported model
        updateField("mlxModel", modelId)
      }
    }

    setConfirmingDeleteId(null)
  }

  // Handle close - save any pending changes immediately
  const handleClose = () => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    // Save immediately on close
    onSave(formState).catch(() => {
      // Error is handled by the hook
    })
    onOpenChange(false)
  }

  const micStatusMeta: Record<
    SettingsModalProps["micStatus"],
    { title: string; description: string; tone: SettingsStatusTone; badge: string }
  > = {
    active: {
      title: "Microphone ready",
      description: micTooltip || "Otto can access your microphone.",
      tone: "ready",
      badge: "Ready",
    },
    denied: {
      title: "Microphone blocked",
      description: micTooltip || "Open System Settings to adjust microphone permissions.",
      tone: "warning",
      badge: "Action needed",
    },
    not_granted: {
      title: "Permission required",
      description: micTooltip || "Open System Settings to adjust microphone permissions.",
      tone: "warning",
      badge: "Action needed",
    },
    unknown: {
      title: "Status unknown",
      description: micTooltip || "Open System Settings to adjust microphone permissions.",
      tone: "warning",
      badge: "Action needed",
    },
  }

  const micMeta = micStatusMeta[micStatus]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[92vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="text-sm text-slate-10">
            Configure recording, transcription, enhancement, and account settings.
          </DialogDescription>
        </DialogHeader>
        <DialogClose />

        <SettingsTabNav
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className={settingsStyles.panelBody}>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {activeTab === "transcription" && (
                <SettingsPanel tabId="transcription">
                  <SettingsSection
                    title="Speech & transcript defaults"
                    description="Choose default language, Whisper model, and short-recording behavior."
                  >
                    <SettingsField label="Language" htmlFor="language">
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
                    </SettingsField>

                    <SettingsField label="Whisper Model" htmlFor="whisperModel">
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
                                <span className="text-xs text-slate-9">{option.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>

                    <SettingsField
                      label="Minimum Recording Duration"
                      htmlFor="recordingThreshold"
                      helpText="Recordings shorter than this will prompt to keep or discard."
                    >
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
                    </SettingsField>
                  </SettingsSection>
                </SettingsPanel>
              )}

              {activeTab === "recording" && (
                <SettingsPanel tabId="recording">
                  <SettingsSection
                    title="Audio permissions"
                    description="Otto needs microphone and system audio access before recording."
                  >
                    <SettingsStatusCard
                      title={micMeta.title}
                      description={micMeta.description}
                      tone={micMeta.tone}
                      badgeLabel={micMeta.badge}
                      icon={
                        micStatus === "active" ? (
                          <Mic className="h-5 w-5 text-jade-12" />
                        ) : (
                          <MicOff className="h-5 w-5 text-amber-12" />
                        )
                      }
                      action={
                        micStatus !== "active" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onMicClick}
                            disabled={!onMicClick}
                          >
                            Open System Settings
                          </Button>
                        ) : undefined
                      }
                    />

                    <SettingsStatusCard
                      title={systemAudioAvailable ? "System audio ready" : "Permission required"}
                      description={
                        systemAudioAvailable
                          ? "Otto can record your system audio."
                          : "Allow Screen & System Audio Recording in System Settings."
                      }
                      tone={systemAudioAvailable ? "ready" : "warning"}
                      badgeLabel={systemAudioAvailable ? "Ready" : "Action needed"}
                      icon={
                        <Volume2
                          className={cn(
                            "h-5 w-5",
                            systemAudioAvailable ? "text-jade-12" : "text-amber-12"
                          )}
                        />
                      }
                      action={
                        !systemAudioAvailable ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onMicClick}
                            disabled={!onMicClick}
                          >
                            Open System Settings
                          </Button>
                        ) : undefined
                      }
                    />

                    {isSystemAudioOnly ? (
                      <p className="text-xs text-amber-11">
                        Recording is currently running with system audio only.
                      </p>
                    ) : null}
                  </SettingsSection>
                </SettingsPanel>
              )}

              {activeTab === "enhancement" && (
                <SettingsPanel tabId="enhancement">
                  <SettingsSection
                    title="Model management"
                    description="Install and select local AI models used for note enhancement."
                  >
                    <div className="rounded-lg border border-slate-6 bg-white px-3 py-2 text-xs text-slate-10 dark:bg-black">
                      Active model:{" "}
                      <span className="font-medium text-slate-12">
                        {modelManager.availableModels.find((model) => model.id === formState.mlxModel)?.name ||
                          formState.mlxModel}
                      </span>
                    </div>

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
                              "rounded-lg border p-3 transition-colors",
                              isActive
                                ? "border-jade-7 bg-white dark:bg-black"
                                : "border-slate-6 bg-white dark:bg-black"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium text-slate-12">{model.name}</p>
                                  {isActive ? (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-jade-11">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-xs text-slate-10">{model.description}</p>
                                <p className="mt-1 text-[11px] text-slate-9">
                                  {isInstalled ? installedSizeLabel : sizeLabel}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                {!isInstalled && !isDownloading ? (
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => modelManager.downloadModel(model.id)}
                                    disabled={modelManager.isDownloading}
                                  >
                                    Install
                                  </Button>
                                ) : null}

                                {isDownloading ? (
                                  <Button type="button" variant="outline" size="sm" disabled>
                                    Downloading
                                  </Button>
                                ) : null}

                                {isInstalled && !isActive && !isDownloading ? (
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
                                          className="h-7 px-2 text-red-11 hover:bg-red-3 hover:text-red-12"
                                        >
                                          Yes
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setConfirmingDeleteId(null)}
                                          className="h-7 px-2 text-slate-11 hover:text-slate-12"
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
                                        className="text-red-11 hover:bg-red-3 hover:text-red-12"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                ) : null}

                                {isInstalled && isActive && !isDownloading ? (
                                  <>
                                    {isConfirmingDelete ? (
                                      <div className="flex items-center gap-1 text-xs">
                                        <span className="text-slate-11">Delete?</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteModel(model.id)}
                                          className="h-7 px-2 text-red-11 hover:bg-red-3 hover:text-red-12"
                                        >
                                          Yes
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setConfirmingDeleteId(null)}
                                          className="h-7 px-2 text-slate-11 hover:text-slate-12"
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
                                        className="text-red-11 hover:bg-red-3 hover:text-red-12"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {isDownloading ? (
                              <div className="mt-3 space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-9">
                                  <span>Downloading</span>
                                  <span>
                                    {modelManager.downloadedSize || "0.0 MB"}
                                    {modelManager.totalSize &&
                                    modelManager.totalSize !== "unknown" &&
                                    modelManager.totalSize !== "0.0 MB"
                                      ? ` / ${modelManager.totalSize}`
                                      : ""}
                                  </span>
                                </div>
                                <Progress
                                  value={modelManager.downloadProgress}
                                  indeterminate={
                                    !modelManager.totalSize ||
                                    modelManager.totalSize === "unknown" ||
                                    modelManager.totalSize === "0.0 MB"
                                  }
                                  className="h-1.5"
                                />
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <div className="rounded-lg border border-slate-6 bg-white px-3 py-2 text-xs text-slate-10 dark:bg-black">
                        No available models found.
                      </div>
                    )}

                    {modelManager.hasDownloadError ? (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription className="text-xs">
                          {modelManager.downloadError}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </SettingsSection>
                </SettingsPanel>
              )}

              {activeTab === "account" && (
                <SettingsPanel tabId="account">
                  <SettingsSection
                    title="Appearance"
                    description="Choose how Otto looks while you work."
                  >
                    <SettingsField
                      label="Theme"
                      htmlFor="theme"
                      helpText="Use System to follow your macOS appearance preference."
                    >
                      <Select
                        value={formState.theme}
                        onValueChange={(value) => updateField("theme", value as Settings["theme"])}
                      >
                        <SelectTrigger id="theme">
                          <span className="truncate text-left">
                            {getLabel(THEME_OPTIONS, formState.theme)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {THEME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>
                  </SettingsSection>

                  <SettingsSection
                    title="Profile & access"
                    description="Manage your account details and sign-in session."
                  >
                    <div className="flex items-center justify-between rounded-lg border border-slate-6 bg-white p-3 dark:bg-black">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-jade-3">
                          <UserIcon className="h-5 w-5 text-jade-11" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-12">
                            {userProfile?.displayName || user?.email?.split("@")[0] || "User"}
                          </p>
                          <p className="truncate text-xs text-slate-10">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    <AccountBadge accountType={userProfile?.accountType || "unknown"} />

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-center text-red-11 hover:bg-red-3 hover:text-red-12"
                      onClick={async () => {
                        try {
                          await authSignOut()
                          onOpenChange(false)
                        } catch (err) {
                          console.error("Sign out error:", err)
                        }
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </SettingsSection>
                </SettingsPanel>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="relative z-20">
          <div className="flex items-center gap-3">
            {isSaving ? (
              <span className="flex items-center gap-2 text-xs text-slate-10">
                <Spinner size="sm" />
                Saving...
              </span>
            ) : null}
            <Button variant="outline" onClick={handleClose} className="z-20">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
