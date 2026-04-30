# ZeroMark AI — Product Requirements Document

## Iter 19 (Apr 2026) — Unified Plan Overview + Auto-sync (no manual clicks)
User complaint: "When I change business profile and target, it should automatically reflect everywhere. Feels like too many steps — instead I want a summary of all tabs from the Plan menu with deep-links for detail."

**Backend**
- `POST /api/plan/regenerate-all` — runs ICP + Market + Growth Plan + SEO keywords + Content ideas + PR outlets **in parallel** (`asyncio.gather`). Each module is independently resilient (fail-soft, returns per-module status).
- `GET /api/plan/summary` — consolidated snapshot of all 7 artifacts with: `has_data`, `generated_at`, 3-line summary, highlights[], deep_link hint, and `modules_ready/modules_total` for progress bar.
- `POST /api/business` — now kicks off `BackgroundTasks` fire-and-forget regeneration whenever business_name + industry + target_audience are present. Response includes `plan_regenerating: true`.
- New collections: `plan_seo_keywords`, `plan_content_ideas`, `plan_pr_outlets`, `plan_snapshots` (one-per-user with last_regenerated_at + last_results[]).

**Frontend**
- New **"Plan Overview"** first tab in Growth Studio (marked NEW). Dark hero card with sync status + "Regenerate all" button + progress bar + 7 summary cards in 3-col grid (Quick Plan, ICP, Market, SEO, Content Ideas, PR, 12-Month Plan). Each card is clickable → deep-links into its detailed tab via `?tab=` URL param.
- `useSearchParams` for tab state so URLs are shareable/bookmarkable.
- `Business.jsx` save → if profile is complete, sets `sessionStorage.plan_bg_regen=1` and redirects to `/growth?tab=overview` with toast "Regenerating ICP, market, SEO, PR & roadmap in background…"
- Plan Overview auto-polls `/plan/summary` every 5s (up to 2min) while regeneration is in-flight, so cards populate live.

## Original problem statement
Build an end-to-end AI marketing automation platform that:
- Takes a business profile + objective; performs market analysis; builds a 12-month paid+organic plan
- Predicts GUARANTEED leads given a budget; tracks via Mini-CRM
- Auto-generates daily SEO/social content; auto-schedules and publishes
- Provides Super Admin panel, in-app Chatbot, multi-method auth (Google/SMS/Email)
- Forecast alerts via Slack/Email/in-app; encrypted social media credentials

User explicitly asked (Iter 7, Feb 2026):
> simplify overall user flow to ensure normal users can use with few clicks and market their product. If I give 5000 INR as budget, it should figure best way to utilize and give guaranteed leads prediction (50% buffer is OK). Growth Studio 12-month plan duration should be editable by user. Plan and Execution Engine should link seamlessly.

## Architecture
- **Backend**: FastAPI + Motor MongoDB, JWT auth + brute-force lockout, Fernet-encrypted secrets, APScheduler in-process cron (5 jobs)
- **Frontend**: React 19 + Tailwind, Source Sans 3, professional Blue/White theme (`#2563EB` primary, `#F8FAFC` bg, `#0F172A` ink)
- **Integrations**: Groq (LLM), Twilio (SMS+WA), Gmail SMTP+IMAP, Razorpay, Emergent Google Auth, optional LinkedIn/FB/Twitter OAuth
- **Encryption**: Fernet (`_enc`/`_dec`) for social-media access tokens at rest

## Key features (cumulative)

### Iter 18 (Feb 2026) — Super Admin / Platform Owner Console (separate shell)
**The complaint**: "Super admin should be platform owner — show subscribed users, statistics, manually subscribe users, change credit limits/discounts. Don't show admin as normal user."

**Backend (8 new endpoints + 1 new collection)**
- `GET /api/admin/users/{uid}` — user detail with subscription, wallet, discount, stats, last 20 audit entries
- `POST /api/admin/users/{uid}/subscription` — manually set plan + duration_months (no payment); writes `manually_set_by/at/note` to subscriptions
- `POST /api/admin/users/{uid}/wallet/adjust` — credit/debit with reason; logs `ADMIN_CREDIT/ADMIN_DEBIT` transaction; rejects insufficient balance
- `POST /api/admin/users/{uid}/discount` — upserts `db.discounts` with percent (0-100), valid_until, note
- `POST /api/admin/users/{uid}/role` — promote/demote (blocks self-demote)
- `POST /api/admin/users/{uid}/suspend` — suspend/reactivate (blocks self-suspend)
- `GET /api/admin/revenue` — MRR/ARR rollup, MRR by plan, last 30d payments, last 30d wallet topups
- `GET /api/admin/audit-log` — paginated SaaS-wide admin actions
- All write-actions logged to new `db.admin_audit_log` with actor_email, target_user_id, action, payload, timestamp

**Frontend — entirely separate platform-owner shell**
- `AdminLayout.jsx` — DARK sidebar (`#0F172A`) with Crown logo, "PLATFORM CONSOLE" subtitle, 4 nav items (Overview/Users/Revenue & Plans/Audit Log), "View as user" portal-out link, admin email + crown badge + Sign out
- New routes mounted at `/admin/*` under `<AdminOnly><AdminLayout/></AdminOnly>` — completely isolated from regular user app shell
- **Login redirect**: admin role auto-redirects to `/admin` (not `/dashboard`)
- `AdminOverview` — Recurring revenue hero card + 6 stat cards + Growth + provider/plan mix
- `AdminUsers` — Paginated table with search, page-size selector, "Manage" button per row → opens `UserEditModal` with 5 tabs (Subscription / Wallet / Discount / Role & Suspend / Audit history) + snapshot row showing live Plan/Wallet/Discount/Stats
- `AdminRevenue` — MRR/ARR/30d/topups KPIs + MRR-by-plan table + recent payments
- `AdminAudit` — Full SaaS-wide audit log paginated

**Other fixes this iter**
- Removed "Made with Emergent" badge from `public/index.html`; title now "ZeroMark — AI Marketing Engine"
- Landing page positioned as **organic-first**: "Get more leads. Spend 70% less than ad platforms"
- Quick Plan AI prompt forces ≥60% organic budget split + treats budget as "tools + freelance" not ad spend
- Chatbot ("ZeroMark Guide") is **proactive for non-IT users**: auto-tooltip after 4s, warm greeting with emoji, 4 quick-prompt chips, plain-English placeholder, "no marketing jargon" tagline
- Backend assistant system prompt rewritten for SMB owners: simple language, ≤4 sentences, 1 concrete next step, links via `[Label](/path)` markdown, organic-first recommendations
- Idempotency on `/wallet/topup/verify` (duplicate `razorpay_payment_id` returns existing transaction)
- Unique indexes added: `wallets.user_id`, `wallet_transactions.razorpay_payment_id`, `ad_accounts.(user_id,platform,ad_account_id)`, `ad_campaigns.(user_id,created_at)`
**Backend**
- `GET /api/admin/users?page=N&limit=L&q=search` — full pagination + case-insensitive search across `email`, `phone`, `first_name`, `last_name` (regex-escaped)
- Response shape: `{users[], page, limit, total, total_pages}`
- `limit` clamped to `[1, 100]`, `page` clamped to `>= 1`
- Aggregation hydration (leads/campaigns/subs) now runs only on the current page's user set — O(page_size) instead of O(all_users)

**Frontend**
- `/admin` page Users table now has:
  - Top-right search box (debounced 350ms) + page-size selector (10/25/50/100)
  - Bottom pagination footer with "Page X of Y" + Prev/Next + numbered buttons (compact ellipsis when >7 pages)
  - "Showing N–M" range indicator
  - Empty state (no results / no users yet)

### Iter 14 (Feb 2026) — Reports analytics + parallelism + admin scale
**Backend**
- New `GET /api/reports/marketing-metrics?days=N` (1 ≤ N ≤ 90) — funnel metrics:
  - 4 KPIs: impressions, clicks, conversions, scheduled_posts (with published count)
  - Funnel rates: `ctr_pct`, `conv_rate_pct`; real `leads_in_period` and `converted_in_period` from DB
  - Per-platform breakdown (linkedin/twitter/instagram/blog/email_broadcast) using industry-median multipliers (50% projection for pending, 100% for published)
  - Symmetric window `[now - Ndays, now + Ndays]` so forward-scheduled posts surface across periods
  - `is_synthetic=true` flag (UI shows note about connecting real OAuth)
- `POST /api/plan/kickoff-execution` now runs content kit generation in **parallel** via `asyncio.Semaphore(3)` — 6 posts in ~20-25s instead of ~60s
- `GET /api/admin/users` refactored to use **`$group` aggregation** — 1 round-trip per collection (leads, campaigns, subscriptions) instead of 3×N — 200 users now hydrate in ~0.17s instead of ~5-10s

**Frontend**
- `/reports` REWRITTEN as full Reports & Analysis dashboard: 4 KPI cards (impressions/clicks/conversions/posts) → funnel summary row → daily trend area chart (impressions × clicks × conversions) + by-channel stacked bar chart → per-platform table with branded icons → original Lead/Campaign/Gap on-demand reports + history beneath
- Period selector: ±7 / ±30 / ±90 days (symmetric so results actually change)
- Empty state when no scheduled posts (links to `/growth`)

### Iter 13 (Feb 2026) — Quick Plan + Execution Kickoff + Super Admin + Chatbot + Encrypted Social Vault
**Backend**
- `POST /api/quick-plan/generate` — budget-driven simplified flow:
  - Inputs: `monthly_budget` (numeric), `duration_months` (3/6/9/12 only), optional `avg_deal_value`, `goal`
  - AI builds OPTIMAL channel mix for THIS exact budget using country-specific CPL benchmarks
  - Applies **50% conservative buffer**: `guaranteed_per_month = floor(raw_predicted * 0.5)`
  - Persists as `growth_plans` (with `source='quick_plan'`) AND upserts `lead_targets` with `guarantee_enabled=true` + descriptive `guarantee_terms`
  - Returns guarantee block: `{monthly_leads, total_leads, duration_months, monthly_budget, currency, buffer_pct, raw_predicted_per_month, revenue_target}`
- `POST /api/plan/kickoff-execution` — bridges Plan → Execution Engine:
  - Generates up to 6 content kits sequentially (cap to respect AI rate limits)
  - Schedules them across `weeks` × `posts_per_week` slots at staggered hours
  - Marks kits as `SCHEDULED`, fires in-app notification
  - Default platforms: `[linkedin, twitter, blog]`
- `GET /api/admin/overview` + `GET /api/admin/users` — admin-only platform stats (total users, workspaces, leads, growth, by_provider, by_plan, recent users)
- `POST /api/assistant/chat` — in-app guidance chatbot via Groq, knows the user's setup state
- `GET/POST /api/integrations/social` + `DELETE /api/integrations/social/{platform}` — encrypted (Fernet) credential vault for LinkedIn/Twitter/Instagram/Facebook

**Frontend**
- New "Quick Plan" tab in Growth Studio (`/growth`) — FIRST tab, marked "EASY":
  - Big budget input with currency-aware prefix (₹/$/€/£)
  - Duration pills: 3 / 6 / 9 / 12 months (default 6)
  - Optional avg deal + goal
  - On generate: gradient hero card with "X leads/month, guaranteed", "Y total over N months", monthly budget formatted, AI rationale, "UPSIDE: ~Z/MO" badge
  - Channel mix table (paid/organic chips, budgets, CPL)
  - **"Activate Execution Engine" button** → calls kickoff endpoint, schedules 6 posts across LinkedIn/X/Blog over next 2 weeks, redirects to `/schedule`
- Existing 12-Month Plan tab (`Full Growth Plan`) also gets the same "Activate Execution Engine" button
- Sidebar (per user request): RUN (Dashboard, Live Analytics, Inbox, Approvals), STRATEGY (Business Profile, Growth Studio), EXECUTION ENGINE (Leads (CRM), Lead Discovery, Campaigns, Landing Pages), POSTS & CONTENT (Content Studio, Auto-publish), REPORTS (Reports & Analysis), SETTINGS (Integrations, Team & Alerts, Billing), ADMIN (Super Admin, admin-only)
- New `/admin` page — Platform Overview with 6 stat cards, Growth panel, Auth provider mix, Subscription mix, Recent users table
- `ChatbotWidget` mounted globally in AppLayout — floating bubble bottom-right, conversational guide with markdown link support to in-app pages
- Landing page (`/`) — tight hero with recharts area chart visualizing 9-month +1,400% growth, dark stats strip, features grid, CTA

### Iter 12 (Feb 2026) — Auto-publish queue + Daily auto-content + Recovery loop
- 5-platform schedule dispatcher (linkedin/twitter/instagram/blog/email_broadcast)
- Hourly cron auto-content + every-5-min publish dispatcher
- Recovery loop: at-risk forecast auto-schedules 3 recent draft kits over 7 days

### Iter 11 — Currency-agnostic + Content Studio
- 49-country COUNTRY_CURRENCY map; AI prompts inject country+currency context
- Content Studio generates daily kits (blog + meta + 3 social posts + 5 SEO keywords)

### Iter 10 — Multi-method auth: Email + Google (Emergent) + SMS-OTP (Twilio)

### Iter 9 — Onboarding wizard, Setup checklist, ICP generator, Autopilot kickoff

### Iter 8 — Theme switch to professional Blue/White

### Iter 7 — Forecast Alerts (Slack/Email/in-app + AI suggestions) + Notifications bell

### Iter 6 — Paid/Organic AI Plan + Guaranteed Leads + Real-time Analytics (12/12 tests)

### Iter 1-5 — Core MVP, Mini-CRM, AI lead scoring, Growth Studio (Market/SEO/PR), Landing Page builder, Team workspaces, IMAP polling, daily briefings

## Test results (cumulative)
| Iter | Coverage | Result |
|---|---|---|
| 1-5 | MVP + scaling features | ALL PASS |
| 6 | Paid/Organic + Analytics + Guarantee + Theme | 12/12 ✅ |
| 7 | Quick Plan + Kickoff + Admin + Social vault + Chatbot | 15/15 ✅ + 7/7 frontend |
| 14 | Reports metrics + parallel kickoff + agg admin queries | 11/11 ✅ + 4/4 frontend |

## Backlog (P2)
- **P2** Concurrent content generation in `plan_kickoff_execution` (currently sequential — up to 90s for 6 kits)
- **P2** `admin_users` should use `$lookup` aggregation instead of N×2 sequential count_documents
- **P2** Move `from groq import Groq` to module-level (currently re-imported per request in `assistant_chat`)
- **P2** Reports & Analysis page — wire traffic/impressions/clicks/conversions metrics tied to scheduled posts
- **P3** Split `server.py` (now ~4445 lines) into `routers/{auth,leads,team,ai,oauth,growth,analytics,landing_pages,admin,assistant,integrations}.py`
- **P3** Real OAuth flows for LinkedIn/Facebook/Twitter (live tested with user-supplied dev apps)
- **P3** Per-worker leader election for APScheduler

## File map
```
/app/backend/server.py                                  # ~4445 lines
/app/backend/.env                                       # Live keys
/app/backend/tests/
  test_iter6_analytics_targets.py                       # 12 tests
  test_iter7_quickplan_admin_social.py                  # 15 tests
/app/frontend/src/
  App.js                                                # Routes (incl. /admin, /growth, /schedule, /content, /integrations, /p/:slug)
  components/
    AppLayout.jsx                                       # Sidebar with section labels matching user request
    ChatbotWidget.jsx                                   # Mounted globally; calls /assistant/chat
    NotificationsBell.jsx
    PageHeader.jsx, BriefingCard.jsx, LandingPagePreview.jsx
  pages/
    Landing.jsx                                         # Public landing with growth chart
    Admin.jsx                                           # Super admin dashboard
    GrowthStudio.jsx                                    # 6 tabs (Quick Plan first), Activate Execution buttons
    Analytics.jsx, Dashboard.jsx, Onboarding.jsx,
    Leads.jsx, LeadDetail.jsx, Campaigns.jsx,
    Content.jsx, Schedule.jsx, Integrations.jsx,
    Reports.jsx, Team.jsx, Billing.jsx, Business.jsx,
    Inbox.jsx, Approvals.jsx, Scraping.jsx,
    LandingPages.jsx, LandingPageEditor.jsx, PublicLandingPage.jsx
  lib/locale.js                                         # Currency helpers
/app/memory/PRD.md, test_credentials.md
/app/test_reports/iteration_{1..7}.json                 # All passing
```
