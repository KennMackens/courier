/**
 * Electron Main Process - Application entry point.
 *
 * Creates the main window, starts the Python subprocess, and sets up IPC.
 */

import { app, BrowserWindow, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { getPythonBridge } from './python-bridge'
import { registerIpcHandlers, removeIpcHandlers } from './ipc-handlers'
import { initializeDatabaseHandlers, closeDatabaseHandlers } from './database/ipc-handlers'

function writeLog(msg: string): void {
  const logDir = app.getPath('logs')
  fs.mkdirSync(logDir, { recursive: true })
  fs.appendFileSync(path.join(logDir, 'main.log'), `[${new Date().toISOString()}] ${msg}\n`)
  console.log(msg)
}

let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged

async function createWindow(): Promise<void> {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Need this for preload script
    },
    titleBarStyle: 'hiddenInset',
    show: false, // Don't show until ready
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Start Python subprocess
  const python = getPythonBridge()

  // Initialize database
  try {
    initializeDatabaseHandlers()
    writeLog('[Main] Database handlers initialized')
  } catch (error) {
    writeLog(`[Main] FATAL: Failed to initialize database: ${error}`)
  }

  // Register IPC handlers FIRST (before starting Python)
  // This ensures handlers exist even if Python fails to start
  registerIpcHandlers(mainWindow, python)
  console.log('[Main] IPC handlers registered')

  // Start Python subprocess
  try {
    await python.start()
    console.log('[Main] Python bridge started')
  } catch (error) {
    console.error('[Main] Failed to start Python bridge:', error)
    // Continue anyway - the UI can show an error state
    // IPC handlers are already registered and will return errors appropriately
  }

  // Handle Python process exit
  python.on('exit', (code: number | null) => {
    console.log(`[Main] Python process exited with code ${code}`)
    // Could attempt restart here if needed
  })

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load from built files
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', async () => {
  // Shutdown Python process
  const python = getPythonBridge()
  await python.shutdown()

  // Remove IPC handlers
  removeIpcHandlers()

  // Close database connection
  closeDatabaseHandlers()

  // Quit on all platforms (including macOS)
  app.quit()
})

app.on('activate', () => {
  // On macOS, re-create window if dock icon clicked
  if (mainWindow === null) {
    createWindow()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason)
})
