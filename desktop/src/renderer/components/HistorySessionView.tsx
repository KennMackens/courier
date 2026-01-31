import { useState, useCallback, useRef } from "react"
import { Copy, Check, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { MeetingWithDetails } from "@/hooks/useSessionHistory"

type TabId = "notes" | "transcript"

interface Tab {
  id: TabId
  label: string
}

const tabs: Tab[] = [
  { id: "notes", label: "Notes" },
  { id: "transcript", label: "Transcript" },
]

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

interface HistorySessionViewProps {
  meeting: MeetingWithDetails
  transcript: string | null
  isLoading: boolean
  onDelete: () => Promise<boolean>
  onNotesChange: (meetingId: string, notes: string) => Promise<void>
  onReturnToActiveSession?: () => void
  isRecording?: boolean
  recordingDuration?: number
  className?: string
}

export function HistorySessionView({
  meeting,
  transcript,
  isLoading,
  onDelete,
  onNotesChange,
  onReturnToActiveSession,
  isRecording = false,
  recordingDuration = 0,
  className,
}: HistorySessionViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("notes")
  const [copied, setCopied] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Get enhanced notes (or raw if no enhanced)
  const getEnhancedNotes = useCallback(() => {
    const enhanced = meeting.summaries.find((s) => s.type === "enhanced")
    if (enhanced?.content) return enhanced.content
    const original = meeting.summaries.find((s) => s.type === "original")
    return original?.content || ""
  }, [meeting.summaries])

  // Local state for editable notes
  const [editedNotes, setEditedNotes] = useState<string | null>(null)
  const currentNotes = editedNotes !== null ? editedNotes : getEnhancedNotes()

  // Split notes into title (first line) and body (rest)
  const [title, ...bodyLines] = currentNotes.split("\n")
  const body = bodyLines.join("\n")

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      const newNotes = body ? `${newTitle}\n${body}` : newTitle
      setEditedNotes(newNotes)
    },
    [body]
  )

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const newNotes = `${title}\n${body}`
        setEditedNotes(newNotes)
        bodyRef.current?.focus()
      }
    },
    [title, body]
  )

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newBody = e.target.value
      const newNotes = title ? `${title}\n${newBody}` : newBody
      setEditedNotes(newNotes)
    },
    [title]
  )

  // Auto-save on blur
  const handleBlur = useCallback(async () => {
    if (editedNotes !== null && editedNotes !== getEnhancedNotes()) {
      setIsSaving(true)
      try {
        await onNotesChange(meeting.id, editedNotes)
      } finally {
        setIsSaving(false)
      }
    }
  }, [editedNotes, getEnhancedNotes, meeting.id, onNotesChange])

  // Copy content
  const handleCopy = async () => {
    const content = activeTab === "notes" ? currentNotes : transcript
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
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const hasContent = activeTab === "notes"
    ? currentNotes.trim().length > 0
    : transcript && transcript.trim().length > 0

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className={cn("relative flex flex-col h-full", className)}>
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-6 px-6">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors",
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
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-slate-9 flex items-center gap-1">
              <Spinner size="sm" />
              Saving...
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!hasContent}
          >
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-11 hover:text-red-11 hover:bg-red-3"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-6 pb-20">
        {activeTab === "notes" ? (
          <div className="flex flex-col">
            {/* Title input - H1 style */}
            <input
              type="text"
              value={title || ""}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleBlur}
              placeholder="Title"
              className={cn(
                "w-full bg-transparent text-foreground font-bold text-2xl",
                "placeholder:text-slate-9",
                "border-0 outline-none focus:outline-none focus:ring-0",
                "mb-2"
              )}
            />

            {/* Body textarea - auto-grows with content */}
            <textarea
              ref={bodyRef}
              value={body}
              onChange={handleBodyChange}
              onBlur={handleBlur}
              placeholder="No notes for this meeting..."
              rows={Math.max(10, body.split("\n").length + 2)}
              className={cn(
                "w-full resize-none bg-transparent text-foreground",
                "placeholder:text-slate-9 text-base leading-relaxed",
                "border-0 outline-none focus:outline-none focus:ring-0"
              )}
            />
          </div>
        ) : (
          <div className="text-sm text-slate-12 whitespace-pre-wrap">
            {transcript ? (
              transcript
            ) : (
              <span className="text-slate-9">No transcript available</span>
            )}
          </div>
        )}
      </div>

      {/* Floating controls at bottom-center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {/* Recording state indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-slate-11 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-9 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-9" />
            </span>
            <span className="font-mono text-xs">{formatDuration(recordingDuration)}</span>
          </div>
        )}

        {/* Return to active session button */}
        {onReturnToActiveSession && (
          <Button
            onClick={onReturnToActiveSession}
            variant="default"
            size="default"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Active Session
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-9 hover:bg-red-10 text-white"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
