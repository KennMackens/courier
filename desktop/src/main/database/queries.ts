/**
 * Database Query Helpers - CRUD operations for meetings, speakers, and summaries.
 */

import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

// Type definitions
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

export interface UpdateMeetingInput {
  title?: string
  duration?: number
  transcript_path?: string
  audio_path?: string
}

export interface MeetingListOptions {
  limit?: number
  offset?: number
  search?: string
}

// Query helper class
export class MeetingQueries {
  constructor(private db: Database.Database) {}

  // --- Meetings ---

  createMeeting(input: CreateMeetingInput): Meeting {
    const id = uuid()
    const dateTime = input.date_time || new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO meetings (id, title, date_time, duration, transcript_path, audio_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      input.title || null,
      dateTime,
      input.duration || 0,
      input.transcript_path || null,
      input.audio_path || null
    )

    return this.getMeeting(id)!
  }

  getMeeting(id: string): Meeting | null {
    const stmt = this.db.prepare('SELECT * FROM meetings WHERE id = ?')
    return stmt.get(id) as Meeting | null
  }

  getMeetingWithDetails(id: string): MeetingWithDetails | null {
    const meeting = this.getMeeting(id)
    if (!meeting) return null

    const speakers = this.getSpeakers(id)
    const summaries = this.getSummaries(id)

    return { ...meeting, speakers, summaries }
  }

  listMeetings(options: MeetingListOptions = {}): Meeting[] {
    const { limit = 50, offset = 0, search } = options

    if (search) {
      // Use FTS for search
      const stmt = this.db.prepare(`
        SELECT m.* FROM meetings m
        JOIN meetings_fts fts ON m.id = fts.meeting_id
        WHERE meetings_fts MATCH ?
        ORDER BY m.date_time DESC
        LIMIT ? OFFSET ?
      `)
      return stmt.all(search, limit, offset) as Meeting[]
    }

    const stmt = this.db.prepare(`
      SELECT * FROM meetings
      ORDER BY date_time DESC
      LIMIT ? OFFSET ?
    `)
    return stmt.all(limit, offset) as Meeting[]
  }

  updateMeeting(id: string, input: UpdateMeetingInput): Meeting | null {
    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.title !== undefined) {
      updates.push('title = ?')
      values.push(input.title)
    }
    if (input.duration !== undefined) {
      updates.push('duration = ?')
      values.push(input.duration)
    }
    if (input.transcript_path !== undefined) {
      updates.push('transcript_path = ?')
      values.push(input.transcript_path)
    }
    if (input.audio_path !== undefined) {
      updates.push('audio_path = ?')
      values.push(input.audio_path)
    }

    if (updates.length === 0) return this.getMeeting(id)

    values.push(id)
    const stmt = this.db.prepare(`
      UPDATE meetings SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)

    return this.getMeeting(id)
  }

  deleteMeeting(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM meetings WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // --- Speakers ---

  addSpeaker(meetingId: string, name: string, wordCount: number = 0): Speaker {
    const id = uuid()
    const stmt = this.db.prepare(`
      INSERT INTO speakers (id, meeting_id, name, word_count)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(id, meetingId, name, wordCount)
    return { id, meeting_id: meetingId, name, word_count: wordCount }
  }

  getSpeakers(meetingId: string): Speaker[] {
    const stmt = this.db.prepare('SELECT * FROM speakers WHERE meeting_id = ?')
    return stmt.all(meetingId) as Speaker[]
  }

  updateSpeaker(id: string, name?: string, wordCount?: number): Speaker | null {
    const updates: string[] = []
    const values: (string | number)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (wordCount !== undefined) {
      updates.push('word_count = ?')
      values.push(wordCount)
    }

    if (updates.length === 0) return null

    values.push(id)
    const stmt = this.db.prepare(`UPDATE speakers SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...values)

    const getStmt = this.db.prepare('SELECT * FROM speakers WHERE id = ?')
    return getStmt.get(id) as Speaker | null
  }

  // --- Summaries ---

  addSummary(meetingId: string, type: 'original' | 'enhanced', content: string): Summary {
    const id = uuid()
    const stmt = this.db.prepare(`
      INSERT INTO summaries (id, meeting_id, type, content)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(id, meetingId, type, content)

    const getStmt = this.db.prepare('SELECT * FROM summaries WHERE id = ?')
    return getStmt.get(id) as Summary
  }

  getSummaries(meetingId: string): Summary[] {
    const stmt = this.db.prepare('SELECT * FROM summaries WHERE meeting_id = ? ORDER BY created_at')
    return stmt.all(meetingId) as Summary[]
  }

  getSummaryByType(meetingId: string, type: 'original' | 'enhanced'): Summary | null {
    const stmt = this.db.prepare('SELECT * FROM summaries WHERE meeting_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1')
    return stmt.get(meetingId, type) as Summary | null
  }

  updateSummary(id: string, content: string): Summary | null {
    const stmt = this.db.prepare('UPDATE summaries SET content = ? WHERE id = ?')
    stmt.run(content, id)

    const getStmt = this.db.prepare('SELECT * FROM summaries WHERE id = ?')
    return getStmt.get(id) as Summary | null
  }

  // --- Full-text search ---

  indexMeeting(meetingId: string, title: string, transcriptContent: string, summaryContent: string): void {
    // Delete existing index entry
    this.db.prepare('DELETE FROM meetings_fts WHERE meeting_id = ?').run(meetingId)

    // Insert new index entry
    const stmt = this.db.prepare(`
      INSERT INTO meetings_fts (meeting_id, title, transcript_content, summary_content)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(meetingId, title || '', transcriptContent || '', summaryContent || '')
  }

  searchMeetings(query: string, limit: number = 20): Meeting[] {
    const stmt = this.db.prepare(`
      SELECT m.* FROM meetings m
      JOIN meetings_fts fts ON m.id = fts.meeting_id
      WHERE meetings_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `)
    return stmt.all(query, limit) as Meeting[]
  }

  // --- Statistics ---

  getMeetingCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM meetings')
    const result = stmt.get() as { count: number }
    return result.count
  }

  getTotalDuration(): number {
    const stmt = this.db.prepare('SELECT SUM(duration) as total FROM meetings')
    const result = stmt.get() as { total: number | null }
    return result.total || 0
  }
}
