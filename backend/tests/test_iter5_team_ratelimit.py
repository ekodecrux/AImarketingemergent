"""
Iteration 5 backend tests:
- Team workspaces (members, invite, remove, data-sharing scope)
- Per-user AI rate limit (60/hr) on AI endpoints
- Real SEO API adapter source field (AI fallback active)
- Social OAuth start/callback contract
- Inbox $lookup aggregation `lead` field
- Briefing preferences GET/POST
- Regression: auth, leads CRUD, dashboard/stats, integrations, SSRF
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://eda3142b-49f0-418d-ae65-7f4a288786e0.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "zeromark_ai")

ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"

# unique suffix per run for test data isolation
RUN_ID = uuid.uuid4().hex[:8]


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()["user"]["id"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- 1. Regression: admin login & auth/me ----------
def test_admin_login_works(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 20


def test_dashboard_stats(admin_token):
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth(admin_token), timeout=15)
    assert r.status_code == 200
    data = r.json()
    # at least these keys exist
    for k in ("total_leads", "total_campaigns"):
        assert k in data or "totalLeads" in data or "stats" in data, f"missing key in {data}"


# ---------- 2. Team: list members ----------
def test_team_members_includes_admin_owner(admin_token, admin_id):
    r = requests.get(f"{BASE_URL}/api/team/members", headers=auth(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "members" in data
    members = data["members"]
    assert len(members) >= 1
    admin_member = next((m for m in members if m["id"] == admin_id), None)
    assert admin_member is not None, f"admin not in members: {members}"
    assert admin_member.get("is_owner") is True


# ---------- 3. Team: invite + login as teammate + workspace_id share ----------
@pytest.fixture(scope="session")
def teammate(admin_token, admin_id):
    """Invite a teammate, return dict with email, password, id, token."""
    email = f"TEST_iter5_mate_{RUN_ID}@example.com"
    r = requests.post(f"{BASE_URL}/api/team/invite",
                      headers=auth(admin_token),
                      json={"email": email, "first_name": "Mate", "last_name": "Tester"},
                      timeout=20)
    assert r.status_code == 200, f"invite failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert "temp_password" in data and len(data["temp_password"]) > 4
    assert "user_id" in data
    temp_pw = data["temp_password"]
    new_id = data["user_id"]

    # login as teammate
    lr = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": email, "password": temp_pw}, timeout=20)
    assert lr.status_code == 200, f"teammate login failed: {lr.status_code} {lr.text}"
    token = lr.json()["token"]

    info = {"email": email, "password": temp_pw, "id": new_id, "token": token, "owner_id": admin_id}
    yield info

    # cleanup: delete the teammate user + any leads/ai_calls created for them
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        db.users.delete_one({"id": new_id})
        db.ai_calls.delete_many({"user_id": new_id})
        db.oauth_states.delete_many({"user_id": new_id})
    except Exception:
        pass


def test_invite_creates_teammate_with_owner_workspace(teammate, admin_id, mongo):
    user_doc = mongo.users.find_one({"id": teammate["id"]}, {"_id": 0})
    assert user_doc is not None
    assert user_doc["workspace_id"] == admin_id, \
        f"teammate workspace_id={user_doc.get('workspace_id')} should equal owner id {admin_id}"


def test_team_data_sharing_leads_visible_to_teammate(admin_token, teammate):
    """Owner creates a lead -> teammate's GET /api/leads should include it (workspace-scoped)."""
    lead_payload = {
        "name": f"TEST_iter5_share_lead_{RUN_ID}",
        "email": f"share_{RUN_ID}@example.com",
        "phone": "+15550009999",
        "source": "test",
    }
    cr = requests.post(f"{BASE_URL}/api/leads", headers=auth(admin_token),
                       json=lead_payload, timeout=20)
    assert cr.status_code in (200, 201), cr.text
    created = cr.json()
    lead_id = created.get("id") or created.get("lead", {}).get("id")
    assert lead_id, f"no lead id in response: {created}"

    try:
        # teammate lists leads
        lr = requests.get(f"{BASE_URL}/api/leads", headers=auth(teammate["token"]), timeout=20)
        assert lr.status_code == 200
        body = lr.json()
        leads = body if isinstance(body, list) else body.get("leads", body.get("items", []))
        ids = [l.get("id") for l in leads]
        assert lead_id in ids, f"teammate cannot see owner lead {lead_id}; saw {ids[:5]}..."
    finally:
        requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=auth(admin_token), timeout=15)


# ---------- 4. Team: non-owner cannot invite ----------
def test_non_owner_cannot_invite(teammate):
    r = requests.post(f"{BASE_URL}/api/team/invite",
                      headers=auth(teammate["token"]),
                      json={"email": f"TEST_iter5_blocked_{RUN_ID}@example.com"},
                      timeout=15)
    assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
    assert "owner" in r.text.lower()


# ---------- 5. Team: remove member ----------
def test_teammate_cannot_remove_owner(teammate, admin_id):
    r = requests.delete(f"{BASE_URL}/api/team/members/{admin_id}",
                        headers=auth(teammate["token"]), timeout=15)
    assert r.status_code == 403


def test_owner_can_remove_teammate(admin_token, mongo):
    """Create a throwaway teammate, then owner deletes."""
    email = f"TEST_iter5_kick_{RUN_ID}@example.com"
    inv = requests.post(f"{BASE_URL}/api/team/invite",
                        headers=auth(admin_token),
                        json={"email": email}, timeout=20)
    assert inv.status_code == 200
    kicked_id = inv.json()["user_id"]
    try:
        d = requests.delete(f"{BASE_URL}/api/team/members/{kicked_id}",
                            headers=auth(admin_token), timeout=15)
        assert d.status_code == 200, d.text
        assert d.json().get("success") is True
        # verify gone
        assert mongo.users.find_one({"id": kicked_id}) is None
    finally:
        mongo.users.delete_one({"id": kicked_id})


# ---------- 6. AI rate limit ----------
def test_ai_rate_limit_429_via_seeded_calls(admin_token, mongo):
    """Seed 60 ai_calls docs for a fresh invited user, then hit /api/seo/keywords -> 429."""
    # invite a fresh user
    email = f"TEST_iter5_rl_{RUN_ID}@example.com"
    inv = requests.post(f"{BASE_URL}/api/team/invite",
                        headers=auth(admin_token),
                        json={"email": email}, timeout=20)
    assert inv.status_code == 200
    rl_user_id = inv.json()["user_id"]
    rl_token = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": email, "password": inv.json()["temp_password"]},
                             timeout=15).json()["token"]
    try:
        # seed 60 ai_calls within the last hour
        now_iso = datetime.now(timezone.utc).isoformat()
        docs = [{"user_id": rl_user_id, "workspace_id": rl_user_id, "ts": now_iso}
                for _ in range(60)]
        mongo.ai_calls.insert_many(docs)

        r = requests.post(f"{BASE_URL}/api/seo/keywords",
                          headers=auth(rl_token),
                          json={"seed_keyword": "ratelimit-test"}, timeout=30)
        assert r.status_code == 429, f"expected 429, got {r.status_code}: {r.text[:200]}"
        assert "rate limit" in r.text.lower() or "ai rate limit" in r.text.lower()
    finally:
        mongo.ai_calls.delete_many({"user_id": rl_user_id})
        mongo.users.delete_one({"id": rl_user_id})


# ---------- 7. SEO keywords source=ai (real APIs not configured) ----------
def test_seo_keywords_returns_ai_source_with_25_items(admin_token, mongo):
    # ensure admin has < 60 ai_calls in the last hour
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    admin_id_q = mongo.users.find_one({"email": ADMIN_EMAIL}, {"id": 1})["id"]
    n = mongo.ai_calls.count_documents({"user_id": admin_id_q, "ts": {"$gte": cutoff}})
    if n >= 55:
        # purge any test-introduced calls if too close to limit
        mongo.ai_calls.delete_many({"user_id": admin_id_q, "ts": {"$gte": cutoff}})

    r = requests.post(f"{BASE_URL}/api/seo/keywords",
                      headers=auth(admin_token),
                      json={"seed_keyword": "ai marketing tools"}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("source") == "ai", f"expected source=ai got {data.get('source')}"
    kws = data.get("keywords", [])
    assert isinstance(kws, list) and len(kws) >= 10, \
        f"expected ~25 keywords, got {len(kws)}"


# ---------- 8. OAuth start/callback ----------
def test_oauth_linkedin_start_400_when_unconfigured(admin_token):
    r = requests.get(f"{BASE_URL}/api/oauth/linkedin/start",
                     headers=auth(admin_token), timeout=15)
    assert r.status_code == 400, r.text
    assert "LINKEDIN_CLIENT_ID" in r.text


def test_oauth_unknown_provider_404(admin_token):
    r = requests.get(f"{BASE_URL}/api/oauth/foo/start",
                     headers=auth(admin_token), timeout=15)
    assert r.status_code == 404


# ---------- 9. Inbox $lookup ----------
def test_inbox_messages_have_lead_field(admin_token, mongo):
    """Create a lead + inbound communication, verify aggregation $lookup hydrates 'lead'."""
    admin_id_q = mongo.users.find_one({"email": ADMIN_EMAIL}, {"id": 1})["id"]
    lead_id = str(uuid.uuid4())
    comm_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    lead_doc = {
        "id": lead_id, "user_id": admin_id_q,
        "name": "TEST_iter5_inbox_lead",
        "email": f"inbox_{RUN_ID}@example.com",
        "phone": "+15550003333", "status": "NEW", "source": "test",
        "created_at": now,
    }
    comm_doc = {
        "id": comm_id, "user_id": admin_id_q, "lead_id": lead_id,
        "channel": "email", "direction": "INBOUND",
        "content": "test inbound from iter5", "status": "RECEIVED",
        "sent_at": now,
    }
    mongo.leads.insert_one(lead_doc)
    mongo.communications.insert_one(comm_doc)
    try:
        r = requests.get(f"{BASE_URL}/api/communications/inbox",
                         headers=auth(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        msgs = body.get("messages", [])
        ours = next((m for m in msgs if m.get("id") == comm_id), None)
        assert ours is not None, f"new inbound msg not found in inbox; total={len(msgs)}"
        assert "lead" in ours, f"missing 'lead' lookup field: {ours}"
        assert ours["lead"]["name"] == "TEST_iter5_inbox_lead"
        assert ours["lead"]["email"] == lead_doc["email"]
        assert ours["lead"]["phone"] == lead_doc["phone"]
    finally:
        mongo.leads.delete_one({"id": lead_id})
        mongo.communications.delete_one({"id": comm_id})


# ---------- 10. Briefing preferences ----------
def test_briefing_preferences_post_and_get(admin_token):
    r = requests.post(f"{BASE_URL}/api/briefing/preferences",
                      headers=auth(admin_token),
                      json={"daily_email": True, "hour_utc": 8}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True

    g = requests.get(f"{BASE_URL}/api/briefing/preferences",
                     headers=auth(admin_token), timeout=15)
    assert g.status_code == 200
    data = g.json()
    assert data.get("daily_email") is True
    assert data.get("hour_utc") == 8

    # change values and re-verify
    r2 = requests.post(f"{BASE_URL}/api/briefing/preferences",
                       headers=auth(admin_token),
                       json={"daily_email": False, "hour_utc": 13}, timeout=15)
    assert r2.status_code == 200
    g2 = requests.get(f"{BASE_URL}/api/briefing/preferences",
                      headers=auth(admin_token), timeout=15).json()
    assert g2["daily_email"] is False
    assert g2["hour_utc"] == 13


# ---------- 11. Regression: SSRF on auto-fill ----------
def test_ssrf_block_private_ip(admin_token):
    r = requests.post(f"{BASE_URL}/api/business/auto-fill",
                      headers=auth(admin_token),
                      json={"website_url": "http://169.254.169.254/latest/meta-data/"},
                      timeout=20)
    assert r.status_code == 400
    assert "not allowed" in r.text.lower() or "url" in r.text.lower()


# ---------- 12. Regression: leads CRUD ----------
def test_leads_crud_full_cycle(admin_token):
    payload = {
        "name": f"TEST_iter5_crud_{RUN_ID}",
        "email": f"crud_{RUN_ID}@example.com",
        "phone": "+15550008888",
        "source": "test",
    }
    c = requests.post(f"{BASE_URL}/api/leads", headers=auth(admin_token),
                      json=payload, timeout=20)
    assert c.status_code in (200, 201), c.text
    body = c.json()
    lead_id = body.get("id") or body.get("lead", {}).get("id")
    assert lead_id

    try:
        # list contains
        l = requests.get(f"{BASE_URL}/api/leads", headers=auth(admin_token), timeout=15)
        assert l.status_code == 200

        # update
        u = requests.put(f"{BASE_URL}/api/leads/{lead_id}",
                         headers=auth(admin_token),
                         json={"status": "CONTACTED"}, timeout=15)
        assert u.status_code in (200, 204), u.text
    finally:
        d = requests.delete(f"{BASE_URL}/api/leads/{lead_id}",
                            headers=auth(admin_token), timeout=15)
        assert d.status_code in (200, 204)


# ---------- 13. Regression: integrations endpoint ----------
def test_integrations_get_ok(admin_token):
    r = requests.get(f"{BASE_URL}/api/integrations",
                     headers=auth(admin_token), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
