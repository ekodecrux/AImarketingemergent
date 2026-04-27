"""Iter6 backend tests — Live Analytics, Lead Targets, Channel Distribution overrides,
Lead actual_value auto-fill on CONVERTED, smoke tests on regression endpoints."""
import os
import time
import uuid
import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL")).rstrip("/")
RUN_ID = uuid.uuid4().hex[:6]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@zeromark.ai", "password": "admin123"},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="session")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ------------ Lead Targets ------------
class TestLeadTargets:
    def test_post_and_get_lead_target_with_guarantee(self, headers):
        body = {
            "monthly_lead_target": 50,
            "avg_deal_value_usd": 250.0,
            "guarantee_enabled": True,
            "guarantee_terms": f"TEST_iter6_{RUN_ID} Refund 25% if missed by >20%",
        }
        r = requests.post(f"{BASE_URL}/api/lead-targets", json=body, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()["target"]
        assert data["monthly_lead_target"] == 50
        assert data["avg_deal_value_usd"] == 250.0
        assert data["guarantee_enabled"] is True
        # Auto-computed revenue target
        assert data["monthly_revenue_target_usd"] == 50 * 250.0

        g = requests.get(f"{BASE_URL}/api/lead-targets", headers=headers, timeout=10)
        assert g.status_code == 200
        gdata = g.json()["target"]
        assert gdata["monthly_lead_target"] == 50
        assert gdata["guarantee_terms"].startswith("TEST_iter6_")

    def test_revenue_target_explicit_overrides_autocompute(self, headers):
        body = {
            "monthly_lead_target": 100,
            "avg_deal_value_usd": 100.0,
            "monthly_revenue_target_usd": 99999.0,
            "guarantee_enabled": False,
        }
        r = requests.post(f"{BASE_URL}/api/lead-targets", json=body, headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["target"]["monthly_revenue_target_usd"] == 99999.0


# ------------ Realtime Analytics ------------
class TestAnalyticsRealtime:
    def test_realtime_shape(self, headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/analytics/realtime", headers=headers, timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        assert elapsed < 5, f"realtime too slow: {elapsed:.2f}s"
        d = r.json()
        # live counters
        live = d["live"]
        for k in ("leads_last_hour", "leads_today", "leads_this_month",
                  "converted_this_month", "revenue_this_month", "pipeline_value"):
            assert k in live, f"missing {k}"
            assert isinstance(live[k], (int, float))
        # target progress
        tgt = d["target"]
        for k in ("monthly_lead_target", "monthly_revenue_target_usd", "avg_deal_value_usd",
                  "leads_progress_pct", "revenue_progress_pct", "forecast_leads",
                  "forecast_revenue", "on_track", "guarantee_enabled"):
            assert k in tgt, f"missing target.{k}"
        # charts
        ch = d["charts"]
        assert "hourly_leads_24h" in ch
        assert len(ch["hourly_leads_24h"]) == 24, f"hourly should be 24, got {len(ch['hourly_leads_24h'])}"
        assert "sources_this_month" in ch
        assert isinstance(ch["sources_this_month"], list)
        assert "generated_at" in d


# ------------ Revenue Trend ------------
class TestAnalyticsRevenue:
    def test_six_consecutive_months(self, headers):
        r = requests.get(f"{BASE_URL}/api/analytics/revenue?months=6", headers=headers, timeout=10)
        assert r.status_code == 200, r.text
        months = r.json()["months"]
        assert len(months) == 6, f"expected 6 months got {len(months)}"
        # Each month entry has required fields
        for m in months:
            for k in ("month", "leads", "converted", "revenue", "conversion_rate"):
                assert k in m
        # months should be consecutive — parse "Mon YYYY"
        from datetime import datetime
        parsed = [datetime.strptime(m["month"], "%b %Y") for m in months]
        for i in range(1, len(parsed)):
            prev, cur = parsed[i - 1], parsed[i]
            # Expect cur month = prev month + 1 month
            expected_month = prev.month % 12 + 1
            expected_year = prev.year + (1 if prev.month == 12 else 0)
            assert cur.month == expected_month and cur.year == expected_year, \
                f"non-consecutive: {prev.strftime('%b %Y')} -> {cur.strftime('%b %Y')}"


# ------------ Lead actual_value auto-fill on CONVERTED ------------
class TestLeadAutoConvertValue:
    def test_create_lead_then_convert_auto_fills_actual_value(self, headers):
        # Create a lead with estimated_value
        payload = {
            "name": f"TEST_iter6_{RUN_ID}_lead",
            "email": f"test_iter6_{RUN_ID}@example.com",
            "phone": "+15555550100",
            "source": "MANUAL",
            "estimated_value": 1234.0,
            "status": "NEW",
        }
        r = requests.post(f"{BASE_URL}/api/leads", json=payload, headers=headers, timeout=10)
        assert r.status_code == 200, r.text
        lead = r.json()["lead"]
        lid = lead["id"]
        try:
            assert lead.get("estimated_value") == 1234.0

            # Update to CONVERTED without actual_value -> should auto-fill from estimated_value
            up = requests.put(
                f"{BASE_URL}/api/leads/{lid}",
                json={"status": "CONVERTED"},
                headers=headers, timeout=10,
            )
            assert up.status_code == 200, up.text

            # Verify via list (no GET-by-id endpoint)
            lst = requests.get(f"{BASE_URL}/api/leads?status=CONVERTED&limit=200", headers=headers, timeout=10)
            assert lst.status_code == 200
            found = next((x for x in lst.json()["leads"] if x["id"] == lid), None)
            assert found, "lead not found after convert"
            assert found.get("status") == "CONVERTED"
            assert float(found.get("actual_value") or 0) == 1234.0, \
                f"actual_value not auto-filled: {found.get('actual_value')}"
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lid}", headers=headers, timeout=10)

    def test_explicit_actual_value_respected(self, headers):
        payload = {
            "name": f"TEST_iter6_{RUN_ID}_b",
            "email": f"test_iter6_b_{RUN_ID}@example.com",
            "phone": "+15555550101",
            "estimated_value": 500.0,
            "status": "NEW",
        }
        r = requests.post(f"{BASE_URL}/api/leads", json=payload, headers=headers, timeout=10)
        lid = r.json()["lead"]["id"]
        try:
            up = requests.put(
                f"{BASE_URL}/api/leads/{lid}",
                json={"status": "CONVERTED", "actual_value": 999.0},
                headers=headers, timeout=10,
            )
            assert up.status_code == 200
            lst = requests.get(f"{BASE_URL}/api/leads?status=CONVERTED&limit=200", headers=headers, timeout=10)
            found = next((x for x in lst.json()["leads"] if x["id"] == lid), None)
            assert found
            assert float(found.get("actual_value")) == 999.0
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lid}", headers=headers, timeout=10)


# ------------ Channel distribution override ------------
class TestChannelOverride:
    def test_channel_override_persists(self, headers):
        # Need a plan first; check if exists, otherwise skip generate
        latest = requests.get(f"{BASE_URL}/api/growth-plan/latest", headers=headers, timeout=10)
        assert latest.status_code == 200
        if latest.json().get("plan") is None:
            pytest.skip("No existing growth plan; skipping override persistence test (generate is rate-limited).")

        override = {
            "channel_distribution": [
                {"name": "Google Ads", "type": "PAID", "monthly_budget_usd": 1500,
                 "expected_leads": 30, "expected_cpl": 50},
                {"name": "SEO Blog", "type": "ORGANIC", "monthly_budget_usd": 0,
                 "expected_leads": 20, "expected_cpl": 0},
            ],
            "monthly_lead_target": 50,
            "monthly_budget_usd": 1500,
            "avg_deal_value_usd": 300,
        }
        r = requests.post(f"{BASE_URL}/api/growth-plan/channels",
                          json=override, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        plan = r.json()["plan"]["plan"]
        assert plan.get("channel_distribution") == override["channel_distribution"]
        assert plan.get("user_modified_at")

        # GET latest must return same
        g = requests.get(f"{BASE_URL}/api/growth-plan/latest", headers=headers, timeout=10)
        assert g.status_code == 200
        gp = g.json()["plan"]["plan"]
        assert gp.get("channel_distribution") == override["channel_distribution"]
        assert gp.get("monthly_lead_target") == 50
        assert gp.get("user_modified_at") is not None


# ------------ Smoke tests on previously passing endpoints ------------
class TestSmoke:
    def test_dashboard_stats(self, headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        # tolerate either flat or nested shape
        assert isinstance(d, dict) and len(d) > 0

    def test_landing_pages_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/landing-pages", headers=headers, timeout=10)
        assert r.status_code == 200
        assert "pages" in r.json() or isinstance(r.json(), (list, dict))

    def test_growth_plan_latest(self, headers):
        r = requests.get(f"{BASE_URL}/api/growth-plan/latest", headers=headers, timeout=10)
        assert r.status_code == 200
        assert "plan" in r.json()

    def test_public_landing_page(self):
        r = requests.get(f"{BASE_URL}/api/public/p/instant-ship-2", timeout=10)
        # may be 404 if slug doesn't exist; accept either 200 or 404 as not-broken
        assert r.status_code in (200, 404), f"unexpected: {r.status_code} {r.text[:200]}"

    def test_leads_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/leads?limit=5", headers=headers, timeout=10)
        assert r.status_code == 200
        assert "leads" in r.json()
