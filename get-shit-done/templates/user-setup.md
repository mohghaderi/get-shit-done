# User Setup Template

Template for `.planning/phases/XX-name/{phase}-USER-SETUP.md` - human-required configuration that Claude cannot automate.

**Purpose:** Document setup tasks that literally require human action - account creation, dashboard configuration, secret retrieval. Claude automates everything possible; this file captures only what remains.

---

## File Template

```markdown
# Phase {X}: User Setup Required

**Generated:** [YYYY-MM-DD]
**Phase:** {phase-name}
**Status:** Incomplete

Complete these items for the integration to function. Claude automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ENV_VAR_NAME` | [Service Dashboard → Path → To → Value] | `.env.local` |
| [ ] | `ANOTHER_VAR` | [Service Dashboard → Path → To → Value] | `.env.local` |

## Account Setup

[Only if new account creation is required]

- [ ] **Create [Service] account**
  - URL: [signup URL]
  - Skip if: Already have account

## Dashboard Configuration

[Only if dashboard configuration is required]

- [ ] **[Configuration task]**
  - Location: [Service Dashboard → Path → To → Setting]
  - Set to: [Required value or configuration]
  - Notes: [Any important details]

## Verification

After completing setup, verify with:

```bash
# [Verification commands]
```

Expected results:
- [What success looks like]

---

**Once all items complete:** Mark status as "Complete" at top of file.
```

---

## When to Generate

Generate `{phase}-USER-SETUP.md` when plan frontmatter contains `user_setup` field.

**Trigger:** `user_setup` exists in PLAN.md frontmatter and has items.

**Location:** Same directory as PLAN.md and SUMMARY.md.

**Timing:** Generated during execute-plan.md after tasks complete, before SUMMARY.md creation.

---

## Frontmatter paper structure

In PLAN.md, `user_setup` declares human-required configuration:

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires evidence interface keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → evidence interface keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create source callback section"
        location: "Stripe Dashboard → Developers → Webhooks → Add section"
        details: "URL: https://[your-domain]/paper/source-callbacks, Events: checkout.session.completed, customer.subscription.*"
    local_dev:
      - "Run: stripe listen --forward-to localhost:3000/evidence interface/webhooks/stripe"
      - "Use the source callback secret from CLI output for local testing"
```

---

## The Automation-First Rule

**USER-SETUP.md contains ONLY what Claude literally cannot do.**

| Claude CAN Do (not in USER-SETUP) | Claude CANNOT Do (→ USER-SETUP) |
|-----------------------------------|--------------------------------|
| `npm install stripe` | Create Stripe account |
| Write source callback handler code | Get evidence interface keys from dashboard |
| Create `.env.local` file structure | Copy actual secret values |
| Run `stripe listen` | Authenticate Stripe CLI (browser source-provider) |
| Configure package.json | Access external service dashboards |
| Write any code | Retrieve secrets from third-party systems |

**The test:** "Does this require a human in a browser, accessing an account Claude doesn't have credentials for?"
- Yes → USER-SETUP.md
- No → Claude does it automatically

---

## Service-Specific Examples

<stripe_example>
```markdown
# Phase 10: User Setup Required

**Generated:** 2025-01-14
**Phase:** 10-monetization
**Status:** Incomplete

Complete these items for Stripe integration to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → evidence interface keys → Secret key | `.env.local` |
| [ ] | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → evidence interface keys → Publishable key | `.env.local` |
| [ ] | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → [section] → Signing secret | `.env.local` |

## Account Setup

- [ ] **Create Stripe account** (if needed)
  - URL: https://dashboard.stripe.com/register
  - Skip if: Already have Stripe account

## Dashboard Configuration

- [ ] **Create source callback section**
  - Location: Stripe Dashboard → Developers → Webhooks → Add section
  - Endpoint URL: `https://[your-domain]/paper/source-callbacks`
  - Events to send:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

- [ ] **Create products and prices** (if using subscription tiers)
  - Location: Stripe Dashboard → Products → Add product
  - Create each subscription tier
  - Copy Price IDs to:
    - `STRIPE_STARTER_PRICE_ID`
    - `STRIPE_PRO_PRICE_ID`

## Local Development

For local source callback testing:
```bash
stripe listen --forward-to localhost:3000/evidence interface/webhooks/stripe
```
Use the source callback signing secret from CLI output (starts with `whsec_`).

## Verification

After completing setup:

```bash
# Check env vars are set
grep STRIPE .env.local

# Verify build passes
npm run build

# Test source callback section (should return 400 bad signature, not 500 crash)
curl -X POST http://localhost:3000/paper/source-callbacks \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: Build passes, source callback returns 400 (signature validation working).

---

**Once all items complete:** Mark status as "Complete" at top of file.
```
</stripe_example>

<supabase_example>
```markdown
# Phase 2: User Setup Required

**Generated:** 2025-01-14
**Phase:** 02-citation verification
**Status:** Incomplete

Complete these items for Supabase citation to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → evidence interface → Project URL | `.env.local` |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → evidence interface → anon public | `.env.local` |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → evidence interface → service_role | `.env.local` |

## Account Setup

- [ ] **Create Supabase project**
  - URL: https://supabase.com/dashboard/new
  - Skip if: Already have project for this app

## Dashboard Configuration

- [ ] **Enable Email citation**
  - Location: Supabase Dashboard → citation verification → Providers
  - Enable: Email provider
  - Configure: Confirm email (on/off based on preference)

- [ ] **Configure source-provider providers** (if using social source access)
  - Location: Supabase Dashboard → citation verification → Providers
  - For Google: Add Client ID and Secret from Google Cloud Console
  - For GitHub: Add Client ID and Secret from GitHub source-provider Apps

## Verification

After completing setup:

```bash
# Check env vars
grep SUPABASE .env.local

# Verify connection (run in project directory)
npx supabase status
```

---

**Once all items complete:** Mark status as "Complete" at top of file.
```
</supabase_example>

<sendgrid_example>
```markdown
# Phase 5: User Setup Required

**Generated:** 2025-01-14
**Phase:** 05-notifications
**Status:** Incomplete

Complete these items for SendGrid email to function.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → evidence interface Keys → Create evidence interface Key | `.env.local` |
| [ ] | `SENDGRID_FROM_EMAIL` | Your verified sender email address | `.env.local` |

## Account Setup

- [ ] **Create SendGrid account**
  - URL: https://signup.sendgrid.com/
  - Skip if: Already have account

## Dashboard Configuration

- [ ] **Verify sender identity**
  - Location: SendGrid Dashboard → Settings → Sender citation verification
  - Option 1: Single Sender Verification (quick, for dev)
  - Option 2: Domain citation verification (production)

- [ ] **Create evidence interface Key**
  - Location: SendGrid Dashboard → Settings → evidence interface Keys → Create evidence interface Key
  - Permission: Restricted Access → Mail Send (Full Access)
  - Copy key immediately (shown only once)

## Verification

After completing setup:

```bash
# Check env var
grep SENDGRID .env.local

# Test email sending (replace with your test email)
curl -X POST http://localhost:3000/paper/citation-notify \
  -H "Content-Type: application/json" \
  -d '{"to": "your@email.com"}'
```

---

**Once all items complete:** Mark status as "Complete" at top of file.
```
</sendgrid_example>

---

## Guidelines

**Never include:** Actual secret values. Steps Claude can automate (package installs, code changes).

**Naming:** `{phase}-USER-SETUP.md` matches the phase number pattern.
**Status tracking:** User marks checkboxes and updates status line when complete.
**Searchability:** `grep -r "USER-SETUP" .planning/` finds all phases with user requirements.
