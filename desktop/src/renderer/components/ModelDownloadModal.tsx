import * as React from "react"
import { Download, X, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface ModelDownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Download state
  isDownloading: boolean
  downloadProgress: number
  downloadedSize: string
  totalSize: string
  downloadSpeed: string

  // Status
  isComplete: boolean
  isCancelled: boolean
  error: string | null

  // Actions
  onDownload: () => void
  onCancel: () => void
  onRetry: () => void

  // Optional model info
  modelName?: string
  modelSize?: string
}

export function ModelDownloadModal({
  open,
  onOpenChange,
  isDownloading,
  downloadProgress,
  downloadedSize,
  totalSize,
  downloadSpeed,
  isComplete,
  isCancelled,
  error,
  onDownload,
  onCancel,
  onRetry,
  modelName,
  modelSize,
}: ModelDownloadModalProps) {
  // Determine current state
  const showInitialPrompt = !isDownloading && !isComplete && !error && !isCancelled
  const showProgress = isDownloading
  const showComplete = isComplete
  const showError = !!error
  const showCancelled = isCancelled && !error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showInitialPrompt && "Download AI Model"}
            {showProgress && "Downloading Model"}
            {showComplete && "Download Complete"}
            {showError && "Download Failed"}
            {showCancelled && "Download Cancelled"}
          </DialogTitle>
          {showInitialPrompt && (
            <DialogDescription>
              To enhance your meeting notes locally, Otto needs to download an AI
              model. This is a one-time download.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {/* Initial prompt */}
          {showInitialPrompt && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-jade-3 border border-jade-6">
                <Download className="h-5 w-5 text-jade-11 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-jade-12">Local AI Processing</p>
                  <p className="text-jade-11 mt-1">
                    All processing happens on your Mac. Your meeting data never leaves
                    your device.
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-11 space-y-1">
                <p>
                  <span className="font-medium">Model:</span> {modelName || "Recommended MLX model"}
                </p>
                {modelSize && (
                  <p>
                    <span className="font-medium">Size:</span> {modelSize}
                  </p>
                )}
                <p>
                  <span className="font-medium">Requirements:</span> macOS 14.2+, Apple
                  Silicon
                </p>
              </div>
            </div>
          )}

          {/* Download progress */}
          {showProgress && (
            <div className="space-y-4">
              <Progress value={downloadProgress} className="h-2" />

              <div className="flex justify-between text-sm text-slate-11">
                <span>
                  {downloadedSize} / {totalSize || "calculating..."}
                </span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>

              {downloadSpeed && (
                <p className="text-sm text-slate-10 text-center">{downloadSpeed}</p>
              )}
            </div>
          )}

          {/* Complete state */}
          {showComplete && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-12 w-12 rounded-full bg-jade-4 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-jade-11" />
              </div>
              <p className="text-sm text-slate-11 text-center">
                The AI model has been downloaded successfully. You can now enhance your
                meeting notes locally.
              </p>
            </div>
          )}

          {/* Error state */}
          {showError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cancelled state */}
          {showCancelled && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-slate-11 text-center">
                Download was cancelled. You can resume the download at any time from
                Settings, or when you try to enhance notes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* Initial prompt actions */}
          {showInitialPrompt && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Later
              </Button>
              <Button onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Now
              </Button>
            </>
          )}

          {/* Progress actions */}
          {showProgress && (
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}

          {/* Complete actions */}
          {showComplete && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}

          {/* Error actions */}
          {showError && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onRetry}>Retry Download</Button>
            </>
          )}

          {/* Cancelled actions */}
          {showCancelled && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onRetry}>Resume Download</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
