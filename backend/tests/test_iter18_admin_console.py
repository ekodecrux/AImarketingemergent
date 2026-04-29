"""
Iter 18 — Super Admin Console: subscription/wallet/discount/role/suspend, revenue, audit-log
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    assert tok, f"no token in {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def target_user(admin_client):
    """Create a fresh test user via signup and return id+email."""
    email = f"TEST_iter18_{int(time.time())}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Pass1234!", "first_name": "Iter18", "last_name": "Tester"})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    uid = (me.get("user") or me)["id"]
    return {"id": uid, "email": email}


@pytest.fixture(scope="module")
def non_admin_client():
    """Use the target user session as a non-admin auth."""
    email = f"TEST_iter18_nonadmin_{int(time.time())}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Pass1234!", "first_name": "Non", "last_name": "Admin"})
    assert r.status_code in (200, 201)
    tok = r.json().get("token") or r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---- admin_user_detail ----
class TestUserDetail:
    def test_user_detail_ok(self, admin_client, target_user):
        r = admin_client.get(f"{BASE_URL}/api/admin/users/{target_user['id']}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["user", "subscription", "wallet", "discount", "stats", "audit_log"]:
            assert k in d, f"missing key {k}"
        assert d["user"]["id"] == target_user["id"]
        assert "leads" in d["stats"] and "campaigns" in d["stats"]
        assert isinstance(d["audit_log"], list)

    def test_user_detail_404(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/users/does-not-exist-uid")
        assert r.status_code == 404

    def test_user_detail_403_for_non_admin(self, non_admin_client, target_user):
        r = non_admin_client.get(f"{BASE_URL}/api/admin/users/{target_user['id']}")
        assert r.status_code == 403


# ---- admin_set_subscription ----
class TestAdminSubscription:
    def test_set_subscription_pro_3mo(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/subscription",
            json={"plan": "PRO", "duration_months": 3, "note": "test"},
        )
        assert r.status_code == 200, r.text
        sub = r.json()["subscription"]
        assert sub["plan"] == "PRO"
        assert sub["status"] == "ACTIVE"
        assert sub["manually_set_by"] == ADMIN_EMAIL
        assert sub["expires_at"]

    def test_set_subscription_invalid_plan(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/subscription",
            json={"plan": "BOGUS", "duration_months": 1},
        )
        assert r.status_code == 400

    def test_set_subscription_non_admin(self, non_admin_client, target_user):
        r = non_admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/subscription",
            json={"plan": "PRO", "duration_months": 1},
        )
        assert r.status_code == 403


# ---- admin_adjust_wallet ----
class TestAdminWallet:
    def test_credit_wallet(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/wallet/adjust",
            json={"amount": 500, "reason": "goodwill credit"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["balance"] >= 500
        assert d["transaction"]["type"] == "ADMIN_CREDIT"
        assert d["transaction"]["actor_email"] == ADMIN_EMAIL

    def test_debit_wallet(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/wallet/adjust",
            json={"amount": -100, "reason": "refund correction"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["transaction"]["type"] == "ADMIN_DEBIT"

    def test_zero_amount(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/wallet/adjust",
            json={"amount": 0, "reason": "noop"},
        )
        assert r.status_code == 400

    def test_short_reason(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/wallet/adjust",
            json={"amount": 50, "reason": "ab"},
        )
        assert r.status_code == 400

    def test_insufficient_balance(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/wallet/adjust",
            json={"amount": -999999, "reason": "huge debit fail"},
        )
        assert r.status_code == 400


# ---- admin_set_discount ----
class TestAdminDiscount:
    def test_apply_discount(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/discount",
            json={"percent": 25, "note": "loyalty"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["discount"]["percent"] == 25.0

    def test_invalid_percent_negative(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/discount",
            json={"percent": -5},
        )
        assert r.status_code == 400

    def test_invalid_percent_over(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/discount",
            json={"percent": 150},
        )
        assert r.status_code == 400


# ---- admin_set_role / admin_suspend self-checks ----
class TestAdminRoleSuspend:
    def test_self_demote_blocked(self, admin_client):
        me = admin_client.get(f"{BASE_URL}/api/auth/me").json()
        me = me.get("user") or me
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{me['id']}/role",
            json={"role": "user"},
        )
        assert r.status_code == 400
        assert "demote" in r.text.lower()

    def test_self_suspend_blocked(self, admin_client):
        me = admin_client.get(f"{BASE_URL}/api/auth/me").json()
        me = me.get("user") or me
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{me['id']}/suspend",
            json={"suspended": True, "reason": "x"},
        )
        assert r.status_code == 400

    def test_suspend_target(self, admin_client, target_user):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/suspend",
            json={"suspended": True, "reason": "fraud"},
        )
        assert r.status_code == 200
        # unsuspend back
        r2 = admin_client.post(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/suspend",
            json={"suspended": False},
        )
        assert r2.status_code == 200


# ---- admin_revenue ----
class TestAdminRevenue:
    def test_revenue_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/revenue")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["mrr_inr", "arr_inr", "revenue_30d_inr", "wallet_topups_30d_inr", "by_plan", "recent_payments"]:
            assert k in d
        assert d["arr_inr"] == d["mrr_inr"] * 12
        # mrr should equal sum of by_plan mrr
        bp_sum = sum(p.get("mrr_inr", 0) for p in d["by_plan"])
        assert abs(bp_sum - d["mrr_inr"]) < 0.01

    def test_revenue_non_admin(self, non_admin_client):
        r = non_admin_client.get(f"{BASE_URL}/api/admin/revenue")
        assert r.status_code == 403


# ---- admin_audit_log ----
class TestAuditLog:
    def test_audit_log_paged(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/audit-log?page=1&limit=30")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["items", "page", "limit", "total", "total_pages"]:
            assert k in d
        assert d["page"] == 1
        assert d["limit"] == 30
        assert isinstance(d["items"], list)
        if d["items"]:
            it = d["items"][0]
            for k in ["id", "actor_user_id", "actor_email", "target_user_id", "action", "payload", "created_at"]:
                assert k in it, f"missing {k} in audit item"

    def test_audit_includes_recent_actions(self, admin_client, target_user):
        r = admin_client.get(f"{BASE_URL}/api/admin/audit-log?page=1&limit=100")
        assert r.status_code == 200
        actions = {it["action"] for it in r.json()["items"] if it.get("target_user_id") == target_user["id"]}
        # We executed: set_subscription, wallet_adjust (x2), set_discount, suspend, unsuspend
        assert "set_subscription" in actions
        assert "wallet_adjust" in actions
        assert "set_discount" in actions


# ---- Regression: legacy admin endpoints ----
class TestLegacyAdmin:
    def test_admin_overview_works(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/overview")
        assert r.status_code == 200, r.text

    def test_admin_users_works(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/users?page=1&limit=10")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d or "users" in d
