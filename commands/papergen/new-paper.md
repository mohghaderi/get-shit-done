---
name: papergen:new-paper
description: Initialize a prose-first research-paper workspace and produce a publishable single-file manuscript with citations, tables, diagrams, and images
argument-hint: "<topic>"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
  - WebSearch
---
<objective>
Create a publishable research-paper repository structure and populate it with evidence-driven section drafts.

**Creates:**
- `paper/PAPER.md` — manuscript assembly entrypoint
- `paper/sections/` — nested section markdown files
- `paper/sources/SOURCE-LOG.md` — claim-to-source ledger
- `paper/figures/*.puml` — PlantUML diagrams
- `paper/images/IMAGE-SOURCES.md` — image provenance and licensing notes

**Outcome requirements:**
- Manuscript sections must be narrative prose, not checklist-style markdown.
- Source IDs used in text must resolve in `paper/sources/SOURCE-LOG.md`.
- Final publishable artifact must be built with `node ~/.claude/scripts/gen-docs.js paper .tmp/paper.md` (optionally `--pdf`).
</objective>

<execution_context>
@~/.claude/get-paper-done/workflows/new-paper.md
@~/.claude/get-paper-done/templates/paper-project/PAPER.md
@~/.claude/get-paper-done/templates/paper-project/SECTION.md
@~/.claude/get-paper-done/templates/paper-project/SOURCE-LOG.md
@~/.claude/get-paper-done/templates/paper-project/IMAGE-SOURCES.md
@~/.claude/get-paper-done/references/scientific-rigor-checklist.md
</execution_context>

<process>
Execute the new-paper workflow from @~/.claude/get-paper-done/workflows/new-paper.md end-to-end.
</process>
