# ZeroMark AI — Product Requirements Document

## Original problem statement
> "build platform using below code... code is available, just build and deploy in preview"
> User selected: Emergent stack (FastAPI + React + MongoDB), full feature scope (option B). 
> Follow-up request: Implement P1 backlog items + add AI lead prediction, auto-reply, mini-CRM, integrations hub, daily AI briefing, real WhatsApp.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB)
- **Frontend**: React 19 + React Router 7 + Tailwind + Recharts + Phosphor Icons + Sonner
- **Database**: MongoDB (`zeromark_ai`)
- **Auth**: JWT (Bearer + httpOnly cookie fallback), bcrypt, brute-force lockout (5 fail → 15min)
- **Integrations**: Groq AI (`llama-3.3-70b-versatile`), Twilio (SMS+WhatsApp), Gmail SMTP, Razorpay (test mode)

## User personas
1. **B2B founder / marketer** – needs leads, AI scoring, multi-channel campaigns
2. **Marketing operator** – uses approval queue + AI auto-reply for inbound
3. **Admin** – seeded `admin@zeromark.ai / admin123` with PRO plan

## Core requirements (static)
- Auth, Business profile, Lead CRUD + AI scraping, Campaign CRUD + AI generation
- Approval queue (approve/reject/modify)
- Dashboard with stats + AI Daily Growth Briefing
- AI Lead Scoring & Prediction (Groq scores 0-100 + reasoning + status recommendation)
- Mini-CRM: per-lead detail page + communication history (inbound/outbound)
- AI auto-reply drafting for inbound messages
- Channel Integrations Hub (WhatsApp ready; LinkedIn/Facebook/Instagram/X configurable)
- Reports: Lead/Campaign Performance, Gap Analysis
- Razorpay subscription with 14-day trial → upgrade

## What's been implemented (2026-04-26 → 2026-04-27)

### Iteration 1 — MVP (37/37 backend tests pass)
- ✅ Full FastAPI backend, JWT auth, business profile, leads, campaigns, approvals
- ✅ Groq AI campaign content generation (per-channel)
- ✅ AI-powered lead scraping (Google Maps/LinkedIn/Competitor)
- ✅ Real Twilio SMS, Gmail SMTP, Razorpay test-mode billing
- ✅ Swiss/high-contrast frontend with Cabinet Grotesk + IKB blue
- ✅ Landing, Login, Register, Dashboard, Leads, Campaigns, Approvals, Scraping, Business, Reports, Billing pages

### Iteration 2 — P1 + new SaaS features (17/17 new tests pass)
- ✅ **AI Lead Scoring**: `/api/leads/score-batch` — Groq scores all leads vs business ICP
- ✅ **Auto-reply**: `/api/leads/{id}/ai-reply` — AI drafts reply for inbound message
- ✅ **Mini-CRM**: `/api/leads/{id}` lead detail + `/api/leads/{id}/communications` log
- ✅ **Integrations Hub**: WhatsApp, LinkedIn, Facebook, Instagram, X CRUD endpoints
- ✅ **Real WhatsApp** via Twilio sandbox (`_send_whatsapp_sync`)
- ✅ **Daily AI Briefing**: `/api/briefing/generate` + `latest`
- ✅ **Background-task campaign send** (non-blocking, returns immediately)
- ✅ **Brute-force lockout** with X-Forwarded-For + email-only fallback (locks at 5 fails)
- ✅ Frontend: LeadDetail page (with score + comm history + AI reply), Integrations page, BriefingCard on dashboard, "AI Score All" button, clickable lead rows

## Backlog / future enhancements
- **P1**: Encrypt integration tokens at rest (currently plaintext in mongo)
- **P1**: TTL index on `login_attempts`; recovery sweep for campaigns stuck in SENDING
- **P2**: Real OAuth flows for LinkedIn/Facebook/Instagram/X (require Meta/LI/X dev apps)
- **P2**: Real Playwright web scraping (currently AI-generated samples)
- **P2**: Modularise `server.py` into routers (~1340 lines)
- **P2**: Email open/click tracking; segmentation on campaign send
- **P3**: Team/multi-user workspaces; A/B test variants; Celery/Arq durable queue
- **P3**: Cron-scheduled daily briefing email delivery (currently on-demand)

## File map
```
/app/backend/server.py                      # Full FastAPI (~1340 lines)
/app/backend/.env                           # All integration keys
/app/frontend/src/App.js                    # Router + auth gates
/app/frontend/src/index.css                 # Swiss design tokens + utilities
/app/frontend/src/lib/api.js                # axios + bearer interceptor
/app/frontend/src/context/AuthContext.jsx
/app/frontend/src/components/{AppLayout,PageHeader,BriefingCard}.jsx
/app/frontend/src/pages/{Landing,Login,Register,Dashboard,Leads,LeadDetail,Campaigns,Approvals,Scraping,Integrations,Business,Reports,Billing}.jsx
/app/memory/test_credentials.md             # Admin creds
/app/test_reports/iteration_1.json          # 37/37 baseline pass
/app/test_reports/iteration_2.json          # 17/17 new feature pass
```
