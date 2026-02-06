import { Search, X, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { SessionListItem } from "./SessionListItem"
import { cn } from "@/lib/utils"
import type { Meeting } from "@/hooks/useSessionHistory"

interface SessionHistorySidebarProps {
  open: boolean
  onClose: () => void
  meetings: Meeting[]
  selectedMeetingId: string | null
  isLoading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectMeeting: (id: string | null) => void
  onDeleteMeeting: (id: string) => Promise<boolean>
  isEmpty: boolean
  processing?: {
    transcription: {
      meetingId: string
      progress: number
      elapsedSeconds: number
      etaSeconds: number | null
    } | null
    enhancement: {
      meetingId: string
      elapsedSeconds: number
      queuePosition: number
      progress: number
    } | null
  }
}

export function SessionHistorySidebar({
  open,
  onClose,
  meetings,
  selectedMeetingId,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelectMeeting,
  onDeleteMeeting,
  isEmpty,
  processing,
}: SessionHistorySidebarProps) {
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 1) return "0s"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    if (mins < 60) return `${mins}m ${secs.toString().padStart(2, "0")}s`
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}h ${remMins.toString().padStart(2, "0")}m`
  }

  const activeTranscription = processing?.transcription
  const activeEnhancement = processing?.enhancement

  return (
    <div
      className={cn(
        "h-full flex-shrink-0 overflow-hidden",
        "bg-background border-l border-slate-6",
        "transition-all duration-300 ease-in-out",
        open ? "w-80" : "w-0 border-l-0"
      )}
    >
      <div className={cn(
        "w-80 h-full flex flex-col",
        "transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-6">
          <h2 className="text-sm font-semibold text-slate-12">Session History</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Processing status */}
        {(activeTranscription || activeEnhancement) && (
          <div className="px-4 py-3 border-b border-slate-6 space-y-3 bg-slate-2">
            {activeTranscription && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-12">
                  <span>Transcribing…</span>
                  <span>{`${Math.round(activeTranscription.progress)}%`}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-10">
                  <span>Elapsed {formatDuration(activeTranscription.elapsedSeconds)}</span>
                  {activeTranscription.etaSeconds !== null && (
                    <>
                      <span className="text-slate-8">•</span>
                      <span>~{formatDuration(activeTranscription.etaSeconds)} remaining</span>
                    </>
                  )}
                </div>
                <div className="h-2 rounded-full bg-slate-4 overflow-hidden">
                  <div
                    className="h-full bg-jade-9 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, activeTranscription.progress))}%` }}
                  />
                </div>
              </div>
            )}

            {activeEnhancement && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-12">
                  <span>Enhancing notes…</span>
                  <span className="text-xs font-medium text-slate-10">
                    {activeEnhancement.queuePosition > 0
                      ? `In queue • ${activeEnhancement.queuePosition}`
                      : "Processing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-10">
                  <span>Elapsed {formatDuration(activeEnhancement.elapsedSeconds)}</span>
                  <span className="text-slate-8">•</span>
                  <span>Streaming output</span>
                </div>
                <div className="h-2 rounded-full bg-slate-4 overflow-hidden">
                  {activeEnhancement.progress > 0 ? (
                    <div
                      className="h-full bg-jade-9 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, activeEnhancement.progress))}%` }}
                    />
                  ) : (
                    <div className="h-full w-1/3 min-w-[24%] bg-gradient-to-r from-jade-6 via-jade-9 to-jade-6 animate-pulse" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-slate-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-9" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 text-sm",
                "bg-slate-2 border border-slate-6 rounded-md",
                "placeholder:text-slate-9 text-slate-12",
                "focus:outline-none focus:ring-2 focus:ring-primary-7 focus:border-primary-7"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-9 hover:text-slate-11"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size="md" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <FolderOpen className="h-8 w-8 text-slate-9 mb-2" />
              <p className="text-sm text-slate-11">No meetings yet</p>
              <p className="text-xs text-slate-9 mt-1">
                Your meeting history will appear here after you save your first meeting.
              </p>
            </div>
          ) : meetings.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Search className="h-8 w-8 text-slate-9 mb-2" />
              <p className="text-sm text-slate-11">No results found</p>
              <p className="text-xs text-slate-9 mt-1">
                Try a different search term.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {meetings.map((meeting) => (
                <SessionListItem
                  key={meeting.id}
                  meeting={meeting}
                  isSelected={selectedMeetingId === meeting.id}
                  onClick={() => onSelectMeeting(meeting.id)}
                  onDelete={() => onDeleteMeeting(meeting.id)}
                  transcriptionProgress={
                    processing?.transcription
                      ? {
                          meetingId: processing.transcription.meetingId,
                          progress: processing.transcription.progress,
                          etaSeconds: processing.transcription.etaSeconds,
                        }
                      : null
                  }
                  enhancementProgress={
                    processing?.enhancement
                      ? {
                          currentId: processing.enhancement.meetingId,
                          queuePosition: processing.enhancement.queuePosition,
                        }
                      : null
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
