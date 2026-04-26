# ZeroMark AI — Product Requirements Document

## Original problem statement
> "build platform using below code... code is available, just build and deploy in preview"
> Source: AI Marketing platform code (ZeroMark AI - originally Node/Prisma; rebuilt on Emergent stack).
> User selected option B: Emergent preferred stack (FastAPI + React + MongoDB) with **everything** including web scraping, SMS/email and payments.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB)
- **Frontend**: React 19 + React Router 7 + Tailwind + Recharts + Phosphor Icons + Sonner toasts
- **Database**: MongoDB (`zeromark_ai`)
- **Auth**: JWT (Bearer + httpOnly cookie fallback), bcrypt
- **Integrations**:
  - Groq AI (`llama-3.3-70b-versatile`) — campaign content + AI-driven lead discovery
  - Twilio REST — SMS sends
  - Gmail SMTP — Email sends (smtplib + STARTTLS)
  - Razorpay (test mode) — Subscription payments

## User personas
1. **B2B founder / marketer** – needs leads, campaigns, AI copy, multi-channel reach.
2. **Marketing operator** – uses approval queue to gate AI output before send.
3. **Admin** – seeded `admin@zeromark.ai / admin123` with PRO plan.

## Core requirements (static)
- Auth (register, login, logout, /me)
- Business profile (one per user)
- Lead CRUD + bulk import + AI-powered scraping (Google Maps / LinkedIn / competitor)
- Campaign CRUD + AI content generation (per channel) + send via real Twilio + Gmail
- Approval queue with approve / reject / modify
- Dashboard stats + 14-day inflow chart + lead distribution
- Reports: Lead Performance, Campaign Performance, Gap Analysis
- Subscription plans + Razorpay checkout + webhook signature verification

## What's been implemented (2026-04-26)
- ✅ FastAPI backend (`/app/backend/server.py`) — full feature set, **37/37 backend tests pass**
- ✅ React frontend with Swiss/high-contrast design (Cabinet Grotesk + Manrope, IKB blue)
- ✅ Landing page, Login, Register
- ✅ Authenticated app shell with sidebar nav
- ✅ Dashboard, Leads, Campaigns, Approvals, Scraping, Business, Reports, Billing
- ✅ Razorpay test-mode integration with frontend checkout modal
- ✅ Groq AI: per-channel content generator + AI sample lead generator for scraping
- ✅ Real Twilio SMS + Gmail SMTP wired (rate limited/best effort in preview)
- ✅ Admin auto-seeded
- ✅ MongoDB indexes on startup
- ✅ CORS regex for *.emergentagent.com domains

## Backlog / future enhancements
- **P1**: Move campaign send to background tasks (currently blocks request loop on >50 leads)
- **P1**: Brute-force lockout (5 attempts → 15min) per auth playbook
- **P2**: Lead segmentation/targeting on campaign send (currently sends to all)
- **P2**: Real Playwright-based web scraping (currently AI-generated)
- **P2**: Webhooks for Razorpay subscription lifecycle (renewal/cancel)
- **P2**: Email open/click tracking + delivered counts
- **P2**: Modularise `server.py` into routers
- **P3**: A/B test variants for AI subject lines
- **P3**: Team / multi-user workspaces
- **P3**: Communication history view per lead

## File map
```
/app/backend/server.py            # Full FastAPI app (~700 LOC)
/app/backend/.env                 # All integration keys
/app/frontend/src/App.js          # Router + auth gates
/app/frontend/src/index.css       # Swiss design tokens + utility classes
/app/frontend/src/lib/api.js      # axios + bearer interceptor
/app/frontend/src/context/AuthContext.jsx
/app/frontend/src/components/AppLayout.jsx
/app/frontend/src/pages/{Landing,Login,Register,Dashboard,Leads,Campaigns,Approvals,Scraping,Business,Reports,Billing}.jsx
/app/memory/test_credentials.md   # Admin creds
/app/test_reports/iteration_1.json  # 37/37 backend pass
```
