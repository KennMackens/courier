import { useState, useEffect, useCallback } from "react"
import { StatusBar } from "@/components/StatusBar"
import { NotesEditor } from "@/components/NotesEditor"
import { SettingsModal } from "@/components/SettingsModal"
import { SessionHistorySidebar } from "@/components/SessionHistory"
import { HistorySessionView } from "@/components/HistorySessionView"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Toast, ToastTitle, ToastDescription, ToastContainer } from "@/components/ui/toast"
import { useRecording } from "@/hooks/useRecording"
import { useTranscription } from "@/hooks/useTranscription"
import { useNotesEnhancement } from "@/hooks/useNotesEnhancement"
import { useEnhancementQueue } from "@/hooks/useEnhancementQueue"
import { useSettings } from "@/hooks/useSettings"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { applyTheme, getStoredTheme } from "@/lib/theme"
import ComponentDemo from "@/ComponentDemo"

const SIDEBAR_STORAGE_KEY = 'courier-sidebar-open'

function getSidebarStoredState(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

function setSidebarStoredState(open: boolean): void {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, open.toString())
}

// Extract title from notes (first line) or generate fallback
function extractTitleFromNotes(notes: string): string {
  if (!notes.trim()) {
    return formatMeetingTitle(new Date())
  }
  const firstLine = notes.split("\n")[0].trim()
  // Remove markdown headers if present
  const cleanTitle = firstLine.replace(/^#+\s*/, "").trim()
  return cleanTitle.slice(0, 100) || formatMeetingTitle(new Date())
}

// Format meeting title with date/time
function formatMeetingTitle(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  return `Meeting - ${date.toLocaleString('en-US', options)}`
}

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
  onClick?: () => void
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
  const [sidebarOpen, setSidebarOpen] = useState(() => getSidebarStoredState())

  // Track current meeting being processed (for auto-save flow)
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null)

  // Custom hooks
  const recording = useRecording({
    onError: (error) => showToast("Recording Error", error, "destructive"),
    onStopped: async (audioLength, duration) => {
      // Auto-save meeting immediately when recording stops
      try {
        const title = extractTitleFromNotes(notes)
        const meeting = await window.database.createMeeting({
          title,
          date_time: new Date().toISOString(),
          duration: duration || recording.duration,
          enhancement_status: 'pending',
          is_new: Date.now(),
        })

        // Save raw notes as 'original' summary
        if (notes.trim()) {
          await window.database.addSummary(meeting.id, "original", notes)
        }

        // Track the meeting being processed
        setCurrentMeetingId(meeting.id)

        // Add to session history and open sidebar
        sessionHistory.addMeeting(meeting)
        setSidebarOpen(true)
        sessionHistory.selectMeeting(meeting.id)

        showToast("Meeting Saved", "Recording saved. Transcribing...", "success")

        // Auto-transcribe after saving
        transcription.transcribe({
          language: settings.settings.language,
          model: settings.settings.whisperModel,
        })
      } catch (error) {
        showToast(
          "Error",
          error instanceof Error ? error.message : "Failed to save meeting",
          "destructive"
        )
        // Still try to transcribe even if save failed
        transcription.transcribe({
          language: settings.settings.language,
          model: settings.settings.whisperModel,
        })
      }
    },
  })

  const transcription = useTranscription({
    onComplete: async (transcript: string) => {
      // Save transcript to current meeting if one exists
      if (currentMeetingId && transcript.trim()) {
        try {
          // Save transcript to file and update meeting
          await window.database.saveTranscript(currentMeetingId, transcript)

          // Get the meeting title for indexing
          const meeting = await window.database.getMeeting(currentMeetingId)
          if (meeting) {
            await window.database.indexMeeting(
              currentMeetingId,
              meeting.title || "",
              transcript,
              "" // No enhanced notes yet
            )
          }

          // Refresh the meeting details in the sidebar
          await sessionHistory.refresh()
          if (sessionHistory.selectedMeetingId === currentMeetingId) {
            sessionHistory.selectMeeting(currentMeetingId)
          }

          // Auto-enqueue enhancement after transcription completes
          // Get the original notes from the database
          const originalSummary = await window.database.getSummaryByType(currentMeetingId, "original")
          const originalNotes = originalSummary?.content || ""

          // Extract user title from original notes
          const [firstLine] = originalNotes.split("\n")
          const userTitle = firstLine?.trim() || ""

          enhancementQueue.enqueueEnhancement({
            meetingId: currentMeetingId,
            notes: originalNotes,
            transcript: transcript,
            language: settings.settings.language,
            userTitle,
          })

          showToast("Transcription Complete", "Audio transcribed. Enhancement starting...", "success")
        } catch (error) {
          console.error("Failed to save transcript:", error)
          showToast("Transcription Complete", "Audio has been transcribed.", "success")
        }
      } else {
        showToast("Transcription Complete", "Audio has been transcribed.", "success")
      }
    },
    onError: (error) => showToast("Transcription Error", error, "destructive"),
  })

  const enhancement = useNotesEnhancement({
    // Toasts are now handled in the modal context
  })

  const settings = useSettings({
    onError: (error) => showToast("Settings Error", error, "destructive"),
    onSaved: () => showToast("Settings Saved", "Your settings have been saved.", "success"),
  })

  const sessionHistory = useSessionHistory({
    onError: (error) => showToast("History Error", error, "destructive"),
    onMeetingDeleted: () => showToast("Meeting Deleted", "The meeting has been removed.", "default"),
  })

  // Enhancement queue for automatic background processing
  const enhancementQueue = useEnhancementQueue({
    onEnhancementStart: (meetingId) => {
      console.log(`[Enhancement] Started enhancing meeting ${meetingId}`)
    },
    onEnhancementComplete: async (meetingId, enhancedNotes) => {
      // Refresh sidebar to show updated status
      await sessionHistory.refresh()
      if (sessionHistory.selectedMeetingId === meetingId) {
        sessionHistory.selectMeeting(meetingId)
      }

      // Show toast if user is not viewing the enhanced meeting
      if (sessionHistory.selectedMeetingId !== meetingId) {
        const meeting = await window.database.getMeeting(meetingId)
        showToast(
          "Enhancement Complete",
          `"${meeting?.title || 'Meeting'}" has been enhanced.`,
          "success",
          () => {
            // Navigate to the enhanced meeting when toast is clicked
            setSidebarOpen(true)
            sessionHistory.selectMeeting(meetingId)
          }
        )
      }
    },
    onEnhancementError: async (meetingId, error) => {
      console.error(`[Enhancement] Failed for meeting ${meetingId}:`, error)
      await sessionHistory.refresh()
      showToast("Enhancement Failed", error, "destructive")
    },
    onStatusChange: async (meetingId, status) => {
      // Refresh meeting in sidebar when status changes
      await sessionHistory.refresh()
      if (sessionHistory.selectedMeetingId === meetingId) {
        sessionHistory.selectMeeting(meetingId)
      }
    },
  })

  // Toast helper
  const showToast = useCallback(
    (title: string, description: string, variant: ToastState["variant"] = "default", onClick?: () => void) => {
      const id = Date.now().toString()
      setToasts((prev) => [...prev, { id, title, description, variant, onClick }])

      // Auto-dismiss after 5 seconds (unless user clicks)
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Persist sidebar state
  useEffect(() => {
    setSidebarStoredState(sidebarOpen)
  }, [sidebarOpen])

  // Handle sidebar close - reset selection
  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false)
    sessionHistory.selectMeeting(null)
  }, [sessionHistory])

  // Handle returning to active session from history view
  const handleReturnToActiveSession = useCallback(() => {
    sessionHistory.selectMeeting(null)
  }, [sessionHistory])

  // Handle updating notes for a historical session
  const handleHistoricalNotesChange = useCallback(async (meetingId: string, notes: string) => {
    try {
      // Extract title from first line of notes
      const [firstLine] = notes.split("\n")
      const newTitle = firstLine?.replace(/^#+\s*/, "").trim().slice(0, 100)

      // Update the meeting title if it changed
      if (newTitle) {
        await window.database.updateMeeting(meetingId, { title: newTitle })
      }

      // Update the enhanced summary in the database
      await window.database.updateSummary(meetingId, "enhanced", notes)

      // Refresh the sidebar to show updated title
      await sessionHistory.refresh()

      // Refresh the meeting details to reflect the change
      await sessionHistory.selectMeeting(meetingId)
    } catch (error) {
      showToast(
        "Error",
        error instanceof Error ? error.message : "Failed to save notes",
        "destructive"
      )
    }
  }, [sessionHistory, showToast])

  // Handle deleting the currently viewed historical session
  const handleDeleteHistoricalSession = useCallback(async () => {
    if (sessionHistory.selectedMeetingId) {
      const success = await sessionHistory.deleteMeeting(sessionHistory.selectedMeetingId)
      return success
    }
    return false
  }, [sessionHistory])

  // Check if viewing a historical session
  const isViewingHistory = sessionHistory.selectedMeetingId !== null && sessionHistory.selectedMeeting !== null

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

  // Handle starting a new recording - resets state for fresh session
  const handleStartRecording = useCallback(async () => {
    // Clear state for new session
    setNotes("")
    setCurrentMeetingId(null)
    transcription.clearTranscript()
    enhancement.clearEnhancedNotes()

    // Deselect any selected meeting to show fresh editor
    sessionHistory.selectMeeting(null)

    // Start recording
    await recording.startRecording()
  }, [recording, transcription, enhancement, sessionHistory])

  // Compute derived state
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
        onHistoryClick={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
          {/* Permission Alert */}
          {!permissionGranted && !isInitializing && (
            <div className="px-6 pt-4">
              <Alert variant="warning">
                <AlertTitle>Permission Required</AlertTitle>
                <AlertDescription>
                  Please grant "Screen & System Audio Recording" permission in System
                  Settings → Privacy & Security to use Courier.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Connection Error */}
          {!connectionStatus.connected && !isInitializing && (
            <div className="px-6 pt-4">
              <Alert variant="destructive">
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>
                  {connectionStatus.error || "Unable to connect to Python backend."}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Main content area - shows history view or notes editor */}
          {isViewingHistory ? (
            <HistorySessionView
              meeting={sessionHistory.selectedMeeting!}
              transcript={sessionHistory.transcript}
              isLoading={sessionHistory.isLoadingDetails}
              onDelete={handleDeleteHistoricalSession}
              onNotesChange={handleHistoricalNotesChange}
              onReturnToActiveSession={handleReturnToActiveSession}
              isRecording={recording.isRecording}
              recordingDuration={recording.duration}
              className="flex-1"
            />
          ) : (
            /* Notes Editor with integrated recording controls */
            <NotesEditor
              notes={notes}
              onNotesChange={setNotes}
              disabled={isDisabled}
              isRecording={recording.isRecording}
              isStopping={recording.isStopping}
              isTranscribing={transcription.isTranscribing}
              duration={recording.duration}
              hasTranscript={transcription.totalTranscript.length > 0}
              onStartRecording={handleStartRecording}
              onStopRecording={recording.stopRecording}
              className="flex-1 p-6"
            />
          )}
        </main>

        {/* Session History Sidebar */}
        <SessionHistorySidebar
          open={sidebarOpen}
          onClose={handleSidebarClose}
          meetings={sessionHistory.meetings}
          selectedMeetingId={sessionHistory.selectedMeetingId}
          isLoading={sessionHistory.isLoading}
          searchQuery={sessionHistory.searchQuery}
          onSearchChange={sessionHistory.setSearchQuery}
          onSelectMeeting={sessionHistory.selectMeeting}
          onDeleteMeeting={sessionHistory.deleteMeeting}
          isEmpty={sessionHistory.isEmpty}
        />
      </div>

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
            onClick={toast.onClick ? () => {
              toast.onClick?.()
              dismissToast(toast.id)
            } : undefined}
            className={toast.onClick ? "cursor-pointer hover:opacity-90" : undefined}
          >
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
            {toast.onClick && (
              <ToastDescription className="text-xs mt-1 opacity-75">
                Click to view
              </ToastDescription>
            )}
          </Toast>
        ))}
      </ToastContainer>

    </div>
  )
}

export default App
