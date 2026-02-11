import * as React from "react"
import { cn } from "@/lib/utils"
import { settingsStyles } from "./styles"

interface SettingsSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: SettingsSectionProps) {
  return (
    <section className={cn(settingsStyles.section, className)}>
      {(title || description) && (
        <header className={settingsStyles.sectionHeader}>
          {title && <h3 className={settingsStyles.sectionTitle}>{title}</h3>}
          {description && <p className={settingsStyles.sectionDescription}>{description}</p>}
        </header>
      )}

      <div className={cn(settingsStyles.sectionContent, contentClassName)}>{children}</div>
    </section>
  )
}
