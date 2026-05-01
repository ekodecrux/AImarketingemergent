"""Iter21 backend tests — Channel Health, FB pages, Meta Ads bind, Hunter bind,
admin platform-setup, Razorpay live-key swap, multi-tenant isolation, lead enrich
no-Hunter regression."""

import os
import time
import uuid
import pytest
import requests
from pathlib import Path


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        env_path = Path("/app/frontend/.env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    return url.rstrip("/")


BASE_URL = _load_base_url()
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def regular_user():
    """Create a fresh non-admin user for multi-tenant tests."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iter21_{suffix}@example.com"
    password = "TestPass123!"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": password,
                            "first_name": "Iter21", "last_name": "Tester"},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Registration failed: {r.status_code} {r.text}")
    body = r.json()
    return {"email": email, "password": password,
            "token": body["token"], "user": body["user"]}


@pytest.fixture(scope="module")
def user_headers(regular_user):
    return {"Authorization": f"Bearer {regular_user['token']}",
            "Content-Type": "application/json"}


# ---------------- /integrations/health ----------------

class TestIntegrationsHealth:
    def test_health_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/integrations/health", timeout=15)
        assert r.status_code == 401

    def test_health_returns_9_channels(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/health",
                         headers=user_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "channels" in body and "checked_at" in body
        ch = body["channels"]
        # Expected 9 channels
        expected = {"linkedin", "twitter", "facebook", "instagram",
                    "gmail", "twilio_sms", "twilio_whatsapp",
                    "razorpay", "meta_ads"}
        assert expected.issubset(set(ch.keys())), f"Got channels: {list(ch.keys())}"
        assert len(ch) >= 9

    def test_provider_configured_flags(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/health",
                         headers=user_headers, timeout=15)
        ch = r.json()["channels"]
        # OAuth providers — env not set => provider_configured False
        for p in ("linkedin", "twitter", "facebook", "instagram"):
            assert "provider_configured" in ch[p], f"{p} missing provider_configured"
            assert ch[p]["provider_configured"] is False, \
                f"{p} provider_configured should be False (env not set), got {ch[p]['provider_configured']}"
            assert ch[p]["status_label"] == "Platform setup pending", \
                f"{p} status_label should reflect platform setup pending"

    def test_platform_services_healthy(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/health",
                         headers=user_headers, timeout=15)
        ch = r.json()["channels"]
        # Gmail, Twilio SMS, Razorpay should be healthy=true (env set in this preview)
        # Note: depends on env — assert at least gmail+razorpay healthy per problem statement
        assert ch["gmail"]["healthy"] is True, f"gmail not healthy: {ch['gmail']}"
        assert ch["twilio_sms"]["healthy"] is True, f"twilio_sms not healthy: {ch['twilio_sms']}"
        assert ch["razorpay"]["healthy"] is True, f"razorpay not healthy: {ch['razorpay']}"

    def test_no_token_leak_in_health(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/health",
                         headers=user_headers, timeout=15)
        body = r.json()
        # Walk every channel and ensure no value field carries a real token/secret
        # (the help-text 'message' field intentionally references env-var NAMES like META_ACCESS_TOKEN)
        for ch_name, ch in body.get("channels", {}).items():
            for forbidden_field in ("access_token", "refresh_token",
                                    "page_access_token", "api_key", "client_secret",
                                    "key_secret", "password_hash", "_id"):
                assert forbidden_field not in ch, \
                    f"Channel {ch_name} leaked field '{forbidden_field}': {ch}"
        # Top-level no _id leak
        assert "_id" not in body


# ---------------- /integrations/facebook/pages + select-page ----------------

class TestFacebookPages:
    def test_pages_unconnected_user(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/facebook/pages",
                         headers=user_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body == {"pages": [], "selected_page_id": None, "connected": False}

    def test_pages_no_token_leak(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/integrations/facebook/pages",
                         headers=user_headers, timeout=15)
        body_str = r.text.lower()
        for forbidden in ("access_token", "page_access_token", "encrypted"):
            assert forbidden not in body_str, f"Token leak: '{forbidden}' in FB pages response"

    def test_select_page_404_not_in_pages(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/integrations/facebook/select-page",
                          headers=user_headers,
                          json={"page_id": "1234567890_nonexistent"},
                          timeout=15)
        assert r.status_code == 404
        assert "not found" in r.json().get("detail", "").lower()


# ---------------- /integrations/meta-ads ----------------

class TestMetaAdsBind:
    def test_bind_short_token_rejected(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/integrations/meta-ads/bind",
                          headers=user_headers,
                          json={"access_token": "short", "ad_account_id": "act_1234567890"},
                          timeout=15)
        assert r.status_code == 400
        assert "token" in r.json().get("detail", "").lower()

    def test_bind_bad_account_id_format(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/integrations/meta-ads/bind",
                          headers=user_headers,
                          json={"access_token": "x" * 50, "ad_account_id": "1234567890"},
                          timeout=15)
        assert r.status_code == 400
        assert "act_" in r.json().get("detail", "")

    def test_bind_invalid_token_rejected_by_graph(self, user_headers):
        # Long enough to pass length check but invalid → Graph API rejects
        r = requests.post(f"{BASE_URL}/api/integrations/meta-ads/bind",
                          headers=user_headers,
                          json={"access_token": "EAA" + ("x" * 100),
                                "ad_account_id": "act_1234567890"},
                          timeout=20)
        assert r.status_code == 400
        # Should mention verification failure
        detail = r.json().get("detail", "").lower()
        assert "verification" in detail or "failed" in detail

    def test_unbind_idempotent(self, user_headers):
        r = requests.delete(f"{BASE_URL}/api/integrations/meta-ads",
                            headers=user_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("success") is True
        # Second time → still ok
        r2 = requests.delete(f"{BASE_URL}/api/integrations/meta-ads",
                             headers=user_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("success") is True


# ---------------- /integrations/hunter ----------------

class TestHunterBind:
    def test_bind_short_key_rejected(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/integrations/hunter/bind",
                          headers=user_headers,
                          json={"api_key": "short"},
                          timeout=15)
        assert r.status_code == 400
        assert "api key" in r.json().get("detail", "").lower() or "invalid" in r.json().get("detail", "").lower()

    def test_bind_invalid_key_rejected_by_hunter(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/integrations/hunter/bind",
                          headers=user_headers,
                          json={"api_key": "x" * 50},
                          timeout=20)
        assert r.status_code == 400
        detail = r.json().get("detail", "").lower()
        assert "verification" in detail or "hunter" in detail or "failed" in detail

    def test_unbind_idempotent(self, user_headers):
        r = requests.delete(f"{BASE_URL}/api/integrations/hunter",
                            headers=user_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("success") is True
        r2 = requests.delete(f"{BASE_URL}/api/integrations/hunter",
                             headers=user_headers, timeout=15)
        assert r2.status_code == 200


# ---------------- /admin/platform-setup ----------------

class TestAdminPlatformSetup:
    def test_non_admin_403(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=user_headers, timeout=15)
        assert r.status_code == 403

    def test_admin_returns_providers_services_flags(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "providers" in body
        assert "services" in body
        assert "flags" in body
        assert "configured_count" in body
        assert "total_providers" in body
        assert len(body["providers"]) == 3
        # Each provider has required fields
        for p in body["providers"]:
            for key in ("id", "label", "configured", "env_keys", "callback_url"):
                assert key in p, f"Provider missing key {key}: {p}"
            assert isinstance(p["configured"], bool)

    def test_admin_configured_count_matches(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=admin_headers, timeout=15)
        body = r.json()
        actual = sum(1 for p in body["providers"] if p["configured"])
        assert body["configured_count"] == actual

    def test_admin_no_secrets_exposed(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=admin_headers, timeout=15)
        text = r.text
        # No raw secret values — only env_key NAMES are listed
        body = r.json()
        # If RAZORPAY_KEY_SECRET is set in env, it should NOT appear in response
        for env_var in ("RAZORPAY_KEY_SECRET", "GMAIL_APP_PASSWORD",
                        "TWILIO_AUTH_TOKEN", "GROQ_API_KEY"):
            secret_val = os.environ.get(env_var, "")
            if secret_val and len(secret_val) > 8:
                assert secret_val not in text, f"Secret value of {env_var} leaked!"
        # Mongo _id never present
        assert '"_id"' not in text


# ---------------- /admin/razorpay/swap-live ----------------

class TestRazorpaySwapLive:
    def test_non_admin_403(self, user_headers):
        r = requests.post(f"{BASE_URL}/api/admin/razorpay/swap-live",
                          headers=user_headers,
                          json={"key_id": "rzp_live_xxxx", "key_secret": "yyyyyyyyyyyy"},
                          timeout=15)
        assert r.status_code == 403

    def test_rejects_non_live_prefix(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/razorpay/swap-live",
                          headers=admin_headers,
                          json={"key_id": "rzp_test_abc", "key_secret": "xxxx"},
                          timeout=15)
        assert r.status_code == 400
        assert "rzp_live_" in r.json().get("detail", "")

    def test_rejects_invalid_live_key(self, admin_headers):
        # Valid prefix but bogus key — Razorpay must reject
        r = requests.post(f"{BASE_URL}/api/admin/razorpay/swap-live",
                          headers=admin_headers,
                          json={"key_id": "rzp_live_FAKE12345",
                                "key_secret": "fakefakefakefake"},
                          timeout=20)
        assert r.status_code == 400
        detail = r.json().get("detail", "").lower()
        assert "razorpay" in detail or "verification" in detail or "failed" in detail


# ---------------- Lead enrichment no-Hunter regression ----------------

class TestLeadEnrichRegression:
    @pytest.fixture(scope="class")
    def lead_id(self, user_headers):
        # Create a lead via /api/leads with a non-personal domain
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST Iter21 Lead {suffix}",
            "email": f"TEST_iter21_{suffix}@example.com",
        }
        r = requests.post(f"{BASE_URL}/api/leads",
                          headers=user_headers, json=payload, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip(f"Lead create failed: {r.status_code} {r.text}")
        body = r.json()
        lid = body.get("id") or (body.get("lead") or {}).get("id")
        if not lid:
            pytest.skip(f"Lead create returned no id: {body}")
        return lid

    def test_enrich_no_hunter_ai_fallback(self, user_headers, lead_id):
        # Hunter is unbound (deleted in TestHunterBind). Enrich must still work.
        r = requests.post(f"{BASE_URL}/api/leads/{lead_id}/enrich",
                          headers=user_headers, timeout=60)
        # Should return 200 (AI fallback) — not crash
        assert r.status_code in (200, 201), f"Got {r.status_code}: {r.text[:300]}"


# ---------------- Multi-tenant isolation ----------------

class TestMultiTenantIsolation:
    def test_user_cannot_access_admin_setup(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=user_headers, timeout=15)
        assert r.status_code == 403

    def test_admin_can_access_admin_setup(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/platform-setup",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
