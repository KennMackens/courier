import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface StreamingTextProps {
  content: string
  isStreaming: boolean
  error?: string | null
  emptyMessage?: string
  onRetry?: () => void
  className?: string
}

export function StreamingText({
  content,
  isStreaming,
  error,
  emptyMessage = "No content available",
  onRetry,
  className,
}: StreamingTextProps) {
  const hasContent = content.trim().length > 0

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Content display */}
      <div
        className={cn(
          "rounded-md border border-slate-6 bg-slate-2 p-4 min-h-[200px] max-h-[400px] overflow-y-auto",
          "text-sm text-slate-12 whitespace-pre-wrap"
        )}
      >
        {hasContent ? (
          <>
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-primary-9 animate-pulse ml-0.5" />
            )}
          </>
        ) : isStreaming ? (
          <span className="text-slate-9 flex items-center gap-2">
            Generating enhanced notes
            <span className="inline-block w-2 h-4 bg-primary-9 animate-pulse" />
          </span>
        ) : (
          <span className="text-slate-9">{emptyMessage}</span>
        )}
      </div>

      {/* Error display with retry */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="ml-4 shrink-0"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
