import { useState, useRef, useEffect } from "react"
import { Calendar, Clock, Trash2, Sparkles, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Meeting } from "@/hooks/useSessionHistory"

// Check if meeting is "new" (within 24 hours of is_new timestamp)
function isNewMeeting(isNewTimestamp: number | null): boolean {
  if (!isNewTimestamp) return false
  const twentyFourHours = 24 * 60 * 60 * 1000
  return Date.now() - isNewTimestamp < twentyFourHours
}

interface SessionListItemProps {
  meeting: Meeting
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  transcriptionProgress?: {
    meetingId: string | null
    progress: number
    etaSeconds: number | null
  } | null
  enhancementProgress?: {
    currentId: string | null
    queuePosition: number
    progress?: number
  } | null
}

export function SessionListItem({
  meeting,
  isSelected,
  onClick,
  onDelete,
  transcriptionProgress,
  enhancementProgress,
}: SessionListItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Handle right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
      }
    }

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showContextMenu])

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowContextMenu(false)
    onDelete()
  }
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Format duration (seconds to minutes)
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  // Get display title
  const title = meeting.title || `Meeting - ${formatDate(meeting.date_time)}`

  // Enhancement status indicators
  const isEnhancing = meeting.enhancement_status === 'enhancing'
  const isPending = meeting.enhancement_status === 'pending'
  const isFailed = meeting.enhancement_status === 'failed'
  const isNew = isNewMeeting(meeting.is_new)
  const isTranscribingThis = transcriptionProgress?.meetingId === meeting.id
  const transcribeProgress = isTranscribingThis ? Math.min(100, Math.max(0, transcriptionProgress?.progress ?? 0)) : 0
  const isEnhancementCurrent = enhancementProgress?.currentId === meeting.id
  const enhancementQueuePosition = enhancementProgress?.queuePosition ?? -1
  const enhancementProgressPct = isEnhancementCurrent ? enhancementProgress?.progress ?? 0 : 0

  return (
    <>
      <div
        className={cn(
          "group relative w-full rounded-md transition-colors",
          "hover:bg-slate-3",
          isSelected && "bg-slate-4 hover:bg-slate-4",
          // Pulsing border during enhancement
          isEnhancing && "ring-2 ring-jade-7 animate-pulse-border"
        )}
      >
        <button
          onClick={onClick}
          onContextMenu={handleContextMenu}
          className="w-full text-left p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-7 rounded-md"
        >
          <div className="flex flex-col gap-1">
            {/* Title row with status chips */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium truncate flex-1",
                  isSelected ? "text-slate-12" : "text-slate-11"
                )}
              >
                {title}
              </span>

              {/* Status chips */}
              {isTranscribingThis && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-sky-3 text-sky-11 rounded">
                  <Sparkles className="h-2.5 w-2.5" />
                  {`Transcribing ${Math.round(transcribeProgress)}%`}
                </span>
              )}
              {isEnhancing && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-jade-3 text-jade-11 rounded">
                  <Sparkles className="h-2.5 w-2.5" />
                  {isEnhancementCurrent
                    ? `Enhancing${enhancementProgressPct > 0 ? ` ${Math.round(enhancementProgressPct)}%` : ""}`
                    : "Queued"}
                </span>
              )}
              {isPending && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-3 text-slate-10 rounded">
                  Pending
                </span>
              )}
              {isFailed && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-3 text-red-11 rounded">
                  <AlertCircle className="h-2.5 w-2.5" />
                  Failed
                </span>
              )}
              {isNew && !isEnhancing && !isPending && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-pink-3 text-pink-11 rounded">
                  New
                </span>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-xs text-slate-9">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(meeting.date_time)}
              </span>
              {meeting.duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(meeting.duration)}
                </span>
              )}
            {isEnhancementCurrent && (
              <span className="flex items-center gap-1 text-jade-11">
                <Sparkles className="h-3 w-3" />
                {enhancementProgressPct > 0 ? `Enhancing ${Math.round(enhancementProgressPct)}%` : "Enhancing…"}
              </span>
            )}
              {!isEnhancementCurrent && enhancementQueuePosition > 0 && (
                <span className="text-slate-10">{`Queue: ${enhancementQueuePosition}`}</span>
              )}
            </div>

            {isTranscribingThis && (
              <div className="mt-1 h-1.5 rounded-full bg-slate-4 overflow-hidden">
                {transcribeProgress > 0 ? (
                  <div
                    className="h-full bg-sky-9 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, transcribeProgress))}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 min-w-[24%] bg-gradient-to-r from-sky-6 via-sky-9 to-sky-6 animate-pulse" />
                )}
              </div>
            )}
            {isEnhancementCurrent && (
              <div className="mt-1 h-1.5 rounded-full bg-slate-4 overflow-hidden">
                {enhancementProgressPct > 0 ? (
                  <div
                    className="h-full bg-jade-9 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, enhancementProgressPct))}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 min-w-[24%] bg-gradient-to-r from-jade-6 via-jade-9 to-jade-6 animate-pulse" />
                )}
              </div>
            )}
          </div>
        </button>

        {/* Delete button - visible on hover */}
        <button
          onClick={handleDelete}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "text-slate-9 hover:text-red-11 hover:bg-red-3"
          )}
          title="Delete session"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[100] min-w-[140px] rounded-md",
            "bg-slate-2 border border-slate-6 shadow-lg",
            "py-1"
          )}
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            onClick={handleDelete}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm",
              "text-red-11 hover:bg-red-3 transition-colors"
            )}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </>
  )
}
