import * as React from "react"
import { FileText, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TranscriptViewProps {
  transcript: string
  isTranscribing: boolean
  progress: number
  className?: string
}

export function TranscriptView({
  transcript,
  isTranscribing,
  progress,
  className,
}: TranscriptViewProps) {
  const [copied, setCopied] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when transcribing
  React.useEffect(() => {
    if (isTranscribing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [transcript, isTranscribing])

  // Copy to clipboard
  const handleCopy = async () => {
    if (!transcript) return

    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-slate-12 font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Transcript
          {isTranscribing && (
            <span className="text-xs font-normal text-slate-9">
              ({Math.round(progress)}%)
            </span>
          )}
        </Label>
        {transcript && (
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        className={cn(
          "rounded-md border border-slate-6 bg-background p-4",
          "min-h-[150px] max-h-[300px] overflow-y-auto",
          "text-sm text-slate-12 whitespace-pre-wrap"
        )}
      >
        {transcript ? (
          <>
            {transcript}
            {isTranscribing && (
              <span className="inline-block w-2 h-4 bg-primary-9 animate-pulse ml-0.5" />
            )}
          </>
        ) : (
          <span className="text-slate-9">
            {isTranscribing
              ? "Transcribing audio..."
              : "Transcript will appear here after recording."}
          </span>
        )}
      </div>

      {/* Progress bar during transcription */}
      {isTranscribing && (
        <div className="h-1 bg-slate-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-9 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
