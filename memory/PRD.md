# ZeroMark AI — Product Requirements Document

## Original problem statement
> Build full-stack AI marketing SaaS. Iterations 1–5 covered: MVP, AI Lead Scoring + Mini-CRM, Growth Studio (Market/SEO/PR/12mo Plan), reliability hardening, Team workspaces + per-user AI rate limits + real SEO API adapters + Social OAuth + IMAP email reply parsing + cron'd daily briefing emails + Landing Page Builder backend.
>
> **Iteration 6 (Feb 2026):** Unbounce-style design overhaul, **Guaranteed Leads** tracking + revenue calc, real-time analytics dashboard, AI marketing plan that distributes between **paid + organic** channels with user override.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB), JWT auth + brute-force lockout, Fernet-encrypted secrets, APScheduler in-process cron
- **Frontend**: React 19 + Tailwind, Source Sans 3 (body) + **Fraunces** (display headings, Unbounce-inspired)
- **Theme**: cream `#FAF7F2` bg, coral `#FF562D` primary, ink `#0E0F11` accents, pill (full-rounded) buttons, generous whitespace, rounded-2xl cards
- **Integrations**: Groq, Twilio, Gmail SMTP+IMAP, Razorpay, optional DataForSEO/SerpAPI/LinkedIn/Facebook/Twitter OAuth

## What's been implemented

### Iteration 7 (Feb 2026) — Forecast Alerts (Slack/Email/In-app + AI suggestions)
**Backend**
- `GET/POST /api/alerts/preferences` — channel toggles (email/slack/in-app), cadence (daily silent + weekly Monday digest), `hour_utc`, configurable `at_risk_threshold_pct` (default 80%), `slack_webhook_url` validated to start with `https://hooks.slack.com/`
- `POST /api/alerts/test` — on-demand send via all configured channels with a Groq-generated corrective action (e.g. "Add $500 to Google Ads, expecting 5 additional leads")
- `GET /api/alerts/history` — last 50 sent alerts with delivery status per channel
- `GET /api/notifications` (with `unread_count`) / `POST /api/notifications/{id}/read` / `POST /api/notifications/mark-all-read`
- New APScheduler job `_send_forecast_alerts_tick` — hourly cron at minute :05; fires daily silent check (only if at-risk vs threshold) AND weekly digest (every Monday) per user's preferred hour
- Email body: branded HTML with bar visualization + AI suggestion + CTA button to /analytics
- Slack body: blocks API with header + suggestion + Open-Analytics button
- Lead targets, channel distribution, business profile all feed the AI prompt for context-aware suggestions

**Frontend**
- New `NotificationsBell` in sidebar footer — orange unread badge, dropdown panel with severity icons (high=at-risk, info=on-track), 60s auto-poll
- New "Forecast Alerts" card on `/team` page — channel toggles (email/Slack/in-app), Slack webhook URL input (only when Slack on), cadence toggles, hour + threshold dropdowns, "Send test alert now" button

### Iteration 6 — Paid/Organic AI Plan + Guaranteed Leads + Real-time Analytics + Unbounce theme
**Backend (12/12 tests pass)**
- `POST /api/growth-plan/generate` — AI plan now includes `channel_distribution[]` (paid + organic mix), `monthly_lead_target`, `monthly_budget_usd`, `avg_deal_value_usd`
- `POST /api/growth-plan/channels` — user override for channel distribution + targets, persisted to growth_plans collection
- `GET /api/lead-targets` / `POST /api/lead-targets` — Guaranteed Leads target with optional guarantee terms; revenue target auto-computed from leads × avg deal
- `GET /api/analytics/realtime` — live counters (last hour / today / month / converted / revenue / pipeline value), target progress with linear forecast and on-track flag, hourly leads (24h), source mix
- `GET /api/analytics/revenue?months=N` — N consecutive months of leads/converted/revenue/conversion rate
- `PUT /api/leads/{id}` accepts `estimated_value` and `actual_value`; transitioning to `CONVERTED` auto-fills `actual_value` from `estimated_value`

**Frontend**
- New `/analytics` page (sidebar "Live Analytics" with LIVE badge) — 6 live counters, editable target panel (Guaranteed Leads), forecast card, hourly area chart, source mix bars, 6-month revenue trend
- `/growth → 12-Month Plan` — editable Channel distribution table (paid/organic dropdown, budget/leads/CPL/priority editable), Save Overrides button, paid vs organic split summary
- `/landing-pages` + `/landing-pages/:id` + `/p/:slug` (public) routes wired into App.js + sidebar
- **Unbounce theme**: Fraunces serif display, coral `#FF562D` primary, cream `#FAF7F2` bg, pill buttons (`rounded-full`), `rounded-2xl` cards, drop-shadow `shadow-brand-pop` accents
- New `/` Landing page redesigned with editorial serif headlines, dashboard-mock hero, decorative blobs, social-proof strip, animated hover cards
- Theme migration applied across all pages: `#002EB8 → #FF562D`, `#F4F4F5 → #FAF7F2`, `#E4E4E7 → #EDE5D4`, `#09090B → #0E0F11`

### Iteration 5 — Team workspaces + scheduling + reliability (47 tests)
- Team workspaces, AI rate limits, OAuth shells, IMAP polling, daily briefings, $lookup inbox

### Earlier (Iter 1-4)
- Auth + Mini-CRM, AI Lead Scoring, Growth Studio (Market/SEO/PR), Landing Page Builder backend, Razorpay test mode, Twilio + Gmail SMTP, security hardening

## Test results (cumulative)
| Iter | Coverage | Result |
|---|---|---|
| 1 | MVP baseline | 37/37 ✅ |
| 2 | AI SaaS features | 17/17 ✅ |
| 3 | Growth Studio | 18/19 → fixed |
| 4 | Reliability | 30/30 ✅ |
| 5 | Team + scheduling | 17/17 ✅ |
| 6 | Paid/Organic + Analytics + Guaranteed Leads + Theme | 12/12 ✅ |

## Backlog (P2)
- **P2** Standardise `create_lead`/`import_leads`/`create_campaign` to use `ws(user)` not `user["id"]` on writes (workspace invariant)
- **P2** Validate `monthly_lead_target > 0` and `avg_deal_value_usd >= 0` in LeadTargetIn
- **P2** Replace 24x sequential `count_documents` in analytics_realtime hourly chart with a single `$bucket` aggregation
- **P2** Server-side validation of channel_distribution items (require name/type/budget/leads)
- **P2** Re-prompt Groq if generated plan missing paid OR organic channels
- **P3** Split `server.py` (~2780 lines) into `routers/{auth,leads,team,ai,oauth,growth,analytics,landing_pages,webhooks}.py`
- **P3** Real OAuth flows tested live (need user-supplied dev apps)
- **P3** Real SEO API keys plugged in (DataForSEO/SerpAPI vars ready)
- **P3** Per-worker leader election for APScheduler

## File map
```
/app/backend/server.py                      # ~2780 lines
/app/backend/.env                           # Live keys
/app/backend/tests/test_iter6_analytics_targets.py  # iter6 regression
/app/frontend/src/App.js                    # Routes (incl. /analytics, /landing-pages, /p/:slug)
/app/frontend/src/index.css                 # Cream/coral theme + Fraunces
/app/frontend/tailwind.config.js            # brand colors + radius
/app/frontend/src/components/{AppLayout,PageHeader,BriefingCard,LandingPagePreview}.jsx
/app/frontend/src/pages/
  Landing.jsx                               # NEW redesign
  Analytics.jsx                             # NEW (Live Analytics + Guaranteed Leads)
  GrowthStudio.jsx                          # Channel distribution editor
  LandingPages.jsx + LandingPageEditor.jsx + PublicLandingPage.jsx
  Dashboard, Login, Register, Onboarding, Inbox, Approvals, Leads, LeadDetail,
  Campaigns, Scraping, Integrations, Business, Reports, Billing, Team
/app/memory/PRD.md, test_credentials.md
/app/test_reports/iteration_{1..6}.json     # All passing
```
