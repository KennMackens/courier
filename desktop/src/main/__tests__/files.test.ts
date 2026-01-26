/**
 * File Storage Tests
 *
 * Tests for transcript and audio file operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FileStorage } from '../storage/files'

let storage: FileStorage
let testSessionsDir: string

beforeEach(() => {
  // Create a temporary directory for each test
  testSessionsDir = path.join(os.tmpdir(), `courier-sessions-test-${Date.now()}`)
  fs.mkdirSync(testSessionsDir, { recursive: true })
  storage = new FileStorage({ sessionsDir: testSessionsDir })
})

afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(testSessionsDir)) {
    fs.rmSync(testSessionsDir, { recursive: true, force: true })
  }
})

describe('FileStorage', () => {
  describe('Transcript Operations', () => {
    describe('saveTranscript', () => {
      it('should save transcript to correct path', () => {
        const meetingId = 'test-meeting-123'
        const content = 'This is the meeting transcript.\nWith multiple lines.'

        const savedPath = storage.saveTranscript(meetingId, content)

        expect(savedPath).toBe(path.join(testSessionsDir, meetingId, 'transcript.txt'))
        expect(fs.existsSync(savedPath)).toBe(true)
      })

      it('should create meeting directory if not exists', () => {
        const meetingId = 'new-meeting'
        const meetingDir = path.join(testSessionsDir, meetingId)

        expect(fs.existsSync(meetingDir)).toBe(false)

        storage.saveTranscript(meetingId, 'content')

        expect(fs.existsSync(meetingDir)).toBe(true)
      })

      it('should write correct content', () => {
        const meetingId = 'meeting-content-test'
        const content = 'Hello, World!\nLine 2\nLine 3'

        storage.saveTranscript(meetingId, content)

        const savedContent = fs.readFileSync(
          path.join(testSessionsDir, meetingId, 'transcript.txt'),
          'utf-8'
        )
        expect(savedContent).toBe(content)
      })

      it('should handle unicode content', () => {
        const meetingId = 'unicode-test'
        const content = 'Meeting notes with unicode: 你好世界 🎉 café'

        storage.saveTranscript(meetingId, content)
        const result = storage.readTranscript(meetingId)

        expect(result).toBe(content)
      })

      it('should overwrite existing transcript', () => {
        const meetingId = 'overwrite-test'

        storage.saveTranscript(meetingId, 'Original content')
        storage.saveTranscript(meetingId, 'New content')

        const result = storage.readTranscript(meetingId)
        expect(result).toBe('New content')
      })
    })

    describe('readTranscript', () => {
      it('should read saved transcript', () => {
        const meetingId = 'read-test'
        const content = 'Saved transcript content'

        storage.saveTranscript(meetingId, content)
        const result = storage.readTranscript(meetingId)

        expect(result).toBe(content)
      })

      it('should return null for non-existent transcript', () => {
        const result = storage.readTranscript('non-existent-meeting')
        expect(result).toBeNull()
      })

      it('should return null if meeting exists but transcript does not', () => {
        const meetingId = 'meeting-no-transcript'
        fs.mkdirSync(path.join(testSessionsDir, meetingId), { recursive: true })

        const result = storage.readTranscript(meetingId)
        expect(result).toBeNull()
      })
    })

    describe('getTranscriptPath', () => {
      it('should return correct path', () => {
        const meetingId = 'path-test'
        const expectedPath = path.join(testSessionsDir, meetingId, 'transcript.txt')

        expect(storage.getTranscriptPath(meetingId)).toBe(expectedPath)
      })
    })
  })

  describe('Audio Operations', () => {
    describe('saveAudio', () => {
      it('should save audio to correct path', () => {
        const meetingId = 'audio-test'
        const audioData = Buffer.from([0x52, 0x49, 0x46, 0x46]) // RIFF header start

        const savedPath = storage.saveAudio(meetingId, audioData)

        expect(savedPath).toBe(path.join(testSessionsDir, meetingId, 'audio.wav'))
        expect(fs.existsSync(savedPath)).toBe(true)
      })

      it('should write correct binary data', () => {
        const meetingId = 'binary-test'
        const originalData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD])

        storage.saveAudio(meetingId, originalData)

        const savedData = fs.readFileSync(
          path.join(testSessionsDir, meetingId, 'audio.wav')
        )
        expect(savedData.equals(originalData)).toBe(true)
      })

      it('should handle large files', () => {
        const meetingId = 'large-file-test'
        // Create 1MB of test data
        const largeData = Buffer.alloc(1024 * 1024, 0x42)

        storage.saveAudio(meetingId, largeData)

        const savedData = storage.readAudio(meetingId)
        expect(savedData!.length).toBe(1024 * 1024)
        expect(savedData!.equals(largeData)).toBe(true)
      })
    })

    describe('readAudio', () => {
      it('should read saved audio', () => {
        const meetingId = 'read-audio-test'
        const audioData = Buffer.from([0x01, 0x02, 0x03, 0x04])

        storage.saveAudio(meetingId, audioData)
        const result = storage.readAudio(meetingId)

        expect(result).not.toBeNull()
        expect(result!.equals(audioData)).toBe(true)
      })

      it('should return null for non-existent audio', () => {
        const result = storage.readAudio('non-existent')
        expect(result).toBeNull()
      })
    })

    describe('audioExists', () => {
      it('should return true when audio exists', () => {
        const meetingId = 'exists-test'
        storage.saveAudio(meetingId, Buffer.from([0x00]))

        expect(storage.audioExists(meetingId)).toBe(true)
      })

      it('should return false when audio does not exist', () => {
        expect(storage.audioExists('non-existent')).toBe(false)
      })
    })

    describe('getAudioPath', () => {
      it('should return correct path', () => {
        const meetingId = 'audio-path-test'
        const expectedPath = path.join(testSessionsDir, meetingId, 'audio.wav')

        expect(storage.getAudioPath(meetingId)).toBe(expectedPath)
      })
    })
  })

  describe('Cleanup Operations', () => {
    describe('deleteMeetingFiles', () => {
      it('should delete meeting directory and contents', () => {
        const meetingId = 'delete-test'
        storage.saveTranscript(meetingId, 'transcript')
        storage.saveAudio(meetingId, Buffer.from([0x00]))

        const meetingDir = path.join(testSessionsDir, meetingId)
        expect(fs.existsSync(meetingDir)).toBe(true)

        const result = storage.deleteMeetingFiles(meetingId)

        expect(result).toBe(true)
        expect(fs.existsSync(meetingDir)).toBe(false)
      })

      it('should return false for non-existent meeting', () => {
        const result = storage.deleteMeetingFiles('non-existent')
        expect(result).toBe(false)
      })

      it('should handle meetings with only transcript', () => {
        const meetingId = 'transcript-only'
        storage.saveTranscript(meetingId, 'content')

        const result = storage.deleteMeetingFiles(meetingId)

        expect(result).toBe(true)
        expect(fs.existsSync(path.join(testSessionsDir, meetingId))).toBe(false)
      })

      it('should handle meetings with only audio', () => {
        const meetingId = 'audio-only'
        storage.saveAudio(meetingId, Buffer.from([0x00]))

        const result = storage.deleteMeetingFiles(meetingId)

        expect(result).toBe(true)
        expect(fs.existsSync(path.join(testSessionsDir, meetingId))).toBe(false)
      })
    })
  })

  describe('Storage Info', () => {
    describe('getMeetingStorageSize', () => {
      it('should return total size of meeting files', () => {
        const meetingId = 'size-test'
        const transcript = 'Hello World' // 11 bytes
        const audio = Buffer.alloc(100, 0x42) // 100 bytes

        storage.saveTranscript(meetingId, transcript)
        storage.saveAudio(meetingId, audio)

        const size = storage.getMeetingStorageSize(meetingId)
        expect(size).toBe(111)
      })

      it('should return 0 for non-existent meeting', () => {
        const size = storage.getMeetingStorageSize('non-existent')
        expect(size).toBe(0)
      })
    })

    describe('getTotalStorageSize', () => {
      it('should return total size of all meetings', () => {
        storage.saveTranscript('meeting-1', 'content') // ~7 bytes
        storage.saveTranscript('meeting-2', 'longer content') // ~14 bytes
        storage.saveAudio('meeting-2', Buffer.alloc(50, 0x00)) // 50 bytes

        const totalSize = storage.getTotalStorageSize()
        expect(totalSize).toBe(7 + 14 + 50)
      })

      it('should return 0 when no meetings', () => {
        const size = storage.getTotalStorageSize()
        expect(size).toBe(0)
      })
    })

    describe('listMeetingIds', () => {
      it('should return all meeting IDs', () => {
        storage.saveTranscript('meeting-a', 'content')
        storage.saveTranscript('meeting-b', 'content')
        storage.saveTranscript('meeting-c', 'content')

        const ids = storage.listMeetingIds()

        expect(ids).toHaveLength(3)
        expect(ids).toContain('meeting-a')
        expect(ids).toContain('meeting-b')
        expect(ids).toContain('meeting-c')
      })

      it('should return empty array when no meetings', () => {
        const ids = storage.listMeetingIds()
        expect(ids).toEqual([])
      })

      it('should only return directories, not files', () => {
        storage.saveTranscript('real-meeting', 'content')
        // Create a file directly in sessions dir (shouldn't be listed)
        fs.writeFileSync(path.join(testSessionsDir, 'stray-file.txt'), 'test')

        const ids = storage.listMeetingIds()

        expect(ids).toHaveLength(1)
        expect(ids[0]).toBe('real-meeting')
      })
    })
  })

  describe('Atomic Writes', () => {
    it('should use temp file for transcript writes', () => {
      const meetingId = 'atomic-test'

      // This tests the atomic write pattern indirectly
      // by verifying no .tmp files remain after successful write
      storage.saveTranscript(meetingId, 'content')

      const meetingDir = path.join(testSessionsDir, meetingId)
      const files = fs.readdirSync(meetingDir)

      expect(files).not.toContain('transcript.txt.tmp')
      expect(files).toContain('transcript.txt')
    })

    it('should use temp file for audio writes', () => {
      const meetingId = 'atomic-audio-test'

      storage.saveAudio(meetingId, Buffer.from([0x00]))

      const meetingDir = path.join(testSessionsDir, meetingId)
      const files = fs.readdirSync(meetingDir)

      expect(files).not.toContain('audio.wav.tmp')
      expect(files).toContain('audio.wav')
    })
  })
})
