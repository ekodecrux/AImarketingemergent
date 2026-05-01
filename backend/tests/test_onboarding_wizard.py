"""
Backend tests for the 4-screen onboarding wizard endpoints.

Endpoints under test:
  - GET  /api/onboarding/wizard-state
  - POST /api/onboarding/wizard-dismiss
  - POST /api/onboarding/wizard-complete

Also verifies multi-tenant isolation: admin dismissing the wizard must NOT
affect a different (fresh) user's wizard state.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASS = "admin123"


# ---------- fixtures ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("token") or j.get("access_token")


def _register(email, password, name="Test User"):
    parts = name.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else "User"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
        },
        timeout=30,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("token") or j.get("access_token") or _login(email, password)


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def fresh_user():
    email = f"TEST_wizard_{uuid.uuid4().hex[:10]}@example.com"
    tok = _register(email, "Test12345!", name="Wizard Test")
    return {"email": email, "headers": {"Authorization": f"Bearer {tok}"}}


# ---------- /wizard-state shape ----------
class TestWizardStateShape:
    def test_admin_wizard_state_shape(self, admin_headers):
        r = requests.get(f"{API}/onboarding/wizard-state", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("show_wizard", "dismissed", "completed", "step_done", "next_step",
                  "completed_count", "total_steps"):
            assert k in data, f"missing key {k} in response: {data}"
        for s in ("profile", "channel", "plan", "first_post"):
            assert s in data["step_done"], f"missing step_done.{s}"
        assert data["total_steps"] == 4
        assert isinstance(data["completed_count"], int)

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{API}/onboarding/wizard-state", timeout=10)
        assert r.status_code in (401, 403)


# ---------- fresh user: all 4 steps undone ----------
class TestFreshUserWizardFlow:
    def test_fresh_user_show_wizard_true(self, fresh_user):
        r = requests.get(f"{API}/onboarding/wizard-state", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["show_wizard"] is True
        assert data["dismissed"] is False
        assert data["completed"] is False
        assert data["next_step"] == "profile"
        assert data["completed_count"] == 0
        assert all(v is False for v in data["step_done"].values())

    def test_dismiss_hides_wizard(self, fresh_user):
        # dismiss
        r = requests.post(f"{API}/onboarding/wizard-dismiss", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("dismissed") is True

        # subsequent state
        r2 = requests.get(f"{API}/onboarding/wizard-state", headers=fresh_user["headers"], timeout=15)
        data = r2.json()
        assert data["dismissed"] is True
        assert data["show_wizard"] is False

    def test_complete_hides_wizard(self, fresh_user):
        r = requests.post(f"{API}/onboarding/wizard-complete", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json().get("completed") is True

        r2 = requests.get(f"{API}/onboarding/wizard-state", headers=fresh_user["headers"], timeout=15)
        data = r2.json()
        assert data["completed"] is True
        assert data["show_wizard"] is False


# ---------- multi-tenant isolation ----------
class TestMultiTenantIsolation:
    def test_admin_dismiss_does_not_affect_other_user(self, admin_headers):
        # Create a brand-new user, admin already exists
        email = f"TEST_iso_{uuid.uuid4().hex[:10]}@example.com"
        tok = _register(email, "Test12345!", name="Iso User")
        other = {"Authorization": f"Bearer {tok}"}

        # Admin dismisses own wizard (idempotent; already dismissed is fine)
        rd = requests.post(f"{API}/onboarding/wizard-dismiss", headers=admin_headers, timeout=15)
        assert rd.status_code == 200

        # Other user still sees wizard
        r = requests.get(f"{API}/onboarding/wizard-state", headers=other, timeout=15)
        data = r.json()
        assert data["dismissed"] is False, f"Other user should not be affected by admin dismiss: {data}"
        assert data["show_wizard"] is True


# ---------- re-show prevention after completion ----------
class TestReshowPrevention:
    def test_completed_state_persists_across_requests(self):
        email = f"TEST_done_{uuid.uuid4().hex[:10]}@example.com"
        tok = _register(email, "Test12345!", name="Done User")
        h = {"Authorization": f"Bearer {tok}"}

        # Complete
        requests.post(f"{API}/onboarding/wizard-complete", headers=h, timeout=15)

        # Multiple subsequent reads should never re-show
        for _ in range(3):
            r = requests.get(f"{API}/onboarding/wizard-state", headers=h, timeout=15)
            d = r.json()
            assert d["show_wizard"] is False
            assert d["completed"] is True


# ---------- step-4 schedule payload shape (content_id + scheduled_at + platforms) ----------
class TestStep4SchedulePayload:
    def test_schedule_accepts_content_id_scheduled_at_platforms(self, admin_headers):
        """Validate /schedule accepts the exact payload shape the wizard sends."""
        # First generate a content kit so we have a real content_id
        kg = requests.post(
            f"{API}/content/generate",
            headers=admin_headers,
            json={"topic": "TEST wizard step 4 content gen"},
            timeout=90,
        )
        assert kg.status_code == 200, kg.text
        content = (kg.json() or {}).get("content") or {}
        content_id = content.get("id")
        assert content_id, f"content.id missing in response: {kg.json()}"

        from datetime import datetime, timedelta, timezone
        when = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        r = requests.post(
            f"{API}/schedule",
            headers=admin_headers,
            json={"content_id": content_id, "scheduled_at": when, "platforms": ["blog"]},
            timeout=30,
        )
        assert r.status_code in (200, 201), f"/schedule failed: {r.status_code} {r.text}"


# ---------- step-3 quick-plan payload key (monthly_budget, NOT monthly_budget_usd) ----------
class TestStep3QuickPlanPayloadKey:
    def test_quick_plan_accepts_monthly_budget_key(self, admin_headers):
        r = requests.post(
            f"{API}/quick-plan/generate",
            headers=admin_headers,
            json={"monthly_budget": 5000, "duration_months": 6},
            timeout=60,
        )
        assert r.status_code == 200, f"quick-plan failed with monthly_budget: {r.status_code} {r.text}"
        body = r.json()
        assert isinstance(body, dict)
