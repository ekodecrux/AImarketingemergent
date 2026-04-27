"""ZeroMark AI - Iteration 4 backend re-test for reliability fixes.

Validates fixes for iter3 issues:
1. Groq json_validate_failed retry-once (no flaky 500s on PR press-release)
2. SSRF protection on /api/business/auto-fill (block loopback / private / 169.254.x.x)
3. Twilio webhook phone-number normalisation
4. All AI endpoints route through _groq_chat — should never 500 with json_validate_failed
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
def ensure_business_profile(session, auth_headers):
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
    session.post(f"{API}/business", headers=auth_headers, json=payload)
    return payload


# ---------------- 1. PR press-release reliability (iter3 had 33% pass rate) ----------------
class TestPressReleaseReliability:
    """Iter3 RCA: Groq json_validate_failed bubbled up as 500. Now should retry → 200."""

    @pytest.mark.parametrize("run", list(range(5)))
    def test_press_release_repeated(self, run, session, auth_headers, ensure_business_profile):
        # Use announcement with apostrophes/quotes to provoke json_validate_failed
        announcement = (
            "launched today's new \"AI Growth Studio\" — a one-of-a-kind, founders' "
            "favourite tool for small teams' growth"
        )
        r = session.post(
            f"{API}/pr/press-release",
            headers=auth_headers,
            json={"announcement": announcement},
            timeout=120,
        )
        assert r.status_code == 200, f"run={run} status={r.status_code} body={r.text[:400]}"
        pr = r.json()["press_release"]
        for k in ("headline", "subhead", "dateline", "body", "quote", "boilerplate", "media_contact"):
            assert k in pr, f"run={run} missing key {k}"


# ---------------- 2. SSRF protection on /api/business/auto-fill ----------------
class TestSSRFProtection:
    @pytest.mark.parametrize("url", [
        "http://169.254.169.254/",
        "http://169.254.169.254/latest/meta-data/",
        "http://localhost/",
        "http://127.0.0.1/",
        "http://10.0.0.1/",
        "http://192.168.1.1/",
    ])
    def test_blocks_internal_url(self, url, session, auth_headers):
        r = session.post(f"{API}/business/auto-fill", headers=auth_headers,
                         json={"website_url": url}, timeout=30)
        assert r.status_code == 400, f"expected 400 for {url}, got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "").lower()
        assert ("not allowed" in detail) or ("private" in detail) or ("internal" in detail), \
            f"unexpected detail for {url}: {detail}"

    def test_blocks_unsupported_scheme(self, session, auth_headers):
        r = session.post(f"{API}/business/auto-fill", headers=auth_headers,
                         json={"website_url": "file:///etc/passwd"}, timeout=30)
        # Either rejected as not safe (400) — should NOT crash
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

    def test_public_url_passes_ssrf_gate(self, session, auth_headers):
        """Stripe.com is public — must NOT be blocked at SSRF gate. Accept 200 or
        downstream 400/502 (network/AI), but NEVER 500 and NEVER 'URL not allowed'."""
        r = session.post(f"{API}/business/auto-fill", headers=auth_headers,
                         json={"website_url": "https://stripe.com"}, timeout=120)
        assert r.status_code in (200, 400, 502), f"unexpected {r.status_code}: {r.text[:300]}"
        if r.status_code == 400:
            detail = r.json().get("detail", "").lower()
            assert "url not allowed" not in detail, "stripe.com wrongly classified as SSRF"


# ---------------- 3. Webhook phone normalisation ----------------
class TestWebhookPhoneNormalisation:
    def test_formatted_from_matches_clean_lead_phone(self, session, auth_headers):
        # Lead saved as +15551234567 (E.164 clean)
        unique = uuid.uuid4().int % 10000000
        clean_phone = f"+1555{unique:07d}"
        # Webhook From comes formatted like "+1 555-XXX-XXXX"
        # Build formatted version: +1 555-XXX-XXXX
        digits = clean_phone[2:]  # strip +1 -> 10 digits "555XXXXXXX"
        formatted_from = f"+1 {digits[:3]}-{digits[3:6]}-{digits[6:]}"

        body_text = f"TEST_iter4_normphone_{uuid.uuid4().hex[:6]}"

        # Create lead with clean E.164 phone
        lead_resp = session.post(f"{API}/leads", headers=auth_headers, json={
            "name": "TEST_iter4 PhoneNorm",
            "phone": clean_phone,
            "email": f"TEST_iter4_{uuid.uuid4().hex[:6]}@example.com",
            "source": "MANUAL",
            "status": "NEW",
        })
        assert lead_resp.status_code in (200, 201), lead_resp.text
        lead_id = lead_resp.json()["lead"]["id"]

        try:
            # Hit webhook with formatted From — should still match the lead
            wb = requests.post(
                f"{API}/webhooks/twilio/sms",
                data={"From": formatted_from, "Body": body_text},
                timeout=30,
            )
            assert wb.status_code == 200, wb.text
            assert "<Response" in wb.text

            time.sleep(0.6)

            inbox = session.get(f"{API}/communications/inbox", headers=auth_headers)
            assert inbox.status_code == 200
            msgs = inbox.json()["messages"]
            match = [m for m in msgs if m.get("content") == body_text and m.get("lead_id") == lead_id]
            assert match, (
                f"INBOUND not matched after phone normalisation. Lead phone={clean_phone}, "
                f"webhook From={formatted_from!r}, inbox returned {len(msgs)} msgs"
            )
            assert match[0]["direction"] == "INBOUND"
            assert match[0]["channel"] == "SMS"
        finally:
            session.delete(f"{API}/leads/{lead_id}", headers=auth_headers)

    def test_webhook_no_signature_still_ok_when_strict_disabled(self):
        """STRICT_TWILIO_WEBHOOK is intentionally NOT set in preview .env → webhook
        without X-Twilio-Signature must still 200 (otherwise Twilio inbound breaks)."""
        r = requests.post(
            f"{API}/webhooks/twilio/sms",
            data={"From": "+15555550100", "Body": "hello"},
            timeout=15,
        )
        assert r.status_code == 200, f"webhook without signature returned {r.status_code}: {r.text[:200]}"
        assert "<Response" in r.text


# ---------------- 4. AI endpoint coverage — none should 500 ----------------
class TestAIEndpointsNoCrash:
    """Hit every AI endpoint that routes through _groq_chat. None should 500."""

    def test_market_analyze(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/market/analyze", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text

    def test_seo_keywords(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/keywords", headers=auth_headers,
                         json={"seed_keyword": "founder's CRM"}, timeout=120)
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("keywords"), list)

    def test_seo_backlinks(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/backlinks", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text

    def test_seo_content_gaps(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/seo/content-gaps", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text

    def test_pr_media_list(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/pr/media-list", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text

    def test_pr_outreach_email(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/pr/outreach-email", headers=auth_headers, json={
            "journalist_name": "Jane O'Brien",
            "publication": "TechCrunch",
            "angle": "AI-first growth tools for SMBs",
            "announcement": "launched today's new \"AI Growth Studio\""
        }, timeout=120)
        assert r.status_code == 200, r.text

    def test_growth_plan_generate(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/growth-plan/generate", headers=auth_headers, json={}, timeout=180)
        assert r.status_code == 200, r.text

    def test_briefing_generate(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/briefing/generate", headers=auth_headers, json={}, timeout=120)
        assert r.status_code == 200, r.text

    def test_ai_generate_content(self, session, auth_headers, ensure_business_profile):
        r = session.post(f"{API}/ai/generate-content", headers=auth_headers, json={
            "channel": "email",
            "goal": "book a meeting",
            "audience": "SMB founders",
            "context": "We're launching today's \"AI Growth Studio\""
        }, timeout=120)
        assert r.status_code == 200, r.text

    def test_leads_score_batch(self, session, auth_headers, ensure_business_profile):
        # ensure at least one lead exists
        unique = uuid.uuid4().hex[:6]
        c = session.post(f"{API}/leads", headers=auth_headers, json={
            "name": f"TEST_iter4_score_{unique}",
            "email": f"TEST_iter4_score_{unique}@example.com",
            "phone": f"+1555000{uuid.uuid4().int % 10000:04d}",
            "source": "MANUAL",
            "status": "NEW",
        })
        assert c.status_code in (200, 201)
        lead_id = c.json()["lead"]["id"]
        try:
            r = session.post(f"{API}/leads/score-batch", headers=auth_headers,
                             json={"lead_ids": [lead_id]}, timeout=120)
            assert r.status_code == 200, r.text
            body = r.json()
            assert "scored" in body and "results" in body
        finally:
            session.delete(f"{API}/leads/{lead_id}", headers=auth_headers)

    def test_leads_ai_reply(self, session, auth_headers, ensure_business_profile):
        unique = uuid.uuid4().hex[:6]
        c = session.post(f"{API}/leads", headers=auth_headers, json={
            "name": f"TEST_iter4_aireply_{unique}",
            "email": f"TEST_iter4_aireply_{unique}@example.com",
            "phone": f"+1555000{uuid.uuid4().int % 10000:04d}",
            "source": "MANUAL",
            "status": "NEW",
        })
        assert c.status_code in (200, 201)
        lead_id = c.json()["lead"]["id"]
        try:
            r = session.post(f"{API}/leads/{lead_id}/ai-reply", headers=auth_headers, json={
                "inbound_message": "Hi — what's the price for your \"Pro\" plan? It's urgent.",
                "channel": "EMAIL",
                "tone": "friendly",
            }, timeout=120)
            assert r.status_code == 200, r.text
            assert isinstance(r.json().get("reply"), str) and len(r.json()["reply"]) > 5
        finally:
            session.delete(f"{API}/leads/{lead_id}", headers=auth_headers)


# ---------------- 5. Quick regression ----------------
class TestRegression:
    def test_login(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_dashboard_stats(self, session, auth_headers):
        r = session.get(f"{API}/dashboard/stats", headers=auth_headers)
        assert r.status_code == 200

    def test_leads_list(self, session, auth_headers):
        r = session.get(f"{API}/leads", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json().get("leads"), list)

    def test_inbox_requires_auth(self):
        r = requests.get(f"{API}/communications/inbox")
        assert r.status_code == 401
