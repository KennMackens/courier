import { Settings, Wifi, WifiOff, AlertCircle, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import logoOtto from "@/assets/otto-logo2.svg"

interface StatusBarProps {
  isConnected: boolean
  version?: string
  permissionGranted: boolean
  error?: string | null
  onSettingsClick: () => void
  onHistoryClick: () => void
  className?: string
}

export function StatusBar({
  isConnected,
  version,
  permissionGranted,
  error,
  onSettingsClick,
  onHistoryClick,
  className,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 relative",
        "border-b border-slate-6 bg-slate-2",
        className
      )}
    >
      {/* Center: Otto logo */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <img src={logoOtto} alt="Otto" className="h-5 w-5" />
      </div>

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
