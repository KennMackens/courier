import { useState, useEffect, useCallback } from "react"
import { StatusBar } from "@/components/StatusBar"
import { RecordingControls } from "@/components/RecordingControls"
import { TranscriptView } from "@/components/TranscriptView"
import { NotesEditor } from "@/components/NotesEditor"
import { SettingsModal } from "@/components/SettingsModal"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Toast, ToastTitle, ToastDescription, ToastContainer } from "@/components/ui/toast"
import { useRecording } from "@/hooks/useRecording"
import { useTranscription } from "@/hooks/useTranscription"
import { useNotesEnhancement } from "@/hooks/useNotesEnhancement"
import { useSettings } from "@/hooks/useSettings"
import { applyTheme, getStoredTheme } from "@/lib/theme"

interface ConnectionStatus {
  connected: boolean
  version?: string
  pythonVersion?: string
  helperAvailable?: boolean
  error?: string
}

interface ToastState {
  id: string
  variant: "default" | "destructive" | "success"
  title: string
  description?: string
}

function App() {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
  })
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [toasts, setToasts] = useState<ToastState[]>([])

  // Custom hooks
  const recording = useRecording({
    onError: (error) => showToast("Recording Error", error, "destructive"),
    onStopped: () => {
      // Auto-transcribe after stopping
      transcription.transcribe({
        language: settings.settings.language,
        model: settings.settings.whisperModel,
      })
    },
  })

  const transcription = useTranscription({
    onComplete: () => {
      showToast("Transcription Complete", "Audio has been transcribed.", "success")
    },
    onError: (error) => showToast("Transcription Error", error, "destructive"),
  })

  const enhancement = useNotesEnhancement({
    onComplete: () => {
      showToast("Enhancement Complete", "Notes have been enhanced.", "success")
    },
    onError: (error) => showToast("Enhancement Error", error, "destructive"),
  })

  const settings = useSettings({
    onError: (error) => showToast("Settings Error", error, "destructive"),
    onSaved: () => showToast("Settings Saved", "Your settings have been saved.", "success"),
  })

  // Toast helper
  const showToast = useCallback(
    (title: string, description: string, variant: ToastState["variant"] = "default") => {
      const id = Date.now().toString()
      setToasts((prev) => [...prev, { id, title, description, variant }])

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Initialize connection to Python
  useEffect(() => {
    async function init() {
      try {
        // Apply stored theme
        const storedTheme = getStoredTheme()
        applyTheme(storedTheme)

        // Initialize Python connection
        const result = await window.python.initialize()
        setConnectionStatus({
          connected: true,
          version: result.version,
          pythonVersion: result.pythonVersion,
          helperAvailable: result.helperAvailable,
        })

        // Check permission
        const permResult = await window.python.checkPermission()
        setPermissionGranted(permResult.granted)

        if (!permResult.granted) {
          showToast(
            "Permission Required",
            "Please grant 'Screen & System Audio Recording' permission in System Settings.",
            "destructive"
          )
        }
      } catch (error) {
        setConnectionStatus({
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        })
        showToast("Connection Error", "Failed to connect to Python backend.", "destructive")
      } finally {
        setIsInitializing(false)
      }
    }

    init()

    // Set up global error listener
    const unsubError = window.python.onError((error: { message: string }) => {
      showToast("Error", error.message, "destructive")
    })

    return () => {
      unsubError()
    }
  }, [showToast])

  // Handle enhance notes
  const handleEnhanceNotes = useCallback(() => {
    if (!notes.trim()) return

    enhancement.enhanceNotes({
      notes,
      transcript: transcription.totalTranscript,
      language: settings.settings.language,
    })
  }, [notes, transcription.totalTranscript, settings.settings.language, enhancement])

  // Handle end meeting
  const handleEndMeeting = useCallback(async () => {
    try {
      // TODO: Save to database via IPC when db handlers are ready
      // For now, just reset the session
      await window.python.resetSession()

      // Reset all state
      recording.reset()
      transcription.clearTranscript()
      enhancement.clearEnhancedNotes()
      setNotes("")

      showToast("Meeting Ended", "Session has been saved and reset.", "success")
    } catch (error) {
      showToast(
        "Error",
        error instanceof Error ? error.message : "Failed to end meeting",
        "destructive"
      )
    }
  }, [recording, transcription, enhancement, showToast])

  // Compute derived state
  const hasContent =
    transcription.totalTranscript.length > 0 ||
    notes.length > 0 ||
    enhancement.enhancedNotes.length > 0

  const isDisabled = !connectionStatus.connected || !permissionGranted
  const currentError = recording.error || transcription.error || enhancement.error

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Status Bar */}
      <StatusBar
        isConnected={connectionStatus.connected}
        version={connectionStatus.version}
        permissionGranted={permissionGranted}
        error={currentError}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="border-b border-slate-6 pb-4">
            <h1 className="text-2xl font-bold text-slate-12">Courier</h1>
            <p className="text-sm text-slate-11">Local-first meeting recorder</p>
          </div>

          {/* Permission Alert */}
          {!permissionGranted && !isInitializing && (
            <Alert variant="warning">
              <AlertTitle>Permission Required</AlertTitle>
              <AlertDescription>
                Please grant "Screen & System Audio Recording" permission in System
                Settings → Privacy & Security to use Courier.
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Error */}
          {!connectionStatus.connected && !isInitializing && (
            <Alert variant="destructive">
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                {connectionStatus.error || "Unable to connect to Python backend."}
              </AlertDescription>
            </Alert>
          )}

          {/* Recording Controls */}
          <section className="space-y-4">
            <RecordingControls
              isRecording={recording.isRecording}
              isStopping={recording.isStopping}
              isTranscribing={transcription.isTranscribing}
              duration={recording.duration}
              hasTranscript={hasContent}
              onStartRecording={recording.startRecording}
              onStopRecording={recording.stopRecording}
              onEndMeeting={handleEndMeeting}
              disabled={isDisabled}
            />
          </section>

          {/* Transcript View */}
          <TranscriptView
            transcript={transcription.totalTranscript}
            isTranscribing={transcription.isTranscribing}
            progress={transcription.progress}
          />

          {/* Notes Editor */}
          <NotesEditor
            notes={notes}
            onNotesChange={setNotes}
            enhancedNotes={enhancement.enhancedNotes}
            isEnhancing={enhancement.isEnhancing}
            onEnhanceNotes={handleEnhanceNotes}
            disabled={isDisabled}
          />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings.settings}
        isLoading={settings.isLoading}
        isSaving={settings.isSaving}
        error={settings.error}
        onSave={settings.saveSettings}
      />

      {/* Toast Notifications */}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            variant={toast.variant}
            onClose={() => dismissToast(toast.id)}
          >
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}

export default App
