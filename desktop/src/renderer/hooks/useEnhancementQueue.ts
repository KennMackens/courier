import { useState, useCallback, useRef, useEffect } from "react"
import type { EnhancementStatus } from "@/hooks/useSessionHistory"

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

  // Setup token listener for streaming enhancement
  useEffect(() => {
    const unsubscribe = window.python.onEnhanceToken((data: { token: string; status?: string }) => {
      const { token } = data
      enhancedNotesRef.current += token
    })

    return () => unsubscribe()
  }, [])

  // Process the next item in queue
  const processNext = useCallback(async () => {
    setQueue((currentQueue) => {
      if (currentQueue.length === 0 || isProcessing) {
        return currentQueue
      }

      const [nextItem, ...remainingQueue] = currentQueue

      // Start processing asynchronously
      setIsProcessing(true)
      setCurrentEnhancementId(nextItem.meetingId)

      // Reset accumulated notes
      enhancedNotesRef.current = ""

      // Trigger the enhancement
      ;(async () => {
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

          const finalNotes = enhancedNotesRef.current

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
          setIsProcessing(false)
          setCurrentEnhancementId(null)

          // Process next item in queue (after state update)
          setTimeout(() => {
            processNextInternal()
          }, 100)
        }
      })()

      return remainingQueue
    })
  }, [isProcessing])

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

    // If not currently processing, start processing
    if (!isProcessing) {
      setTimeout(() => processNext(), 0)
    }
  }, [currentEnhancementId, isProcessing, processNext])

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
