import { useState, useRef, useEffect } from "react"
import { Calendar, Clock, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Meeting } from "@/hooks/useSessionHistory"

interface SessionListItemProps {
  meeting: Meeting
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function SessionListItem({ meeting, isSelected, onClick, onDelete }: SessionListItemProps) {
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

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={cn(
          "w-full text-left p-3 rounded-md transition-colors",
          "hover:bg-slate-3 focus:outline-none focus:ring-2 focus:ring-primary-7",
          isSelected && "bg-slate-4 hover:bg-slate-4"
        )}
      >
        <div className="flex flex-col gap-1">
          {/* Title */}
          <span
            className={cn(
              "text-sm font-medium truncate",
              isSelected ? "text-slate-12" : "text-slate-11"
            )}
          >
            {title}
          </span>

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
          </div>
        </div>
      </button>

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
