import { useState, useEffect, useCallback, useRef } from "react"

// Enhancement status type
export type EnhancementStatus = 'pending' | 'enhancing' | 'complete' | 'failed' | null

// Types matching the database schema
export interface Meeting {
  id: string
  title: string | null
  date_time: string
  duration: number
  transcript_path: string | null
  audio_path: string | null
  enhancement_status: EnhancementStatus
  is_new: number | null
  created_at: string
  updated_at: string
}

export interface Summary {
  id: string
  meeting_id: string
  type: "original" | "enhanced"
  content: string
  created_at: string
}

export interface MeetingWithDetails extends Meeting {
  speakers: Array<{
    id: string
    meeting_id: string
    name: string
    word_count: number
  }>
  summaries: Summary[]
}

interface UseSessionHistoryOptions {
  onError?: (error: string) => void
  onMeetingDeleted?: (id: string) => void
}

export function useSessionHistory(options: UseSessionHistoryOptions = {}) {
  // Use refs to avoid infinite loops - callbacks shouldn't trigger re-fetches
  const onErrorRef = useRef(options.onError)
  const onMeetingDeletedRef = useRef(options.onMeetingDeleted)

  // Keep refs updated
  onErrorRef.current = options.onError
  onMeetingDeletedRef.current = options.onMeetingDeleted

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithDetails | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Fetch all meetings
  const fetchMeetings = useCallback(async (search?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.database.listMeetings({
        limit: 100,
        search: search || undefined,
      })
      setMeetings(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch meetings"
      setError(message)
      onErrorRef.current?.(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load meetings on mount
  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  // Search meetings when query changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchMeetings(searchQuery)
      } else {
        fetchMeetings()
      }
    }, 300) // Debounce search

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, fetchMeetings])

  // Select a meeting and load its details
  const selectMeeting = useCallback(async (id: string | null) => {
    setSelectedMeetingId(id)

    if (!id) {
      setSelectedMeeting(null)
      setTranscript(null)
      return
    }

    setIsLoadingDetails(true)
    setError(null)

    try {
      // Fetch meeting with details
      const meeting = await window.database.getMeetingWithDetails(id)
      setSelectedMeeting(meeting)

      // Fetch transcript if available
      if (meeting?.transcript_path) {
        try {
          const transcriptResult = await window.database.readTranscript(id)
          setTranscript(transcriptResult.content)
        } catch {
          setTranscript(null)
        }
      } else {
        setTranscript(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load meeting details"
      setError(message)
      onErrorRef.current?.(message)
      setSelectedMeeting(null)
      setTranscript(null)
    } finally {
      setIsLoadingDetails(false)
    }
  }, [])

  // Delete a meeting
  const deleteMeeting = useCallback(async (id: string) => {
    try {
      await window.database.deleteMeeting(id)

      // Remove from local state
      setMeetings((prev) => prev.filter((m) => m.id !== id))

      // Clear selection if this was the selected meeting
      if (selectedMeetingId === id) {
        setSelectedMeetingId(null)
        setSelectedMeeting(null)
        setTranscript(null)
      }

      onMeetingDeletedRef.current?.(id)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete meeting"
      setError(message)
      onErrorRef.current?.(message)
      return false
    }
  }, [selectedMeetingId])

  // Refresh meetings list
  const refresh = useCallback(() => {
    return fetchMeetings(searchQuery || undefined)
  }, [fetchMeetings, searchQuery])

  // Add a new meeting to the list (called after saving)
  const addMeeting = useCallback((meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev])
  }, [])

  // Get enhanced notes for selected meeting
  const getEnhancedNotes = useCallback(() => {
    if (!selectedMeeting) return null
    const enhanced = selectedMeeting.summaries.find((s) => s.type === "enhanced")
    return enhanced?.content || null
  }, [selectedMeeting])

  // Get raw notes for selected meeting
  const getRawNotes = useCallback(() => {
    if (!selectedMeeting) return null
    const original = selectedMeeting.summaries.find((s) => s.type === "original")
    return original?.content || null
  }, [selectedMeeting])

  return {
    // State
    meetings,
    selectedMeetingId,
    selectedMeeting,
    transcript,
    isLoading,
    isLoadingDetails,
    searchQuery,
    error,

    // Actions
    setSearchQuery,
    selectMeeting,
    deleteMeeting,
    refresh,
    addMeeting,

    // Helpers
    getEnhancedNotes,
    getRawNotes,
    isEmpty: meetings.length === 0 && !isLoading,
  }
}
