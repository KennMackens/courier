/**
 * Database IPC Handlers - Expose database operations to renderer.
 */

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { initializeDatabase, closeDatabase } from './schema'
import { MeetingQueries, type CreateMeetingInput, type UpdateMeetingInput, type MeetingListOptions } from './queries'
import { FileStorage, getFileStorage } from '../storage/files'

let db: Database.Database | null = null
let queries: MeetingQueries | null = null
let fileStorage: FileStorage | null = null

export function initializeDatabaseHandlers(): void {
  // Initialize database
  db = initializeDatabase()
  queries = new MeetingQueries(db)
  fileStorage = getFileStorage()

  console.log('[Database IPC] Database handlers initialized')

  // --- Meeting handlers ---

  ipcMain.handle('db:createMeeting', async (_, input: CreateMeetingInput) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.createMeeting(input)
  })

  ipcMain.handle('db:getMeeting', async (_, id: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.getMeeting(id)
  })

  ipcMain.handle('db:getMeetingWithDetails', async (_, id: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.getMeetingWithDetails(id)
  })

  ipcMain.handle('db:listMeetings', async (_, options?: MeetingListOptions) => {
    if (!queries) throw new Error('Database not initialized')
    try {
      return queries.listMeetings(options)
    } catch (error) {
      console.error('[Database IPC] listMeetings error:', error)
      throw error
    }
  })

  ipcMain.handle('db:updateMeeting', async (_, id: string, input: UpdateMeetingInput) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.updateMeeting(id, input)
  })

  ipcMain.handle('db:deleteMeeting', async (_, id: string) => {
    if (!queries || !fileStorage) throw new Error('Database not initialized')

    // Delete files first
    fileStorage.deleteMeetingFiles(id)

    // Then delete from database
    return queries.deleteMeeting(id)
  })

  // --- Speaker handlers ---

  ipcMain.handle('db:addSpeaker', async (_, meetingId: string, name: string, wordCount?: number) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.addSpeaker(meetingId, name, wordCount)
  })

  ipcMain.handle('db:getSpeakers', async (_, meetingId: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.getSpeakers(meetingId)
  })

  // --- Summary handlers ---

  ipcMain.handle('db:addSummary', async (_, meetingId: string, type: 'original' | 'enhanced', content: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.addSummary(meetingId, type, content)
  })

  ipcMain.handle('db:getSummaries', async (_, meetingId: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.getSummaries(meetingId)
  })

  ipcMain.handle('db:getSummaryByType', async (_, meetingId: string, type: 'original' | 'enhanced') => {
    if (!queries) throw new Error('Database not initialized')
    return queries.getSummaryByType(meetingId, type)
  })

  ipcMain.handle('db:updateSummary', async (_, meetingId: string, type: 'original' | 'enhanced', content: string) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.upsertSummary(meetingId, type, content)
  })

  // --- Search handlers ---

  ipcMain.handle('db:searchMeetings', async (_, query: string, limit?: number) => {
    if (!queries) throw new Error('Database not initialized')
    return queries.searchMeetings(query, limit)
  })

  ipcMain.handle('db:indexMeeting', async (_, meetingId: string, title: string, transcriptContent: string, summaryContent: string) => {
    if (!queries) throw new Error('Database not initialized')
    queries.indexMeeting(meetingId, title, transcriptContent, summaryContent)
    return { ok: true }
  })

  // --- File storage handlers ---

  ipcMain.handle('storage:saveTranscript', async (_, meetingId: string, content: string) => {
    if (!fileStorage || !queries) throw new Error('Storage not initialized')

    const filePath = fileStorage.saveTranscript(meetingId, content)

    // Update meeting record with transcript path
    queries.updateMeeting(meetingId, { transcript_path: filePath })

    return { path: filePath }
  })

  ipcMain.handle('storage:readTranscript', async (_, meetingId: string) => {
    if (!fileStorage) throw new Error('Storage not initialized')
    return { content: fileStorage.readTranscript(meetingId) }
  })

  ipcMain.handle('storage:saveAudio', async (_, meetingId: string, audioData: ArrayBuffer) => {
    if (!fileStorage || !queries) throw new Error('Storage not initialized')

    const buffer = Buffer.from(audioData)
    const filePath = fileStorage.saveAudio(meetingId, buffer)

    // Update meeting record with audio path
    queries.updateMeeting(meetingId, { audio_path: filePath })

    return { path: filePath }
  })

  ipcMain.handle('storage:audioExists', async (_, meetingId: string) => {
    if (!fileStorage) throw new Error('Storage not initialized')
    return { exists: fileStorage.audioExists(meetingId) }
  })

  ipcMain.handle('storage:getMeetingStorageSize', async (_, meetingId: string) => {
    if (!fileStorage) throw new Error('Storage not initialized')
    return { size: fileStorage.getMeetingStorageSize(meetingId) }
  })

  ipcMain.handle('storage:getTotalStorageSize', async () => {
    if (!fileStorage) throw new Error('Storage not initialized')
    return { size: fileStorage.getTotalStorageSize() }
  })

  // --- Statistics ---

  ipcMain.handle('db:getMeetingCount', async () => {
    if (!queries) throw new Error('Database not initialized')
    return { count: queries.getMeetingCount() }
  })

  ipcMain.handle('db:getTotalDuration', async () => {
    if (!queries) throw new Error('Database not initialized')
    return { duration: queries.getTotalDuration() }
  })
}

export function closeDatabaseHandlers(): void {
  if (db) {
    closeDatabase(db)
    db = null
    queries = null
  }

  // Remove all handlers
  const handlers = [
    'db:createMeeting',
    'db:getMeeting',
    'db:getMeetingWithDetails',
    'db:listMeetings',
    'db:updateMeeting',
    'db:deleteMeeting',
    'db:addSpeaker',
    'db:getSpeakers',
    'db:addSummary',
    'db:getSummaries',
    'db:getSummaryByType',
    'db:updateSummary',
    'db:searchMeetings',
    'db:indexMeeting',
    'storage:saveTranscript',
    'storage:readTranscript',
    'storage:saveAudio',
    'storage:audioExists',
    'storage:getMeetingStorageSize',
    'storage:getTotalStorageSize',
    'db:getMeetingCount',
    'db:getTotalDuration',
  ]

  for (const handler of handlers) {
    ipcMain.removeHandler(handler)
  }

  console.log('[Database IPC] Database handlers closed')
}
