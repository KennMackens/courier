import { Search, X, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { SessionListItem } from "./SessionListItem"
import { SessionDetailView } from "./SessionDetailView"
import { cn } from "@/lib/utils"
import type { Meeting, MeetingWithDetails } from "@/hooks/useSessionHistory"

interface SessionHistorySidebarProps {
  open: boolean
  onClose: () => void
  meetings: Meeting[]
  selectedMeetingId: string | null
  selectedMeeting: MeetingWithDetails | null
  transcript: string | null
  isLoading: boolean
  isLoadingDetails: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectMeeting: (id: string | null) => void
  onDeleteMeeting: (id: string) => Promise<boolean>
  isEmpty: boolean
}

export function SessionHistorySidebar({
  open,
  onClose,
  meetings,
  selectedMeetingId,
  selectedMeeting,
  transcript,
  isLoading,
  isLoadingDetails,
  searchQuery,
  onSearchChange,
  onSelectMeeting,
  onDeleteMeeting,
  isEmpty,
}: SessionHistorySidebarProps) {
  if (!open) return null

  const handleDelete = async () => {
    if (selectedMeetingId) {
      await onDeleteMeeting(selectedMeetingId)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-12/20"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-80",
          "bg-background border-l border-slate-6",
          "flex flex-col",
          "animate-in slide-in-from-right duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-6">
          <h2 className="text-sm font-semibold text-slate-12">Session History</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Show detail view or list */}
        {selectedMeeting ? (
          <SessionDetailView
            meeting={selectedMeeting}
            transcript={transcript}
            isLoading={isLoadingDetails}
            onDelete={handleDelete}
            onBack={() => onSelectMeeting(null)}
          />
        ) : (
          <>
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
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
