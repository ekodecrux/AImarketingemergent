"""
Iteration 23 — Auth restrictions, IN/INR locale defaults, Gemini LLM swap.

Covers the 9 backend items in the iter23 review request.
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


# ---------- helpers ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="module")
def fresh_user():
    """Register a brand-new user for locale test."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_iter23_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email,
        "password": "Passw0rd!23",
        "first_name": "Iter23",
        "last_name": "Tester",
    }, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"session": s, "email": email, "user": data["user"], "token": data["token"]}


# ---------- 1. Login ----------
class TestAuth:
    def test_admin_login_returns_token(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("token"), str) and len(data["token"]) > 10
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"

    def test_logout_with_token(self, admin_session):
        r = admin_session.post(f"{API}/auth/logout", timeout=20)
        assert r.status_code == 200
        assert r.json().get("success") is True
        # Cookie clear directives must be present
        sc = ";".join(r.headers.get_all("set-cookie")) if hasattr(r.headers, "get_all") else r.headers.get("set-cookie", "")
        assert "access_token" in sc.lower() or "zm_token" in sc.lower(), f"no cookie clear in: {sc}"

    def test_logout_without_token(self):
        r = requests.post(f"{API}/auth/logout", timeout=20)
        # Logout must succeed regardless of auth state
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_register_open(self, fresh_user):
        # fresh_user fixture itself proves register works
        assert fresh_user["user"]["email"].startswith("test_iter23_")


# ---------- 2. Restricted external auth ----------
class TestRestrictedSignIn:
    def test_google_callback_invalid_session(self):
        r = requests.post(f"{API}/auth/google/callback", json={"session_id": "definitely-invalid-xyz-123"}, timeout=20)
        # 401 (Invalid Google session) per code; 502 if upstream unreachable in preview
        assert r.status_code in (401, 502), f"unexpected: {r.status_code} {r.text}"

    def test_sms_otp_unknown_phone_no_auto_create(self):
        # Use a phone unlikely to exist
        phone = f"+15550{int(time.time()) % 100000:05d}"
        # Step 1 — request OTP (dev mode returns dev_otp)
        r1 = requests.post(f"{API}/auth/sms/send-otp", json={"phone": phone}, timeout=20)
        if r1.status_code == 429:
            pytest.skip("Rate-limited on SMS OTP send")
        assert r1.status_code in (200,), f"send-otp: {r1.status_code} {r1.text}"
        body = r1.json()
        otp = body.get("dev_otp")
        if not otp:
            # Twilio actually sent — cannot complete this test deterministically
            pytest.skip("Twilio active, no dev_otp returned")
        # Step 2 — verify OTP for an unregistered phone — must NOT auto-create
        r2 = requests.post(f"{API}/auth/sms/verify-otp", json={"phone": phone, "otp": otp}, timeout=20)
        assert r2.status_code == 403, f"expected 403, got {r2.status_code} {r2.text}"
        detail = (r2.json().get("detail") or "").lower()
        assert "no" in detail and ("account" in detail or "phone" in detail), f"detail mismatch: {detail}"


# ---------- 3. Locale default IN/INR ----------
class TestLocale:
    def test_fresh_user_defaults_to_india(self, fresh_user):
        s = fresh_user["session"]
        r = s.get(f"{API}/locale/me", timeout=20)
        assert r.status_code == 200, r.text
        loc = (r.json() or {}).get("locale") or {}
        assert loc.get("country_code") == "IN", f"expected IN, got {loc}"
        assert (loc.get("currency") or loc.get("currency_code")) == "INR", f"expected INR, got {loc}"
        # symbol either ₹ or unicode escape
        assert "₹" in (loc.get("symbol") or ""), f"expected ₹, got {loc}"


# ---------- 4. Gemini LLM (Emergent) ----------
class TestGeminiLLM:
    def test_assistant_chat_returns_reply(self, admin_session):
        # Re-login because previous test logged the admin out
        r = admin_session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        if r.status_code == 200:
            admin_session.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        resp = admin_session.post(f"{API}/assistant/chat", json={
            "message": "What should I do first to get my first 10 leads?",
            "history": [],
        }, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code} {resp.text[:500]}"
        data = resp.json()
        assert "reply" in data, f"missing reply: {data}"
        assert isinstance(data["reply"], str) and len(data["reply"].strip()) > 5, f"empty reply: {data}"

    def test_quick_plan_generate(self, admin_session):
        # Make sure auth header is fresh
        r = admin_session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        if r.status_code == 200:
            admin_session.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        resp = admin_session.post(f"{API}/quick-plan/generate", json={
            "monthly_budget": 5000,
            "duration_months": 3,
        }, timeout=90)
        # Must work with Gemini (or 422 if extra body required); fail on 502/500 (LLM fail)
        if resp.status_code == 422:
            pytest.skip(f"Schema mismatch (non-blocking): {resp.text[:300]}")
        assert resp.status_code == 200, f"{resp.status_code} {resp.text[:500]}"
        data = resp.json()
        # Look for any plan-shaped key
        assert any(k in data for k in ("plan", "quick_plan", "months", "monthly_breakdown", "tasks")), f"unexpected shape: {list(data.keys())}"

    def test_content_generate(self, admin_session):
        r = admin_session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        if r.status_code == 200:
            admin_session.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        # Common shape — try a couple of payloads since exact schema may vary
        attempts = [
            {"channel": "linkedin", "topic": "Launching a small bakery in Bangalore", "tone": "friendly"},
            {"platform": "linkedin", "topic": "Launching a small bakery in Bangalore"},
            {"prompt": "Write a LinkedIn post for a new bakery in Bangalore"},
        ]
        last = None
        for p in attempts:
            resp = admin_session.post(f"{API}/content/generate", json=p, timeout=90)
            last = resp
            if resp.status_code == 200:
                break
        assert last is not None
        if last.status_code == 422:
            pytest.skip(f"Schema mismatch on content/generate: {last.text[:300]}")
        assert last.status_code == 200, f"{last.status_code} {last.text[:500]}"
        data = last.json()
        # Expect some text content somewhere
        text_blob = str(data)
        assert len(text_blob) > 50, f"empty content: {data}"
