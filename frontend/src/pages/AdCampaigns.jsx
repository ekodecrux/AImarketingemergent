import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    FacebookLogo, GoogleLogo, LinkedinLogo, Plus, Pause, Play, Lock,
    ArrowsClockwise, RocketLaunch, Eye, CursorClick, UserCheck, CurrencyDollar,
} from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/locale";

const PLATFORM_META = {
    meta:     { label: "Meta (Facebook/Instagram)", icon: FacebookLogo, color: "#1877F2" },
    google:   { label: "Google Ads", icon: GoogleLogo, color: "#EA4335" },
    linkedin: { label: "LinkedIn Ads", icon: LinkedinLogo, color: "#0A66C2" },
};

export default function AdCampaigns() {
    const [accounts, setAccounts] = useState({ meta: [], google: [], linkedin: [] });
    const [campaigns, setCampaigns] = useState([]);
    const [mockMode, setMockMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [launching, setLaunching] = useState(false);
    const [connectModal, setConnectModal] = useState(null); // platform key
    const [form, setForm] = useState({ ad_account_id: "", access_token: "", ad_account_name: "", business_name: "" });

    const load = async () => {
        setLoading(true);
        try {
            const [a, c] = await Promise.all([
                api.get("/ad-platform/accounts"),
                api.get("/ad-platform/campaigns"),
            ]);
            setAccounts(a.data.accounts || { meta: [], google: [], linkedin: [] });
            setMockMode(a.data.mock_mode);
            setCampaigns(c.data.campaigns || []);
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const totalConnected = Object.values(accounts).reduce((s, arr) => s + arr.length, 0);

    const launch = async () => {
        if (totalConnected === 0) {
            toast.error("Connect at least one ad account first");
            return;
        }
        setLaunching(true);
        const t = toast.loading("Reading plan & creating ad campaigns (paused)…");
        try {
            const r = await api.post("/ad-platform/launch-plan", { weeks: 4, auto_pause_at_cap: true });
            toast.success(`Created ${r.data.created.length} campaign(s) · ${r.data.skipped.length} skipped`, { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Launch failed", { id: t });
        } finally { setLaunching(false); }
    };

    const setStatus = async (cid, status) => {
        try {
            const path = status === "ACTIVE" ? "resume" : "pause";
            await api.post(`/ad-platform/campaigns/${cid}/${path}`);
            toast.success(`Campaign ${status === "ACTIVE" ? "resumed" : "paused"}`);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Action failed");
        }
    };

    const connectAccount = async () => {
        try {
            await api.post("/ad-platform/accounts", { platform: connectModal, ...form });
            toast.success(`${PLATFORM_META[connectModal]?.label} connected`);
            setConnectModal(null);
            setForm({ ad_account_id: "", access_token: "", ad_account_name: "", business_name: "" });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Connection failed");
        }
    };

    const disconnect = async (id) => {
        if (!window.confirm("Disconnect this ad account?")) return;
        try {
            await api.delete(`/ad-platform/accounts/${id}`);
            toast.success("Disconnected");
            load();
        } catch { toast.error("Failed"); }
    };

    return (
        <div data-testid="ad-campaigns-page">
            <PageHeader
                eyebrow="// Paid execution"
                title="Ad Campaigns"
                subtitle="Launch budget-capped Meta / Google / LinkedIn campaigns from your approved plan."
            />

            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Connection cards */}
                <div>
                    <div className="flex items-end justify-between mb-3 flex-wrap gap-3">
                        <div>
                            <p className="zm-section-label">// Connected ad accounts</p>
                            <h2 className="font-display text-xl font-bold tracking-tight mt-1">Step 1: connect at least one platform</h2>
                        </div>
                        {mockMode && (
                            <span className="zm-badge bg-[#FEF3C7] text-[#92400E]">DEMO MODE — calls don't reach Meta yet</span>
                        )}
                    </div>
                    <div className="grid md:grid-cols-3 gap-4" data-testid="ad-accounts-grid">
                        {Object.keys(PLATFORM_META).map((p) => {
                            const meta = PLATFORM_META[p];
                            const connected = accounts[p] || [];
                            return (
                                <div key={p} className="zm-card p-5" data-testid={`ad-account-card-${p}`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: meta.color }}>
                                            <meta.icon size={20} weight="fill" className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-display text-base font-bold tracking-tight">{meta.label}</h3>
                                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#71717A] font-bold">
                                                {connected.length ? `${connected.length} connected` : "Not connected"}
                                            </p>
                                        </div>
                                    </div>
                                    {connected.length > 0 ? (
                                        <div className="space-y-2">
                                            {connected.map((c) => (
                                                <div key={c.id} className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate">{c.ad_account_name || c.ad_account_id}</p>
                                                        <p className="text-[11px] text-[#94A3B8] truncate">{c.ad_account_id}</p>
                                                    </div>
                                                    <button onClick={() => disconnect(c.id)} className="text-xs text-[#EF4444] font-semibold hover:underline ml-2 shrink-0" data-testid={`disconnect-${p}-${c.id}`}>Disconnect</button>
                                                </div>
                                            ))}
                                            <button onClick={() => setConnectModal(p)} className="zm-btn-secondary text-xs w-full" data-testid={`add-${p}-account`}>
                                                <Plus size={12} weight="bold" /> Add another
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setConnectModal(p)} className="zm-btn-primary text-xs w-full" style={{ background: meta.color }} data-testid={`connect-${p}`}>
                                            <Plus size={12} weight="bold" /> Connect ad account
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Launch from plan */}
                <div className="zm-card p-6 border-l-2 border-l-[#2563EB] bg-gradient-to-r from-[#F8FAFC] to-white flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-[#DBEAFE] flex items-center justify-center shrink-0">
                            <RocketLaunch size={18} weight="fill" className="text-[#2563EB]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-display text-lg font-bold tracking-tight">Step 2: launch campaigns from your plan</h3>
                            <p className="text-sm text-[#64748B] mt-1">
                                We'll read the latest growth plan, find paid channels mapped to your connected accounts, and create campaigns with daily-budget caps. <strong>Always created paused</strong> — you review & resume.
                            </p>
                        </div>
                    </div>
                    <button onClick={launch} disabled={launching || totalConnected === 0}
                        className="zm-btn-primary whitespace-nowrap"
                        data-testid="launch-plan-button">
                        {launching ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <RocketLaunch size={14} weight="fill" />}
                        {launching ? "Launching…" : "Launch campaigns from plan"}
                    </button>
                </div>

                {/* Campaign list */}
                <div>
                    <h2 className="font-display text-xl font-bold tracking-tight mb-3">Step 3: review & resume</h2>
                    {loading ? (
                        <div className="zm-card p-12 text-center text-sm text-[#94A3B8]">Loading…</div>
                    ) : campaigns.length === 0 ? (
                        <div className="zm-card p-10 text-center" data-testid="ad-campaigns-empty">
                            <RocketLaunch size={28} weight="fill" className="mx-auto text-[#94A3B8] mb-2" />
                            <h3 className="font-display text-lg font-bold tracking-tight">No ad campaigns yet</h3>
                            <p className="text-sm text-[#64748B] mt-1">Connect an ad account and click "Launch campaigns from plan".</p>
                        </div>
                    ) : (
                        <div className="space-y-3" data-testid="ad-campaigns-list">
                            {campaigns.map((c) => {
                                const meta = PLATFORM_META[c.platform] || { label: c.platform, icon: RocketLaunch, color: "#64748B" };
                                const localeInfo = { currency: c.currency, symbol: c.currency === "INR" ? "₹" : "$", locale: c.currency === "INR" ? "en-IN" : "en-US" };
                                const spendPct = c.spend_cap ? Math.min(100, (c.spend_actual / c.spend_cap) * 100) : 0;
                                const isActive = c.status === "ACTIVE";
                                return (
                                    <div key={c.id} className="zm-card p-5" data-testid={`campaign-${c.id}`}>
                                        <div className="flex items-start gap-4 flex-wrap">
                                            <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: meta.color }}>
                                                <meta.icon size={18} weight="fill" className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-display text-base font-bold tracking-tight truncate">{c.channel_name}</h3>
                                                    <span className={`zm-badge ${isActive ? "bg-[#10B981] text-white" : c.status === "PAUSED" ? "bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{c.status}</span>
                                                    {c.is_mock && <span className="zm-badge bg-[#FEF3C7] text-[#92400E]">MOCK</span>}
                                                </div>
                                                <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{meta.label} · {c.ad_account_id} · {c.start_date} → {c.end_date}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {isActive ? (
                                                    <button onClick={() => setStatus(c.id, "PAUSED")} className="zm-btn-secondary text-xs" data-testid={`pause-${c.id}`}>
                                                        <Pause size={12} weight="fill" /> Pause
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setStatus(c.id, "ACTIVE")} className="zm-btn-primary text-xs" data-testid={`resume-${c.id}`}>
                                                        <Play size={12} weight="fill" /> Resume
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats row */}
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#E2E8F0]">
                                            <Stat icon={CurrencyDollar} label="Daily cap" value={formatCurrency(c.daily_budget, localeInfo)} />
                                            <Stat icon={CurrencyDollar} label="Spend" value={formatCurrency(c.spend_actual, localeInfo)} accent />
                                            <Stat icon={Eye} label="Impressions" value={(c.impressions || 0).toLocaleString()} />
                                            <Stat icon={CursorClick} label="Clicks" value={(c.clicks || 0).toLocaleString()} />
                                            <Stat icon={UserCheck} label="Leads" value={c.leads || 0} success />
                                        </div>

                                        {/* Spend cap progress */}
                                        <div className="mt-3">
                                            <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] font-bold text-[#64748B] mb-1">
                                                <span>Spend vs cap</span>
                                                <span>{formatCurrency(c.spend_actual, localeInfo)} / {formatCurrency(c.spend_cap, localeInfo)}</span>
                                            </div>
                                            <div className="h-2 bg-[#F8FAFC] rounded-full overflow-hidden">
                                                <div className="h-full transition-all"
                                                    style={{ width: `${spendPct}%`, background: spendPct >= 80 ? "#EF4444" : spendPct >= 50 ? "#F59E0B" : "#10B981" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Connect modal */}
            {connectModal && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/60 flex items-center justify-center p-4" onClick={() => setConnectModal(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="connect-modal">
                        <h3 className="font-display text-xl font-bold tracking-tight mb-2">Connect {PLATFORM_META[connectModal]?.label}</h3>
                        <p className="text-xs text-[#64748B] mb-4">
                            Paste your <strong>ad account ID</strong> and a <strong>long-lived access token</strong> (with <code className="bg-[#F8FAFC] px-1 rounded">ads_management</code> scope). Token is encrypted at rest.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="zm-label">Ad account ID</label>
                                <input value={form.ad_account_id}
                                    onChange={(e) => setForm({ ...form, ad_account_id: e.target.value })}
                                    placeholder={connectModal === "meta" ? "act_1234567890" : "customers/1234567890"}
                                    className="zm-input"
                                    data-testid="connect-ad-account-id"
                                />
                            </div>
                            <div>
                                <label className="zm-label">Access token</label>
                                <input type="password" value={form.access_token}
                                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                                    className="zm-input"
                                    data-testid="connect-access-token"
                                />
                            </div>
                            <div>
                                <label className="zm-label">Account name <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                                <input value={form.ad_account_name}
                                    onChange={(e) => setForm({ ...form, ad_account_name: e.target.value })}
                                    className="zm-input"
                                />
                            </div>
                            <p className="text-[10px] text-[#94A3B8] flex items-center gap-1 pt-1">
                                <Lock size={10} weight="fill" /> Stored encrypted at rest. Disconnect anytime.
                            </p>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={connectAccount} className="zm-btn-primary flex-1" data-testid="connect-save">Connect</button>
                            <button onClick={() => setConnectModal(null)} className="zm-btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ icon: Icon, label, value, accent, success }) {
    return (
        <div>
            <div className="flex items-center gap-1 text-[#64748B]">
                <Icon size={11} weight="bold" />
                <span className="text-[9px] uppercase tracking-[0.12em] font-bold">{label}</span>
            </div>
            <p className={`font-display font-black tracking-tight mt-0.5 ${accent ? "text-[#2563EB] text-lg" : success ? "text-[#10B981] text-lg" : "text-base"}`}>{value}</p>
        </div>
    );
}
