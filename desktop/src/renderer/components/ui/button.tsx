import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        // Solid primary button: Jade background with jade text
        default: "bg-primary-5 text-primary-12 hover:bg-primary-6 active:bg-primary-7",
        // Destructive: Red solid button
        destructive: "bg-red-9 text-white hover:bg-red-10 active:bg-red-11",
        // Outline: Jade border and text with subtle jade hover background
        outline:
          "border border-primary-7 bg-transparent text-primary-11 hover:bg-primary-3 hover:border-primary-8 active:bg-primary-4",
        // Secondary: Subtle gray background
        secondary: "bg-slate-3 text-slate-12 hover:bg-slate-4 active:bg-slate-5",
        // Ghost: No background, subtle hover
        ghost: "text-slate-12 hover:bg-slate-3 active:bg-slate-4",
        // Link: Text only, primary color, underline on hover
        link: "text-primary-11 underline-offset-4 hover:underline hover:text-primary-10",
        // Accent: Pink solid button for highlights
        accent: "bg-accent-5 text-accent-12 hover:bg-accent-6 active:bg-accent-7",
      },
      size: {
        default: "h-10 px-4 py-2",
        md: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
