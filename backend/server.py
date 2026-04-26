"""ZeroMark AI - FastAPI Backend
B2B Marketing platform with Auth, Leads, Campaigns, AI generation, Approvals,
Reports, Subscription billing (Razorpay), SMS (Twilio), Email (Gmail SMTP).
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import asyncio
import secrets
import hmac
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# Service clients (lazy import-safe)
from twilio.rest import Client as TwilioClient
import razorpay
from groq import Groq

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("zeromark")

mongo_url = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[DB_NAME]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

app = FastAPI(title="ZeroMark AI")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def serialize_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "email": u["email"],
        "first_name": u.get("first_name", ""),
        "last_name": u.get("last_name", ""),
        "role": u.get("role", "user"),
        "created_at": iso(u.get("created_at")),
    }


async def get_current_user(request: Request) -> Dict[str, Any]:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    first_name: str
    last_name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class BusinessProfileIn(BaseModel):
    business_name: str
    industry: str
    location: str
    target_audience: str
    website_url: Optional[str] = None
    description: Optional[str] = None
    social_handles: Optional[Dict[str, str]] = None


class LeadIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: str = "MANUAL"
    status: str = "NEW"
    notes: Optional[str] = None
    score: int = 0


class LeadUpdateIn(BaseModel):
    status: Optional[str] = None
    score: Optional[int] = None
    notes: Optional[str] = None


class CampaignIn(BaseModel):
    name: str
    type: str  # EMAIL_BLAST | SMS_BLAST | SOCIAL_POST | WHATSAPP
    channel: str  # EMAIL | SMS | WHATSAPP | FACEBOOK | INSTAGRAM | LINKEDIN
    content: str
    subject: Optional[str] = None
    scheduled_at: Optional[str] = None


class ApprovalActionIn(BaseModel):
    comments: Optional[str] = None
    content: Optional[str] = None  # used for modify


class AIGenerateIn(BaseModel):
    channel: str
    goal: str
    tone: str = "professional"
    audience: Optional[str] = None
    product: Optional[str] = None
    language: str = "English"


class ScrapeIn(BaseModel):
    type: str  # GOOGLE_MAPS_LEADS | LINKEDIN_LEADS | COMPETITOR_KEYWORDS
    location: Optional[str] = None
    keyword: Optional[str] = None
    website: Optional[str] = None


class ReportIn(BaseModel):
    type: str
    period_days: int = 30


class CheckoutIn(BaseModel):
    plan_id: str  # basic | pro | enterprise


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "role": "user",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    # Create default trial subscription
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "plan": "FREE_TRIAL",
        "status": "ACTIVE",
        "trial_ends_at": (now_utc() + timedelta(days=14)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
    return {"user": serialize_user(doc), "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
    return {"user": serialize_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"success": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": serialize_user(user)}


# ---------- Business Profile ----------
@api.get("/business")
async def get_business(user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"profile": profile}


@api.post("/business")
async def upsert_business(payload: BusinessProfileIn, user=Depends(get_current_user)):
    data = payload.model_dump()
    data["user_id"] = user["id"]
    data["updated_at"] = now_utc().isoformat()
    existing = await db.business_profiles.find_one({"user_id": user["id"]})
    if existing:
        await db.business_profiles.update_one({"user_id": user["id"]}, {"$set": data})
    else:
        data["id"] = str(uuid.uuid4())
        data["created_at"] = now_utc().isoformat()
        await db.business_profiles.insert_one(data)
    profile = await db.business_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"profile": profile}


# ---------- Leads ----------
@api.get("/leads")
async def list_leads(
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    source: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: Dict[str, Any] = {"user_id": user["id"]}
    if status_filter:
        q["status"] = status_filter
    if source:
        q["source"] = source
    total = await db.leads.count_documents(q)
    cursor = db.leads.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    leads = await cursor.to_list(limit)
    return {
        "leads": leads,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
    }


@api.post("/leads")
async def create_lead(payload: LeadIn, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["created_at"] = now_utc().isoformat()
    await db.leads.insert_one(doc)
    doc.pop("_id", None)
    return {"lead": doc}


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: LeadUpdateIn, user=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = now_utc().isoformat()
    res = await db.leads.update_one({"id": lead_id, "user_id": user["id"]}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True}


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id, "user_id": user["id"]})
    return {"success": True}


@api.post("/leads/import")
async def import_leads(leads: List[LeadIn], user=Depends(get_current_user)):
    docs = []
    for lead in leads:
        d = lead.model_dump()
        d["id"] = str(uuid.uuid4())
        d["user_id"] = user["id"]
        d["created_at"] = now_utc().isoformat()
        docs.append(d)
    if docs:
        await db.leads.insert_many(docs)
    return {"success": True, "count": len(docs)}


# ---------- Campaigns ----------
@api.get("/campaigns")
async def list_campaigns(user=Depends(get_current_user)):
    cursor = db.campaigns.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    campaigns = await cursor.to_list(500)
    return {"campaigns": campaigns}


@api.post("/campaigns")
async def create_campaign(payload: CampaignIn, user=Depends(get_current_user)):
    cid = str(uuid.uuid4())
    doc = payload.model_dump()
    doc["id"] = cid
    doc["user_id"] = user["id"]
    doc["status"] = "PENDING_APPROVAL"
    doc["created_at"] = now_utc().isoformat()
    doc["sent_count"] = 0
    doc["delivered_count"] = 0
    await db.campaigns.insert_one(doc)
    # Add to approval queue
    await db.approvals.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "campaign_id": cid,
        "channel": payload.channel,
        "content": payload.content,
        "subject": payload.subject,
        "status": "PENDING",
        "created_at": now_utc().isoformat(),
    })
    doc.pop("_id", None)
    return {"campaign": doc}


@api.get("/campaigns/{cid}")
async def get_campaign(cid: str, user=Depends(get_current_user)):
    c = await db.campaigns.find_one({"id": cid, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"campaign": c}


@api.delete("/campaigns/{cid}")
async def delete_campaign(cid: str, user=Depends(get_current_user)):
    await db.campaigns.delete_one({"id": cid, "user_id": user["id"]})
    await db.approvals.delete_many({"campaign_id": cid})
    return {"success": True}


@api.post("/campaigns/{cid}/send")
async def send_campaign(cid: str, user=Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": cid, "user_id": user["id"]}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign["status"] not in ("APPROVED", "MODIFIED"):
        raise HTTPException(status_code=400, detail="Campaign not approved")
    # Get leads
    leads = await db.leads.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    sent = 0
    failed = 0
    channel = campaign["channel"]
    content = campaign["content"]
    subject = campaign.get("subject") or campaign["name"]
    for lead in leads:
        try:
            if channel == "EMAIL" and lead.get("email"):
                ok = await asyncio.get_event_loop().run_in_executor(
                    None, _send_email_sync, lead["email"], subject,
                    _personalize(content, lead)
                )
                sent += 1 if ok else 0
                failed += 0 if ok else 1
            elif channel == "SMS" and lead.get("phone"):
                ok = await asyncio.get_event_loop().run_in_executor(
                    None, _send_sms_sync, lead["phone"], _personalize(content, lead)
                )
                sent += 1 if ok else 0
                failed += 0 if ok else 1
            else:
                # WhatsApp / social channels are simulated for preview
                sent += 1
            # Log communication
            await db.communications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "campaign_id": cid,
                "lead_id": lead["id"],
                "channel": channel,
                "status": "SENT",
                "sent_at": now_utc().isoformat(),
            })
        except Exception as e:
            logger.exception("Send failure: %s", e)
            failed += 1
    await db.campaigns.update_one(
        {"id": cid},
        {"$set": {"status": "SENT", "sent_count": sent, "failed_count": failed,
                  "sent_at": now_utc().isoformat()}}
    )
    return {"success": True, "sent": sent, "failed": failed}


def _personalize(text: str, lead: Dict[str, Any]) -> str:
    return (
        text.replace("{{name}}", lead.get("name") or "there")
            .replace("{{email}}", lead.get("email") or "")
            .replace("{{company}}", lead.get("company") or "")
    )


def _send_email_sync(to: str, subject: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((os.environ["EMAILS_FROM_NAME"], os.environ["GMAIL_SENDER_EMAIL"]))
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(os.environ["SMTP_SERVER"], int(os.environ["SMTP_PORT"]), timeout=20) as s:
            s.starttls()
            s.login(os.environ["GMAIL_SENDER_EMAIL"], os.environ["GMAIL_APP_PASSWORD"])
            s.send_message(msg)
        return True
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return False


def _send_sms_sync(to: str, body: str) -> bool:
    try:
        twilio = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
        twilio.messages.create(from_=os.environ["TWILIO_PHONE_NUMBER"], to=to, body=body)
        return True
    except Exception as e:
        logger.error("SMS send failed: %s", e)
        return False


# ---------- AI Generate ----------
@api.post("/ai/generate-content")
async def ai_generate_content(payload: AIGenerateIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    business_ctx = ""
    if profile:
        business_ctx = (
            f"Business: {profile.get('business_name', '')}\n"
            f"Industry: {profile.get('industry', '')}\n"
            f"Target audience: {profile.get('target_audience', '')}\n"
            f"Location: {profile.get('location', '')}\n"
        )
    channel_specs = {
        "EMAIL": "Write a marketing email with a subject line on the first line prefixed with 'Subject: ', then a blank line, then HTML body. Keep it concise and persuasive.",
        "SMS": "Write a single SMS message under 160 characters. Conversational, direct, with one clear CTA.",
        "WHATSAPP": "Write a friendly WhatsApp marketing message under 300 characters with emojis and a CTA.",
        "FACEBOOK": "Write a Facebook post under 200 words with a hook and CTA.",
        "INSTAGRAM": "Write an Instagram caption under 200 words with relevant hashtags.",
        "LINKEDIN": "Write a professional LinkedIn post under 200 words.",
    }
    spec = channel_specs.get(payload.channel.upper(), channel_specs["EMAIL"])
    prompt = (
        f"{business_ctx}\n"
        f"Goal: {payload.goal}\n"
        f"Tone: {payload.tone}\n"
        f"Audience: {payload.audience or 'general'}\n"
        f"Product/Offer: {payload.product or 'our offering'}\n"
        f"Language: {payload.language}\n\n"
        f"Task: {spec}\n"
        "Use {{name}} as a placeholder where the recipient's name should appear."
    )

    def _generate():
        client_g = Groq(api_key=os.environ["GROQ_API_KEY"])
        completion = client_g.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert marketing copywriter. Write compelling, concise content that drives conversions."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
            max_tokens=800,
        )
        return completion.choices[0].message.content

    try:
        content = await asyncio.get_event_loop().run_in_executor(None, _generate)
    except Exception as e:
        logger.exception("Groq generation failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    # If channel is EMAIL, split subject
    subject = None
    body = content
    if payload.channel.upper() == "EMAIL":
        lines = content.strip().splitlines()
        if lines and lines[0].lower().startswith("subject:"):
            subject = lines[0].split(":", 1)[1].strip()
            body = "\n".join(lines[1:]).strip()
    return {"content": body, "subject": subject}


# ---------- Approvals ----------
@api.get("/approvals")
async def get_approvals(user=Depends(get_current_user)):
    cursor = db.approvals.find({"user_id": user["id"], "status": "PENDING"}, {"_id": 0}).sort("created_at", -1)
    approvals = await cursor.to_list(200)
    # Attach campaign info
    for a in approvals:
        c = await db.campaigns.find_one({"id": a.get("campaign_id")}, {"_id": 0})
        a["campaign"] = c
    return {"approvals": approvals}


@api.post("/approvals/{aid}/approve")
async def approve(aid: str, payload: ApprovalActionIn, user=Depends(get_current_user)):
    a = await db.approvals.find_one({"id": aid, "user_id": user["id"]})
    if not a:
        raise HTTPException(status_code=404, detail="Approval not found")
    await db.approvals.update_one({"id": aid}, {"$set": {
        "status": "APPROVED", "reviewed_at": now_utc().isoformat(), "comments": payload.comments
    }})
    if a.get("campaign_id"):
        await db.campaigns.update_one({"id": a["campaign_id"]}, {"$set": {"status": "APPROVED"}})
    return {"success": True}


@api.post("/approvals/{aid}/reject")
async def reject(aid: str, payload: ApprovalActionIn, user=Depends(get_current_user)):
    a = await db.approvals.find_one({"id": aid, "user_id": user["id"]})
    if not a:
        raise HTTPException(status_code=404, detail="Approval not found")
    await db.approvals.update_one({"id": aid}, {"$set": {
        "status": "REJECTED", "reviewed_at": now_utc().isoformat(), "comments": payload.comments
    }})
    if a.get("campaign_id"):
        await db.campaigns.update_one({"id": a["campaign_id"]}, {"$set": {"status": "REJECTED"}})
    return {"success": True}


@api.post("/approvals/{aid}/modify")
async def modify(aid: str, payload: ApprovalActionIn, user=Depends(get_current_user)):
    if not payload.content:
        raise HTTPException(status_code=400, detail="Content required")
    a = await db.approvals.find_one({"id": aid, "user_id": user["id"]})
    if not a:
        raise HTTPException(status_code=404, detail="Approval not found")
    await db.approvals.update_one({"id": aid}, {"$set": {
        "status": "APPROVED", "content": payload.content,
        "reviewed_at": now_utc().isoformat(), "comments": payload.comments
    }})
    if a.get("campaign_id"):
        await db.campaigns.update_one({"id": a["campaign_id"]}, {"$set": {
            "content": payload.content, "status": "APPROVED"
        }})
    return {"success": True}


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    uid = user["id"]
    total_leads = await db.leads.count_documents({"user_id": uid})
    total_campaigns = await db.campaigns.count_documents({"user_id": uid})
    pending_approvals = await db.approvals.count_documents({"user_id": uid, "status": "PENDING"})

    # Group leads by status
    leads_by_status = []
    for s in ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "NOT_INTERESTED"]:
        c = await db.leads.count_documents({"user_id": uid, "status": s})
        if c > 0:
            leads_by_status.append({"name": s, "value": c})

    campaigns_by_status = []
    for s in ["PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "FAILED"]:
        c = await db.campaigns.count_documents({"user_id": uid, "status": s})
        if c > 0:
            campaigns_by_status.append({"name": s, "value": c})

    contacted = await db.leads.count_documents({"user_id": uid, "status": {"$in": ["CONTACTED", "INTERESTED", "CONVERTED"]}})
    converted = await db.leads.count_documents({"user_id": uid, "status": "CONVERTED"})
    conversion_rate = round((converted / contacted * 100) if contacted else 0)

    sub = await db.subscriptions.find_one({"user_id": uid}, {"_id": 0})
    trial_days_left = 0
    if sub and sub.get("trial_ends_at"):
        end = datetime.fromisoformat(sub["trial_ends_at"])
        diff = (end - now_utc()).total_seconds() / 86400
        trial_days_left = max(0, int(diff))

    recent_leads = await db.leads.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_campaigns = await db.campaigns.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)

    # Leads created over last 14 days
    leads_over_time = []
    for i in range(13, -1, -1):
        day_start = (now_utc() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.leads.count_documents({
            "user_id": uid,
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        })
        leads_over_time.append({"date": day_start.strftime("%b %d"), "count": count})

    return {
        "stats": {
            "total_leads": total_leads,
            "total_campaigns": total_campaigns,
            "pending_approvals": pending_approvals,
            "conversion_rate": conversion_rate,
            "subscription_tier": (sub or {}).get("plan", "FREE_TRIAL"),
            "trial_days_left": trial_days_left,
        },
        "charts": {
            "leads_by_status": leads_by_status,
            "campaigns_by_status": campaigns_by_status,
            "leads_over_time": leads_over_time,
        },
        "recent": {"leads": recent_leads, "campaigns": recent_campaigns},
    }


# ---------- Reports ----------
@api.get("/reports")
async def list_reports(user=Depends(get_current_user)):
    reports = await db.reports.find({"user_id": user["id"]}, {"_id": 0}).sort("generated_at", -1).to_list(50)
    return {"reports": reports}


@api.post("/reports/generate")
async def generate_report(payload: ReportIn, user=Depends(get_current_user)):
    uid = user["id"]
    period_start = now_utc() - timedelta(days=payload.period_days)
    data: Dict[str, Any] = {}

    if payload.type == "LEAD_PERFORMANCE":
        leads = await db.leads.find({
            "user_id": uid,
            "created_at": {"$gte": period_start.isoformat()}
        }, {"_id": 0}).to_list(5000)
        by_source: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        for l in leads:
            by_source[l.get("source", "MANUAL")] = by_source.get(l.get("source", "MANUAL"), 0) + 1
            by_status[l.get("status", "NEW")] = by_status.get(l.get("status", "NEW"), 0) + 1
        data = {"by_source": by_source, "by_status": by_status, "total": len(leads)}

    elif payload.type == "CAMPAIGN_PERFORMANCE":
        campaigns = await db.campaigns.find({
            "user_id": uid,
            "created_at": {"$gte": period_start.isoformat()}
        }, {"_id": 0}).to_list(5000)
        sent = sum(c.get("sent_count", 0) for c in campaigns)
        failed = sum(c.get("failed_count", 0) for c in campaigns)
        data = {"total_campaigns": len(campaigns), "messages_sent": sent, "messages_failed": failed,
                "by_channel": _group_count(campaigns, "channel"),
                "by_status": _group_count(campaigns, "status")}

    elif payload.type == "GAP_ANALYSIS":
        target = 1000
        current = await db.leads.count_documents({"user_id": uid, "created_at": {"$gte": period_start.isoformat()}})
        gap = max(0, target - current)
        suggestions = (
            ["Run AI-generated email blast", "Scrape Google Maps in new geo", "Increase ad spend on top channel"]
            if gap > 0 else ["Excellent! Consider scaling up to next tier"]
        )
        data = {"target": target, "current": current, "gap": gap, "suggestions": suggestions}

    report = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "type": payload.type,
        "data": data,
        "period_start": period_start.isoformat(),
        "period_end": now_utc().isoformat(),
        "generated_at": now_utc().isoformat(),
    }
    await db.reports.insert_one(report)
    report.pop("_id", None)
    return {"report": report}


def _group_count(items: List[Dict[str, Any]], field: str) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for it in items:
        k = it.get(field, "OTHER")
        out[k] = out.get(k, 0) + 1
    return out


# ---------- Scraping (sample/demo data generator) ----------
@api.post("/scraping/start")
async def start_scrape(payload: ScrapeIn, user=Depends(get_current_user)):
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "user_id": user["id"],
        "type": payload.type,
        "params": payload.model_dump(),
        "status": "PROCESSING",
        "created_at": now_utc().isoformat(),
    }
    await db.scraping_jobs.insert_one(job)

    # Generate sample leads using AI based on inputs (demo-friendly, no Playwright)
    try:
        results = await _ai_generate_sample_leads(payload, user["id"])
        # Auto-import leads
        if results and payload.type in ("GOOGLE_MAPS_LEADS", "LINKEDIN_LEADS"):
            for r in results:
                r["id"] = str(uuid.uuid4())
                r["user_id"] = user["id"]
                r["created_at"] = now_utc().isoformat()
                r["source"] = payload.type
                r["status"] = "NEW"
                r["score"] = 50
            await db.leads.insert_many(results)
        await db.scraping_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "COMPLETED", "completed_at": now_utc().isoformat(), "result_count": len(results)}},
        )
        return {"job_id": job_id, "status": "completed", "count": len(results)}
    except Exception as e:
        logger.exception("Scrape failed")
        await db.scraping_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "FAILED", "error": str(e), "completed_at": now_utc().isoformat()}},
        )
        raise HTTPException(status_code=500, detail=f"Scrape failed: {e}")


async def _ai_generate_sample_leads(payload: ScrapeIn, user_id: str) -> List[Dict[str, Any]]:
    """Generate realistic sample leads using Groq based on scrape params."""
    if payload.type == "GOOGLE_MAPS_LEADS":
        prompt = (
            f"Generate 12 realistic sample business leads for the keyword '{payload.keyword}' in '{payload.location}'. "
            "Return ONLY a JSON array with objects: name, company, email, phone, notes. "
            "Use realistic-sounding business names; emails on plausible domains; phone numbers in international E.164 format. "
            "Notes should briefly describe the business (1 sentence). No commentary, just JSON."
        )
    elif payload.type == "LINKEDIN_LEADS":
        prompt = (
            f"Generate 10 realistic sample LinkedIn leads matching the role/keyword '{payload.keyword}'. "
            "Return ONLY a JSON array with objects: name, company, email, phone, notes (1 line job title). No commentary."
        )
    else:  # COMPETITOR_KEYWORDS
        prompt = (
            f"Given the website '{payload.website}', list 10 likely competitor companies as JSON array of "
            "{name, company, email, phone, notes}. The note should be the competitor URL. No commentary, just JSON."
        )

    def _gen():
        c = Groq(api_key=os.environ["GROQ_API_KEY"])
        comp = c.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a data generator. Output strict JSON only with no markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        return comp.choices[0].message.content

    raw = await asyncio.get_event_loop().run_in_executor(None, _gen)
    import json, re
    try:
        # Try to parse, possibly wrapped in object
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            # Find first list value
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break
        if not isinstance(parsed, list):
            parsed = []
    except Exception:
        # Fallback: extract array
        m = re.search(r"\[.*\]", raw, re.S)
        parsed = json.loads(m.group(0)) if m else []
    return parsed[:15]


@api.get("/scraping/jobs")
async def list_scraping_jobs(user=Depends(get_current_user)):
    jobs = await db.scraping_jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"jobs": jobs}


# ---------- Subscription / Razorpay ----------
PLANS = {
    "basic": {"id": "basic", "name": "Basic", "price_inr": 499, "features": ["500 leads/month", "Email + SMS", "Basic reports", "1 user"]},
    "pro": {"id": "pro", "name": "Pro", "price_inr": 1499, "features": ["5000 leads/month", "All channels", "AI generation", "Advanced analytics", "5 users"]},
    "enterprise": {"id": "enterprise", "name": "Enterprise", "price_inr": 4999, "features": ["Unlimited leads", "Priority support", "Custom integrations", "SLA", "Unlimited users"]},
}


@api.get("/subscription/plans")
async def list_plans():
    return {"plans": list(PLANS.values())}


@api.get("/subscription/me")
async def my_subscription(user=Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"subscription": sub}


@api.post("/subscription/checkout")
async def create_checkout(payload: CheckoutIn, user=Depends(get_current_user)):
    if payload.plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    plan = PLANS[payload.plan_id]
    rzp = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    amount_paise = int(plan["price_inr"]) * 100
    order = rzp.order.create({
        "amount": amount_paise,
        "currency": os.environ.get("RAZORPAY_CURRENCY", "INR"),
        "receipt": f"sub_{user['id'][:8]}_{int(now_utc().timestamp())}",
        "notes": {"user_id": user["id"], "plan_id": payload.plan_id},
    })
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": os.environ["RAZORPAY_KEY_ID"],
        "plan": plan,
    }


@api.post("/subscription/verify-payment")
async def verify_payment(payload: VerifyPaymentIn, user=Depends(get_current_user)):
    rzp = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    try:
        rzp.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    plan_name = payload.plan_id.upper()
    await db.subscriptions.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "plan": plan_name,
            "status": "ACTIVE",
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "activated_at": now_utc().isoformat(),
            "trial_ends_at": None,
        }},
        upsert=True,
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "razorpay_order_id": payload.razorpay_order_id,
        "razorpay_payment_id": payload.razorpay_payment_id,
        "plan_id": payload.plan_id,
        "amount_inr": PLANS[payload.plan_id]["price_inr"],
        "created_at": now_utc().isoformat(),
        "status": "SUCCESS",
    })
    return {"success": True, "plan": plan_name}


# ---------- Health ----------
@api.get("/")
async def root():
    return {"message": "ZeroMark AI API", "status": "ok"}


@api.get("/health")
async def health():
    return {"status": "healthy", "time": now_utc().isoformat()}


# Register router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index([("user_id", 1), ("created_at", -1)])
    await db.campaigns.create_index([("user_id", 1), ("created_at", -1)])
    await db.approvals.create_index([("user_id", 1), ("status", 1)])
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@zeromark.ai")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "first_name": "Admin",
            "last_name": "User",
            "role": "admin",
            "created_at": now_utc().isoformat(),
        })
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "plan": "PRO",
            "status": "ACTIVE",
            "trial_ends_at": None,
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pw)}},
        )
        logger.info("Updated admin password")


@app.on_event("shutdown")
async def shutdown():
    client.close()
