<purpose>
Create all phases necessary to close gaps identified by `/papergen:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. One command creates all fix phases — no manual `/papergen:add-phase` per gap.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Load Audit Results

```bash
# Find the most recent audit file
ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1
```

Parse YAML frontmatter to extract structured gaps:
- `gaps.requirements` — unsatisfied requirements
- `gaps.integration` — missing cross-phase connections
- `gaps.flows` — broken E2E flows

If no audit file exists or has no gaps, error:
```
No audit gaps found. Run `/papergen:audit-milestone` first.
```

## 2. Prioritize Gaps

Group gaps by priority from REQUIREMENTS.md:

| Priority | Action |
|----------|--------|
| `must` | Create phase, blocks milestone |
| `should` | Create phase, recommended |
| `nice` | Ask user: include or defer? |

For integration/flow gaps, infer priority from affected requirements.

## 3. Group Gaps into Phases

Cluster related gaps into logical phases:

**Grouping rules:**
- Same affected phase → combine into one fix phase
- Same subsystem (citation, evidence interface, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

**Example grouping:**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Phase 1→3 (citation not passed to evidence interface calls)
Gap: Flow "View dashboard" broken at data fetch

→ Phase 6: "Wire Dashboard to evidence interface"
  - Add fetch to paper/sections/04-results/01-main-findings.md
  - Include citation header in fetch
  - Handle response, update state
  - Render user data
```

## 4. Determine Phase Numbers

Find highest existing phase:
```bash
# Get sorted phase list, extract last one
PHASES=$(node ~/.claude/get-shit-done/bin/papergen-tools.cjs phases list)
HIGHEST=$(echo "$PHASES" | jq -r '.directories[-1]')
```

New phases continue from there:
- If Phase 5 is highest, gaps become Phase 6, 7, 8...

## 5. Present Gap Closure Plan

```markdown
## Gap Closure Plan

**Milestone:** {version}
**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}
Tasks: {count}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}
- Flow: {flow name}
Tasks: {count}

{If nice-to-have gaps exist:}

### Deferred (nice-to-have)

These gaps are optional. Include them?
- {gap description}
- {gap description}

---

Create these {X} phases? (yes / adjust / defer all optional)
```

Wait for user confirmation.

## 6. Update ROADMAP.md

Add new phases to current milestone:

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps being closed}
**Requirements:** {REQ-IDs being satisfied}
**Gap Closure:** Closes gaps from audit

### Phase {N+1}: {Name}
...
```

## 7. Update REQUIREMENTS.md Traceability Table (REQUIRED)

For each REQ-ID assigned to a gap closure phase:
- Update the Phase column to reflect the new gap closure phase
- Reset Status to `Pending`

Reset checked-off requirements the audit found unsatisfied:
- Change `[x]` → `[ ]` for any requirement marked unsatisfied in the audit
- Update coverage count at top of REQUIREMENTS.md

```bash
# Verify traceability table reflects gap closure assignments
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. Create Phase Directories

```bash
mkdir -p ".planning/phases/{NN}-{name}"
```

## 9. Commit Roadmap and Requirements Update

```bash
node ~/.claude/get-shit-done/bin/papergen-tools.cjs commit "docs(roadmap): add gap closure phases {N}-{M}" --files .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. Offer Next Steps

```markdown
## ✓ Gap Closure Phases Created

**Phases added:** {N} - {M}
**Gaps addressed:** {count} requirements, {count} integration, {count} flows

---

## ▶ Next Up

**Plan first gap closure phase**

`/papergen:plan-phase {N}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/papergen:execute-phase {N}` — if plans already exist
- `cat .planning/ROADMAP.md` — see updated roadmap

---

**After all gap phases complete:**

`/papergen:audit-milestone` — re-audit to verify gaps closed
`/papergen:complete-milestone {version}` — archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

**Requirement gap → Tasks:**
```yaml
gap:
  id: DASH-01
  description: "User sees their data"
  reason: "Dashboard exists but doesn't fetch from evidence interface"
  missing:
    - "useEffect with fetch to /evidence interface/user/data"
    - "State for user data"
    - "Render user data in JSX"

becomes:

phase: "Wire Dashboard Data"
tasks:
  - name: "Add data fetching"
    files: [paper/components/paper/sections/04-results/01-main-findings.md]
    action: "Add useEffect that fetches /evidence interface/user/data on mount"

  - name: "Add state management"
    files: [paper/components/paper/sections/04-results/01-main-findings.md]
    action: "Add useState for userData, loading, error states"

  - name: "Render user data"
    files: [paper/components/paper/sections/04-results/01-main-findings.md]
    action: "Replace placeholder with userData.map rendering"
```

**Integration gap → Tasks:**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "citation token → evidence interface calls"
  reason: "Dashboard evidence interface calls don't include citation header"
  missing:
    - "citation header in fetch calls"
    - "Token refresh on 401"

becomes:

phase: "Add citation to Dashboard evidence interface Calls"
tasks:
  - name: "Add citation header to fetches"
    files: [paper/components/paper/sections/04-results/01-main-findings.md, paper/lib/evidence interface.ts]
    action: "Include Authorization header with token in all evidence interface calls"

  - name: "Handle 401 responses"
    files: [paper/lib/evidence interface.ts]
    action: "Add interceptor to refresh token or redirect to source access on 401"
```

**Flow gap → Tasks:**
```yaml
gap:
  name: "User views dashboard after source access"
  broken_at: "Dashboard data load"
  reason: "No fetch call"
  missing:
    - "Fetch user data on mount"
    - "Display loading state"
    - "Render user data"

becomes:

# Usually same phase as requirement/integration gap
# Flow gaps often overlap with other gap types
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md loaded and gaps parsed
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical phases
- [ ] User confirmed phase plan
- [ ] ROADMAP.md updated with new phases
- [ ] REQUIREMENTS.md traceability table updated with gap closure phase assignments
- [ ] Unsatisfied requirement checkboxes reset (`[x]` → `[ ]`)
- [ ] Coverage count updated in REQUIREMENTS.md
- [ ] Phase directories created
- [ ] Changes committed (includes REQUIREMENTS.md)
- [ ] User knows to run `/papergen:plan-phase` next
</success_criteria>
