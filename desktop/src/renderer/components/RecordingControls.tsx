import { Mic, Square, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface RecordingControlsProps {
  isRecording: boolean
  isStopping: boolean
  isTranscribing: boolean
  duration: number
  hasTranscript: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onEndMeeting: () => void
  disabled?: boolean
  className?: string
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function RecordingControls({
  isRecording,
  isStopping,
  isTranscribing,
  duration,
  hasTranscript,
  onStartRecording,
  onStopRecording,
  onEndMeeting,
  disabled = false,
  className,
}: RecordingControlsProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Recording state indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-slate-11">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-9 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-9" />
          </span>
          <span className="font-mono">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Start Recording button */}
      {!isRecording && !isStopping && (
        <Button
          onClick={onStartRecording}
          disabled={disabled || isTranscribing}
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

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div className="flex items-center gap-2 text-sm text-slate-11">
          <Spinner size="sm" />
          <span>Transcribing...</span>
        </div>
      )}

      {/* End Meeting button - only show when we have content */}
      {hasTranscript && !isRecording && !isTranscribing && (
        <Button
          onClick={onEndMeeting}
          disabled={disabled}
          variant="outline"
          size="default"
        >
          <Phone className="mr-2 h-4 w-4" />
          End Meeting
        </Button>
      )}
    </div>
  )
}
