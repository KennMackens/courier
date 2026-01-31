// Global type declarations for the renderer process

// Settings type
export interface Settings {
  language: string
  whisperModel: string
  ollamaModel: string
  ollamaEndpoint: string
  availableModels: string[]
}

// Database types
export interface Meeting {
  id: string
  title: string | null
  date_time: string
  duration: number
  transcript_path: string | null
  audio_path: string | null
  created_at: string
  updated_at: string
}

export interface Speaker {
  id: string
  meeting_id: string
  name: string
  word_count: number
}

export interface Summary {
  id: string
  meeting_id: string
  type: 'original' | 'enhanced'
  content: string
  created_at: string
}

export interface MeetingWithDetails extends Meeting {
  speakers: Speaker[]
  summaries: Summary[]
}

export interface CreateMeetingInput {
  title?: string
  date_time?: string
  duration?: number
  transcript_path?: string
  audio_path?: string
}

export interface MeetingListOptions {
  limit?: number
  offset?: number
  search?: string
}

// Python API interface
export interface PythonAPI {
  // Initialization
  initialize: () => Promise<{
    ready: boolean
    version: string
    pythonVersion: string
    helperAvailable: boolean
  }>

  // Recording
  checkPermission: () => Promise<{ granted: boolean }>
  startRecording: (params?: { sampleRate?: number }) => Promise<{
    started: boolean
    actualSampleRate: number
  }>
  stopRecording: () => Promise<{
    stopped: boolean
    audioLength: number
    durationSec: number
    totalBufferLength: number
  }>

  // Transcription
  transcribe: (params?: { language?: string; model?: string }) => Promise<{
    transcript: string
    totalTranscript: string
  }>

  // Note enhancement
  enhanceNotes: (params: {
    notes: string
    transcript?: string
    language?: string
  }) => Promise<{ complete: boolean }>

  // Settings
  getSettings: () => Promise<Settings>
  setSettings: (settings: Partial<Settings>) => Promise<{ ok: boolean }>

  // Ollama
  getOllamaModels: () => Promise<{ models: string[] }>

  // Session
  resetSession: () => Promise<{ ok: boolean }>

  // Event listeners
  onTranscribeProgress: (callback: (data: { status?: string; progress?: number; partial?: string }) => void) => () => void
  onEnhanceToken: (callback: (data: { token: string; status?: string }) => void) => () => void
  onRecordingError: (callback: (message: string) => void) => () => void
  onError: (callback: (error: { message: string }) => void) => () => void
}

// Database API interface
export interface DatabaseAPI {
  // Meetings
  createMeeting: (input: CreateMeetingInput) => Promise<Meeting>
  getMeeting: (id: string) => Promise<Meeting | null>
  getMeetingWithDetails: (id: string) => Promise<MeetingWithDetails | null>
  listMeetings: (options?: MeetingListOptions) => Promise<Meeting[]>
  updateMeeting: (id: string, input: Partial<CreateMeetingInput>) => Promise<Meeting | null>
  deleteMeeting: (id: string) => Promise<boolean>

  // Speakers
  addSpeaker: (meetingId: string, name: string, wordCount?: number) => Promise<Speaker>
  getSpeakers: (meetingId: string) => Promise<Speaker[]>

  // Summaries
  addSummary: (meetingId: string, type: 'original' | 'enhanced', content: string) => Promise<Summary>
  getSummaries: (meetingId: string) => Promise<Summary[]>
  getSummaryByType: (meetingId: string, type: 'original' | 'enhanced') => Promise<Summary | null>
  updateSummary: (meetingId: string, type: 'original' | 'enhanced', content: string) => Promise<Summary>

  // Search
  searchMeetings: (query: string, limit?: number) => Promise<Meeting[]>
  indexMeeting: (meetingId: string, title: string, transcriptContent: string, summaryContent: string) => Promise<{ ok: boolean }>

  // Storage
  saveTranscript: (meetingId: string, content: string) => Promise<{ path: string }>
  readTranscript: (meetingId: string) => Promise<{ content: string | null }>

  // Statistics
  getMeetingCount: () => Promise<{ count: number }>
  getTotalDuration: () => Promise<{ duration: number }>
}

// Extend Window interface
declare global {
  interface Window {
    python: PythonAPI
    database: DatabaseAPI
  }
}

// Vite environment
interface ImportMetaEnv {
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
