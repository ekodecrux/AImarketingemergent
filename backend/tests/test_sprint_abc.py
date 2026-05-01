"""Sprint A+B+C backend tests — AT-01, AT-02, AT-03, CH-04, CQ-02, CQ-03, GL-01, OB-04, UX-01, PR-02"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "zeromark_ai")

db = MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@zeromark.ai", "password": "admin123"})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def fresh_user_client():
    s = requests.Session()
    email = f"TEST_sprint_{uuid.uuid4().hex[:8]}@zeromark.ai"
    r = s.post(f"{BASE_URL}/api/auth/signup",
               json={"email": email, "password": "Testpass123!", "name": "Test Sprint User"})
    if r.status_code not in (200, 201):
        pytest.skip(f"Cannot create fresh user: {r.status_code} {r.text}")
    token = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.email = email
    return s


# ============ Business profile: approvals + brand voice ============
class TestBusinessProfile:
    def test_post_business_persists_approvals_and_voice(self, admin_client):
        payload = {
            "business_name": "TEST Acme",
            "industry": "SaaS",
            "location": "Bangalore",
            "target_audience": "Founders",
            "country_code": "IN",
            "currency_code": "INR",
            "approval_required_blog": True,
            "approval_required_social": True,
            "approval_required_email": False,
            "approval_required_paid": False,
            "brand_tone": "witty",
            "brand_voice_examples": ["Short punchy sentence.", "Another one."],
            "brand_forbidden_words": ["synergy", "leverage"],
        }
        r = admin_client.post(f"{BASE_URL}/api/business", json=payload)
        assert r.status_code == 200, r.text

        g = admin_client.get(f"{BASE_URL}/api/business")
        assert g.status_code == 200
        prof = g.json().get("profile") or {}
        assert prof.get("approval_required_blog") is True
        assert prof.get("approval_required_social") is True
        assert prof.get("approval_required_email") is False
        assert prof.get("approval_required_paid") is False
        assert prof.get("brand_tone") == "witty"
        assert "synergy" in (prof.get("brand_forbidden_words") or [])
        assert len(prof.get("brand_voice_examples") or []) == 2


# ============ GL-01 Quick plan confidence ============
class TestQuickPlanConfidence:
    def test_confidence_score_present(self, admin_client):
        import time
        data = None
        last_err = None
        for attempt in range(4):
            r = admin_client.post(f"{BASE_URL}/api/quick-plan/generate",
                                  json={"monthly_budget": 5000, "duration_months": 6})
            if r.status_code == 200:
                data = r.json()
                break
            last_err = f"{r.status_code} {r.text}"
            time.sleep(3)
        if data is None:
            pytest.skip(f"LLM unavailable after retries (Groq TPD?): {last_err}")
        inner = data.get("plan", {}).get("plan") or data.get("plan", {})
        cs = inner.get("confidence_score")
        cb = inner.get("confidence_band")
        cf = inner.get("confidence_factors")
        assert isinstance(cs, int) and 70 <= cs <= 100, f"bad confidence_score={cs}"
        assert cb in ("high", "medium", "low")
        assert isinstance(cf, dict)
        for k in ("margin_ratio", "channel_diversity", "budget_score"):
            assert k in cf, f"missing confidence_factors.{k}"


# ============ CH-04 integrations/health SLA fields ============
class TestIntegrationsHealthSLA:
    def test_social_channels_have_sla_fields(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/integrations/health")
        assert r.status_code == 200, r.text
        body = r.json()
        channels = body.get("channels") or body
        social = ("linkedin", "twitter", "facebook", "instagram")
        non_social = ("gmail", "twilio", "razorpay", "meta_ads")
        # Normalize: find list of dicts keyed by name
        if isinstance(channels, dict):
            items = channels
        else:
            items = {c.get("name") or c.get("channel"): c for c in channels}
        for name in social:
            ch = items.get(name)
            if not ch:
                continue
            # at least these keys should be present (value may be None/0)
            for key in ("last_publish_at", "success_rate_30d", "publishes_30d"):
                assert key in ch, f"social {name} missing {key}"
        for name in non_social:
            ch = items.get(name)
            if not ch:
                continue
            assert "last_publish_at" not in ch, f"non-social {name} should not have last_publish_at"
            assert "success_rate_30d" not in ch, f"non-social {name} should not have success_rate_30d"


# ============ UX-01 Activity feed ============
class TestActivityFeed:
    def test_activity_recent_shape_and_limit(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/activity/recent?limit=5")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "items" in j and "count" in j
        assert isinstance(j["items"], list)
        assert j["count"] == len(j["items"])
        for it in j["items"]:
            assert "_id" not in it
        # sorted desc by created_at
        ts = [it.get("created_at") for it in j["items"] if it.get("created_at")]
        assert ts == sorted(ts, reverse=True)

    def test_activity_limit_bounds(self, admin_client):
        # Over limit should be capped, under 1 rejected
        r1 = admin_client.get(f"{BASE_URL}/api/activity/recent?limit=200")
        assert r1.status_code in (200, 422)
        r2 = admin_client.get(f"{BASE_URL}/api/activity/recent?limit=0")
        assert r2.status_code in (200, 422)

    def test_multitenant_isolation(self, admin_client, fresh_user_client):
        # Fresh user's feed should not contain admin's workspace activity
        r = fresh_user_client.get(f"{BASE_URL}/api/activity/recent?limit=50")
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        # New user should have empty or only their own rows — no admin leakage
        assert len(items) <= 5, f"fresh user has too many items (leak?): {len(items)}"


# ============ PR-02 Quota status ============
class TestQuotaStatus:
    def test_quota_status_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/quota/status")
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("plan", "limit_per_hour", "used_in_last_hour", "used_in_last_24h",
                  "percent_used_hour", "warn", "blocked", "topup_offer_active"):
            assert k in j, f"missing {k}"
        assert isinstance(j["warn"], bool)
        assert isinstance(j["blocked"], bool)


# ============ OB-04 Resume onboarding ============
class TestResumeOnboarding:
    def test_wizard_resume_clears_dismissed(self, admin_client):
        # Make sure wizard state endpoint responds; dismiss then resume
        admin_client.post(f"{BASE_URL}/api/onboarding/wizard-dismiss")
        r_state = admin_client.get(f"{BASE_URL}/api/onboarding/wizard-state")
        assert r_state.status_code == 200
        # Resume
        r = admin_client.post(f"{BASE_URL}/api/onboarding/wizard-resume")
        assert r.status_code == 200, r.text
        r2 = admin_client.get(f"{BASE_URL}/api/onboarding/wizard-state")
        assert r2.status_code == 200
        assert r2.json().get("dismissed") is False


# ============ AT-02 Content safety + AT-01 Approval gate ============
class TestDispatcherGates:
    """Exercises _publish_scheduled at DB-fixture level (no HTTP social call)."""

    def _get_admin_user_id(self):
        u = db.users.find_one({"email": "admin@zeromark.ai"})
        assert u, "admin user missing"
        return str(u.get("id") or u.get("_id"))

    def test_content_safety_blocks_profanity(self, admin_client):
        user_id = self._get_admin_user_id()
        # Ensure approval gate is OFF so safety gate runs
        db.business_profiles.update_one(
            {"user_id": user_id},
            {"$set": {"approval_required_social": False, "approval_required_blog": False}},
        )
        kit_id = f"TEST_kit_{uuid.uuid4().hex[:8]}"
        db.content_kits.insert_one({
            "id": kit_id,
            "user_id": user_id,
            "platform": "linkedin",
            "kit": {
                "social_posts": [
                    {"body": "this is fuck spam content to trigger shit safety"}
                ]
            },
            "status": "draft",
            "created_at": datetime.now(timezone.utc),
        })
        sched_id = f"TEST_sched_{uuid.uuid4().hex[:8]}"
        db.content_schedules.insert_one({
            "id": sched_id,
            "user_id": user_id,
            "content_id": kit_id,
            "platforms": ["linkedin"],
            "status": "scheduled",
            "scheduled_for": datetime.now(timezone.utc),
        })
        import sys, asyncio
        sys.path.insert(0, "/app/backend")
        from server import _publish_scheduled  # type: ignore
        sched = db.content_schedules.find_one({"id": sched_id})
        res = asyncio.get_event_loop().run_until_complete(_publish_scheduled(sched))
        assert res.get("status") == "BLOCKED_SAFETY", res
        assert res.get("issues")
        sched_after = db.content_schedules.find_one({"id": sched_id})
        assert sched_after.get("status") == "BLOCKED_SAFETY"
        assert sched_after.get("safety_issues")
        kit = db.content_kits.find_one({"id": kit_id})
        assert (kit.get("status") or "").lower() == "blocked_safety"
        act = db.user_activity.find_one({"kind": "content.blocked_safety",
                                         "user_id": user_id})
        assert act is not None, "blocked_safety activity row not written"
        db.content_kits.delete_one({"id": kit_id})
        db.content_schedules.delete_one({"id": sched_id})

    def test_approval_gate_social(self, admin_client):
        user_id = self._get_admin_user_id()
        db.business_profiles.update_one(
            {"user_id": user_id},
            {"$set": {"approval_required_social": True}},
        )
        kit_id = f"TEST_kit_{uuid.uuid4().hex[:8]}"
        db.content_kits.insert_one({
            "id": kit_id,
            "user_id": user_id,
            "platform": "linkedin",
            "body": "A perfectly safe professional post about our product launch.",
            "status": "draft",
            "created_at": datetime.now(timezone.utc),
        })
        sched_id = f"TEST_sched_{uuid.uuid4().hex[:8]}"
        db.content_schedules.insert_one({
            "id": sched_id,
            "user_id": user_id,
            "content_id": kit_id,
            "platforms": ["linkedin"],
            "status": "scheduled",
            "scheduled_for": datetime.now(timezone.utc),
        })
        import sys, asyncio
        sys.path.insert(0, "/app/backend")
        from server import _publish_scheduled  # type: ignore
        sched = db.content_schedules.find_one({"id": sched_id})
        res = asyncio.get_event_loop().run_until_complete(_publish_scheduled(sched))
        assert res.get("status") == "AWAITING_APPROVAL", res
        db.content_kits.delete_one({"id": kit_id})
        db.content_schedules.delete_one({"id": sched_id})
