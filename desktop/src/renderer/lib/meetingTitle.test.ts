import { describe, expect, it } from "vitest"
import {
  formatMeetingTitle,
  normalizeMeetingTitle,
  resolveMeetingTitle,
  stripFirstMatchingH1ForRender,
  syncMarkdownTitle,
} from "./meetingTitle"

describe("meetingTitle helpers", () => {
  it("normalizes markdown heading prefixes and trims title", () => {
    expect(normalizeMeetingTitle("   ##   Project Kickoff   ")).toBe("Project Kickoff")
  })

  it("collapses internal whitespace in normalized title", () => {
    expect(normalizeMeetingTitle("Project    Kickoff\tPlan")).toBe("Project Kickoff Plan")
  })

  it("clamps title to 100 chars", () => {
    const long = "a".repeat(130)
    expect(normalizeMeetingTitle(long)).toHaveLength(100)
  })

  it("resolves empty titles to generated fallback", () => {
    const fallback = resolveMeetingTitle("   ", new Date("2026-02-11T10:30:00.000Z"))
    expect(fallback.startsWith("Meeting - ")).toBe(true)
  })

  it("formats fallback meeting title", () => {
    const title = formatMeetingTitle(new Date("2026-02-11T10:30:00.000Z"))
    expect(title.startsWith("Meeting - ")).toBe(true)
  })

  it("replaces existing first-line H1 when syncing markdown title", () => {
    const synced = syncMarkdownTitle("# Old Title\n\nBody line", "New Title")
    expect(synced).toBe("# New Title\n\nBody line")
  })

  it("prepends H1 when no first-line H1 exists", () => {
    const synced = syncMarkdownTitle("Body line", "New Title")
    expect(synced).toBe("# New Title\n\nBody line")
  })

  it("hides matching first H1 for render", () => {
    const rendered = stripFirstMatchingH1ForRender("# Sprint Review\n\n- item", "Sprint Review")
    expect(rendered).toBe("- item")
  })

  it("hides matching H1 even with heading whitespace differences", () => {
    const rendered = stripFirstMatchingH1ForRender("#   Sprint   Review  \n\nBody", "Sprint Review")
    expect(rendered).toBe("Body")
  })

  it("keeps content unchanged when first H1 does not match title", () => {
    const original = "# Another Title\n\nBody"
    const rendered = stripFirstMatchingH1ForRender(original, "Sprint Review")
    expect(rendered).toBe(original)
  })
})
