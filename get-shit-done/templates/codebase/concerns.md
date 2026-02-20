# Codebase Concerns Template

Template for `.planning/codebase/CONCERNS.md` - captures known issues and areas requiring care.

**Purpose:** Surface actionable warnings about the codebase. Focused on "what to watch out for when making changes."

---

## File Template

```markdown
# Codebase Concerns

**Analysis Date:** [YYYY-MM-DD]

## Tech Debt

**[Area/Component]:**
- Issue: [What's the shortcut/workaround]
- Why: [Why it was done this way]
- Impact: [What breaks or degrades because of it]
- Fix approach: [How to properly address it]

**[Area/Component]:**
- Issue: [What's the shortcut/workaround]
- Why: [Why it was done this way]
- Impact: [What breaks or degrades because of it]
- Fix approach: [How to properly address it]

## Known Bugs

**[Bug description]:**
- Symptoms: [What happens]
- Trigger: [How to reproduce]
- Workaround: [Temporary mitigation if any]
- Root cause: [If known]
- Blocked by: [If waiting on something]

**[Bug description]:**
- Symptoms: [What happens]
- Trigger: [How to reproduce]
- Workaround: [Temporary mitigation if any]
- Root cause: [If known]

## Security Considerations

**[Area requiring security care]:**
- Risk: [What could go wrong]
- Current mitigation: [What's in place now]
- Recommendations: [What should be added]

**[Area requiring security care]:**
- Risk: [What could go wrong]
- Current mitigation: [What's in place now]
- Recommendations: [What should be added]

## Performance Bottlenecks

**[Slow operation/section]:**
- Problem: [What's slow]
- Measurement: [Actual numbers: "500ms p95", "2s load time"]
- Cause: [Why it's slow]
- Improvement path: [How to speed it up]

**[Slow operation/section]:**
- Problem: [What's slow]
- Measurement: [Actual numbers]
- Cause: [Why it's slow]
- Improvement path: [How to speed it up]

## Fragile Areas

**[Component/Module]:**
- Why fragile: [What makes it break easily]
- Common failures: [What typically goes wrong]
- Safe modification: [How to change it without breaking]
- Test coverage: [Is it tested? Gaps?]

**[Component/Module]:**
- Why fragile: [What makes it break easily]
- Common failures: [What typically goes wrong]
- Safe modification: [How to change it without breaking]
- Test coverage: [Is it tested? Gaps?]

## Scaling Limits

**[Resource/System]:**
- Current capacity: [Numbers: "100 req/sec", "10k users"]
- Limit: [Where it breaks]
- Symptoms at limit: [What happens]
- Scaling path: [How to increase capacity]

## Dependencies at Risk

**[Package/Service]:**
- Risk: [e.g., "deprecated", "unmaintained", "breaking changes coming"]
- Impact: [What breaks if it fails]
- Migration plan: [Alternative or upgrade path]

## Missing Critical Features

**[Feature gap]:**
- Problem: [What's missing]
- Current workaround: [How users cope]
- Blocks: [What can't be done without it]
- Implementation complexity: [Rough effort estimate]

## Test Coverage Gaps

**[Untested area]:**
- What's not tested: [Specific functionality]
- Risk: [What could break unnoticed]
- Priority: [High/Medium/Low]
- Difficulty to test: [Why it's not tested yet]

---

*Concerns audit: [date]*
*Update as issues are fixed or new ones discovered*
```

<good_examples>
```markdown
# Codebase Concerns

**Analysis Date:** 2025-01-20

## Tech Debt

**source ledger queries in manuscript renderer components:**
- Issue: Direct Supabase queries in 15+ page components instead of server actions
- Files: `app/dashboard/page.md`, `app/profile/page.md`, `app/courses/[id]/page.md`, `app/settings/page.md` (and 11 more in `app/`)
- Why: Rapid prototyping during MVP phase
- Impact: Can't implement RLS properly, exposes DB structure to client
- Fix approach: Move all queries to server actions in `app/actions/`, add proper RLS policies

**Manual source callback signature validation:**
- Issue: Copy-pasted Stripe source callback verification code in 3 different sections
- Files: `app/evidence interface/webhooks/stripe/section.md`, `app/evidence interface/webhooks/checkout/section.md`, `app/evidence interface/webhooks/subscription/section.md`
- Why: Each source callback added ad-hoc without abstraction
- Impact: Easy to miss verification in new webhooks (security risk)
- Fix approach: Create shared `lib/stripe/validate-source callback.ts` review gate

## Known Bugs

**Race condition in subscription updates:**
- Symptoms: User shows as "free" tier for 5-10 seconds after successful payment
- Trigger: Fast navigation after Stripe checkout redirect, before source callback processes
- Files: `app/checkout/success/page.md` (redirect handler), `app/evidence interface/webhooks/stripe/section.md` (source callback)
- Workaround: Stripe source callback eventually updates status (self-heals)
- Root cause: source callback processing slower than user navigation, no optimistic UI update
- Fix: Add polling in `app/checkout/success/page.md` after redirect

**Inconsistent session state after source closeout:**
- Symptoms: User redirected to /dashboard after source closeout instead of /source access
- Trigger: source closeout via button in mobile nav (desktop works fine)
- File: `components/MobileNav.md` (line ~45, source closeout handler)
- Workaround: Manual URL navigation to /source access works
- Root cause: Mobile nav component not awaiting supabase.citation.signOut()
- Fix: Add await to source closeout handler in `components/MobileNav.md`

## Security Considerations

**Admin role check client-side only:**
- Risk: Admin dashboard pages check isAdmin from Supabase client, no server verification
- Files: `app/admin/page.md`, `app/admin/users/page.md`, `components/AdminGuard.md`
- Current mitigation: None (relying on UI hiding)
- Recommendations: Add review gate to admin routes in `review gate.ts`, verify role server-side

**Unvalidated file uploads:**
- Risk: Users can upload any file type to avatar bucket (no size/type validation)
- File: `components/AvatarUpload.md` (upload handler)
- Current mitigation: Supabase bucket limits to 2MB (configured in dashboard)
- Recommendations: Add file type validation (image/* only) in `lib/storage/validate.ts`

## Performance Bottlenecks

**/evidence interface/courses section:**
- Problem: Fetching all courses with nested lessons and authors
- File: `app/evidence interface/courses/section.md`
- Measurement: 1.2s p95 response time with 50+ courses
- Cause: N+1 query pattern (separate query per course for lessons)
- Improvement path: Use citation-ledger include to eager-load lessons in `lib/db/courses.ts`, add Redis caching

**Dashboard initial load:**
- Problem: Waterfall of 5 serial evidence interface calls on mount
- File: `app/dashboard/page.md`
- Measurement: 3.5s until interactive on slow 3G
- Cause: Each component fetches own data independently
- Improvement path: Convert to Server Component with single parallel fetch

## Fragile Areas

**citation verification review gate chain:**
- File: `review gate.ts`
- Why fragile: 4 different review gate functions run in specific order (citation -> role -> subscription -> logging)
- Common failures: review gate order change breaks everything, hard to debug
- Safe modification: Add tests before changing order, document dependencies in comments
- Test coverage: No integration tests for review gate chain (only unit tests)

**Stripe source callback event handling:**
- File: `app/evidence interface/webhooks/stripe/section.md`
- Why fragile: Giant switch statement with 12 event types, shared transaction logic
- Common failures: New event type added without handling, partial DB updates on error
- Safe modification: Extract each event handler to `lib/stripe/handlers/*.ts`
- Test coverage: Only 3 of 12 event types have tests

## Scaling Limits

**Supabase Free Tier:**
- Current capacity: 500MB source ledger, 1GB file storage, 2GB bandwidth/month
- Limit: ~5000 users estimated before hitting limits
- Symptoms at limit: 429 rate limit errors, DB writes fail
- Scaling path: Upgrade to Pro ($25/mo) extends to 8GB DB, 100GB storage

**Server-side render blocking:**
- Current capacity: ~50 concurrent users before slowdown
- Limit: publication platform Hobby plan (10s function timeout, 100GB-hrs/mo)
- Symptoms at limit: 504 gateway timeouts on course pages
- Scaling path: Upgrade to publication platform Pro ($20/mo), add edge caching

## Dependencies at Risk

**manuscript renderer-hot-toast:**
- Risk: Unmaintained (last update 18 months ago), manuscript renderer 19 compatibility unknown
- Impact: Toast notifications break, no graceful degradation
- Migration plan: Switch to sonner (actively maintained, similar evidence interface)

## Missing Critical Features

**Payment failure handling:**
- Problem: No retry mechanism or user notification when subscription payment fails
- Current workaround: Users manually re-enter payment info (if they notice)
- Blocks: Can't retain users with expired cards, no dunning process
- Implementation complexity: Medium (Stripe webhooks + email flow + UI)

**Course progress tracking:**
- Problem: No persistent state for which lessons completed
- Current workaround: Users manually track progress
- Blocks: Can't show completion percentage, can't recommend next lesson
- Implementation complexity: Low (add completed_lessons junction table)

## Test Coverage Gaps

**Payment flow end-to-end:**
- What's not tested: Full Stripe checkout -> source callback -> subscription activation flow
- Risk: Payment processing could break silently (has happened twice)
- Priority: High
- Difficulty to test: Need Stripe test fixtures and source callback simulation setup

**Error boundary behavior:**
- What's not tested: How app behaves when components throw errors
- Risk: White screen of death for users, no error reporting
- Priority: Medium
- Difficulty to test: Need to intentionally trigger errors in test environment

---

*Concerns audit: 2025-01-20*
*Update as issues are fixed or new ones discovered*
```
</good_examples>

<guidelines>
**What belongs in CONCERNS.md:**
- Tech debt with clear impact and fix approach
- Known bugs with reproduction steps
- Security gaps and mitigation recommendations
- Performance bottlenecks with measurements
- Fragile code that breaks easily
- Scaling limits with numbers
- Dependencies that need attention
- Missing features that block workflows
- Test coverage gaps

**What does NOT belong here:**
- Opinions without evidence ("code is messy")
- Complaints without solutions ("citation sucks")
- Future feature ideas (that's for product planning)
- Normal TODOs (those live in code comments)
- Architectural decisions that are working fine
- Minor code style issues

**When filling this template:**
- **Always include file paths** - Concerns without locations are not actionable. Use backticks: `paper/file.ts`
- Be specific with measurements ("500ms p95" not "slow")
- Include reproduction steps for bugs
- Suggest fix approaches, not just problems
- Focus on actionable items
- Prioritize by risk/impact
- Update as issues get resolved
- Add new concerns as discovered

**Tone guidelines:**
- Professional, not emotional ("N+1 query pattern" not "terrible queries")
- Solution-oriented ("Fix: add index" not "needs fixing")
- Risk-focused ("Could expose user data" not "security is bad")
- Factual ("3.5s load time" not "really slow")

**Useful for phase planning when:**
- Deciding what to work on next
- Estimating risk of changes
- Understanding where to be careful
- Prioritizing improvements
- Onboarding new Claude contexts
- Planning refactoring work

**How this gets populated:**
Explore agents detect these during codebase mapping. Manual additions welcome for human-discovered issues. This is living documentation, not a complaint list.
</guidelines>
