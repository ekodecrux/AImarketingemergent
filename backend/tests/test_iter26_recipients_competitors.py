"""Iter26 backend tests — covers user-reported issues 3-8:
- Quick Plan AI works (Gemini routing)
- Lead scrape, add lead, bulk CSV upload
- Competitor add+scan (NameError fix verification)
- Campaign recipient targeting (by_status / manual / selected)
- Campaign duplicate endpoint
- Background _run_campaign_send respects scope (selected lead targeting)
"""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://instant-ship-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@zeromark.ai"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---- Issue 1 (regression): Quick Plan ----
def test_quick_plan_generate(auth_session):
    r = auth_session.post(f"{BASE_URL}/api/quick-plan/generate",
                          json={"monthly_budget": 5000, "duration_months": 3}, timeout=120)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    # plan can be wrapped or top-level — verify a non-empty payload exists
    assert isinstance(data, dict) and len(data) > 0
    txt = str(data).lower()
    assert "ai is busy" not in txt and "rate limit" not in txt


# ---- Issue 5: Add Lead ----
def test_create_lead_and_verify(auth_session):
    payload = {"name": "TEST_iter26 Lead", "email": f"TEST_iter26_{uuid.uuid4().hex[:6]}@example.com",
               "phone": "+919812345678", "company": "TestCo", "source": "MANUAL", "status": "NEW"}
    r = auth_session.post(f"{BASE_URL}/api/leads", json=payload, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    lead = r.json().get("lead")
    assert lead and lead["email"] == payload["email"]
    assert lead.get("id")
    # Persist check
    g = auth_session.get(f"{BASE_URL}/api/leads", params={"limit": 50}, timeout=20)
    assert g.status_code == 200
    ids = [x.get("id") for x in g.json().get("leads", [])]
    assert lead["id"] in ids


# ---- Issue 4: Bulk CSV Upload ----
def test_bulk_csv_upload(auth_session):
    csv_text = (
        "email,first_name,last_name,phone,company\n"
        f"TEST_csv_{uuid.uuid4().hex[:6]}@example.com,Alice,Wong,+15550000001,Acme\n"
        f"TEST_csv_{uuid.uuid4().hex[:6]}@example.com,Bob,Lee,+15550000002,Beta\n"
    )
    files = {"file": ("leads.csv", io.BytesIO(csv_text.encode()), "text/csv")}
    # multipart — strip JSON content-type for this call
    s = requests.Session()
    s.headers.update({k: v for k, v in auth_session.headers.items() if k.lower() != "content-type"})
    r = s.post(f"{BASE_URL}/api/leads/import-csv", files=files, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("imported", 0) >= 1


# ---- Issue 3: Lead Scrape ----
def test_scrape_google_maps_leads(auth_session):
    r = auth_session.post(f"{BASE_URL}/api/scraping/start",
                          json={"type": "GOOGLE_MAPS_LEADS", "location": "Bangalore", "keyword": "dental clinics"},
                          timeout=120)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    # Either a job id or count returned — not strict on shape, but no error string
    assert "error" not in (str(data).lower()[:50])


# ---- Issue 6: Competitor add + scan (critical NameError fix) ----
def test_competitor_add_and_scan(auth_session):
    add = auth_session.post(f"{BASE_URL}/api/competitors",
                            json={"url": "https://stripe.com", "nickname": f"TEST_iter26_{uuid.uuid4().hex[:4]}"},
                            timeout=30)
    assert add.status_code in (200, 201), f"add: {add.status_code} {add.text[:300]}"
    body = add.json()
    comp = body.get("competitor") or body
    cid = comp.get("id") or body.get("id")
    assert cid, f"no competitor id: {body}"

    scan = auth_session.post(f"{BASE_URL}/api/competitors/{cid}/scan", timeout=120)
    assert scan.status_code == 200, f"scan: {scan.status_code} {scan.text[:500]}"
    sbody = scan.json()
    text = str(sbody).lower()
    assert "name 'r' is not defined" not in text and "nameerror" not in text, f"bug regressed: {sbody}"
    # Snapshot fields must exist somewhere in payload
    snap_str = str(sbody)
    assert any(k in sbody or k in snap_str.lower() for k in ("snapshot", "title", "h1s", "meta_desc"))


# ---- Issue 7: Campaign create with by_status ----
def test_campaign_create_by_status(auth_session):
    payload = {"name": "TEST_iter26_by_status", "type": "EMAIL_BLAST", "channel": "EMAIL",
               "content": "Hi {{name}}", "subject": "Hello",
               "recipient_scope": "by_status", "recipient_statuses": ["NEW"]}
    r = auth_session.post(f"{BASE_URL}/api/campaigns", json=payload, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    c = r.json().get("campaign")
    assert c and c.get("recipient_scope") == "by_status"
    assert c.get("recipient_statuses") == ["NEW"]


# ---- Issue 7: Campaign create with manual recipients ----
def test_campaign_create_manual_recipients(auth_session):
    payload = {"name": "TEST_iter26_manual", "type": "EMAIL_BLAST", "channel": "EMAIL",
               "content": "Hi", "subject": "Hello",
               "recipient_scope": "manual", "extra_recipients": ["test@x.com", "test2@y.com"]}
    r = auth_session.post(f"{BASE_URL}/api/campaigns", json=payload, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    c = r.json().get("campaign")
    assert c and c.get("recipient_scope") == "manual"
    assert "test@x.com" in (c.get("extra_recipients") or [])


# ---- Issue 8: Campaign duplicate ----
def test_campaign_duplicate(auth_session):
    create = auth_session.post(f"{BASE_URL}/api/campaigns",
                               json={"name": "TEST_iter26_orig", "type": "EMAIL_BLAST", "channel": "EMAIL",
                                     "content": "Original content", "subject": "Orig",
                                     "recipient_scope": "all_leads"},
                               timeout=30)
    assert create.status_code == 200
    orig = create.json()["campaign"]
    cid = orig["id"]

    dup = auth_session.post(f"{BASE_URL}/api/campaigns/{cid}/duplicate", timeout=30)
    assert dup.status_code == 200, f"{dup.status_code}: {dup.text[:300]}"
    d = dup.json().get("campaign")
    assert d and d["id"] != cid
    assert d["name"].endswith("(copy)")
    assert d["status"] == "PENDING_APPROVAL"
    assert d.get("content") == "Original content"


# ---- Issue 8/9: scope='selected' targets only specified leads ----
def test_campaign_scope_selected_targets_specific_leads(auth_session):
    # Create 2 leads
    lead_payload_1 = {"name": "TEST_sel_a", "email": f"TEST_sela_{uuid.uuid4().hex[:6]}@x.com", "source": "MANUAL"}
    lead_payload_2 = {"name": "TEST_sel_b", "email": f"TEST_selb_{uuid.uuid4().hex[:6]}@x.com", "source": "MANUAL"}
    l1 = auth_session.post(f"{BASE_URL}/api/leads", json=lead_payload_1, timeout=20).json()["lead"]
    l2 = auth_session.post(f"{BASE_URL}/api/leads", json=lead_payload_2, timeout=20).json()["lead"]

    # Create campaign targeting only l1
    c = auth_session.post(f"{BASE_URL}/api/campaigns",
                         json={"name": "TEST_iter26_selected", "type": "EMAIL_BLAST", "channel": "EMAIL",
                               "content": "Hi", "subject": "S",
                               "recipient_scope": "selected", "recipient_lead_ids": [l1["id"]]},
                         timeout=30).json()["campaign"]
    assert c["recipient_scope"] == "selected"
    assert c["recipient_lead_ids"] == [l1["id"]]

    # Get pending approval and approve so we can fire send
    apps = auth_session.get(f"{BASE_URL}/api/approvals", timeout=20).json().get("approvals", [])
    aid = next((a["id"] for a in apps if a.get("campaign_id") == c["id"]), None)
    if not aid:
        pytest.skip("no approval queued — cannot test send filtering")
    appr = auth_session.post(f"{BASE_URL}/api/approvals/{aid}/approve", json={"comments": "ok"}, timeout=20)
    assert appr.status_code == 200

    send = auth_session.post(f"{BASE_URL}/api/campaigns/{c['id']}/send", timeout=20)
    assert send.status_code == 200, f"send: {send.status_code} {send.text[:300]}"

    # Wait for background job to land communications
    time.sleep(8)
    # Pull campaign comms via GET campaign detail and verify only 1 lead targeted
    detail = auth_session.get(f"{BASE_URL}/api/campaigns/{c['id']}", timeout=20).json()["campaign"]
    # Communications collection isn't directly exposed; assert sent_count or failed_count <= 1+extras
    total = (detail.get("sent_count") or 0) + (detail.get("failed_count") or 0)
    assert total <= 1, f"expected <=1 recipient (selected scope) got total={total} on campaign={detail}"
