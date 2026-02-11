import * as React from "react"
import { cn } from "@/lib/utils"
import { settingsStyles } from "./styles"

export interface SettingsTabOption<T extends string = string> {
  id: T
  label: string
}

interface SettingsTabNavProps<T extends string = string> {
  tabs: SettingsTabOption<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
}

export function SettingsTabNav<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
}: SettingsTabNavProps<T>) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const totalTabs = tabs.length
    if (totalTabs === 0) {
      return
    }

    const currentIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.id === activeTab)
    )

    let nextIndex: number | null = null

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % totalTabs
        break
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + totalTabs) % totalTabs
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = totalTabs - 1
        break
      default:
        break
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    onTabChange(nextTab.id)
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus())
  }

  return (
    <div className={settingsStyles.tabBar}>
      <div
        className={settingsStyles.tabList}
        role="tablist"
        aria-label="Settings sections"
        aria-orientation="horizontal"
        onKeyDown={handleTabKeyDown}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id
          const tabId = `settings-tab-${tab.id}`
          const panelId = `settings-panel-${tab.id}`

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              id={tabId}
              tabIndex={isActive ? 0 : -1}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                settingsStyles.tabButton,
                isActive ? settingsStyles.tabButtonActive : settingsStyles.tabButtonInactive
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
