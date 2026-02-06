---
name: linear-ticket
description: Develop an existing Linear ticket into a complete, development-ready specification through interactive refinement. Use when a user wants to flesh out a Linear issue before development, refine requirements, define acceptance criteria, or prepare a ticket for implementation.
---

# Linear Ticket

## Overview

Turn a Linear issue into a development-ready specification by reviewing the current ticket, finding gaps, asking targeted questions, and producing a structured description that engineers can implement without extra context.

## Workflow

1. Confirm ticket identity.
- Ask for the Linear ticket ID or identifier (e.g., `ENG-123`) if not provided.

2. Fetch and summarize the ticket.
- Use Linear MCP tools to fetch the issue.
- Show current title, description, status, assignee, labels, and any links/attachments.
- Avoid paraphrasing beyond a brief summary; keep it grounded in the ticket text.

3. Gap analysis.
- Evaluate whether the ticket is development-ready.
- Check for missing or unclear:
  - Problem/context and user impact
  - Scope boundaries and non-goals
  - Acceptance criteria (testable)
  - Technical approach and constraints
  - Edge cases and error handling
  - Dependencies, blockers, and related issues
  - Testing strategy

4. Interactive refinement.
- Ask targeted questions to fill the highest-impact gaps first.
- Do not dump all questions at once; proceed iteratively.
- If the user does not know an answer, record it as an open question.

5. Draft the enhanced description.
- Produce a structured spec using the template in “Enhanced Description Template.”
- Keep the writing concise and testable.
- Capture unresolved items under “Open Questions.”

6. Confirm and update.
- Show the proposed description and ask for confirmation.
- On approval, update the Linear ticket description.
- Move the ticket to the `refined` group/status (or ask for the correct status name if unknown).
- Provide the ticket URL after update.

## Enhanced Description Template

Use this structure in the final ticket description:

**Problem/Context**
- Why we’re building this
- User impact and business value

**Solution**
- What we’re building
- Key functionality

**Technical Approach**
- How we’ll build it
- Architecture decisions
- Libraries/tools to use

**Acceptance Criteria**
- Clear, testable criteria
- Each criterion must be verifiable

**Edge Cases & Considerations**
- Known scenarios to handle
- Error states
- Performance considerations

**Dependencies**
- Related tickets or prerequisites
- External dependencies

**Open Questions**
- Anything still unresolved (if any)

## Tooling Notes

- Prefer Linear MCP tools for reading and updating issues.
- If the status group `refined` is not available, ask the user which status to use.
- Do not assume requirements; always confirm or record as open questions.
