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
  ollamaModel: string
  ollamaEndpoint: string
  availableModels: string[]
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
  onTranscribeProgress: (callback: (data: { status?: string; progress?: number }) => void) => () => void
  onEnhanceToken: (callback: (data: { token?: string; status?: string }) => void) => () => void
  onRecordingError: (callback: (data: { message: string }) => void) => () => void
  onError: (callback: (error: { message: string }) => void) => () => void
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

  // Note enhancement
  enhanceNotes: (params) => ipcRenderer.invoke('python:enhanceNotes', params),

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

  onEnhanceToken: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: { token?: string; status?: string }) => callback(data)
    ipcRenderer.on('python:enhanceNotes:token', handler)
    return () => ipcRenderer.removeListener('python:enhanceNotes:token', handler)
  },

  onRecordingError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on('python:recordingError', handler)
    return () => ipcRenderer.removeListener('python:recordingError', handler)
  },

  onError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, error: { message: string }) => callback(error)
    ipcRenderer.on('python:error', handler)
    return () => ipcRenderer.removeListener('python:error', handler)
  },
}

// Expose to renderer
contextBridge.exposeInMainWorld('python', pythonAPI)

// Type declaration for renderer
declare global {
  interface Window {
    python: PythonAPI
  }
}
