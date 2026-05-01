import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    CheckCircle, XCircle, ArrowSquareOut, Copy, Crown, Sparkle, Lock,
    LinkedinLogo, TwitterLogo, FacebookLogo, FloppyDisk, Trash, Database,
} from "@phosphor-icons/react";

const PROVIDER_ICONS = {
    linkedin: LinkedinLogo,
    twitter: TwitterLogo,
    meta: FacebookLogo,
};

const SETUP_STEPS = {
    linkedin: [
        { title: "Create a LinkedIn Developer App", url: "https://www.linkedin.com/developers/apps", note: "Click 'Create app' → link to a Company Page you control." },
        { title: "Add 'Sign In with LinkedIn using OpenID Connect' product", url: "https://www.linkedin.com/developers/apps", note: "Auto-approved." },
        { title: "Add 'Share on LinkedIn' product", url: null, note: "Auto-approved instantly. Required for posting." },
        { title: "Add Authorized redirect URL", url: null, note: "Use the callback URL shown below." },
        { title: "Paste Client ID + Secret in the form below", url: null, note: "Saves instantly — no backend restart needed." },
        { title: "Done! All customers can now Connect with LinkedIn", url: null, note: "Every customer OAuths in 30 sec through your app." },
    ],
    twitter: [
        { title: "Create a Twitter Developer Project", url: "https://developer.twitter.com/en/portal/projects-and-apps", note: "Free tier supports OAuth 2.0 + posting." },
        { title: "Set up User authentication", url: null, note: "OAuth 2.0 with PKCE · type 'Web App'" },
        { title: "Set Callback URL + Website URL", url: null, note: "Callback shown below." },
        { title: "Required scopes", url: null, note: "tweet.read, tweet.write, users.read, offline.access" },
        { title: "Paste Client ID + Secret in the form below", url: null, note: "Saves instantly — no backend restart needed." },
    ],
    meta: [
        { title: "Create a Meta Developer App", url: "https://developers.facebook.com/apps/", note: "Type: Business → assign to your Business Manager." },
        { title: "Add 'Facebook Login for Business' product", url: null, note: "Set Login mode to 'OAuth'." },
        { title: "Add 'Marketing API' product (for Meta Ads later)", url: null, note: "Same app handles FB Pages + Instagram + Ads." },
        { title: "Request permissions in App Review", url: null, note: "pages_manage_posts, pages_read_engagement, pages_show_list, instagram_content_publish, business_management, ads_management, ads_read" },
        { title: "Add Valid OAuth Redirect URI", url: null, note: "Use the callback URL below." },
        { title: "Paste App ID + Secret in the form below", url: null, note: "Saves instantly — no backend restart needed." },
    ],
};

function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Copy failed"));
}

function CredForm({ provider, onSaved }) {
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [showSecret, setShowSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        if (!clientId.trim() || !clientSecret.trim()) {
            toast.error("Both fields are required");
            return;
        }
        setSaving(true);
        try {
            const r = await api.post("/admin/platform-setup/credentials", {
                provider: provider.id,
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
            });
            toast.success(r.data.message || `${provider.label} saved`, { duration: 6000 });
            setClientId("");
            setClientSecret("");
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Remove ${provider.label} Developer App credentials?\n\nUsers will no longer be able to Connect until you add new credentials.`)) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/platform-setup/credentials/${provider.id}`);
            toast.success(`${provider.label} credentials removed`);
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Delete failed");
        } finally {
            setDeleting(false);
        }
    };

    const idLabel = provider.field_labels?.client_id || "Client ID";
    const secretLabel = provider.field_labels?.client_secret || "Client Secret";

    return (
        <div className="border-t border-[#E2E8F0] pt-4 mb-4" data-testid={`cred-form-${provider.id}`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#0F172A] font-bold flex items-center gap-1.5">
                    <Database size={12} weight="bold" className="text-[#2563EB]" />
                    Paste credentials — saves instantly, no restart needed
                </p>
                {provider.configured && provider.source === "db" && (
                    <button onClick={remove} disabled={deleting} className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#DC2626] hover:underline flex items-center gap-1" data-testid={`remove-${provider.id}`}>
                        <Trash size={10} weight="bold" /> {deleting ? "Removing…" : "Remove saved creds"}
                    </button>
                )}
            </div>
            <form onSubmit={save} className="grid md:grid-cols-2 gap-3 bg-[#F0F9FF] border border-[#BAE6FD] p-4 rounded-md">
                <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#0F172A] font-bold mb-1">{idLabel}</label>
                    <input
                        type="text"
                        required
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder={provider.configured ? "••• already saved ··· paste to replace" : "paste here"}
                        className="w-full text-xs font-mono px-3 py-2 border border-[#CBD5E1] rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
                        data-testid={`${provider.id}-client-id`}
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#0F172A] font-bold mb-1">{secretLabel}</label>
                    <div className="relative">
                        <input
                            type={showSecret ? "text" : "password"}
                            required
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder={provider.configured ? "••• already saved ··· paste to replace" : "paste here"}
                            className="w-full text-xs font-mono px-3 py-2 pr-14 border border-[#CBD5E1] rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
                            data-testid={`${provider.id}-client-secret`}
                        />
                        <button type="button" onClick={() => setShowSecret((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-[#2563EB] font-bold">
                            {showSecret ? "Hide" : "Show"}
                        </button>
                    </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                    <button type="submit" disabled={saving} className="zm-btn-primary" data-testid={`save-${provider.id}`}>
                        <FloppyDisk size={14} weight="bold" /> {saving ? "Saving…" : (provider.configured ? "Replace credentials" : "Save & activate")}
                    </button>
                    <p className="text-[11px] text-[#475569] leading-tight flex-1">
                        <Lock size={11} weight="bold" className="inline mr-1 text-[#10B981]" />
                        Secret is encrypted with Fernet AES-128 before storage. Server never logs it.
                    </p>
                </div>
            </form>
        </div>
    );
}

export default function AdminPlatformSetup() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        api.get("/admin/platform-setup")
            .then((r) => setData(r.data))
            .catch((e) => toast.error(e.response?.data?.detail || "Failed to load"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) return <div className="p-8 text-[#A1A1AA]">Loading…</div>;
    if (!data) return null;

    return (
        <div data-testid="admin-platform-setup">
            <PageHeader
                eyebrow="// Platform owner · one-time setup"
                title="Platform setup"
                subtitle={`${data.configured_count} of ${data.total_providers} providers ready · After this, customers OAuth themselves in 30 sec.`}
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Hero */}
                <div className="zm-card p-6 bg-[#0F172A] text-white border-l-4 border-[#F59E0B]">
                    <div className="flex items-start gap-3">
                        <Crown size={24} weight="fill" className="text-[#F59E0B] mt-0.5" />
                        <div>
                            <h2 className="font-display text-2xl font-black tracking-tighter">One Developer App per provider serves all your customers.</h2>
                            <p className="text-sm text-white/70 mt-1.5 max-w-2xl leading-relaxed">
                                You register a LinkedIn / X / Meta app ONCE. Every customer then clicks "Connect with LinkedIn" and OAuths their own account through your app — no setup work for them, ever. Your app can serve thousands of customers.
                            </p>
                            <div className="flex items-center gap-4 mt-4 text-xs text-white/60">
                                <span className="flex items-center gap-1"><Lock size={12} weight="bold" /> All tokens encrypted at rest</span>
                                <span>·</span>
                                <span>Rate limits scale with platform tier</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Provider cards */}
                {data.providers.map((p) => {
                    const Icon = PROVIDER_ICONS[p.id] || Sparkle;
                    const steps = SETUP_STEPS[p.id] || [];
                    return (
                        <div key={p.id} className="zm-card p-6" data-testid={`provider-${p.id}`}>
                            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 flex items-center justify-center bg-[#0F172A] rounded-sm">
                                        <Icon size={22} weight="fill" className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-display text-xl font-bold tracking-tight">{p.label}</h3>
                                        <p className="text-xs text-[#71717A]">{p.covers_users}</p>
                                    </div>
                                </div>
                                <span className={`zm-badge ${p.configured ? "bg-[#10B981] text-white" : "bg-[#F8FAFC] text-[#71717A] border border-[#E2E8F0]"}`}>
                                    {p.configured ? <CheckCircle size={11} weight="fill" /> : <XCircle size={11} weight="fill" />}
                                    {p.configured ? "Configured" : "Not configured"}
                                </span>
                            </div>

                            {/* Quick reference */}
                            <div className="grid md:grid-cols-2 gap-3 mb-5 text-xs">
                                <div className="bg-[#F8FAFC] p-3 rounded-sm border border-[#E2E8F0]">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-1">// Callback URL (paste this in their portal)</p>
                                    <div className="flex items-center gap-2">
                                        <code className="font-mono text-[11px] text-[#0F172A] break-all flex-1">{p.callback_url}</code>
                                        <button onClick={() => copyToClipboard(p.callback_url)} className="shrink-0 p-1 hover:bg-white" data-testid={`copy-callback-${p.id}`}>
                                            <Copy size={14} weight="bold" className="text-[#2563EB]" />
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-[#F8FAFC] p-3 rounded-sm border border-[#E2E8F0]">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-1">// Required scopes</p>
                                    <code className="font-mono text-[11px] text-[#0F172A] break-words">{p.scopes}</code>
                                </div>
                                <div className="bg-[#F8FAFC] p-3 rounded-sm border border-[#E2E8F0]">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-1">// Products to enable</p>
                                    <ul className="text-[11px] text-[#0F172A]">
                                        {p.products_required.map((pr) => <li key={pr}>· {pr}</li>)}
                                    </ul>
                                </div>
                                <div className="bg-[#F8FAFC] p-3 rounded-sm border border-[#E2E8F0]">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-1">// Source · Status</p>
                                    <p className="text-[11px] text-[#0F172A]">
                                        {p.configured ? (
                                            <>
                                                Active from <span className="font-bold">{p.source === "db" ? "this UI (encrypted in DB)" : "backend .env"}</span>
                                            </>
                                        ) : (
                                            <span className="text-[#92400E]">Not configured yet — paste credentials below.</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* UI Credential form — NEW: no backend .env editing required */}
                            <CredForm provider={p} onSaved={load} />

                            {/* Steps */}
                            <div className="border-t border-[#E2E8F0] pt-4">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-3">// Step-by-step ({steps.length} steps · ~10 min)</p>
                                <ol className="space-y-3">
                                    {steps.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-xs">
                                            <span className="shrink-0 w-5 h-5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                            <div className="flex-1">
                                                <p className="text-[#0F172A] font-bold">
                                                    {s.title}
                                                    {s.url && (
                                                        <a href={s.url} target="_blank" rel="noreferrer" className="ml-1.5 text-[#2563EB] inline-flex items-center gap-0.5 hover:underline">
                                                            Open <ArrowSquareOut size={10} weight="bold" />
                                                        </a>
                                                    )}
                                                </p>
                                                {s.note && <p className="text-[#71717A] mt-0.5 break-words">{s.note}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <div className="mt-4">
                                <a href={p.developer_portal} target="_blank" rel="noreferrer" className="zm-btn-primary text-xs py-2 inline-flex" data-testid={`open-portal-${p.id}`}>
                                    Open Developer Portal <ArrowSquareOut size={12} weight="bold" />
                                </a>
                            </div>
                        </div>
                    );
                })}

                {/* Services */}
                <div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-[#0F172A] mb-3">Platform services</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="services-grid">
                        {data.services.map((s) => (
                            <div key={s.id} className="zm-card p-4" data-testid={`service-${s.id}`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="text-sm font-bold text-[#0F172A]">{s.label}</h4>
                                    <span className={`zm-badge text-[9px] ${s.configured ? "bg-[#10B981] text-white" : "bg-[#F8FAFC] text-[#71717A] border border-[#E2E8F0]"}`}>
                                        {s.configured ? <CheckCircle size={9} weight="fill" /> : <XCircle size={9} weight="fill" />}
                                        {s.configured ? "Configured" : "Missing"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[#71717A] leading-relaxed">{s.purpose}</p>
                                <code className="block font-mono text-[10px] text-[#A1A1AA] mt-2 break-words">{s.env_keys.join(", ")}</code>
                                {s.is_test_mode && <p className="text-[10px] text-[#F59E0B] mt-2 font-bold">⚠ Currently TEST mode — swap to live keys for production charging</p>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Flags */}
                <div className="zm-card p-5 bg-[#F8FAFC]" data-testid="flags-block">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-2">// Runtime flags</p>
                    <div className="font-mono text-xs text-[#0F172A] space-y-1">
                        {Object.entries(data.flags).map(([k, v]) => (
                            <div key={k}><span className="text-[#71717A]">{k}=</span><span className="font-bold">{String(v)}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
