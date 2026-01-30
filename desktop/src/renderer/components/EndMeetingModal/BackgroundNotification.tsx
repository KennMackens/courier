import { Sparkles, Check, AlertCircle } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface BackgroundNotificationProps {
  visible: boolean
  isEnhancing: boolean
  isComplete: boolean
  hasError: boolean
  onClick: () => void
}

export function BackgroundNotification({
  visible,
  isEnhancing,
  isComplete,
  hasError,
  onClick,
}: BackgroundNotificationProps) {
  if (!visible) return null

  const getStatusIcon = () => {
    if (isEnhancing) {
      return <Spinner size="sm" className="text-primary-11" />
    }
    if (hasError) {
      return <AlertCircle className="h-4 w-4 text-red-11" />
    }
    if (isComplete) {
      return <Check className="h-4 w-4 text-primary-11" />
    }
    return <Sparkles className="h-4 w-4 text-primary-11" />
  }

  const getStatusText = () => {
    if (isEnhancing) return "Enhancing notes..."
    if (hasError) return "Enhancement failed"
    if (isComplete) return "Notes ready"
    return "Processing..."
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-lg",
        "bg-slate-2 border border-slate-6 shadow-lg",
        "hover:bg-slate-3 hover:border-slate-7",
        "transition-all duration-200",
        "cursor-pointer select-none",
        "animate-in slide-in-from-bottom-4 fade-in duration-300"
      )}
    >
      {getStatusIcon()}
      <span className="text-sm font-medium text-slate-12">
        {getStatusText()}
      </span>
      <span className="text-xs text-slate-9">Click to view</span>
    </button>
  )
}
