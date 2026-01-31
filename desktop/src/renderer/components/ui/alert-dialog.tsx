import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn("max-w-md", className)}
    {...props}
  >
    {children}
  </DialogContent>
))
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = DialogHeader
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = DialogFooter
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = DialogTitle
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = DialogDescription
AlertDialogDescription.displayName = "AlertDialogDescription"

interface AlertDialogActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  AlertDialogActionProps
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    variant="default"
    className={className}
    {...props}
  >
    {children}
  </Button>
))
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  AlertDialogActionProps
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    className={className}
    {...props}
  >
    {children}
  </Button>
))
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
