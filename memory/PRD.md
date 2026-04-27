# ZeroMark AI — Product Requirements Document

## Original problem statement
> Build full-stack AI marketing SaaS. Iterations 1–5 covered: MVP, AI Lead Scoring + Mini-CRM, Growth Studio (Market/SEO/PR/12mo Plan), reliability hardening, **Team workspaces + per-user AI rate limits + real SEO API adapters + Social OAuth + IMAP email reply parsing + cron'd daily briefing emails**.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB), JWT auth + brute-force lockout, Fernet-encrypted secrets, APScheduler in-process cron
- **Frontend**: React 19 + Tailwind + Source Sans 3 (LinkedIn-style typography)
- **Integrations**: Groq (`llama-3.3-70b-versatile` with retry+rate-limit-aware), Twilio SMS+WhatsApp+inbound webhooks, Gmail SMTP+IMAP, Razorpay test mode, DataForSEO/SerpAPI (optional), LinkedIn/Facebook/Twitter OAuth (optional)

## What's been implemented (latest iteration)

### Iteration 5 — Team + scheduling + reliability final pass (17/17 + 30/30 = 47 tests pass)
- **Team workspaces**: `workspace_id` field on users + all data, migrated existing data, `ws(user)` helper used in all 53 data queries → all teammates see shared leads/campaigns/etc.
- **Team endpoints**: `/api/team/members` (list with owner badge), `/api/team/invite` (creates user + Gmail SMTP invite + temp password), `/api/team/members/{id}` DELETE (owner-only)
- **Per-user AI rate limit**: 60 calls/hour sliding window with TTL'd `ai_calls` collection, applied to /seo/keywords, /market/analyze, /growth-plan/generate, /briefing/generate, /leads/score-batch, /ai/generate-content
- **Real SEO API adapter**: `_real_keyword_data()` tries DataForSEO first, then SerpAPI (set env vars to enable), falls back to Groq AI; response includes `source: "dataforseo|serpapi|ai"`
- **Social OAuth**: `/api/oauth/{linkedin|facebook|twitter}/start` + `/callback` — full OAuth 2.0 flow with TTL'd state collection. Returns 400 with helpful detail if env vars missing
- **Inbox $lookup**: replaced N+1 with single MongoDB aggregation pipeline
- **Email reply parsing**: APScheduler IMAP-IDLE poll every 3 min — fetches Gmail unread, matches by sender email to leads, logs as INBOUND, auto-bumps lead status NEW/CONTACTED → INTERESTED
- **Daily briefing email cron**: APScheduler hourly tick checks every user's `briefing_hour_utc` preference and emails AI-generated briefing via Gmail SMTP
- **Briefing preferences**: `/api/briefing/preferences` GET/POST + Team page UI toggle
- **OAuth state TTL**: auto-cleans abandoned states after 10 min
- **Better error UX**: Groq RateLimitError → 429 (was misleading 502); OAuth errors sanitized
- **Security polish**: temp_password omitted from invite response when email delivery succeeds

### Frontend additions
- `/team` page with member list, invite form, owner badges, briefing preferences (toggle + UTC hour selector), inbound email info card
- Integrations page now shows "Connect with LinkedIn/Facebook/X" OAuth buttons (in brand colors) + manual config fallback
- Sidebar grouped: Workspace / Pipeline / Growth / Settings → Team added under Settings

## Test results (cumulative)
| Iteration | Coverage | Result |
|---|---|---|
| 1 | MVP baseline | 37/37 ✅ |
| 2 | AI SaaS features | 17/17 ✅ |
| 3 | Growth Studio | 18/19 → fixed |
| 4 | Reliability re-test | 30/30 ✅ |
| 5 | Team + scheduling + adapters | 17/17 ✅ |

## Backlog (low priority)
- Split `server.py` (now 2240 lines) into `routers/{auth,leads,team,ai,oauth,growth,webhooks}.py`
- Per-worker leader election for APScheduler (only matters with multiple uvicorn workers)
- Real OAuth flows tested live (need user-provided LinkedIn/Facebook/X dev apps)
- Real Playwright web scraping (currently AI-generated leads)
- Real SEO API keys plugged in (DataForSEO/SerpAPI vars ready, just needs credentials)
- Cascade or reassign teammate-owned data on remove (currently safe: data is workspace-scoped)
- TOCTOU hardening on SSRF check (pin resolved IP)

## File map
```
/app/backend/server.py                   # ~2240 lines
/app/backend/.env                        # Live keys + PUBLIC_APP_URL + AI_RATE_LIMIT_PER_HOUR
/app/frontend/src/App.js                 # Router + auth + onboarding
/app/frontend/src/index.css              # Source Sans 3
/app/frontend/src/components/{AppLayout,PageHeader,BriefingCard}.jsx
/app/frontend/src/pages/{Landing,Login,Register,Onboarding,Dashboard,Inbox,Approvals,
                         Leads,LeadDetail,Campaigns,Scraping,GrowthStudio,Integrations,
                         Business,Reports,Billing,Team}.jsx
/app/memory/PRD.md, test_credentials.md
/app/test_reports/iteration_{1..5}.json  # All passing
```
