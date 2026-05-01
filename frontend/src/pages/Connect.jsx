import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    LinkedinLogo, TwitterLogo, FacebookLogo, InstagramLogo, EnvelopeSimple,
    WhatsappLogo, ChatCircle, CurrencyDollar, MegaphoneSimple, CheckCircle,
    WarningCircle, XCircle, ArrowSquareOut, Lock, Plug, ArrowsClockwise,
    CaretDown, CaretRight, Sparkle,
} from "@phosphor-icons/react";

/* ---------- Channel registry ----------
   Tier 1: User OAuth (the few-minute setup)
   Tier 2: Platform-wide (env-managed, info only)
*/
const TIER1_OAUTH = [
    {
        id: "linkedin", label: "LinkedIn", icon: LinkedinLogo, brand: "#0A66C2",
        why: "B2B gold — every published post can reach thousands of decision-makers organically.",
        steps: [
            { title: "Create a LinkedIn Developer App", url: "https://www.linkedin.com/developers/apps", note: "Click 'Create app' — link it to a Company Page you own." },
            { title: "Add the 'Sign In with LinkedIn using OpenID Connect' product", url: "https://www.linkedin.com/developers/apps", note: "Auto-approved." },
            { title: "Add the 'Share on LinkedIn' product", url: "https://www.linkedin.com/developers/apps", note: "Auto-approved instantly. This unlocks publishing." },
            { title: "Authorized redirect URL", url: null, note: "Add: <REPLACE WITH YOUR APP URL>/api/oauth/linkedin/callback" },
            { title: "Copy Client ID + Secret to backend .env", url: null, note: "LINKEDIN_CLIENT_ID=… and LINKEDIN_CLIENT_SECRET=…" },
        ],
        connect_btn: "Connect with LinkedIn",
    },
    {
        id: "twitter", label: "X (Twitter)", icon: TwitterLogo, brand: "#0F172A",
        why: "Schedule + auto-publish high-frequency social posts. Real-time tweet via API.",
        steps: [
            { title: "Create a Twitter Developer Project", url: "https://developer.twitter.com/en/portal/projects-and-apps", note: "Free tier supports OAuth 2.0 + posting." },
            { title: "Set OAuth 2.0 with PKCE; type = Web App", url: null, note: "User authentication settings → enable OAuth 2.0." },
            { title: "Callback URL", url: null, note: "<APP URL>/api/oauth/twitter/callback" },
            { title: "Required scopes", url: null, note: "tweet.read, tweet.write, users.read, offline.access" },
            { title: "Paste Client ID + Secret to backend .env", url: null, note: "TWITTER_CLIENT_ID=… and TWITTER_CLIENT_SECRET=…" },
        ],
        connect_btn: "Connect with X",
    },
    {
        id: "facebook", label: "Facebook Pages", icon: FacebookLogo, brand: "#1877F2",
        why: "Publish to your Facebook Page reach. Required for Instagram + Meta Ads too.",
        steps: [
            { title: "Create a Meta Developer App", url: "https://developers.facebook.com/apps/", note: "Type: Business → assign to your Business Manager." },
            { title: "Add 'Facebook Login for Business' product", url: null, note: "Configure → set login mode to 'OAuth'." },
            { title: "Add permissions in App Review", url: null, note: "pages_show_list, pages_manage_posts, pages_read_engagement, instagram_content_publish, business_management" },
            { title: "Valid OAuth redirect URI", url: null, note: "<APP URL>/api/oauth/facebook/callback" },
            { title: "Paste App ID + Secret to backend .env", url: null, note: "FACEBOOK_APP_ID=… and FACEBOOK_APP_SECRET=…" },
        ],
        connect_btn: "Connect with Facebook",
    },
    {
        id: "instagram", label: "Instagram Business", icon: InstagramLogo, brand: "#E4405F",
        why: "Schedule organic Instagram posts. Inherits authentication from your Facebook Page.",
        steps: [
            { title: "You need an Instagram Business or Creator account", url: "https://help.instagram.com/502981923235522", note: "Convert in IG settings if you have a personal account." },
            { title: "Link IG to a Facebook Page in Meta Business Suite", url: "https://business.facebook.com/", note: "Settings → Accounts → Instagram Accounts → Add." },
            { title: "Connect Facebook above", url: null, note: "ZeroMark auto-detects the linked IG Business account." },
        ],
        connect_btn: null, // inherits via Facebook
    },
    {
        id: "meta_ads", label: "Meta Ads (paid)", icon: MegaphoneSimple, brand: "#000",
        why: "Run REAL Facebook + Instagram ad campaigns inside ZeroMark with capped budgets.",
        steps: [
            { title: "Verify Facebook Business Manager + Ad Account", url: "https://business.facebook.com/", note: "Add a payment method (card / UPI auto-debit)." },
            { title: "Add 'Marketing API' product to your Meta App", url: "https://developers.facebook.com/apps/", note: "Same app you used for Facebook Pages above." },
            { title: "Generate System User token (long-lived)", url: "https://business.facebook.com/settings/system-users/", note: "Scope: ads_management + ads_read." },
            { title: "Get your Ad Account ID", url: "https://business.facebook.com/settings/ad-accounts/", note: "Format: act_1234567890" },
            { title: "Add to backend .env", url: null, note: "META_ACCESS_TOKEN=… META_AD_ACCOUNT_ID=act_… META_ADS_MOCK_MODE=false" },
        ],
        connect_btn: null, // env-only for now (Phase 3)
        coming_soon: "Phase 3 — backend wiring landing next session",
    },
];

const TIER2_PLATFORM = [
    { id: "gmail", label: "Email · Gmail SMTP+IMAP", icon: EnvelopeSimple, brand: "#EA4335",
      detail: "Live out of the box for the platform owner — uses GMAIL_SENDER_EMAIL + GMAIL_APP_PASSWORD env keys for sending and IMAP polling for inbound replies." },
    { id: "twilio_sms", label: "SMS · Twilio", icon: ChatCircle, brand: "#F22F46",
      detail: "Live for OTP login + SMS broadcasts. Configure TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER in env." },
    { id: "twilio_whatsapp", label: "WhatsApp · Twilio", icon: WhatsappLogo, brand: "#25D366",
      detail: "Sandbox mode by default — recipients join via Twilio's join code. For production, get WhatsApp Business API approval." },
    { id: "razorpay", label: "Payments · Razorpay", icon: CurrencyDollar, brand: "#3395FF",
      detail: "Powers wallet auto-recharge + subscription checkout. Currently in TEST MODE — swap to live keys for production." },
];

const STATUS_PILL = (s) => {
    if (s?.healthy) return { cls: "bg-[#10B981] text-white", icon: CheckCircle, label: "Live" };
    if (s?.connected) return { cls: "bg-[#F59E0B] text-white", icon: WarningCircle, label: s.status_label || "Stale" };
    return { cls: "bg-[#F8FAFC] text-[#71717A] border border-[#E2E8F0]", icon: XCircle, label: "Not connected" };
};

export default function Connect() {
    const [params] = useSearchParams();
    const [health, setHealth] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [openGuide, setOpenGuide] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await api.get("/integrations/health");
            setHealth(r.data.channels || {});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Acknowledge OAuth callback redirect
    useEffect(() => {
        const connected = params.get("connected");
        if (connected) {
            toast.success(`${connected} connected · running health check…`);
            setTimeout(load, 600);
        }
        // eslint-disable-next-line
    }, []);

    const refresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
        toast.success("Connection health refreshed");
    };

    const startOauth = async (provider) => {
        try {
            const r = await api.get(`/oauth/${provider}/start`);
            window.location.href = r.data.auth_url;
        } catch (e) {
            toast.error(e.response?.data?.detail || `${provider} OAuth not configured. Add Client ID/Secret to backend .env first.`);
        }
    };

    const disconnect = async (provider) => {
        if (!window.confirm(`Disconnect ${provider}?`)) return;
        try {
            await api.delete(`/integrations/${provider}`);
            toast.success(`${provider} disconnected`);
            load();
        } catch {
            toast.error("Disconnect failed");
        }
    };

    const liveCount = Object.values(health).filter((c) => c.healthy).length;
    const totalCount = Object.keys(health).length || 9;

    return (
        <div data-testid="connect-page">
            <PageHeader
                eyebrow="// Channel hub"
                title="Connect real channels"
                subtitle="A few minutes here = real campaigns, real posts, real leads. ZeroMark stays organic-first; paid is opt-in."
                action={
                    <button onClick={refresh} disabled={refreshing} className="zm-btn-dark" data-testid="connect-refresh">
                        <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Checking…" : "Refresh status"}
                    </button>
                }
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
                {/* Hero status */}
                <div className="zm-card p-6 bg-[#0F172A] text-white" data-testid="connect-hero">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold">// Live channels</p>
                            <h2 className="font-display text-3xl font-black tracking-tighter mt-1">{liveCount} of {totalCount} channels live</h2>
                            <p className="text-sm text-white/70 mt-1 max-w-xl">
                                Each channel below is verified with a live API call — green means we can actually post / send / charge through it right now.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                            <Lock size={12} weight="bold" /> All tokens stored encrypted at rest (Fernet AES-128)
                        </div>
                    </div>
                </div>

                {/* Tier 1 — OAuth user channels */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A]">Your accounts (5-minute setup)</h3>
                        <p className="text-xs text-[#71717A]">OAuth — no copy-paste of tokens needed</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4" data-testid="tier1-cards">
                        {TIER1_OAUTH.map((c) => {
                            const s = health[c.id] || {};
                            const pill = STATUS_PILL(s);
                            const isOpen = openGuide === c.id;
                            return (
                                <div key={c.id} className="zm-card p-6" data-testid={`channel-${c.id}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 flex items-center justify-center rounded-sm" style={{ background: c.brand }}>
                                                <c.icon size={20} weight="fill" className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-display text-lg font-bold tracking-tight">{c.label}</h4>
                                                {s.account_label ? (
                                                    <p className="text-xs text-[#71717A]">{s.account_label}</p>
                                                ) : (
                                                    <p className="text-xs text-[#71717A]">{c.why.split(".")[0]}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`zm-badge ${pill.cls}`} data-testid={`status-${c.id}`}>
                                            <pill.icon size={10} weight="bold" /> {pill.label}
                                        </span>
                                    </div>

                                    {s.message && (
                                        <p className={`text-xs mt-3 leading-relaxed ${s.healthy ? "text-[#10B981]" : "text-[#71717A]"}`}>
                                            {s.message}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {c.connect_btn && !c.coming_soon && (
                                            <button
                                                onClick={() => startOauth(c.id)}
                                                style={{ background: c.brand }}
                                                className="zm-btn-primary text-xs py-2"
                                                data-testid={`connect-${c.id}`}
                                            >
                                                <c.icon size={14} weight="fill" /> {s.connected ? `Reconnect` : c.connect_btn}
                                            </button>
                                        )}
                                        {s.connected && c.connect_btn && (
                                            <button onClick={() => disconnect(c.id)} className="zm-btn-secondary text-xs py-2 text-[#DC2626]" data-testid={`disconnect-${c.id}`}>
                                                Disconnect
                                            </button>
                                        )}
                                        {c.coming_soon && (
                                            <span className="zm-badge bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D]">
                                                <Sparkle size={10} weight="fill" /> {c.coming_soon}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setOpenGuide(isOpen ? null : c.id)}
                                            className="zm-btn-secondary text-xs py-2"
                                            data-testid={`guide-toggle-${c.id}`}
                                        >
                                            {isOpen ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
                                            {isOpen ? "Hide setup guide" : "Setup guide"}
                                        </button>
                                    </div>

                                    {isOpen && (
                                        <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3" data-testid={`guide-${c.id}`}>
                                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold">// Why this channel</p>
                                            <p className="text-xs text-[#0F172A]">{c.why}</p>
                                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold pt-2">// Step-by-step</p>
                                            <ol className="space-y-2.5">
                                                {c.steps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-2.5 text-xs">
                                                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                                        <div className="flex-1">
                                                            <p className="text-[#0F172A] font-bold">
                                                                {step.title}
                                                                {step.url && (
                                                                    <a href={step.url} target="_blank" rel="noreferrer" className="ml-1.5 text-[#2563EB] inline-flex items-center gap-0.5 hover:underline">
                                                                        Open <ArrowSquareOut size={10} weight="bold" />
                                                                    </a>
                                                                )}
                                                            </p>
                                                            {step.note && <p className="text-[#71717A] mt-0.5 break-words">{step.note}</p>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tier 2 — Platform-wide channels */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A]">Platform-wide channels</h3>
                        <p className="text-xs text-[#71717A]">Configured by ZeroMark · all users share these</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="tier2-cards">
                        {TIER2_PLATFORM.map((c) => {
                            const s = health[c.id] || {};
                            const pill = STATUS_PILL(s);
                            return (
                                <div key={c.id} className="zm-card p-5" data-testid={`channel-${c.id}`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 flex items-center justify-center rounded-sm" style={{ background: c.brand }}>
                                            <c.icon size={18} weight="fill" className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-display text-sm font-bold tracking-tight truncate">{c.label}</h4>
                                            <span className={`zm-badge text-[9px] ${pill.cls}`}>
                                                <pill.icon size={9} weight="bold" /> {pill.label}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-[#71717A] leading-relaxed">{c.detail}</p>
                                    {s.account_label && (
                                        <p className="text-[10px] text-[#0F172A] mt-2 font-mono break-all">{s.account_label}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA */}
                <div className="zm-card p-6 bg-gradient-to-br from-[#DBEAFE] to-white border-l-4 border-[#2563EB]">
                    <p className="zm-section-label mb-1">// What's next</p>
                    <p className="text-sm text-[#0F172A] leading-relaxed">
                        Once at least one social channel shows <span className="text-[#10B981] font-bold">Live</span>, your scheduled posts in <a href="/schedule" className="text-[#2563EB] underline">Auto-publish</a> will go out for real.
                        Need help? Tap the <span className="font-bold">ZeroMark Guide</span> chatbot bottom-right.
                    </p>
                </div>
            </div>
        </div>
    );
}
