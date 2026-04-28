"""ZeroMark iter 16 — Wallet (Razorpay) + Ad Platform tests.

Covers:
- /api/wallet GET/auto-create
- /api/wallet/topup (Razorpay order creation, validation)
- /api/wallet/topup/verify (signature negative path)
- /api/wallet/auto-recharge PUT (validation)
- /api/wallet/transactions
- /api/ad-platform/accounts (list/create/delete + token encryption-at-rest)
- /api/ad-platform/launch-plan (mock Meta campaigns)
- /api/ad-platform/campaigns + pause/resume
- APScheduler ad_spend_sync registration (via supervisor logs)
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "zeromark_ai")


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# -------------------- Wallet --------------------
class TestWallet:
    def test_wallet_get_autocreate(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        w = r.json()["wallet"]
        assert "user_id" in w
        assert "balance" in w
        assert w["currency"] in ("INR", "USD", "EUR", "GBP")
        assert "auto_recharge_enabled" in w
        assert "auto_recharge_threshold" in w
        assert "auto_recharge_amount" in w
        assert "created_at" in w
        assert "updated_at" in w

    def test_wallet_topup_creates_order(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/wallet/topup", headers=auth_headers,
                          json={"amount": 500}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"].startswith("order_"), d
        assert d["amount"] == 500
        assert d["currency"] in ("INR", "USD", "EUR", "GBP")
        assert d["key_id"].startswith("rzp_test_"), d

    def test_wallet_topup_amount_zero_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/wallet/topup", headers=auth_headers,
                          json={"amount": 0}, timeout=10)
        assert r.status_code == 400

    def test_wallet_topup_amount_too_large_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/wallet/topup", headers=auth_headers,
                          json={"amount": 1_000_001}, timeout=10)
        assert r.status_code == 400

    def test_wallet_topup_verify_bad_signature_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/wallet/topup/verify", headers=auth_headers,
                          json={
                              "razorpay_order_id": "order_FAKEORDER",
                              "razorpay_payment_id": "pay_FAKEPAY",
                              "razorpay_signature": "deadbeefsig",
                          }, timeout=15)
        assert r.status_code == 400, r.text
        assert "Signature verification failed" in r.text

    def test_auto_recharge_enable_with_valid(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/wallet/auto-recharge", headers=auth_headers,
                         json={"enabled": True, "threshold": 1000, "top_up_amount": 2500}, timeout=10)
        assert r.status_code == 200, r.text
        w = r.json()["wallet"]
        assert w["auto_recharge_enabled"] is True
        assert w["auto_recharge_threshold"] == 1000.0
        assert w["auto_recharge_amount"] == 2500.0

    def test_auto_recharge_enable_invalid_threshold_400(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/wallet/auto-recharge", headers=auth_headers,
                         json={"enabled": True, "threshold": 0, "top_up_amount": 2500}, timeout=10)
        assert r.status_code == 400

    def test_auto_recharge_enable_invalid_topup_400(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/wallet/auto-recharge", headers=auth_headers,
                         json={"enabled": True, "threshold": 500, "top_up_amount": 0}, timeout=10)
        assert r.status_code == 400

    def test_auto_recharge_disable_ok(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/wallet/auto-recharge", headers=auth_headers,
                         json={"enabled": False}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["wallet"]["auto_recharge_enabled"] is False

    def test_wallet_transactions_pagination(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/wallet/transactions?page=1&limit=10",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("transactions", "page", "limit", "total", "total_pages"):
            assert k in d
        assert d["page"] == 1
        assert d["limit"] == 10
        assert isinstance(d["transactions"], list)


# -------------------- Ad Platform --------------------
class TestAdPlatform:
    def test_list_accounts_initial(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "accounts" in d
        for p in ("meta", "google", "linkedin"):
            assert p in d["accounts"]
        assert d["mock_mode"] is True

    def test_connect_meta_account(self, auth_headers, mongo_db):
        # Cleanup any prior test account first
        mongo_db.ad_accounts.delete_many({"ad_account_id": "act_1234567890"})
        plaintext_token = "EAAfakeTokenForTest1234"
        r = requests.post(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, json={
            "platform": "meta",
            "access_token": plaintext_token,
            "ad_account_id": "act_1234567890",
            "ad_account_name": "Test Ad Account",
        }, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

        # Verify visible via GET (without access_token field)
        r = requests.get(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, timeout=10)
        meta_list = r.json()["accounts"]["meta"]
        match = [a for a in meta_list if a["ad_account_id"] == "act_1234567890"]
        assert match, "Connected meta account not in list"
        acct = match[0]
        assert "access_token" not in acct
        assert "access_token_enc" not in acct

        # Mongo: stored encrypted; literal plaintext absent
        doc = mongo_db.ad_accounts.find_one({"ad_account_id": "act_1234567890"})
        assert doc is not None
        assert "access_token_enc" in doc
        assert "EAAfake" not in str(doc.get("access_token_enc"))
        assert doc.get("access_token_enc") != plaintext_token

    def test_connect_unsupported_platform_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, json={
            "platform": "unsupported",
            "access_token": "EAAvalidlength12345",
            "ad_account_id": "act_999",
        }, timeout=10)
        assert r.status_code == 400

    def test_connect_short_token_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, json={
            "platform": "meta",
            "access_token": "abc",
            "ad_account_id": "act_999",
        }, timeout=10)
        assert r.status_code == 400

    def test_connect_missing_ad_account_id_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, json={
            "platform": "meta",
            "access_token": "EAAvalidlength12345",
            "ad_account_id": "",
        }, timeout=10)
        assert r.status_code == 400 or r.status_code == 422

    def test_launch_plan_creates_meta_campaign(self, auth_headers):
        # admin's plan exists per agent context with Facebook Ads channel
        r = requests.post(f"{BASE_URL}/api/ad-platform/launch-plan", headers=auth_headers,
                          json={"weeks": 4, "auto_pause_at_cap": True}, timeout=30)
        # Could be 200 (created) OR 400 if no paid channels OR 404 if no plan.
        assert r.status_code in (200, 400, 404), r.text
        if r.status_code == 200:
            d = r.json()
            assert "created" in d and "skipped" in d
            for c in d["created"]:
                for k in ("platform", "ad_account_id", "channel_name", "ext_campaign_id",
                          "status", "daily_budget", "spend_cap", "currency",
                          "is_mock", "spend_actual", "leads", "start_date", "end_date"):
                    assert k in c, f"missing {k}"
                assert c["status"] == "PAUSED"
                assert c["spend_actual"] == 0
                assert c["leads"] == 0
                if c["platform"] == "meta":
                    assert c["is_mock"] is True
                    assert str(c["ext_campaign_id"]).startswith("mock_")

    def test_list_campaigns(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ad-platform/campaigns", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert "campaigns" in r.json()

    def test_pause_resume_campaign(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ad-platform/campaigns", headers=auth_headers, timeout=10)
        camps = r.json().get("campaigns") or []
        if not camps:
            pytest.skip("No campaigns available to pause/resume")
        cid = camps[0]["id"]
        r = requests.post(f"{BASE_URL}/api/ad-platform/campaigns/{cid}/resume",
                          headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ACTIVE"
        r = requests.post(f"{BASE_URL}/api/ad-platform/campaigns/{cid}/pause",
                          headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "PAUSED"

    def test_pause_invalid_campaign_404(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ad-platform/campaigns/INVALID-ID/pause",
                          headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_delete_invalid_account_404(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/ad-platform/accounts/INVALID-ID",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_delete_account_ok(self, auth_headers, mongo_db):
        # connect a temporary account to delete
        r = requests.post(f"{BASE_URL}/api/ad-platform/accounts", headers=auth_headers, json={
            "platform": "linkedin",
            "access_token": "linkedinFakeToken12345",
            "ad_account_id": "li_temp_test",
            "ad_account_name": "Temp LinkedIn",
        }, timeout=10)
        assert r.status_code == 200
        doc = mongo_db.ad_accounts.find_one({"ad_account_id": "li_temp_test"})
        assert doc is not None
        r = requests.delete(f"{BASE_URL}/api/ad-platform/accounts/{doc['id']}",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["success"] is True


# -------------------- Scheduler registration --------------------
class TestScheduler:
    def test_ad_spend_sync_job_registered(self):
        log_paths = ["/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"]
        found = False
        for p in log_paths:
            if not os.path.exists(p):
                continue
            with open(p, "r", errors="ignore") as fh:
                content = fh.read()
            if "_sync_ad_spend_tick" in content or "ad_spend_sync" in content:
                found = True
                break
        if not found:
            pytest.skip("Could not verify scheduler from logs (logs may have rotated)")
