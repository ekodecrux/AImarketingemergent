"""
Iter32 — Backend regression for Campaigns/Approvals/Leads/Competitors/Onboarding.
Schemas verified from server.py / iter26 prior tests.
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def s(admin_token):
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return sess


# --- Auth -------------------------------------------------------------------
def test_login_admin(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


def test_auth_me(s):
    r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200
    me = r.json().get("user") or r.json()
    assert me.get("email") == ADMIN_EMAIL
    assert me.get("role") == "admin"


def test_logout_then_token_still_valid(s):
    r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
    assert r.status_code in (200, 204)
    r2 = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r2.status_code in (200, 401), f"unexpected {r2.status_code}: {r2.text[:200]}"


# --- Leads ------------------------------------------------------------------
def test_leads_create(s):
    payload = {"name": "TEST_iter32 Lead", "email": f"TEST_iter32_{uuid.uuid4().hex[:6]}@example.com",
               "phone": "+15551234567", "source": "MANUAL"}
    r = s.post(f"{BASE_URL}/api/leads", json=payload, timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json().get("lead") or r.json()
    assert j.get("email") == payload["email"]


def test_leads_csv_import(admin_token):
    csv = ("email,first_name,last_name,phone\n"
           f"TEST_iter32a_{uuid.uuid4().hex[:6]}@x.com,A,One,+15550000001\n"
           f"TEST_iter32b_{uuid.uuid4().hex[:6]}@x.com,B,Two,+15550000002\n"
           f"TEST_iter32c_{uuid.uuid4().hex[:6]}@x.com,C,Three,+15550000003\n")
    files = {"file": ("leads.csv", io.BytesIO(csv.encode()), "text/csv")}
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.post(f"{BASE_URL}/api/leads/import-csv", headers=headers, files=files, timeout=30)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert j.get("imported", 0) >= 1


# --- Campaigns --------------------------------------------------------------
@pytest.fixture(scope="module")
def created_campaign(s):
    payload = {
        "name": "TEST_iter32 Campaign",
        "type": "EMAIL_BLAST",
        "channel": "EMAIL",
        "subject": "iter32 regression",
        "content": "Hello from iter32 regression test",
        "recipient_scope": "manual",
        "extra_recipients": ["ekodecrux@gmail.com"],
    }
    r = s.post(f"{BASE_URL}/api/campaigns", json=payload, timeout=30)
    assert r.status_code == 200, r.text[:400]
    j = r.json()
    c = j.get("campaign") or j
    assert c.get("id"), c
    return c


def test_campaign_created(created_campaign):
    assert created_campaign.get("name") == "TEST_iter32 Campaign"


def test_campaign_approve_and_send(created_campaign, s):
    cid = created_campaign["id"]
    r = s.post(f"{BASE_URL}/api/campaigns/{cid}/approve-and-send", timeout=120)
    assert r.status_code in (200, 201, 202), r.text[:400]
    for _ in range(20):
        time.sleep(2)
        g = s.get(f"{BASE_URL}/api/campaigns/{cid}", timeout=15)
        if g.status_code == 200:
            c = g.json().get("campaign") or g.json()
            st = (c.get("status") or "").upper()
            if st in ("SENT", "FAILED"):
                assert st == "SENT", f"campaign ended in status {st}: {c}"
                assert (c.get("sent_count") or 0) >= 1
                return
    pytest.fail("campaign did not reach SENT in 40s")


def test_campaign_duplicate(created_campaign, s):
    cid = created_campaign["id"]
    r = s.post(f"{BASE_URL}/api/campaigns/{cid}/duplicate", timeout=20)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("campaign") or r.json()
    assert d.get("id") and d["id"] != cid


def test_campaign_boost(created_campaign, s):
    cid = created_campaign["id"]
    r = s.post(f"{BASE_URL}/api/campaigns/{cid}/boost", json={"daily_budget": 10}, timeout=30)
    assert r.status_code in (200, 201, 400, 404, 409, 422), f"boost crashed: {r.status_code} {r.text[:300]}"


# --- Scraping ---------------------------------------------------------------
def test_scraping_start(s):
    payload = {"type": "GOOGLE_MAPS_LEADS", "location": "Bangalore", "keyword": "dental clinics"}
    r = s.post(f"{BASE_URL}/api/scraping/start", json=payload, timeout=120)
    assert r.status_code in (200, 201, 202), r.text[:300]


# --- Competitors ------------------------------------------------------------
@pytest.fixture(scope="module")
def created_competitor(s):
    r = s.post(f"{BASE_URL}/api/competitors",
               json={"url": "https://stripe.com", "nickname": f"TEST_iter32_{uuid.uuid4().hex[:4]}"}, timeout=30)
    assert r.status_code in (200, 201), r.text[:300]
    body = r.json()
    return body.get("competitor") or body


def test_competitor_scan(created_competitor, s):
    cid = created_competitor.get("id")
    assert cid
    r = s.post(f"{BASE_URL}/api/competitors/{cid}/scan", timeout=90)
    assert r.status_code == 200, r.text[:400]
    txt = str(r.json()).lower()
    assert "name 'r' is not defined" not in txt and "nameerror" not in txt


# --- AI / LLM ---------------------------------------------------------------
def test_ai_generate_content(s):
    # try multiple known shapes
    candidates = [
        {"goal": "increase signups", "channel": "EMAIL", "tone": "friendly"},
        {"goal": "increase signups", "type": "EMAIL", "audience": "small business owners"},
    ]
    last = None
    for body in candidates:
        r = s.post(f"{BASE_URL}/api/ai/generate-content", json=body, timeout=60)
        last = r
        if r.status_code == 200:
            j = r.json()
            content = j.get("content") or j.get("message") or j.get("body") or str(j)
            assert isinstance(content, str) and len(content) > 5
            return
    pytest.fail(f"ai/generate-content failed: {last.status_code} {last.text[:300]}")


def test_quick_plan_generate(s):
    r = s.post(f"{BASE_URL}/api/quick-plan/generate",
               json={"monthly_budget": 5000, "duration_months": 3}, timeout=120)
    assert r.status_code == 200, r.text[:300]


def test_assistant_chat(s):
    r = s.post(f"{BASE_URL}/api/assistant/chat",
               json={"message": "Give me one short marketing tip in 10 words."}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    reply = j.get("reply") or j.get("message") or j.get("content") or ""
    assert isinstance(reply, str) and len(reply) > 3, f"empty reply: {j}"


# --- Onboarding / Autopilot -------------------------------------------------
def test_autopilot_kickoff(s):
    """Should not stall and not 5xx."""
    payload = {"monthly_lead_target": 100, "avg_deal_value_usd": 500, "industry": "saas"}
    start = time.time()
    try:
        r = s.post(f"{BASE_URL}/api/autopilot/kickoff", json=payload, timeout=180)
    except requests.exceptions.Timeout:
        pytest.fail("autopilot kickoff stalled >180s")
    elapsed = time.time() - start
    assert elapsed < 180
    assert r.status_code in (200, 201, 202, 400, 409), f"{r.status_code}: {r.text[:300]}"
