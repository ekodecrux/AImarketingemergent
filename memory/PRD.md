# ZeroMark AI — Product Requirements Document

## Iter 33 (May 2026) — Option C shipped: Email/SMS/WhatsApp prominence + LIVE vs SETUP clarity
User: "enable option c, meanwhile I'll complete option A" — make Email/SMS/WhatsApp feel instantly ready, social channels clearly "needs setup".

**Connect page (`/connect`)**
- **New green "Ready to run campaigns right now" banner** — bright gradient callout with CheckCircle icon, copy: "Email · SMS · WhatsApp are live and real. No setup needed. Start with what's working. Your first campaign can go out in under 2 minutes." + primary "Create Campaign" CTA deep-linking to `/campaigns`. `data-testid="ready-now-banner"`.

**Campaigns create + edit modals**
- **LIVE vs SETUP pills on channel picker** — Email/SMS/WhatsApp get a green "LIVE" badge top-right; Facebook/Instagram/LinkedIn get amber "SETUP" badges.
- **Inline warning** when a SETUP channel is picked: "⏳ This channel requires platform setup. Campaign will save but can't be sent yet. Your admin needs to register the Developer App at `/admin/platform-setup`. Meanwhile, Email / SMS / WhatsApp send for real today."

**Documentation**
- Created `/app/docs/PLATFORM_SETUP_GUIDE.md` — step-by-step guide for the platform owner to register LinkedIn (~15min), Meta FB+IG (~25min, one app covers both), and X/Twitter (~10min, free tier) Developer Apps. Each section has portal URLs, products to request, callback URLs, required permissions, approval timelines. Gives the user a clear self-serve path for Option A while Option C keeps the app usable today.

**Verification**
- Playwright: ready-now-banner rendered + Create Campaign CTA present; 4 LIVE + 3 SETUP pills rendered in channel picker; setup warning shown after clicking LinkedIn channel.

## Iter 32 (May 2026) — Nav regression fix + comprehensive audit
**User report**: "add campaign option itself gone... you are breaking existing functionality which is not correct"

**Root cause**: In iter25 I simplified the sidebar into 4 groups (Home/Grow/Engage/Settings) and accidentally dropped the "Campaigns" link from the Engage group. Only "Ad Campaigns" (paid Meta) stayed. The `/campaigns` page existed but was orphaned — reachable only by typing the URL. I also discovered `LandingPages` + `LandingPageEditor` components were imported in App.js but had NO `<Route>` defined (dead code from iter pre-25).

**Fixes**
- **`AppLayout.jsx`**: Added `Campaigns` (PaperPlaneTilt icon, `data-testid="nav-campaigns"`) and moved `Approvals` into the Engage group. Deduped `Approvals` from Home.
- **`App.js`**: Added the missing `/landing-pages` and `/landing-pages/:id` routes (deduped after an earlier search_replace accidentally doubled them).
- **Audit automated**: comm-diff of `grep 'path="/'` in App.js vs `grep 'to: "/'` in AppLayout.jsx — ran as a pre-finish check. Now 100% parity for user-facing routes (admin routes intentionally under Admin group).

**Verification** (`/app/test_reports/iteration_32.json`)
- 15/15 backend pytest PASS (login, auth, leads, CSV import, campaign create+approve-and-send+duplicate+boost, scraping, competitors, AI generate, quick-plan, assistant chat via Gemini, autopilot)
- 19/19 sidebar links (18 user + 1 admin) resolve to their pages without 404 or error boundary
- Real email delivered to ekodecrux@gmail.com via `approve-and-send` — campaign transitioned PENDING → SENT with `sent_count >= 1`

**Reusable regression**: `/app/backend/tests/test_iter32_regression.py` — covers 15 critical paths in ~70s for future sanity checks.

## Iter 31 (May 2026) — Campaign delivery UX + Connect Channels clarity
**User report**: "users not allowed to add connections, email campaign created but not sent, what to do to make campaigns successful"

**Root-cause analysis**
1. **"Not sent" campaigns** — SMTP was correctly configured (`GMAIL_SENDER_EMAIL` + app password in .env), verified by sending a real smoke-test email successfully. The real issue was **UX confusion**: new campaigns go to `PENDING_APPROVAL` by design (team-safety), but for solo operators there was no clear next-step CTA. Users saw a "Campaign sent for approval" toast and thought the campaign was delivered — it was actually just sitting in /approvals unanswered. `sent_count: 0` on "SENT" campaigns meant approvals were triggered but delivery produced 0 matches (no leads + manual-recipient mode with blank lists).
2. **"Not allowed to add connections"** — this is correct gating behavior. LinkedIn/FB/IG/X cards show "AWAITING PLATFORM SETUP" until the Super Admin registers developer apps at `/admin/platform-setup`. No UX guidance was visible for NON-admin users explaining this.

**Fixes**
- **New `POST /api/campaigns/{cid}/approve-and-send`** — one-click self-approve + dispatch for solo operators. Marks the approval record as `self_approved=true`, transitions campaign PENDING → SENDING → SENT, writes activity log.
- **Frontend `Campaigns.jsx`**: PENDING_APPROVAL cards now show a **prominent blue "Approve & Send"** primary button with a small pencil Edit icon as secondary. Users don't need to visit `/approvals` for their own campaigns anymore.
- **Banner on Campaigns page** — surfaces counts of pending campaigns ("📮 8 campaigns waiting") AND zero-recipient SENT campaigns ("⚠️ 2 campaigns marked SENT but reached 0 recipients") with guidance on how to fix each.
- **Connect Channels non-admin banner** — explains clearly to non-admin users: "LinkedIn/FB/IG/X coming soon. **Email + SMS + WhatsApp work today — no connection needed.** Head to Campaigns to start."

**Verification**
- curl → `POST /campaigns/{cid}/approve-and-send` → 200, campaign transitioned to SENT with `sent_count=1` (real email delivered to ekodecrux@gmail.com via Gmail SMTP).
- Playwright → 8 Approve & Send buttons rendered, banner text verified correct.

## Iter 30 (May 2026) — "Boost this campaign" — one-click organic→paid amplification
User requested: convert winning SENT email/social campaigns into Meta Ad drafts automatically.

**Backend**
- **New `POST /api/campaigns/{cid}/boost`** — takes a SENT/APPROVED/MODIFIED campaign and creates a PAUSED Meta Ads Campaign + AdSet. Reuses the campaign's `subject` (→ ad headline) and `content` (→ ad copy) so no re-authoring. Objective auto-chosen: `OUTCOME_ENGAGEMENT` for social (FB/IG/LinkedIn), `OUTCOME_TRAFFIC` for email. Defaults: ₹500/day × 7 days (editable). Geo-targets the user's country_code. Fails fast if Meta Ad Account not connected ("bind your account in Connect Channels → Meta Ads"). Rejects non-sent/non-approved campaigns with 400.
- **Persistence** — writes an `ad_campaigns` row with `source_campaign_id`, `source_campaign_name`, `ad_copy`, `ad_headline` for audit; also patches the source campaign with `boosted_ad_id` + `boosted_at` for UI badge.
- **Notifications + activity log** — in-app notification + `campaign.boosted` activity event.

**Frontend (`Campaigns.jsx`)**
- **Boost button** (Rocket icon, blue outline) appears ONLY when: `status === SENT` AND channel ∈ {EMAIL, FACEBOOK, INSTAGRAM, LINKEDIN} AND not already boosted. One-click with confirm dialog summarizing defaults.
- **Boosted badge** — once boosted, the Boost button is replaced by a "⚡ BOOSTED" pill showing the boost date. `data-testid="boosted-badge-<id>"`.
- **Toast with deep-link** — success toast offers "Open" action to `/ad-campaigns`.

Testing verified via curl: SENT → 200 with paused Meta Ad (mock mode since admin has placeholder token), PENDING_APPROVAL → 400, source campaign shows `boosted_ad_id`. Playwright confirms 2 boost buttons + 1 boosted badge in UI.

## Iter 29 (May 2026) — 4 user-reported auth/onboarding bugs
User: "1. No Sign-Up option. 2. SMS OTP not working for unregistered numbers. 3. Admin logout doesn't work. 4. Google login onboarding 'What's your goal' doesn't complete."

**Fixes**
- **Issue 1 (Sign-up visibility)** — Login page CTA changed from subdued "Start free trial" to prominent bold "Sign up free · 14 days, no card" with "New to ZeroMark?" prefix for clarity.
- **Issue 2 (SMS OTP)** — Already addressed in iter25 (`/auth/sms/verify-otp` returns 403 for unregistered phones with message "No ZeroMark account found — register first with email, add phone in Settings"). Verified toast surfaces cleanly via `SmsAuthForm` handler.
- **Issue 3 (Admin logout)** — Root cause: `AdminLayout.logout` cleared localStorage/cookies but did NOT reset the `AuthContext.user` state, so the React app kept rendering authenticated surfaces even after backend cookie was cleared. **Fix**: `AdminLayout` now imports and calls `useAuth().logout()` (the single source of truth) which resets user state + wipes all token surfaces + hits backend `/auth/logout`. Playwright verified: clicking admin-logout → /login, and subsequent `/dashboard` access redirects back to `/login`.
- **Issue 4 (Google onboarding stuck)** — Root cause: step 3's `runAutopilot` hit default axios timeout (often <autopilot duration of 30-90s for multi-AI calls); any error left the user stuck on step 3. **Fixes**:
  - Extended timeout to 180s
  - Graceful fallback: on rate-limit/timeout/any error → toast "Autopilot hit a snag — your target was saved. Continuing to dashboard." → auto-navigate to `/dashboard` after 1.5s
  - Added persistent **"Skip — go to dashboard now"** button on step 3 so users never feel trapped
  - Note: since iter25, Google callback never returns `is_new=true` (no auto-create), so new users reach onboarding only via email registration — but the same fix applies to all paths.

## Iter 28 (May 2026) — Meta Ads live + server.py split deferred
- **`META_ADS_MOCK_MODE=false`** added to `/app/backend/.env`. Verified `/api/ad-platform/accounts` now returns `mock_mode: false`. Safe because `_meta_post` / `_meta_get` still short-circuit to mocks when a user's token starts with `mock_` — only users who bound real tokens via `/api/integrations/meta-ads/bind` (iter22 flow) will execute live Graph API calls.
- **`server.py` split — DEFERRED to P3 backlog.** Rationale: the file (~7820 lines) is working perfectly and carries heavy intertwining (APScheduler registrations, 20+ helper fns, shared globals). Splitting mid-session risks regressions with zero user-facing benefit. Will revisit as a dedicated refactor sprint with clean git history between each extraction (auth → locale → leads → campaigns → ai → scheduling).

## Iter 27 (May 2026) — P2 cleanup: Campaign Edit, Auth 403 UX, LLM rename
- **`PATCH /api/campaigns/{cid}`** — edit in-place while PENDING_APPROVAL (name, channel, subject, content, all recipient targeting fields). Derives `type` from `channel` automatically. Blocks edits once APPROVED/SENT/FAILED with a 400 ("Duplicate it to make changes."). Mirrors content/subject/channel into the linked `db.approvals` record.
- **Frontend Edit modal** on `/campaigns` — new `EditCampaignModal` opens with full pre-filled state (channel, scope, statuses, lead IDs, extra_recipients CSV). `data-testid="edit-campaign-<id>"` appears only for PENDING_APPROVAL cards. Full recipients picker identical to Create.
- **Friendly 403 toast/copy** — `AuthCallback` now detects `err.response.status === 403` and surfaces "No ZeroMark account found — register first, then sign in with Google" with a prominent "Register instead" CTA. `SmsAuthForm` does the same for SMS 403 via an 8-second toast.
- **`_groq_chat` → `_llm_chat`** — cosmetic rename across server.py (replace_all); function name now accurately reflects the Gemini routing done in iter25.

Test verifications: PATCH PENDING_APPROVAL → 200 with merged state; PATCH SENT → 400 "Cannot edit"; quick-plan generate still 200 after rename; UI shows 7 edit buttons on `/campaigns`, modal opens with pre-filled name verified via Playwright.

## Iter 26 (May 2026) — 8-issue sweep: scrape + bulk upload + competitor scan + campaign recipients/duplicate
User bug report (8 items): (1) Quick Plan "AI busy", (2) menu not frozen, (3) Lead Scrape broken, (4) no bulk upload, (5) can't add lead, (6) competitor scan broken, (7) no receiver selector on campaigns, (8) no manage/rerun campaigns.

**Status**: Items 1+2 already resolved in iter25. This iter fixes 3–8.

**Backend fixes**
- **Competitor scan NameError fix** (`_scrape_url_quick`, server.py ~L4075–4115): replaced orphaned `r.url` with the `final_url` tuple returned by `_fetch_website_resilient`. Scan now returns clean 200 with title/meta/h1s/AI analysis. (Critical bug.)
- **Campaign recipient targeting**: `CampaignIn` extended with `recipient_scope` (`all_leads | by_status | selected | manual`), `recipient_statuses[]`, `recipient_lead_ids[]`, `extra_recipients[]` (free-form emails/phones). `_run_campaign_send` honors the scope — filters leads by status/IDs or sends to manual list; `extra_recipients` are merged as pseudo-leads with email OR phone.
- **Campaign duplicate/rerun**: new `POST /api/campaigns/{cid}/duplicate` — clones the full campaign (content, subject, scope, recipients) into a fresh PENDING_APPROVAL with `(copy)` suffix and separate approval record. Used for both "Duplicate" and "Rerun" flows.
- Cleanup: removed a leftover duplicated `shutdown()` + admin seed block at EOF (indentation error was preventing clean startup after the swap).

**Frontend additions**
- **`Leads.jsx` — Bulk Upload**: new `BulkUploadModal` (multipart CSV → `/api/leads/import-csv`) with inline guide (headers, 5MB/5K cap), result card with imported/skipped/rejected counts, Escape-to-close, auto-close 1.5s after success. `data-testid="open-bulk-upload-modal"`, `"bulk-upload-file"`, `"bulk-upload-submit"`.
- **`Campaigns.jsx` — Recipients selector**: 4-way scope picker (All leads / By status / Pick leads / Manual entry) with contextual controls: status multi-check, scrollable lead list (loaded from `/leads?limit=100`), manual textarea for comma/newline-separated emails or phones. Summary line tells user exactly how many recipients will be hit.
- **`Campaigns.jsx` — Duplicate + Rerun**: Card actions now show a Copy icon ("Duplicate") for any campaign, and a prominent "Rerun" button for SENT/FAILED campaigns — both POST `/campaigns/{cid}/duplicate`.

**Test report:** `/app/test_reports/iteration_24.json` — 9/9 backend pytest pass (covers all 6 fix paths + iter25 regression), frontend flows verified (bulk upload e2e, Add Lead modal, scope picker rendering).

## Iter 25 (May 2026) — Auth hardening, IN/INR defaults, Groq→Gemini swap, 4-group nav
User prompt: "complete fixes.. make it more user intuitive flow ... no confusion, no multiple menus navigation... Also groq AI gives limit issues.. what is alternative"

**Backend**
- **LLM swap** — `_groq_chat` now routes through Emergent LLM Key → **Gemini 3 Flash** (`gemini-3-flash-preview`). Legacy function signature preserved so all 12+ callsites (quick plan, ICP, content, market research, PR outlets, assistant chat, copilot, etc.) continue to work without changes. JSON-mode enforced via system-prompt contract + markdown-fence stripping. Rate-limit detection converts provider 429/quota errors into clean HTTPException 429.
- **assistant_chat** rewritten to use `LlmChat` with per-user session_id (`assistant-{user_id}`) + recent-history injected into system prompt for grounding.
- **Locale defaults** — `_resolve_locale` now falls back to `IN` (INR, ₹) instead of `US`. `/auth/register` already persists `country_code=IN, currency_code=INR` for new users. `/api/locale/me` for a fresh user returns India.
- **Google OAuth restriction** — `/auth/google/callback` no longer auto-creates users. Unknown email → 403 "No ZeroMark account found. Please sign up first, then sign in with Google." Existing-user sign-in unchanged.
- **SMS OTP restriction** — `/auth/sms/verify-otp` no longer auto-creates users. Unknown phone → 403 "No account found. Please sign up first with email."
- **Logout hardening** — `/auth/logout` now accepts optional auth (`get_current_user_optional`), clears cookies for `/` and `/api` paths (both `access_token` and `zm_token`), audit-logs the event if authenticated, sets `no-store` cache headers. Works identically for user/admin/owner roles.

**Frontend**
- **4-group sidebar** (`AppLayout.jsx`) — collapsed from 6+ sections into `Home · Grow · Engage · Settings` (+ `Admin` only for admins). Section icons added for visual cues. Kept all existing data-testids.
- **Frozen sidebar layout** — root is `h-screen flex overflow-hidden`; `<aside>` is `lg:h-screen shrink-0` with its own `overflow-y-auto` nav; `<main>` has `h-screen overflow-y-auto` so ONLY the main content scrolls, sidebar stays locked.
- **AdminLayout.jsx** — same freeze treatment (dark sidebar `sticky h-screen`, main `overflow-y-auto h-screen`). Admin logout now calls `/api/auth/logout` (parity with user logout) and wipes cookies/localStorage before redirect.
- **AuthContext.jsx** — `logout()` wipes `localStorage`, `sessionStorage`, and every cookie surface (`/`, `/api` paths) so no stale session lingers.

**Test report:** `/app/test_reports/iteration_23.json` — 10/10 backend pytest pass, full frontend flows verified (sidebar freeze bbox check, 4-group visibility, logout redirect, Gemini-backed chatbot with India context).

## Iter 24 (May 2026) — Sprint A+B+C: 11 low-hanging-fruit items from gap analysis
User picked **Sprint A + B + C** (~4.5 hrs) from 31-item gap analysis:

**Sprint A — Trust & Safety (backend + UI)**
- AT-01: `POST /business` accepts 4 new fields (`approval_required_blog/social/email/paid`); `_publish_scheduled` enforces per-channel approval gate before any provider HTTP call.
- AT-02: New `_content_safety_check()` regex filter — profanity, medical/health claims, financial-return claims, pricing-without-disclaimer, competitor mentions >2x. Blocked posts land in approvals queue with `safety_issues` list.
- AT-03: Ad-sync now enforces 110% circuit breaker — auto-pauses ALL of user's active campaigns, audit-logs incident, alerts via in-app + email + Slack.
- CH-04: `/integrations/health` enriches every social channel with `last_publish_at`, `success_rate_30d`, `publishes_30d`, `token_expires_at`, `token_expires_in_days`, `stale_warning`, `token_expiry_warning`. UI surfaces inline via Channel Health Widget.

**Sprint B — Content quality**
- CQ-02: `BusinessProfileIn` accepts `brand_tone`, `brand_voice_examples[]`, `brand_forbidden_words[]`. New `_brand_voice_block()` injects these into every AI prompt (content/generate, plans, ICP, market, etc).
- CQ-03: Content/generate prompt now mandates a final `## Sources & Citations` H2 with 3-5 high-authority references.

**Sprint C — Retention surfaces**
- GL-01: `/quick-plan/generate` returns `confidence_score` (70-100), `confidence_band` (high/medium/low), `confidence_factors{margin_ratio, channel_diversity, budget_score}`. UI: animated confidence bar in Lead Guarantee card.
- OB-04: New `POST /onboarding/wizard-resume` clears dismissal. New `ResumeOnboardingBanner` on dashboard sticky for users who dismissed wizard mid-way.
- UX-01: New `/api/activity/recent` endpoint + new `_log_activity()` helper. `ActivityFeed` widget on dashboard with 60s auto-refresh, kind-aware icons + colors.
- PR-02: New `/api/quota/status` endpoint. `QuotaBanner` warns at 80%, hard-blocks at 100% with one-click upgrade CTA.

**Bonus — Lead acquisition coverage (per user's investor-readiness comment)**
- New `POST /api/leads/import-csv` — multipart upload, header normalization (any case/order), 5K row cap, 5MB cap, in-file dup detection + cross-workspace dup skip, rejection sample for debugging.

**Investor brief regenerated** — `/app/docs/ZeroMark_Investor_Pitch.pdf` (84 KB) and `/app/docs/ZeroMark_OnePager.pdf` (40 KB) now include "7.1 Enterprise-Readiness Posture" section + updated Production-Readiness checklist. Independently audited at 95% confidence — no rendering issues, all sections present.

**Test report:** `/app/test_reports/iteration_22.json` — 8/10 backend pass, 2 environmental skips (Groq TPD limit, signup disabled in preview env). Full frontend regression clean.

## Iter 23 (May 2026) — Onboarding Wizard (4-screen first-login walkthrough)
User: "Onboarding wizard: 4-screen first-login walkthrough (Profile → Connect 1 channel → Quick Plan → First post) — biggest activation lever."

**Backend**
- `GET /api/onboarding/wizard-state` — returns `{show_wizard, dismissed, completed, step_done:{profile, channel, plan, first_post}, next_step, completed_count, total_steps}`. Auto-detects completion from existing data (business_profiles, integrations, growth_plans, content_schedules), so the wizard intelligently auto-jumps past already-done steps.
- `POST /api/onboarding/wizard-dismiss` and `POST /api/onboarding/wizard-complete` — persist state on user doc; survive across logins, prevent re-show.

**Frontend**
- New `OnboardingWizard` modal mounted in `AppLayout` — auto-shows on `/dashboard` for any user where `show_wizard=true`. Dark hero, segmented progress bar (green=done, white=current, gray=todo), 4 step cards with icons + "est time" labels.
- **Step 1 — Profile**: name + industry + target audience + website. Saves to `/business`, auto-triggers background plan regeneration (Iter 19 hook).
- **Step 2 — Channel**: visual brand chips (LinkedIn / X / Facebook), explainer "Awaiting platform setup" warning, deep-link to `/connect`. Skippable.
- **Step 3 — Quick Plan**: budget + duration → calls `/quick-plan/generate` → renders guaranteed-leads summary inline.
- **Step 4 — First post**: generates topical content via `/content/generate` (uses industry-aware topic), schedules 30 min from now via `/schedule` on every healthy channel (falls back to blog if none connected).
- Sticky footer: Skip onboarding (left) · Back / Continue / Finish (right). X close in header.
- Test report: `/app/test_reports/iteration_14.json` — 9/9 backend pytest pass, full frontend regression clean, multi-tenant isolation verified.

## Iter 22 (May 2026) — From demo to real, end-to-end (E + B sprint)
User asked to ship dashboard widget first (E), then Phase 2+3+4 sprint (B). Tested 25/25 backend + full frontend regression.

**E — Dashboard Channel Health widget**
- New `ChannelHealthWidget` mounted on `/dashboard` below stat grid: 5 colored channel dots (LinkedIn / X / Facebook / Instagram / Meta Ads), per-channel status sub-label, 60s auto-refresh, "needs attention" callouts with inline Reconnect deep-links to `/connect`. Only surfaces user-facing OAuth channels (not platform-wide services).

**Phase 2 — Real Instagram + Facebook Page picker**
- `_publish_to_instagram` rewritten as real Meta Graph 2-step flow: (1) `POST /{ig-user-id}/media` with `image_url` + caption → creation_id, (2) `POST /{ig-user-id}/media_publish` → live post. Falls back to placeholder OG image if no image in content kit.
- `_publish_to_facebook` accepts `selected_page_id` for users with multiple Pages.
- New `GET /api/integrations/facebook/pages` returns user's Pages (encrypted Page tokens stripped from response).
- New `POST /api/integrations/facebook/select-page` lets user choose default Page.
- Publisher dispatcher passes `selected_page_id` from `db.integrations.facebook.selected_page_id`.
- New `FacebookPagePicker` component embeds inside the Facebook card on `/connect` (only renders when ≥2 Pages exist).

**Phase 3 — Real Meta Ads (per-user)**
- New `POST /api/integrations/meta-ads/bind` — verifies token has `ads_management` scope via `/me/permissions`, validates Ad Account is active via `/{ad_account_id}` (status, currency, name), stores encrypted, sets per-user `mock_mode=false`.
- `_meta_post`/`_meta_get` refactored: dropped the global `META_MOCK_MODE` short-circuit; now ONLY token prefix `mock_` triggers mocking. Real bound tokens go live regardless of global flag — safe per-user gradual rollout.
- New `MetaAdsBindForm` component — 5-step setup card with deep-links to Business Manager + Ad Accounts, encrypted password input, `act_…` regex validation, encryption notice.

**Phase 4 — Hunter.io + Razorpay live swap**
- New `POST /api/integrations/hunter/bind` — verifies via `/v2/account`, stores plan + remaining quota.
- Lead enrichment (`/api/leads/{id}/enrich-domain`) now runs Hunter+AI HYBRID: Hunter `/v2/domain-search` for company info + headcount + tech stack, `/v2/email-finder` for likely role, AI fills gaps. Falls back gracefully to AI-only when no Hunter key bound.
- New `POST /api/admin/razorpay/swap-live` (admin-only) — verifies live keys against Razorpay before persisting to `db.platform_config`, swaps in-memory env, survives backend restart via startup loader.
- New `HunterBindForm` component on `/connect` Tier 3 "Power-ups" section.

**Test report:** `/app/test_reports/iteration_13.json` — 25/25 backend pytest pass, frontend renders verified, no token leaks, admin gating correct, AI-only enrichment fallback verified.

## Iter 21 (May 2026) — Multi-tenant clarity: Platform Setup vs User Connect
User concern: "If I have 100s of users, won't pasting Developer App credentials become painful for the platform owner?"
Answer: It's a one-time setup — one LinkedIn / X / Meta Developer App per provider serves thousands of customers. Each customer just OAuths through the platform's app in 30 seconds. We made this clear in the UI:

**Backend**
- New `GET /api/admin/platform-setup` (admin-only) — returns Developer App configuration status for LinkedIn / X / Meta, plus platform service status (Groq, Gmail, Twilio, Razorpay, Fernet). Includes callback URLs, required scopes, products to enable, and env-key names. Never exposes secret values.
- `GET /api/integrations/health` enhanced — every channel now includes `provider_configured` flag. When false, marks status as "Platform setup pending" so users know admin hasn't set up the Developer App yet (vs just not OAuthing personally).

**Frontend**
- `/connect` (user-facing) cleaned up: removed Developer App setup steps (those are platform-owner work, not user work). Cards now show "Awaiting platform setup" badge when provider isn't configured. Admin viewing the page sees an additional banner with "Open Platform Setup" deep-link.
- New `/admin/platform-setup` page (admin-only): hero card explaining "One Developer App per provider serves all your customers", per-provider cards with copy-to-clipboard callback URL, required scopes, products to enable, env-key reference, 5-6 step guide with deep-links to LinkedIn/X/Meta developer portals, and platform-services grid (Groq/Gmail/Twilio/Razorpay/Fernet status).
- New "Platform Setup" entry in Admin sidebar.

## Iter 20 (May 2026) — Real Channel Connections (Phase 1 of "from demo to real")
User: "Bridge gaps in our platform to make it real. User should only spend a few minutes giving credentials with Meta + social media accounts."

**Backend**
- **Bug fix (critical)**: `_publish_to_linkedin` was hardcoding `urn:li:person:me` — now fetches real member URN from `/v2/userinfo` at OAuth callback time and stores `linkedin_urn` + `linkedin_sub`. Lazy fallback fetch on publish.
- **Bug fix (critical)**: Publisher dispatcher (`_run_due_schedule`) read tokens from `db.oauth_tokens` (empty), but OAuth callback wrote to `db.integrations`. Fixed: publisher now reads canonical `db.integrations`.
- **New**: `_publish_to_facebook` — real Graph API publishing using long-lived Page Access Token. OAuth callback now also fetches user's Facebook Pages (`/me/accounts` with `id,name,access_token,instagram_business_account`) and stores them encrypted.
- **New**: `GET /api/integrations/health` — live verification per channel (LinkedIn `/v2/userinfo`, Twitter `/2/users/me`, Facebook page list, env-checked platform channels for Gmail/Twilio/Razorpay/Meta Ads). Returns `{connected, healthy, status_label, message, account_label}` per channel.
- **Updated**: `SUPPORTED_PLATFORMS` now includes `facebook`.

**Frontend — `/connect` Connect Channels page**
- Dark hero with live "X of Y channels live" counter
- Tier 1 (5-min OAuth setup): LinkedIn, X, Facebook, Instagram, Meta Ads — each with brand-colored card, status pill (Live ✓ / Token stale ⚠ / Not connected ✗), Connect/Reconnect/Disconnect buttons, expandable Setup Guide with numbered step-by-step instructions + "Open" deep-links to LinkedIn/Twitter/Meta developer portals
- Tier 2 (platform-wide): Gmail SMTP, Twilio SMS, Twilio WhatsApp, Razorpay — info-only cards showing live env-detected status
- Sidebar: New "Connect Channels" entry with REAL badge; old `/integrations` page kept as legacy
- Route: `/connect` mounted under AppLayout

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
