import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, checked, defaultChecked, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false)
    const controlledChecked = checked ?? isChecked

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked
      setIsChecked(newChecked)
      onCheckedChange?.(newChecked)
    }

    return (
      <label
        className={cn(
          // Base styles
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          // Border
          "border-2 border-transparent",
          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-7 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Checked/unchecked background
          controlledChecked ? "bg-primary-9" : "bg-slate-6",
          className
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          checked={controlledChecked}
          onChange={handleChange}
          {...props}
        />
        <span
          className={cn(
            // Thumb base styles
            "pointer-events-none block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform",
            // Thumb background
            "bg-white",
            // Thumb position
            controlledChecked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
