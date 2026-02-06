import { useState, useCallback, useRef, useEffect } from "react"
import type { EnhancementStatus } from "@/hooks/useSessionHistory"

/**
 * Clean up LLM output that may contain unwanted formatting.
 * - Strips markdown code fences (```markdown ... ```)
 * - Converts table rows (| content |) to plain text
 * - Removes table separator rows (|---|)
 */
function cleanLLMOutput(content: string): string {
  let cleaned = content.trim()

  // Strip code fences if present
  const codeFencePattern = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/
  const codeFenceMatch = cleaned.match(codeFencePattern)
  if (codeFenceMatch) {
    cleaned = codeFenceMatch[1].trim()
  }

  // Check if content looks like a table (has | at start/end of lines)
  const lines = cleaned.split('\n')
  const tableLineCount = lines.filter(line => line.trim().startsWith('|') && line.trim().endsWith('|')).length

  // If most lines are table rows, convert to regular markdown
  if (tableLineCount > lines.length * 0.5) {
    cleaned = lines
      .map(line => {
        const trimmed = line.trim()
        // Skip separator rows like |---|---|
        if (/^\|[-:\s|]+\|$/.test(trimmed)) {
          return ''
        }
        // Convert table row to plain text
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // Extract content between pipes, join with space
          const content = trimmed
            .slice(1, -1) // Remove outer pipes
            .split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
            .join(' ')
          return content
        }
        return line
      })
      .filter(line => line.length > 0)
      .join('\n')
  }

  return cleaned
}

interface EnhancementQueueItem {
  meetingId: string
  notes: string
  transcript: string
  language: string
  userTitle: string
}

interface UseEnhancementQueueOptions {
  onEnhancementStart?: (meetingId: string) => void
  onEnhancementComplete?: (meetingId: string, enhancedNotes: string) => void
  onEnhancementError?: (meetingId: string, error: string) => void
  onStatusChange?: (meetingId: string, status: EnhancementStatus) => void
}

export function useEnhancementQueue(options: UseEnhancementQueueOptions = {}) {
  const { onEnhancementStart, onEnhancementComplete, onEnhancementError, onStatusChange } = options

  // Queue of meetings waiting for enhancement
  const [queue, setQueue] = useState<EnhancementQueueItem[]>([])
  // Currently enhancing meeting ID
  const [currentEnhancementId, setCurrentEnhancementId] = useState<string | null>(null)
  // Track if enhancement is in progress
  const [isProcessing, setIsProcessing] = useState(false)

  // Refs for callbacks to avoid stale closures
  const enhancedNotesRef = useRef("")
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Ref for synchronous processing guard (prevents React StrictMode double-invocations)
  const isProcessingRef = useRef(false)

  // Setup token listener for streaming enhancement
  useEffect(() => {
    const unsubscribe = window.python.onEnhanceToken((data: { token?: string; status?: string }) => {
      const { token } = data
      // Only accumulate if token is present (status messages don't have tokens)
      if (token) {
        enhancedNotesRef.current += token
      }
    })

    return () => unsubscribe()
  }, [])

  // Process the next item in queue
  const processNext = useCallback(async () => {
    // Synchronous guard - set IMMEDIATELY to prevent any duplicate calls
    if (isProcessingRef.current) {
      return
    }
    isProcessingRef.current = true

    // Get the next item from the queue
    let nextItem: EnhancementQueueItem | null = null

    setQueue((currentQueue) => {
      if (currentQueue.length === 0) {
        return currentQueue
      }

      const [first, ...remainingQueue] = currentQueue
      nextItem = first
      return remainingQueue
    })

    // Wait for state to settle and check if we got an item
    await new Promise(resolve => setTimeout(resolve, 0))

    if (!nextItem) {
      isProcessingRef.current = false
      return
    }

    // Now process the item
    setIsProcessing(true)
    setCurrentEnhancementId(nextItem.meetingId)

    // Reset accumulated notes
    enhancedNotesRef.current = ""

    try {
      // Update meeting status to enhancing
      await window.database.updateMeeting(nextItem.meetingId, {
        enhancement_status: 'enhancing'
      })
      optionsRef.current.onStatusChange?.(nextItem.meetingId, 'enhancing')
      optionsRef.current.onEnhancementStart?.(nextItem.meetingId)

      // Call the Python enhancement API
      await window.python.enhanceNotes({
        notes: nextItem.notes,
        transcript: nextItem.transcript,
        language: nextItem.language,
      })

      // Clean up any unwanted LLM formatting (code fences, tables)
      const finalNotes = cleanLLMOutput(enhancedNotesRef.current)

      // Save enhanced notes to database
      await window.database.updateSummary(nextItem.meetingId, "enhanced", finalNotes)

      // Update meeting status to complete
      await window.database.updateMeeting(nextItem.meetingId, {
        enhancement_status: 'complete'
      })

      // Update search index with enhanced notes
      const meeting = await window.database.getMeeting(nextItem.meetingId)
      if (meeting) {
        await window.database.indexMeeting(
          nextItem.meetingId,
          meeting.title || "",
          nextItem.transcript,
          finalNotes
        )
      }

      optionsRef.current.onStatusChange?.(nextItem.meetingId, 'complete')
      optionsRef.current.onEnhancementComplete?.(nextItem.meetingId, finalNotes)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Enhancement failed"

      // Update meeting status to failed
      try {
        await window.database.updateMeeting(nextItem.meetingId, {
          enhancement_status: 'failed'
        })
      } catch {
        console.error("Failed to update meeting status to failed")
      }

      optionsRef.current.onStatusChange?.(nextItem.meetingId, 'failed')
      optionsRef.current.onEnhancementError?.(nextItem.meetingId, errorMessage)
    } finally {
      // Reset ref synchronously
      isProcessingRef.current = false
      setIsProcessing(false)
      setCurrentEnhancementId(null)

      // Process next item in queue (after state update)
      setTimeout(() => {
        processNextInternal()
      }, 100)
    }
  }, []) // No dependencies - uses refs for synchronous state

  // Internal function to trigger queue processing
  const processNextInternal = useCallback(() => {
    setQueue((currentQueue) => {
      if (currentQueue.length > 0) {
        // Trigger processNext
        setTimeout(() => processNext(), 0)
      }
      return currentQueue
    })
  }, [processNext])

  // Enqueue a new enhancement request
  const enqueueEnhancement = useCallback((item: EnhancementQueueItem) => {
    setQueue((prev) => {
      // Don't add duplicates
      if (prev.some((i) => i.meetingId === item.meetingId)) {
        return prev
      }
      if (currentEnhancementId === item.meetingId) {
        return prev
      }
      return [...prev, item]
    })

    // Use ref for synchronous check - prevents race conditions from stale closures
    if (!isProcessingRef.current) {
      setTimeout(() => processNext(), 0)
    }
  }, [currentEnhancementId, processNext])

  // Remove an item from the queue
  const removeFromQueue = useCallback((meetingId: string) => {
    setQueue((prev) => prev.filter((item) => item.meetingId !== meetingId))
  }, [])

  // Check if a meeting is in queue or being processed
  const isInQueue = useCallback((meetingId: string) => {
    return queue.some((item) => item.meetingId === meetingId) || currentEnhancementId === meetingId
  }, [queue, currentEnhancementId])

  // Get queue position (0-indexed, -1 if not in queue)
  const getQueuePosition = useCallback((meetingId: string) => {
    if (currentEnhancementId === meetingId) return 0
    const index = queue.findIndex((item) => item.meetingId === meetingId)
    return index === -1 ? -1 : index + 1
  }, [queue, currentEnhancementId])

  return {
    queue,
    currentEnhancementId,
    isProcessing,
    enqueueEnhancement,
    removeFromQueue,
    isInQueue,
    getQueuePosition,
    queueLength: queue.length + (isProcessing ? 1 : 0),
  }
}
