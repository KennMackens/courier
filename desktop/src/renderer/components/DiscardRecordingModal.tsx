import * as React from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DiscardRecordingModalProps {
  open: boolean
  duration: number
  threshold: number
  onKeep: () => void
  onDiscard: () => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs} second${secs !== 1 ? "s" : ""}`
}

export function DiscardRecordingModal({
  open,
  duration,
  threshold,
  onKeep,
  onDiscard,
}: DiscardRecordingModalProps) {
  const keepButtonRef = React.useRef<HTMLButtonElement>(null)

  // Focus the "Keep" button when modal opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        keepButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-3">
              <AlertTriangle className="h-5 w-5 text-amber-11" />
            </div>
            <DialogTitle>Short Recording</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This recording is only <span className="font-medium text-slate-12">{formatDuration(duration)}</span> long,
            which is shorter than your minimum threshold of {formatDuration(threshold)}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <p className="text-sm text-slate-10">
            Would you like to keep it anyway or discard it?
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onDiscard}
            className="text-red-11 hover:text-red-12 hover:bg-red-3 border-red-6"
          >
            Discard
          </Button>
          <Button
            ref={keepButtonRef}
            onClick={onKeep}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
