import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { settingsStyles } from "./styles"

interface SettingsFieldProps {
  label: string
  htmlFor?: string
  helpText?: string
  children: React.ReactNode
  className?: string
}

export function SettingsField({
  label,
  htmlFor,
  helpText,
  children,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn(settingsStyles.field, className)}>
      <Label htmlFor={htmlFor} className={settingsStyles.fieldLabel}>
        {label}
      </Label>
      {children}
      {helpText && <p className={settingsStyles.fieldHelp}>{helpText}</p>}
    </div>
  )
}
