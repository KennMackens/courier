import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface NotesEditorProps {
  notes: string
  onNotesChange: (notes: string) => void
  disabled?: boolean
  className?: string
}

export function NotesEditor({
  notes,
  onNotesChange,
  disabled = false,
  className,
}: NotesEditorProps) {
  return (
    <div className={cn("flex flex-col gap-2 flex-1 min-h-0", className)}>
      <Label htmlFor="notes" className="text-slate-12 font-medium shrink-0">
        Notes
      </Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Take notes during the meeting... These will be enhanced with the transcript context when you end the meeting."
        disabled={disabled}
        className="resize-none flex-1 min-h-0"
      />
    </div>
  )
}
