"""ZeroMark AI - Iteration 3 backend tests.

Covers:
- Business profile auto-fill from website URL (Groq parse + live fetch)
- Market analyse + latest
- SEO (keywords, backlinks, content-gaps)
- PR (press release, media list, outreach email)
- 12-month growth plan generate + latest
- Inbound Twilio SMS webhook (no auth, form-encoded) + communications inbox
- Integrations encryption at rest
- Regression on auth + dashboard + leads + briefing
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "zeromark_ai")


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Cannot login as admin (status={r.status_code}): {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_user_id(session, auth_headers):
    r = session.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    return r.json()["user"]["id"]


@pytest.fixture(scope="session")
def ensure_business_profile(session, auth_headers):
    """Make sure admin has a business profile so AI prompts have context."""
    r = session.get(f"{API}/business", headers=auth_headers)
    if r.status_code == 200 and r.json().get("profile"):
        return r.json()["profile"]
    payload = {
        "business_name": "ZeroMark AI",
        "industry": "B2B SaaS",
        "location": "San Francisco",
        "target_audience": "Small business marketing teams",
        "website_url": "https://zeromark.ai",
        "description": "AI-powered B2B marketing automation."
    }
    r2 = session.post(f"{API}/business", headers=auth_headers, json=payload)
    assert r2.status_code in (200, 201), r2.text
    return payload


# ---------------- Regression: auth + basics ----------------
class TestRegressionBasics:
    def test_login_works(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 20
        assert body["user"]["email"] == ADMIN_EMAIL

    def test_register_then_me(self, session):
        suffix = uuid.uuid4().hex[:10]
        email = f"test_iter3_{suffix}@example.com"  # email is normalised to lowercase server-side
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "first_name": "T", "last_name": "U"
        })
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        me = session.get(f"{API}/auth/me", headers=h)
        assert me.status_code == 200
        assert me.json()["user"]["email"].lower() == email.lower()

    def test_dashboard_stats(self, session, auth_headers):
        r = session.get(f"{API}/dashboard/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        # Must contain at least one expected key
        assert any(k in data for k in ("total_leads", "stats", "leads"))

    def test_leads_list(self, session, auth_headers):
        r = session.get(f"{API}/leads", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "leads" in body and isinstance(body["leads"], list)


# ---------------- Business auto-fill ----------------
class TestAutoFill:
    def test_auto_fill_from_url(self, session, auth_headers):
        r = session.post(f"{API}/business/auto-fill", headers=auth_headers,
                         json={"website_url": "https://stripe.com"}, timeout=60)
        # Must NOT crash. Either AI extraction succeeds or website fetch fails (400).
        assert r.status_code in (200, 400), f"Unexpected status {r.status_code}: {r.text[:300]}"
        if r.status_code == 400:
            # Acceptable: outbound fetch to public sites may be blocked / rate-limited
            assert "Could not fetch website" in r.json().get("detail", "")
            return
        body = r.json()
        assert "profile" in body
        prof = body["profile"]
        # Required keys per problem statement
        for k in ("business_name", "industry", "description", "website_url", "key_offerings", "competitors"):
            assert k in prof, f"missing key {k} in profile: {prof}"
        assert prof["website_url"].startswith("http")
        assert isinstance(prof["key_offerings"], list)
        assert isinstance(prof["competitors"], list)


# ---------------- Market analysis ----------------
class TestMarket:
    def test_market_analyze_and_latest(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/market/analyze", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text
        record = r.json()["analysis"]
        assert "id" in record and "data" in record
        data = record["data"]
        for k in ("market_size", "growth_rate", "trends", "competitors", "swot",
                  "positioning_recommendation", "unique_angles", "immediate_actions"):
            assert k in data, f"market analysis missing key {k}"
        assert isinstance(data["trends"], list) and len(data["trends"]) >= 1
        assert isinstance(data["competitors"], list) and len(data["competitors"]) >= 1
        # Validate competitor object shape
        c0 = data["competitors"][0]
        assert all(k in c0 for k in ("name", "strengths", "weaknesses", "positioning"))
        # SWOT shape
        for k in ("strengths", "weaknesses", "opportunities", "threats"):
            assert k in data["swot"]

        # latest
        r2 = session.get(f"{API}/market/latest", headers=auth_headers)
        assert r2.status_code == 200
        latest = r2.json()["analysis"]
        assert latest is not None and latest["id"] == record["id"]


# ---------------- SEO toolkit ----------------
class TestSEO:
    def test_seo_keywords(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/keywords", headers=auth_headers,
                         json={"seed_keyword": "b2b marketing"}, timeout=120)
        assert r.status_code == 200, r.text
        kws = r.json()["keywords"]
        assert isinstance(kws, list) and len(kws) >= 10
        sample = kws[0]
        for k in ("keyword", "intent", "difficulty", "volume_band", "opportunity_score", "category"):
            assert k in sample, f"keyword missing field {k}: {sample}"

    def test_seo_backlinks(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/backlinks", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text
        ops = r.json()["opportunities"]
        assert isinstance(ops, list) and len(ops) >= 5
        s = ops[0]
        for k in ("name", "url", "domain_authority", "type", "angle", "effort", "priority"):
            assert k in s, f"backlink op missing field {k}: {s}"

    def test_seo_content_gaps(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/content-gaps", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text
        ideas = r.json()["content_ideas"]
        assert isinstance(ideas, list) and len(ideas) >= 5
        s = ideas[0]
        for k in ("title", "format", "funnel_stage", "target_keyword", "word_count_estimate",
                  "content_outline", "why_now"):
            assert k in s, f"content idea missing field {k}: {s}"
        assert isinstance(s["content_outline"], list)


# ---------------- PR & media ----------------
class TestPR:
    def test_press_release(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/pr/press-release", headers=auth_headers,
                         json={"announcement": "launched a new AI Growth Studio"}, timeout=90)
        assert r.status_code == 200, r.text
        pr = r.json()["press_release"]
        for k in ("headline", "subhead", "dateline", "body", "quote", "boilerplate", "media_contact"):
            assert k in pr, f"press_release missing key {k}: {list(pr.keys())}"

    def test_media_list(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/pr/media-list", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text
        outlets = r.json()["outlets"]
        assert isinstance(outlets, list) and len(outlets) >= 5
        o = outlets[0]
        for k in ("publication", "beat", "contact_name", "email_pattern", "reach", "angle"):
            assert k in o, f"outlet missing key {k}: {o}"

    def test_outreach_email(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/pr/outreach-email", headers=auth_headers, json={
            "journalist_name": "Jane Doe",
            "publication": "TechCrunch",
            "angle": "AI-first growth tools for SMBs",
            "announcement": "launched a new AI Growth Studio"
        }, timeout=90)
        assert r.status_code == 200, r.text
        email = r.json()["email"]
        assert "subject" in email and "body" in email
        assert isinstance(email["subject"], str) and len(email["subject"]) > 3
        assert isinstance(email["body"], str) and len(email["body"]) > 30


# ---------------- 12-month growth plan ----------------
class TestGrowthPlan:
    def test_generate_and_latest(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/growth-plan/generate", headers=auth_headers, json={}, timeout=180)
        assert r.status_code == 200, r.text
        rec = r.json()["plan"]
        assert "id" in rec and "plan" in rec
        plan = rec["plan"]
        for k in ("vision", "north_star_metric", "quarterly_themes", "monthly_milestones",
                  "hiring_plan", "marketing_mix", "key_assumptions", "success_kpis"):
            assert k in plan, f"plan missing key {k}: {list(plan.keys())}"
        assert isinstance(plan["quarterly_themes"], list) and len(plan["quarterly_themes"]) == 4
        assert isinstance(plan["monthly_milestones"], list) and len(plan["monthly_milestones"]) == 12

        r2 = session.get(f"{API}/growth-plan/latest", headers=auth_headers)
        assert r2.status_code == 200
        latest = r2.json()["plan"]
        assert latest is not None and latest["id"] == rec["id"]


# ---------------- Inbound webhook + communications inbox ----------------
class TestInboundWebhook:
    def test_webhook_with_unknown_phone_still_returns_twiml(self, session):
        """Unknown phone: webhook should still 200 with TwiML, no auth required."""
        unknown = "+15555550199"
        r = requests.post(
            f"{API}/webhooks/twilio/sms",
            data={"From": unknown, "Body": "hello there"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "<Response" in r.text
        assert "xml" in r.headers.get("content-type", "").lower()

    def test_webhook_logs_inbound_for_known_lead_then_inbox(self, session, auth_headers, admin_user_id):
        # Create a lead with a unique phone
        phone = f"+1555{uuid.uuid4().int % 10000000:07d}"
        body_text = f"TEST_iter3_inbound_{uuid.uuid4().hex[:6]}"

        lead_resp = session.post(f"{API}/leads", headers=auth_headers, json={
            "name": "TEST_iter3 Inbound",
            "phone": phone,
            "email": f"TEST_iter3_{uuid.uuid4().hex[:6]}@example.com",
            "source": "MANUAL",
            "status": "NEW",
        })
        assert lead_resp.status_code in (200, 201), lead_resp.text
        lead_id = lead_resp.json()["lead"]["id"]

        # Hit the webhook (form-encoded, no auth)
        wb = requests.post(
            f"{API}/webhooks/twilio/sms",
            data={"From": phone, "Body": body_text},
            timeout=30,
        )
        assert wb.status_code == 200
        assert "<Response" in wb.text

        # Allow a tick for the write
        time.sleep(0.5)

        inbox = session.get(f"{API}/communications/inbox", headers=auth_headers)
        assert inbox.status_code == 200, inbox.text
        msgs = inbox.json()["messages"]
        match = [m for m in msgs if m.get("content") == body_text and m.get("lead_id") == lead_id]
        assert match, f"inbound message not found in inbox; got {len(msgs)} msgs"
        m = match[0]
        assert m["direction"] == "INBOUND"
        assert m["channel"] == "SMS"

        # Lead should now be INTERESTED (was NEW)
        lead_get = session.get(f"{API}/leads/{lead_id}", headers=auth_headers)
        assert lead_get.status_code == 200
        assert lead_get.json()["lead"]["status"] == "INTERESTED"

        # Cleanup
        session.delete(f"{API}/leads/{lead_id}", headers=auth_headers)

    def test_inbox_requires_auth(self, session):
        r = requests.get(f"{API}/communications/inbox")
        assert r.status_code == 401


# ---------------- Integrations encryption at rest ----------------
class TestIntegrationsEncryption:
    SECRET_VALUE = "secret123_iter3_plaintext_marker"

    def test_post_then_get_no_token_leak(self, session, auth_headers, admin_user_id):
        r = session.post(f"{API}/integrations", headers=auth_headers, json={
            "channel": "linkedin",
            "config": {"access_token": self.SECRET_VALUE, "label": "LI test"},
            "connected": True,
        })
        assert r.status_code == 200, r.text

        r2 = session.get(f"{API}/integrations", headers=auth_headers)
        assert r2.status_code == 200
        as_text = r2.text
        # Public response must NOT contain the raw token
        assert self.SECRET_VALUE not in as_text, "raw token leaked in GET /api/integrations response"
        integ = r2.json()["integrations"]
        # Sanitised shape: only connected + label
        assert "linkedin" in integ
        li = integ["linkedin"]
        assert set(li.keys()) <= {"connected", "label"}
        assert li.get("connected") is True

    @pytest.mark.asyncio
    async def test_mongo_stores_encrypted_token(self, admin_user_id):
        """Read mongo directly to confirm access_token is encrypted, not plaintext."""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except Exception:
            pytest.skip("motor not installed in test env")
        cli = AsyncIOMotorClient(MONGO_URL)
        try:
            doc = await cli[DB_NAME].integrations.find_one({"user_id": admin_user_id})
            assert doc is not None, "no integrations doc found in mongo"
            li = doc.get("linkedin") or {}
            stored = li.get("access_token")
            assert stored is not None, f"access_token missing in stored doc: {li}"
            assert stored != self.SECRET_VALUE, "access_token is stored in plaintext!"
            # Marker we set on encrypted fields
            assert li.get("access_token__encrypted") is True
            # Fernet tokens are base64 url-safe and considerably longer than the plaintext
            assert len(stored) > len(self.SECRET_VALUE) + 20
        finally:
            cli.close()


# ---------------- Briefing regression ----------------
class TestBriefingRegression:
    def test_briefing_generate(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/briefing/generate", headers=auth_headers, json={}, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()["briefing"]["briefing"]
        for k in ("headline", "wins", "risks", "actions"):
            assert k in b, f"briefing missing key {k}"
