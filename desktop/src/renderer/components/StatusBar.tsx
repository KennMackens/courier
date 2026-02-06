import { Settings, Wifi, WifiOff, AlertCircle, History, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MicStatus } from "@/hooks/useRecording"

interface StatusBarProps {
  isConnected: boolean
  version?: string
  permissionGranted: boolean
  error?: string | null
  micStatus: MicStatus
  micTooltip?: string | null
  onMicClick?: () => void
  onSettingsClick: () => void
  onHistoryClick: () => void
  className?: string
}

export function StatusBar({
  isConnected,
  version,
  permissionGranted,
  error,
  micStatus,
  micTooltip,
  onMicClick,
  onSettingsClick,
  onHistoryClick,
  className,
}: StatusBarProps) {
  const micActive = micStatus === "active"
  const micIcon = micActive ? (
    <Mic className="h-4 w-4 text-emerald-11" />
  ) : (
    <MicOff className="h-4 w-4 text-amber-11" />
  )

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2",
        "border-b border-slate-6 bg-slate-2",
        className
      )}
    >
      {/* Left side: Connection status */}
      <div className="flex items-center gap-4">
        {/* Connection indicator */}
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-primary-11" />
              <span className="text-slate-11">Connected</span>
              {version && (
                <span className="text-slate-9 text-xs">v{version}</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-11" />
              <span className="text-red-11">Disconnected</span>
            </>
          )}
        </div>

        {/* Permission status */}
        {!permissionGranted && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span>Permission required</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-11">
            <AlertCircle className="h-4 w-4" />
            <span className="truncate max-w-[200px]">{error}</span>
          </div>
        )}
      </div>

      {/* Right side: History and Settings buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMicClick}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-full border transition-colors",
            micActive
              ? "border-emerald-7 text-emerald-11 hover:bg-emerald-3"
              : "border-amber-7 text-amber-11 hover:bg-amber-3"
          )}
          title={micTooltip || "Microphone status"}
          aria-label={micTooltip || "Microphone status"}
        >
          {micIcon}
        </button>
        <Button
          onClick={onHistoryClick}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <History className="h-4 w-4" />
          <span className="sr-only">Session History</span>
        </Button>
        <Button
          onClick={onSettingsClick}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </div>
  )
}
