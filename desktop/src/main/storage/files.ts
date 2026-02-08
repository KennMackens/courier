/**
 * File Storage Helpers - Manage transcript and audio files.
 *
 * Files are stored in ~/Library/Application Support/Otto/sessions/[meeting-id]/
 */

import * as fs from 'fs'
import * as path from 'path'
import { getSessionsDirectory } from '../database/schema'

export interface FileStorageOptions {
  sessionsDir?: string
}

export class FileStorage {
  private sessionsDir: string

  constructor(options: FileStorageOptions = {}) {
    this.sessionsDir = options.sessionsDir || getSessionsDirectory()
  }

  // --- Directory Management ---

  private getMeetingDir(meetingId: string): string {
    return path.join(this.sessionsDir, meetingId)
  }

  private ensureMeetingDir(meetingId: string): string {
    const dir = this.getMeetingDir(meetingId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  // --- Transcript Files ---

  getTranscriptPath(meetingId: string): string {
    return path.join(this.getMeetingDir(meetingId), 'transcript.txt')
  }

  saveTranscript(meetingId: string, content: string): string {
    const dir = this.ensureMeetingDir(meetingId)
    const filePath = path.join(dir, 'transcript.txt')

    // Write atomically using temp file + rename
    const tempPath = filePath + '.tmp'
    fs.writeFileSync(tempPath, content, 'utf-8')
    fs.renameSync(tempPath, filePath)

    return filePath
  }

  readTranscript(meetingId: string): string | null {
    const filePath = this.getTranscriptPath(meetingId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    return fs.readFileSync(filePath, 'utf-8')
  }

  // --- Audio Files ---

  getAudioPath(meetingId: string): string {
    return path.join(this.getMeetingDir(meetingId), 'audio.wav')
  }

  saveAudio(meetingId: string, audioData: Buffer): string {
    const dir = this.ensureMeetingDir(meetingId)
    const filePath = path.join(dir, 'audio.wav')

    // Write atomically using temp file + rename
    const tempPath = filePath + '.tmp'
    fs.writeFileSync(tempPath, audioData)
    fs.renameSync(tempPath, filePath)

    return filePath
  }

  readAudio(meetingId: string): Buffer | null {
    const filePath = this.getAudioPath(meetingId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    return fs.readFileSync(filePath)
  }

  audioExists(meetingId: string): boolean {
    return fs.existsSync(this.getAudioPath(meetingId))
  }

  // --- Cleanup ---

  deleteMeetingFiles(meetingId: string): boolean {
    const dir = this.getMeetingDir(meetingId)
    if (!fs.existsSync(dir)) {
      return false
    }

    // Remove all files in directory
    const files = fs.readdirSync(dir)
    for (const file of files) {
      fs.unlinkSync(path.join(dir, file))
    }

    // Remove directory
    fs.rmdirSync(dir)
    return true
  }

  // --- Storage Info ---

  getMeetingStorageSize(meetingId: string): number {
    const dir = this.getMeetingDir(meetingId)
    if (!fs.existsSync(dir)) {
      return 0
    }

    let totalSize = 0
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const stats = fs.statSync(path.join(dir, file))
      totalSize += stats.size
    }
    return totalSize
  }

  getTotalStorageSize(): number {
    if (!fs.existsSync(this.sessionsDir)) {
      return 0
    }

    let totalSize = 0
    const meetings = fs.readdirSync(this.sessionsDir)
    for (const meetingId of meetings) {
      totalSize += this.getMeetingStorageSize(meetingId)
    }
    return totalSize
  }

  listMeetingIds(): string[] {
    if (!fs.existsSync(this.sessionsDir)) {
      return []
    }
    return fs.readdirSync(this.sessionsDir).filter((name) => {
      const stats = fs.statSync(path.join(this.sessionsDir, name))
      return stats.isDirectory()
    })
  }
}

// Singleton instance
let fileStorage: FileStorage | null = null

export function getFileStorage(): FileStorage {
  if (!fileStorage) {
    fileStorage = new FileStorage()
  }
  return fileStorage
}
