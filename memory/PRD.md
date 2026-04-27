# ZeroMark AI — Product Requirements Document

## Original problem statement
> "Build platform using below code... build and deploy in preview"
> Tech: Emergent stack (FastAPI + React + MongoDB), full feature scope.
> Iterations 2-4: P1 backlog + AI lead prediction, mini-CRM, integrations hub, daily briefing, real WhatsApp, market analysis, SEO toolkit, PR & outreach, 12-month growth plan, inbound webhooks, encrypted secrets, Twilio signature validation, SSRF protection, retry-on-Groq-json-failed.

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT auth + brute-force lockout, Fernet-encrypted secrets at rest
- Frontend: React 19 + Tailwind + Source Sans 3 (LinkedIn-style typography)
- Integrations: Groq (`llama-3.3-70b-versatile` with retry), Twilio SMS+WhatsApp+inbound webhooks, Gmail SMTP, Razorpay test mode

## What's been implemented (2026-04-26 → 2026-04-27)

### Iteration 1 — MVP (37/37 backend tests pass)
- Full FastAPI backend, JWT auth, business profile, leads, campaigns, approvals
- Groq AI campaign content generation (per-channel)
- AI-powered lead scraping
- Real Twilio SMS, Gmail SMTP, Razorpay test billing
- React frontend with sidebar layout, all 11 core pages

### Iteration 2 — AI SaaS features (17/17 tests pass)
- AI Lead Scoring (Groq scores all leads vs ICP with reasoning)
- Mini-CRM: Lead Detail page + communication history + AI auto-reply
- Channel Integrations Hub (WhatsApp live, social platforms configurable)
- Daily AI Growth Briefing on Dashboard
- Background-task campaign send + Brute-force lockout

### Iteration 3 — Growth Studio + hardening (18/19 → fixed in iter4)
- Onboarding wizard with **business auto-fill from URL** (AI scrapes website)
- Growth Studio (4 tabs):
  - **Market Analysis** (SWOT, market size, competitor matrix, positioning)
  - **SEO Toolkit** (Keywords, Backlinks, Content Gaps)
  - **PR & Outreach** (Press release, Media list, Outreach email)
  - **12-Month Plan** (Vision, north-star metric, quarterly themes, monthly milestones, hiring, marketing mix, KPIs)
- **Inbox** page for Twilio inbound replies (auto-routed via webhook)
- TTL on login_attempts, recovery sweep for stuck campaigns, encrypted integration secrets

### Iteration 4 — Reliability & security (30/30 tests pass, 100%)
- Centralised `_groq_chat` helper with retry-once on `json_validate_failed` (was 33% flaky → now 100% reliable)
- SSRF protection on `/api/business/auto-fill` (blocks loopback/private/link-local/metadata IPs)
- Twilio webhook signature validation (opt-in via `STRICT_TWILIO_WEBHOOK=1`)
- Phone number normalisation in webhook (handles "+1", spaces, dashes)
- Module-level Groq client (avoids per-request TLS handshake)
- **LinkedIn-style Source Sans 3 typography** + grouped sidebar (Workspace/Pipeline/Growth/Settings)

## File map
```
/app/backend/server.py                   # ~1785 lines, all features
/app/backend/.env                        # Live keys (Twilio, Groq, Razorpay, Gmail)
/app/frontend/src/App.js                 # Router + auth gates + onboarding redirect
/app/frontend/src/index.css              # Source Sans 3 + utility classes
/app/frontend/src/components/{AppLayout,PageHeader,BriefingCard}.jsx
/app/frontend/src/pages/{Landing,Login,Register,Onboarding,Dashboard,Inbox,Approvals,
                         Leads,LeadDetail,Campaigns,Scraping,GrowthStudio,Integrations,
                         Business,Reports,Billing}.jsx
/app/memory/PRD.md, test_credentials.md
/app/test_reports/iteration_{1..4}.json  # All passing
```

## Backlog (low priority)
- Split `server.py` into routers/ (auth, leads, campaigns, ai, growth_studio, webhooks)
- Replace inbox N+1 lead lookup with $lookup aggregation
- Per-user rate limit on AI generation endpoints
- Broader phone-match fallback for non-E.164 stored leads
- TOCTOU hardening on SSRF check (pin resolved IP)
- Real OAuth flows for LinkedIn/Facebook/Instagram/X (need platform dev apps)
- Real Playwright web scraping
- Cron-scheduled daily briefing email delivery
- Team/multi-user workspaces
