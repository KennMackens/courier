import { useState, useCallback } from "react"
import { Copy, Check, Trash2, Calendar, Clock, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { MeetingWithDetails } from "@/hooks/useSessionHistory"

type TabId = "enhanced" | "raw" | "transcript"

interface Tab {
  id: TabId
  label: string
}

const tabs: Tab[] = [
  { id: "enhanced", label: "Enhanced Notes" },
  { id: "raw", label: "Raw Notes" },
  { id: "transcript", label: "Transcript" },
]

interface SessionDetailViewProps {
  meeting: MeetingWithDetails
  transcript: string | null
  isLoading: boolean
  onDelete: () => void
  onBack: () => void
}

export function SessionDetailView({
  meeting,
  transcript,
  isLoading,
  onDelete,
  onBack,
}: SessionDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("enhanced")
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Get content for each tab
  const getEnhancedNotes = () => {
    const enhanced = meeting.summaries.find((s) => s.type === "enhanced")
    return enhanced?.content || null
  }

  const getRawNotes = () => {
    const original = meeting.summaries.find((s) => s.type === "original")
    return original?.content || null
  }

  const getTabContent = useCallback(() => {
    switch (activeTab) {
      case "enhanced":
        return getEnhancedNotes()
      case "raw":
        return getRawNotes()
      case "transcript":
        return transcript
      default:
        return null
    }
  }, [activeTab, meeting.summaries, transcript])

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
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

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  // Copy content
  const handleCopy = async () => {
    const content = getTabContent()
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // Delete with confirmation
  const handleDelete = () => {
    if (confirmDelete) {
      onDelete()
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const title = meeting.title || `Meeting - ${formatDate(meeting.date_time)}`
  const content = getTabContent()
  const hasContent = content && content.trim().length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex items-center gap-2 p-4 border-b border-slate-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-12 truncate">{title}</h3>
          <div className="flex items-center gap-3 text-xs text-slate-9 mt-0.5">
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
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-6 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              "border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-primary-9 text-primary-11"
                : "border-transparent text-slate-11 hover:text-slate-12 hover:border-slate-7"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className={cn(
            "rounded-md border border-slate-6 bg-slate-2 p-4 min-h-[200px]",
            "text-sm text-slate-12 whitespace-pre-wrap"
          )}
        >
          {hasContent ? (
            content
          ) : (
            <span className="text-slate-9">
              {activeTab === "enhanced" && "No enhanced notes available"}
              {activeTab === "raw" && "No raw notes available"}
              {activeTab === "transcript" && "No transcript available"}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 border-t border-slate-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!hasContent}
        >
          {copied ? (
            <>
              <Check className="mr-2 h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-3 w-3" />
              Copy
            </>
          )}
        </Button>
        <Button
          variant={confirmDelete ? "destructive" : "outline"}
          size="sm"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 h-3 w-3" />
          {confirmDelete ? "Confirm Delete" : "Delete"}
        </Button>
      </div>
    </div>
  )
}
