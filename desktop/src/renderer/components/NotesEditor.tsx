import { useRef, useCallback } from "react"
import { Mic, Square, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface NotesEditorProps {
  notes: string
  onNotesChange: (notes: string) => void
  disabled?: boolean
  className?: string
  // Recording controls
  isRecording: boolean
  isStopping: boolean
  isTranscribing: boolean
  duration: number
  hasTranscript: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onEndMeeting: () => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function NotesEditor({
  notes,
  onNotesChange,
  disabled = false,
  className,
  isRecording,
  isStopping,
  isTranscribing,
  duration,
  hasTranscript,
  onStartRecording,
  onStopRecording,
  onEndMeeting,
}: NotesEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Split notes into title (first line) and body (rest)
  const [title, ...bodyLines] = notes.split("\n")
  const body = bodyLines.join("\n")

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      onNotesChange(body ? `${newTitle}\n${body}` : newTitle)
    },
    [body, onNotesChange]
  )

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        // Move focus to body and ensure there's a newline
        onNotesChange(`${title}\n${body}`)
        bodyRef.current?.focus()
      }
    },
    [title, body, onNotesChange]
  )

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newBody = e.target.value
      onNotesChange(title ? `${title}\n${newBody}` : newBody)
    },
    [title, onNotesChange]
  )

  return (
    <div className={cn("relative flex-1 min-h-0 flex flex-col", className)}>
      {/* Title input - H1 style */}
      <input
        type="text"
        value={title || ""}
        onChange={handleTitleChange}
        onKeyDown={handleTitleKeyDown}
        placeholder="Title"
        disabled={disabled}
        className={cn(
          "w-full bg-transparent text-foreground font-bold text-2xl",
          "placeholder:text-slate-9",
          "border-0 outline-none focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "mb-2"
        )}
      />

      {/* Body textarea - regular text */}
      <textarea
        ref={bodyRef}
        value={body}
        onChange={handleBodyChange}
        placeholder="Any thoughts?"
        disabled={disabled}
        className={cn(
          "flex-1 w-full resize-none bg-transparent text-foreground",
          "placeholder:text-slate-9 text-base leading-relaxed",
          "border-0 outline-none focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />

      {/* Floating controls at bottom-center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {/* Recording state indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-slate-11 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-9 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-9" />
            </span>
            <span className="font-mono text-xs">{formatDuration(duration)}</span>
          </div>
        )}

        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="flex items-center gap-2 text-sm text-slate-11 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Spinner size="sm" />
            <span className="text-xs">Transcribing...</span>
          </div>
        )}

        {/* Start Recording button - show when no transcript yet */}
        {!isRecording && !isStopping && !isTranscribing && !hasTranscript && (
          <Button
            onClick={onStartRecording}
            disabled={disabled}
            variant="default"
            size="default"
          >
            <Mic className="mr-2 h-4 w-4" />
            Start Recording
          </Button>
        )}

        {/* Stop Recording button */}
        {isRecording && (
          <Button
            onClick={onStopRecording}
            disabled={disabled || isStopping}
            variant="destructive"
            size="default"
          >
            {isStopping ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </>
            )}
          </Button>
        )}

        {/* End Meeting button - show only after recording has happened */}
        {hasTranscript && !isRecording && !isTranscribing && (
          <Button
            onClick={onEndMeeting}
            disabled={disabled}
            variant="default"
            size="default"
          >
            <Phone className="mr-2 h-4 w-4" />
            End Meeting
          </Button>
        )}
      </div>
    </div>
  )
}
