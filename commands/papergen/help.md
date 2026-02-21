---
name: papergen:help
description: Show available GPD commands and usage guide
---
<objective>
Display the complete GPD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@~/.claude/get-paper-done/workflows/help.md
</execution_context>

<process>
Output the complete GPD command reference from @~/.claude/get-paper-done/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
