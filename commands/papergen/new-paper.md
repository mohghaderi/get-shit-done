---
name: papergen:new-paper
description: Initialize a research-paper workspace with nested markdown sections, citations, diagrams, and image sourcing
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
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/new-paper.md
@~/.claude/get-shit-done/templates/paper-project/PAPER.md
@~/.claude/get-shit-done/templates/paper-project/SECTION.md
@~/.claude/get-shit-done/templates/paper-project/SOURCE-LOG.md
@~/.claude/get-shit-done/templates/paper-project/IMAGE-SOURCES.md
@~/.claude/get-shit-done/references/scientific-rigor-checklist.md
</execution_context>

<process>
Execute the new-paper workflow from @~/.claude/get-shit-done/workflows/new-paper.md end-to-end.
</process>
