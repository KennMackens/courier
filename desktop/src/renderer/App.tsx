import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { StatusBar } from "@/components/StatusBar"
import { NotesEditor } from "@/components/NotesEditor"
import { SettingsModal } from "@/components/SettingsModal"
import { DiscardRecordingModal } from "@/components/DiscardRecordingModal"
import { SessionHistorySidebar } from "@/components/SessionHistory"
import { HistorySessionView } from "@/components/HistorySessionView"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Toast, ToastTitle, ToastDescription, ToastContainer } from "@/components/ui/toast"
import { useRecording } from "@/hooks/useRecording"
import { useTranscription } from "@/hooks/useTranscription"
import { useSettings } from "@/hooks/useSettings"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { applyTheme, getStoredTheme } from "@/lib/theme"
import { normalizeMeetingTitle, resolveMeetingTitle } from "@/lib/meetingTitle"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { AuthScreen } from "@/components/AuthScreen"
import { Spinner } from "@/components/ui/spinner"

const SIDEBAR_STORAGE_KEY = 'otto-sidebar-open'

function getSidebarStoredState(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

function setSidebarStoredState(open: boolean): void {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, open.toString())
}

// Extract title from notes (first line) or generate fallback
function extractTitleFromNotes(notes: string): string {
  const firstLine = notes.split("\n")[0] ?? ""
  return resolveMeetingTitle(firstLine, new Date())
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
  const [discardModalOpen, setDiscardModalOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [toasts, setToasts] = useState<ToastState[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(() => getSidebarStoredState())
  const toastIdCounterRef = useRef(0)

  // Pending recording data for discard modal flow
  const pendingRecordingRef = useRef<{
    audioLength: number
    duration: number
  } | null>(null)

  // Ref to track current recording threshold (updated when settings change)
  const recordingThresholdRef = useRef(30)

  // Track current meeting being processed (for auto-save flow)
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null)
  // Ref to avoid stale closure in async callbacks
  const currentMeetingIdRef = useRef<string | null>(null)
  // Track start times for progress UI (sidebar computes elapsed locally at coarse cadence)
  const [transcriptionStartedAt, setTranscriptionStartedAt] = useState<number | null>(null)

  // Ref to hold the save function (updated after hooks are defined)
  const saveAndProcessRecordingRef = useRef<(audioLength: number, duration: number) => Promise<void>>()

  // Custom hooks
  const recording = useRecording({
    onError: (error) => showToast("Recording Error", error, "destructive"),
    onStopped: async (audioLength, duration) => {
      // Store pending recording data (used by modal and by threshold check)
      pendingRecordingRef.current = { audioLength, duration }

      // Get threshold from ref (updated when settings change)
      const threshold = recordingThresholdRef.current

      // Check if recording is shorter than threshold
      if (threshold > 0 && duration < threshold) {
        // Show modal to ask user
        setDiscardModalOpen(true)
        return
      }

      // Proceed with normal flow
      saveAndProcessRecordingRef.current?.(audioLength, duration)
    },
  })

  const transcription = useTranscription({
    onComplete: async (transcript: string) => {
      // Use ref to get current meeting ID (avoids stale closure)
      const meetingId = currentMeetingIdRef.current

      // Save transcript to current meeting if one exists
      if (meetingId && transcript.trim()) {
        try {
          // Save transcript to file and update meeting
          await window.database.saveTranscript(meetingId, transcript)

          // Get the meeting title for indexing
          const meeting = await window.database.getMeeting(meetingId)
          if (meeting) {
              await window.database.indexMeeting(
                meetingId,
                meeting.title || "",
                transcript,
                "" // No notes yet
              )
          }

          // Refresh the meeting details in the sidebar
          await sessionHistory.refresh()
          if (sessionHistory.selectedMeetingId === meetingId) {
            sessionHistory.selectMeeting(meetingId)
          }

          showToast("Transcription Complete", "Audio has been transcribed.", "success")
        } catch (error) {
          console.error("Failed to save transcript:", error)
          showToast("Transcription Complete", "Audio has been transcribed.", "success")
        }
      } else {
        console.log("[Transcription] No meeting ID or empty transcript:", { meetingId, transcriptLength: transcript.length })
        showToast("Transcription Complete", "Audio has been transcribed.", "success")
      }
    },
    onError: (error) => showToast("Transcription Error", error, "destructive"),
  })

  const settings = useSettings({
    onError: (error) => showToast("Settings Error", error, "destructive"),
    onSaved: () => showToast("Settings Saved", "Your settings have been saved.", "success"),
  })

  // Update recording threshold ref when settings change
  useEffect(() => {
    recordingThresholdRef.current = settings.settings.recordingThreshold
  }, [settings.settings.recordingThreshold])

  // Track transcription start/stop boundaries for progress display
  useEffect(() => {
    if (transcription.isTranscribing && transcriptionStartedAt === null) {
      setTranscriptionStartedAt(Date.now())
    }
    if (!transcription.isTranscribing && transcriptionStartedAt !== null) {
      setTranscriptionStartedAt(null)
    }
  }, [transcription.isTranscribing, transcriptionStartedAt])


  const sessionHistory = useSessionHistory({
    onError: (error) => showToast("History Error", error, "destructive"),
    onMeetingDeleted: () => showToast("Meeting Deleted", "The meeting has been removed.", "default"),
  })

  // Toast helper
  const showToast = useCallback(
    (title: string, description: string, variant: ToastState["variant"] = "default", onClick?: () => void) => {
      const id = `${Date.now()}-${toastIdCounterRef.current++}`
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

  // Helper function to save and process the recording (defined after all hooks)
  const saveAndProcessRecording = useCallback(async (_audioLength: number, duration: number) => {
    try {
      const title = extractTitleFromNotes(notes)
      const meeting = await window.database.createMeeting({
        title,
        date_time: new Date().toISOString(),
        duration: duration || recording.duration,
        is_new: Date.now(),
      })

      // Save raw notes as 'original' summary
      if (notes.trim()) {
        await window.database.addSummary(meeting.id, "original", notes)
      }

      // Track the meeting being processed (update both state and ref)
      setCurrentMeetingId(meeting.id)
      currentMeetingIdRef.current = meeting.id

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
  }, [notes, recording.duration, sessionHistory, settings.settings.language, settings.settings.whisperModel, showToast, transcription])

  // Update the ref when saveAndProcessRecording changes
  useEffect(() => {
    saveAndProcessRecordingRef.current = saveAndProcessRecording
  }, [saveAndProcessRecording])

  // Handle sidebar close - reset selection
  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false)
    sessionHistory.selectMeeting(null)
  }, [sessionHistory])

  // Handle returning to active session from history view
  const handleReturnToActiveSession = useCallback(() => {
    setSidebarOpen(false)
    // If not currently recording or transcribing, reset to a fresh session so recording HUD is visible
    if (!recording.isRecording && !transcription.isTranscribing) {
      setNotes("")
      setCurrentMeetingId(null)
      currentMeetingIdRef.current = null
      transcription.clearTranscript()
    }
    sessionHistory.selectMeeting(null)
  }, [recording.isRecording, transcription.isTranscribing, sessionHistory, transcription])

  // Handle updating notes for a historical session
  const handleHistoricalNotesChange = useCallback(async (
    meetingId: string,
    payload: { title: string; notes: string }
  ) => {
    try {
      const safeTitle = resolveMeetingTitle(normalizeMeetingTitle(payload.title), new Date())

      // Update title metadata
      await window.database.updateMeeting(meetingId, { title: safeTitle })

      // Update notes summary in the database
      await window.database.updateSummary(meetingId, "original", payload.notes)

      // Keep search index in sync with edited title/notes.
      try {
        const transcriptResult = await window.database.readTranscript(meetingId)
        await window.database.indexMeeting(
          meetingId,
          safeTitle,
          transcriptResult.content || "",
          payload.notes
        )
      } catch (indexError) {
        console.warn("[History] Failed to re-index meeting after title/notes update:", indexError)
      }

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

  // Derived progress/eta for sidebar status
  const normalizeProgress = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return 0
    return value <= 1 ? Math.round(value * 100) : Math.round(value)
  }

  const transcriptionProgressPct = normalizeProgress(transcription.progress)
  const processingState = useMemo(() => {
    const transcriptionProgress = transcription.isTranscribing
      ? Math.min(100, Math.max(transcriptionProgressPct, 5))
      : 0

    return {
      transcription: transcription.isTranscribing && currentMeetingId
        ? {
            meetingId: currentMeetingId,
            progress: transcriptionProgress,
            startedAt: transcriptionStartedAt,
          }
        : null,
    }
  }, [
    currentMeetingId,
    transcription.isTranscribing,
    transcriptionProgressPct,
    transcriptionStartedAt,
  ])

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

  // Handle keeping the short recording
  const handleKeepRecording = useCallback(async () => {
    setDiscardModalOpen(false)
    const pending = pendingRecordingRef.current
    if (pending) {
      pendingRecordingRef.current = null
      await saveAndProcessRecordingRef.current?.(pending.audioLength, pending.duration)
    }
  }, [])

  // Handle discarding the short recording
  const handleDiscardRecording = useCallback(async () => {
    setDiscardModalOpen(false)
    pendingRecordingRef.current = null

    // Reset the session on the Python side (clears audio buffer)
    try {
      await window.python.resetSession()
    } catch (error) {
      console.error("Failed to reset session:", error)
    }

    // Clear local state
    setNotes("")
    setCurrentMeetingId(null)
    currentMeetingIdRef.current = null
    transcription.clearTranscript()

    showToast("Recording Discarded", "The short recording has been discarded.", "default")
  }, [transcription, showToast])

  // Handle starting a new recording - resets state for fresh session
  const handleStartRecording = useCallback(async () => {
    // Reset Python-side session first so new recordings never reuse prior audio buffer.
    try {
      await window.python.resetSession()
    } catch (error) {
      console.error("Failed to reset session before starting recording:", error)
      showToast(
        "Error",
        "Could not start a fresh recording session. Please try again.",
        "destructive"
      )
      return
    }

    // Clear state for new session
    setNotes("")
    setCurrentMeetingId(null)
    currentMeetingIdRef.current = null
    transcription.clearTranscript()

    // Deselect any selected meeting to show fresh editor
    sessionHistory.selectMeeting(null)

    // Start recording
    await recording.startRecording()
  }, [recording, transcription, sessionHistory, showToast])

  // Compute derived state
  const isDisabled = !connectionStatus.connected
  const currentError = recording.error || transcription.error

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
                  Settings → Privacy & Security to use Otto.
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

          {/* Inline mic warning when recording without access */}
          {recording.isRecording && recording.micStatus !== "active" && (
            <div className="px-6 pt-4">
              <Alert variant="warning">
                <AlertTitle>Microphone access needed</AlertTitle>
                <AlertDescription>
                  Microphone access needed. Click to open System Settings and allow access. Recording system audio only right now.
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
            <div className="flex-1 flex flex-col min-h-0">
              <NotesEditor
                notes={notes}
                onNotesChange={setNotes}
                disabled={isDisabled}
                startRecordingDisabled={false}
                isRecording={recording.isRecording}
                isStopping={recording.isStopping}
                isTranscribing={transcription.isTranscribing}
                duration={recording.duration}
                hasTranscript={transcription.totalTranscript.length > 0}
                onStartRecording={handleStartRecording}
                onStopRecording={recording.stopRecording}
                micStatus={recording.micStatus}
                micWarning={recording.micWarning}
                className="flex-1 p-6"
              />
            </div>
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
          processing={processingState}
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
        micStatus={recording.micStatus || (permissionGranted ? "active" : "not_granted")}
        micTooltip={recording.micWarning}
        onMicClick={() => window.system?.openMicSettings()}
        systemAudioAvailable={permissionGranted}
      />

      {/* Discard Recording Modal */}
      <DiscardRecordingModal
        open={discardModalOpen}
        duration={pendingRecordingRef.current?.duration || 0}
        threshold={settings.settings.recordingThreshold}
        onKeep={handleKeepRecording}
        onDiscard={handleDiscardRecording}
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

// Wrapper component that handles authentication
function AppWithAuth() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

// Component that shows AuthScreen or App based on auth state
function AuthenticatedApp() {
  const { user, userProfile, loading, signOut } = useAuth()

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-1">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-10">Loading...</p>
        </div>
      </div>
    )
  }

  // Show AuthScreen if not authenticated
  if (!user) {
    return <AuthScreen />
  }

  // Check if user has access
  if (userProfile && userProfile.hasAccess === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-1 p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="bg-slate-2 border border-slate-6 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-3 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-12 text-center">Access Denied</h2>
            </div>

            <p className="text-sm text-slate-11 text-center">
              Your account has been disabled. Please contact support for assistance.
            </p>

            <button
              onClick={() => signOut()}
              className="w-full mt-4 px-4 py-2 bg-slate-3 hover:bg-slate-4 text-slate-12 rounded-md transition-colors text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show main app if authenticated and has access
  return <App />
}

export default AppWithAuth
