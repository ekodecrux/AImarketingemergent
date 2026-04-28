"""Iter7 backend tests:
- Quick Plan generate (budget-driven, 50% buffer guarantee)
- Plan kickoff execution (content kits + schedules)
- Admin overview/users
- Encrypted social integrations CRUD
- Assistant chatbot endpoint
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASS = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:120]}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def non_admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_iter7_user_{int(time.time())}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234!", "first_name": "Iter7", "last_name": "NonAdmin"}, timeout=20)
    if r.status_code not in (200, 201):
        pytest.skip(f"Non-admin register failed: {r.status_code} {r.text[:120]}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Quick Plan ----------
class TestQuickPlan:
    def test_quick_plan_invalid_budget(self, admin_session):
        r = admin_session.post(f"{API}/quick-plan/generate", json={
            "monthly_budget": 0, "duration_months": 6, "avg_deal_value": 200, "goal": "demo bookings"
        }, timeout=30)
        assert r.status_code == 400, r.text

    def test_quick_plan_invalid_duration(self, admin_session):
        r = admin_session.post(f"{API}/quick-plan/generate", json={
            "monthly_budget": 5000, "duration_months": 4, "avg_deal_value": 200
        }, timeout=30)
        assert r.status_code == 400, r.text

    def test_quick_plan_generate_and_persistence(self, admin_session):
        r = admin_session.post(f"{API}/quick-plan/generate", json={
            "monthly_budget": 5000, "duration_months": 6, "avg_deal_value": 200, "goal": "demo bookings"
        }, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level shape
        assert "guarantee" in data and "plan" in data
        g = data["guarantee"]
        assert isinstance(g.get("monthly_leads"), int) and g["monthly_leads"] >= 1
        assert g.get("buffer_pct") == 50
        assert g.get("total_leads") == g["monthly_leads"] * 6
        # Verify monthly_leads ~= raw_predicted * 0.5
        raw = g.get("raw_predicted_per_month")
        assert raw and g["monthly_leads"] == max(1, int(raw * 0.5))
        # plan.plan.channel_distribution
        plan_doc = data["plan"]["plan"]
        assert isinstance(plan_doc.get("channel_distribution"), list) and len(plan_doc["channel_distribution"]) >= 1
        assert "optimal_split" in plan_doc
        assert plan_doc.get("ai_rationale", "") != ""
        assert plan_doc.get("recommended_first_action", "") != ""

        # Verify lead_targets upserted
        r2 = admin_session.get(f"{API}/lead-targets", timeout=20)
        assert r2.status_code == 200
        lt_resp = r2.json()
        lt = lt_resp.get("target") or lt_resp  # endpoint wraps under 'target'
        assert lt.get("guarantee_enabled") is True
        assert (lt.get("guarantee_terms") or "") != ""
        assert lt.get("monthly_lead_target") == g["monthly_leads"]
        assert lt.get("revenue_target_usd") is not None


# ---------- Plan Kickoff Execution ----------
class TestPlanKickoff:
    def test_kickoff_unsupported_platform(self, admin_session):
        r = admin_session.post(f"{API}/plan/kickoff-execution", json={
            "weeks": 1, "posts_per_week": 1, "platforms": ["unsupported"]
        }, timeout=30)
        assert r.status_code == 400, r.text

    def test_kickoff_creates_kits_and_schedules(self, admin_session):
        # Pre-condition: a plan exists (created by TestQuickPlan or pre-seeded). Ensure it.
        latest = admin_session.get(f"{API}/growth-plan/latest", timeout=20).json()
        if not latest or not latest.get("plan"):
            admin_session.post(f"{API}/quick-plan/generate", json={
                "monthly_budget": 5000, "duration_months": 6, "avg_deal_value": 200
            }, timeout=120)

        r = admin_session.post(f"{API}/plan/kickoff-execution", json={
            "weeks": 1, "posts_per_week": 2, "platforms": ["linkedin", "twitter", "blog"]
        }, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("kits_created", 0) >= 1
        assert data.get("schedules_created", 0) >= 1
        assert isinstance(data.get("errors"), list)

        # Verify schedules visible via GET /api/schedule
        rs = admin_session.get(f"{API}/schedule", timeout=20)
        assert rs.status_code == 200
        items = rs.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("schedules") or []
        assert isinstance(items, list)
        assert any((it.get("status") == "PENDING") for it in items), "Expected at least one PENDING schedule"

    def test_kickoff_no_plan_returns_404(self, non_admin_session):
        r = non_admin_session.post(f"{API}/plan/kickoff-execution", json={
            "weeks": 1, "posts_per_week": 1, "platforms": ["linkedin"]
        }, timeout=30)
        assert r.status_code == 404, r.text
        assert "growth plan" in (r.json().get("detail", "").lower())


# ---------- Admin endpoints ----------
class TestAdmin:
    def test_admin_overview_admin_ok(self, admin_session):
        r = admin_session.get(f"{API}/admin/overview", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("users", "workspaces", "leads", "campaigns", "content_kits", "landing_pages"):
            assert k in d["totals"]
        for k in ("new_users_7d", "active_7d"):
            assert k in d["growth"]
        assert isinstance(d.get("by_provider"), list)
        assert isinstance(d.get("by_plan"), list)

    def test_admin_overview_non_admin_forbidden(self, non_admin_session):
        r = non_admin_session.get(f"{API}/admin/overview", timeout=20)
        assert r.status_code == 403

    def test_admin_users_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("users"), list) and len(data["users"]) >= 1
        u = data["users"][0]
        for k in ("email", "lead_count", "campaign_count"):
            assert k in u, f"missing {k} in user record"
        assert "_id" not in u
        assert "password_hash" not in u


# ---------- Social Integrations ----------
class TestSocialIntegrations:
    def test_get_social_default(self, admin_session):
        # Ensure clean state for linkedin so other earlier runs don't poison
        admin_session.delete(f"{API}/integrations/social/linkedin", timeout=20)
        r = admin_session.get(f"{API}/integrations/social", timeout=20)
        assert r.status_code == 200
        plats = r.json().get("platforms", {})
        for p in ("linkedin", "twitter", "instagram", "facebook"):
            assert p in plats and "connected" in plats[p]

    def test_post_social_unsupported(self, admin_session):
        r = admin_session.post(f"{API}/integrations/social", json={
            "platform": "unsupported", "access_token": "fake_test_token_1234567890"
        }, timeout=20)
        assert r.status_code == 400

    def test_post_social_too_short(self, admin_session):
        r = admin_session.post(f"{API}/integrations/social", json={
            "platform": "linkedin", "access_token": "abc"
        }, timeout=20)
        assert r.status_code == 400

    def test_post_social_encrypted_at_rest(self, admin_session):
        plain = "fake_test_token_1234567890_PLAINTEXT_iter7"
        r = admin_session.post(f"{API}/integrations/social", json={
            "platform": "linkedin", "access_token": plain, "account_handle": "@iter7test"
        }, timeout=20)
        assert r.status_code == 200, r.text
        # GET shows connected=True but does NOT leak access_token
        rg = admin_session.get(f"{API}/integrations/social", timeout=20).json()
        li = rg["platforms"]["linkedin"]
        assert li.get("connected") is True
        # Verify encryption directly in mongo
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URL")
        if not mongo_url:
            pytest.skip("MONGO_URL not set in test env")
        cli = MongoClient(mongo_url)
        dbn = os.environ.get("DB_NAME", "test_database")
        rec = cli[dbn].oauth_tokens.find_one({"linkedin": {"$exists": True}})
        assert rec is not None, "oauth_tokens row missing"
        stored = rec["linkedin"].get("access_token")
        assert stored is not None
        assert stored != plain, "access_token NOT encrypted at rest!"

    def test_delete_social(self, admin_session):
        r = admin_session.delete(f"{API}/integrations/social/linkedin", timeout=20)
        assert r.status_code == 200
        assert r.json().get("success") is True


# ---------- Assistant chat ----------
class TestAssistantChat:
    def test_chat_returns_reply(self, admin_session):
        r = admin_session.post(f"{API}/assistant/chat", json={
            "message": "how do I find leads?", "history": []
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("reply"), str) and len(d["reply"]) > 0
