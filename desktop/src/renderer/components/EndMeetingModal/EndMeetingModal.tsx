import { useState, useCallback } from "react"
import { Copy, Check, Minimize2, Save, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StreamingText } from "./StreamingText"
import { cn } from "@/lib/utils"

type TabId = "raw" | "enhanced" | "transcript"

interface Tab {
  id: TabId
  label: string
}

const tabs: Tab[] = [
  { id: "raw", label: "Raw Notes" },
  { id: "enhanced", label: "Enhanced Notes" },
  { id: "transcript", label: "Transcript" },
]

interface EndMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawNotes: string
  transcript: string
  enhancedNotes: string
  isEnhancing: boolean
  enhancementError: string | null
  onEnhance: () => void
  onBackground: () => void
  onSave: () => void
  onDiscard: () => void
}

export function EndMeetingModal({
  open,
  onOpenChange,
  rawNotes,
  transcript,
  enhancedNotes,
  isEnhancing,
  enhancementError,
  onEnhance,
  onBackground,
  onSave,
  onDiscard,
}: EndMeetingModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("enhanced")
  const [copied, setCopied] = useState(false)

  // Get content for current tab
  const getTabContent = useCallback(() => {
    switch (activeTab) {
      case "raw":
        return rawNotes
      case "enhanced":
        return enhancedNotes
      case "transcript":
        return transcript
      default:
        return ""
    }
  }, [activeTab, rawNotes, enhancedNotes, transcript])

  // Copy current tab content
  const handleCopy = useCallback(async () => {
    const content = getTabContent()
    if (!content.trim()) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }, [getTabContent])

  // Handle escape key - background instead of close
  const handleEscapeKeyDown = useCallback(() => {
    onBackground()
    return true // Prevent default close behavior
  }, [onBackground])

  // Get empty message for each tab
  const getEmptyMessage = () => {
    switch (activeTab) {
      case "raw":
        return "No notes were taken during this meeting"
      case "enhanced":
        return "No content available for enhancement"
      case "transcript":
        return "No transcript available"
      default:
        return "No content available"
    }
  }

  const currentContent = getTabContent()
  const canCopy = currentContent.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Meeting Summary</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                "border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-primary-9 text-primary-11"
                  : "border-transparent text-slate-11 hover:text-slate-12 hover:border-slate-7"
              )}
            >
              {tab.label}
              {tab.id === "enhanced" && isEnhancing && (
                <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary-9 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden py-4">
          {activeTab === "enhanced" ? (
            <StreamingText
              content={enhancedNotes}
              isStreaming={isEnhancing}
              error={enhancementError}
              emptyMessage={getEmptyMessage()}
              onRetry={onEnhance}
            />
          ) : (
            <div
              className={cn(
                "rounded-md border border-slate-6 bg-slate-2 p-4 min-h-[200px] max-h-[400px] overflow-y-auto",
                "text-sm text-slate-12 whitespace-pre-wrap"
              )}
            >
              {currentContent.trim() ? (
                currentContent
              ) : (
                <span className="text-slate-9">{getEmptyMessage()}</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {/* Left side actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!canCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onBackground}>
              <Minimize2 className="mr-2 h-4 w-4" />
              Background
            </Button>
          </div>

          {/* Right side actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDiscard}>
              <Trash2 className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="mr-2 h-4 w-4" />
              Save & Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
