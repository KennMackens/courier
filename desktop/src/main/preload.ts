/**
 * Preload script - Exposes a safe API to the renderer process.
 *
 * This script runs in the renderer process but has access to Node.js APIs.
 * It bridges the gap between the main process (Python) and the renderer (React).
 */

import { contextBridge, ipcRenderer } from 'electron'

// Settings type
export interface Settings {
  language: string
  whisperModel: string
  mlxModel: string
  availableModels: string[]
  recordingThreshold: number
  performanceMode: 'balanced' | 'low_cpu'
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

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

// API types
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
    microphoneActive: boolean
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
    transcriptSegments?: TranscriptSegment[]
    totalTranscriptSegments?: TranscriptSegment[]
  }>

  // Settings
  getSettings: () => Promise<Settings>
  setSettings: (settings: Partial<Settings>) => Promise<{ ok: boolean }>

  // Session
  resetSession: () => Promise<{ ok: boolean }>

  // Event listeners
  onTranscribeProgress: (callback: (data: { status?: string; progress?: number }) => void) => () => void
  onRecordingError: (callback: (data: { message: string }) => void) => () => void
  onRecordingWarning: (callback: (data: { message: string }) => void) => () => void
  onError: (callback: (error: { message: string }) => void) => () => void
}

// System API
export interface SystemAPI {
  openMicSettings: () => Promise<{ ok: boolean }>
}

// Expose the API to the renderer
const pythonAPI: PythonAPI = {
  // Initialization
  initialize: () => ipcRenderer.invoke('python:initialize'),

  // Recording
  checkPermission: () => ipcRenderer.invoke('python:checkPermission'),
  startRecording: (params) => ipcRenderer.invoke('python:startRecording', params),
  stopRecording: () => ipcRenderer.invoke('python:stopRecording'),

  // Transcription
  transcribe: (params) => ipcRenderer.invoke('python:transcribe', params),

  // Settings
  getSettings: () => ipcRenderer.invoke('python:getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('python:setSettings', settings),

  // Session
  resetSession: () => ipcRenderer.invoke('python:resetSession'),

  // Event listeners - return unsubscribe function
  onTranscribeProgress: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: { status?: string; progress?: number }) => callback(data)
    ipcRenderer.on('python:transcribe:progress', handler)
    return () => ipcRenderer.removeListener('python:transcribe:progress', handler)
  },

  onRecordingError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on('python:recordingError', handler)
    return () => ipcRenderer.removeListener('python:recordingError', handler)
  },

  onRecordingWarning: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on('python:recordingWarning', handler)
    return () => ipcRenderer.removeListener('python:recordingWarning', handler)
  },

  onError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, error: { message: string }) => callback(error)
    ipcRenderer.on('python:error', handler)
    return () => ipcRenderer.removeListener('python:error', handler)
  },
}

const systemAPI: SystemAPI = {
  openMicSettings: () => ipcRenderer.invoke('system:openMicSettings'),
}

// Database API
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

const databaseAPI: DatabaseAPI = {
  // Meetings
  createMeeting: (input) => ipcRenderer.invoke('db:createMeeting', input),
  getMeeting: (id) => ipcRenderer.invoke('db:getMeeting', id),
  getMeetingWithDetails: (id) => ipcRenderer.invoke('db:getMeetingWithDetails', id),
  listMeetings: (options) => ipcRenderer.invoke('db:listMeetings', options),
  updateMeeting: (id, input) => ipcRenderer.invoke('db:updateMeeting', id, input),
  deleteMeeting: (id) => ipcRenderer.invoke('db:deleteMeeting', id),

  // Speakers
  addSpeaker: (meetingId, name, wordCount) => ipcRenderer.invoke('db:addSpeaker', meetingId, name, wordCount),
  getSpeakers: (meetingId) => ipcRenderer.invoke('db:getSpeakers', meetingId),

  // Summaries
  addSummary: (meetingId, type, content) => ipcRenderer.invoke('db:addSummary', meetingId, type, content),
  getSummaries: (meetingId) => ipcRenderer.invoke('db:getSummaries', meetingId),
  getSummaryByType: (meetingId, type) => ipcRenderer.invoke('db:getSummaryByType', meetingId, type),
  updateSummary: (meetingId, type, content) => ipcRenderer.invoke('db:updateSummary', meetingId, type, content),

  // Search
  searchMeetings: (query, limit) => ipcRenderer.invoke('db:searchMeetings', query, limit),
  indexMeeting: (meetingId, title, transcriptContent, summaryContent) =>
    ipcRenderer.invoke('db:indexMeeting', meetingId, title, transcriptContent, summaryContent),

  // Storage
  saveTranscript: (meetingId, content) => ipcRenderer.invoke('storage:saveTranscript', meetingId, content),
  readTranscript: (meetingId) => ipcRenderer.invoke('storage:readTranscript', meetingId),

  // Statistics
  getMeetingCount: () => ipcRenderer.invoke('db:getMeetingCount'),
  getTotalDuration: () => ipcRenderer.invoke('db:getTotalDuration'),
}

// Expose to renderer
contextBridge.exposeInMainWorld('python', pythonAPI)
contextBridge.exposeInMainWorld('database', databaseAPI)
contextBridge.exposeInMainWorld('system', systemAPI)

// Type declaration for renderer
declare global {
  interface Window {
    python: PythonAPI
    database: DatabaseAPI
    system: SystemAPI
  }
}
