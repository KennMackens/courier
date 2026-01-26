import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Base styles
          "flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm",
          // Border: hairline with subtle color
          "border border-slate-6",
          // Background
          "bg-background",
          // Placeholder
          "placeholder:text-slate-9",
          // Focus: ring with primary color
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-7 focus-visible:border-primary-7",
          // Hover state
          "hover:border-slate-7",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-2",
          // Resize behavior
          "resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
