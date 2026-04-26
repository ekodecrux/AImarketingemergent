"""ZeroMark AI - Backend integration tests.

Covers: Auth, Business profile, Leads (CRUD + import + pagination), Campaigns,
AI generation (Groq), Approvals (approve/reject/modify), Dashboard, Reports,
Scraping (AI generated leads), Subscription (plans + Razorpay checkout/verify).
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"


# -------------------- Fixtures --------------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# -------------------- Health & Public --------------------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# -------------------- Auth --------------------
class TestAuth:
    def test_register_and_me(self, api):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Passw0rd!", "first_name": "T", "last_name": "User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == email.lower()
        # Cookie set
        assert "access_token" in r.cookies or any(c.name == "access_token" for c in r.cookies)

        # /me with bearer
        me = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

    def test_register_duplicate(self, api):
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": ADMIN_EMAIL, "password": "x" * 8, "first_name": "x", "last_name": "y"})
        assert r.status_code == 400

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_admin(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["role"] == "admin"
        assert isinstance(body["token"], str) and len(body["token"]) > 20

    def test_unauth_access(self):
        # use a fresh session with no cookies/headers
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_logout(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/auth/logout", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["success"] is True


# -------------------- Business Profile --------------------
class TestBusiness:
    def test_upsert_and_get(self, api, auth_headers):
        payload = {
            "business_name": "TEST_Acme Co",
            "industry": "SaaS",
            "location": "Bengaluru, India",
            "target_audience": "SMB founders",
            "website_url": "https://acme.test",
            "description": "Test profile",
        }
        r = api.post(f"{BASE_URL}/api/business", headers=auth_headers, json=payload)
        assert r.status_code == 200
        prof = r.json()["profile"]
        assert prof["business_name"] == payload["business_name"]
        assert prof["industry"] == payload["industry"]

        r2 = api.get(f"{BASE_URL}/api/business", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["profile"]["business_name"] == payload["business_name"]


# -------------------- Leads --------------------
class TestLeads:
    created_ids = []

    def test_create_lead(self, api, auth_headers):
        body = {"name": "TEST_Lead Alpha", "email": "TEST_alpha@example.com", "phone": "+15551234567",
                "company": "AlphaCo", "source": "MANUAL", "status": "NEW", "score": 10}
        r = api.post(f"{BASE_URL}/api/leads", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        lead = r.json()["lead"]
        assert lead["name"] == body["name"]
        assert lead["email"] == body["email"]
        assert "id" in lead
        TestLeads.created_ids.append(lead["id"])

    def test_list_leads_pagination(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/leads?page=1&limit=5", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "leads" in data and "pagination" in data
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 5

    def test_list_leads_filter(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/leads?status_filter=NEW", headers=auth_headers)
        assert r.status_code == 200
        for lead in r.json()["leads"]:
            assert lead["status"] == "NEW"

    def test_update_lead(self, api, auth_headers):
        assert TestLeads.created_ids, "no lead created"
        lid = TestLeads.created_ids[0]
        r = api.put(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers,
                    json={"status": "CONTACTED", "score": 50, "notes": "Updated"})
        assert r.status_code == 200
        # Verify
        r2 = api.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = r2.json()["leads"]
        match = next((x for x in leads if x["id"] == lid), None)
        assert match and match["status"] == "CONTACTED" and match["score"] == 50

    def test_import_leads(self, api, auth_headers):
        bulk = [
            {"name": f"TEST_Bulk_{i}", "email": f"TEST_bulk{i}@x.com", "source": "MANUAL", "status": "NEW"}
            for i in range(3)
        ]
        r = api.post(f"{BASE_URL}/api/leads/import", headers=auth_headers, json=bulk)
        assert r.status_code == 200
        assert r.json()["count"] == 3

    def test_delete_lead(self, api, auth_headers):
        if not TestLeads.created_ids:
            pytest.skip("no lead to delete")
        lid = TestLeads.created_ids[0]
        r = api.delete(f"{BASE_URL}/api/leads/{lid}", headers=auth_headers)
        assert r.status_code == 200


# -------------------- Campaigns + Approvals --------------------
class TestCampaignApproval:
    campaign_id = None
    approval_id = None

    def test_create_campaign_pending(self, api, auth_headers):
        body = {"name": "TEST_Promo", "type": "EMAIL_BLAST", "channel": "EMAIL",
                "content": "<p>Hello {{name}}</p>", "subject": "Hi"}
        r = api.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        c = r.json()["campaign"]
        assert c["status"] == "PENDING_APPROVAL"
        TestCampaignApproval.campaign_id = c["id"]

    def test_list_campaigns(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/campaigns", headers=auth_headers)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()["campaigns"]]
        assert TestCampaignApproval.campaign_id in ids

    def test_pending_approvals(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/approvals", headers=auth_headers)
        assert r.status_code == 200
        approvals = r.json()["approvals"]
        match = next((a for a in approvals if a.get("campaign_id") == TestCampaignApproval.campaign_id), None)
        assert match is not None, "approval not created for campaign"
        TestCampaignApproval.approval_id = match["id"]

    def test_modify_approval_updates_campaign(self, api, auth_headers):
        aid = TestCampaignApproval.approval_id
        new_content = "<p>Modified content {{name}}</p>"
        r = api.post(f"{BASE_URL}/api/approvals/{aid}/modify", headers=auth_headers,
                     json={"content": new_content, "comments": "tweaked"})
        assert r.status_code == 200
        # Verify campaign now APPROVED & content updated
        cid = TestCampaignApproval.campaign_id
        r2 = api.get(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers)
        assert r2.status_code == 200
        camp = r2.json()["campaign"]
        assert camp["status"] == "APPROVED"
        assert camp["content"] == new_content

    def test_send_campaign_after_approval(self, api, auth_headers):
        cid = TestCampaignApproval.campaign_id
        r = api.post(f"{BASE_URL}/api/campaigns/{cid}/send", headers=auth_headers)
        # Email send may succeed or partially fail (env constraints) but endpoint must respond 200
        assert r.status_code == 200, r.text
        body = r.json()
        assert "sent" in body and "failed" in body

    def test_send_unapproved_campaign_blocked(self, api, auth_headers):
        # Create another campaign and try to send without approving
        body = {"name": "TEST_Unapproved", "type": "SMS_BLAST", "channel": "SMS", "content": "Hi {{name}}"}
        cr = api.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json=body)
        cid = cr.json()["campaign"]["id"]
        r = api.post(f"{BASE_URL}/api/campaigns/{cid}/send", headers=auth_headers)
        assert r.status_code == 400
        api.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers)

    def test_reject_approval(self, api, auth_headers):
        body = {"name": "TEST_Reject", "type": "EMAIL_BLAST", "channel": "EMAIL", "content": "x"}
        cr = api.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json=body)
        cid = cr.json()["campaign"]["id"]
        ar = api.get(f"{BASE_URL}/api/approvals", headers=auth_headers).json()["approvals"]
        aid = next(a["id"] for a in ar if a["campaign_id"] == cid)
        r = api.post(f"{BASE_URL}/api/approvals/{aid}/reject", headers=auth_headers, json={"comments": "no"})
        assert r.status_code == 200
        c = api.get(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers).json()["campaign"]
        assert c["status"] == "REJECTED"
        api.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers)

    def test_approve_only(self, api, auth_headers):
        body = {"name": "TEST_Approve", "type": "EMAIL_BLAST", "channel": "EMAIL", "content": "y"}
        cr = api.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json=body)
        cid = cr.json()["campaign"]["id"]
        ar = api.get(f"{BASE_URL}/api/approvals", headers=auth_headers).json()["approvals"]
        aid = next(a["id"] for a in ar if a["campaign_id"] == cid)
        r = api.post(f"{BASE_URL}/api/approvals/{aid}/approve", headers=auth_headers, json={"comments": "ok"})
        assert r.status_code == 200
        c = api.get(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers).json()["campaign"]
        assert c["status"] == "APPROVED"
        api.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers)

    def test_delete_campaign(self, api, auth_headers):
        cid = TestCampaignApproval.campaign_id
        r = api.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=auth_headers)
        assert r.status_code == 200


# -------------------- AI Generation (Groq) --------------------
class TestAIGenerate:
    def test_generate_email_returns_subject(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/ai/generate-content", headers=auth_headers,
                     json={"channel": "EMAIL", "goal": "Introduce a new SaaS plan",
                           "tone": "professional", "audience": "SMB", "product": "ZeroMark AI"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "content" in data
        assert isinstance(data["content"], str) and len(data["content"]) > 20

    def test_generate_sms_short(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/ai/generate-content", headers=auth_headers,
                     json={"channel": "SMS", "goal": "Discount alert", "tone": "casual"})
        assert r.status_code == 200
        body = r.json()["content"]
        assert isinstance(body, str) and len(body) > 0


# -------------------- Dashboard --------------------
class TestDashboard:
    def test_stats_shape(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ("stats", "charts", "recent"):
            assert key in d
        for key in ("total_leads", "total_campaigns", "pending_approvals",
                    "conversion_rate", "subscription_tier", "trial_days_left"):
            assert key in d["stats"], f"missing stat: {key}"
        for key in ("leads_by_status", "campaigns_by_status", "leads_over_time"):
            assert key in d["charts"]
        assert isinstance(d["charts"]["leads_over_time"], list)
        assert "leads" in d["recent"] and "campaigns" in d["recent"]


# -------------------- Reports --------------------
class TestReports:
    def test_lead_performance(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/reports/generate", headers=auth_headers,
                     json={"type": "LEAD_PERFORMANCE", "period_days": 30})
        assert r.status_code == 200
        rep = r.json()["report"]
        assert rep["type"] == "LEAD_PERFORMANCE"
        assert "data" in rep and "by_source" in rep["data"]

    def test_campaign_performance(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/reports/generate", headers=auth_headers,
                     json={"type": "CAMPAIGN_PERFORMANCE", "period_days": 30})
        assert r.status_code == 200
        assert "by_channel" in r.json()["report"]["data"]

    def test_gap_analysis(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/reports/generate", headers=auth_headers,
                     json={"type": "GAP_ANALYSIS", "period_days": 30})
        assert r.status_code == 200
        d = r.json()["report"]["data"]
        assert "target" in d and "gap" in d and "suggestions" in d

    def test_list_reports(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/reports", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["reports"], list)
        assert len(r.json()["reports"]) >= 1


# -------------------- Scraping --------------------
class TestScraping:
    def test_google_maps_scrape_creates_leads(self, api, auth_headers):
        before = api.get(f"{BASE_URL}/api/leads?limit=1", headers=auth_headers).json()["pagination"]["total"]
        r = api.post(f"{BASE_URL}/api/scraping/start", headers=auth_headers,
                     json={"type": "GOOGLE_MAPS_LEADS", "location": "Mumbai", "keyword": "coffee shop"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed"
        assert body["count"] >= 1
        time.sleep(0.5)
        after = api.get(f"{BASE_URL}/api/leads?limit=1", headers=auth_headers).json()["pagination"]["total"]
        assert after >= before + 1

    def test_list_scrape_jobs(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/scraping/jobs", headers=auth_headers)
        assert r.status_code == 200
        jobs = r.json()["jobs"]
        assert isinstance(jobs, list) and len(jobs) >= 1
        assert jobs[0]["status"] in ("COMPLETED", "FAILED", "PROCESSING")


# -------------------- Subscription --------------------
class TestSubscription:
    order_id = None

    def test_list_plans_public(self, api):
        r = api.get(f"{BASE_URL}/api/subscription/plans")
        assert r.status_code == 200
        plans = r.json()["plans"]
        ids = {p["id"] for p in plans}
        assert {"basic", "pro", "enterprise"}.issubset(ids)

    def test_checkout_creates_order(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/subscription/checkout", headers=auth_headers, json={"plan_id": "pro"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["order_id"].startswith("order_")
        assert body["amount"] == 1499 * 100
        assert body["currency"] == "INR"
        assert body["key_id"]
        TestSubscription.order_id = body["order_id"]

    def test_invalid_plan(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/subscription/checkout", headers=auth_headers, json={"plan_id": "bogus"})
        assert r.status_code == 400

    def test_verify_payment_bad_signature(self, api, auth_headers):
        oid = TestSubscription.order_id or "order_test_unknown"
        r = api.post(f"{BASE_URL}/api/subscription/verify-payment", headers=auth_headers, json={
            "razorpay_order_id": oid,
            "razorpay_payment_id": "pay_invalid",
            "razorpay_signature": "deadbeef" * 8,
            "plan_id": "pro",
        })
        assert r.status_code == 400


# -------------------- Cleanup --------------------
@pytest.fixture(scope="session", autouse=True)
def _cleanup(api):
    yield
    try:
        # best-effort cleanup of TEST_ leads
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        token = r.json().get("token")
        h = {"Authorization": f"Bearer {token}"}
        leads = api.get(f"{BASE_URL}/api/leads?limit=200", headers=h).json().get("leads", [])
        for l in leads:
            if str(l.get("name", "")).startswith("TEST_"):
                api.delete(f"{BASE_URL}/api/leads/{l['id']}", headers=h)
        camps = api.get(f"{BASE_URL}/api/campaigns", headers=h).json().get("campaigns", [])
        for c in camps:
            if str(c.get("name", "")).startswith("TEST_"):
                api.delete(f"{BASE_URL}/api/campaigns/{c['id']}", headers=h)
    except Exception:
        pass
