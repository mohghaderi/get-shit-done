# GSD User Guide

A detailed reference for workflows, troubleshooting, and configuration. For quick-start setup, see the [README](../README.md).

---

## Table of Contents

- [Workflow Diagrams](#workflow-diagrams)
- [Command Reference](#command-reference)
- [Configuration Reference](#configuration-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Recovery Quick Reference](#recovery-quick-reference)

---

## Workflow Diagrams

### Full Project Lifecycle

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /papergen:new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /papergen:discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /papergen:plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /papergen:execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /papergen:verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /papergen:audit-milestone        │
            │  /papergen:complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /papergen:new-milestone  │
               └──────────────────────┘
```

### Planning Agent Coordination

```
  /papergen:plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### Validation Architecture (Nyquist Layer)

During plan-phase research, GSD now maps automated test coverage to each phase
requirement before any code is written. This ensures that when Claude's executor
commits a task, a feedback mechanism already exists to verify it within seconds.

The researcher detects your existing test infrastructure, maps each requirement to
a specific test command, and identifies any test scaffolding that must be created
before implementation begins (Wave 0 tasks).

The plan-checker enforces this as an 8th verification dimension: plans where tasks
lack automated verify commands will not be approved.

**Output:** `{phase}-VALIDATION.md` -- the feedback contract for the phase.

**Disable:** Set `workflow.nyquist_validation: false` in `/papergen:settings` for
rapid prototyping phases where test infrastructure isn't the focus.

### Execution Wave Coordination

```
  /papergen:execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               └── Check codebase against phase goals
                     │
                     ├── PASS -> VERIFICATION.md (success)
                     └── FAIL -> Issues logged for /papergen:verify-work
```

### Brownfield Workflow (Existing Codebase)

```
  /papergen:map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /papergen:new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## Command Reference

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/papergen:new-project` | Full project init: questions, research, requirements, roadmap | Start of a new project |
| `/papergen:new-project --auto @idea.md` | Automated init from document | Have a PRD or idea doc ready |
| `/papergen:discuss-phase [N]` | Capture implementation decisions | Before planning, to shape how it gets built |
| `/papergen:plan-phase [N]` | Research + plan + verify | Before executing a phase |
| `/papergen:execute-phase <N>` | Execute all plans in parallel waves | After planning is complete |
| `/papergen:verify-work [N]` | Manual UAT with auto-diagnosis | After execution completes |
| `/papergen:audit-milestone` | Verify milestone met its definition of done | Before completing milestone |
| `/papergen:complete-milestone` | Archive milestone, tag release | All phases verified |
| `/papergen:new-milestone [name]` | Start next version cycle | After completing a milestone |

### Navigation

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/papergen:progress` | Show status and next steps | Anytime -- "where am I?" |
| `/papergen:resume-work` | Restore full context from last session | Starting a new session |
| `/papergen:pause-work` | Save context handoff | Stopping mid-phase |
| `/papergen:help` | Show all commands | Quick reference |
| `/papergen:update` | Update GSD with changelog preview | Check for new versions |
| `/papergen:join-discord` | Open Discord community invite | Questions or community |

### Phase Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/papergen:add-phase` | Append new phase to roadmap | Scope grows after initial planning |
| `/papergen:insert-phase [N]` | Insert urgent work (decimal numbering) | Urgent fix mid-milestone |
| `/papergen:remove-phase [N]` | Remove future phase and renumber | Descoping a feature |
| `/papergen:list-phase-assumptions [N]` | Preview Claude's intended approach | Before planning, to validate direction |
| `/papergen:plan-milestone-gaps` | Create phases for audit gaps | After audit finds missing items |
| `/papergen:research-phase [N]` | Deep ecosystem research only | Complex or unfamiliar domain |

### Brownfield & Utilities

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/papergen:map-codebase` | Analyze existing codebase | Before `/papergen:new-project` on existing code |
| `/papergen:quick` | Ad-hoc task with GSD guarantees | Bug fixes, small features, config changes |
| `/papergen:debug [desc]` | Systematic debugging with persistent state | When something breaks |
| `/papergen:add-todo [desc]` | Capture an idea for later | Think of something during a session |
| `/papergen:check-todos` | List pending todos | Review captured ideas |
| `/papergen:settings` | Configure workflow toggles and model profile | Change model, toggle agents |
| `/papergen:set-profile <profile>` | Quick profile switch | Change cost/quality tradeoff |
| `/papergen:reapply-patches` | Restore local modifications after update | After `/papergen:update` if you had local edits |

---

## Configuration Reference

GSD stores project settings in `.planning/config.json`. Configure during `/papergen:new-project` or update later with `/papergen:settings`.

### Full config.json paper structure

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  }
}
```

### Core Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness: 3-5, 5-8, or 8-12 phases |
| `model_profile` | `quality`, `balanced`, `budget` | `balanced` | Model tier for each agent (see table below) |

### Planning Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `planning.commit_docs` | `true`, `false` | `true` | Whether `.planning/` files are committed to git |
| `planning.search_gitignored` | `true`, `false` | `false` | Add `--no-ignore` to broad searches to include `.planning/` |

> **Note:** If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of the config value.

### Workflow Toggles

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `workflow.research` | `true`, `false` | `true` | Domain investigation before planning |
| `workflow.plan_check` | `true`, `false` | `true` | Plan verification loop (up to 3 iterations) |
| `workflow.verifier` | `true`, `false` | `true` | Post-execution verification against phase goals |
| `workflow.nyquist_validation` | `true`, `false` | `true` | Validation architecture research during plan-phase; 8th plan-check dimension |

Disable these to speed up phases in familiar domains or when conserving tokens.

### Git Branching

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | When and how branches are created |
| `git.phase_branch_template` | Template string | `gsd/phase-{phase}-{slug}` | Branch name for phase strategy |
| `git.milestone_branch_template` | Template string | `gsd/{milestone}-{slug}` | Branch name for milestone strategy |

**Branching strategies explained:**

| Strategy | Creates Branch | Scope | Best For |
|----------|---------------|-------|----------|
| `none` | Never | N/A | Solo development, simple projects |
| `phase` | At each `execute-phase` | One phase per branch | Code review per phase, granular rollback |
| `milestone` | At first `execute-phase` | All phases share one branch | Release branches, PR per version |

**Template variables:** `{phase}` = zero-padded number (e.g., "03"), `{slug}` = lowercase hyphenated name, `{milestone}` = version (e.g., "v1.0").

### Model Profiles (Per-Agent Breakdown)

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| papergen-planner | Opus | Opus | Sonnet |
| papergen-roadmapper | Opus | Sonnet | Sonnet |
| papergen-executor | Opus | Sonnet | Sonnet |
| papergen-phase-researcher | Opus | Sonnet | Haiku |
| papergen-project-researcher | Opus | Sonnet | Haiku |
| papergen-research-synthesizer | Sonnet | Sonnet | Haiku |
| papergen-debugger | Opus | Sonnet | Sonnet |
| papergen-codebase-mapper | Sonnet | Haiku | Haiku |
| papergen-verifier | Sonnet | Sonnet | Haiku |
| papergen-plan-checker | Sonnet | Sonnet | Haiku |
| papergen-integration-checker | Sonnet | Sonnet | Haiku |

**Profile philosophy:**
- **quality** -- Opus for all decision-making agents, Sonnet for read-only verification. Use when quota is available and the work is critical.
- **balanced** -- Opus only for planning (where architecture decisions happen), Sonnet for everything else. The default for good reason.
- **budget** -- Sonnet for anything that writes code, Haiku for research and verification. Use for high-volume work or less critical phases.

---

## Usage Examples

### New Project (Full Cycle)

```bash
claude --dangerously-skip-permissions
/papergen:new-project            # Answer questions, configure, approve roadmap
/clear
/papergen:discuss-phase 1        # Lock in your preferences
/papergen:plan-phase 1           # Research + plan + verify
/papergen:execute-phase 1        # Parallel execution
/papergen:verify-work 1          # Manual UAT
/clear
/papergen:discuss-phase 2        # Repeat for each phase
...
/papergen:audit-milestone        # Check everything shipped
/papergen:complete-milestone     # Archive, tag, done
```

### New Project from Existing Document

```bash
/papergen:new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/papergen:discuss-phase 1               # Normal flow from here
```

### Existing Codebase

```bash
/papergen:map-codebase           # Analyze what exists (parallel agents)
/papergen:new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

### Quick Bug Fix

```bash
/papergen:quick
> "Fix the source access button not responding on mobile Safari"
```

### Resuming After a Break

```bash
/papergen:progress               # See where you left off and what's next
# or
/papergen:resume-work            # Full context restoration from last session
```

### Preparing for Release

```bash
/papergen:audit-milestone        # Check requirements coverage, detect stubs
/papergen:plan-milestone-gaps    # If audit found gaps, create phases to close them
/papergen:complete-milestone     # Archive, tag, done
```

### Speed vs Quality Presets

| Scenario | Mode | Depth | Profile | Research | Plan Check | Verifier |
|----------|------|-------|---------|----------|------------|----------|
| Prototyping | `yolo` | `quick` | `budget` | off | off | off |
| Normal dev | `interactive` | `standard` | `balanced` | on | on | on |
| Production | `interactive` | `comprehensive` | `quality` | on | on | on |

### Mid-Milestone Scope Changes

```bash
/papergen:add-phase              # Append a new phase to the roadmap
# or
/papergen:insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/papergen:remove-phase 7         # Descope phase 7 and renumber
```

---

## Troubleshooting

### "Project already initialized"

You ran `/papergen:new-project` but `.planning/PROJECT.md` already exists. This is a safety check. If you want to start over, delete the `.planning/` directory first.

### Context Degradation During Long Sessions

Clear your context window between major commands: `/clear` in Claude Code. GSD is designed around fresh contexts -- every subagent gets a clean 200K window. If quality is dropping in the main session, clear and use `/papergen:resume-work` or `/papergen:progress` to restore state.

### Plans Seem Wrong or Misaligned

Run `/papergen:discuss-phase [N]` before planning. Most plan quality issues come from Claude making assumptions that `CONTEXT.md` would have prevented. You can also run `/papergen:list-phase-assumptions [N]` to see what Claude intends to do before committing to a plan.

### Execution Fails or Produces Stubs

Check that the plan was not too ambitious. Plans should have 2-3 tasks maximum. If tasks are too large, they exceed what a single context window can produce reliably. Re-plan with smaller scope.

### Lost Track of Where You Are

Run `/papergen:progress`. It reads all state files and tells you exactly where you are and what to do next.

### Need to Change Something After Execution

Do not re-run `/papergen:execute-phase`. Use `/papergen:quick` for targeted fixes, or `/papergen:verify-work` to systematically identify and fix issues through UAT.

### Model Costs Too High

Switch to budget profile: `/papergen:set-profile budget`. Disable research and plan-check agents via `/papergen:settings` if the domain is familiar to you (or to Claude).

### Working on a Sensitive/Private Project

Set `commit_docs: false` during `/papergen:new-project` or via `/papergen:settings`. Add `.planning/` to your `.gitignore`. Planning artifacts stay local and never touch git.

### GSD Update Overwrote My Local Changes

Since v1.17, the installer backs up locally modified files to `gsd-local-patches/`. Run `/papergen:reapply-patches` to merge your changes back.

### Subagent Appears to Fail but Work Was Done

A known workaround exists for a Claude Code classification bug. GSD's orchestrators (execute-phase, quick) spot-check actual output before reporting failure. If you see a failure message but commits were made, check `git log` -- the work may have succeeded.

---

## Recovery Quick Reference

| Problem | Solution |
|---------|----------|
| Lost context / new session | `/papergen:resume-work` or `/papergen:progress` |
| Phase went wrong | `git revert` the phase commits, then re-plan |
| Need to change scope | `/papergen:add-phase`, `/papergen:insert-phase`, or `/papergen:remove-phase` |
| Milestone audit found gaps | `/papergen:plan-milestone-gaps` |
| Something broke | `/papergen:debug "description"` |
| Quick targeted fix | `/papergen:quick` |
| Plan doesn't match your vision | `/papergen:discuss-phase [N]` then re-plan |
| Costs running high | `/papergen:set-profile budget` and `/papergen:settings` to toggle agents off |
| Update broke local changes | `/papergen:reapply-patches` |

---

## Project File Structure

For reference, here is what GSD creates in your project:

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  research/               # Domain research from /papergen:new-project
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  codebase/               # Brownfield codebase mapping (from /papergen:map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
```
