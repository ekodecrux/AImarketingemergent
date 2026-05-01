import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PlanOverviewTab from "@/components/PlanOverviewTab";
import {
    ChartLineUp, MagnifyingGlass, Newspaper, Calendar, Target,
    Sparkle, ArrowRight, ArrowsClockwise, Lightning, CurrencyDollar, RocketLaunch, CheckCircle,
    SquaresFour,
} from "@phosphor-icons/react";
import { formatCurrency, currencySymbol, getCachedLocale, setLocaleCache } from "@/lib/locale";

const SYMBOL_FOR_CCY = {
    USD: "$", INR: "₹", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩",
    CAD: "C$", AUD: "A$", NZD: "NZ$", SGD: "S$", HKD: "HK$", CHF: "CHF",
    SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", MXN: "Mex$", BRL: "R$",
    ZAR: "R", NGN: "₦", AED: "AED", SAR: "SAR", ILS: "₪",
};

const TABS = [
    { id: "overview", label: "Plan Overview", icon: SquaresFour, badge: "NEW" },
    { id: "quick", label: "Quick Plan", icon: Lightning, badge: "EASY" },
    { id: "icp", label: "Ideal Customer", icon: Target },
    { id: "market", label: "Market Analysis", icon: ChartLineUp },
    { id: "seo", label: "SEO Toolkit", icon: MagnifyingGlass },
    { id: "pr", label: "PR & Outreach", icon: Newspaper },
    { id: "plan", label: "Full Growth Plan", icon: Calendar },
];

export default function GrowthStudio() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initial = searchParams.get("tab") || "overview";
    const [tab, setTab] = useState(TABS.some(t => t.id === initial) ? initial : "overview");

    const switchTab = (id) => {
        setTab(id);
        setSearchParams({ tab: id }, { replace: true });
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Growth engine"
                title="Growth Studio"
                subtitle="Everything AI knows about your growth — synced from your business profile. No manual clicks."
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {/* Tabs */}
                <div className="flex gap-0 zm-card mb-6 overflow-x-auto" data-testid="growth-tabs">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => switchTab(t.id)}
                            data-testid={`tab-${t.id}`}
                            className={`flex items-center gap-2 px-6 py-4 text-xs uppercase tracking-[0.15em] font-bold whitespace-nowrap border-r border-[#E2E8F0] last:border-r-0 transition-colors ${
                                tab === t.id ? "bg-[#0F172A] text-white" : "bg-white text-[#71717A] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                            }`}
                        >
                            <t.icon size={14} weight="bold" /> {t.label}
                            {t.badge && (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-[#2563EB] text-white" : "bg-[#DBEAFE] text-[#1D4ED8]"}`}>{t.badge}</span>
                            )}
                        </button>
                    ))}
                </div>

                {tab === "overview" && <PlanOverviewTab onOpenTab={switchTab} />}
                {tab === "quick" && <QuickPlanTab />}
                {tab === "icp" && <ICPTab />}
                {tab === "market" && <MarketTab />}
                {tab === "seo" && <SEOTab />}
                {tab === "pr" && <PRTab />}
                {tab === "plan" && <PlanTab />}
            </div>
        </div>
    );
}

/* ---------- Quick Plan: budget-driven simple flow ---------- */
function QuickPlanTab() {
    const navigate = useNavigate();
    const [budget, setBudget] = useState(5000);
    const [duration, setDuration] = useState(6);
    const [avgDeal, setAvgDeal] = useState("");
    const [goal, setGoal] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [kickoffLoading, setKickoffLoading] = useState(false);
    const [locale, setLocale] = useState(getCachedLocale());

    // ALWAYS refresh from /locale/me on mount — cached locale may be stale after profile edit
    useEffect(() => {
        api.get("/locale/me").then((r) => {
            if (r.data?.locale) {
                setLocale(r.data.locale);
                setLocaleCache(r.data.locale);
            }
        }).catch(() => {});
    }, []);

    // Derive locale from backend response if cached locale missing (safety net)
    const effLocale = locale || (result?.guarantee?.currency
        ? { currency: result.guarantee.currency, symbol: SYMBOL_FOR_CCY[result.guarantee.currency] || "$", locale: "en-US" }
        : null);
    const sym = currencySymbol(effLocale);

    // Load any existing plan that came from quick-plan
    useEffect(() => {
        api.get("/growth-plan/latest").then((r) => {
            const p = r.data.plan;
            if (p && p.source === "quick_plan") {
                setResult({ plan: p, guarantee: {
                    monthly_leads: p.plan?.guaranteed_leads_per_month || 0,
                    total_leads: p.plan?.total_guaranteed_leads || 0,
                    duration_months: p.plan?.duration_months || 12,
                    monthly_budget: p.plan?.monthly_budget_usd || 0,
                    currency: p.plan?.currency || locale?.currency || "USD",
                    buffer_pct: 50,
                    raw_predicted_per_month: p.plan?.raw_predicted_leads_per_month || 0,
                }});
                setBudget(p.plan?.monthly_budget_usd || 5000);
                setDuration(p.plan?.duration_months || 6);
                setAvgDeal(p.plan?.avg_deal_value_usd || "");
            }
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generate = async () => {
        if (!budget || budget <= 0) { toast.error("Enter a monthly budget"); return; }
        setLoading(true);
        const t = toast.loading("Optimising your budget…");
        try {
            const r = await api.post("/quick-plan/generate", {
                monthly_budget: Number(budget),
                duration_months: Number(duration),
                avg_deal_value: avgDeal ? Number(avgDeal) : undefined,
                goal: goal || undefined,
            });
            setResult(r.data);
            toast.success(`We can guarantee ${r.data.guarantee.monthly_leads} leads/mo`, { id: t });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Generation failed", { id: t });
        } finally { setLoading(false); }
    };

    const kickoff = async () => {
        setKickoffLoading(true);
        const t = toast.loading("Activating Execution Engine — generating & scheduling content…");
        try {
            const r = await api.post("/plan/kickoff-execution", {
                weeks: 2, posts_per_week: 3, platforms: ["linkedin", "twitter", "blog"],
            });
            toast.success(`Scheduled ${r.data.schedules_created} posts across LinkedIn, X & Blog`, { id: t });
            setTimeout(() => navigate("/schedule"), 800);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Kickoff failed", { id: t });
        } finally { setKickoffLoading(false); }
    };

    const plan = result?.plan?.plan;
    const guarantee = result?.guarantee;
    const channels = plan?.channel_distribution || [];

    return (
        <div className="space-y-6" data-testid="quick-plan-tab">
            {/* Form */}
            <div className="zm-card p-6 sm:p-8 border-l-2 border-l-[#2563EB]">
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-md bg-[#10B981]/15 flex items-center justify-center shrink-0">
                        <Lightning size={18} weight="fill" className="text-[#10B981]" />
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-bold tracking-tight">Tell us your budget — we'll guarantee the leads, organic-first.</h3>
                        <p className="text-sm text-[#64748B] mt-1">AI builds an <strong className="text-[#10B981]">organic-first</strong> mix (SEO, social, email, content) that costs <strong>60–80% less than paid ads</strong>. Paid ads only when you really need them.</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="zm-label">Monthly marketing budget</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">{sym}</span>
                            <input
                                type="number" min="100" step="100"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                className="zm-input pl-8 text-base font-semibold"
                                placeholder="5000"
                                data-testid="quick-budget-input"
                            />
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1">Per month, all channels combined.</p>
                    </div>
                    <div>
                        <label className="zm-label">Plan duration</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[3, 6, 9, 12].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setDuration(m)}
                                    className={`px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] rounded-xl border transition-colors ${
                                        duration === m
                                            ? "bg-[#0F172A] text-white border-[#0F172A]"
                                            : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]"
                                    }`}
                                    data-testid={`quick-duration-${m}`}
                                >
                                    {m} mo
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1">Editable anytime. Default 6 months.</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="zm-label">Avg. deal value <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">{sym}</span>
                            <input
                                type="number" min="0"
                                value={avgDeal}
                                onChange={(e) => setAvgDeal(e.target.value)}
                                className="zm-input pl-8"
                                placeholder="100"
                                data-testid="quick-avg-deal"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="zm-label">Goal <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                        <input
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            className="zm-input"
                            placeholder="e.g. demo bookings, app installs, footfall"
                            data-testid="quick-goal"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-[#E2E8F0]">
                    <button onClick={generate} disabled={loading} className="zm-btn-primary" data-testid="quick-generate">
                        {loading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
                        {loading ? "Optimising…" : (result ? "Re-optimise plan" : "Generate guaranteed plan")}
                    </button>
                    <p className="text-xs text-[#64748B]">
                        <CheckCircle size={11} weight="fill" className="inline text-[#10B981] mr-1" />
                        We hold a 50% safety buffer — you typically get more leads than guaranteed.
                    </p>
                </div>
            </div>

            {/* Result */}
            {guarantee && plan && (
                <div className="space-y-5" data-testid="quick-plan-result">
                    {/* Guarantee headline card */}
                    <div className="zm-card bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-0 p-7 sm:p-9">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-2">// Lead guarantee</p>
                        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                            <div>
                                <p className="font-display text-5xl sm:text-6xl font-black tracking-tight text-[#2563EB]" data-testid="guarantee-monthly">
                                    {guarantee.monthly_leads}
                                </p>
                                <p className="text-xs text-white/70 font-semibold mt-1">leads / month, guaranteed</p>
                            </div>
                            <div>
                                <p className="font-display text-3xl font-black tracking-tight text-white" data-testid="guarantee-total">
                                    {guarantee.total_leads}
                                </p>
                                <p className="text-xs text-white/70 font-semibold mt-1">total over {guarantee.duration_months} months</p>
                            </div>
                            <div>
                                <p className="font-display text-2xl font-black tracking-tight text-[#10B981]">
                                    {formatCurrency(guarantee.monthly_budget, effLocale)}
                                </p>
                                <p className="text-xs text-white/70 font-semibold mt-1">monthly budget</p>
                            </div>
                            {guarantee.raw_predicted_per_month > guarantee.monthly_leads && (
                                <div className="ml-auto">
                                    <span className="zm-badge bg-[#10B981] text-white">UPSIDE: ~{guarantee.raw_predicted_per_month}/mo</span>
                                </div>
                            )}
                        </div>
                        {plan.ai_rationale && (
                            <p className="text-sm text-white/80 mt-5 pt-4 border-t border-white/10 leading-relaxed max-w-3xl">
                                {plan.ai_rationale}
                            </p>
                        )}
                        <button onClick={kickoff} disabled={kickoffLoading} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors" data-testid="quick-kickoff">
                            {kickoffLoading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <RocketLaunch size={14} weight="fill" />}
                            {kickoffLoading ? "Activating…" : "Activate Execution Engine"} <ArrowRight size={14} weight="bold" />
                        </button>
                        <p className="text-[11px] text-white/50 mt-2">→ Auto-generates 6 posts, schedules them across the next 2 weeks on LinkedIn, X & your blog.</p>
                    </div>

                    {/* Channels */}
                    {channels.length > 0 && (
                        <div className="zm-card overflow-hidden">
                            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap gap-3 items-center justify-between">
                                <p className="zm-section-label">// Optimal channel mix</p>
                                <div className="flex gap-3 text-xs">
                                    {plan.optimal_split?.paid_pct != null && (
                                        <>
                                            <span><strong className="text-[#2563EB]">{plan.optimal_split.paid_pct}%</strong> paid</span>
                                            <span className="text-[#94A3B8]">·</span>
                                            <span><strong className="text-[#10B981]">{plan.optimal_split.organic_pct}%</strong> organic</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#E2E8F0] bg-white">
                                            <th className="text-left px-5 py-3 zm-section-label">Channel</th>
                                            <th className="text-left px-3 py-3 zm-section-label">Type</th>
                                            <th className="text-right px-3 py-3 zm-section-label">Budget /mo</th>
                                            <th className="text-right px-3 py-3 zm-section-label">Leads /mo</th>
                                            <th className="text-right px-3 py-3 zm-section-label">CPL</th>
                                            <th className="text-left px-5 py-3 zm-section-label">Why</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {channels.map((c, i) => (
                                            <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC]" data-testid={`quick-channel-${i}`}>
                                                <td className="px-5 py-3 font-bold">{c.name}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`zm-badge ${c.type === "paid" ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#D1FAE5] text-[#065F46]"}`}>{c.type}</span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono">{formatCurrency(c.monthly_budget_usd || 0, effLocale)}</td>
                                                <td className="px-3 py-3 text-right font-mono font-bold">{c.expected_leads_per_month || 0}</td>
                                                <td className="px-3 py-3 text-right font-mono">{formatCurrency(c.expected_cpl_usd || 0, effLocale)}</td>
                                                <td className="px-5 py-3 text-xs text-[#64748B] max-w-[280px]">{c.rationale}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* First action recommendation */}
                    {plan.recommended_first_action && (
                        <div className="zm-card p-5 border-l-2 border-l-[#F59E0B] flex items-start gap-3">
                            <CurrencyDollar size={20} weight="fill" className="text-[#F59E0B] mt-0.5 shrink-0" />
                            <div>
                                <p className="zm-section-label mb-1">// Recommended first action</p>
                                <p className="text-sm font-semibold text-[#0F172A]">{plan.recommended_first_action}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


/* ---------- ICP ---------- */
function ICPTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get("/icp/latest").then((r) => {
            if (r.data.icp) setData(r.data.icp.icp);
        }).catch(() => {});
    }, []);

    const generate = async () => {
        setLoading(true);
        const t = toast.loading("Building your Ideal Customer Profile…");
        try {
            const r = await api.post("/icp/generate");
            setData(r.data.icp.icp);
            toast.success("ICP ready", { id: t });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed", { id: t });
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6" data-testid="icp-tab">
            <ActionBar
                title="Identify your Ideal Customer Profile"
                desc="Persona, firmographics, buying signals, sample target companies, and recommended outreach channels."
                onClick={generate}
                loading={loading}
                cta={data ? "Regenerate ICP" : "Generate ICP"}
            />
            {data && (
                <div className="space-y-6">
                    {/* Persona */}
                    {data.persona && (
                        <div className="zm-card p-7 bg-[#0F172A] text-white">
                            <p className="zm-section-label text-white/60 mb-2">// Buyer persona</p>
                            <h3 className="font-display text-3xl font-black tracking-tight">
                                {data.persona.title}
                                {data.persona.seniority && <span className="text-[#2563EB] ml-2 text-2xl">· {data.persona.seniority}</span>}
                            </h3>
                            <p className="text-sm text-white/70 mt-3 leading-relaxed">{data.persona.role_summary}</p>
                            <div className="grid sm:grid-cols-3 gap-4 mt-6">
                                <PersonaList title="Daily pains" items={data.persona.daily_pains} />
                                <PersonaList title="Buying triggers" items={data.persona.buying_triggers} />
                                <PersonaList title="Common objections" items={data.persona.objections} />
                            </div>
                        </div>
                    )}

                    {/* Firmographics + Sample companies */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {data.firmographics && (
                            <Section title="Firmographics">
                                <div className="zm-card p-6 space-y-3 text-sm">
                                    <Row k="Company size" v={data.firmographics.company_size_range} />
                                    <Row k="Industry" v={data.firmographics.industry} />
                                    <Row k="Revenue band" v={data.firmographics.revenue_band_usd} />
                                    <Row k="Geography" v={data.firmographics.geography} />
                                    {Array.isArray(data.firmographics.tech_stack_signals) && (
                                        <div className="pt-2 border-t border-[#E2E8F0]">
                                            <p className="zm-section-label mb-2">Tech / behavior signals</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {data.firmographics.tech_stack_signals.map((s, i) => (
                                                    <span key={i} className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {Array.isArray(data.sample_companies) && (
                            <Section title="Sample target companies (10)">
                                <div className="zm-card divide-y divide-[#E2E8F0]">
                                    {data.sample_companies.map((c, i) => (
                                        <div key={i} className="px-5 py-3 flex items-center gap-3 text-sm">
                                            <span className="font-mono text-[10px] text-[#94A3B8] w-6">{String(i + 1).padStart(2, "0")}</span>
                                            <span className="font-semibold">{c}</span>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* Buying signals */}
                    {Array.isArray(data.buying_signals) && (
                        <Section title="Buying signals to watch">
                            <div className="zm-card p-6 grid md:grid-cols-2 gap-3">
                                {data.buying_signals.map((s, i) => (
                                    <div key={i} className="flex gap-2 text-sm">
                                        <Sparkle size={14} weight="fill" className="text-[#2563EB] mt-0.5 shrink-0" />
                                        <span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Recommended channels */}
                    {Array.isArray(data.recommended_outreach_channels) && (
                        <Section title="Recommended outreach channels">
                            <div className="grid md:grid-cols-2 gap-4">
                                {data.recommended_outreach_channels.map((c, i) => (
                                    <div key={i} className="zm-card p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-display text-lg font-bold tracking-tight">{c.channel}</h4>
                                            <span className={`zm-badge ${c.type === "paid" ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#D1FAE5] text-[#047857]"}`}>{(c.type || "").toUpperCase()}</span>
                                        </div>
                                        <p className="text-xs text-[#64748B] mb-3">{c.why_this_works}</p>
                                        {c.opening_message_hook && (
                                            <div className="bg-[#F8FAFC] border-l-2 border-[#2563EB] p-3 text-xs italic text-[#0F172A]">
                                                "{c.opening_message_hook}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Qualification + disqualifiers */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {Array.isArray(data.qualification_questions) && (
                            <Section title="Qualification questions">
                                <ul className="zm-card p-6 space-y-2 text-sm">
                                    {data.qualification_questions.map((q, i) => (
                                        <li key={i} className="flex gap-2"><span className="text-[#2563EB] font-bold">{i + 1}.</span> {q}</li>
                                    ))}
                                </ul>
                            </Section>
                        )}
                        {Array.isArray(data.disqualifiers) && (
                            <Section title="Disqualifiers">
                                <ul className="zm-card p-6 space-y-2 text-sm">
                                    {data.disqualifiers.map((d, i) => (
                                        <li key={i} className="flex gap-2"><span className="text-[#DC2626] font-bold">×</span> {d}</li>
                                    ))}
                                </ul>
                            </Section>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function PersonaList({ title, items }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50 mb-2">{title}</p>
            <ul className="space-y-1 text-xs text-white/90">
                {(items || []).map((it, i) => <li key={i}>• {it}</li>)}
            </ul>
        </div>
    );
}

function Row({ k, v }) {
    if (!v) return null;
    return (
        <div className="flex justify-between gap-4">
            <span className="text-[#64748B] text-xs uppercase tracking-wider font-semibold">{k}</span>
            <span className="font-semibold text-right">{v}</span>
        </div>
    );
}

/* ---------- Market Analysis ---------- */
function MarketTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        const t = toast.loading("AI analysing your market…");
        try {
            const r = await api.post("/market/analyze", {});
            setData(r.data.analysis.data);
            toast.success("Market analysis ready", { id: t });
        } catch (err) { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-6" data-testid="market-tab">
            <ActionBar
                title="Generate competitive market analysis"
                desc="SWOT, market size, competitor matrix, positioning recommendations."
                onClick={generate}
                loading={loading}
                cta={data ? "Regenerate" : "Run analysis"}
            />
            {data && (
                <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-0 zm-card">
                        <Block title="Market size">{data.market_size}</Block>
                        <Block title="Growth rate" right>{data.growth_rate}</Block>
                    </div>

                    <Section title="Trends to ride">
                        <ul className="grid md:grid-cols-2 gap-2">
                            {(data.trends || []).map((t, i) => (
                                <li key={i} className="flex gap-2 text-sm bg-[#F8FAFC] p-3 border-l-2 border-[#2563EB]">
                                    <span className="text-[#71717A] font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Competitor matrix">
                        <div className="zm-card overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#E2E8F0]">
                                        {["Name", "Strengths", "Weaknesses", "Positioning"].map((h) => (
                                            <th key={h} className="text-left px-4 py-3 zm-section-label">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.competitors || []).map((c, i) => (
                                        <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0 align-top">
                                            <td className="px-4 py-3 font-semibold">{c.name}</td>
                                            <td className="px-4 py-3 text-[#71717A]">{c.strengths}</td>
                                            <td className="px-4 py-3 text-[#71717A]">{c.weaknesses}</td>
                                            <td className="px-4 py-3 text-[#71717A]">{c.positioning}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0 zm-card">
                        {["strengths", "weaknesses", "opportunities", "threats"].map((k, i) => (
                            <div key={k} className={`p-6 ${i < 3 ? "lg:border-r" : ""} ${i % 2 !== 1 ? "md:border-r" : ""} ${i < 2 ? "md:border-b lg:border-b-0" : ""} border-[#E2E8F0]`}>
                                <p className="zm-section-label mb-3">// {k}</p>
                                <ul className="space-y-2 text-sm">
                                    {(data.swot?.[k] || []).map((it, j) => <li key={j} className="text-[#0F172A]">• {it}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <Section title="Positioning recommendation">
                        <p className="text-sm leading-relaxed bg-[#0F172A] text-white p-6 zm-card border-0">{data.positioning_recommendation}</p>
                    </Section>

                    <Section title="Differentiator angles">
                        <ul className="space-y-2">
                            {(data.unique_angles || []).map((a, i) => (
                                <li key={i} className="text-sm flex gap-3">
                                    <span className="zm-badge bg-[#2563EB] text-white">{String(i + 1).padStart(2, "0")}</span>
                                    {a}
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Immediate actions">
                        <div className="zm-card divide-y divide-[#E2E8F0]">
                            {(data.immediate_actions || []).map((a, i) => {
                                const text = typeof a === "string" ? a : (a.action || a.step || "");
                                const priority = typeof a === "object" ? a.priority : null;
                                return (
                                    <div key={i} className="px-6 py-4 flex items-center gap-3">
                                        <span className="text-xs text-[#71717A] font-mono">{String(i + 1).padStart(2, "0")}</span>
                                        <span className="flex-1 text-sm">{text}</span>
                                        {priority && <span className={`zm-badge ${priority === "high" ? "bg-[#E32636] text-white" : priority === "med" ? "bg-[#F59E0B] text-white" : "bg-[#F8FAFC] text-[#0F172A]"}`}>{priority}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                </div>
            )}
        </div>
    );
}

/* ---------- SEO Toolkit ---------- */
function SEOTab() {
    const [sub, setSub] = useState("keywords");
    return (
        <div>
            <div className="flex gap-2 mb-6">
                {[["keywords", "Keywords"], ["backlinks", "Backlinks"], ["content", "Content gaps"]].map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setSub(id)}
                        data-testid={`seo-sub-${id}`}
                        className={`px-4 py-2 text-xs uppercase tracking-[0.15em] font-bold border ${
                            sub === id ? "bg-[#2563EB] border-[#2563EB] text-white" : "bg-white border-[#E2E8F0] text-[#71717A] hover:border-[#2563EB]"
                        }`}
                    >{label}</button>
                ))}
            </div>
            {sub === "keywords" && <KeywordList />}
            {sub === "backlinks" && <BacklinkList />}
            {sub === "content" && <ContentGapList />}
        </div>
    );
}

function KeywordList() {
    const [seed, setSeed] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        setLoading(true);
        const t = toast.loading("Researching keywords…");
        try {
            const r = await api.post("/seo/keywords", { seed_keyword: seed });
            setItems(r.data.keywords || []);
            toast.success(`${(r.data.keywords || []).length} keywords found`, { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4" data-testid="keyword-tab">
            <div className="flex gap-2">
                <input className="zm-input flex-1" placeholder="Seed keyword (defaults to your industry)" value={seed} onChange={(e) => setSeed(e.target.value)} data-testid="seo-seed" />
                <button onClick={run} disabled={loading} className="zm-btn-primary" data-testid="seo-keywords-run">
                    <Sparkle size={14} weight="fill" /> {loading ? "Researching…" : "Generate"}
                </button>
            </div>
            {items.length > 0 && (
                <div className="zm-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                {["Keyword", "Intent", "Difficulty", "Volume", "Opportunity", "Category"].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 zm-section-label">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((k, i) => (
                                <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0">
                                    <td className="px-4 py-3 font-semibold">{k.keyword}</td>
                                    <td className="px-4 py-3"><span className="zm-badge bg-[#F8FAFC] text-[#0F172A]">{k.intent}</span></td>
                                    <td className="px-4 py-3 font-mono text-xs">{k.difficulty}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{k.volume_band}</td>
                                    <td className="px-4 py-3">
                                        <ScoreBar value={k.opportunity_score} />
                                    </td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs">{k.category}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function BacklinkList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        setLoading(true);
        const t = toast.loading("Mapping backlinks…");
        try {
            const r = await api.post("/seo/backlinks", {});
            setItems(r.data.opportunities || []);
            toast.success("Backlinks mapped", { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4" data-testid="backlink-tab">
            <ActionBar title="Map link-building opportunities" desc="Guest posts, listicles, podcasts, niche directories — ranked by effort/priority." onClick={run} loading={loading} cta="Generate opportunities" />
            {items.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4">
                    {items.map((o, i) => (
                        <div key={i} className="zm-card p-5">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="font-semibold text-sm">{o.name}</h4>
                                    <p className="text-xs text-[#71717A] truncate">{o.url}</p>
                                </div>
                                <span className={`zm-badge ${o.priority === "high" ? "bg-[#E32636] text-white" : o.priority === "med" ? "bg-[#F59E0B] text-white" : "bg-[#F8FAFC] text-[#0F172A]"}`}>{o.priority}</span>
                            </div>
                            <div className="flex gap-2 my-3 text-[10px] uppercase tracking-[0.15em] font-bold text-[#71717A]">
                                <span>DA {o.domain_authority}</span><span>·</span>
                                <span>{o.type}</span><span>·</span>
                                <span>{o.effort} effort</span>
                            </div>
                            <p className="text-xs text-[#71717A] leading-relaxed border-l-2 border-[#2563EB] pl-3">{o.angle}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContentGapList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        setLoading(true);
        const t = toast.loading("Finding content gaps…");
        try {
            const r = await api.post("/seo/content-gaps", {});
            setItems(r.data.content_ideas || []);
            toast.success("Content gaps mapped", { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4" data-testid="content-gap-tab">
            <ActionBar title="Surface high-intent content opportunities" desc="Titles, formats, funnel stage, outline and word count for each." onClick={run} loading={loading} cta="Generate content plan" />
            {items.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4">
                    {items.map((c, i) => (
                        <div key={i} className="zm-card p-5">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-display text-base font-bold tracking-tight">{c.title}</h4>
                                <span className="zm-badge bg-[#0F172A] text-white">{c.funnel_stage}</span>
                            </div>
                            <div className="flex gap-2 mb-3 text-[10px] uppercase tracking-[0.15em] font-bold text-[#71717A]">
                                <span>{c.format}</span><span>·</span><span>{c.word_count_estimate} words</span>
                            </div>
                            <p className="text-xs text-[#71717A] mb-3"><span className="font-bold text-[#0F172A]">Target keyword:</span> {c.target_keyword}</p>
                            <details className="text-xs">
                                <summary className="cursor-pointer text-[#2563EB] font-bold uppercase tracking-[0.15em]">View outline</summary>
                                <ul className="mt-2 space-y-1 text-[#71717A] list-disc list-inside">
                                    {(c.content_outline || []).map((s, j) => <li key={j}>{s}</li>)}
                                </ul>
                            </details>
                            <p className="text-xs text-[#A1A1AA] mt-3 italic">{c.why_now}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ---------- PR & Outreach ---------- */
function PRTab() {
    const [sub, setSub] = useState("release");
    return (
        <div>
            <div className="flex gap-2 mb-6">
                {[["release", "Press release"], ["media", "Media list"], ["outreach", "Outreach email"]].map(([id, label]) => (
                    <button
                        key={id} onClick={() => setSub(id)}
                        data-testid={`pr-sub-${id}`}
                        className={`px-4 py-2 text-xs uppercase tracking-[0.15em] font-bold border ${
                            sub === id ? "bg-[#2563EB] border-[#2563EB] text-white" : "bg-white border-[#E2E8F0] text-[#71717A] hover:border-[#2563EB]"
                        }`}
                    >{label}</button>
                ))}
            </div>
            {sub === "release" && <PressRelease />}
            {sub === "media" && <MediaList />}
            {sub === "outreach" && <OutreachComposer />}
        </div>
    );
}

function PressRelease() {
    const [announcement, setAnnouncement] = useState("");
    const [out, setOut] = useState(null);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        if (!announcement) { toast.error("What's the news?"); return; }
        setLoading(true);
        const t = toast.loading("Drafting press release…");
        try {
            const r = await api.post("/pr/press-release", { announcement });
            setOut(r.data.press_release);
            toast.success("Press release ready", { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4" data-testid="press-release-tab">
            <textarea rows={3} className="zm-input" placeholder="What's the announcement? (e.g. 'We just raised our seed round')" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} data-testid="pr-announcement" />
            <button onClick={run} disabled={loading} className="zm-btn-primary" data-testid="pr-generate"><Sparkle size={14} weight="fill" /> {loading ? "Drafting…" : "Draft press release"}</button>
            {out && (
                <div className="zm-card p-8 space-y-4 max-w-3xl">
                    <p className="zm-section-label">{out.dateline}</p>
                    <h2 className="font-display text-3xl font-black tracking-tighter">{out.headline}</h2>
                    {out.subhead && <p className="text-base text-[#71717A] italic">{out.subhead}</p>}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#0F172A]">{out.body}</div>
                    {out.quote && <blockquote className="border-l-4 border-[#2563EB] pl-4 italic text-sm text-[#71717A]">"{out.quote}"</blockquote>}
                    <hr className="border-[#E2E8F0]" />
                    <p className="text-xs text-[#71717A] font-bold uppercase tracking-[0.15em]">About</p>
                    <p className="text-xs text-[#71717A]">{out.boilerplate}</p>
                    <p className="text-xs text-[#A1A1AA]">{out.media_contact}</p>
                </div>
            )}
        </div>
    );
}

function MediaList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        setLoading(true);
        const t = toast.loading("Building media list…");
        try {
            const r = await api.post("/pr/media-list", {});
            setItems(r.data.outlets || []);
            toast.success("Media list ready", { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4" data-testid="media-list-tab">
            <ActionBar title="Targeted journalist & publication list" desc="12 outlets with beat, contact name, email pattern and angle." onClick={run} loading={loading} cta="Build media list" />
            {items.length > 0 && (
                <div className="zm-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                {["Publication", "Beat", "Contact", "Email", "Reach", "Angle"].map((h) => <th key={h} className="text-left px-4 py-3 zm-section-label">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((o, i) => (
                                <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0 align-top">
                                    <td className="px-4 py-3 font-semibold">{o.publication}</td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs">{o.beat}</td>
                                    <td className="px-4 py-3">{o.contact_name}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-[#71717A]">{o.email_pattern}</td>
                                    <td className="px-4 py-3"><span className="zm-badge bg-[#F8FAFC] text-[#0F172A]">{o.reach}</span></td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs max-w-md">{o.angle}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function OutreachComposer() {
    const [form, setForm] = useState({ journalist_name: "", publication: "", angle: "", announcement: "" });
    const [out, setOut] = useState(null);
    const [loading, setLoading] = useState(false);
    const run = async () => {
        setLoading(true);
        try {
            const r = await api.post("/pr/outreach-email", form);
            setOut(r.data.email);
            toast.success("Email drafted");
        } catch { toast.error("Failed"); }
        finally { setLoading(false); }
    };
    return (
        <div className="space-y-4 max-w-2xl" data-testid="outreach-tab">
            <div className="grid grid-cols-2 gap-3">
                {["journalist_name", "publication"].map((k) => (
                    <div key={k}>
                        <label className="zm-label">{k.replace("_", " ")}</label>
                        <input className="zm-input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`outreach-${k}`} />
                    </div>
                ))}
            </div>
            <div>
                <label className="zm-label">Angle</label>
                <input className="zm-input" value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} data-testid="outreach-angle" />
            </div>
            <div>
                <label className="zm-label">Announcement</label>
                <textarea rows={2} className="zm-input" value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} data-testid="outreach-announcement" />
            </div>
            <button onClick={run} disabled={loading} className="zm-btn-primary" data-testid="outreach-generate"><Sparkle size={14} weight="fill" /> {loading ? "Drafting…" : "Draft personalised pitch"}</button>
            {out && (
                <div className="zm-card p-6">
                    <p className="zm-section-label mb-1">Subject</p>
                    <p className="font-display text-lg font-bold mb-4">{out.subject}</p>
                    <p className="zm-section-label mb-1">Body</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{out.body}</p>
                </div>
            )}
        </div>
    );
}

/* ---------- 12-Month Plan ---------- */
function PlanTab() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [savingChannels, setSavingChannels] = useState(false);
    const [kickoffLoading, setKickoffLoading] = useState(false);

    // Load latest plan if exists
    useEffect(() => {
        api.get("/growth-plan/latest").then((r) => {
            if (r.data.plan) setData(r.data.plan.plan);
        }).catch(() => {});
    }, []);

    const generate = async () => {
        setLoading(true);
        const t = toast.loading("Building 12-month plan…");
        try {
            const r = await api.post("/growth-plan/generate");
            setData(r.data.plan.plan);
            toast.success("12-month plan ready", { id: t });
        } catch { toast.error("Failed", { id: t }); }
        finally { setLoading(false); }
    };

    const kickoff = async () => {
        setKickoffLoading(true);
        const t = toast.loading("Activating Execution Engine…");
        try {
            const r = await api.post("/plan/kickoff-execution", {
                weeks: 2, posts_per_week: 3, platforms: ["linkedin", "twitter", "blog"],
            });
            toast.success(`Scheduled ${r.data.schedules_created} posts on LinkedIn, X & Blog`, { id: t });
            setTimeout(() => navigate("/schedule"), 800);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Kickoff failed", { id: t });
        } finally { setKickoffLoading(false); }
    };

    const updateChannel = (idx, patch) => {
        const channels = [...(data.channel_distribution || [])];
        channels[idx] = { ...channels[idx], ...patch };
        setData({ ...data, channel_distribution: channels });
    };

    const removeChannel = (idx) => {
        const channels = data.channel_distribution.filter((_, i) => i !== idx);
        setData({ ...data, channel_distribution: channels });
    };

    const addChannel = () => {
        const channels = [
            ...(data.channel_distribution || []),
            { name: "New channel", type: "organic", monthly_budget_usd: 0, expected_leads_per_month: 0, expected_cpl_usd: 0, priority: "medium", rationale: "" },
        ];
        setData({ ...data, channel_distribution: channels });
    };

    const saveChannels = async () => {
        setSavingChannels(true);
        try {
            await api.post("/growth-plan/channels", {
                channel_distribution: data.channel_distribution,
                monthly_lead_target: data.monthly_lead_target,
                monthly_budget_usd: data.monthly_budget_usd,
                avg_deal_value_usd: data.avg_deal_value_usd,
            });
            toast.success("Plan overrides saved");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally { setSavingChannels(false); }
    };

    const channels = data?.channel_distribution || [];
    const totalBudget = channels.reduce((s, c) => s + (Number(c.monthly_budget_usd) || 0), 0);
    const totalLeads = channels.reduce((s, c) => s + (Number(c.expected_leads_per_month) || 0), 0);
    const paidBudget = channels.filter((c) => c.type === "paid").reduce((s, c) => s + (Number(c.monthly_budget_usd) || 0), 0);
    const organicBudget = totalBudget - paidBudget;

    return (
        <div className="space-y-6" data-testid="plan-tab">
            <ActionBar title="Generate a comprehensive 12-month growth plan" desc="Vision, north-star metric, paid + organic channel mix, monthly milestones, hiring plan." onClick={generate} loading={loading} cta={data ? "Regenerate plan" : "Generate plan"} />
            {data && (
                <div className="space-y-6">
                    <div className="zm-card bg-[#0F172A] text-white border-0 p-8 rounded-2xl">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-2">// Vision</p>
                        <p className="font-display text-2xl font-bold tracking-tight leading-snug">{data.vision}</p>
                        <div className="mt-6 pt-6 border-t border-white/10 grid sm:grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-1">North-star metric</p>
                                <p className="font-display text-2xl font-black tracking-tighter text-[#2563EB]">{data.north_star_metric}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <KpiBlock label="Lead target" value={data.monthly_lead_target || "—"} />
                                <KpiBlock label="Monthly budget" value={data.monthly_budget_usd ? `$${data.monthly_budget_usd}` : "—"} />
                                <KpiBlock label="Avg deal" value={data.avg_deal_value_usd ? `$${data.avg_deal_value_usd}` : "—"} />
                            </div>
                        </div>
                        <button onClick={kickoff} disabled={kickoffLoading} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors" data-testid="plan-kickoff">
                            {kickoffLoading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <RocketLaunch size={14} weight="fill" />}
                            {kickoffLoading ? "Activating…" : "Activate Execution Engine"} <ArrowRight size={14} weight="bold" />
                        </button>
                        <p className="text-[11px] text-white/50 mt-2">→ Auto-generates 6 posts and schedules them across the next 2 weeks.</p>
                    </div>

                    {/* CHANNEL DISTRIBUTION (paid vs organic, editable) */}
                    {channels.length > 0 && (
                        <Section title="Channel distribution (paid + organic)">
                            <div className="zm-card overflow-hidden" data-testid="channel-distribution">
                                <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap gap-4">
                                        <div>
                                            <p className="zm-section-label">Total budget</p>
                                            <p className="font-display text-xl font-black tracking-tighter">${totalBudget.toLocaleString()}</p>
                                        </div>
                                        <div className="border-l border-[#E2E8F0] pl-4">
                                            <p className="zm-section-label">Paid</p>
                                            <p className="font-display text-xl font-black tracking-tighter text-[#2563EB]">${paidBudget.toLocaleString()}</p>
                                        </div>
                                        <div className="border-l border-[#E2E8F0] pl-4">
                                            <p className="zm-section-label">Organic</p>
                                            <p className="font-display text-xl font-black tracking-tighter text-[#10B981]">${organicBudget.toLocaleString()}</p>
                                        </div>
                                        <div className="border-l border-[#E2E8F0] pl-4">
                                            <p className="zm-section-label">Expected leads</p>
                                            <p className="font-display text-xl font-black tracking-tighter">{totalLeads}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={addChannel} className="zm-btn-secondary text-xs" data-testid="add-channel">
                                            <Sparkle size={12} weight="bold" /> Add channel
                                        </button>
                                        <button onClick={saveChannels} disabled={savingChannels} className="zm-btn-primary text-xs" data-testid="save-channels">
                                            {savingChannels ? "Saving…" : "Save overrides"}
                                        </button>
                                    </div>
                                </div>

                                {/* Stacked paid vs organic bar */}
                                {totalBudget > 0 && (
                                    <div className="px-5 pt-4">
                                        <div className="flex h-3 rounded-full overflow-hidden border border-[#E2E8F0]">
                                            <div className="bg-[#2563EB]" style={{ width: `${(paidBudget / totalBudget) * 100}%` }}></div>
                                            <div className="bg-[#10B981]" style={{ width: `${(organicBudget / totalBudget) * 100}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] font-bold text-[#71717A] mt-1.5">
                                            <span>Paid {totalBudget ? Math.round(paidBudget / totalBudget * 100) : 0}%</span>
                                            <span>Organic {totalBudget ? Math.round(organicBudget / totalBudget * 100) : 0}%</span>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                                <th className="text-left px-5 py-3 zm-section-label">Channel</th>
                                                <th className="text-left px-3 py-3 zm-section-label">Type</th>
                                                <th className="text-right px-3 py-3 zm-section-label">Budget /mo</th>
                                                <th className="text-right px-3 py-3 zm-section-label">Leads /mo</th>
                                                <th className="text-right px-3 py-3 zm-section-label">CPL</th>
                                                <th className="text-left px-3 py-3 zm-section-label">Priority</th>
                                                <th className="text-left px-3 py-3 zm-section-label">Why</th>
                                                <th className="px-3 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {channels.map((c, i) => (
                                                <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0 align-top hover:bg-[#F8FAFC]" data-testid={`channel-row-${i}`}>
                                                    <td className="px-5 py-2.5">
                                                        <input className="zm-input text-sm py-1.5 font-semibold" value={c.name || ""} onChange={(e) => updateChannel(i, { name: e.target.value })} data-testid={`channel-name-${i}`} />
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <select className="zm-input text-xs py-1.5" value={c.type || "organic"} onChange={(e) => updateChannel(i, { type: e.target.value })} data-testid={`channel-type-${i}`}>
                                                            <option value="paid">Paid</option>
                                                            <option value="organic">Organic</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2.5 w-28">
                                                        <input type="number" min="0" className="zm-input text-sm py-1.5 text-right" value={c.monthly_budget_usd || 0} onChange={(e) => updateChannel(i, { monthly_budget_usd: Number(e.target.value) })} data-testid={`channel-budget-${i}`} />
                                                    </td>
                                                    <td className="px-3 py-2.5 w-24">
                                                        <input type="number" min="0" className="zm-input text-sm py-1.5 text-right" value={c.expected_leads_per_month || 0} onChange={(e) => updateChannel(i, { expected_leads_per_month: Number(e.target.value) })} data-testid={`channel-leads-${i}`} />
                                                    </td>
                                                    <td className="px-3 py-2.5 w-20">
                                                        <input type="number" min="0" className="zm-input text-sm py-1.5 text-right" value={c.expected_cpl_usd || 0} onChange={(e) => updateChannel(i, { expected_cpl_usd: Number(e.target.value) })} />
                                                    </td>
                                                    <td className="px-3 py-2.5 w-28">
                                                        <select className="zm-input text-xs py-1.5" value={c.priority || "medium"} onChange={(e) => updateChannel(i, { priority: e.target.value })}>
                                                            <option value="high">High</option>
                                                            <option value="medium">Medium</option>
                                                            <option value="low">Low</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2.5 min-w-[200px] max-w-[300px] text-xs text-[#52525B]">{c.rationale}</td>
                                                    <td className="px-3 py-2.5">
                                                        <button onClick={() => removeChannel(i)} className="text-[#A1A1AA] hover:text-[#2563EB]" data-testid={`channel-remove-${i}`}>
                                                            <ArrowsClockwise size={12} weight="bold" style={{ transform: "rotate(45deg)" }} />×
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Section>
                    )}

                    <Section title="Quarterly themes">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(data.quarterly_themes || []).map((q, i) => (
                                <div key={i} className="zm-card p-5">
                                    <p className="zm-section-label mb-1">{q.quarter}</p>
                                    <h4 className="font-display text-lg font-bold tracking-tight mb-3">{q.theme}</h4>
                                    <p className="text-xs text-[#71717A] mb-3 italic">{q.primary_goal}</p>
                                    <p className="zm-section-label mt-3 mb-1">Targets</p>
                                    <ul className="text-xs space-y-1 mb-3 text-[#0F172A]">
                                        {(q.key_targets || []).map((t, j) => <li key={j}>• {t}</li>)}
                                    </ul>
                                    <p className="zm-section-label mt-3 mb-1">Initiatives</p>
                                    <ul className="text-xs space-y-1 text-[#0F172A]">
                                        {(q.top_3_initiatives || []).map((t, j) => <li key={j}>{j + 1}. {t}</li>)}
                                    </ul>
                                    <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-[10px] uppercase tracking-[0.15em] text-[#71717A] font-bold">
                                        Budget: {q.estimated_budget_band}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Monthly milestones">
                        <div className="zm-card divide-y divide-[#E2E8F0]">
                            {(data.monthly_milestones || []).map((m, i) => (
                                <div key={i} className="px-6 py-4 flex items-center gap-4">
                                    <span className="font-display text-2xl font-black tracking-tighter w-8 text-[#2563EB]">{i + 1}</span>
                                    <span className="text-sm">{m}</span>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Section title="Hiring plan">
                            <div className="zm-card divide-y divide-[#E2E8F0]">
                                {(data.hiring_plan || []).map((h, i) => {
                                    const role = typeof h === "string" ? h : h.role || h.position || "";
                                    const month = typeof h === "object" ? (h.month || h.quarter || "") : "";
                                    return (
                                        <div key={i} className="px-5 py-3 flex items-center justify-between">
                                            <span className="text-sm">{role}</span>
                                            <span className="zm-badge bg-[#F8FAFC] text-[#0F172A]">{month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>

                        <Section title="Marketing mix">
                            <div className="zm-card p-6 space-y-2.5">
                                {Object.entries(data.marketing_mix || {}).map(([ch, pct]) => (
                                    <div key={ch}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="uppercase tracking-[0.12em] font-bold text-[#71717A]">{ch.replace(/_/g, " ")}</span>
                                            <span className="font-mono font-bold">{pct}%</span>
                                        </div>
                                        <div className="h-2 bg-[#F8FAFC] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Section title="Key assumptions">
                            <ul className="zm-card p-6 space-y-2 text-sm text-[#52525B]">
                                {(data.key_assumptions || []).map((a, i) => <li key={i}>• {a}</li>)}
                            </ul>
                        </Section>
                        <Section title="Success KPIs (Month 12)">
                            <ul className="zm-card p-6 space-y-2 text-sm">
                                {(data.success_kpis || []).map((k, i) => <li key={i} className="flex gap-2"><ArrowRight size={14} weight="bold" className="text-[#2563EB] mt-0.5 shrink-0" /> <span>{k}</span></li>)}
                            </ul>
                        </Section>
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiBlock({ label, value }) {
    return (
        <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-bold mb-1">{label}</p>
            <p className="font-display text-base font-black tracking-tighter">{value}</p>
        </div>
    );
}

/* ---------- Shared subcomponents ---------- */
function ActionBar({ title, desc, onClick, loading, cta }) {
    return (
        <div className="zm-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
                <p className="text-sm text-[#71717A] mt-1">{desc}</p>
            </div>
            <button onClick={onClick} disabled={loading} className="zm-btn-primary whitespace-nowrap" data-testid="action-bar-generate">
                {loading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
                {loading ? "Generating…" : cta}
            </button>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h3 className="font-display text-xl font-bold tracking-tight mb-3">{title}</h3>
            {children}
        </div>
    );
}

function Block({ title, children, right }) {
    return (
        <div className={`p-6 ${right ? "" : "border-r border-[#E2E8F0]"}`}>
            <p className="zm-section-label mb-2">{title}</p>
            <p className="text-sm leading-relaxed">{children}</p>
        </div>
    );
}

function ScoreBar({ value }) {
    const v = Math.max(0, Math.min(100, value || 0));
    const color = v >= 70 ? "#10B981" : v >= 40 ? "#F59E0B" : "#71717A";
    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold" style={{ color }}>{v}</span>
            <div className="w-12 h-1 bg-[#F8FAFC]"><div className="h-full" style={{ width: `${v}%`, background: color }} /></div>
        </div>
    );
}
