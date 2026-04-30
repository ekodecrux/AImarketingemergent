"""Tests for Iter20: SSRF fix on /free-audit, per-IP rate-limit, AI Growth Co-Pilot,
Competitor Watch, Lead Enrichment."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- SSRF protection on /free-audit ----------
class TestSSRFProtection:
    SSRF_URLS = [
        "http://localhost:8001/api/admin/users",
        "http://127.0.0.1",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1",
        "http://192.168.1.1",
        "http://[::1]",
    ]

    @pytest.mark.parametrize("url", SSRF_URLS)
    def test_ssrf_blocked(self, url):
        r = requests.post(
            f"{API}/free-audit",
            json={"url": url, "email": f"ssrf-{uuid.uuid4().hex[:6]}@example.com"},
        )
        # Must be 400 (Could not fetch site ...) - not 200, not 500
        assert r.status_code == 400, f"SSRF leak for {url}: status={r.status_code} body={r.text[:200]}"
        body = r.json()
        detail = (body.get("detail") or "").lower()
        assert "could not fetch site" in detail, f"Unexpected detail for {url}: {detail}"


# ---------- per-IP rate-limit on /free-audit ----------
class TestFreeAuditRateLimit:
    def test_per_ip_limit_eleventh_request_429(self):
        """Per-IP rate-limit: sending 11 POSTs with the SAME X-Forwarded-For should
        block the 11th. Current server reads `request.client.host` (ingress pod IP
        which rotates across replicas) — so this test ALSO verifies that behavior.
        """
        results = []
        fake_ip = "203.0.113.55"
        for i in range(11):
            email = f"iplim-{uuid.uuid4().hex[:8]}@example.com"
            r = requests.post(
                f"{API}/free-audit",
                json={"url": "https://example.com", "email": email},
                headers={"X-Forwarded-For": fake_ip},
            )
            results.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in results, (
            f"Per-IP rate-limit never triggered across 11 requests: {results}. "
            "ROOT CAUSE: /free-audit uses request.client.host which varies across "
            "ingress pod replicas — per-IP limit is effectively disabled behind a LB."
        )


# ---------- Co-Pilot ----------
class TestCopilot:
    def test_state_auto_creates_default(self, admin_client):
        r = admin_client.get(f"{API}/copilot/state")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "settings" in data
        assert "enabled" in data["settings"]
        assert "aggressiveness" in data["settings"]
        assert data["settings"]["aggressiveness"] in {"cautious", "balanced", "aggressive"}
        assert "last_brief" in data
        assert "recent_actions" in data
        assert isinstance(data["recent_actions"], list)

    def test_toggle_persist(self, admin_client):
        r = admin_client.put(
            f"{API}/copilot/toggle",
            json={"enabled": True, "aggressiveness": "balanced"},
        )
        assert r.status_code == 200, r.text
        # Verify persisted via GET
        state = admin_client.get(f"{API}/copilot/state").json()
        assert state["settings"]["enabled"] is True
        assert state["settings"]["aggressiveness"] == "balanced"

    def test_toggle_invalid_aggressiveness_400(self, admin_client):
        r = admin_client.put(
            f"{API}/copilot/toggle",
            json={"enabled": True, "aggressiveness": "invalid"},
        )
        assert r.status_code == 400, f"expected 400 for bad aggressiveness, got {r.status_code}: {r.text[:200]}"

    def test_run_now_returns_brief(self, admin_client):
        # Set to 'cautious' before run so we don't trigger auto-content generation chain (slow)
        admin_client.put(f"{API}/copilot/toggle", json={"enabled": True, "aggressiveness": "cautious"})
        r = admin_client.post(f"{API}/copilot/run-now", timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "brief" in data
        brief = data["brief"]
        assert "id" in brief
        assert "user_id" in brief
        assert "snapshot" in brief
        snap = brief["snapshot"]
        for k in ["monthly_target", "mtd_leads", "expected_by_now", "pace_gap", "recent_posts", "pending_schedules"]:
            assert k in snap, f"snapshot missing {k}: {list(snap.keys())}"
        assert "ai" in brief
        ai = brief["ai"]
        assert "headline" in ai and isinstance(ai["headline"], str) and len(ai["headline"]) > 0
        assert "body" in ai
        assert "next_step" in ai
        assert "sentiment" in ai

    def test_state_reflects_new_brief(self, admin_client):
        state = admin_client.get(f"{API}/copilot/state").json()
        assert state["last_brief"], "last_brief should not be null after run-now"
        assert "ai" in state["last_brief"]


# ---------- Competitors ----------
@pytest.fixture(scope="class")
def cleanup_competitors(admin_client):
    """Remove any existing competitors before/after to ensure deterministic tests."""
    items = admin_client.get(f"{API}/competitors").json().get("items", [])
    for it in items:
        admin_client.delete(f"{API}/competitors/{it['id']}")
    yield
    items = admin_client.get(f"{API}/competitors").json().get("items", [])
    for it in items:
        admin_client.delete(f"{API}/competitors/{it['id']}")


class TestCompetitors:
    def test_list_empty(self, admin_client, cleanup_competitors):
        r = admin_client.get(f"{API}/competitors")
        assert r.status_code == 200
        assert r.json() == {"items": []} or r.json().get("items") == []

    def test_add_competitor(self, admin_client, cleanup_competitors):
        r = admin_client.post(
            f"{API}/competitors",
            json={"url": "https://example.com", "nickname": "Example"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "competitor" in data
        comp = data["competitor"]
        assert comp["url"] == "https://example.com"
        assert comp["nickname"] == "Example"
        assert "id" in comp
        pytest.comp_id = comp["id"]

    def test_add_empty_url_400(self, admin_client):
        r = admin_client.post(f"{API}/competitors", json={"url": "", "nickname": "x"})
        assert r.status_code == 400

    def test_max_3_competitors(self, admin_client):
        # currently 1 exists (from test_add_competitor). Add 2 more, then 4th must fail.
        r2 = admin_client.post(f"{API}/competitors", json={"url": "https://example.org", "nickname": "Two"})
        assert r2.status_code == 200, r2.text
        r3 = admin_client.post(f"{API}/competitors", json={"url": "https://example.net", "nickname": "Three"})
        assert r3.status_code == 200, r3.text
        r4 = admin_client.post(f"{API}/competitors", json={"url": "https://iana.org", "nickname": "Four"})
        assert r4.status_code == 400, f"4th competitor should 400, got {r4.status_code}: {r4.text[:200]}"
        assert "max 3" in (r4.json().get("detail") or "").lower()

    def test_scan_returns_analysis(self, admin_client):
        cid = pytest.comp_id
        r = admin_client.post(f"{API}/competitors/{cid}/scan", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "snapshot" in data
        snap = data["snapshot"]
        for k in ["title", "meta_desc", "h1s", "word_count", "scanned_at"]:
            assert k in snap, f"snapshot missing {k}"
        assert "ai" in data
        ai = data["ai"]
        for k in ["current_positioning", "likely_target_audience", "strengths",
                  "weaknesses_you_can_exploit", "suggested_counter_moves"]:
            assert k in ai, f"ai missing {k}"
        assert "changes" in data

    def test_scan_invalid_cid_404(self, admin_client):
        r = admin_client.post(f"{API}/competitors/nonexistent-id/scan")
        assert r.status_code == 404

    def test_delete_competitor(self, admin_client):
        cid = pytest.comp_id
        r = admin_client.delete(f"{API}/competitors/{cid}")
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_delete_invalid_cid_404(self, admin_client):
        r = admin_client.delete(f"{API}/competitors/nonexistent-id-xyz")
        assert r.status_code == 404


# ---------- Lead Enrichment ----------
class TestLeadEnrichment:
    def _create_lead(self, admin_client, email, name="TestLead X"):
        r = admin_client.post(
            f"{API}/leads",
            json={"name": name, "email": email, "source": "test"},
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        lead = body.get("lead") or body
        return lead["id"]

    def test_enrich_corporate_email(self, admin_client):
        lid = self._create_lead(admin_client, f"jane-{uuid.uuid4().hex[:6]}@example.com")
        r = admin_client.post(f"{API}/leads/{lid}/enrich", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "enrichment" in data
        enr = data["enrichment"]
        for k in ["domain", "company_name", "industry", "company_size_estimate",
                  "likely_role", "personalised_opener", "buying_signals", "enriched_at"]:
            assert k in enr, f"enrichment missing {k}: {list(enr.keys())}"
        assert enr["domain"] == "example.com"

        # Verify persistence via GET /leads/{id}
        r2 = admin_client.get(f"{API}/leads/{lid}")
        assert r2.status_code == 200
        lead = r2.json()
        lead_doc = lead.get("lead") or lead
        assert "enrichment" in lead_doc and lead_doc["enrichment"].get("domain") == "example.com"

    def test_enrich_personal_email_400(self, admin_client):
        lid = self._create_lead(admin_client, f"joe-{uuid.uuid4().hex[:6]}@gmail.com")
        r = admin_client.post(f"{API}/leads/{lid}/enrich")
        assert r.status_code == 400, r.text
        assert "personal email" in (r.json().get("detail") or "").lower()

    def test_enrich_invalid_lead_id_404(self, admin_client):
        r = admin_client.post(f"{API}/leads/non-existent-id/enrich")
        assert r.status_code == 404
