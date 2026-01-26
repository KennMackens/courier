import { Sparkles } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface NotesEditorProps {
  notes: string
  onNotesChange: (notes: string) => void
  enhancedNotes: string
  isEnhancing: boolean
  onEnhanceNotes: () => void
  disabled?: boolean
  className?: string
}

export function NotesEditor({
  notes,
  onNotesChange,
  enhancedNotes,
  isEnhancing,
  onEnhanceNotes,
  disabled = false,
  className,
}: NotesEditorProps) {
  const canEnhance = notes.trim().length > 0 && !isEnhancing

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Notes input section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="notes" className="text-slate-12 font-medium">
            Notes
          </Label>
          <Button
            onClick={onEnhanceNotes}
            disabled={disabled || !canEnhance}
            variant="outline"
            size="sm"
          >
            {isEnhancing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enhance with AI
              </>
            )}
          </Button>
        </div>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Take notes during the meeting... These will be enhanced with the transcript context."
          disabled={disabled}
          rows={6}
          className="resize-y min-h-[120px]"
        />
      </div>

      {/* Enhanced notes output section */}
      {(enhancedNotes || isEnhancing) && (
        <div className="flex flex-col gap-2">
          <Label className="text-slate-12 font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-11" />
            Enhanced Notes
            {isEnhancing && (
              <span className="text-xs font-normal text-slate-9">
                (streaming...)
              </span>
            )}
          </Label>
          <div
            className={cn(
              "rounded-md border border-slate-6 bg-slate-2 p-4 min-h-[120px]",
              "text-sm text-slate-12 whitespace-pre-wrap",
              isEnhancing && "animate-pulse"
            )}
          >
            {enhancedNotes || (
              <span className="text-slate-9">
                Enhanced notes will appear here...
              </span>
            )}
            {isEnhancing && (
              <span className="inline-block w-2 h-4 bg-primary-9 animate-pulse ml-0.5" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
