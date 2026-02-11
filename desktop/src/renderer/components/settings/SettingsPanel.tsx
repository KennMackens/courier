import * as React from "react"
import { cn } from "@/lib/utils"

interface SettingsPanelProps {
  tabId: string
  children: React.ReactNode
  className?: string
}

export function SettingsPanel({ tabId, children, className }: SettingsPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`settings-panel-${tabId}`}
      aria-labelledby={`settings-tab-${tabId}`}
      className={cn("space-y-6", className)}
    >
      {children}
    </div>
  )
}
