# ZeroMark — Production Deployment Checklist

**Status**: ✅ App architecture passes Emergent's native deployment audit (all URLs via env, `/api` prefix, no hardcoded values, no ObjectId leaks, CORS regex correct, all services green).

Before clicking "Deploy" on Emergent, override the following environment variables in the deployment config. Everything else (MONGO_URL, DB_NAME, REACT_APP_BACKEND_URL, CORS_ORIGINS) is auto-managed by Emergent.

## 🔴 REQUIRED overrides (security-critical)

| Env var | Preview value | **Set on deploy to** | Why |
|---|---|---|---|
| `APP_ENV` | `development` | **`production`** | Prevents `/api/auth/sms/send-otp` from echoing the OTP back in responses when Twilio is misconfigured. Also silences dev-only debug paths. |
| `ADMIN_PASSWORD` | `admin123` | **Strong 16+ char password** | The admin seed (`admin@zeromark.ai`) runs on every startup. Leaving this at default means anyone who discovers the app URL can log in as admin. Server will log a SECURITY WARNING if default is used outside dev. |
| `ADMIN_EMAIL` | `admin@zeromark.ai` | Your real admin email | So recovery/support notifications go to the right inbox. |
| `JWT_SECRET` | auto-generated in .env | **A fresh 32+ byte random string** | Rotating on deploy invalidates any leaked preview tokens. |
| `FERNET_KEY` | auto-generated in .env | **A fresh Fernet key** (`python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`) | Encrypts OAuth tokens in the DB. Rotating means preview-era tokens become unreadable (safer). Existing preview tokens will need re-binding after. |

## 🟡 RECOMMENDED overrides (feature-critical)

| Env var | Preview value | Set on deploy to | Why |
|---|---|---|---|
| `GROQ_API_KEY` | valid dev key | Your production key or **remove** | We no longer use Groq (Gemini via Emergent Key). Safe to remove if `EMERGENT_LLM_KEY` is set. |
| `EMERGENT_LLM_KEY` | `sk-emergent-…` | Same key (auto-billed by Emergent) | Powers Gemini 3 Flash for all AI features. Verify balance isn't low. |
| `LLM_PROVIDER` | `gemini` | `gemini` | Default is fine. |
| `LLM_MODEL` | `gemini-3-flash-preview` | `gemini-3-flash-preview` | Default is fine. |
| `META_ADS_MOCK_MODE` | `false` | `false` | Live mode. Users without bound Meta tokens still get safe mocks via `mock_` prefix guard. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` / `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_WHATSAPP_FROM` | preview creds | Production Twilio creds | SMS OTP + WhatsApp campaigns. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | preview | Production Razorpay | Subscription billing (Free / 499 / 999 plans). |
| `HUNTER_API_KEY` | optional | Optional | Lead enrichment; silently skips if absent. |
| `GEMINI_API_KEY` | optional | Optional | Only needed if using Gemini direct (we use Emergent Key instead). |

## ✅ ALREADY production-ready

- No hardcoded URLs in frontend or backend (all `process.env.REACT_APP_BACKEND_URL` / `os.environ.get(...)`)
- All API routes prefixed with `/api` (only `@app.on_event` hooks are on the app directly — correct)
- MongoDB `_id` excluded from every endpoint response (verified 0 leaks on `/leads`, `/campaigns`, `/competitors`, `/business`)
- CORS regex allows any `*.emergentagent.com` subdomain (preview + production)
- MongoDB indexes created on startup (`users.email`, `leads.email`, `campaigns.user_id`, `ad_campaigns`, `otp_codes.phone`, etc.)
- WeasyPrint + Motor + emergentintegrations pinned versions in `requirements.txt`
- APScheduler runs 5 cron jobs in-process (daily_briefings 08:00, imap_poll */15min, forecast_alerts 18:00, auto_publish */15min, auto_daily_content 09:30). Will run on whatever single backend replica is active — safe for single-replica deploy.

## ⚠️ Post-deploy smoke test (2 minutes)

1. Visit deployed URL → should see landing page
2. Click "Sign in" → login as the **new** admin (not admin123)
3. Go to `/admin/platform-setup` → verify `META_ADS_MOCK_MODE: false`, `APP_ENV: production`
4. Go to `/dashboard` → verify no red console errors
5. Click Chatbot widget → say "hi" → confirm Gemini responds
6. Create a test lead, test campaign → verify save
7. Log out → verify redirect to /login and `/dashboard` bounces back

## 🔁 Post-deploy user migration

If you had real users in preview, they will NOT be migrated — Emergent uses a fresh MongoDB. Export users from preview MongoDB if needed:

```bash
mongoexport --uri="$MONGO_URL" --db=$DB_NAME --collection=users --out=users.json
```

Then `mongoimport` into production via Emergent's shell once deployed.

---
_Last updated: Iter 30 (May 2026)_
