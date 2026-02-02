import { useState, useCallback, useRef, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { Copy, Check, Trash2, ArrowLeft, Sparkles, Pencil, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
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
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check if notes are read-only during enhancement
  const isEnhancing = meeting.enhancement_status === 'enhancing'
  const isPending = meeting.enhancement_status === 'pending'
  const isReadOnly = isEnhancing || isPending

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

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedNotes(e.target.value)
    },
    []
  )

  // Save notes and exit edit mode
  const handleSave = useCallback(async () => {
    if (editedNotes !== null && editedNotes !== getEnhancedNotes()) {
      setIsSaving(true)
      try {
        await onNotesChange(meeting.id, editedNotes)
      } finally {
        setIsSaving(false)
      }
    }
    setIsEditing(false)
  }, [editedNotes, getEnhancedNotes, meeting.id, onNotesChange])

  // Enter edit mode
  const handleEdit = useCallback(() => {
    setEditedNotes(getEnhancedNotes())
    setIsEditing(true)
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [getEnhancedNotes])

  // Custom components for ReactMarkdown styling
  const markdownComponents = useMemo(() => ({
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-2xl font-bold text-foreground mb-4 mt-0">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-semibold text-foreground mb-3 mt-6">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-semibold text-foreground mb-2 mt-4">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-sm text-slate-12 mb-3 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-sm text-slate-12">{children}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
      // Check if it's a code block (has language class) or inline code
      const isBlock = className?.includes("language-")
      if (isBlock) {
        return (
          <code className={cn("block bg-slate-3 rounded-md p-3 text-sm overflow-x-auto", className)}>
            {children}
          </code>
        )
      }
      return (
        <code className="bg-slate-3 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
      )
    },
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="bg-slate-3 rounded-md p-3 mb-3 overflow-x-auto">{children}</pre>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-jade-6 pl-4 my-3 text-slate-11 italic">{children}</blockquote>
    ),
    hr: () => <hr className="my-6 border-slate-6" />,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} className="text-jade-11 underline hover:text-jade-12" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  }), [])

  // Convert markdown to HTML for rich text copy
  const markdownToHtml = useCallback((markdown: string): string => {
    // Create a temporary container
    const container = document.createElement("div")
    const root = createRoot(container)

    // Render markdown synchronously
    flushSync(() => {
      root.render(
        <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
      )
    })

    const html = container.innerHTML
    root.unmount()
    return html
  }, [markdownComponents])

  // Copy as rich text (HTML) - default behavior
  const handleCopyRichText = async () => {
    const content = activeTab === "notes" ? currentNotes : transcript
    if (!content) return

    try {
      if (activeTab === "notes") {
        // Convert markdown to HTML for rich text copy
        const html = markdownToHtml(content)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([content], { type: "text/plain" }),
          }),
        ])
      } else {
        // Transcript is plain text
        await navigator.clipboard.writeText(content)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        console.error("Fallback copy also failed")
      }
    }
  }

  // Copy as markdown (plain text)
  const handleCopyMarkdown = async () => {
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
    <div className={cn("relative flex flex-col overflow-hidden", className)}>
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
          {activeTab === "notes" ? (
            <div className="flex items-center">
              {/* Main copy button - copies with formatting */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyRichText}
                disabled={!hasContent}
                className="rounded-r-none pr-2"
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
              {/* Divider */}
              <div className="h-4 w-px bg-slate-4" />
              {/* Dropdown trigger for options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasContent}
                    className="rounded-l-none pl-1 pr-1.5"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyRichText}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy with formatting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyMarkdown}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy as Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyMarkdown}
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
          )}
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
            {/* Read-only notice during enhancement */}
            {isReadOnly && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-md bg-jade-2 text-jade-11 text-sm">
                <Sparkles className="h-4 w-4" />
                <span>
                  {isEnhancing
                    ? "Notes are read-only while enhancement is in progress..."
                    : "Notes are read-only while transcription is processing..."}
                </span>
              </div>
            )}

            {isEditing ? (
              /* Edit mode - full markdown source in textarea */
              <div className="flex flex-col gap-3">
                <textarea
                  ref={textareaRef}
                  value={currentNotes}
                  onChange={handleNotesChange}
                  placeholder="Write your notes in Markdown..."
                  rows={Math.max(15, currentNotes.split("\n").length + 2)}
                  className={cn(
                    "w-full resize-none bg-slate-2 text-slate-12 rounded-md p-4",
                    "placeholder:text-slate-9 text-sm font-mono",
                    "border border-slate-6 outline-none focus:outline-none focus:ring-2 focus:ring-jade-7"
                  )}
                />
                <div className="flex justify-end">
                  <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Done"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* View mode - rendered markdown */
              <div className="relative group">
                {currentNotes.trim() ? (
                  <ReactMarkdown components={markdownComponents}>
                    {currentNotes}
                  </ReactMarkdown>
                ) : (
                  <p className="text-slate-9 text-sm">No notes for this meeting...</p>
                )}
                {/* Edit button - shown on hover when not read-only */}
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            )}
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
