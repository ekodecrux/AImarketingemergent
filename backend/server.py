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
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
import requests as _http
from cryptography.fernet import Fernet
import base64
import imaplib
import email as _email_lib
from email.header import decode_header
from email.utils import parseaddr
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# Service clients (lazy import-safe)
from twilio.rest import Client as TwilioClient
from twilio.request_validator import RequestValidator as TwilioRequestValidator
import razorpay
from groq import Groq
import groq as _groq_pkg

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("zeromark")

mongo_url = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[DB_NAME]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

# Fernet key derived from JWT_SECRET (deterministic, no extra env var needed)
_FERNET_KEY = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
_fernet = Fernet(_FERNET_KEY)


def _enc(value: str) -> str:
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def _dec(value: str) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        return None


SENSITIVE_INTEGRATION_KEYS = {"access_token", "auth_token", "bearer_token", "api_key", "client_secret", "page_access_token"}


def ws(user: Dict[str, Any]) -> str:
    """Return the workspace_id for a user (defaults to user.id for solo)."""
    return user.get("workspace_id") or user["id"]

# Module-level Groq client reused across calls
_GROQ = Groq(api_key=os.environ["GROQ_API_KEY"])


def _groq_chat(prompt: str, system: str = "Output strict JSON only.", json_mode: bool = True,
               max_tokens: int = 2000, temperature: float = 0.5) -> str:
    """Robust Groq chat completion with retry on json_validate_failed.
    Distinguishes upstream rate limits (429) from bad-output (502)."""
    attempts = [
        {"temperature": temperature, "system": system},
        {"temperature": 0.0, "system": system + " Use ONLY ASCII double quotes; escape any inner quotes with \\\". Do not use smart quotes or apostrophes inside string values."},
    ]
    last_err = None
    for cfg in attempts:
        try:
            kwargs = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": cfg["system"]},
                    {"role": "user", "content": prompt},
                ],
                "temperature": cfg["temperature"],
                "max_tokens": max_tokens,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            comp = _GROQ.chat.completions.create(**kwargs)
            return comp.choices[0].message.content
        except _groq_pkg.RateLimitError as e:
            logger.warning("Groq rate limit (TPD/RPM): %s", str(e)[:200])
            raise HTTPException(
                status_code=429,
                detail="AI provider rate limit exceeded — please try again in a few minutes or reduce frequency.",
            )
        except _groq_pkg.BadRequestError as e:
            last_err = e
            logger.warning("Groq json_validate_failed, retrying with stricter prompt: %s", str(e)[:200])
            continue
        except Exception as e:
            last_err = e
            logger.exception("Groq call failed")
            break
    raise HTTPException(status_code=502, detail="AI provider returned invalid output. Please retry.")


def _is_safe_url(url: str) -> bool:
    """Block SSRF: reject loopback/private/link-local/metadata IPs."""
    try:
        from urllib.parse import urlparse
        import socket
        import ipaddress
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        host = p.hostname or ""
        if not host:
            return False
        # Resolve and check
        try:
            ip_str = socket.gethostbyname(host)
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                return False
            # Block AWS/GCP metadata
            if ip_str.startswith("169.254."):
                return False
        except Exception:
            return False
        return True
    except Exception:
        return False

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
        "email": u.get("email"),
        "phone": u.get("phone"),
        "first_name": u.get("first_name", ""),
        "last_name": u.get("last_name", ""),
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "email"),
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
    country_code: Optional[str] = "US"  # ISO 3166-1 alpha-2
    currency_code: Optional[str] = None  # Auto-derived from country if not provided


# Country → currency mapping (ISO 3166-1 alpha-2 → ISO 4217)
COUNTRY_CURRENCY: Dict[str, Dict[str, str]] = {
    "US": {"name": "United States", "currency": "USD", "symbol": "$", "locale": "en-US"},
    "GB": {"name": "United Kingdom", "currency": "GBP", "symbol": "£", "locale": "en-GB"},
    "IN": {"name": "India", "currency": "INR", "symbol": "₹", "locale": "en-IN"},
    "CA": {"name": "Canada", "currency": "CAD", "symbol": "C$", "locale": "en-CA"},
    "AU": {"name": "Australia", "currency": "AUD", "symbol": "A$", "locale": "en-AU"},
    "NZ": {"name": "New Zealand", "currency": "NZD", "symbol": "NZ$", "locale": "en-NZ"},
    "SG": {"name": "Singapore", "currency": "SGD", "symbol": "S$", "locale": "en-SG"},
    "HK": {"name": "Hong Kong", "currency": "HKD", "symbol": "HK$", "locale": "en-HK"},
    "JP": {"name": "Japan", "currency": "JPY", "symbol": "¥", "locale": "ja-JP"},
    "KR": {"name": "South Korea", "currency": "KRW", "symbol": "₩", "locale": "ko-KR"},
    "CN": {"name": "China", "currency": "CNY", "symbol": "¥", "locale": "zh-CN"},
    "DE": {"name": "Germany", "currency": "EUR", "symbol": "€", "locale": "de-DE"},
    "FR": {"name": "France", "currency": "EUR", "symbol": "€", "locale": "fr-FR"},
    "IT": {"name": "Italy", "currency": "EUR", "symbol": "€", "locale": "it-IT"},
    "ES": {"name": "Spain", "currency": "EUR", "symbol": "€", "locale": "es-ES"},
    "NL": {"name": "Netherlands", "currency": "EUR", "symbol": "€", "locale": "nl-NL"},
    "BE": {"name": "Belgium", "currency": "EUR", "symbol": "€", "locale": "fr-BE"},
    "IE": {"name": "Ireland", "currency": "EUR", "symbol": "€", "locale": "en-IE"},
    "PT": {"name": "Portugal", "currency": "EUR", "symbol": "€", "locale": "pt-PT"},
    "AT": {"name": "Austria", "currency": "EUR", "symbol": "€", "locale": "de-AT"},
    "FI": {"name": "Finland", "currency": "EUR", "symbol": "€", "locale": "fi-FI"},
    "GR": {"name": "Greece", "currency": "EUR", "symbol": "€", "locale": "el-GR"},
    "CH": {"name": "Switzerland", "currency": "CHF", "symbol": "CHF", "locale": "de-CH"},
    "SE": {"name": "Sweden", "currency": "SEK", "symbol": "kr", "locale": "sv-SE"},
    "NO": {"name": "Norway", "currency": "NOK", "symbol": "kr", "locale": "nb-NO"},
    "DK": {"name": "Denmark", "currency": "DKK", "symbol": "kr", "locale": "da-DK"},
    "PL": {"name": "Poland", "currency": "PLN", "symbol": "zł", "locale": "pl-PL"},
    "MX": {"name": "Mexico", "currency": "MXN", "symbol": "Mex$", "locale": "es-MX"},
    "BR": {"name": "Brazil", "currency": "BRL", "symbol": "R$", "locale": "pt-BR"},
    "AR": {"name": "Argentina", "currency": "ARS", "symbol": "AR$", "locale": "es-AR"},
    "CL": {"name": "Chile", "currency": "CLP", "symbol": "CL$", "locale": "es-CL"},
    "CO": {"name": "Colombia", "currency": "COP", "symbol": "Col$", "locale": "es-CO"},
    "ZA": {"name": "South Africa", "currency": "ZAR", "symbol": "R", "locale": "en-ZA"},
    "NG": {"name": "Nigeria", "currency": "NGN", "symbol": "₦", "locale": "en-NG"},
    "EG": {"name": "Egypt", "currency": "EGP", "symbol": "E£", "locale": "ar-EG"},
    "KE": {"name": "Kenya", "currency": "KES", "symbol": "KSh", "locale": "en-KE"},
    "AE": {"name": "United Arab Emirates", "currency": "AED", "symbol": "AED", "locale": "en-AE"},
    "SA": {"name": "Saudi Arabia", "currency": "SAR", "symbol": "SAR", "locale": "ar-SA"},
    "IL": {"name": "Israel", "currency": "ILS", "symbol": "₪", "locale": "he-IL"},
    "TR": {"name": "Turkey", "currency": "TRY", "symbol": "₺", "locale": "tr-TR"},
    "RU": {"name": "Russia", "currency": "RUB", "symbol": "₽", "locale": "ru-RU"},
    "ID": {"name": "Indonesia", "currency": "IDR", "symbol": "Rp", "locale": "id-ID"},
    "TH": {"name": "Thailand", "currency": "THB", "symbol": "฿", "locale": "th-TH"},
    "MY": {"name": "Malaysia", "currency": "MYR", "symbol": "RM", "locale": "ms-MY"},
    "PH": {"name": "Philippines", "currency": "PHP", "symbol": "₱", "locale": "en-PH"},
    "VN": {"name": "Vietnam", "currency": "VND", "symbol": "₫", "locale": "vi-VN"},
    "PK": {"name": "Pakistan", "currency": "PKR", "symbol": "₨", "locale": "en-PK"},
    "BD": {"name": "Bangladesh", "currency": "BDT", "symbol": "৳", "locale": "bn-BD"},
    "LK": {"name": "Sri Lanka", "currency": "LKR", "symbol": "Rs", "locale": "en-LK"},
}


def _resolve_locale(country_code: Optional[str], currency_override: Optional[str] = None) -> Dict[str, str]:
    cc = (country_code or "US").upper()
    info = COUNTRY_CURRENCY.get(cc) or COUNTRY_CURRENCY["US"]
    out = dict(info)
    out["country_code"] = cc
    if currency_override:
        out["currency"] = currency_override.upper()
    return out


async def _user_locale(user: Dict[str, Any]) -> Dict[str, str]:
    profile = await db.business_profiles.find_one(
        {"user_id": ws(user)}, {"_id": 0, "country_code": 1, "currency_code": 1, "location": 1},
    ) or {}
    return _resolve_locale(profile.get("country_code"), profile.get("currency_code"))


class LeadIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: str = "MANUAL"
    status: str = "NEW"
    notes: Optional[str] = None
    score: int = 0
    estimated_value: float = 0.0  # expected deal value


class LeadUpdateIn(BaseModel):
    status: Optional[str] = None
    score: Optional[int] = None
    notes: Optional[str] = None
    estimated_value: Optional[float] = None
    actual_value: Optional[float] = None


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
        "workspace_id": user_id,
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
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower()
    # Real client IP: prefer X-Forwarded-For first hop, fall back to request.client.host
    fwd = request.headers.get("x-forwarded-for", "")
    real_ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    ip_id = f"{real_ip}:{email}"
    email_id = f"email:{email}"

    # Brute-force lockout: 5 failed attempts -> 15min lock (whichever counter trips first)
    for ident in (ip_id, email_id):
        rec = await db.login_attempts.find_one({"identifier": ident})
        if rec and rec.get("locked_until"):
            locked_until = datetime.fromisoformat(rec["locked_until"])
            if locked_until > now_utc():
                mins = int((locked_until - now_utc()).total_seconds() / 60) + 1
                raise HTTPException(status_code=429, detail=f"Too many failed attempts. Locked for {mins} more minute(s).")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        # Increment BOTH counters so account always locks at 5 fails regardless of IP
        for ident in (ip_id, email_id):
            existing = await db.login_attempts.find_one({"identifier": ident})
            count = (existing or {}).get("count", 0) + 1
            update: Dict[str, Any] = {"count": count, "last_attempt": now_utc().isoformat()}
            if count >= 5:
                update["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat()
                update["count"] = 0
            await db.login_attempts.update_one(
                {"identifier": ident},
                {"$set": update, "$setOnInsert": {"identifier": ident}},
                upsert=True,
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Success — clear both counters
    await db.login_attempts.delete_many({"identifier": {"$in": [ip_id, email_id]}})
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
    return {"user": serialize_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"success": True}


# ---------- Google OAuth (Emergent-managed) ----------
class GoogleCallbackIn(BaseModel):
    session_id: str


@api.post("/auth/google/callback")
async def google_callback(payload: GoogleCallbackIn, response: Response):
    """Exchange Emergent session_id for our JWT.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
    """
    import requests as _rq
    try:
        r = _rq.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
            timeout=10,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Auth service unreachable")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json() or {}
    email = (data.get("email") or "").lower().strip()
    name = (data.get("name") or "").strip()
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

    parts = name.split(" ", 1) if name else [email.split("@")[0], ""]
    first_name = parts[0] or email.split("@")[0]
    last_name = parts[1] if len(parts) > 1 else ""

    user = await db.users.find_one({"email": email})
    is_new = False
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": email,
            "password_hash": "",  # No password for OAuth users
            "first_name": first_name,
            "last_name": last_name,
            "picture": picture,
            "auth_provider": "google",
            "role": "user",
            "workspace_id": user_id,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "plan": "FREE_TRIAL", "status": "ACTIVE",
            "trial_ends_at": (now_utc() + timedelta(days=14)).isoformat(),
            "created_at": now_utc().isoformat(),
        })
        is_new = True
    else:
        # Update with latest Google avatar; keep existing names if already set
        upd: Dict[str, Any] = {"auth_provider": user.get("auth_provider") or "google", "last_login": now_utc().isoformat()}
        if picture and not user.get("picture"):
            upd["picture"] = picture
        await db.users.update_one({"id": user["id"]}, {"$set": upd})

    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
    return {"user": serialize_user(user), "token": token, "is_new": is_new}


# ---------- SMS OTP authentication ----------
class SmsOtpSendIn(BaseModel):
    phone: str  # E.164 format e.g. +14155551234


class SmsOtpVerifyIn(BaseModel):
    phone: str
    otp: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


def _normalize_phone(p: str) -> str:
    p = (p or "").strip().replace(" ", "").replace("-", "")
    if not p:
        raise HTTPException(status_code=400, detail="Phone is required")
    if not p.startswith("+"):
        raise HTTPException(status_code=400, detail="Phone must be in E.164 format (e.g. +14155551234)")
    if len(p) < 8 or len(p) > 16 or not p[1:].isdigit():
        raise HTTPException(status_code=400, detail="Invalid phone number")
    return p


@api.post("/auth/sms/send-otp")
async def sms_send_otp(payload: SmsOtpSendIn, request: Request):
    phone = _normalize_phone(payload.phone)
    # Rate limit: max 3 OTPs per phone per hour
    one_hour_ago = (now_utc() - timedelta(hours=1)).isoformat()
    recent = await db.otp_codes.count_documents({"phone": phone, "created_at": {"$gte": one_hour_ago}})
    if recent >= 3:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again in an hour.")

    code = "".join(secrets.choice("0123456789") for _ in range(6))
    await db.otp_codes.insert_one({
        "id": str(uuid.uuid4()),
        "phone": phone,
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0,
        "verified": False,
        "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
        "created_at": now_utc().isoformat(),
    })

    # Send via Twilio (or fallback dev mode that returns OTP in response if SMS env not set)
    try:
        body = f"Your ZeroMark login code: {code}\n\nValid for 10 minutes. Do not share this code."
        ok = await asyncio.get_event_loop().run_in_executor(None, _send_sms_sync, phone, body)
        if not ok:
            raise RuntimeError("Twilio failed")
    except Exception:
        # Dev fallback: include OTP in response (only when Twilio is misconfigured)
        if os.environ.get("APP_ENV", "").lower() in ("dev", "development"):
            return {"sent": False, "dev_otp": code, "note": "Twilio not configured; dev OTP returned."}
        raise HTTPException(status_code=503, detail="Could not send SMS. Try email login or contact support.")

    return {"sent": True, "expires_in_minutes": 10}


@api.post("/auth/sms/verify-otp")
async def sms_verify_otp(payload: SmsOtpVerifyIn, response: Response):
    phone = _normalize_phone(payload.phone)
    otp = (payload.otp or "").strip()
    if len(otp) != 6 or not otp.isdigit():
        raise HTTPException(status_code=400, detail="OTP must be 6 digits")
    rec = await db.otp_codes.find_one({"phone": phone, "verified": False}, sort=[("created_at", -1)])
    if not rec:
        raise HTTPException(status_code=400, detail="No active OTP found. Request a new one.")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Request a new OTP.")

    if hashlib.sha256(otp.encode()).hexdigest() != rec["code_hash"]:
        await db.otp_codes.update_one({"id": rec["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=401, detail="Invalid OTP")

    await db.otp_codes.update_one({"id": rec["id"]}, {"$set": {"verified": True}})

    # Find or create user by phone
    user = await db.users.find_one({"phone": phone})
    is_new = False
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "phone": phone,
            "email": None,
            "password_hash": "",
            "first_name": (payload.first_name or "User").strip()[:50],
            "last_name": (payload.last_name or "").strip()[:50],
            "auth_provider": "sms",
            "role": "user",
            "workspace_id": user_id,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "plan": "FREE_TRIAL", "status": "ACTIVE",
            "trial_ends_at": (now_utc() + timedelta(days=14)).isoformat(),
            "created_at": now_utc().isoformat(),
        })
        is_new = True
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_utc().isoformat()}})

    token = create_access_token(user["id"], user.get("email") or f"phone:{phone}")
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=7 * 24 * 3600, path="/")
    return {"user": serialize_user(user), "token": token, "is_new": is_new}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": serialize_user(user)}


# ---------- Business Profile ----------
@api.get("/business")
async def get_business(user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0})
    return {"profile": profile}


@api.post("/business")
async def upsert_business(payload: BusinessProfileIn, user=Depends(get_current_user)):
    data = payload.model_dump()
    # Auto-derive currency from country if not explicitly set
    locale = _resolve_locale(data.get("country_code"), data.get("currency_code"))
    data["country_code"] = locale["country_code"]
    data["currency_code"] = locale["currency"]
    data["user_id"] = user["id"]
    data["updated_at"] = now_utc().isoformat()
    existing = await db.business_profiles.find_one({"user_id": ws(user)})
    if existing:
        await db.business_profiles.update_one({"user_id": ws(user)}, {"$set": data})
    else:
        data["id"] = str(uuid.uuid4())
        data["created_at"] = now_utc().isoformat()
        await db.business_profiles.insert_one(data)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0})
    return {"profile": profile, "locale": locale}


@api.get("/locale/countries")
async def list_countries():
    """Returns supported countries with currency info for UI dropdown."""
    items = [
        {"code": k, "name": v["name"], "currency": v["currency"], "symbol": v["symbol"], "locale": v["locale"]}
        for k, v in COUNTRY_CURRENCY.items()
    ]
    items.sort(key=lambda x: x["name"])
    return {"countries": items}


@api.get("/locale/me")
async def get_my_locale(user=Depends(get_current_user)):
    return {"locale": await _user_locale(user)}


# ---------- Leads ----------
@api.get("/leads")
async def list_leads(
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    source: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: Dict[str, Any] = {"user_id": ws(user)}
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
    doc["user_id"] = ws(user)
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
    # Auto-populate actual_value from estimated_value when transitioning to CONVERTED
    if update.get("status") == "CONVERTED" and "actual_value" not in update:
        existing = await db.leads.find_one({"id": lead_id, "user_id": ws(user)}, {"_id": 0})
        if existing and not existing.get("actual_value"):
            update["actual_value"] = float(existing.get("estimated_value") or 0)
            update["converted_at"] = update["updated_at"]
    res = await db.leads.update_one({"id": lead_id, "user_id": ws(user)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True}


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id, "user_id": ws(user)})
    return {"success": True}


@api.post("/leads/import")
async def import_leads(leads: List[LeadIn], user=Depends(get_current_user)):
    docs = []
    for lead in leads:
        d = lead.model_dump()
        d["id"] = str(uuid.uuid4())
        d["user_id"] = ws(user)
        d["created_at"] = now_utc().isoformat()
        docs.append(d)
    if docs:
        await db.leads.insert_many(docs)
    return {"success": True, "count": len(docs)}


# ---------- Campaigns ----------
@api.get("/campaigns")
async def list_campaigns(user=Depends(get_current_user)):
    cursor = db.campaigns.find({"user_id": ws(user)}, {"_id": 0}).sort("created_at", -1)
    campaigns = await cursor.to_list(500)
    return {"campaigns": campaigns}


@api.post("/campaigns")
async def create_campaign(payload: CampaignIn, user=Depends(get_current_user)):
    cid = str(uuid.uuid4())
    doc = payload.model_dump()
    doc["id"] = cid
    doc["user_id"] = ws(user)
    doc["status"] = "PENDING_APPROVAL"
    doc["created_at"] = now_utc().isoformat()
    doc["sent_count"] = 0
    doc["delivered_count"] = 0
    await db.campaigns.insert_one(doc)
    # Add to approval queue
    await db.approvals.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
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
    c = await db.campaigns.find_one({"id": cid, "user_id": ws(user)}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"campaign": c}


@api.delete("/campaigns/{cid}")
async def delete_campaign(cid: str, user=Depends(get_current_user)):
    await db.campaigns.delete_one({"id": cid, "user_id": ws(user)})
    await db.approvals.delete_many({"campaign_id": cid})
    return {"success": True}


@api.post("/campaigns/{cid}/send")
async def send_campaign(cid: str, background: BackgroundTasks, user=Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": cid, "user_id": ws(user)}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign["status"] not in ("APPROVED", "MODIFIED"):
        raise HTTPException(status_code=400, detail="Campaign not approved")
    # Mark as SENDING and dispatch background job
    await db.campaigns.update_one({"id": cid}, {"$set": {"status": "SENDING", "started_at": now_utc().isoformat()}})
    background.add_task(_run_campaign_send, cid, ws(user))
    return {"success": True, "queued": True, "message": "Campaign queued for delivery — refresh to see status."}


async def _run_campaign_send(cid: str, user_id: str):
    """Background job: deliver a campaign to all matching leads."""
    try:
        campaign = await db.campaigns.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if not campaign:
            return
        channel = campaign["channel"]
        content = campaign["content"]
        subject = campaign.get("subject") or campaign["name"]

        # Pull integration config (for WhatsApp/social via Twilio or stored token)
        integ = await db.integrations.find_one({"user_id": user_id}, {"_id": 0}) or {}

        leads = await db.leads.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
        sent = 0
        failed = 0
        for lead in leads:
            try:
                personal = _personalize(content, lead)
                ok = False
                if channel == "EMAIL" and lead.get("email"):
                    ok = await asyncio.get_event_loop().run_in_executor(
                        None, _send_email_sync, lead["email"], subject, personal
                    )
                elif channel == "SMS" and lead.get("phone"):
                    ok = await asyncio.get_event_loop().run_in_executor(
                        None, _send_sms_sync, lead["phone"], personal
                    )
                elif channel == "WHATSAPP" and lead.get("phone"):
                    ok = await asyncio.get_event_loop().run_in_executor(
                        None, _send_whatsapp_sync, lead["phone"], personal,
                        integ.get("whatsapp", {}).get("from_number"),
                    )
                else:
                    # FACEBOOK / INSTAGRAM / LINKEDIN — placeholder until OAuth flow is configured
                    if integ.get(channel.lower(), {}).get("connected"):
                        ok = True  # adapter would post here
                    else:
                        ok = False

                if ok:
                    sent += 1
                else:
                    failed += 1

                await db.communications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "campaign_id": cid,
                    "lead_id": lead["id"],
                    "channel": channel,
                    "direction": "OUTBOUND",
                    "content": personal[:500],
                    "status": "SENT" if ok else "FAILED",
                    "sent_at": now_utc().isoformat(),
                })
            except Exception as e:
                logger.exception("Send failure: %s", e)
                failed += 1

        await db.campaigns.update_one(
            {"id": cid},
            {"$set": {
                "status": "SENT" if sent > 0 else "FAILED",
                "sent_count": sent,
                "failed_count": failed,
                "sent_at": now_utc().isoformat(),
            }}
        )
        logger.info("Campaign %s: sent=%d failed=%d", cid, sent, failed)
    except Exception:
        logger.exception("Campaign send job crashed")
        await db.campaigns.update_one({"id": cid}, {"$set": {"status": "FAILED"}})


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


def _send_whatsapp_sync(to: str, body: str, from_number: Optional[str] = None) -> bool:
    """Send WhatsApp via Twilio. Requires recipient to have opted into the
    Twilio Sandbox or a registered WA Business number."""
    try:
        twilio = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
        wa_from = from_number or os.environ.get("TWILIO_WHATSAPP_FROM", "+14155238886")  # Twilio sandbox
        twilio.messages.create(
            from_=f"whatsapp:{wa_from}",
            to=f"whatsapp:{to}",
            body=body,
        )
        return True
    except Exception as e:
        logger.error("WhatsApp send failed: %s", e)
        return False


# ---------- AI Generate ----------
@api.post("/ai/generate-content")
async def ai_generate_content(payload: AIGenerateIn, user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0})
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

    try:
        content = await asyncio.get_event_loop().run_in_executor(
            None, _groq_chat, prompt,
            "You are an expert marketing copywriter. Write compelling, concise content that drives conversions.",
            False, 800, 0.8,
        )
    except HTTPException:
        raise
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
    cursor = db.approvals.find({"user_id": ws(user), "status": "PENDING"}, {"_id": 0}).sort("created_at", -1)
    approvals = await cursor.to_list(200)
    # Attach campaign info
    for a in approvals:
        c = await db.campaigns.find_one({"id": a.get("campaign_id")}, {"_id": 0})
        a["campaign"] = c
    return {"approvals": approvals}


@api.post("/approvals/{aid}/approve")
async def approve(aid: str, payload: ApprovalActionIn, user=Depends(get_current_user)):
    a = await db.approvals.find_one({"id": aid, "user_id": ws(user)})
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
    a = await db.approvals.find_one({"id": aid, "user_id": ws(user)})
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
    a = await db.approvals.find_one({"id": aid, "user_id": ws(user)})
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
    reports = await db.reports.find({"user_id": ws(user)}, {"_id": 0}).sort("generated_at", -1).to_list(50)
    return {"reports": reports}


# ---------- Marketing performance metrics (traffic / impressions / clicks / conversions) ----------
# Per-platform synthetic baselines (industry medians; used when real OAuth analytics
# aren't connected). When the user connects a real account, replace with the real API.
_PLATFORM_METRICS = {
    "linkedin":        {"impressions_per_post": 2000, "ctr": 0.040, "conv_rate": 0.080},
    "twitter":         {"impressions_per_post": 3000, "ctr": 0.015, "conv_rate": 0.030},
    "instagram":       {"impressions_per_post": 2500, "ctr": 0.020, "conv_rate": 0.050},
    "blog":            {"impressions_per_post":  500, "ctr": 0.080, "conv_rate": 0.120},
    "email_broadcast": {"impressions_per_post":  200, "ctr": 0.250, "conv_rate": 0.030},
}


@api.get("/reports/marketing-metrics")
async def reports_marketing_metrics(days: int = 30, user=Depends(get_current_user)):
    """Funnel metrics for content scheduled+published in a +/- N day window centered on now.
    Computes per-platform impressions/clicks/conversions and returns a daily
    time-series for charting. Real lead counts replace synthetic conversions
    where leads.created_at falls inside the period."""
    days = max(1, min(days, 90))
    period_start = now_utc() - timedelta(days=days)
    period_end = now_utc() + timedelta(days=days)
    period_iso = period_start.isoformat()
    period_end_iso = period_end.isoformat()

    # Pull all scheduled+published items for the workspace in window
    # (window spans both past N days AND next N days so that forward-scheduled
    # content shows different totals at each Period selection)
    schedules = await db.content_schedules.find({
        "user_id": ws(user),
        "scheduled_at": {"$gte": period_iso, "$lte": period_end_iso},
    }, {"_id": 0}).to_list(2000)

    per_platform: Dict[str, Dict[str, float]] = {p: {
        "scheduled_posts": 0,
        "published_posts": 0,
        "impressions": 0.0,
        "clicks": 0.0,
        "conversions": 0.0,
    } for p in _PLATFORM_METRICS.keys()}

    daily: Dict[str, Dict[str, float]] = {}

    for s in schedules:
        sched_iso = s.get("scheduled_at") or ""
        day_key = sched_iso[:10] or now_utc().date().isoformat()
        d = daily.setdefault(day_key, {"impressions": 0.0, "clicks": 0.0, "conversions": 0.0, "posts": 0})
        platforms = s.get("platforms") or []
        delivery = s.get("delivery") or {}
        for p in platforms:
            if p not in per_platform:
                continue
            base = _PLATFORM_METRICS[p]
            per_platform[p]["scheduled_posts"] += 1
            d["posts"] += 1
            # Only published items contribute to actual reach metrics
            published = (delivery.get(p) or {}).get("status") in ("published", "mock_published")
            # If published, full reach. If pending, count as 50% projected (so the user
            # can SEE forward-looking projections). Per kit, add the per-post baseline.
            scale = 1.0 if published else 0.5
            imp = base["impressions_per_post"] * scale
            clk = imp * base["ctr"]
            cnv = clk * base["conv_rate"]
            per_platform[p]["impressions"] += imp
            per_platform[p]["clicks"] += clk
            per_platform[p]["conversions"] += cnv
            if published:
                per_platform[p]["published_posts"] += 1
            d["impressions"] += imp
            d["clicks"] += clk
            d["conversions"] += cnv

    # Real leads in period — use as floor for conversions
    real_leads_in_period = await db.leads.count_documents({
        "user_id": ws(user),
        "created_at": {"$gte": period_iso},
    })
    converted_in_period = await db.leads.count_documents({
        "user_id": ws(user),
        "status": "CONVERTED",
        "created_at": {"$gte": period_iso},
    })

    # Round and aggregate totals
    for p, m in per_platform.items():
        m["impressions"] = int(m["impressions"])
        m["clicks"] = int(m["clicks"])
        m["conversions"] = int(m["conversions"])

    total_impr = sum(m["impressions"] for m in per_platform.values())
    total_clk = sum(m["clicks"] for m in per_platform.values())
    total_cnv = sum(m["conversions"] for m in per_platform.values())
    total_scheduled = sum(m["scheduled_posts"] for m in per_platform.values())
    total_published = sum(m["published_posts"] for m in per_platform.values())

    # If real leads exceed synthetic conversions, surface the real number too
    timeseries = []
    for k in sorted(daily.keys()):
        d = daily[k]
        timeseries.append({
            "date": k,
            "impressions": int(d["impressions"]),
            "clicks": int(d["clicks"]),
            "conversions": int(d["conversions"]),
            "posts": int(d["posts"]),
        })

    return {
        "period_days": days,
        "totals": {
            "impressions": total_impr,
            "clicks": total_clk,
            "conversions": total_cnv,
            "scheduled_posts": total_scheduled,
            "published_posts": total_published,
            "real_leads_in_period": real_leads_in_period,
            "converted_in_period": converted_in_period,
            "ctr_pct": round((total_clk / total_impr * 100), 2) if total_impr else 0,
            "conv_rate_pct": round((total_cnv / total_clk * 100), 2) if total_clk else 0,
        },
        "by_platform": [
            {"platform": p, **m} for p, m in per_platform.items()
        ],
        "timeseries": timeseries,
        "is_synthetic": True,
        "synthetic_note": (
            "Estimated from scheduled posts × industry-median per-platform reach. "
            "Connect real OAuth tokens in Integrations to switch to live analytics."
        ),
    }


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
        "user_id": ws(user),
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
        return _groq_chat(prompt, "You are a data generator. Output strict JSON only with no markdown.", True, 1500, 0.7)

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
    jobs = await db.scraping_jobs.find({"user_id": ws(user)}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
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
    sub = await db.subscriptions.find_one({"user_id": ws(user)}, {"_id": 0})
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
        "notes": {"user_id": ws(user), "plan_id": payload.plan_id},
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
        {"user_id": ws(user)},
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
        "user_id": ws(user),
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


# ---------- AI Lead Scoring & Prediction ----------
class ScoreLeadIn(BaseModel):
    lead_ids: Optional[List[str]] = None  # None = score all leads


def _score_leads_sync(business_ctx: str, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Use Groq to score & rank leads against business profile."""
    if not leads:
        return []
    payload = [{
        "id": l["id"],
        "name": l.get("name", ""),
        "company": l.get("company", ""),
        "email": l.get("email", ""),
        "notes": l.get("notes", ""),
        "source": l.get("source", ""),
    } for l in leads]
    prompt = (
        f"You are a B2B lead-scoring engine.\n"
        f"BUSINESS CONTEXT:\n{business_ctx or 'Not specified'}\n\n"
        f"Score each of the following leads from 0-100 based on how well they fit the ICP. "
        f"Higher = more likely to convert. Return ONLY a JSON object with key 'scores' which is "
        f"an array of {{id, score, reason, status_recommendation}} where status_recommendation is "
        f"one of NEW/CONTACTED/INTERESTED/CONVERTED/NOT_INTERESTED based on fit. "
        f"reason must be ≤140 chars, plain English.\n\n"
        f"LEADS: {payload}"
    )
    raw = _groq_chat(prompt, "You are a precise B2B sales analyst. Output strict JSON only.", True, 2000, 0.3)
    import json
    try:
        data = json.loads(raw)
        return data.get("scores", [])
    except Exception:
        return []


@api.post("/leads/score-batch")
async def score_leads_batch(payload: ScoreLeadIn, user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0})
    business_ctx = ""
    if profile:
        business_ctx = (
            f"Business: {profile.get('business_name', '')}\n"
            f"Industry: {profile.get('industry', '')}\n"
            f"Target Audience: {profile.get('target_audience', '')}\n"
            f"Description: {profile.get('description', '')}\n"
        )
    q: Dict[str, Any] = {"user_id": ws(user)}
    if payload.lead_ids:
        q["id"] = {"$in": payload.lead_ids}
    leads = await db.leads.find(q, {"_id": 0}).limit(50).to_list(50)
    if not leads:
        return {"scored": 0, "results": []}
    scores = await asyncio.get_event_loop().run_in_executor(None, _score_leads_sync, business_ctx, leads)

    # Apply updates
    for s in scores:
        try:
            await db.leads.update_one(
                {"id": s["id"], "user_id": ws(user)},
                {"$set": {
                    "score": int(s.get("score", 0)),
                    "score_reason": s.get("reason", ""),
                    "scored_at": now_utc().isoformat(),
                }},
            )
        except Exception:
            continue
    return {"scored": len(scores), "results": scores}


# ---------- Lead Detail / Mini-CRM ----------
@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id, "user_id": ws(user)}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    comms = await db.communications.find(
        {"lead_id": lead_id, "user_id": ws(user)},
        {"_id": 0},
    ).sort("sent_at", -1).limit(50).to_list(50)
    return {"lead": lead, "communications": comms}


class CommIn(BaseModel):
    channel: str
    direction: str = "INBOUND"  # INBOUND | OUTBOUND
    content: str


@api.post("/leads/{lead_id}/communications")
async def log_communication(lead_id: str, payload: CommIn, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id, "user_id": ws(user)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    comm = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "lead_id": lead_id,
        "channel": payload.channel,
        "direction": payload.direction,
        "content": payload.content,
        "status": "LOGGED",
        "sent_at": now_utc().isoformat(),
    }
    await db.communications.insert_one(comm)
    comm.pop("_id", None)
    return {"communication": comm}


class AIReplyIn(BaseModel):
    inbound_message: str
    channel: str = "EMAIL"
    tone: str = "professional"


@api.post("/leads/{lead_id}/ai-reply")
async def ai_draft_reply(lead_id: str, payload: AIReplyIn, user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id, "user_id": ws(user)}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}

    prompt = (
        f"You are an SDR replying to an inbound message from a lead.\n"
        f"BUSINESS: {profile.get('business_name', '')} — {profile.get('description', '')}\n"
        f"LEAD: {lead.get('name')} at {lead.get('company') or 'unknown company'}\n"
        f"CHANNEL: {payload.channel}\n"
        f"TONE: {payload.tone}\n"
        f"INBOUND MESSAGE: \"{payload.inbound_message}\"\n\n"
        f"Draft a {payload.channel.lower()} reply that addresses their question, advances the deal "
        f"and ends with a clear next step. Keep it short (≤120 words for email, ≤30 words for SMS/WhatsApp). "
        f"Return ONLY the message body, no commentary."
    )

    def _gen():
        return _groq_chat(prompt, "You are a senior B2B sales copywriter.", False, 400, 0.6)

    reply = await asyncio.get_event_loop().run_in_executor(None, _gen)
    return {"reply": reply.strip()}


# ---------- Channel Integrations ----------
class IntegrationIn(BaseModel):
    channel: str  # whatsapp | facebook | instagram | linkedin | twitter
    config: Dict[str, Any]
    connected: bool = True


@api.get("/integrations")
async def list_integrations(user=Depends(get_current_user)):
    integ = await db.integrations.find_one({"user_id": ws(user)}, {"_id": 0}) or {"user_id": ws(user)}
    # Strip secrets from response
    safe = {"user_id": integ.get("user_id")}
    for k, v in integ.items():
        if isinstance(v, dict):
            safe[k] = {"connected": v.get("connected", False), "label": v.get("label", "")}
    return {"integrations": safe}


@api.post("/integrations")
async def upsert_integration(payload: IntegrationIn, user=Depends(get_current_user)):
    field = payload.channel.lower()
    # Encrypt sensitive fields at rest
    cfg = {}
    for k, v in payload.config.items():
        if isinstance(v, str) and k in SENSITIVE_INTEGRATION_KEYS:
            cfg[k] = _enc(v)
            cfg[f"{k}__encrypted"] = True
        else:
            cfg[k] = v
    cfg["connected"] = payload.connected
    cfg["updated_at"] = now_utc().isoformat()
    update = {field: cfg}
    await db.integrations.update_one(
        {"user_id": ws(user)},
        {"$set": update, "$setOnInsert": {"user_id": ws(user)}},
        upsert=True,
    )
    return {"success": True, "channel": field}


@api.delete("/integrations/{channel}")
async def disconnect_integration(channel: str, user=Depends(get_current_user)):
    await db.integrations.update_one(
        {"user_id": ws(user)},
        {"$unset": {channel.lower(): ""}},
    )
    return {"success": True}


# ---------- Daily AI Growth Briefing ----------
@api.post("/briefing/generate")
async def generate_briefing(user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    uid = ws(user)
    profile = await db.business_profiles.find_one({"user_id": uid}, {"_id": 0}) or {}

    # Pull last 7 days metrics
    period_start = now_utc() - timedelta(days=7)
    new_leads = await db.leads.count_documents({"user_id": uid, "created_at": {"$gte": period_start.isoformat()}})
    total_leads = await db.leads.count_documents({"user_id": uid})
    sent_campaigns = await db.campaigns.count_documents({"user_id": uid, "status": "SENT", "sent_at": {"$gte": period_start.isoformat()}})
    pending = await db.approvals.count_documents({"user_id": uid, "status": "PENDING"})
    converted = await db.leads.count_documents({"user_id": uid, "status": "CONVERTED"})
    interested = await db.leads.count_documents({"user_id": uid, "status": "INTERESTED"})

    metrics_text = (
        f"Last 7 days: {new_leads} new leads, {sent_campaigns} campaigns sent, "
        f"{pending} pending approvals. All-time: {total_leads} leads, "
        f"{interested} interested, {converted} converted."
    )

    prompt = (
        f"You write a brief, punchy daily growth briefing for the founder.\n"
        f"BUSINESS: {profile.get('business_name','Unknown')} — {profile.get('industry','')}\n"
        f"TARGET: {profile.get('target_audience','')}\n"
        f"METRICS: {metrics_text}\n\n"
        f"Write a JSON object with keys: "
        f"'headline' (one bold sentence), "
        f"'wins' (array of 1-3 short wins), "
        f"'risks' (array of 1-3 risks/issues to watch), "
        f"'actions' (array of 3 concrete actions to take TODAY in priority order). "
        f"Output STRICT JSON only."
    )

    def _gen():
        return _groq_chat(prompt, "You are a no-nonsense growth advisor. Output strict JSON.", True, 800, 0.5)

    raw = await asyncio.get_event_loop().run_in_executor(None, _gen)
    import json
    try:
        briefing = json.loads(raw)
    except Exception:
        briefing = {"headline": "Briefing unavailable", "wins": [], "risks": [], "actions": []}

    record = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "briefing": briefing,
        "metrics": {
            "new_leads_7d": new_leads,
            "sent_campaigns_7d": sent_campaigns,
            "pending_approvals": pending,
            "total_leads": total_leads,
            "interested": interested,
            "converted": converted,
        },
        "generated_at": now_utc().isoformat(),
    }
    await db.briefings.insert_one(record)
    record.pop("_id", None)
    return {"briefing": record}


@api.get("/briefing/latest")
async def latest_briefing(user=Depends(get_current_user)):
    rec = await db.briefings.find_one(
        {"user_id": ws(user)}, {"_id": 0}, sort=[("generated_at", -1)]
    )
    return {"briefing": rec}


# ---------- Business profile auto-fill from website URL ----------
class AutoFillIn(BaseModel):
    website_url: str


@api.post("/business/auto-fill")
async def auto_fill_business(payload: AutoFillIn, user=Depends(get_current_user)):
    """Scrape a website's homepage and use Groq to extract structured business profile."""
    url = payload.website_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    if not _is_safe_url(url):
        raise HTTPException(status_code=400, detail="URL not allowed (private/internal addresses blocked)")

    def _fetch():
        try:
            r = _http.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 ZeroMarkBot"}, allow_redirects=True)
            return r.text[:30000]
        except Exception as e:
            return f"FETCH_ERROR: {e}"

    html = await asyncio.get_event_loop().run_in_executor(None, _fetch)
    if html.startswith("FETCH_ERROR"):
        raise HTTPException(status_code=400, detail=f"Could not fetch website. {html[:200]}")

    # Strip basic HTML tags for prompt
    import re
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()[:8000]

    prompt = (
        f"Analyse the following website content and extract a structured business profile.\n\n"
        f"URL: {url}\nCONTENT: {text}\n\n"
        f"Return STRICT JSON with keys: business_name, industry, location, target_audience, "
        f"description (2-3 sentences), value_proposition (1 sentence), key_offerings (array of 3-5 strings), "
        f"competitors (array of likely competitor names from same niche)."
    )

    def _gen():
        return _groq_chat(prompt, "You are a B2B research analyst. Output strict JSON only.", True, 1200, 0.3)

    raw = await asyncio.get_event_loop().run_in_executor(None, _gen)
    import json
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="AI parsing failed")
    data["website_url"] = url
    return {"profile": data}


# ---------- Growth Studio: Market Analysis ----------
class MarketAnalysisIn(BaseModel):
    website_url: Optional[str] = None
    additional_context: Optional[str] = None


@api.post("/market/analyze")
async def market_analyze(payload: MarketAnalysisIn, user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    url = payload.website_url or profile.get("website_url") or ""

    biz_ctx = (
        f"Business: {profile.get('business_name', 'Unknown')}\n"
        f"Industry: {profile.get('industry', '')}\n"
        f"Country: {COUNTRY_CURRENCY.get((profile.get('country_code') or 'US').upper(), {}).get('name', 'United States')} ({(profile.get('country_code') or 'US').upper()})\n"
        f"Currency: {(profile.get('currency_code') or 'USD').upper()}\n"
        f"Target audience: {profile.get('target_audience', '')}\n"
        f"Description: {profile.get('description', '')}\n"
        f"Website: {url}\n"
        f"Extra context: {payload.additional_context or ''}\n"
    )

    prompt = (
        f"You are a senior B2B market strategist with deep knowledge of the LOCAL market in the country listed in BUSINESS. "
        f"All money amounts MUST be in the user's currency ({(profile.get('currency_code') or 'USD').upper()}). "
        f"Competitors MUST be relevant to the country listed (local players + relevant global players present there). "
        f"Analyse this business and produce a comprehensive market analysis as STRICT JSON with these keys:\n"
        f"  market_size (1-2 sentences with rough TAM/SAM/SOM in the user's currency if inferable),\n"
        f"  growth_rate (1 sentence),\n"
        f"  trends (array of 4-6 short-term trends specific to this country/region),\n"
        f"  competitors (array of objects {{name, strengths, weaknesses, positioning}}, 4-6 items — prioritise local players in the country),\n"
        f"  swot (object with arrays strengths, weaknesses, opportunities, threats — 3 each),\n"
        f"  positioning_recommendation (2-3 sentences),\n"
        f"  unique_angles (array of 3-5 differentiator ideas),\n"
        f"  immediate_actions (array of 5 concrete steps with priority high/med/low).\n\n"
        f"BUSINESS:\n{biz_ctx}"
    )

    def _gen():
        return _groq_chat(prompt, "You are a strategic consultant. Output strict JSON only.", True, 2500, 0.5)

    raw = await asyncio.get_event_loop().run_in_executor(None, _gen)
    import json
    try:
        analysis = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="AI parsing failed")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "type": "MARKET",
        "data": analysis,
        "generated_at": now_utc().isoformat(),
    }
    await db.market_analyses.insert_one(record)
    record.pop("_id", None)
    return {"analysis": record}


@api.get("/market/latest")
async def market_latest(user=Depends(get_current_user)):
    rec = await db.market_analyses.find_one(
        {"user_id": ws(user)}, {"_id": 0}, sort=[("generated_at", -1)]
    )
    return {"analysis": rec}


# ---------- Growth Studio: SEO Toolkit ----------
class SEORequestIn(BaseModel):
    seed_keyword: Optional[str] = None
    competitor_url: Optional[str] = None


@api.post("/seo/keywords")
async def seo_keywords(payload: SEORequestIn, user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    seed = payload.seed_keyword or profile.get("industry", "")
    audience = profile.get("target_audience", "")

    # Try real SEO API first
    real = await _real_keyword_data(seed)
    if real:
        return {"keywords": real, "source": real[0].get("_source", "real")}

    # Fallback to AI
    prompt = (
        f"Act as an SEO research analyst. For the seed keyword '{seed}' targeting '{audience}', "
        f"produce STRICT JSON with key 'keywords' = array of 25 objects with fields: "
        f"keyword (string), intent (informational/commercial/transactional/navigational), "
        f"difficulty (1-100 estimate), volume_band (low/mid/high), opportunity_score (1-100), "
        f"category (short tag e.g. how-to, comparison, brand). "
        f"Mix branded, long-tail, and competitor-comparison keywords."
    )
    return {"keywords": await _groq_json(prompt, key="keywords", max_tokens=2500), "source": "ai"}


@api.post("/seo/backlinks")
async def seo_backlinks(payload: SEORequestIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    industry = profile.get("industry", "")
    site = payload.competitor_url or profile.get("website_url", "") or industry

    prompt = (
        f"Act as a link-building analyst. For a business in '{industry}' (website: {site}), "
        f"produce STRICT JSON with key 'opportunities' = array of 15 objects: "
        f"{{name (publication or site name), url (plausible URL), domain_authority (30-90 estimate), "
        f"type (guest_post/listicle/podcast/directory/digital_pr/resource_page), "
        f"angle (1-sentence pitch angle for outreach), "
        f"effort (low/med/high), priority (high/med/low)}}. "
        f"Include realistic mid-tier publications, niche directories, podcasts and resource pages. "
        f"Mix easy wins with high-DA aspirational targets."
    )
    return {"opportunities": await _groq_json(prompt, key="opportunities", max_tokens=2500)}


@api.post("/seo/content-gaps")
async def seo_content_gaps(payload: SEORequestIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    biz = profile.get("business_name", "") + " — " + profile.get("description", "")

    prompt = (
        f"Act as a content strategist. For: {biz} ({profile.get('industry', '')}), "
        f"audience: {profile.get('target_audience', '')}. "
        f"Produce STRICT JSON with key 'content_ideas' = array of 12 objects: "
        f"{{title (compelling H1), format (blog/listicle/case-study/whitepaper/video/comparison), "
        f"funnel_stage (TOFU/MOFU/BOFU), target_keyword, word_count_estimate (number), "
        f"content_outline (array of 4-6 H2 section titles), why_now (1-sentence rationale)}}. "
        f"Mix funnel stages and prioritise topics with high commercial intent."
    )
    return {"content_ideas": await _groq_json(prompt, key="content_ideas", max_tokens=3000)}


# ---------- Growth Studio: PR & Media Outreach ----------
class PressReleaseIn(BaseModel):
    announcement: str
    quote_from: Optional[str] = None


@api.post("/pr/press-release")
async def pr_press_release(payload: PressReleaseIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    spokesperson = payload.quote_from or f"{user['first_name']} {user['last_name']}, founder of {profile.get('business_name','')}"
    prompt = (
        f"Write a polished press release in AP style for: {profile.get('business_name','')}.\n"
        f"INDUSTRY: {profile.get('industry','')}\n"
        f"DESCRIPTION: {profile.get('description','')}\n"
        f"ANNOUNCEMENT: {payload.announcement}\n"
        f"SPOKESPERSON: {spokesperson}\n\n"
        f"Return STRICT JSON: {{headline, subhead, dateline, body (well-formatted with paragraphs separated by \\n\\n), "
        f"quote, boilerplate (about-us paragraph), media_contact (name and email placeholder)}}."
    )
    return {"press_release": await _groq_json(prompt, max_tokens=2000)}


@api.post("/pr/media-list")
async def pr_media_list(payload: SEORequestIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    industry = profile.get("industry", "")
    location = profile.get("location", "")
    prompt = (
        f"Generate a targeted media outreach list for a {industry} company in {location}. "
        f"STRICT JSON with key 'outlets' = array of 12 objects: "
        f"{{publication, beat, contact_name (plausible journalist), email_pattern (e.g. firstname.lastname@publication.com), "
        f"reach (S/M/L), angle (why_relevant in 1 sentence), social_handle}}. "
        f"Include trade press, mainstream business outlets, and niche industry publications."
    )
    return {"outlets": await _groq_json(prompt, key="outlets", max_tokens=2200)}


class OutreachIn(BaseModel):
    journalist_name: str
    publication: str
    angle: str
    announcement: str


@api.post("/pr/outreach-email")
async def pr_outreach_email(payload: OutreachIn, user=Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    prompt = (
        f"Draft a personalised media pitch email.\n"
        f"FROM: {user['first_name']} {user['last_name']}, {profile.get('business_name','')} ({profile.get('industry','')})\n"
        f"TO: {payload.journalist_name} at {payload.publication}\n"
        f"ANGLE: {payload.angle}\n"
        f"ANNOUNCEMENT: {payload.announcement}\n\n"
        f"Constraints: under 150 words, conversational, references their beat, opens with a hook, "
        f"ends with a single clear ask. Return STRICT JSON: {{subject, body}}."
    )
    return {"email": await _groq_json(prompt, max_tokens=600)}


# ---------- Growth Studio: 12-Month Growth Plan ----------
@api.post("/growth-plan/generate")
async def growth_plan_generate(user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    total_leads = await db.leads.count_documents({"user_id": ws(user)})
    total_campaigns = await db.campaigns.count_documents({"user_id": ws(user)})

    cc = (profile.get('country_code') or 'US').upper()
    cur = (profile.get('currency_code') or 'USD').upper()
    country_name = COUNTRY_CURRENCY.get(cc, {}).get("name", "United States")

    biz_ctx = (
        f"Business: {profile.get('business_name','')} | Industry: {profile.get('industry','')}\n"
        f"Country: {country_name} ({cc}) | Currency: {cur}\n"
        f"Target: {profile.get('target_audience','')} | Location: {profile.get('location','')}\n"
        f"Description: {profile.get('description','')}\n"
        f"Current state: {total_leads} leads, {total_campaigns} campaigns shipped."
    )

    prompt = (
        f"You are a growth strategist for the {country_name} market. "
        f"Build a comprehensive 12-MONTH GROWTH PLAN. ALL money values MUST be in {cur} (the user's local currency). "
        f"Channel benchmarks (CPL, monthly budget) MUST reflect real {country_name} market rates — not US averages. "
        f"Return STRICT JSON with the following keys:\n"
        f"  vision (1-2 sentences),\n"
        f"  north_star_metric (single metric we should obsess over),\n"
        f"  monthly_lead_target (integer — realistic given budget),\n"
        f"  monthly_budget_usd (integer in {cur} — keep field name 'monthly_budget_usd' for compatibility but value is in {cur}),\n"
        f"  avg_deal_value_usd (integer in {cur} — estimated based on {country_name} industry rates; field name kept as '_usd' for backward-compat),\n"
        f"  channel_distribution (array of 6-9 channel objects, MUST include both PAID and ORGANIC types; "
        f"     each: {{name (channels available in {country_name}: e.g. 'Google Ads', 'Meta Ads', 'LinkedIn', 'SEO', 'Cold Email', "
        f"     'Local SEO', plus {country_name}-specific options like {('Naver, KakaoTalk' if cc == 'KR' else 'Baidu, WeChat' if cc == 'CN' else 'Yandex, VK' if cc == 'RU' else 'Yahoo Japan, LINE' if cc == 'JP' else 'JustDial, ShareChat, Moj' if cc == 'IN' else 'Mercado Libre Ads' if cc in ('BR','MX','AR','CL','CO') else 'Local directories')}), "
        f"     type ('paid'|'organic'), monthly_budget_usd (integer in {cur}), expected_leads_per_month (integer), "
        f"     expected_cpl_usd (integer cost-per-lead in {cur} based on {country_name} rates), "
        f"     priority ('high'|'medium'|'low'), rationale (1 sentence)}}),\n"
        f"  quarterly_themes (array of 4 quarter objects: {{quarter (Q1..Q4), theme, primary_goal, "
        f"     key_targets (array of 3 measurable targets), top_3_initiatives, channels (array), "
        f"     estimated_budget_band (low/mid/high), risks (array of 2)}}),\n"
        f"  monthly_milestones (array of 12 strings — one per month),\n"
        f"  hiring_plan (array of 3-5 roles in chronological order with month),\n"
        f"  marketing_mix (object with email %, sms %, whatsapp %, seo %, social %, pr %, paid_ads % — must sum to 100),\n"
        f"  key_assumptions (array of 4-6 strings),\n"
        f"  success_kpis (array of 5 specific numerical targets to hit by month 12).\n\n"
        f"BUSINESS:\n{biz_ctx}"
    )

    plan = await _groq_json(prompt, max_tokens=4000)
    record = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "plan": plan,
        "generated_at": now_utc().isoformat(),
    }
    await db.growth_plans.insert_one(record)
    record.pop("_id", None)
    return {"plan": record}


@api.get("/growth-plan/latest")
async def growth_plan_latest(user=Depends(get_current_user)):
    rec = await db.growth_plans.find_one({"user_id": ws(user)}, {"_id": 0}, sort=[("generated_at", -1)])
    return {"plan": rec}


# ---------- Quick Plan: budget-driven, guaranteed leads (50% buffer) ----------
class QuickPlanIn(BaseModel):
    monthly_budget: float
    duration_months: int = 12  # 3 | 6 | 9 | 12
    avg_deal_value: Optional[float] = None
    goal: Optional[str] = None  # free-text user objective


@api.post("/quick-plan/generate")
async def quick_plan_generate(payload: QuickPlanIn, user=Depends(get_current_user)):
    """Simplified flow: user enters budget + duration. AI builds optimal channel mix
    for THIS exact budget; we apply a 50% conservative buffer to the predicted leads
    and present them as a guarantee. Persists as both a growth_plan and a lead_target."""
    if payload.monthly_budget <= 0:
        raise HTTPException(status_code=400, detail="Monthly budget must be greater than 0")
    if payload.duration_months not in (3, 6, 9, 12):
        raise HTTPException(status_code=400, detail="Duration must be 3, 6, 9, or 12 months")
    await check_ai_rate_limit(user)

    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    cc = (profile.get("country_code") or "US").upper()
    cur = (profile.get("currency_code") or "USD").upper()
    country_name = COUNTRY_CURRENCY.get(cc, {}).get("name", "United States")

    biz_ctx = (
        f"Business: {profile.get('business_name','(not set)')}\n"
        f"Industry: {profile.get('industry','(not set)')}\n"
        f"Target audience: {profile.get('target_audience','(not set)')}\n"
        f"Description: {profile.get('description','')}\n"
        f"Country: {country_name} ({cc}) | Currency: {cur}\n"
        f"User goal (optional): {payload.goal or 'maximise leads for the budget'}\n"
        f"MONTHLY BUDGET (hard cap): {cur} {int(payload.monthly_budget)}\n"
        f"Duration: {payload.duration_months} months"
    )

    prompt = (
        f"You are a senior growth marketer for the {country_name} market. The user has ONE constraint: "
        f"a monthly marketing budget of {cur} {int(payload.monthly_budget)}. "
        f"Build the OPTIMAL channel mix for THIS exact budget — do NOT exceed it. Use REAL {country_name} CPL benchmarks.\n\n"
        f"Output STRICT JSON (no preamble, no markdown wrapping) with these EXACT keys:\n"
        f"  channels: array of 3-6 channels — each {{name, type ('paid'|'organic'), "
        f"     monthly_budget_usd (integer in {cur}, all channels combined MUST sum to <= {int(payload.monthly_budget)}), "
        f"     expected_leads_per_month (integer based on real {country_name} CPL), "
        f"     expected_cpl_usd (integer in {cur}), priority ('high'|'medium'|'low'), "
        f"     rationale (1 sentence — why this channel for this budget)}}.\n"
        f"  optimal_split: {{paid_pct (0-100), organic_pct (0-100, paid+organic=100)}}.\n"
        f"  raw_predicted_leads_per_month: integer — total expected leads/month (sum of channel leads).\n"
        f"  ai_rationale: 2 sentences explaining the strategy.\n"
        f"  recommended_first_action: 1 sentence — the very first thing to do this week.\n\n"
        f"BUSINESS CONTEXT:\n{biz_ctx}"
    )

    try:
        ai = await _groq_json(prompt, max_tokens=1800)
    except Exception as e:
        logger.error("Quick plan AI failed: %s", e)
        raise HTTPException(status_code=502, detail="AI is busy — please try again in a moment")

    channels = ai.get("channels") or []
    raw_predicted = int(ai.get("raw_predicted_leads_per_month") or 0)
    if raw_predicted <= 0:
        # Fallback: sum from channels
        raw_predicted = sum(int(c.get("expected_leads_per_month") or 0) for c in channels)
    raw_predicted = max(raw_predicted, 1)

    # 50% conservative buffer (we promise less than predicted, so we can over-deliver)
    guaranteed_per_month = max(1, int(raw_predicted * 0.5))
    total_guaranteed = guaranteed_per_month * payload.duration_months

    avg_deal = float(payload.avg_deal_value) if payload.avg_deal_value else 100.0
    revenue_target = guaranteed_per_month * avg_deal

    plan_doc = {
        "vision": f"Maximise leads within a {cur} {int(payload.monthly_budget)}/mo budget over {payload.duration_months} months.",
        "north_star_metric": f"{guaranteed_per_month} guaranteed leads / month",
        "monthly_lead_target": guaranteed_per_month,
        "monthly_budget_usd": int(payload.monthly_budget),
        "avg_deal_value_usd": int(avg_deal),
        "duration_months": payload.duration_months,
        "channel_distribution": channels,
        "optimal_split": ai.get("optimal_split") or {},
        "ai_rationale": ai.get("ai_rationale") or "",
        "recommended_first_action": ai.get("recommended_first_action") or "",
        "raw_predicted_leads_per_month": raw_predicted,
        "guaranteed_leads_per_month": guaranteed_per_month,
        "total_guaranteed_leads": total_guaranteed,
        "buffer_pct": 50,
    }
    record = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "plan": plan_doc,
        "source": "quick_plan",
        "generated_at": now_utc().isoformat(),
    }
    await db.growth_plans.insert_one(record)
    record.pop("_id", None)

    # Upsert lead target with the conservative guarantee
    await db.lead_targets.update_one(
        {"user_id": ws(user)},
        {"$set": {
            "user_id": ws(user),
            "monthly_lead_target": guaranteed_per_month,
            "avg_deal_value_usd": avg_deal,
            "revenue_target_usd": revenue_target,
            "duration_months": payload.duration_months,
            "guarantee_enabled": True,
            "guarantee_terms": (
                f"Guaranteed {guaranteed_per_month} qualified leads/month for "
                f"{payload.duration_months} months ({total_guaranteed} total) "
                f"within a {cur} {int(payload.monthly_budget)}/month budget."
            ),
            "updated_at": now_utc().isoformat(),
        }},
        upsert=True,
    )

    return {
        "plan": record,
        "guarantee": {
            "monthly_leads": guaranteed_per_month,
            "total_leads": total_guaranteed,
            "duration_months": payload.duration_months,
            "monthly_budget": int(payload.monthly_budget),
            "currency": cur,
            "buffer_pct": 50,
            "raw_predicted_per_month": raw_predicted,
            "revenue_target": revenue_target,
        },
    }


# ---------- Plan → Execution Engine: kickoff content generation + schedule ----------
class PlanKickoffIn(BaseModel):
    weeks: int = 2  # how many weeks of content to schedule
    posts_per_week: int = 3
    platforms: List[str] = ["linkedin", "twitter", "blog"]


@api.post("/plan/kickoff-execution")
async def plan_kickoff_execution(payload: PlanKickoffIn, user=Depends(get_current_user)):
    """Bridges Growth Plan → Execution Engine. Generates N content kits in parallel
    (bounded concurrency=3) and schedules them across the next N weeks at common
    business hours. Caps at 6 posts to respect AI rate limits."""
    plan = await db.growth_plans.find_one({"user_id": ws(user)}, sort=[("generated_at", -1)])
    if not plan:
        raise HTTPException(status_code=404, detail="No growth plan found — generate a plan first")
    bad = [p for p in payload.platforms if p not in SUPPORTED_PLATFORMS]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unsupported platforms: {bad}")

    total_posts = max(1, min(payload.weeks * payload.posts_per_week, 6))
    posts_per_week = max(1, min(payload.posts_per_week, 5))
    errors: List[str] = []
    now = now_utc()

    # ---- Parallel content kit generation with bounded concurrency ----
    sem = asyncio.Semaphore(3)

    async def _gen_one(idx: int):
        async with sem:
            try:
                r = await content_generate(ContentGenerateIn(), user)
                return idx, r["content"], None
            except HTTPException as he:
                return idx, None, f"AI gen {idx + 1}: {he.detail}"
            except Exception as e:
                return idx, None, f"AI gen {idx + 1}: {str(e)[:80]}"

    gen_results = await asyncio.gather(*[_gen_one(i) for i in range(total_posts)])

    # Preserve idx order, drop failures
    kits_by_idx: Dict[int, Dict[str, Any]] = {}
    for idx, kit, err in gen_results:
        if err:
            errors.append(err)
        elif kit:
            kits_by_idx[idx] = kit

    # ---- Build schedules (sequential DB writes, fast) ----
    schedules_created: List[str] = []
    kits_created: List[str] = []
    for i in range(total_posts):
        kit = kits_by_idx.get(i)
        if not kit:
            continue
        kits_created.append(kit["id"])
        # Spread across weeks: 1 post on day (week*7 + slot*2 + 1) at 10:00 + slot*2h UTC
        week = i // posts_per_week
        slot = i % posts_per_week
        day_offset = week * 7 + slot * 2 + 1
        hour = 10 + (slot % 3) * 2  # 10, 12, 14
        sched_when = (now + timedelta(days=day_offset)).replace(hour=hour, minute=0, second=0, microsecond=0)
        sched_doc = {
            "id": str(uuid.uuid4()),
            "user_id": ws(user),
            "content_id": kit["id"],
            "scheduled_at": sched_when.isoformat(),
            "platforms": payload.platforms,
            "status": "PENDING",
            "delivery": {p: {"status": "pending"} for p in payload.platforms},
            "created_at": now_utc().isoformat(),
            "source": "plan_kickoff",
        }
        await db.content_schedules.insert_one(sched_doc)
        schedules_created.append(sched_doc["id"])
        await db.content_kits.update_one({"id": kit["id"], "user_id": ws(user)}, {"$set": {"status": "SCHEDULED"}})

    # In-app notification
    if schedules_created:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": ws(user),
            "title": "Execution Engine activated",
            "body": f"{len(schedules_created)} posts scheduled across {payload.weeks} week(s) on {', '.join(payload.platforms)}.",
            "severity": "info",
            "read": False,
            "created_at": now_utc().isoformat(),
        })

    return {
        "success": True,
        "kits_created": len(kits_created),
        "schedules_created": len(schedules_created),
        "errors": errors,
    }


# ---------- ICP (Ideal Customer Profile) ----------
@api.post("/icp/generate")
async def icp_generate(user=Depends(get_current_user)):
    """Generates a structured Ideal Customer Profile: persona, firmographics, signals, sample companies."""
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    target_doc = await db.lead_targets.find_one({"user_id": ws(user)}, {"_id": 0}) or {}

    cc = (profile.get('country_code') or 'US').upper()
    cur = (profile.get('currency_code') or 'USD').upper()
    country_name = COUNTRY_CURRENCY.get(cc, {}).get("name", "United States")

    biz_ctx = (
        f"Business: {profile.get('business_name','')}\n"
        f"Industry: {profile.get('industry','')}\n"
        f"Country: {country_name} ({cc}) | Currency: {cur}\n"
        f"Location: {profile.get('location','')}\n"
        f"Target audience hint: {profile.get('target_audience','')}\n"
        f"Description: {profile.get('description','')}\n"
        f"Monthly lead target: {target_doc.get('monthly_lead_target','not set')}\n"
        f"Avg deal value ({cur}): {target_doc.get('avg_deal_value_usd','not set')}\n"
    )

    prompt = (
        f"Build a sharp ICP for the business below. The ICP MUST be relevant to the {country_name} market. "
        f"Sample companies MUST be REAL companies that operate in {country_name} (mix of local champions + global players present there). "
        f"Revenue bands MUST be in {cur} (the user's local currency). "
        f"Return STRICT JSON with keys:\n"
        f"  persona (object: title, seniority, role_summary, daily_pains (array of 3), buying_triggers (array of 3), "
        f"     objections (array of 3), preferred_channels (array of 3, e.g. 'LinkedIn','Email','Cold call' — channels relevant to {country_name})),\n"
        f"  firmographics (object: company_size_range, industry, revenue_band_usd (in {cur}), geography (default to {country_name} unless user implies otherwise), tech_stack_signals (array of 5)),\n"
        f"  buying_signals (array of 5 — observable triggers like 'just raised Series A','hiring for X role','posted on LinkedIn about Y'),\n"
        f"  sample_companies (array of 10 REAL company names operating in {country_name} matching the firmographics),\n"
        f"  recommended_outreach_channels (array of 4 channels with rationale, "
        f"     each: {{channel, type ('paid'|'organic'), why_this_works, opening_message_hook}}),\n"
        f"  qualification_questions (array of 5 questions reps should ask early to qualify a lead),\n"
        f"  disqualifiers (array of 3 conditions where this lead is NOT a fit).\n\n"
        f"BUSINESS:\n{biz_ctx}"
    )
    icp = await _groq_json(prompt, max_tokens=2400)
    record = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "icp": icp,
        "generated_at": now_utc().isoformat(),
    }
    await db.icps.insert_one(record)
    record.pop("_id", None)
    return {"icp": record}


@api.get("/icp/latest")
async def icp_latest(user=Depends(get_current_user)):
    rec = await db.icps.find_one({"user_id": ws(user)}, {"_id": 0}, sort=[("generated_at", -1)])
    return {"icp": rec}


# ---------- Content Studio (daily SEO + blog + meta + social) ----------
class ContentGenerateIn(BaseModel):
    topic: Optional[str] = None  # If absent, AI picks a topic from business + ICP


@api.post("/content/generate")
async def content_generate(payload: ContentGenerateIn = ContentGenerateIn(), user=Depends(get_current_user)):
    """Generates a daily content kit: 1 blog post draft, meta-tag set,
    3 social posts (LinkedIn/X/Instagram), 5 SEO keyword targets.
    Strict JSON only — no AI commentary in the output.
    """
    await check_ai_rate_limit(user)
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    icp = await db.icps.find_one({"user_id": ws(user)}, {"_id": 0}, sort=[("generated_at", -1)])
    icp_data = (icp or {}).get("icp") or {}

    cc = (profile.get('country_code') or 'US').upper()
    cur = (profile.get('currency_code') or 'USD').upper()
    country_name = COUNTRY_CURRENCY.get(cc, {}).get("name", "United States")

    biz_ctx = (
        f"Business: {profile.get('business_name','')}\n"
        f"Industry: {profile.get('industry','')}\n"
        f"Country: {country_name} ({cc}) | Currency: {cur}\n"
        f"Target audience: {profile.get('target_audience','')}\n"
        f"Description: {profile.get('description','')}\n"
        f"ICP persona title: {(icp_data.get('persona') or {}).get('title','')}\n"
        f"ICP pains: {', '.join((icp_data.get('persona') or {}).get('daily_pains', [])[:3])}\n"
        f"Topic seed (optional): {payload.topic or 'pick the most relevant for today'}\n"
    )

    prompt = (
        f"You are a senior content marketer. Generate a complete CONTENT KIT for ONE day, optimised for {country_name} search and social. "
        f"OUTPUT STRICT JSON ONLY — no preamble, no commentary, no markdown wrapping. Output JSON with these EXACT keys:\n"
        f"  topic (1 sentence — the angle for today's content),\n"
        f"  blog_post (object: title (60 chars max, SEO-optimised), slug (kebab-case), "
        f"     excerpt (160 chars meta-description quality), body_md (700-1000 word markdown article with H2/H3 headers, "
        f"     internal CTA links denoted [CTA: text]; do NOT add ‘As an AI’ disclaimers), "
        f"     reading_time_min (integer)),\n"
        f"  meta_tags (object: title (max 60 chars), description (max 158 chars), "
        f"     og_title, og_description, twitter_title, twitter_description, "
        f"     keywords (array of 8 short-tail + long-tail keywords), canonical_path),\n"
        f"  schema_jsonld (string — full JSON-LD Article schema as escaped JSON string),\n"
        f"  social_posts (array of 3 — one each for 'linkedin', 'twitter', 'instagram'; "
        f"     each: {{platform, body (within platform limits — LI ≤ 3000, X ≤ 280, IG ≤ 2200), hashtags (array of 3-7)}}),\n"
        f"  seo_keywords (array of 5 — each: {{keyword, intent ('informational'|'commercial'|'navigational'), "
        f"     difficulty ('low'|'medium'|'high'), monthly_searches_estimate (integer)}}),\n"
        f"  cta_recommendation (1 sentence on which existing landing page or campaign this content should funnel into).\n\n"
        f"BUSINESS:\n{biz_ctx}"
    )
    kit = await _groq_json(prompt, max_tokens=4500)
    record = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "kit": kit,
        "topic": (kit or {}).get("topic") or payload.topic,
        "status": "DRAFT",
        "country_code": cc,
        "currency_code": cur,
        "generated_at": now_utc().isoformat(),
    }
    await db.content_kits.insert_one(record)
    record.pop("_id", None)
    return {"content": record}


@api.get("/content")
async def list_content(user=Depends(get_current_user)):
    items = await db.content_kits.find({"user_id": ws(user)}, {"_id": 0}).sort("generated_at", -1).limit(50).to_list(50)
    return {"content": items}


@api.get("/content/{cid}")
async def get_content(cid: str, user=Depends(get_current_user)):
    rec = await db.content_kits.find_one({"id": cid, "user_id": ws(user)}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"content": rec}


class ContentStatusIn(BaseModel):
    status: str  # DRAFT | PUBLISHED | SCHEDULED | ARCHIVED


@api.put("/content/{cid}/status")
async def update_content_status(cid: str, payload: ContentStatusIn, user=Depends(get_current_user)):
    if payload.status not in ("DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"):
        raise HTTPException(status_code=400, detail="Invalid status")
    upd = {"status": payload.status, "updated_at": now_utc().isoformat()}
    if payload.status == "PUBLISHED":
        upd["published_at"] = now_utc().isoformat()
    res = await db.content_kits.update_one({"id": cid, "user_id": ws(user)}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"success": True}


@api.delete("/content/{cid}")
async def delete_content(cid: str, user=Depends(get_current_user)):
    await db.content_kits.delete_one({"id": cid, "user_id": ws(user)})
    await db.content_schedules.delete_many({"content_id": cid, "user_id": ws(user)})
    return {"success": True}


# ---------- Content Scheduling / Auto-publish ----------
class ScheduleIn(BaseModel):
    content_id: str
    scheduled_at: str  # ISO datetime UTC
    platforms: List[str]  # ['linkedin', 'twitter', 'instagram', 'email_broadcast', 'blog']


class ScheduleUpdateIn(BaseModel):
    scheduled_at: Optional[str] = None
    platforms: Optional[List[str]] = None
    status: Optional[str] = None


SUPPORTED_PLATFORMS = {"linkedin", "twitter", "instagram", "email_broadcast", "blog"}


@api.post("/schedule")
async def create_schedule(payload: ScheduleIn, user=Depends(get_current_user)):
    bad = [p for p in payload.platforms if p not in SUPPORTED_PLATFORMS]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unsupported platforms: {bad}")
    content = await db.content_kits.find_one({"id": payload.content_id, "user_id": ws(user)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    try:
        when = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at — must be ISO datetime")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user),
        "content_id": payload.content_id,
        "scheduled_at": when.isoformat(),
        "platforms": payload.platforms,
        "status": "PENDING",
        "delivery": {p: {"status": "pending"} for p in payload.platforms},
        "created_at": now_utc().isoformat(),
    }
    await db.content_schedules.insert_one(doc)
    doc.pop("_id", None)
    return {"schedule": doc}


@api.get("/schedule")
async def list_schedules(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: Dict[str, Any] = {"user_id": ws(user)}
    if from_date or to_date:
        q["scheduled_at"] = {}
        if from_date:
            q["scheduled_at"]["$gte"] = from_date
        if to_date:
            q["scheduled_at"]["$lte"] = to_date
    items = await db.content_schedules.find(q, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    # Hydrate with content title for UI
    cids = list({i["content_id"] for i in items})
    contents = await db.content_kits.find({"id": {"$in": cids}, "user_id": ws(user)}, {"_id": 0, "id": 1, "kit": 1, "topic": 1}).to_list(len(cids))
    by_id = {c["id"]: c for c in contents}
    for it in items:
        c = by_id.get(it["content_id"]) or {}
        it["title"] = ((c.get("kit") or {}).get("blog_post") or {}).get("title") or c.get("topic") or "Untitled"
    return {"schedules": items}


@api.put("/schedule/{sid}")
async def update_schedule(sid: str, payload: ScheduleUpdateIn, user=Depends(get_current_user)):
    upd: Dict[str, Any] = {}
    if payload.scheduled_at:
        try:
            datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at")
        upd["scheduled_at"] = payload.scheduled_at
    if payload.platforms is not None:
        bad = [p for p in payload.platforms if p not in SUPPORTED_PLATFORMS]
        if bad:
            raise HTTPException(status_code=400, detail=f"Unsupported platforms: {bad}")
        upd["platforms"] = payload.platforms
    if payload.status:
        if payload.status not in ("PENDING", "CANCELLED"):
            raise HTTPException(status_code=400, detail="Invalid status")
        upd["status"] = payload.status
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.content_schedules.update_one({"id": sid, "user_id": ws(user)}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True}


@api.delete("/schedule/{sid}")
async def delete_schedule(sid: str, user=Depends(get_current_user)):
    await db.content_schedules.delete_one({"id": sid, "user_id": ws(user)})
    return {"success": True}


@api.post("/schedule/{sid}/publish-now")
async def publish_schedule_now(sid: str, user=Depends(get_current_user)):
    """Force-publish a scheduled item immediately (manual trigger)."""
    sched = await db.content_schedules.find_one({"id": sid, "user_id": ws(user)})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    res = await _publish_scheduled(sched)
    return res


async def _publish_to_linkedin(content: Dict[str, Any], oauth_token: Optional[str]) -> Dict[str, Any]:
    """Posts a status update to LinkedIn. Falls back to MOCK if no token."""
    body = next((p["body"] for p in (content.get("kit") or {}).get("social_posts", []) if p.get("platform") == "linkedin"), None)
    if not body:
        body = (content.get("kit") or {}).get("blog_post", {}).get("excerpt", "")
    if not oauth_token:
        return {"status": "mock_published", "message": "MOCKED — connect LinkedIn OAuth to actually publish.", "preview": body[:200]}
    try:
        import requests as _rq
        r = _rq.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={"Authorization": f"Bearer {oauth_token}", "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json"},
            json={
                "author": "urn:li:person:me",  # caller must have set their URN; this is a stub
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": body[:2900]},
                        "shareMediaCategory": "NONE",
                    },
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
            },
            timeout=15,
        )
        return {"status": "published" if r.status_code in (200, 201) else "failed", "http": r.status_code, "preview": body[:200]}
    except Exception as e:
        return {"status": "failed", "error": str(e)[:120]}


async def _publish_to_twitter(content: Dict[str, Any], oauth_token: Optional[str]) -> Dict[str, Any]:
    body = next((p["body"] for p in (content.get("kit") or {}).get("social_posts", []) if p.get("platform") == "twitter"), None)
    if not body:
        body = (content.get("kit") or {}).get("blog_post", {}).get("title", "")
    if not oauth_token:
        return {"status": "mock_published", "message": "MOCKED — connect Twitter/X OAuth to actually publish.", "preview": body[:200]}
    try:
        import requests as _rq
        r = _rq.post(
            "https://api.twitter.com/2/tweets",
            headers={"Authorization": f"Bearer {oauth_token}", "Content-Type": "application/json"},
            json={"text": body[:280]},
            timeout=15,
        )
        return {"status": "published" if r.status_code in (200, 201) else "failed", "http": r.status_code, "preview": body[:200]}
    except Exception as e:
        return {"status": "failed", "error": str(e)[:120]}


async def _publish_to_instagram(content: Dict[str, Any], oauth_token: Optional[str]) -> Dict[str, Any]:
    body = next((p["body"] for p in (content.get("kit") or {}).get("social_posts", []) if p.get("platform") == "instagram"), None)
    if not oauth_token:
        return {"status": "mock_published", "message": "MOCKED — Instagram needs Meta OAuth + image asset; connect on Integrations.", "preview": (body or "")[:200]}
    return {"status": "mock_published", "message": "Instagram OAuth detected but image attachment flow not fully implemented (requires Meta Graph media upload).", "preview": (body or "")[:200]}


async def _publish_to_blog(content: Dict[str, Any], user_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Publishes the content's blog post to a hosted landing page slug — internal CMS."""
    blog = (content.get("kit") or {}).get("blog_post") or {}
    slug = blog.get("slug") or _slugify(blog.get("title") or "post")
    page_doc = {
        "id": str(uuid.uuid4()),
        "user_id": ws(user_doc),
        "slug": slug,
        "name": blog.get("title", "Blog post"),
        "sections": [
            {"type": "hero", "headline": blog.get("title"), "subheadline": blog.get("excerpt")},
            {"type": "rich_text", "body_md": blog.get("body_md", "")},
        ],
        "published": True,
        "type": "blog",
        "meta_tags": (content.get("kit") or {}).get("meta_tags") or {},
        "schema_jsonld": (content.get("kit") or {}).get("schema_jsonld"),
        "created_at": now_utc().isoformat(),
    }
    # Avoid slug collisions per workspace
    existing = await db.landing_pages.find_one({"user_id": ws(user_doc), "slug": slug})
    if existing:
        page_doc["slug"] = f"{slug}-{int(now_utc().timestamp())}"
    await db.landing_pages.insert_one(page_doc)
    return {"status": "published", "slug": page_doc["slug"], "url": f"/p/{page_doc['slug']}"}


async def _publish_to_email_broadcast(content: Dict[str, Any], user_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Email-broadcasts the blog excerpt to all CONTACTED+INTERESTED leads with valid email."""
    blog = (content.get("kit") or {}).get("blog_post") or {}
    subject = blog.get("title") or "New from us"
    body = (blog.get("excerpt") or "") + "\n\n" + (blog.get("body_md") or "")[:2000]
    leads = await db.leads.find(
        {"user_id": ws(user_doc), "email": {"$ne": None}, "status": {"$in": ["CONTACTED", "INTERESTED", "NEW"]}},
        {"_id": 0, "email": 1, "id": 1},
    ).to_list(500)
    sent = 0
    for ld in leads:
        try:
            ok = await asyncio.get_event_loop().run_in_executor(
                None, _send_email_sync, ld["email"], subject, body.replace("\n", "<br/>"),
            )
            if ok:
                sent += 1
        except Exception:
            continue
    return {"status": "published" if sent else "failed", "recipients": len(leads), "delivered": sent}


async def _publish_scheduled(sched: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatches a scheduled content item to all its platforms."""
    user_doc = await db.users.find_one({"workspace_id": sched["user_id"]}, {"_id": 0}) \
        or await db.users.find_one({"id": sched["user_id"]}, {"_id": 0})
    if not user_doc:
        await db.content_schedules.update_one({"id": sched["id"]}, {"$set": {"status": "FAILED", "error": "user not found"}})
        return {"status": "FAILED"}
    content = await db.content_kits.find_one({"id": sched["content_id"], "user_id": sched["user_id"]}, {"_id": 0})
    if not content:
        await db.content_schedules.update_one({"id": sched["id"]}, {"$set": {"status": "FAILED", "error": "content missing"}})
        return {"status": "FAILED"}

    # Lookup OAuth tokens (placeholder — real OAuth flow stores these on db.oauth_tokens)
    tokens_doc = await db.oauth_tokens.find_one({"user_id": sched["user_id"]}, {"_id": 0}) or {}
    def _tok(plat):
        rec = tokens_doc.get(plat) or {}
        enc = rec.get("access_token")
        return _dec(enc) if enc else None
    delivery: Dict[str, Any] = {}
    for plat in sched["platforms"]:
        try:
            if plat == "linkedin":
                delivery[plat] = await _publish_to_linkedin(content, _tok("linkedin"))
            elif plat == "twitter":
                delivery[plat] = await _publish_to_twitter(content, _tok("twitter"))
            elif plat == "instagram":
                delivery[plat] = await _publish_to_instagram(content, _tok("instagram"))
            elif plat == "blog":
                delivery[plat] = await _publish_to_blog(content, user_doc)
            elif plat == "email_broadcast":
                delivery[plat] = await _publish_to_email_broadcast(content, user_doc)
            else:
                delivery[plat] = {"status": "failed", "error": "unsupported"}
        except Exception as e:
            delivery[plat] = {"status": "failed", "error": str(e)[:120]}

    overall = "PUBLISHED" if any(v.get("status") in ("published", "mock_published") for v in delivery.values()) else "FAILED"
    await db.content_schedules.update_one(
        {"id": sched["id"]},
        {"$set": {"status": overall, "delivery": delivery, "published_at": now_utc().isoformat()}},
    )
    if overall == "PUBLISHED":
        await db.content_kits.update_one(
            {"id": sched["content_id"]},
            {"$set": {"status": "PUBLISHED", "published_at": now_utc().isoformat()}},
        )
    # In-app notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": sched["user_id"],
        "type": "auto_publish",
        "severity": "info" if overall == "PUBLISHED" else "high",
        "title": f"Auto-publish {overall.lower()} · {len(sched['platforms'])} channels",
        "body": f"{((content.get('kit') or {}).get('blog_post') or {}).get('title') or 'Content'} → {', '.join(sched['platforms'])}",
        "link": "/schedule",
        "read": False,
        "created_at": now_utc().isoformat(),
    })
    return {"status": overall, "delivery": delivery}


# ---------- Setup status (drives the onboarding checklist) ----------
@api.get("/setup/status")
async def setup_status(user=Depends(get_current_user)):
    wid = ws(user)
    profile = await db.business_profiles.find_one({"user_id": wid}, {"_id": 0})
    target = await db.lead_targets.find_one({"user_id": wid}, {"_id": 0})
    icp = await db.icps.find_one({"user_id": wid}, {"_id": 0})
    plan = await db.growth_plans.find_one({"user_id": wid}, {"_id": 0})
    leads_count = await db.leads.count_documents({"user_id": wid})
    campaigns_count = await db.campaigns.count_documents({"user_id": wid})
    sent_count = await db.campaigns.count_documents({"user_id": wid, "status": "SENT"})

    has_profile = bool(profile and profile.get("business_name") and profile.get("industry"))
    has_target = bool(target and target.get("monthly_lead_target"))
    has_icp = bool(icp)
    has_plan = bool(plan)
    has_leads = leads_count > 0
    has_campaign = campaigns_count > 0
    has_sent = sent_count > 0

    steps = [
        {"id": "profile", "label": "Complete business profile", "done": has_profile, "cta": "/business", "cta_label": "Open profile"},
        {"id": "target", "label": "Set your monthly lead target", "done": has_target, "cta": "/analytics", "cta_label": "Set target"},
        {"id": "icp", "label": "Generate Ideal Customer Profile", "done": has_icp, "cta": "/growth", "cta_label": "Generate ICP"},
        {"id": "plan", "label": "Build 12-month growth plan", "done": has_plan, "cta": "/growth", "cta_label": "Build plan"},
        {"id": "leads", "label": "Discover your first leads", "done": has_leads, "cta": "/scraping", "cta_label": "Find leads"},
        {"id": "campaign", "label": "Draft your first campaign", "done": has_campaign, "cta": "/campaigns", "cta_label": "Create campaign"},
        {"id": "sent", "label": "Send your first campaign", "done": has_sent, "cta": "/approvals", "cta_label": "Approve & send"},
    ]
    completed = sum(1 for s in steps if s["done"])
    locale = _resolve_locale((profile or {}).get("country_code"), (profile or {}).get("currency_code"))
    return {
        "completed": completed,
        "total": len(steps),
        "percent": round(completed / len(steps) * 100),
        "next_step": next((s for s in steps if not s["done"]), None),
        "steps": steps,
        "has_profile": has_profile,
        "locale": locale,
    }


# ---------- Autopilot Kickoff (one-shot orchestrator) ----------
class AutopilotIn(BaseModel):
    monthly_lead_target: int
    avg_deal_value_usd: float
    target_audience: Optional[str] = None  # additional descriptor user adds
    guarantee_enabled: bool = False
    guarantee_terms: Optional[str] = None


@api.post("/autopilot/kickoff")
async def autopilot_kickoff(payload: AutopilotIn, user=Depends(get_current_user)):
    """One-shot: save target → generate market analysis + ICP + 12-month plan with channel distribution.
    Returns all artifacts so the UI can render a 'mission control' summary.
    Counts as 3 AI calls — rate limit is enforced per call."""
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    if not profile.get("business_name"):
        raise HTTPException(status_code=400, detail="Save your business profile first")

    # Optionally enrich profile with the user's audience hint
    if payload.target_audience and payload.target_audience.strip():
        merged_audience = (profile.get("target_audience") or "").strip()
        if payload.target_audience not in merged_audience:
            new_audience = (merged_audience + " | " + payload.target_audience).strip(" |")
            await db.business_profiles.update_one(
                {"user_id": ws(user)}, {"$set": {"target_audience": new_audience}},
            )

    # 1) Save lead target
    revenue_target = payload.monthly_lead_target * payload.avg_deal_value_usd
    await db.lead_targets.update_one(
        {"user_id": ws(user)},
        {"$set": {
            "user_id": ws(user),
            "monthly_lead_target": payload.monthly_lead_target,
            "avg_deal_value_usd": payload.avg_deal_value_usd,
            "monthly_revenue_target_usd": revenue_target,
            "guarantee_enabled": payload.guarantee_enabled,
            "guarantee_terms": payload.guarantee_terms,
            "updated_at": now_utc().isoformat(),
        }, "$setOnInsert": {"created_at": now_utc().isoformat()}},
        upsert=True,
    )

    # 2) Generate ICP (independent AI call)
    icp_result = await icp_generate(user)

    # 3) Generate 12-month growth plan (independent AI call)
    plan_result = await growth_plan_generate(user)

    # 4) Default-on alert preferences (so user gets forecast updates)
    await db.alert_preferences.update_one(
        {"user_id": ws(user)},
        {"$setOnInsert": {
            "user_id": ws(user),
            "email_enabled": True, "slack_enabled": False, "inapp_enabled": True,
            "weekly_digest": True, "daily_check": True,
            "hour_utc": 9, "at_risk_threshold_pct": 80,
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )

    return {
        "success": True,
        "lead_target": {
            "monthly_lead_target": payload.monthly_lead_target,
            "avg_deal_value_usd": payload.avg_deal_value_usd,
            "monthly_revenue_target_usd": revenue_target,
        },
        "icp": icp_result["icp"]["icp"] if icp_result.get("icp") else None,
        "plan": plan_result["plan"]["plan"] if plan_result.get("plan") else None,
    }


# ---------- Editable channel distribution + Guaranteed Leads target ----------
class ChannelOverrideIn(BaseModel):
    channel_distribution: List[Dict[str, Any]]
    monthly_lead_target: Optional[int] = None
    monthly_budget_usd: Optional[int] = None
    avg_deal_value_usd: Optional[int] = None


@api.post("/growth-plan/channels")
async def save_channel_override(payload: ChannelOverrideIn, user=Depends(get_current_user)):
    """User-overrides for the AI plan's channel distribution + targets. Persists per workspace."""
    rec = await db.growth_plans.find_one({"user_id": ws(user)}, sort=[("generated_at", -1)])
    if not rec:
        raise HTTPException(status_code=400, detail="Generate a plan first")
    plan = rec.get("plan") or {}
    plan["channel_distribution"] = payload.channel_distribution
    if payload.monthly_lead_target is not None:
        plan["monthly_lead_target"] = payload.monthly_lead_target
    if payload.monthly_budget_usd is not None:
        plan["monthly_budget_usd"] = payload.monthly_budget_usd
    if payload.avg_deal_value_usd is not None:
        plan["avg_deal_value_usd"] = payload.avg_deal_value_usd
    plan["user_modified_at"] = now_utc().isoformat()
    await db.growth_plans.update_one({"id": rec["id"]}, {"$set": {"plan": plan}})
    rec["plan"] = plan
    rec.pop("_id", None)
    return {"plan": rec}


class LeadTargetIn(BaseModel):
    monthly_lead_target: int
    avg_deal_value_usd: float = 0.0
    monthly_revenue_target_usd: Optional[float] = None
    guarantee_enabled: bool = False
    guarantee_terms: Optional[str] = None  # e.g. "Refund 25% if missed by >20%"


@api.get("/lead-targets")
async def get_lead_target(user=Depends(get_current_user)):
    rec = await db.lead_targets.find_one({"user_id": ws(user)}, {"_id": 0})
    return {"target": rec}


@api.post("/lead-targets")
async def upsert_lead_target(payload: LeadTargetIn, user=Depends(get_current_user)):
    revenue_target = payload.monthly_revenue_target_usd
    if revenue_target is None:
        revenue_target = float(payload.monthly_lead_target) * float(payload.avg_deal_value_usd)
    doc = {
        "user_id": ws(user),
        "monthly_lead_target": payload.monthly_lead_target,
        "avg_deal_value_usd": payload.avg_deal_value_usd,
        "monthly_revenue_target_usd": revenue_target,
        "guarantee_enabled": payload.guarantee_enabled,
        "guarantee_terms": payload.guarantee_terms,
        "updated_at": now_utc().isoformat(),
    }
    await db.lead_targets.update_one(
        {"user_id": ws(user)}, {"$set": doc, "$setOnInsert": {"created_at": now_utc().isoformat()}}, upsert=True,
    )
    rec = await db.lead_targets.find_one({"user_id": ws(user)}, {"_id": 0})
    return {"target": rec}


# ---------- Real-time Analytics ----------
@api.get("/analytics/realtime")
async def analytics_realtime(user=Depends(get_current_user)):
    """Live dashboard counters: leads today, last hour, conversions, revenue this month, target progress."""
    wid = ws(user)
    now = now_utc()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour_ago = now - timedelta(hours=1)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    leads_today = await db.leads.count_documents({"user_id": wid, "created_at": {"$gte": today_start.isoformat()}})
    leads_last_hour = await db.leads.count_documents({"user_id": wid, "created_at": {"$gte": hour_ago.isoformat()}})
    leads_this_month = await db.leads.count_documents({"user_id": wid, "created_at": {"$gte": month_start.isoformat()}})

    converted_this_month = await db.leads.count_documents({
        "user_id": wid, "status": "CONVERTED",
        "created_at": {"$gte": month_start.isoformat()},
    })

    # Revenue: sum actual_value of CONVERTED leads this month
    revenue_pipeline = [
        {"$match": {"user_id": wid, "status": "CONVERTED", "created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "revenue": {"$sum": {"$ifNull": ["$actual_value", 0]}}}},
    ]
    rev_doc = await db.leads.aggregate(revenue_pipeline).to_list(1)
    revenue_this_month = float(rev_doc[0]["revenue"]) if rev_doc else 0.0

    # Pipeline value: sum estimated_value for non-rejected leads
    pipeline_pipe = [
        {"$match": {"user_id": wid, "status": {"$in": ["NEW", "CONTACTED", "INTERESTED"]}}},
        {"$group": {"_id": None, "value": {"$sum": {"$ifNull": ["$estimated_value", 0]}}}},
    ]
    pipe_doc = await db.leads.aggregate(pipeline_pipe).to_list(1)
    pipeline_value = float(pipe_doc[0]["value"]) if pipe_doc else 0.0

    # Last 24h hourly leads
    hourly = []
    for i in range(23, -1, -1):
        h_start = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        h_end = h_start + timedelta(hours=1)
        c = await db.leads.count_documents({
            "user_id": wid,
            "created_at": {"$gte": h_start.isoformat(), "$lt": h_end.isoformat()},
        })
        hourly.append({"hour": h_start.strftime("%H:00"), "count": c})

    # Source breakdown for current month
    source_pipe = [
        {"$match": {"user_id": wid, "created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": {"$ifNull": ["$source", "MANUAL"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    source_data = await db.leads.aggregate(source_pipe).to_list(20)
    sources = [{"name": s["_id"], "value": s["count"]} for s in source_data]

    # Target progress
    target_doc = await db.lead_targets.find_one({"user_id": wid}, {"_id": 0})
    monthly_target = (target_doc or {}).get("monthly_lead_target") or 0
    revenue_target = (target_doc or {}).get("monthly_revenue_target_usd") or 0.0
    avg_deal = (target_doc or {}).get("avg_deal_value_usd") or 0.0

    # Forecast: linear projection based on days elapsed
    import calendar
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    day_of_month = now.day
    pace_factor = days_in_month / max(1, day_of_month)
    forecast_leads = int(round(leads_this_month * pace_factor)) if leads_this_month else 0
    forecast_revenue = revenue_this_month * pace_factor if revenue_this_month else (forecast_leads * avg_deal)

    target_progress_pct = round((leads_this_month / monthly_target * 100), 1) if monthly_target else 0
    revenue_progress_pct = round((revenue_this_month / revenue_target * 100), 1) if revenue_target else 0
    on_track = forecast_leads >= monthly_target if monthly_target else None

    locale = await _user_locale(user)

    return {
        "live": {
            "leads_last_hour": leads_last_hour,
            "leads_today": leads_today,
            "leads_this_month": leads_this_month,
            "converted_this_month": converted_this_month,
            "revenue_this_month": round(revenue_this_month, 2),
            "pipeline_value": round(pipeline_value, 2),
        },
        "target": {
            "monthly_lead_target": monthly_target,
            "monthly_revenue_target_usd": round(revenue_target, 2),
            "avg_deal_value_usd": avg_deal,
            "leads_progress_pct": target_progress_pct,
            "revenue_progress_pct": revenue_progress_pct,
            "forecast_leads": forecast_leads,
            "forecast_revenue": round(forecast_revenue, 2),
            "on_track": on_track,
            "guarantee_enabled": (target_doc or {}).get("guarantee_enabled", False),
            "guarantee_terms": (target_doc or {}).get("guarantee_terms"),
        },
        "charts": {
            "hourly_leads_24h": hourly,
            "sources_this_month": sources,
        },
        "locale": locale,
        "generated_at": now.isoformat(),
    }


@api.get("/analytics/revenue")
async def analytics_revenue(months: int = 6, user=Depends(get_current_user)):
    """Monthly revenue + lead trend for the last N months."""
    wid = ws(user)
    now = now_utc()
    # Build month start list going back N months from current month
    starts = []
    cur = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for _ in range(months):
        starts.append(cur)
        # step back one month
        if cur.month == 1:
            cur = cur.replace(year=cur.year - 1, month=12)
        else:
            cur = cur.replace(month=cur.month - 1)
    starts.reverse()

    months_data = []
    for m_start in starts:
        if m_start.month == 12:
            m_end = m_start.replace(year=m_start.year + 1, month=1)
        else:
            m_end = m_start.replace(month=m_start.month + 1)

        leads = await db.leads.count_documents({
            "user_id": wid,
            "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()},
        })
        converted = await db.leads.count_documents({
            "user_id": wid, "status": "CONVERTED",
            "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()},
        })
        rev_pipe = [
            {"$match": {
                "user_id": wid, "status": "CONVERTED",
                "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()},
            }},
            {"$group": {"_id": None, "revenue": {"$sum": {"$ifNull": ["$actual_value", 0]}}}},
        ]
        r = await db.leads.aggregate(rev_pipe).to_list(1)
        revenue = float(r[0]["revenue"]) if r else 0.0
        months_data.append({
            "month": m_start.strftime("%b %Y"),
            "leads": leads,
            "converted": converted,
            "revenue": round(revenue, 2),
            "conversion_rate": round((converted / leads * 100), 1) if leads else 0,
        })
    return {"months": months_data}


# Helper: Groq JSON-mode call returning either a single object or an array under given key
async def _groq_json(prompt: str, key: Optional[str] = None, max_tokens: int = 2000) -> Any:
    raw = await asyncio.get_event_loop().run_in_executor(
        None, _groq_chat, prompt,
        "You return STRICT JSON ONLY. No preamble, no commentary, no apologies, no AI disclaimers, no markdown code fences. Begin with { and end with }.",
        True, max_tokens, 0.5,
    )
    import json, re
    if not raw:
        return [] if key else {}
    text = raw.strip()
    # Strip code fences if model wrapped JSON in ```json ... ```
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    # Drop common AI preambles before the first {
    first_brace = text.find("{")
    first_bracket = text.find("[")
    starts = [p for p in (first_brace, first_bracket) if p >= 0]
    if starts:
        text = text[min(starts):]
    # Drop trailing commentary after the last } or ]
    last_brace = text.rfind("}")
    last_bracket = text.rfind("]")
    end = max(last_brace, last_bracket)
    if end >= 0:
        text = text[:end + 1]
    try:
        data = json.loads(text)
        if key and isinstance(data, dict) and key in data:
            return data[key]
        return data
    except Exception:
        logger.warning("Groq JSON parse failed; first 200 chars: %s", (raw or "")[:200])
        return [] if key else {}


# ---------- Inbound webhook listener (Twilio SMS / WhatsApp) ----------
async def _validate_twilio_signature(request: Request, form_data: Dict[str, str]) -> bool:
    """Validate Twilio request signature. Returns True if valid or if validation is disabled in test."""
    sig = request.headers.get("X-Twilio-Signature", "")
    if not sig:
        # In production set env STRICT_TWILIO_WEBHOOK=1 to enforce
        return os.environ.get("STRICT_TWILIO_WEBHOOK") != "1"
    try:
        validator = TwilioRequestValidator(os.environ["TWILIO_AUTH_TOKEN"])
        url = str(request.url)
        return validator.validate(url, dict(form_data), sig)
    except Exception:
        return False


@api.post("/webhooks/twilio/sms")
async def twilio_inbound_sms(request: Request):
    """Twilio inbound SMS webhook. Logs the message to the matching lead's CRM thread."""
    form = await request.form()
    form_dict = {k: v for k, v in form.items()}
    if not await _validate_twilio_signature(request, form_dict):
        logger.warning("Twilio webhook signature validation failed")
        return Response(content="<Response/>", media_type="application/xml", status_code=403)

    from_number = form.get("From", "")
    body = form.get("Body", "")
    is_whatsapp = from_number.startswith("whatsapp:")
    phone_raw = from_number.replace("whatsapp:", "")
    # Normalise: strip spaces/dashes/parens for matching
    phone_norm = "".join(ch for ch in phone_raw if ch.isdigit() or ch == "+")
    channel = "WHATSAPP" if is_whatsapp else "SMS"

    # Find matching lead by exact OR normalised phone
    lead = await db.leads.find_one({"$or": [
        {"phone": phone_raw},
        {"phone": phone_norm},
        {"phone": phone_raw.replace("+", "")},
    ]})
    if lead:
        await db.communications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": lead["user_id"],
            "lead_id": lead["id"],
            "channel": channel,
            "direction": "INBOUND",
            "content": body,
            "status": "RECEIVED",
            "sent_at": now_utc().isoformat(),
        })
        if lead.get("status") in ("NEW", "CONTACTED"):
            await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "INTERESTED"}})

    return Response(content="<Response/>", media_type="application/xml")


@api.post("/webhooks/twilio/whatsapp")
async def twilio_inbound_whatsapp(request: Request):
    return await twilio_inbound_sms(request)


# ---------- Communications inbox (across leads) ----------
@api.get("/communications/inbox")
async def communications_inbox(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": ws(user), "direction": "INBOUND"}},
        {"$sort": {"sent_at": -1}},
        {"$limit": 50},
        {"$lookup": {
            "from": "leads",
            "localField": "lead_id",
            "foreignField": "id",
            "as": "lead_doc",
        }},
        {"$unwind": {"path": "$lead_doc", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "id": 1, "user_id": 1, "lead_id": 1, "channel": 1,
            "direction": 1, "content": 1, "status": 1, "sent_at": 1,
            "lead": {"name": "$lead_doc.name", "email": "$lead_doc.email", "phone": "$lead_doc.phone"},
        }},
    ]
    items = await db.communications.aggregate(pipeline).to_list(50)
    return {"messages": items}


# ---------- Team / Workspaces ----------
class InviteIn(BaseModel):
    email: EmailStr
    first_name: str = ""
    last_name: str = ""


@api.get("/team/members")
async def list_team_members(user=Depends(get_current_user)):
    workspace = ws(user)
    members = await db.users.find(
        {"workspace_id": workspace},
        {"_id": 0, "password_hash": 0},
    ).to_list(100)
    return {"members": [serialize_user(m) | {"is_owner": m["id"] == workspace} for m in members]}


@api.post("/team/invite")
async def invite_teammate(payload: InviteIn, user=Depends(get_current_user)):
    workspace = ws(user)
    if user["id"] != workspace:
        raise HTTPException(status_code=403, detail="Only workspace owner can invite")

    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    temp_password = secrets.token_urlsafe(10)
    new_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": new_id,
        "email": email,
        "password_hash": hash_password(temp_password),
        "first_name": payload.first_name or email.split("@")[0],
        "last_name": payload.last_name,
        "role": "member",
        "workspace_id": workspace,
        "created_at": now_utc().isoformat(),
        "invited_by": user["id"],
    })

    # Send invite email
    email_delivered = False
    try:
        owner_name = f"{user.get('first_name','')} {user.get('last_name','')}".strip()
        backend_url = os.environ.get("PUBLIC_APP_URL", "")
        html = f"""
        <p>Hi {payload.first_name or "there"},</p>
        <p>{owner_name or 'Your colleague'} invited you to join their ZeroMark AI workspace.</p>
        <p><b>Sign in:</b> {backend_url or '<your ZeroMark URL>'}</p>
        <p><b>Email:</b> {email}<br/><b>Temporary password:</b> <code>{temp_password}</code></p>
        <p>Please change your password after first login.</p>
        """
        email_delivered = await asyncio.get_event_loop().run_in_executor(
            None, _send_email_sync, email, "You've been invited to ZeroMark AI", html
        )
    except Exception:
        logger.exception("Invite email failed")

    # Only return temp_password if email delivery failed (so owner can share manually)
    response = {"success": True, "user_id": new_id, "email_delivered": email_delivered}
    if not email_delivered:
        response["temp_password"] = temp_password
    return response


@api.delete("/team/members/{member_id}")
async def remove_member(member_id: str, user=Depends(get_current_user)):
    workspace = ws(user)
    if user["id"] != workspace:
        raise HTTPException(status_code=403, detail="Only workspace owner can remove members")
    if member_id == workspace:
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")
    res = await db.users.delete_one({"id": member_id, "workspace_id": workspace})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"success": True}


# ---------- Per-user AI rate limit (sliding window) ----------
AI_RATE_LIMIT_PER_HOUR = int(os.environ.get("AI_RATE_LIMIT_PER_HOUR", "60"))


async def check_ai_rate_limit(user: Dict[str, Any]):
    cutoff = (now_utc() - timedelta(hours=1)).isoformat()
    count = await db.ai_calls.count_documents({"user_id": user["id"], "ts": {"$gte": cutoff}})
    if count >= AI_RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"AI rate limit reached ({AI_RATE_LIMIT_PER_HOUR}/hour). Please wait or upgrade plan.",
        )
    await db.ai_calls.insert_one({
        "user_id": user["id"],
        "workspace_id": ws(user),
        "ts": now_utc().isoformat(),
    })


# ---------- SEO real APIs (DataForSEO/SerpAPI) with AI fallback ----------
async def _real_keyword_data(seed: str) -> Optional[List[Dict[str, Any]]]:
    """Try DataForSEO, then SerpAPI; return None if no real provider configured/working."""
    # DataForSEO
    df_login = os.environ.get("DATAFORSEO_LOGIN")
    df_pwd = os.environ.get("DATAFORSEO_PASSWORD")
    if df_login and df_pwd:
        try:
            def _fetch():
                resp = _http.post(
                    "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
                    auth=(df_login, df_pwd),
                    json=[{"keyword": seed, "language_code": "en", "location_code": 2840, "limit": 25}],
                    timeout=15,
                )
                resp.raise_for_status()
                return resp.json()
            data = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            items = data.get("tasks", [{}])[0].get("result", [{}])[0].get("items", []) or []
            return [{
                "keyword": it.get("keyword", ""),
                "intent": (it.get("search_intent_info") or {}).get("main_intent", "informational"),
                "difficulty": int((it.get("keyword_properties") or {}).get("keyword_difficulty") or 50),
                "volume_band": _volume_band((it.get("keyword_info") or {}).get("search_volume", 0)),
                "opportunity_score": _opp_score((it.get("keyword_info") or {}).get("search_volume", 0),
                                                (it.get("keyword_properties") or {}).get("keyword_difficulty", 50)),
                "category": "real-data",
                "_source": "dataforseo",
            } for it in items[:25]]
        except Exception:
            logger.exception("DataForSEO fetch failed, falling back to AI")
    # SerpAPI (related searches)
    serp_key = os.environ.get("SERPAPI_KEY")
    if serp_key:
        try:
            def _fetch():
                resp = _http.get(
                    "https://serpapi.com/search.json",
                    params={"engine": "google", "q": seed, "api_key": serp_key},
                    timeout=15,
                )
                resp.raise_for_status()
                return resp.json()
            data = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            related = data.get("related_searches", []) or []
            return [{
                "keyword": r.get("query", ""),
                "intent": "informational",
                "difficulty": 50,
                "volume_band": "mid",
                "opportunity_score": 60,
                "category": "related",
                "_source": "serpapi",
            } for r in related[:25]]
        except Exception:
            logger.exception("SerpAPI fetch failed, falling back to AI")
    return None


def _volume_band(v):
    if v >= 10000: return "high"
    if v >= 1000: return "mid"
    return "low"


def _opp_score(volume, difficulty):
    return max(0, min(100, int((volume / 100) - (difficulty or 50) + 60)))


# ---------- Social OAuth handlers (LinkedIn / Facebook / Twitter) ----------
OAUTH_PROVIDERS = {
    "linkedin": {
        "auth_url": "https://www.linkedin.com/oauth/v2/authorization",
        "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
        "scope": "openid profile email w_member_social",
        "client_id_env": "LINKEDIN_CLIENT_ID",
        "client_secret_env": "LINKEDIN_CLIENT_SECRET",
    },
    "facebook": {
        "auth_url": "https://www.facebook.com/v18.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v18.0/oauth/access_token",
        "scope": "pages_manage_posts,pages_read_engagement",
        "client_id_env": "FACEBOOK_APP_ID",
        "client_secret_env": "FACEBOOK_APP_SECRET",
    },
    "twitter": {
        "auth_url": "https://twitter.com/i/oauth2/authorize",
        "token_url": "https://api.twitter.com/2/oauth2/token",
        "scope": "tweet.read tweet.write users.read offline.access",
        "client_id_env": "TWITTER_CLIENT_ID",
        "client_secret_env": "TWITTER_CLIENT_SECRET",
    },
}


@api.get("/oauth/{provider}/start")
async def oauth_start(provider: str, user=Depends(get_current_user)):
    cfg = OAUTH_PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown provider")
    client_id = os.environ.get(cfg["client_id_env"])
    if not client_id:
        raise HTTPException(
            status_code=400,
            detail=f"{provider.title()} OAuth not configured. Set {cfg['client_id_env']} and {cfg['client_secret_env']} in backend env.",
        )
    state = secrets.token_urlsafe(16)
    await db.oauth_states.insert_one({
        "state": state, "user_id": user["id"], "workspace_id": ws(user),
        "provider": provider,
        "created_at": now_utc(),  # native datetime for TTL index
    })
    redirect_uri = f"{os.environ.get('PUBLIC_APP_URL','').rstrip('/')}/api/oauth/{provider}/callback"
    from urllib.parse import urlencode
    params = {
        "client_id": client_id, "redirect_uri": redirect_uri, "state": state,
        "response_type": "code", "scope": cfg["scope"],
    }
    return {"auth_url": f"{cfg['auth_url']}?{urlencode(params)}"}


@api.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str, state: str):
    cfg = OAUTH_PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown provider")
    rec = await db.oauth_states.find_one({"state": state, "provider": provider})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid state")
    await db.oauth_states.delete_one({"state": state})

    client_id = os.environ.get(cfg["client_id_env"])
    client_secret = os.environ.get(cfg["client_secret_env"])
    redirect_uri = f"{os.environ.get('PUBLIC_APP_URL','').rstrip('/')}/api/oauth/{provider}/callback"

    def _exchange():
        resp = _http.post(cfg["token_url"], data={
            "grant_type": "authorization_code", "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id, "client_secret": client_secret,
        }, timeout=15)
        resp.raise_for_status()
        return resp.json()

    try:
        token_data = await asyncio.get_event_loop().run_in_executor(None, _exchange)
    except Exception as e:
        logger.exception("OAuth token exchange failed: %s", e)
        raise HTTPException(status_code=400, detail="Token exchange failed — see server logs")

    access_token = token_data.get("access_token", "")
    await db.integrations.update_one(
        {"user_id": rec["workspace_id"]},
        {"$set": {provider: {
            "access_token": _enc(access_token),
            "access_token__encrypted": True,
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope"),
            "connected": True,
            "updated_at": now_utc().isoformat(),
        }}, "$setOnInsert": {"user_id": rec["workspace_id"]}},
        upsert=True,
    )
    redirect_url = f"{os.environ.get('PUBLIC_APP_URL','').rstrip('/')}/integrations?connected={provider}"
    return Response(status_code=302, headers={"Location": redirect_url})


# ---------- Briefing email preferences + cron ----------
class BriefingPrefIn(BaseModel):
    daily_email: bool = True
    hour_utc: int = 8


@api.post("/briefing/preferences")
async def update_briefing_prefs(payload: BriefingPrefIn, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"briefing_daily_email": payload.daily_email, "briefing_hour_utc": payload.hour_utc}},
    )
    return {"success": True}


@api.get("/briefing/preferences")
async def get_briefing_prefs(user=Depends(get_current_user)):
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {
        "daily_email": fresh.get("briefing_daily_email", False),
        "hour_utc": fresh.get("briefing_hour_utc", 8),
    }


# ---------- Public Landing Pages ----------
DEFAULT_SECTIONS = {
    "hero": {
        "type": "hero", "headline": "Your headline here", "subheadline": "Your subheadline",
        "cta_text": "Get started", "cta_link": "#form", "background_image": "",
    },
    "features": {
        "type": "features", "heading": "Why us",
        "items": [
            {"title": "Fast", "desc": "Ship in minutes, not weeks.", "icon": "lightning"},
            {"title": "Reliable", "desc": "99.9% uptime SLA.", "icon": "shield"},
            {"title": "Simple", "desc": "Built for non-technical founders.", "icon": "sparkle"},
        ],
    },
    "testimonial": {
        "type": "testimonial", "quote": "This product changed how we work.",
        "author": "Jane Doe", "role": "Founder", "company": "Acme Co",
    },
    "cta": {
        "type": "cta", "heading": "Ready to start?",
        "subheading": "Join hundreds of teams using us.",
        "cta_text": "Start free trial", "cta_link": "#form",
    },
    "form": {
        "type": "form", "heading": "Get in touch", "subheading": "We'll get back within 24 hours.",
        "fields": ["name", "email", "phone", "company", "message"],
        "submit_text": "Submit", "success_message": "Thanks — we'll be in touch soon.",
    },
    "faq": {
        "type": "faq", "heading": "Frequently asked",
        "items": [
            {"q": "How does it work?", "a": "Sign up, set up, ship."},
            {"q": "Is there a free trial?", "a": "Yes — 14 days."},
        ],
    },
    "image_text": {
        "type": "image_text", "heading": "Built for scale",
        "body": "Describe your value here.",
        "image": "", "position": "right",
    },
}


class LandingPageIn(BaseModel):
    title: str
    slug: Optional[str] = None
    sections: List[Dict[str, Any]] = []
    theme: Optional[Dict[str, Any]] = None  # {primary_color, font}
    published: bool = False
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


def _slugify(text: str) -> str:
    import re
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or secrets.token_urlsafe(6).lower().replace("_", "-")


@api.get("/landing-pages")
async def list_landing_pages(user=Depends(get_current_user)):
    pages = await db.landing_pages.find({"user_id": ws(user)}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"pages": pages}


@api.post("/landing-pages")
async def create_landing_page(payload: LandingPageIn, user=Depends(get_current_user)):
    pid = str(uuid.uuid4())
    base_slug = payload.slug or _slugify(payload.title)
    slug = base_slug
    counter = 1
    while await db.landing_pages.find_one({"slug": slug}):
        counter += 1
        slug = f"{base_slug}-{counter}"
    sections = payload.sections or [DEFAULT_SECTIONS["hero"], DEFAULT_SECTIONS["features"], DEFAULT_SECTIONS["form"]]
    doc = {
        "id": pid,
        "user_id": ws(user),
        "title": payload.title,
        "slug": slug,
        "sections": sections,
        "theme": payload.theme or {"primary_color": "#002EB8", "font": "Source Sans 3"},
        "published": payload.published,
        "seo_title": payload.seo_title or payload.title,
        "seo_description": payload.seo_description or "",
        "created_at": now_utc().isoformat(),
        "view_count": 0,
        "submission_count": 0,
    }
    await db.landing_pages.insert_one(doc)
    doc.pop("_id", None)
    return {"page": doc}


@api.get("/landing-pages/{pid}")
async def get_landing_page(pid: str, user=Depends(get_current_user)):
    page = await db.landing_pages.find_one({"id": pid, "user_id": ws(user)}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return {"page": page}


@api.put("/landing-pages/{pid}")
async def update_landing_page(pid: str, payload: LandingPageIn, user=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_utc().isoformat()
    # Slug uniqueness if changed
    if payload.slug:
        existing = await db.landing_pages.find_one({"slug": payload.slug, "id": {"$ne": pid}})
        if existing:
            raise HTTPException(status_code=400, detail="Slug already in use")
    res = await db.landing_pages.update_one({"id": pid, "user_id": ws(user)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Landing page not found")
    page = await db.landing_pages.find_one({"id": pid}, {"_id": 0})
    return {"page": page}


@api.delete("/landing-pages/{pid}")
async def delete_landing_page(pid: str, user=Depends(get_current_user)):
    await db.landing_pages.delete_one({"id": pid, "user_id": ws(user)})
    return {"success": True}


class GenerateSectionIn(BaseModel):
    section_type: str
    goal: Optional[str] = None
    tone: str = "professional"


@api.post("/landing-pages/{pid}/ai-generate-section")
async def ai_generate_section(pid: str, payload: GenerateSectionIn, user=Depends(get_current_user)):
    await check_ai_rate_limit(user)
    page = await db.landing_pages.find_one({"id": pid, "user_id": ws(user)}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}

    biz_ctx = (
        f"Business: {profile.get('business_name','')}\n"
        f"Industry: {profile.get('industry','')}\n"
        f"Target audience: {profile.get('target_audience','')}\n"
        f"Description: {profile.get('description','')}\n"
        f"Tone: {payload.tone}\n"
        f"Goal: {payload.goal or 'drive conversions'}\n"
    )

    section_prompts = {
        "hero": (
            "Write a punchy landing page HERO section. Output STRICT JSON: "
            "{type:'hero', headline (max 8 words, bold claim), subheadline (1-2 sentences expanding the headline), "
            "cta_text (action verb 2-4 words, e.g. 'Start free trial'), cta_link (use '#form'), "
            "background_image (leave empty string)}."
        ),
        "features": (
            "Write a FEATURES section with 3 benefits. Output STRICT JSON: "
            "{type:'features', heading (e.g. 'Why teams choose us'), items: array of 3 {title (3-5 words), "
            "desc (1 sentence), icon (one of: lightning, shield, sparkle, target, rocket, chart)}}."
        ),
        "testimonial": (
            "Write a realistic-sounding TESTIMONIAL. Output STRICT JSON: "
            "{type:'testimonial', quote (2-3 sentences), author (plausible name), role, company}."
        ),
        "cta": (
            "Write a strong final-call-to-action section. STRICT JSON: "
            "{type:'cta', heading (urgency-driving), subheading (1 sentence reinforcement), "
            "cta_text (action verb), cta_link ('#form')}."
        ),
        "form": (
            "Write a contact form section. STRICT JSON: "
            "{type:'form', heading (inviting tone), subheading (sets expectation), "
            "fields (array; pick relevant from: name,email,phone,company,message), "
            "submit_text, success_message}."
        ),
        "faq": (
            "Write 4 likely FAQs. STRICT JSON: "
            "{type:'faq', heading:'Frequently asked', items: array of 4 {q, a (1-2 sentences)}}."
        ),
        "image_text": (
            "Write an IMAGE+TEXT feature block. STRICT JSON: "
            "{type:'image_text', heading (4-6 words), body (2-3 sentences with concrete benefit), "
            "image (leave empty), position ('right')}."
        ),
    }
    spec = section_prompts.get(payload.section_type)
    if not spec:
        raise HTTPException(status_code=400, detail=f"Unknown section type: {payload.section_type}")

    prompt = f"{biz_ctx}\n\nTASK: {spec}"
    section = await _groq_json(prompt, max_tokens=900)
    return {"section": section}


# ---------- PUBLIC: View landing page + submit form ----------
@api.get("/public/p/{slug}")
async def public_get_landing_page(slug: str):
    page = await db.landing_pages.find_one({"slug": slug, "published": True}, {"_id": 0, "user_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found or unpublished")
    # Increment view count async (best-effort)
    await db.landing_pages.update_one({"slug": slug}, {"$inc": {"view_count": 1}})
    return {"page": page}


class PublicSubmissionIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    message: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


@api.post("/public/p/{slug}/submit")
async def public_submit_form(slug: str, payload: PublicSubmissionIn, request: Request):
    page = await db.landing_pages.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Anti-abuse: simple rate limit (10 submissions per 5 min per IP per page)
    ip = (request.headers.get("x-forwarded-for", "") or (request.client.host if request.client else "")).split(",")[0].strip()
    cutoff = (now_utc() - timedelta(minutes=5)).isoformat()
    recent = await db.public_submissions.count_documents({
        "ip": ip, "slug": slug, "created_at": {"$gte": cutoff}
    })
    if recent >= 10:
        raise HTTPException(status_code=429, detail="Too many submissions. Please try later.")

    if not (payload.name or payload.email or payload.phone):
        raise HTTPException(status_code=400, detail="Name, email or phone required")

    workspace_owner_id = page["user_id"]

    # Create lead
    lead_id = str(uuid.uuid4())
    notes_parts = []
    if payload.message:
        notes_parts.append(f"Message: {payload.message}")
    notes_parts.append(f"Source page: {page['title']} (/p/{slug})")
    if payload.extra:
        notes_parts.append(f"Extra: {payload.extra}")

    lead_doc = {
        "id": lead_id,
        "user_id": workspace_owner_id,
        "name": payload.name or (payload.email.split("@")[0] if payload.email else "Anonymous"),
        "email": payload.email,
        "phone": payload.phone,
        "company": payload.company,
        "source": "LANDING_PAGE",
        "status": "NEW",
        "score": 60,  # higher than scraped because they self-submitted
        "notes": " | ".join(notes_parts),
        "landing_page_id": page["id"],
        "created_at": now_utc().isoformat(),
    }
    await db.leads.insert_one(lead_doc)

    # Log a comm record so it shows in Inbox immediately
    if payload.message:
        await db.communications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": workspace_owner_id,
            "lead_id": lead_id,
            "channel": "FORM",
            "direction": "INBOUND",
            "subject": f"New form submission · {page['title']}",
            "content": payload.message,
            "status": "RECEIVED",
            "sent_at": now_utc().isoformat(),
        })

    await db.public_submissions.insert_one({
        "id": str(uuid.uuid4()),
        "slug": slug, "ip": ip,
        "lead_id": lead_id,
        "created_at": now_utc().isoformat(),
    })
    await db.landing_pages.update_one({"slug": slug}, {"$inc": {"submission_count": 1}})

    return {"success": True, "message": page.get("sections", [{}])[-1].get("success_message", "Thanks!")}


# ====================================================================
# ---------- Forecast Alerts (daily + weekly + on-demand) ----------
# ====================================================================

class AlertPreferencesIn(BaseModel):
    email_enabled: bool = True
    slack_enabled: bool = False
    inapp_enabled: bool = True
    slack_webhook_url: Optional[str] = None
    weekly_digest: bool = True
    daily_check: bool = True
    hour_utc: int = 9  # When to deliver daily/weekly alerts
    at_risk_threshold_pct: int = 80  # forecast/target * 100 < this → alert
    auto_daily_content: bool = False  # Auto-generate one content kit per day at hour_utc
    auto_publish_when_at_risk: bool = False  # When forecast at risk, auto-schedule extra content this week


@api.get("/alerts/preferences")
async def get_alert_preferences(user=Depends(get_current_user)):
    rec = await db.alert_preferences.find_one({"user_id": ws(user)}, {"_id": 0})
    if not rec:
        rec = AlertPreferencesIn().model_dump()
        rec["user_id"] = ws(user)
    return {"preferences": rec}


@api.post("/alerts/preferences")
async def save_alert_preferences(payload: AlertPreferencesIn, user=Depends(get_current_user)):
    if not (0 <= payload.hour_utc <= 23):
        raise HTTPException(status_code=400, detail="hour_utc must be 0-23")
    if not (1 <= payload.at_risk_threshold_pct <= 100):
        raise HTTPException(status_code=400, detail="at_risk_threshold_pct must be 1-100")
    if payload.slack_enabled and not payload.slack_webhook_url:
        raise HTTPException(status_code=400, detail="Slack webhook URL is required when Slack is enabled")
    if payload.slack_webhook_url and not payload.slack_webhook_url.startswith("https://hooks.slack.com/"):
        raise HTTPException(status_code=400, detail="Slack webhook must start with https://hooks.slack.com/")
    doc = payload.model_dump()
    doc["user_id"] = ws(user)
    doc["updated_at"] = now_utc().isoformat()
    await db.alert_preferences.update_one(
        {"user_id": ws(user)}, {"$set": doc, "$setOnInsert": {"created_at": now_utc().isoformat()}}, upsert=True,
    )
    rec = await db.alert_preferences.find_one({"user_id": ws(user)}, {"_id": 0})
    return {"preferences": rec}


async def _compute_forecast_payload(workspace_id: str) -> Dict[str, Any]:
    """Returns dict: leads_this_month, target, forecast, pct, at_risk, top_paid, top_organic, channel_distribution."""
    now = now_utc()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    import calendar
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    day_of_month = now.day

    leads_this_month = await db.leads.count_documents({
        "user_id": workspace_id,
        "created_at": {"$gte": month_start.isoformat()},
    })
    rev_pipe = [
        {"$match": {"user_id": workspace_id, "status": "CONVERTED", "created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "rev": {"$sum": {"$ifNull": ["$actual_value", 0]}}}},
    ]
    r = await db.leads.aggregate(rev_pipe).to_list(1)
    revenue_this_month = float(r[0]["rev"]) if r else 0.0

    pace_factor = days_in_month / max(1, day_of_month)
    forecast_leads = int(round(leads_this_month * pace_factor)) if leads_this_month else 0
    forecast_revenue = revenue_this_month * pace_factor if revenue_this_month else 0.0

    target_doc = await db.lead_targets.find_one({"user_id": workspace_id}, {"_id": 0}) or {}
    monthly_target = int(target_doc.get("monthly_lead_target") or 0)
    revenue_target = float(target_doc.get("monthly_revenue_target_usd") or 0.0)
    pct = round(forecast_leads / monthly_target * 100, 1) if monthly_target else 0.0

    plan_rec = await db.growth_plans.find_one({"user_id": workspace_id}, {"_id": 0}, sort=[("generated_at", -1)]) or {}
    plan = plan_rec.get("plan") or {}
    channels = plan.get("channel_distribution") or []

    return {
        "month": month_start.strftime("%B %Y"),
        "leads_this_month": leads_this_month,
        "revenue_this_month": round(revenue_this_month, 2),
        "monthly_target": monthly_target,
        "revenue_target": revenue_target,
        "forecast_leads": forecast_leads,
        "forecast_revenue": round(forecast_revenue, 2),
        "forecast_pct_of_target": pct,
        "day_of_month": day_of_month,
        "days_in_month": days_in_month,
        "channels": channels,
    }


async def _ai_corrective_action(payload: Dict[str, Any], business: Dict[str, Any]) -> str:
    """Use Groq to suggest one concrete corrective action. Falls back gracefully."""
    if not payload.get("monthly_target"):
        return "Set a monthly lead target in /analytics to enable forecast tracking."
    gap = payload["monthly_target"] - payload["forecast_leads"]
    if gap <= 0:
        return f"You're on pace to hit {payload['forecast_leads']} of {payload['monthly_target']} leads — keep it up. Consider doubling down on your highest-CPL channel."
    channels_brief = "\n".join(
        f"- {c.get('name')} ({c.get('type')}): ${c.get('monthly_budget_usd', 0)}/mo, expected {c.get('expected_leads_per_month', 0)} leads, CPL ${c.get('expected_cpl_usd', 0)}"
        for c in (payload.get("channels") or [])[:8]
    ) or "(no channel plan saved yet)"

    prompt = (
        f"You are a paid-marketing operator for {business.get('business_name', 'a SaaS company')} "
        f"({business.get('industry', '')}). It is day {payload['day_of_month']}/{payload['days_in_month']} of {payload['month']}. "
        f"They have {payload['leads_this_month']} leads, forecasting {payload['forecast_leads']} vs target of {payload['monthly_target']} "
        f"(gap of {gap} leads, {payload['forecast_pct_of_target']}% of target). "
        f"Current channel mix:\n{channels_brief}\n\n"
        f"Recommend ONE specific, actionable budget shift to close the gap THIS month. "
        f"Be concrete: name the channel, the dollar amount to add, and the expected lead lift. "
        f"Keep it under 35 words. Output plain text only — no JSON, no markdown."
    )
    try:
        text = await asyncio.get_event_loop().run_in_executor(
            None, _groq_chat, prompt, "You are a senior performance-marketing operator. Be brutally concise.", False, 220, 0.4,
        )
        return (text or "").strip().strip('"').strip()[:400]
    except Exception:
        return f"Forecast is {payload['forecast_pct_of_target']}% of target — increase your highest-CPL paid channel budget by ~25% to recover the {gap}-lead gap."


def _build_alert_email_html(payload: Dict[str, Any], suggestion: str, app_url: str, kind: str) -> str:
    pct = payload["forecast_pct_of_target"] or 0
    bar_color = "#0FB39A" if pct >= 100 else "#FF562D" if pct >= 80 else "#E32636"
    bar_pct = max(0, min(100, pct))
    title = "Weekly forecast digest" if kind == "weekly" else ("On-demand check" if kind == "test" else "Forecast alert: at risk")
    return f"""
    <div style="font-family:'Source Sans 3',-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FAF7F2;color:#0E0F11">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#71717A;margin:0 0 8px">// ZeroMark AI · {title}</p>
      <h1 style="font-family:Fraunces,Georgia,serif;font-size:36px;font-weight:900;letter-spacing:-0.02em;line-height:1.05;margin:0 0 8px">
        {payload['forecast_leads']} forecasted vs <span style="color:{bar_color}">{payload['monthly_target']}</span> target
      </h1>
      <p style="font-size:15px;color:#3F3F46;margin:0 0 20px">{payload['month']} · day {payload['day_of_month']} of {payload['days_in_month']}</p>

      <div style="background:#fff;border:1px solid #EDE5D4;border-radius:16px;padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#52525B;margin-bottom:8px">
          <span>{payload['leads_this_month']} leads so far</span>
          <span style="color:{bar_color}">{pct}% of target</span>
        </div>
        <div style="height:10px;background:#FAF7F2;border-radius:10px;overflow:hidden;border:1px solid #EDE5D4">
          <div style="height:100%;width:{bar_pct}%;background:{bar_color};border-radius:10px"></div>
        </div>
        <p style="font-size:12px;color:#71717A;margin:8px 0 0">Pipeline value forecast: <b style="color:#0E0F11">${int(payload['forecast_revenue']):,}</b></p>
      </div>

      <div style="background:#0E0F11;color:#fff;border-radius:16px;padding:20px;margin-bottom:20px">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#FF562D;margin:0 0 8px">// AI suggested action</p>
        <p style="font-size:16px;line-height:1.5;margin:0">{suggestion}</p>
      </div>

      <a href="{app_url}/analytics" style="display:inline-block;background:#FF562D;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none">Open Live Analytics →</a>

      <p style="font-size:11px;color:#A1A1AA;margin:32px 0 0;letter-spacing:0.1em;text-transform:uppercase;font-weight:700">
        Manage alerts in your Team settings · ZeroMark AI
      </p>
    </div>
    """


def _send_slack_webhook_sync(webhook_url: str, payload: Dict[str, Any], suggestion: str, app_url: str, kind: str) -> bool:
    try:
        import requests
        pct = payload["forecast_pct_of_target"]
        emoji = "🟢" if pct >= 100 else ("🟠" if pct >= 80 else "🔴")
        title_kind = "Weekly digest" if kind == "weekly" else ("On-demand check" if kind == "test" else "Forecast alert")
        body = {
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} ZeroMark · {title_kind}"}},
                {"type": "section", "text": {"type": "mrkdwn", "text":
                    f"*{payload['forecast_leads']}* forecasted vs *{payload['monthly_target']}* target  ·  *{pct}%* of target\n"
                    f"_{payload['month']} · day {payload['day_of_month']} of {payload['days_in_month']}_"
                }},
                {"type": "section", "text": {"type": "mrkdwn", "text": f":sparkles: *AI suggestion:* {suggestion}"}},
                {"type": "actions", "elements": [
                    {"type": "button", "text": {"type": "plain_text", "text": "Open Live Analytics"}, "url": f"{app_url}/analytics", "style": "primary"},
                ]},
            ]
        }
        r = requests.post(webhook_url, json=body, timeout=10)
        return r.status_code in (200, 204)
    except Exception as e:
        logger.error("Slack webhook failed: %s", e)
        return False


async def _send_forecast_alert(user_doc: Dict[str, Any], kind: str = "daily", force: bool = False) -> Dict[str, Any]:
    """Sends a forecast alert to the user via their preferred channels.
    `kind` ∈ {'daily', 'weekly', 'test'}.
    `force=True` skips the threshold check (used for test + weekly)."""
    workspace_id = user_doc.get("workspace_id") or user_doc["id"]
    prefs = await db.alert_preferences.find_one({"user_id": workspace_id}, {"_id": 0}) or {}
    payload = await _compute_forecast_payload(workspace_id)

    threshold = int(prefs.get("at_risk_threshold_pct", 80))
    pct = payload["forecast_pct_of_target"] or 0
    at_risk = bool(payload["monthly_target"]) and pct < threshold
    payload["at_risk"] = at_risk
    payload["threshold_pct"] = threshold

    # Daily alerts only fire when at risk; weekly + test always fire.
    if kind == "daily" and not (at_risk or force):
        return {"sent": False, "reason": "not at risk", "payload": payload}
    if not payload["monthly_target"] and not force:
        return {"sent": False, "reason": "no target set", "payload": payload}

    profile = await db.business_profiles.find_one({"user_id": workspace_id}, {"_id": 0}) or {}
    suggestion = await _ai_corrective_action(payload, profile)
    payload["suggestion"] = suggestion

    app_url = os.environ.get("PUBLIC_APP_URL", "https://app.zeromark.ai").rstrip("/")
    delivered = {"email": False, "slack": False, "inapp": False}

    # In-app notification
    if prefs.get("inapp_enabled", True) or kind == "test":
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": workspace_id,
            "type": "forecast_alert",
            "kind": kind,
            "severity": "high" if at_risk else "info",
            "title": (
                f"At risk: {pct}% of monthly target" if at_risk
                else (f"Weekly digest: on track ({pct}%)" if kind == "weekly" else f"On track ({pct}%)")
            ),
            "body": suggestion,
            "link": "/analytics",
            "payload": payload,
            "read": False,
            "created_at": now_utc().isoformat(),
        })
        delivered["inapp"] = True

    # Email
    if prefs.get("email_enabled", True) and user_doc.get("email"):
        title = (
            "[ZeroMark] Forecast at risk — action needed" if at_risk
            else ("[ZeroMark] Weekly forecast digest" if kind == "weekly" else "[ZeroMark] On-demand forecast check")
        )
        html = _build_alert_email_html(payload, suggestion, app_url, kind)
        delivered["email"] = await asyncio.get_event_loop().run_in_executor(
            None, _send_email_sync, user_doc["email"], title, html,
        )

    # Slack
    if prefs.get("slack_enabled") and prefs.get("slack_webhook_url"):
        delivered["slack"] = await asyncio.get_event_loop().run_in_executor(
            None, _send_slack_webhook_sync, prefs["slack_webhook_url"], payload, suggestion, app_url, kind,
        )

    await db.alert_history.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": workspace_id,
        "kind": kind,
        "delivered": delivered,
        "payload": payload,
        "sent_at": now_utc().isoformat(),
    })

    # Auto-schedule extra content when at risk (closes the loop: behind → publish more)
    if at_risk and prefs.get("auto_publish_when_at_risk") and (kind == "weekly" or kind == "daily"):
        try:
            await _auto_schedule_recovery_content(workspace_id, payload)
        except Exception:
            logger.exception("auto recovery content scheduling failed")

    return {"sent": True, "delivered": delivered, "payload": payload}


async def _auto_schedule_recovery_content(workspace_id: str, payload: Dict[str, Any]) -> None:
    """When a workspace is at risk, auto-schedule 3 extra content posts evenly spaced over the next 7 days."""
    # Pick 3 most recent DRAFT content kits
    drafts = await db.content_kits.find(
        {"user_id": workspace_id, "status": "DRAFT"}, {"_id": 0, "id": 1},
    ).sort("generated_at", -1).limit(3).to_list(3)
    if not drafts:
        return
    base = now_utc() + timedelta(hours=2)
    for i, draft in enumerate(drafts):
        when = base + timedelta(days=i * 2)  # day +0, +2, +4
        await db.content_schedules.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": workspace_id,
            "content_id": draft["id"],
            "scheduled_at": when.isoformat(),
            "platforms": ["linkedin", "twitter", "blog"],
            "status": "PENDING",
            "delivery": {"linkedin": {"status": "pending"}, "twitter": {"status": "pending"}, "blog": {"status": "pending"}},
            "auto_recovery": True,
            "created_at": now_utc().isoformat(),
        })
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": workspace_id,
        "type": "auto_recovery",
        "severity": "high",
        "title": f"Auto-scheduled {len(drafts)} content posts to recover {payload.get('forecast_pct_of_target',0)}% forecast",
        "body": "Forecast is below target. Extra posts scheduled across the next 7 days. Edit or cancel in Schedule.",
        "link": "/schedule",
        "read": False,
        "created_at": now_utc().isoformat(),
    })


@api.post("/alerts/test")
async def send_alert_test(user=Depends(get_current_user)):
    """On-demand: send a forecast alert NOW via configured channels."""
    res = await _send_forecast_alert(user, kind="test", force=True)
    return res


@api.get("/alerts/history")
async def get_alert_history(user=Depends(get_current_user)):
    items = await db.alert_history.find({"user_id": ws(user)}, {"_id": 0}).sort("sent_at", -1).limit(50).to_list(50)
    return {"history": items}


# ---------- In-app Notifications (bell) ----------
@api.get("/notifications")
async def list_notifications(unread_only: bool = False, user=Depends(get_current_user)):
    q: Dict[str, Any] = {"user_id": ws(user)}
    if unread_only:
        q["read"] = False
    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({"user_id": ws(user), "read": False})
    return {"notifications": items, "unread_count": unread}


@api.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str, user=Depends(get_current_user)):
    res = await db.notifications.update_one({"id": nid, "user_id": ws(user)}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@api.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    res = await db.notifications.update_many({"user_id": ws(user), "read": False}, {"$set": {"read": True}})
    return {"success": True, "updated": res.modified_count}


# ====================================================================
# ---------- Super Admin ----------
# ====================================================================

def _require_admin(user):
    if (user.get("role") or "user") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@api.get("/admin/overview")
async def admin_overview(user=Depends(get_current_user)):
    _require_admin(user)
    total_users = await db.users.count_documents({})
    total_workspaces = len(await db.users.distinct("workspace_id"))
    total_leads = await db.leads.count_documents({})
    total_campaigns = await db.campaigns.count_documents({})
    total_content = await db.content_kits.count_documents({})
    total_landing = await db.landing_pages.count_documents({})
    week_ago = (now_utc() - timedelta(days=7)).isoformat()
    new_users_7d = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    active_7d = await db.users.count_documents({"last_login": {"$gte": week_ago}})
    by_provider_pipe = [
        {"$group": {"_id": {"$ifNull": ["$auth_provider", "email"]}, "count": {"$sum": 1}}},
    ]
    providers = [{"provider": d["_id"], "count": d["count"]} async for d in db.users.aggregate(by_provider_pipe)]
    by_plan_pipe = [
        {"$group": {"_id": {"$ifNull": ["$plan", "FREE_TRIAL"]}, "count": {"$sum": 1}}},
    ]
    plans = [{"plan": d["_id"], "count": d["count"]} async for d in db.subscriptions.aggregate(by_plan_pipe)]
    return {
        "totals": {
            "users": total_users, "workspaces": total_workspaces,
            "leads": total_leads, "campaigns": total_campaigns,
            "content_kits": total_content, "landing_pages": total_landing,
        },
        "growth": {"new_users_7d": new_users_7d, "active_7d": active_7d},
        "by_provider": providers,
        "by_plan": plans,
    }


@api.get("/admin/users")
async def admin_users(
    page: int = 1,
    limit: int = 25,
    q: Optional[str] = None,
    user=Depends(get_current_user),
):
    _require_admin(user)
    page = max(1, page)
    limit = max(1, min(limit, 100))
    skip = (page - 1) * limit

    # Build query
    mongo_q: Dict[str, Any] = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        mongo_q["$or"] = [
            {"email": rx},
            {"phone": rx},
            {"first_name": rx},
            {"last_name": rx},
        ]

    total = await db.users.count_documents(mongo_q)
    users = await db.users.find(mongo_q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    if not users:
        return {
            "users": [],
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        }

    # Workspace IDs to aggregate over (for current page only)
    wids = list({(u.get("workspace_id") or u["id"]) for u in users})

    # Single $group aggregation per collection — O(1) round-trips instead of O(N)
    pipeline_count_by_user = [
        {"$match": {"user_id": {"$in": wids}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ]
    leads_by_wid: Dict[str, int] = {}
    async for d in db.leads.aggregate(pipeline_count_by_user):
        leads_by_wid[d["_id"]] = d["count"]
    camps_by_wid: Dict[str, int] = {}
    async for d in db.campaigns.aggregate(pipeline_count_by_user):
        camps_by_wid[d["_id"]] = d["count"]
    subs_by_wid: Dict[str, Dict[str, Any]] = {}
    async for s in db.subscriptions.find({"user_id": {"$in": wids}}, {"_id": 0}):
        subs_by_wid[s["user_id"]] = s

    enriched = []
    for u in users:
        wid = u.get("workspace_id") or u["id"]
        enriched.append({
            **u,
            "lead_count": leads_by_wid.get(wid, 0),
            "campaign_count": camps_by_wid.get(wid, 0),
            "subscription": subs_by_wid.get(wid),
        })
    return {
        "users": enriched,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit if total else 0,
    }


# ====================================================================
# ---------- AI Chatbot Assistant ----------
# ====================================================================

class ChatIn(BaseModel):
    message: str
    history: List[Dict[str, str]] = []  # [{role, content}, ...]


@api.post("/assistant/chat")
async def assistant_chat(payload: ChatIn, user=Depends(get_current_user)):
    """In-app guidance chatbot. Knows the platform's pages and the user's setup status."""
    await check_ai_rate_limit(user)
    # Snapshot user state
    profile = await db.business_profiles.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    leads_count = await db.leads.count_documents({"user_id": ws(user)})
    campaigns_count = await db.campaigns.count_documents({"user_id": ws(user)})
    target = await db.lead_targets.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    icp = await db.icps.find_one({"user_id": ws(user)}, {"_id": 0})
    plan = await db.growth_plans.find_one({"user_id": ws(user)}, {"_id": 0})

    state = (
        f"USER STATE: {leads_count} leads · {campaigns_count} campaigns · "
        f"profile {'YES' if profile.get('business_name') else 'MISSING'} · "
        f"ICP {'YES' if icp else 'NO'} · "
        f"12-month plan {'YES' if plan else 'NO'} · "
        f"monthly target {target.get('monthly_lead_target', 'not set')} · "
        f"country {(profile.get('country_code') or 'US')}.\n"
    )

    system = (
        "You are ZeroMark's in-app guide. Be CONCISE (max 4 sentences). "
        "Always link the user to a specific page using markdown link syntax like [Open Analytics](/analytics). "
        "Available pages: /dashboard, /analytics, /leads, /campaigns, /approvals, /inbox, /scraping, "
        "/landing-pages, /growth (Growth Studio), /content (Content Studio), /schedule (Auto-publish), "
        "/business (Business Profile), /integrations, /team, /reports, /billing. "
        "If the user mentions setup, point them at /onboarding. "
        "Never apologise. Never say 'as an AI'. If unsure, give them the 1 next concrete step."
    )

    msgs = [{"role": "system", "content": system + "\n\n" + state}]
    for h in payload.history[-8:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            msgs.append({"role": h["role"], "content": str(h["content"])[:1000]})
    msgs.append({"role": "user", "content": payload.message[:1500]})

    try:
        from groq import Groq as _G
        client = _G(api_key=os.environ["GROQ_API_KEY"])
        r = client.chat.completions.create(
            model="llama-3.3-70b-versatile", messages=msgs, max_tokens=400, temperature=0.6,
        )
        reply = r.choices[0].message.content.strip()
    except Exception as e:
        logger.error("Assistant chat failed: %s", e)
        reply = "I had trouble reaching the AI just now. Try [Dashboard](/dashboard) — your setup checklist there shows the next concrete step."
    return {"reply": reply}


# ====================================================================
# ---------- Social Media OAuth-style credential vault ----------
# ====================================================================

class SocialCredsIn(BaseModel):
    platform: str  # 'linkedin' | 'twitter' | 'instagram' | 'facebook'
    access_token: str
    refresh_token: Optional[str] = None
    account_handle: Optional[str] = None  # @user, page id, etc.
    expires_at: Optional[str] = None


@api.get("/integrations/social")
async def get_social_creds(user=Depends(get_current_user)):
    rec = await db.oauth_tokens.find_one({"user_id": ws(user)}, {"_id": 0}) or {}
    out = {}
    for plat in ("linkedin", "twitter", "instagram", "facebook"):
        info = rec.get(plat) or {}
        if info:
            out[plat] = {
                "connected": True,
                "handle": info.get("account_handle"),
                "expires_at": info.get("expires_at"),
                "updated_at": info.get("updated_at"),
            }
        else:
            out[plat] = {"connected": False}
    return {"platforms": out}


@api.post("/integrations/social")
async def save_social_creds(payload: SocialCredsIn, user=Depends(get_current_user)):
    if payload.platform not in ("linkedin", "twitter", "instagram", "facebook"):
        raise HTTPException(status_code=400, detail="Unsupported platform")
    if not payload.access_token or len(payload.access_token) < 10:
        raise HTTPException(status_code=400, detail="Access token looks invalid")
    info = {
        "access_token": _enc(payload.access_token),  # stored encrypted at rest
        "refresh_token": _enc(payload.refresh_token) if payload.refresh_token else None,
        "account_handle": payload.account_handle,
        "expires_at": payload.expires_at,
        "updated_at": now_utc().isoformat(),
    }
    await db.oauth_tokens.update_one(
        {"user_id": ws(user)},
        {"$set": {payload.platform: info, "user_id": ws(user)}},
        upsert=True,
    )
    return {"success": True, "platform": payload.platform, "connected": True}


@api.delete("/integrations/social/{platform}")
async def disconnect_social(platform: str, user=Depends(get_current_user)):
    if platform not in ("linkedin", "twitter", "instagram", "facebook"):
        raise HTTPException(status_code=400, detail="Unsupported platform")
    await db.oauth_tokens.update_one({"user_id": ws(user)}, {"$unset": {platform: ""}})
    return {"success": True}


# Register router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://([a-z0-9-]+\.)*(emergentagent\.com|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup ----------
scheduler = AsyncIOScheduler(timezone="UTC")


async def _imap_poll_inbound_emails():
    """Poll Gmail IMAP for new replies, match to leads by sender email, log as INBOUND."""
    try:
        sender = os.environ.get("GMAIL_SENDER_EMAIL")
        pwd = os.environ.get("GMAIL_APP_PASSWORD")
        if not sender or not pwd:
            return

        def _fetch():
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(sender, pwd)
            mail.select("INBOX")
            # Search unread received in last 1 day
            status, ids = mail.search(None, "UNSEEN")
            if status != "OK":
                mail.logout()
                return []
            results = []
            for uid in (ids[0].split() or [])[:30]:
                status, data = mail.fetch(uid, "(RFC822)")
                if status != "OK":
                    continue
                msg = _email_lib.message_from_bytes(data[0][1])
                from_addr = parseaddr(msg.get("From", ""))[1].lower()
                subject_raw = msg.get("Subject", "")
                subj_decoded = ""
                for part, enc in decode_header(subject_raw):
                    subj_decoded += part.decode(enc or "utf-8", errors="ignore") if isinstance(part, bytes) else part

                # Get plain text body
                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        ct = part.get_content_type()
                        if ct == "text/plain" and not part.get("Content-Disposition", "").startswith("attachment"):
                            try:
                                body = part.get_payload(decode=True).decode(errors="ignore")
                                break
                            except Exception:
                                pass
                else:
                    try:
                        body = msg.get_payload(decode=True).decode(errors="ignore")
                    except Exception:
                        body = msg.get_payload() or ""
                results.append({"from": from_addr, "subject": subj_decoded, "body": body[:5000]})
                # mark seen
                mail.store(uid, "+FLAGS", "\\Seen")
            mail.logout()
            return results

        replies = await asyncio.get_event_loop().run_in_executor(None, _fetch)
        for r in replies:
            lead = await db.leads.find_one({"email": r["from"]})
            if not lead:
                continue
            await db.communications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": lead.get("user_id"),
                "lead_id": lead["id"],
                "channel": "EMAIL",
                "direction": "INBOUND",
                "subject": r["subject"],
                "content": r["body"],
                "status": "RECEIVED",
                "sent_at": now_utc().isoformat(),
            })
            if lead.get("status") in ("NEW", "CONTACTED"):
                await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "INTERESTED"}})
        if replies:
            logger.info("IMAP poll: processed %d email replies", len(replies))
    except Exception:
        logger.exception("IMAP poll failed")


async def _send_forecast_alerts_tick():
    """Hourly tick: for each workspace, check if it's their preferred hour AND
    they have daily_check or weekly_digest enabled. Fire alerts accordingly."""
    now = now_utc()
    current_hour = now.hour
    is_monday = now.weekday() == 0
    cursor = db.alert_preferences.find({"hour_utc": current_hour}, {"_id": 0})
    async for prefs in cursor:
        try:
            user = await db.users.find_one({"workspace_id": prefs["user_id"]}, {"_id": 0}) \
                or await db.users.find_one({"id": prefs["user_id"]}, {"_id": 0})
            if not user:
                continue
            if prefs.get("weekly_digest") and is_monday:
                await _send_forecast_alert(user, kind="weekly", force=True)
            elif prefs.get("daily_check"):
                await _send_forecast_alert(user, kind="daily", force=False)
        except Exception:
            logger.exception("Forecast alert tick failed for user_id=%s", prefs.get("user_id"))



async def _publish_due_schedules_tick():
    """Every 5 minutes: pick up any PENDING schedules whose scheduled_at <= now, publish them."""
    now_iso = now_utc().isoformat()
    cursor = db.content_schedules.find({"status": "PENDING", "scheduled_at": {"$lte": now_iso}}, {"_id": 0}).limit(50)
    items = await cursor.to_list(50)
    for sched in items:
        try:
            await _publish_scheduled(sched)
        except Exception:
            logger.exception("Auto-publish failed for schedule %s", sched.get("id"))


async def _daily_auto_content_tick():
    """Once per hour: for each active workspace whose autocontent_hour matches, generate a daily content kit."""
    now = now_utc()
    cursor = db.alert_preferences.find(
        {"hour_utc": now.hour, "auto_daily_content": True}, {"_id": 0},
    )
    async for prefs in cursor:
        try:
            wid = prefs["user_id"]
            user = await db.users.find_one({"workspace_id": wid}, {"_id": 0}) \
                or await db.users.find_one({"id": wid}, {"_id": 0})
            if not user:
                continue
            # Skip if a kit already generated today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            existing = await db.content_kits.count_documents({
                "user_id": wid, "generated_at": {"$gte": today_start},
            })
            if existing:
                continue
            try:
                await content_generate(user=user)
                # Fire notification
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": wid,
                    "type": "auto_content",
                    "severity": "info",
                    "title": "Daily content kit ready",
                    "body": "AI generated today's blog + social + SEO. Open Content Studio to review or auto-schedule.",
                    "link": "/content",
                    "read": False,
                    "created_at": now_utc().isoformat(),
                })
            except HTTPException:
                continue
        except Exception:
            logger.exception("Auto-content tick failed for prefs=%s", prefs.get("user_id"))


async def _send_daily_briefings():
    """For every user opted in, generate today's briefing and email it."""
    current_hour = now_utc().hour
    cursor = db.users.find({"briefing_daily_email": True, "briefing_hour_utc": current_hour}, {"_id": 0})
    async for u in cursor:
        try:
            # Generate briefing inline (simulate the request)
            from types import SimpleNamespace
            user_with_ws = {**u, "workspace_id": u.get("workspace_id") or u["id"]}
            uid = ws(user_with_ws)
            profile = await db.business_profiles.find_one({"user_id": uid}, {"_id": 0}) or {}
            period_start = now_utc() - timedelta(days=7)
            new_leads = await db.leads.count_documents({"user_id": uid, "created_at": {"$gte": period_start.isoformat()}})
            sent_campaigns = await db.campaigns.count_documents({"user_id": uid, "status": "SENT", "sent_at": {"$gte": period_start.isoformat()}})
            pending = await db.approvals.count_documents({"user_id": uid, "status": "PENDING"})
            metrics_text = f"Last 7 days: {new_leads} new leads, {sent_campaigns} campaigns, {pending} pending approvals."
            prompt = (
                f"Write a brief daily growth briefing for the founder of {profile.get('business_name','Unknown')}. "
                f"Industry: {profile.get('industry','')}. METRICS: {metrics_text} "
                f"Output STRICT JSON: {{headline, wins (3), risks (3), actions (3)}}."
            )
            raw = await asyncio.get_event_loop().run_in_executor(
                None, _groq_chat, prompt, "You are a no-nonsense growth advisor. Output strict JSON.", True, 800, 0.5,
            )
            import json
            briefing = json.loads(raw)
            html = f"""
            <h2>{profile.get('business_name', 'Your')} — Daily Growth Briefing</h2>
            <p style="font-size:18px;font-weight:600">{briefing.get('headline','')}</p>
            <h3>Wins</h3><ul>{''.join(f'<li>{w}</li>' for w in briefing.get('wins',[]))}</ul>
            <h3>Risks</h3><ul>{''.join(f'<li>{r}</li>' for r in briefing.get('risks',[]))}</ul>
            <h3>Actions Today</h3><ol>{''.join(f'<li>{a}</li>' for a in briefing.get('actions',[]))}</ol>
            <hr/><p style="color:#71717A;font-size:12px">Sent by ZeroMark AI · {now_utc().strftime('%b %d, %Y')}</p>
            """
            await asyncio.get_event_loop().run_in_executor(
                None, _send_email_sync, u["email"], "Your Daily Growth Briefing", html
            )
            await db.briefings.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "briefing": briefing,
                "metrics": {"new_leads_7d": new_leads, "sent_campaigns_7d": sent_campaigns, "pending_approvals": pending},
                "generated_at": now_utc().isoformat(), "delivered_via_email": True,
            })
            logger.info("Daily briefing emailed to %s", u["email"])
        except Exception:
            logger.exception("Daily briefing failed for %s", u.get("email"))


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index([("user_id", 1), ("created_at", -1)])
    await db.campaigns.create_index([("user_id", 1), ("created_at", -1)])
    await db.approvals.create_index([("user_id", 1), ("status", 1)])
    await db.ai_calls.create_index([("user_id", 1), ("ts", -1)])
    await db.ai_calls.create_index("ts", expireAfterSeconds=7200)
    await db.landing_pages.create_index("slug", unique=True)
    await db.landing_pages.create_index([("user_id", 1), ("created_at", -1)])
    try:
        await db.login_attempts.create_index("last_attempt", expireAfterSeconds=3600)
    except Exception:
        pass
    try:
        await db.oauth_states.create_index("created_at", expireAfterSeconds=600)
    except Exception:
        pass

    # Migration: backfill workspace_id = user_id on users
    await db.users.update_many({"workspace_id": {"$exists": False}}, [{"$set": {"workspace_id": "$id"}}])

    # Recovery sweep
    cutoff = (now_utc() - timedelta(minutes=5)).isoformat()
    stuck = await db.campaigns.update_many(
        {"status": "SENDING", "started_at": {"$lt": cutoff}},
        {"$set": {"status": "FAILED", "failure_reason": "Recovered after pod restart"}},
    )
    if stuck.modified_count:
        logger.info("Recovery sweep marked %d stuck campaigns as FAILED", stuck.modified_count)

    # Schedule cron jobs: hourly daily-briefing tick + IMAP poll every 3 min + hourly forecast alerts tick
    scheduler.add_job(_send_daily_briefings, "cron", minute=0, id="daily_briefings", replace_existing=True)
    scheduler.add_job(_imap_poll_inbound_emails, "interval", minutes=3, id="imap_poll", replace_existing=True)
    scheduler.add_job(_send_forecast_alerts_tick, "cron", minute=5, id="forecast_alerts", replace_existing=True)
    scheduler.add_job(_publish_due_schedules_tick, "interval", minutes=5, id="auto_publish", replace_existing=True)
    scheduler.add_job(_daily_auto_content_tick, "cron", minute=10, id="auto_daily_content", replace_existing=True)
    scheduler.start()
    logger.info("APScheduler started: daily_briefings + imap_poll + forecast_alerts + auto_publish + auto_daily_content")
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
            "workspace_id": uid,
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
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    client.close()
