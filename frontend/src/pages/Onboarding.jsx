import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { setLocaleCache, formatCurrency } from "@/lib/locale";
import { Sparkle, ArrowRight, Globe, CheckCircle, Target, Rocket, ChartLineUp, Users } from "@phosphor-icons/react";

export default function Onboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [url, setUrl] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [countries, setCountries] = useState([]);
    const [form, setForm] = useState({
        business_name: "", industry: "", location: "", target_audience: "",
        website_url: "", description: "", country_code: "US",
    });
    const [saving, setSaving] = useState(false);
    const [goal, setGoal] = useState({
        monthly_lead_target: 50,
        avg_deal_value_usd: 250,
        target_audience_extra: "",
        guarantee_enabled: false,
        guarantee_terms: "",
    });
    const [kickoffLoading, setKickoffLoading] = useState(false);
    const [kickoffStage, setKickoffStage] = useState("");
    const [kickoffResult, setKickoffResult] = useState(null);

    useEffect(() => {
        api.get("/locale/countries").then((r) => setCountries(r.data.countries || [])).catch(() => {});
    }, []);

    const selectedCountry = countries.find((c) => c.code === form.country_code) || { currency: "USD", symbol: "$", locale: "en-US" };
    const localeInfo = { country_code: form.country_code, currency: selectedCountry.currency, symbol: selectedCountry.symbol, locale: selectedCountry.locale };

    const autoFill = async () => {
        if (!url) { toast.error("Enter a URL first"); return; }
        setAnalyzing(true);
        const t = toast.loading("AI is analysing your website…");
        try {
            const r = await api.post("/business/auto-fill", { website_url: url });
            const p = r.data.profile;
            setForm({
                business_name: p.business_name || "",
                industry: p.industry || "",
                location: p.location || "",
                target_audience: p.target_audience || "",
                website_url: p.website_url || url,
                description: p.description || "",
                country_code: p.country_code || form.country_code || "US",
            });
            toast.success("Auto-filled! Review and edit if needed.", { id: t });
            setStep(2);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Auto-fill failed", { id: t });
            setForm({ ...form, website_url: url });
            setStep(2);
        } finally { setAnalyzing(false); }
    };

    const skip = () => {
        setForm({ ...form, website_url: url });
        setStep(2);
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const r = await api.post("/business", form);
            if (r.data.locale) setLocaleCache(r.data.locale);
            toast.success("Profile saved");
            setStep(3);
        } catch {
            toast.error("Save failed");
        } finally { setSaving(false); }
    };

    const runAutopilot = async () => {
        setKickoffLoading(true);
        try {
            setKickoffStage("Saving your lead target…");
            await new Promise((r) => setTimeout(r, 400));
            setKickoffStage("Generating Ideal Customer Profile…");
            await new Promise((r) => setTimeout(r, 200));
            setKickoffStage("Building 12-month plan with paid + organic channel mix…");
            const r = await api.post("/autopilot/kickoff", {
                monthly_lead_target: goal.monthly_lead_target,
                avg_deal_value_usd: goal.avg_deal_value_usd,
                target_audience: goal.target_audience_extra || undefined,
                guarantee_enabled: goal.guarantee_enabled,
                guarantee_terms: goal.guarantee_enabled ? goal.guarantee_terms : null,
            });
            setKickoffStage("Done.");
            setKickoffResult(r.data);
            setStep(4);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Autopilot failed — try again");
        } finally {
            setKickoffLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
            <div className="w-full max-w-3xl">
                <div className="flex items-center gap-2.5 mb-8">
                    <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center rounded-md">
                        <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                    </div>
                    <span className="font-display text-2xl font-black tracking-tight">ZeroMark</span>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 mb-6" data-testid="onboarding-progress">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-[#2563EB]" : "bg-[#E2E8F0]"}`}></div>
                    ))}
                </div>

                <div className="zm-card p-10">
                    <p className="zm-section-label mb-3">// Step {step} of 4 — Onboarding</p>

                    {step === 1 && (
                        <>
                            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-2">
                                Let's start with your website.
                            </h1>
                            <p className="text-sm text-[#64748B] mb-8">
                                We'll AI-scrape your homepage and pre-fill everything. You can always edit afterwards.
                            </p>
                            <div className="space-y-4" data-testid="onboarding-step1">
                                <label className="zm-label">Your website URL</label>
                                <div className="flex gap-2">
                                    <span className="inline-flex items-center px-3 bg-[#F8FAFC] border border-r-0 border-[#E2E8F0] text-[#64748B] rounded-l-md"><Globe size={16} weight="bold" /></span>
                                    <input
                                        type="text" value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="example.com"
                                        className="zm-input flex-1 rounded-l-none"
                                        data-testid="onboarding-url"
                                        onKeyDown={(e) => e.key === "Enter" && autoFill()}
                                    />
                                </div>
                                <button onClick={autoFill} disabled={analyzing || !url} className="zm-btn-primary w-full" data-testid="onboarding-autofill">
                                    <Sparkle size={14} weight="fill" /> {analyzing ? "AI analysing your website…" : "Auto-fill from website"}
                                    {!analyzing && <ArrowRight size={14} weight="bold" />}
                                </button>
                                <button onClick={skip} className="text-xs uppercase tracking-[0.15em] font-bold text-[#64748B] hover:text-[#0F172A] w-full pt-3" data-testid="onboarding-skip">
                                    Skip — I'll fill manually
                                </button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-2">
                                Confirm your business profile.
                            </h1>
                            <p className="text-sm text-[#64748B] mb-8">
                                These details power every AI generation, lead score and growth plan.
                            </p>
                            <form onSubmit={saveProfile} className="space-y-4" data-testid="onboarding-step2">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="zm-label">Business name *</label>
                                        <input required className="zm-input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="onb-business-name" />
                                    </div>
                                    <div>
                                        <label className="zm-label">Industry *</label>
                                        <input required className="zm-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} data-testid="onb-industry" />
                                    </div>
                                    <div>
                                        <label className="zm-label">Location *</label>
                                        <input required className="zm-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="onb-location" />
                                    </div>
                                    <div>
                                        <label className="zm-label">Website URL</label>
                                        <input className="zm-input" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} data-testid="onb-website" />
                                    </div>
                                </div>
                                <div>
                                    <label className="zm-label">Target audience *</label>
                                    <input required className="zm-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. Series A SaaS founders in India" data-testid="onb-audience" />
                                </div>
                                <div>
                                    <label className="zm-label">What do you sell?</label>
                                    <textarea rows={3} className="zm-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="onb-description" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setStep(1)} className="zm-btn-secondary">Back</button>
                                    <button type="submit" disabled={saving} className="zm-btn-primary flex-1" data-testid="onb-submit">
                                        {saving ? "Saving…" : "Continue"} <ArrowRight size={14} weight="bold" />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-2">
                                What's your goal this month?
                            </h1>
                            <p className="text-sm text-[#64748B] mb-8">
                                Tell us your lead target — we'll build a 12-month plan, identify your ideal customer, and distribute your budget across paid &amp; organic channels.
                            </p>
                            <div className="space-y-5" data-testid="onboarding-step3">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="zm-label flex items-center gap-1.5"><Target size={12} weight="bold" /> Monthly lead target</label>
                                        <input type="number" min="1" className="zm-input text-2xl font-bold" value={goal.monthly_lead_target}
                                            onChange={(e) => setGoal({ ...goal, monthly_lead_target: parseInt(e.target.value) || 0 })}
                                            data-testid="onb-lead-target" />
                                        <p className="text-[11px] text-[#64748B] mt-1">How many qualified leads/month?</p>
                                    </div>
                                    <div>
                                        <label className="zm-label flex items-center gap-1.5"><ChartLineUp size={12} weight="bold" /> Avg deal value ({selectedCountry.currency})</label>
                                        <input type="number" min="0" className="zm-input text-2xl font-bold" value={goal.avg_deal_value_usd}
                                            onChange={(e) => setGoal({ ...goal, avg_deal_value_usd: parseFloat(e.target.value) || 0 })}
                                            data-testid="onb-deal-value" />
                                        <p className="text-[11px] text-[#64748B] mt-1">Avg revenue per closed customer</p>
                                    </div>
                                </div>

                                <div className="bg-[#F8FAFC] rounded-md p-4 border border-[#E2E8F0]">
                                    <p className="zm-section-label mb-2">// Forecast (in {selectedCountry.currency})</p>
                                    <p className="font-display text-3xl font-black tracking-tight">
                                        {formatCurrency(goal.monthly_lead_target * goal.avg_deal_value_usd, localeInfo)}
                                        <span className="text-sm font-semibold text-[#64748B] ml-2">/month revenue target</span>
                                    </p>
                                </div>

                                <div>
                                    <label className="zm-label flex items-center gap-1.5"><Users size={12} weight="bold" /> Add specifics about your ideal customer (optional)</label>
                                    <textarea rows={2} className="zm-input" value={goal.target_audience_extra}
                                        onChange={(e) => setGoal({ ...goal, target_audience_extra: e.target.value })}
                                        placeholder="e.g. Real-estate agents in Bengaluru with 5+ team members, or D2C founders doing $500K+ ARR"
                                        data-testid="onb-audience-extra" />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setStep(2)} className="zm-btn-secondary">Back</button>
                                    <button onClick={runAutopilot} disabled={kickoffLoading || goal.monthly_lead_target < 1} className="zm-btn-primary flex-1" data-testid="onb-autopilot">
                                        <Rocket size={14} weight="fill" />
                                        {kickoffLoading ? (kickoffStage || "Running…") : "Build my plan with Autopilot"}
                                        {!kickoffLoading && <ArrowRight size={14} weight="bold" />}
                                    </button>
                                </div>
                                {kickoffLoading && (
                                    <div className="text-center text-xs text-[#64748B] font-semibold animate-pulse">
                                        {kickoffStage}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {step === 4 && kickoffResult && (
                        <>
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle size={20} weight="fill" className="text-[#10B981]" />
                                <p className="zm-section-label text-[#10B981]">// Autopilot ready</p>
                            </div>
                            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-2">
                                Your growth engine is live.
                            </h1>
                            <p className="text-sm text-[#64748B] mb-8">
                                Here's what we built. You can edit any of this from inside the app.
                            </p>
                            <div className="space-y-4" data-testid="onboarding-step4">
                                <Summary label="Monthly lead target"
                                    value={`${kickoffResult.lead_target.monthly_lead_target} leads · ${formatCurrency(kickoffResult.lead_target.monthly_revenue_target_usd, localeInfo)}/mo`} />
                                {kickoffResult.icp?.persona?.title && (
                                    <Summary label="Ideal customer"
                                        value={`${kickoffResult.icp.persona.title}${kickoffResult.icp.firmographics?.company_size_range ? ` · ${kickoffResult.icp.firmographics.company_size_range}` : ""}`} />
                                )}
                                {kickoffResult.plan?.north_star_metric && (
                                    <Summary label="North-star metric" value={kickoffResult.plan.north_star_metric} />
                                )}
                                {kickoffResult.plan?.channel_distribution && (
                                    <Summary label="Channels"
                                        value={`${kickoffResult.plan.channel_distribution.length} configured (${kickoffResult.plan.channel_distribution.filter(c => c.type === "paid").length} paid, ${kickoffResult.plan.channel_distribution.filter(c => c.type === "organic").length} organic)`} />
                                )}
                                <button onClick={() => navigate("/dashboard")} className="zm-btn-primary w-full mt-4" data-testid="onb-go-dashboard">
                                    Go to Dashboard <ArrowRight size={14} weight="bold" />
                                </button>
                                <p className="text-[11px] text-[#64748B] text-center font-semibold">
                                    Next: head to <span className="text-[#2563EB]">Lead Discovery</span> to find your first prospects, then <span className="text-[#2563EB]">Campaigns</span> to draft your outreach.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Summary({ label, value }) {
    return (
        <div className="bg-[#F8FAFC] rounded-md p-4 border border-[#E2E8F0]">
            <p className="zm-section-label mb-1">{label}</p>
            <p className="text-base font-bold text-[#0F172A]">{value}</p>
        </div>
    );
}
