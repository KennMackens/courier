/**
 * IPC Handlers - Wire up renderer requests to Python bridge.
 *
 * Registers Electron IPC handlers that forward requests to the Python
 * subprocess and send responses/streams back to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { PythonBridge } from './python-bridge'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  python: PythonBridge
): void {
  // --- Basic handlers ---

  ipcMain.handle('python:initialize', async () => {
    return python.request('initialize')
  })

  ipcMain.handle('python:getSettings', async () => {
    return python.request('getSettings')
  })

  ipcMain.handle('python:setSettings', async (_, settings) => {
    return python.request('setSettings', settings)
  })

  ipcMain.handle('python:resetSession', async () => {
    return python.request('resetSession')
  })

  ipcMain.handle('python:getOllamaModels', async () => {
    return python.request('getOllamaModels')
  })

  // --- Recording handlers ---

  ipcMain.handle('python:checkPermission', async () => {
    return python.request('checkPermission')
  })

  ipcMain.handle('python:startRecording', async (_, params) => {
    return python.request('startRecording', params)
  })

  ipcMain.handle('python:stopRecording', async () => {
    return python.request('stopRecording')
  })

  // --- Streaming handlers ---

  ipcMain.handle('python:transcribe', async (_, params) => {
    return python.requestWithStream(
      'transcribe',
      params || {},
      (data) => {
        mainWindow.webContents.send('python:transcribe:progress', data)
      }
    )
  })

  ipcMain.handle('python:enhanceNotes', async (_, params) => {
    return python.requestWithStream(
      'enhanceNotes',
      params,
      (data) => {
        mainWindow.webContents.send('python:enhanceNotes:token', data)
      }
    )
  })

  // --- Forward Python notifications to renderer ---

  python.on('recordingError', (params) => {
    mainWindow.webContents.send('python:recordingError', params)
  })

  python.on('error', (params) => {
    mainWindow.webContents.send('python:error', params)
  })
}

export function removeIpcHandlers(): void {
  const handlers = [
    'python:initialize',
    'python:getSettings',
    'python:setSettings',
    'python:resetSession',
    'python:getOllamaModels',
    'python:checkPermission',
    'python:startRecording',
    'python:stopRecording',
    'python:transcribe',
    'python:enhanceNotes',
  ]

  for (const channel of handlers) {
    ipcMain.removeHandler(channel)
  }
}
