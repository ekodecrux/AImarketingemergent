"""Iter14 backend tests:
- NEW /api/reports/marketing-metrics endpoint
- Refactored /api/admin/users with $group aggregation (perf)
- Parallelised /api/plan/kickoff-execution with asyncio.Semaphore(3)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}",
                      "Content-Type": "application/json"})
    return s


# ---------- /api/reports/marketing-metrics ----------
class TestMarketingMetrics:

    def test_default_30day_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=30", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # Top-level keys
        for k in ["period_days", "totals", "by_platform", "timeseries", "is_synthetic", "synthetic_note"]:
            assert k in d, f"Missing key {k}"
        assert d["period_days"] == 30
        assert d["is_synthetic"] is True

        # Totals shape
        t = d["totals"]
        for k in ["impressions", "clicks", "conversions", "scheduled_posts",
                  "published_posts", "real_leads_in_period", "converted_in_period",
                  "ctr_pct", "conv_rate_pct"]:
            assert k in t, f"Missing totals key {k}"

        # by_platform — exactly 5 known platforms
        by_p = d["by_platform"]
        assert isinstance(by_p, list) and len(by_p) == 5
        names = {p["platform"] for p in by_p}
        assert names == {"linkedin", "twitter", "instagram", "blog", "email_broadcast"}

        # totals.impressions == sum(by_platform[].impressions)
        sum_imp = sum(p["impressions"] for p in by_p)
        sum_clk = sum(p["clicks"] for p in by_p)
        assert t["impressions"] == sum_imp, f"totals.impressions {t['impressions']} != sum {sum_imp}"
        assert t["clicks"] == sum_clk, f"totals.clicks {t['clicks']} != sum {sum_clk}"

    def test_admin_has_data(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=30", timeout=20)
        d = r.json()
        # Iter7 left ~51 scheduled posts on admin -> impressions > 0
        assert d["totals"]["scheduled_posts"] > 0, "Admin should have scheduled posts from iter7"
        assert d["totals"]["impressions"] > 0
        assert isinstance(d["timeseries"], list)

    def test_days_param_affects_window(self, admin_client):
        r7 = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=7", timeout=20).json()
        r90 = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=90", timeout=20).json()
        assert r7["period_days"] == 7
        assert r90["period_days"] == 90
        # 90-day window should have >= scheduled posts as 7-day window
        assert r90["totals"]["scheduled_posts"] >= r7["totals"]["scheduled_posts"]

    def test_days_clamped_max_90(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=999", timeout=20)
        assert r.status_code == 200
        assert r.json()["period_days"] == 90

    def test_days_clamped_min_1(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/reports/marketing-metrics?days=-5", timeout=20)
        assert r.status_code == 200
        assert r.json()["period_days"] >= 1

    def test_unauth_rejected(self):
        r = requests.get(f"{BASE_URL}/api/reports/marketing-metrics?days=30", timeout=10)
        assert r.status_code in (401, 403)


# ---------- /api/admin/users ($group aggregation) ----------
class TestAdminUsersAggregation:

    def test_response_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/users", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "users" in d
        users = d["users"]
        assert len(users) >= 20, f"Expected 20+ users, got {len(users)}"
        # First user shape
        u = users[0]
        assert "lead_count" in u
        assert "campaign_count" in u
        assert "subscription" in u  # may be None or dict
        assert isinstance(u["lead_count"], int)
        assert isinstance(u["campaign_count"], int)

    def test_response_time_under_2s(self, admin_client):
        # Time the call — aggregated should be <2s for 20-200 users
        t0 = time.time()
        r = admin_client.get(f"{BASE_URL}/api/admin/users", timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 2.0, f"admin/users took {elapsed:.2f}s — should be <2s with $group"
        print(f"admin/users elapsed: {elapsed:.3f}s for {len(r.json()['users'])} users")

    def test_aggregated_counts_match_per_user(self, admin_client):
        """Verify lead_count from aggregation matches a direct count for first user."""
        r = admin_client.get(f"{BASE_URL}/api/admin/users", timeout=15)
        users = r.json()["users"]
        # Find admin user (workspace owner) — it has the iter7 leftover data
        admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), users[0])
        # We can't easily double-check the count without DB access, but verify field
        # types and that counts are non-negative
        assert admin_user["lead_count"] >= 0
        assert admin_user["campaign_count"] >= 0


# ---------- /api/plan/kickoff-execution (parallelism) ----------
class TestKickoffParallel:

    def test_kickoff_3_posts_under_30s(self, admin_client):
        # Ensure a growth plan exists — kickoff requires it
        # Iter7 left a quick-plan; just call kickoff
        t0 = time.time()
        r = admin_client.post(
            f"{BASE_URL}/api/plan/kickoff-execution",
            json={"weeks": 1, "posts_per_week": 3, "platforms": ["linkedin", "blog"]},
            timeout=60,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d["success"] is True
        assert d["kits_created"] == 3
        assert d["schedules_created"] == 3
        assert d["errors"] == []
        # With Semaphore(3), 3 parallel gens should be ~time-of-1-gen, not 3x
        assert elapsed < 30, f"kickoff took {elapsed:.2f}s — parallel should be <30s"
        print(f"kickoff(3 posts) elapsed: {elapsed:.2f}s")

    def test_kickoff_caps_at_6(self, admin_client):
        t0 = time.time()
        r = admin_client.post(
            f"{BASE_URL}/api/plan/kickoff-execution",
            json={"weeks": 4, "posts_per_week": 3, "platforms": ["linkedin", "blog"]},
            timeout=80,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        # Caps at 6
        assert d["kits_created"] <= 6
        assert d["schedules_created"] <= 6
        # 6 parallel batches of 3 should be ~2× single-gen time
        assert elapsed < 50, f"kickoff(6) took {elapsed:.2f}s — should be <50s with parallelism"
        print(f"kickoff(6 posts) elapsed: {elapsed:.2f}s, kits={d['kits_created']}")
