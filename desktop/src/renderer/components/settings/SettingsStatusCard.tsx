import * as React from "react"
import { cn } from "@/lib/utils"

export type SettingsStatusTone = "ready" | "warning" | "critical" | "neutral" | "accent"

interface SettingsStatusCardProps {
  title: string
  description?: string
  tone?: SettingsStatusTone
  icon?: React.ReactNode
  badgeLabel?: string
  badgePlacement?: "inline" | "below-title"
  action?: React.ReactNode
  className?: string
}

const toneClasses: Record<
  SettingsStatusTone,
  {
    container: string
    stripe: string
    iconBg: string
    title: string
    badge: string
  }
> = {
  ready: {
    container: "bg-white border-slate-6 dark:bg-black",
    stripe: "bg-jade-9",
    iconBg: "",
    title: "text-jade-12",
    badge: "text-jade-11 border-jade-7 bg-jade-3",
  },
  warning: {
    container: "bg-white border-amber-7 dark:bg-black",
    stripe: "bg-amber-9",
    iconBg: "bg-amber-4",
    title: "text-amber-12",
    badge: "text-red-11 border-red-6 bg-red-3",
  },
  critical: {
    container: "bg-white border-red-7 dark:bg-black",
    stripe: "bg-red-9",
    iconBg: "bg-red-4",
    title: "text-red-12",
    badge: "text-red-11 border-red-6 bg-red-3",
  },
  neutral: {
    container: "bg-white border-slate-6 dark:bg-black",
    stripe: "bg-slate-8",
    iconBg: "bg-slate-4",
    title: "text-slate-12",
    badge: "text-slate-11 border-slate-7 bg-slate-3",
  },
  accent: {
    container: "bg-white border-pink-6 dark:bg-black",
    stripe: "bg-pink-9",
    iconBg: "bg-pink-4/60",
    title: "text-pink-12",
    badge: "text-pink-11 border-pink-7 bg-pink-3",
  },
}

export function SettingsStatusCard({
  title,
  description,
  tone = "neutral",
  icon,
  badgeLabel,
  badgePlacement = "inline",
  action,
  className,
}: SettingsStatusCardProps) {
  const classes = toneClasses[tone]

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
        classes.container,
        className
      )}
    >
      <span className={cn("absolute left-0 top-0 h-full w-1", classes.stripe)} />

      <div className="flex min-w-0 flex-1 items-center gap-3 pl-2">
        {icon ? (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", classes.iconBg)}>
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-semibold", classes.title)}>{title}</p>
            {badgeLabel && badgePlacement === "inline" ? (
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px]", classes.badge)}>
                {badgeLabel}
              </span>
            ) : null}
          </div>
          {badgeLabel && badgePlacement === "below-title" ? (
            <div className="mt-1">
              <span className={cn("inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px]", classes.badge)}>
                {badgeLabel}
              </span>
            </div>
          ) : null}
          {description ? <p className="text-xs text-slate-11">{description}</p> : null}
        </div>
      </div>

      {action ? <div className="relative z-10 w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  )
}
