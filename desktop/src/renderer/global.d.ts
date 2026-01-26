// Global type declarations for the renderer process

// Settings type
export interface Settings {
  language: string
  whisperModel: string
  ollamaModel: string
  ollamaEndpoint: string
  availableModels: string[]
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

  // Session
  resetSession: () => Promise<{ ok: boolean }>

  // Event listeners
  onTranscribeProgress: (callback: (data: { status?: string; progress?: number; partial?: string }) => void) => () => void
  onEnhanceToken: (callback: (data: { token: string; status?: string }) => void) => () => void
  onRecordingError: (callback: (message: string) => void) => () => void
  onError: (callback: (error: { message: string }) => void) => () => void
}

// Extend Window interface
declare global {
  interface Window {
    python: PythonAPI
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
