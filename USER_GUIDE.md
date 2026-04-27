# ZeroMark AI — User Guide

> **What it is:** an AI marketing operations platform. You give it your business URL + lead goal; it identifies your ideal customer, builds a 12-month plan with paid + organic channel mix, generates outreach across 6 channels, captures replies into a CRM, forecasts whether you'll hit your monthly target, and pings you (Email/Slack/in-app) with AI-suggested fixes if you're behind pace.

---

## 1. Sign up (90 seconds)

1. Go to **`/register`** on your preview URL
2. Enter name, email, password (6+ chars). No credit card required, 14-day Pro trial.
3. You land on the Onboarding wizard.

---

## 2. Onboarding wizard (3 minutes)

The wizard has **4 steps** — skip nothing, it sets up everything else.

### Step 1 — Paste your website URL
- Type your homepage URL → click **Auto-fill from website**
- AI reads your page and pre-fills your business profile (name, industry, location, audience, description)
- If your site is private/login-walled, click **Skip — I'll fill manually**

### Step 2 — Confirm business profile
- Review the AI-filled fields. **Edit anything wrong** — these power every AI generation downstream.
- Click **Continue**.

### Step 3 — Set your goal
- **Monthly lead target** — how many qualified leads per month? (e.g., 50)
- **Avg deal value (USD)** — what does a closed customer pay you? (e.g., $250)
- The **Forecast** card shows your monthly revenue target = leads × deal value
- Optionally add ICP specifics (e.g. "B2B SaaS founders in India doing $500K ARR")
- Click **Build my plan with Autopilot** ⚡

### Step 4 — Autopilot completes
The platform now in parallel:
1. Saves your **Guaranteed Leads** target
2. Generates an **Ideal Customer Profile** (persona, firmographics, sample companies, channels)
3. Builds a **12-month growth plan** with paid + organic channel distribution
4. Turns on **Forecast Alerts** (email + in-app, daily silent + weekly Monday digest)

You see a summary of what was built, then click **Go to Dashboard**.

---

## 3. Daily flow (after onboarding)

### A) Dashboard — your daily start
- Read the **AI Growth Briefing** (top card) — wins, risks, 3 actions for today
- Stats: total leads, campaigns sent, pending approvals, conversion rate

### B) Live Analytics — am I on track?
- **`/analytics`** auto-refreshes every 30 seconds
- 6 live counters (last hour / today / this month / converted / revenue / pipeline)
- **Guaranteed Leads** progress bar with end-of-month forecast
- Click **Edit target** to change your number any time

### C) Growth Studio — your strategic doc
- **`/growth → Ideal Customer`** — buyer persona, firmographics, 10 sample target companies, qualification questions
- **`/growth → Market Analysis`** — SWOT, competitor matrix, positioning
- **`/growth → SEO Toolkit`** — keyword ideas, backlink targets, content gaps
- **`/growth → PR & Outreach`** — press release drafts, journalist list, personalised media pitches
- **`/growth → 12-Month Plan`** — vision, north-star metric, **editable channel distribution table** (paid vs organic, budget per channel, expected leads, CPL)
  - Edit any row → click **Save overrides** to lock your decisions

### D) Lead Discovery — find prospects
- **`/scraping`** — scrape Google Maps, LinkedIn, or competitor sites with a keyword + location
- AI auto-scores every imported lead (0-100)
- Use your ICP's "sample target companies" as a search guide

### E) Leads — the CRM
- **`/leads`** — every lead with status, score, source, contact info
- Click a lead → **`/leads/{id}`** for full details
  - Set **Estimated value** ($ for this deal)
  - Move through pipeline: NEW → CONTACTED → INTERESTED → CONVERTED
  - When you flip to CONVERTED, **actual_value** auto-fills from estimated_value
  - Add notes, see communication history (email/SMS/WhatsApp)

### F) Campaigns — outreach
- **`/campaigns`** → **New campaign**
- Pick channel (Email/SMS/WhatsApp/Facebook/Instagram/LinkedIn)
- AI drafts the content tuned to your business profile
- Submit → moves to **`/approvals`** queue

### G) Approvals — human in the loop
- **`/approvals`** — every campaign waits here for sign-off
- **Approve** → sent to leads matching the campaign's audience
- **Reject** with comments
- **Modify content** → re-queues a new version

### H) Inbox — unified replies
- **`/inbox`** — Email replies (Gmail IMAP, polled every 3 min) + Twilio SMS/WhatsApp inbound webhooks land here
- Each reply auto-attaches to its lead and bumps NEW/CONTACTED → INTERESTED

### I) Landing Pages — capture inbound
- **`/landing-pages`** → **New page**
- AI generates each section (hero, features, FAQ, form) on click
- **Publish** → live at `/p/{your-slug}`
- Form submissions auto-create leads with source = LANDING_PAGE, score 60

### J) Reports — measure
- **`/reports`** → generate Lead Performance, Campaign Metrics, AI Gap Analysis
- Export-ready tables and charts

---

## 4. Forecast Alerts (proactive)

Configure once at **`/team`** → **Forecast Alerts** card:
- **Channels** — Email, Slack webhook, in-app bell (any combo)
- **Cadence** — daily silent check (only sends if at-risk) + weekly Monday digest
- **Hour (UTC)** + **At-risk threshold** (default `< 80% of target`)
- Click **Send test alert now** to verify everything is wired up

When forecast falls below threshold, you get:
- Live numbers (forecast vs target)
- AI-suggested concrete budget shift (e.g., "Add $500 to Google Ads, expecting 5 additional leads")
- One-click link back to `/analytics`

---

## 5. Team

**`/team`** — invite collaborators (they get a shared workspace, see same leads/campaigns/pipeline).
- Invite by email → they get a temp password via Gmail SMTP
- Owner badge on whoever created the workspace

---

## 6. Integrations setup (optional)

**`/integrations`** — paste your own keys to override defaults:
- Twilio (SMS/WhatsApp): SID + Auth Token + phone number
- Gmail SMTP: app password (not your real Gmail password)
- LinkedIn / Facebook / Twitter OAuth: needs your dev app credentials
- DataForSEO / SerpAPI: real SEO data (otherwise AI fallback)

If left empty, the platform uses the env-level defaults seeded by your admin.

---

## 7. Notification bell

Bottom-left of the sidebar. The orange counter shows unread alerts. Click any item to jump to the relevant page (usually `/analytics`).

---

## 8. Quick reference — URLs

| Page | URL |
|---|---|
| Sign up | `/register` |
| Login | `/login` |
| Dashboard | `/dashboard` |
| Live Analytics | `/analytics` |
| Inbox | `/inbox` |
| Approvals | `/approvals` |
| Leads (CRM) | `/leads` |
| Campaigns | `/campaigns` |
| Lead Discovery | `/scraping` |
| Landing Pages | `/landing-pages` |
| Public landing page | `/p/{slug}` |
| Growth Studio | `/growth` |
| Reports | `/reports` |
| Business Profile | `/business` |
| Integrations | `/integrations` |
| Team | `/team` |
| Billing | `/billing` |

---

## 9. Common questions

**Q: I want to change my lead target later.**
A: `/analytics` → click **Edit target** → save. Forecast recalculates instantly.

**Q: How does the AI distribute paid vs organic?**
A: It looks at your industry, monthly budget (derived from target × CPL benchmarks), and recommends a mix. You can override every row in `/growth → 12-Month Plan` and click **Save overrides**.

**Q: How do I trigger lead discovery automatically?**
A: Today it's manual at `/scraping`. Use the "sample target companies" from your ICP (`/growth → Ideal Customer`) as your seed list — copy the company names into Google Maps Leads or LinkedIn Leads searches.

**Q: How do I close a deal?**
A: On the lead detail page, change status to **CONVERTED**. Revenue analytics, target progress and forecast all update automatically.

**Q: My emails are bouncing or going to spam.**
A: At `/integrations`, configure your own Gmail SMTP with an app password (not your normal password). Set up SPF/DKIM on your sending domain.

**Q: Can I rollback / restore?**
A: Use the Emergent platform's **Rollback** option in the chat input, not git reset.

**Q: How do I push this codebase to GitHub?**
A: Use the **Save to GitHub** button in the Emergent chat input.

---

## 10. Test credentials (admin demo)

```
Email:    admin@zeromark.ai
Password: admin123
```

Use this for a quick demo, or sign up your own account at `/register` for an isolated workspace.

---

## 11. Built with

- **Backend**: FastAPI · MongoDB · APScheduler
- **Frontend**: React 19 · Tailwind · Recharts · Phosphor Icons
- **AI**: Groq (`llama-3.3-70b-versatile`)
- **Comms**: Twilio (SMS/WhatsApp) · Gmail SMTP+IMAP
- **Payments**: Razorpay (test mode)
- **Optional**: DataForSEO/SerpAPI · LinkedIn/Facebook/X OAuth
