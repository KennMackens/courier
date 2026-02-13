const TITLE_MAX_LENGTH = 100

export function formatMeetingTitle(date: Date): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
  return `Meeting - ${safeDate.toLocaleString("en-US", options)}`
}

export function normalizeMeetingTitle(raw: string): string {
  return raw
    .replace(/^\s*#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX_LENGTH)
}

export function resolveMeetingTitle(raw: string, fallbackDate: Date): string {
  const normalized = normalizeMeetingTitle(raw)
  if (normalized) return normalized
  return formatMeetingTitle(fallbackDate)
}

function getFirstNonEmptyLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim()) return i
  }
  return -1
}

function buildH1(title: string): string {
  return `# ${title}`
}

export function syncMarkdownTitle(notes: string, title: string): string {
  const normalizedTitle = normalizeMeetingTitle(title)
  const safeTitle = normalizedTitle || title.trim()
  const lines = notes.replace(/\r\n/g, "\n").split("\n")
  const firstContentLineIndex = getFirstNonEmptyLineIndex(lines)
  const nextContent = lines.join("\n").trimStart()

  if (firstContentLineIndex !== -1 && lines[firstContentLineIndex].trim().startsWith("# ")) {
    lines[firstContentLineIndex] = buildH1(safeTitle)
    return lines.join("\n")
  }

  if (!nextContent) {
    return buildH1(safeTitle)
  }

  return `${buildH1(safeTitle)}\n\n${nextContent}`
}

export function stripFirstMatchingH1ForRender(notes: string, title: string): string {
  const safeTitle = normalizeMeetingTitle(title)
  if (!safeTitle) return notes

  const normalized = notes.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")
  const firstContentLineIndex = getFirstNonEmptyLineIndex(lines)
  if (firstContentLineIndex === -1) return notes

  const firstContentLine = lines[firstContentLineIndex]
  const isH1 = /^\s*#\s+/.test(firstContentLine)
  if (!isH1) {
    return notes
  }

  const headingText = normalizeMeetingTitle(firstContentLine)
  if (headingText !== safeTitle) {
    return notes
  }

  const remaining = [...lines.slice(0, firstContentLineIndex), ...lines.slice(firstContentLineIndex + 1)]

  if (firstContentLineIndex < remaining.length && !remaining[firstContentLineIndex]?.trim()) {
    remaining.splice(firstContentLineIndex, 1)
  }

  return remaining.join("\n")
}
