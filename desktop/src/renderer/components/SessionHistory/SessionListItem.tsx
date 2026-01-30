import { Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Meeting } from "@/hooks/useSessionHistory"

interface SessionListItemProps {
  meeting: Meeting
  isSelected: boolean
  onClick: () => void
}

export function SessionListItem({ meeting, isSelected, onClick }: SessionListItemProps) {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
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
    <button
      onClick={onClick}
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
            {formatDate(meeting.date_time)} at {formatTime(meeting.date_time)}
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
  )
}
