import { useState, useEffect, useCallback } from "react"
import { StatusBar } from "@/components/StatusBar"
import { NotesEditor } from "@/components/NotesEditor"
import { SettingsModal } from "@/components/SettingsModal"
import { EndMeetingModal, BackgroundNotification } from "@/components/EndMeetingModal"
import { SessionHistorySidebar } from "@/components/SessionHistory"
import { HistorySessionView } from "@/components/HistorySessionView"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Toast, ToastTitle, ToastDescription, ToastContainer } from "@/components/ui/toast"
import { useRecording } from "@/hooks/useRecording"
import { useTranscription } from "@/hooks/useTranscription"
import { useNotesEnhancement } from "@/hooks/useNotesEnhancement"
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
  const [endMeetingModalOpen, setEndMeetingModalOpen] = useState(false)
  const [isBackgrounded, setIsBackgrounded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => getSidebarStoredState())

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
      // Update the enhanced summary in the database
      await window.database.updateSummary(meetingId, "enhanced", notes)
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

  // Handle enhance notes
  const handleEnhanceNotes = useCallback(() => {
    if (!notes.trim()) return

    enhancement.enhanceNotes({
      notes,
      transcript: transcription.totalTranscript,
      language: settings.settings.language,
    })
  }, [notes, transcription.totalTranscript, settings.settings.language, enhancement])

  // Handle end meeting - opens modal and triggers enhancement
  const handleEndMeeting = useCallback(() => {
    setEndMeetingModalOpen(true)
    setIsBackgrounded(false)

    // Auto-trigger enhancement if there's content
    const hasNotes = notes.trim().length > 0
    const hasTranscript = transcription.totalTranscript.trim().length > 0

    if (hasNotes || hasTranscript) {
      enhancement.clearEnhancedNotes()
      enhancement.enhanceNotes({
        notes,
        transcript: transcription.totalTranscript,
        language: settings.settings.language,
      })
    }
  }, [notes, transcription.totalTranscript, settings.settings.language, enhancement])

  // Handle backgrounding the modal
  const handleBackground = useCallback(() => {
    setIsBackgrounded(true)
    setEndMeetingModalOpen(false)
  }, [])

  // Handle restoring the modal from background
  const handleRestoreModal = useCallback(() => {
    setIsBackgrounded(false)
    setEndMeetingModalOpen(true)
  }, [])

  // Extract title from enhanced notes (first line or fallback)
  const extractTitle = useCallback((enhancedNotes: string) => {
    if (!enhancedNotes.trim()) return null
    // Try to get the first line as title
    const firstLine = enhancedNotes.split("\n")[0].trim()
    // Remove markdown headers if present
    const cleanTitle = firstLine.replace(/^#+\s*/, "").trim()
    // Limit length
    return cleanTitle.slice(0, 100) || null
  }, [])

  // Handle saving and closing the meeting
  const handleSave = useCallback(async () => {
    try {
      // Extract title from enhanced notes
      const title = extractTitle(enhancement.enhancedNotes) || `Meeting - ${new Date().toLocaleDateString()}`

      // Create meeting in database
      const meeting = await window.database.createMeeting({
        title,
        date_time: new Date().toISOString(),
        duration: recording.duration,
      })

      // Save raw notes as 'original' summary
      if (notes.trim()) {
        await window.database.addSummary(meeting.id, "original", notes)
      }

      // Save enhanced notes as 'enhanced' summary
      if (enhancement.enhancedNotes.trim()) {
        await window.database.addSummary(meeting.id, "enhanced", enhancement.enhancedNotes)
      }

      // Save transcript to file
      if (transcription.totalTranscript.trim()) {
        await window.database.saveTranscript(meeting.id, transcription.totalTranscript)

        // Index for search
        await window.database.indexMeeting(
          meeting.id,
          title,
          transcription.totalTranscript,
          enhancement.enhancedNotes
        )
      }

      // Reset Python session
      await window.python.resetSession()

      // Add meeting to history and open sidebar
      sessionHistory.addMeeting(meeting)

      // Reset all state
      recording.reset()
      transcription.clearTranscript()
      enhancement.clearEnhancedNotes()
      setNotes("")
      setEndMeetingModalOpen(false)
      setIsBackgrounded(false)

      // Open sidebar to show saved meeting
      setSidebarOpen(true)
      sessionHistory.selectMeeting(meeting.id)

      showToast("Meeting Saved", "Your meeting notes have been saved.", "success")
    } catch (error) {
      showToast(
        "Error",
        error instanceof Error ? error.message : "Failed to save meeting",
        "destructive"
      )
    }
  }, [recording, transcription, enhancement, notes, extractTitle, sessionHistory, showToast])

  // Handle discarding the meeting
  const handleDiscard = useCallback(async () => {
    try {
      await window.python.resetSession()

      // Reset all state
      recording.reset()
      transcription.clearTranscript()
      enhancement.clearEnhancedNotes()
      setNotes("")
      setEndMeetingModalOpen(false)
      setIsBackgrounded(false)

      showToast("Meeting Discarded", "Session has been discarded.", "default")
    } catch (error) {
      showToast(
        "Error",
        error instanceof Error ? error.message : "Failed to discard meeting",
        "destructive"
      )
    }
  }, [recording, transcription, enhancement, showToast])

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
              onStartRecording={recording.startRecording}
              onStopRecording={recording.stopRecording}
              onEndMeeting={handleEndMeeting}
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
          >
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </Toast>
        ))}
      </ToastContainer>

      {/* End Meeting Modal */}
      <EndMeetingModal
        open={endMeetingModalOpen}
        onOpenChange={setEndMeetingModalOpen}
        rawNotes={notes}
        transcript={transcription.totalTranscript}
        enhancedNotes={enhancement.enhancedNotes}
        isEnhancing={enhancement.isEnhancing}
        enhancementError={enhancement.error}
        onEnhance={handleEnhanceNotes}
        onBackground={handleBackground}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* Background Notification */}
      <BackgroundNotification
        visible={isBackgrounded}
        isEnhancing={enhancement.isEnhancing}
        isComplete={enhancement.isComplete}
        hasError={enhancement.hasError}
        onClick={handleRestoreModal}
      />
    </div>
  )
}

export default App
