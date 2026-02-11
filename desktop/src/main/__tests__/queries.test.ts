/**
 * Database Query Tests
 *
 * Tests for CRUD operations on meetings, speakers, and summaries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MeetingQueries, type CreateMeetingInput } from '../database/queries'

// Test database setup
let db: Database.Database
let queries: MeetingQueries
let testDbPath: string

beforeEach(() => {
  // Create a temporary database for each test
  testDbPath = path.join(os.tmpdir(), `courier-test-${Date.now()}.db`)
  db = new Database(testDbPath)

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT,
      date_time TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      transcript_path TEXT,
      audio_path TEXT,
      enhancement_status TEXT CHECK (enhancement_status IN ('pending', 'enhancing', 'complete', 'failed') OR enhancement_status IS NULL),
      is_new INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS speakers (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      name TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('original', 'enhanced')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
      meeting_id,
      title,
      transcript_content,
      summary_content,
      content='',
      tokenize='porter unicode61'
    );
  `)

  db.pragma('foreign_keys = ON')
  queries = new MeetingQueries(db)
})

afterEach(() => {
  db.close()
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
})

describe('MeetingQueries', () => {
  describe('createMeeting', () => {
    it('should create a meeting with minimal input', () => {
      const meeting = queries.createMeeting({})

      expect(meeting.id).toBeDefined()
      expect(meeting.id).toHaveLength(36) // UUID length
      expect(meeting.title).toBeNull()
      expect(meeting.duration).toBe(0)
      expect(meeting.date_time).toBeDefined()
    })

    it('should create a meeting with full input', () => {
      const input: CreateMeetingInput = {
        title: 'Team Standup',
        date_time: '2024-01-15T10:00:00Z',
        duration: 1800,
        transcript_path: '/path/to/transcript.txt',
        audio_path: '/path/to/audio.wav',
      }

      const meeting = queries.createMeeting(input)

      expect(meeting.title).toBe('Team Standup')
      expect(meeting.date_time).toBe('2024-01-15T10:00:00Z')
      expect(meeting.duration).toBe(1800)
      expect(meeting.transcript_path).toBe('/path/to/transcript.txt')
      expect(meeting.audio_path).toBe('/path/to/audio.wav')
    })
  })

  describe('getMeeting', () => {
    it('should return meeting by id', () => {
      const created = queries.createMeeting({ title: 'Test Meeting' })
      const retrieved = queries.getMeeting(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.title).toBe('Test Meeting')
    })

    it('should return undefined for non-existent id', () => {
      const result = queries.getMeeting('non-existent-id')
      expect(result).toBeUndefined()
    })
  })

  describe('listMeetings', () => {
    it('should return empty array when no meetings', () => {
      const meetings = queries.listMeetings()
      expect(meetings).toEqual([])
    })

    it('should return all meetings ordered by date descending', () => {
      queries.createMeeting({ title: 'Meeting 1', date_time: '2024-01-01T10:00:00Z' })
      queries.createMeeting({ title: 'Meeting 2', date_time: '2024-01-02T10:00:00Z' })
      queries.createMeeting({ title: 'Meeting 3', date_time: '2024-01-03T10:00:00Z' })

      const meetings = queries.listMeetings()

      expect(meetings).toHaveLength(3)
      expect(meetings[0].title).toBe('Meeting 3')
      expect(meetings[1].title).toBe('Meeting 2')
      expect(meetings[2].title).toBe('Meeting 1')
    })

    it('should respect limit option', () => {
      for (let i = 0; i < 10; i++) {
        queries.createMeeting({ title: `Meeting ${i}` })
      }

      const meetings = queries.listMeetings({ limit: 5 })
      expect(meetings).toHaveLength(5)
    })

    it('should respect offset option', () => {
      for (let i = 0; i < 5; i++) {
        queries.createMeeting({ title: `Meeting ${i}`, date_time: `2024-01-0${i + 1}T10:00:00Z` })
      }

      const meetings = queries.listMeetings({ offset: 2, limit: 2 })
      expect(meetings).toHaveLength(2)
      expect(meetings[0].title).toBe('Meeting 2')
      expect(meetings[1].title).toBe('Meeting 1')
    })
  })

  describe('updateMeeting', () => {
    it('should update meeting title', () => {
      const meeting = queries.createMeeting({ title: 'Original Title' })
      const updated = queries.updateMeeting(meeting.id, { title: 'Updated Title' })

      expect(updated!.title).toBe('Updated Title')
    })

    it('should update multiple fields', () => {
      const meeting = queries.createMeeting({})
      const updated = queries.updateMeeting(meeting.id, {
        title: 'New Title',
        duration: 3600,
        transcript_path: '/new/path.txt',
      })

      expect(updated!.title).toBe('New Title')
      expect(updated!.duration).toBe(3600)
      expect(updated!.transcript_path).toBe('/new/path.txt')
    })

    it('should return undefined for non-existent id', () => {
      const result = queries.updateMeeting('non-existent-id', { title: 'Test' })
      expect(result).toBeUndefined()
    })
  })

  describe('deleteMeeting', () => {
    it('should delete meeting and return true', () => {
      const meeting = queries.createMeeting({ title: 'To Delete' })
      const result = queries.deleteMeeting(meeting.id)

      expect(result).toBe(true)
      expect(queries.getMeeting(meeting.id)).toBeUndefined()
    })

    it('should return false for non-existent id', () => {
      const result = queries.deleteMeeting('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('getMeetingWithDetails', () => {
    it('should return meeting with speakers and summaries', () => {
      const meeting = queries.createMeeting({ title: 'Detailed Meeting' })
      queries.addSpeaker(meeting.id, 'Alice', 500)
      queries.addSpeaker(meeting.id, 'Bob', 300)
      queries.addSummary(meeting.id, 'original', 'Original summary')
      queries.addSummary(meeting.id, 'enhanced', 'Enhanced summary')

      const detailed = queries.getMeetingWithDetails(meeting.id)

      expect(detailed).not.toBeNull()
      expect(detailed!.speakers).toHaveLength(2)
      expect(detailed!.summaries).toHaveLength(2)
      expect(detailed!.speakers.map(s => s.name)).toContain('Alice')
      expect(detailed!.speakers.map(s => s.name)).toContain('Bob')
    })

    it('should return null for non-existent meeting', () => {
      const result = queries.getMeetingWithDetails('non-existent-id')
      expect(result).toBeNull()
    })
  })
})

describe('Speaker Queries', () => {
  describe('addSpeaker', () => {
    it('should add speaker to meeting', () => {
      const meeting = queries.createMeeting({})
      const speaker = queries.addSpeaker(meeting.id, 'John Doe', 250)

      expect(speaker.id).toBeDefined()
      expect(speaker.meeting_id).toBe(meeting.id)
      expect(speaker.name).toBe('John Doe')
      expect(speaker.word_count).toBe(250)
    })

    it('should default word_count to 0', () => {
      const meeting = queries.createMeeting({})
      const speaker = queries.addSpeaker(meeting.id, 'Jane Doe')

      expect(speaker.word_count).toBe(0)
    })
  })

  describe('getSpeakers', () => {
    it('should return all speakers for a meeting', () => {
      const meeting = queries.createMeeting({})
      queries.addSpeaker(meeting.id, 'Speaker 1', 100)
      queries.addSpeaker(meeting.id, 'Speaker 2', 200)
      queries.addSpeaker(meeting.id, 'Speaker 3', 300)

      const speakers = queries.getSpeakers(meeting.id)

      expect(speakers).toHaveLength(3)
      expect(speakers.every(s => s.meeting_id === meeting.id)).toBe(true)
    })

    it('should return empty array for meeting without speakers', () => {
      const meeting = queries.createMeeting({})
      const speakers = queries.getSpeakers(meeting.id)
      expect(speakers).toEqual([])
    })
  })

  describe('updateSpeaker', () => {
    it('should update speaker name', () => {
      const meeting = queries.createMeeting({})
      const speaker = queries.addSpeaker(meeting.id, 'Old Name')
      const updated = queries.updateSpeaker(speaker.id, 'New Name')

      expect(updated!.name).toBe('New Name')
    })

    it('should update speaker word_count', () => {
      const meeting = queries.createMeeting({})
      const speaker = queries.addSpeaker(meeting.id, 'Test', 0)
      const updated = queries.updateSpeaker(speaker.id, undefined, 500)

      expect(updated!.word_count).toBe(500)
    })
  })
})

describe('Summary Queries', () => {
  describe('addSummary', () => {
    it('should add original summary', () => {
      const meeting = queries.createMeeting({})
      const summary = queries.addSummary(meeting.id, 'original', 'This is the original transcript.')

      expect(summary.id).toBeDefined()
      expect(summary.meeting_id).toBe(meeting.id)
      expect(summary.type).toBe('original')
      expect(summary.content).toBe('This is the original transcript.')
    })

    it('should add enhanced summary', () => {
      const meeting = queries.createMeeting({})
      const summary = queries.addSummary(meeting.id, 'enhanced', 'This is the enhanced version.')

      expect(summary.type).toBe('enhanced')
    })
  })

  describe('getSummaries', () => {
    it('should return all summaries for a meeting', () => {
      const meeting = queries.createMeeting({})
      queries.addSummary(meeting.id, 'original', 'Original')
      queries.addSummary(meeting.id, 'enhanced', 'Enhanced')

      const summaries = queries.getSummaries(meeting.id)

      expect(summaries).toHaveLength(2)
    })
  })

  describe('getSummaryByType', () => {
    it('should return a summary of the given type', () => {
      const meeting = queries.createMeeting({})
      queries.addSummary(meeting.id, 'original', 'First original')

      const summary = queries.getSummaryByType(meeting.id, 'original')

      expect(summary).not.toBeNull()
      expect(summary!.content).toBe('First original')
      expect(summary!.type).toBe('original')
    })

    it('should return undefined if no summary of type exists', () => {
      const meeting = queries.createMeeting({})
      queries.addSummary(meeting.id, 'original', 'Only original')

      const result = queries.getSummaryByType(meeting.id, 'enhanced')
      expect(result).toBeUndefined()
    })
  })

  describe('updateSummary', () => {
    it('should update summary content', () => {
      const meeting = queries.createMeeting({})
      const summary = queries.addSummary(meeting.id, 'original', 'Old content')
      const updated = queries.updateSummary(summary.id, 'New content')

      expect(updated!.content).toBe('New content')
    })
  })
})

describe('Full-Text Search', () => {
  describe('indexMeeting', () => {
    it('should index meeting without error', () => {
      const meeting = queries.createMeeting({ title: 'Quarterly Review' })

      // Should not throw
      expect(() => {
        queries.indexMeeting(meeting.id, 'Quarterly Review', 'transcript content', 'summary content')
      }).not.toThrow()
    })

    it('should update index on re-indexing without error', () => {
      const meeting = queries.createMeeting({ title: 'Test' })

      // Should not throw on multiple index operations
      expect(() => {
        queries.indexMeeting(meeting.id, 'Test', 'old content', '')
        queries.indexMeeting(meeting.id, 'Test', 'new content', '')
      }).not.toThrow()
    })
  })

  describe('searchMeetings', () => {
    it('should return empty array for no matches', () => {
      queries.createMeeting({ title: 'Meeting' })

      // FTS search returns empty when no indexed content matches
      const results = queries.searchMeetings('nonexistent')
      expect(results).toEqual([])
    })

    it('should handle search query without error', () => {
      const meeting = queries.createMeeting({ title: 'Test Meeting' })
      queries.indexMeeting(meeting.id, 'Test Meeting', 'transcript', 'summary')

      // Should not throw
      expect(() => {
        queries.searchMeetings('test')
      }).not.toThrow()
    })
  })
})

describe('Statistics', () => {
  describe('getMeetingCount', () => {
    it('should return 0 when no meetings', () => {
      expect(queries.getMeetingCount()).toBe(0)
    })

    it('should return correct count', () => {
      queries.createMeeting({})
      queries.createMeeting({})
      queries.createMeeting({})

      expect(queries.getMeetingCount()).toBe(3)
    })
  })

  describe('getTotalDuration', () => {
    it('should return 0 when no meetings', () => {
      expect(queries.getTotalDuration()).toBe(0)
    })

    it('should return sum of all meeting durations', () => {
      queries.createMeeting({ duration: 1800 })
      queries.createMeeting({ duration: 3600 })
      queries.createMeeting({ duration: 900 })

      expect(queries.getTotalDuration()).toBe(6300)
    })
  })
})
