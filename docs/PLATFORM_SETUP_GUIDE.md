# ZeroMark — Platform Owner: Register Social Developer Apps

Follow these 3 one-time steps to unlock LinkedIn / Facebook / Instagram / X for ALL your customers. After registration, each customer OAuths in 30 seconds — no technical work for them.

---

## 📘 LinkedIn (~15 min)

1. Go to **https://www.linkedin.com/developers/apps** → Create app
   - App name: `ZeroMark`
   - LinkedIn Page: pick any page you own (or create one)
   - Privacy policy URL: `https://YOUR_DOMAIN/privacy` (works with placeholder for dev)
   - Logo: upload any 100×100 PNG
2. Go to **Products** tab → Request access:
   - ☑ **Sign In with LinkedIn using OpenID Connect**
   - ☑ **Share on LinkedIn**
3. Go to **Auth** tab → add **Authorized redirect URL**:
   ```
   https://YOUR_DOMAIN/api/oauth/linkedin/callback
   ```
   (Your admin console auto-generates the correct URL — just copy-paste it)
4. Copy **Client ID** + **Client Secret** → paste into ZeroMark `/admin/platform-setup` → LinkedIn card → Save
5. Users now see a green "Connect LinkedIn" button on `/connect` instead of "AWAITING PLATFORM SETUP"

---

## 📘 Meta (Facebook + Instagram) (~25 min — one app covers both)

1. Go to **https://developers.facebook.com/apps** → Create App → **Business** type
   - App name: `ZeroMark`
   - Business portfolio: pick yours (or create one in Meta Business Suite)
2. Add Products → click "Set Up" on:
   - ☑ **Facebook Login for Business**
   - ☑ **Instagram Basic Display**
   - ☑ **Marketing API** (only if you want paid ads — skip if organic-only)
3. App Settings → Basic → copy **App ID** + **App Secret**
4. Facebook Login → Settings → add **Valid OAuth Redirect URIs**:
   ```
   https://YOUR_DOMAIN/api/oauth/meta/callback
   ```
5. Required permissions (for App Review before going public):
   - `pages_manage_posts`, `pages_read_engagement` (Facebook Pages)
   - `instagram_basic`, `instagram_content_publish` (Instagram)
   - `ads_management` (only if doing paid ads)
6. Paste App ID + Secret into ZeroMark `/admin/platform-setup` → Meta card → Save
7. Meta approval takes 5–7 business days — you can test with up to 25 users (added to "Roles → Testers") before approval

---

## 🐦 X (Twitter) (~10 min — free tier)

1. Go to **https://developer.twitter.com/en/portal/projects-and-apps** → Sign up for free
2. Create Project → Create App inside it
3. App Settings → **User authentication settings** → Set up:
   - **App permissions**: Read and Write
   - **Type of App**: Web App
   - **Callback URI**: `https://YOUR_DOMAIN/api/oauth/twitter/callback`
   - **Website URL**: `https://YOUR_DOMAIN`
4. Keys and Tokens → generate **OAuth 2.0 Client ID** + **Client Secret**
5. Paste into ZeroMark `/admin/platform-setup` → X card → Save

---

## ✅ After each provider is registered

The corresponding card on `/connect` for every user (including yourself) will change:
- `AWAITING PLATFORM SETUP` → `Connect <Provider>` (green button)
- User clicks → OAuth popup (30 seconds) → channel goes LIVE
- Campaigns with that channel now send for real

---

## ⚡ Meanwhile (today, no setup needed)

These 3 channels are already LIVE and real:

| Channel | Provider | Status |
|---|---|---|
| Email | Gmail SMTP (configured) | ✅ Verified working — real email delivered |
| SMS | Twilio (configured) | ✅ Verified working (used for OTP) |
| WhatsApp | Twilio Sandbox | ✅ Ready (recipients must opt-in via Twilio sandbox code) |

Go to `/campaigns` → Create Campaign → pick Email/SMS/WhatsApp → Approve & Send. Done.

---

_ZeroMark multi-tenant OAuth architecture: platform owner registers once, all customers benefit forever._
