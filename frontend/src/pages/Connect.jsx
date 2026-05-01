import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import FacebookPagePicker from "@/components/FacebookPagePicker";
import MetaAdsBindForm from "@/components/MetaAdsBindForm";
import HunterBindForm from "@/components/HunterBindForm";
import GooglePlacesBindForm from "@/components/GooglePlacesBindForm";
import { useAuth } from "@/context/AuthContext";
import {
    LinkedinLogo, TwitterLogo, FacebookLogo, InstagramLogo, EnvelopeSimple,
    WhatsappLogo, ChatCircle, CurrencyDollar, MegaphoneSimple, CheckCircle,
    WarningCircle, XCircle, Lock, ArrowsClockwise, Sparkle, Crown, PaperPlaneTilt,
} from "@phosphor-icons/react";

/* User-facing channels — NO developer-app setup steps. Users just OAuth.
   The platform owner registers Developer Apps ONCE on /admin/platform-setup. */
const TIER1_OAUTH = [
    {
        id: "linkedin", label: "LinkedIn", icon: LinkedinLogo, brand: "#0A66C2",
        why: "Reach decision-makers organically. Every post can hit thousands of B2B prospects.",
        connect_btn: "Connect with LinkedIn",
    },
    {
        id: "twitter", label: "X (Twitter)", icon: TwitterLogo, brand: "#0F172A",
        why: "Schedule + auto-post high-frequency content. Real-time tweet via API.",
        connect_btn: "Connect with X",
    },
    {
        id: "facebook", label: "Facebook Pages", icon: FacebookLogo, brand: "#1877F2",
        why: "Publish to your Facebook Page reach. Required for Instagram + Meta Ads too.",
        connect_btn: "Connect with Facebook",
    },
    {
        id: "instagram", label: "Instagram Business", icon: InstagramLogo, brand: "#E4405F",
        why: "Schedule organic Instagram posts. Inherits authentication from your Facebook Page.",
        connect_btn: null, // inherits from Facebook
        inherit_from: "facebook",
    },
    {
        id: "meta_ads", label: "Meta Ads (paid)", icon: MegaphoneSimple, brand: "#000",
        why: "Run REAL Facebook + Instagram ad campaigns inside ZeroMark with capped daily budgets.",
        connect_btn: null,
        custom: "meta_ads_form",
    },
];

const TIER2_PLATFORM = [
    { id: "gmail", label: "Email · Gmail SMTP+IMAP", icon: EnvelopeSimple, brand: "#EA4335",
      detail: "Already live. We send your campaigns from the platform inbox and auto-pull replies into your CRM." },
    { id: "twilio_sms", label: "SMS · Twilio", icon: ChatCircle, brand: "#F22F46",
      detail: "Already live. Powers OTP sign-in + outbound SMS campaigns." },
    { id: "twilio_whatsapp", label: "WhatsApp · Twilio", icon: WhatsappLogo, brand: "#25D366",
      detail: "Sandbox mode for now — recipients join via Twilio code. Production WhatsApp Business API approval underway." },
    { id: "razorpay", label: "Payments · Razorpay", icon: CurrencyDollar, brand: "#3395FF",
      detail: "Already live in test mode. Powers wallet auto-recharge + subscription checkout." },
];

const STATUS_PILL = (s) => {
    if (s?.healthy) return { cls: "bg-[#10B981] text-white", icon: CheckCircle, label: "Live" };
    if (s?.connected) return { cls: "bg-[#F59E0B] text-white", icon: WarningCircle, label: s.status_label || "Stale" };
    if (s && s.provider_configured === false) return { cls: "bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D]", icon: Crown, label: "Awaiting platform setup" };
    return { cls: "bg-[#F8FAFC] text-[#71717A] border border-[#E2E8F0]", icon: XCircle, label: "Not connected" };
};

export default function Connect() {
    const { user } = useAuth();
    const [params] = useSearchParams();
    const [health, setHealth] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await api.get("/integrations/health");
            setHealth(r.data.channels || {});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

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
            toast.error(e.response?.data?.detail || `${provider} OAuth not configured yet — ask your platform admin to register the Developer App.`);
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
    const isAdmin = user?.role === "admin";
    const platformPending = TIER1_OAUTH.some((c) => health[c.id]?.provider_configured === false);
    const platformReady = TIER1_OAUTH.filter((c) => health[c.id]?.provider_configured === true).map((c) => c.label);

    return (
        <div data-testid="connect-page">
            <PageHeader
                eyebrow="// Channel hub"
                title="Connect your accounts"
                subtitle="Click Connect, OAuth in 30 seconds, your scheduled posts go out for real. No copy-paste of tokens."
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
                                Each channel is verified with a live API call. Green means we can actually post / send / charge through it right now.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                            <Lock size={12} weight="bold" /> Tokens encrypted at rest (Fernet AES-128)
                        </div>
                    </div>
                </div>

                {/* Ready-to-use callout — makes it loud that Email + SMS + WhatsApp work TODAY */}
                <div className="zm-card p-5 bg-gradient-to-r from-[#10B981]/10 to-[#2563EB]/10 border-l-4 border-[#10B981]" data-testid="ready-now-banner">
                    <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex items-center gap-2 shrink-0">
                            <CheckCircle size={24} weight="fill" className="text-[#10B981]" />
                            <p className="font-display text-xl font-black tracking-tight text-[#0F172A]">Ready to run campaigns right now</p>
                        </div>
                        <div className="flex-1 min-w-[280px]">
                            <p className="text-sm text-[#0F172A] font-semibold mb-1">
                                Email · SMS · WhatsApp are live and real. No setup needed.
                            </p>
                            <p className="text-xs text-[#475569] leading-relaxed">
                                Start with what's working. Your first campaign can go out in under 2 minutes.
                                Social channels (LinkedIn / FB / IG / X) unlock once Developer Apps are registered below.
                            </p>
                        </div>
                        <Link to="/campaigns" className="zm-btn-primary shrink-0" data-testid="go-to-campaigns">
                            <PaperPlaneTilt size={14} weight="fill" /> Create Campaign
                        </Link>
                    </div>
                </div>

                {/* User-friendly notice — adapts to partial platform readiness */}
                {!isAdmin && platformPending && (
                    <div className="zm-card p-5 border-l-4 border-[#2563EB] bg-[#EFF6FF]" data-testid="user-platform-pending">
                        <div className="flex items-start gap-3">
                            <WarningCircle size={20} weight="fill" className="text-[#2563EB] mt-0.5" />
                            <div className="flex-1">
                                {platformReady.length > 0 ? (
                                    <>
                                        <p className="font-bold text-[#0F172A]">{platformReady.join(" + ")} ready · others rolling out</p>
                                        <p className="text-sm text-[#475569] mt-0.5 leading-relaxed">
                                            <strong>{platformReady.join(", ")}</strong> {platformReady.length > 1 ? "are" : "is"} live — click their <span className="font-semibold">Connect</span> button below to OAuth in 30 sec. Other providers will unlock as our platform team registers their Developer Apps.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold text-[#0F172A]">Social channels are coming soon</p>
                                        <p className="text-sm text-[#475569] mt-0.5 leading-relaxed">
                                            LinkedIn, Facebook, Instagram, and X are being set up by our platform team. <strong>Meanwhile, you can already run Email + SMS + WhatsApp campaigns today</strong> — no connection needed. Head to <Link to="/campaigns" className="underline font-semibold text-[#2563EB]">Campaigns</Link> and pick Email or SMS.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin notice if platform setup is pending */}
                {isAdmin && platformPending && (
                    <div className="zm-card p-5 border-l-4 border-[#F59E0B] bg-[#FFFBEB]" data-testid="admin-platform-pending">
                        <div className="flex items-start gap-3">
                            <Crown size={20} weight="fill" className="text-[#F59E0B] mt-0.5" />
                            <div className="flex-1">
                                <p className="font-bold text-[#92400E]">Some providers aren't set up yet</p>
                                <p className="text-sm text-[#78350F] mt-0.5">
                                    As the platform owner, you register a Developer App once per provider. Every customer then OAuths in 30 sec — no setup work for them.
                                </p>
                                <Link to="/admin/platform-setup" className="zm-btn-primary text-xs py-1.5 mt-3 inline-flex" data-testid="admin-setup-link">
                                    <Crown size={12} weight="fill" /> Open Platform Setup
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tier 1 — User OAuth */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A]">Your accounts</h3>
                        <p className="text-xs text-[#71717A]">30-second OAuth · no developer setup needed</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4" data-testid="tier1-cards">
                        {TIER1_OAUTH.map((c) => {
                            const s = health[c.id] || {};
                            const pill = STATUS_PILL(s);
                            const blocked = s.provider_configured === false;
                            const inheritsFrom = c.inherit_from && health[c.inherit_from]?.healthy === false;
                            return (
                                <div key={c.id} className="zm-card p-6" data-testid={`channel-${c.id}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 flex items-center justify-center rounded-sm" style={{ background: c.brand }}>
                                                <c.icon size={20} weight="fill" className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-display text-lg font-bold tracking-tight">{c.label}</h4>
                                                <p className="text-xs text-[#71717A]">{c.why.split(".")[0]}.</p>
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
                                        {c.connect_btn && !c.coming_soon && !blocked && (
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
                                        {inheritsFrom && (
                                            <span className="zm-badge bg-[#F8FAFC] text-[#71717A]">
                                                Connect Facebook above first
                                            </span>
                                        )}
                                        {blocked && !isAdmin && (
                                            <span className="zm-badge bg-[#FFFBEB] text-[#92400E]">
                                                Coming soon — platform team setting this up
                                            </span>
                                        )}
                                    </div>

                                    {c.id === "facebook" && s.connected && <FacebookPagePicker onChange={load} />}
                                    {c.id === "meta_ads" && <MetaAdsBindForm status={s} onChange={load} />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tier 2 — Platform-wide */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A]">Already wired for you</h3>
                        <p className="text-xs text-[#71717A]">ZeroMark handles these globally</p>
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
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tier 3 — Power-ups (per-user paid services) */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A]">Power-ups (optional)</h3>
                        <p className="text-xs text-[#71717A]">Bring your own keys for premium data sources</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4" data-testid="tier3-cards">
                        <HunterBindForm />
                        <GooglePlacesBindForm />
                    </div>
                </div>

                {/* CTA */}
                <div className="zm-card p-6 bg-gradient-to-br from-[#DBEAFE] to-white border-l-4 border-[#2563EB]">
                    <p className="zm-section-label mb-1">// What's next</p>
                    <p className="text-sm text-[#0F172A] leading-relaxed">
                        Once at least one social channel shows <span className="text-[#10B981] font-bold">Live</span>, your scheduled posts in <Link to="/schedule" className="text-[#2563EB] underline">Auto-publish</Link> will go out for real.
                        Need help? Tap the <span className="font-bold">ZeroMark Guide</span> chatbot bottom-right.
                    </p>
                </div>
            </div>
        </div>
    );
}
