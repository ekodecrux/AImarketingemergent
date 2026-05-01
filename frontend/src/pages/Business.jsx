import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Sparkle, Globe, CurrencyCircleDollar } from "@phosphor-icons/react";
import { COUNTRIES, CURRENCY_OPTIONS, defaultCurrencyFor, symbolFor } from "@/lib/countries";
import { setLocaleCache } from "@/lib/locale";

export default function Business() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        business_name: "", industry: "", location: "", target_audience: "",
        website_url: "", description: "",
        country_code: "IN",
        currency_code: "INR",
    });
    const [currencyOverridden, setCurrencyOverridden] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoFilling, setAutoFilling] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get("/business")
            .then((r) => {
                if (r.data.profile) {
                    const p = r.data.profile;
                    setForm((f) => ({
                        ...f, ...p,
                        country_code: (p.country_code || "IN").toUpperCase(),
                        currency_code: (p.currency_code || defaultCurrencyFor(p.country_code) || "INR").toUpperCase(),
                    }));
                    if (p.currency_code && p.country_code && p.currency_code !== defaultCurrencyFor(p.country_code)) {
                        setCurrencyOverridden(true);
                    }
                }
            })
            .finally(() => setLoading(false));
    }, []);

    // Whenever country changes (and currency NOT manually overridden), auto-set currency
    const onCountryChange = (cc) => {
        const upper = cc.toUpperCase();
        setForm((f) => ({
            ...f,
            country_code: upper,
            currency_code: currencyOverridden ? f.currency_code : defaultCurrencyFor(upper),
        }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const r = await api.post("/business", form);
            // Update locale cache so Growth Studio + Wallet + Reports immediately use the new currency
            if (r.data?.locale) setLocaleCache(r.data.locale);
            if (r.data?.plan_regenerating) {
                sessionStorage.setItem("plan_bg_regen", "1");
                toast.success("Profile saved · Regenerating ICP, market, SEO, PR & roadmap in background…");
                navigate("/growth?tab=overview");
            } else {
                toast.success("Profile saved");
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const autoFill = async () => {
        if (!form.website_url) { toast.error("Add a website URL first"); return; }
        setAutoFilling(true);
        const t = toast.loading("AI analysing your website…");
        try {
            const r = await api.post("/business/auto-fill", { website_url: form.website_url });
            const p = r.data.profile;
            setForm((f) => ({
                ...f,
                business_name: p.business_name || f.business_name,
                industry: p.industry || f.industry,
                location: p.location || f.location,
                target_audience: p.target_audience || f.target_audience,
                description: p.description || f.description,
                website_url: p.website_url || f.website_url,
                country_code: (p.country_code || f.country_code || "IN").toUpperCase(),
                currency_code: (p.currency_code || f.currency_code || defaultCurrencyFor(p.country_code) || "INR").toUpperCase(),
            }));
            toast.success("Auto-filled — review and save", { id: t });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Auto-fill failed", { id: t });
        } finally {
            setAutoFilling(false);
        }
    };

    const sym = symbolFor(form.currency_code);

    return (
        <div>
            <PageHeader
                eyebrow="// Identity"
                title="Business Profile"
                subtitle="The single source of truth ZeroMark uses for AI generation, lead scoring, growth plans and every monetary value across the app."
                action={
                    <button onClick={autoFill} disabled={autoFilling} className="zm-btn-dark" data-testid="business-autofill">
                        <Sparkle size={14} weight="fill" /> {autoFilling ? "Analysing…" : "Auto-fill from URL"}
                    </button>
                }
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
                <form onSubmit={submit} className="zm-card p-8 space-y-5" data-testid="business-form">
                    {loading && <p className="text-sm text-[#A1A1AA]">Loading…</p>}

                    {/* Website URL */}
                    <div>
                        <label className="zm-label">Website URL</label>
                        <div className="flex gap-2">
                            <span className="inline-flex items-center px-3 bg-[#F8FAFC] border border-r-0 border-[#D4D4D8] text-[#71717A] rounded-sm">
                                <Globe size={16} weight="bold" />
                            </span>
                            <input className="zm-input flex-1" value={form.website_url || ""} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://yourcompany.com" data-testid="business-website" />
                        </div>
                        <p className="text-xs text-[#71717A] mt-1.5">Add your URL → click "Auto-fill from URL" above to have AI populate everything below.</p>
                    </div>

                    {/* Identity */}
                    <div className="grid md:grid-cols-2 gap-5">
                        <div>
                            <label className="zm-label">Business Name *</label>
                            <input required className="zm-input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="business-name" />
                        </div>
                        <div>
                            <label className="zm-label">Industry *</label>
                            <input required className="zm-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="SaaS, Healthcare, …" data-testid="business-industry" />
                        </div>
                        <div>
                            <label className="zm-label">City *</label>
                            <input required className="zm-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bangalore, Mumbai, Delhi, …" data-testid="business-location" />
                        </div>
                        <div>
                            <label className="zm-label">Target Audience *</label>
                            <input required className="zm-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="Mid-market e-commerce founders" data-testid="business-audience" />
                        </div>
                    </div>

                    {/* Currency block — primary focus per user feedback */}
                    <div className="rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3" data-testid="business-locale-block">
                        <div className="flex items-center gap-2">
                            <CurrencyCircleDollar size={16} weight="bold" className="text-[#2563EB]" />
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold">// Country & Currency</p>
                            <span className="ml-auto zm-badge bg-[#DBEAFE] text-[#1D4ED8] text-[10px]">Powers Growth Studio · Reports · Wallet · Billing</span>
                        </div>
                        <p className="text-xs text-[#71717A]">
                            Every monetary value across ZeroMark — guaranteed leads, channel mix, ad budgets, wallet, invoices — uses what you pick here. Pick once, it sticks.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="zm-label">Country *</label>
                                <select
                                    required
                                    className="zm-input bg-white"
                                    value={form.country_code}
                                    onChange={(e) => onCountryChange(e.target.value)}
                                    data-testid="business-country"
                                >
                                    {COUNTRIES.map((c) => (
                                        <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="zm-label flex items-center gap-1">
                                    Currency
                                    <span className="text-[10px] text-[#71717A] normal-case font-normal">· auto-set from country (override if needed)</span>
                                </label>
                                <select
                                    className="zm-input bg-white"
                                    value={form.currency_code}
                                    onChange={(e) => { setForm({ ...form, currency_code: e.target.value }); setCurrencyOverridden(true); }}
                                    data-testid="business-currency"
                                >
                                    {CURRENCY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c} ({symbolFor(c)})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="text-xs text-[#0F172A] flex items-center gap-2">
                            Preview · monthly budget will display as
                            <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E2E8F0]" data-testid="currency-preview">{sym}5,000 / month</span>
                        </p>
                    </div>

                    {/* Sprint A — AT-01: Approval workflows (per-channel) */}
                    <div className="rounded-sm border border-[#E2E8F0] bg-[#FFFBEB] p-4 space-y-3" data-testid="business-approvals-block">
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold">// Auto-publish guardrails</p>
                            <span className="ml-auto zm-badge bg-[#FEF3C7] text-[#92400E] text-[10px]">Trust & Safety</span>
                        </div>
                        <p className="text-xs text-[#71717A]">
                            Toggle ON for any channel where YOU want to review every post before it goes out. Email & Paid Ads default ON for safety; social/blog default OFF for speed.
                        </p>
                        <div className="grid md:grid-cols-2 gap-3">
                            {[
                                { key: "approval_required_blog", label: "Require approval · Blog posts", desc: "SEO blog goes live only after you click Approve" },
                                { key: "approval_required_social", label: "Require approval · Social posts", desc: "LinkedIn / X / Facebook / Instagram posts" },
                                { key: "approval_required_email", label: "Require approval · Email broadcasts", desc: "Email + WhatsApp campaigns to your CRM" },
                                { key: "approval_required_paid", label: "Require approval · Paid Ads", desc: "Real ad campaigns charging your wallet" },
                            ].map((t) => (
                                <label key={t.key} className="flex items-start gap-2 p-2 bg-white rounded-sm border border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC]">
                                    <input
                                        type="checkbox"
                                        checked={!!form[t.key]}
                                        onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
                                        className="mt-0.5"
                                        data-testid={`toggle-${t.key}`}
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-[#0F172A]">{t.label}</p>
                                        <p className="text-[10px] text-[#71717A]">{t.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Sprint B — CQ-02: Brand Voice Profile */}
                    <div className="rounded-sm border border-[#E2E8F0] bg-[#F0FDF4] p-4 space-y-3" data-testid="business-voice-block">
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold">// Brand voice (optional, recommended)</p>
                            <span className="ml-auto zm-badge bg-[#DCFCE7] text-[#166534] text-[10px]">Injected into every AI prompt</span>
                        </div>
                        <p className="text-xs text-[#71717A]">
                            Fill these and ZeroMark stops sounding like generic AI. Every blog, social post, and email picks up your tone automatically.
                        </p>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="zm-label">Tone</label>
                                <select
                                    className="zm-input bg-white"
                                    value={form.brand_tone || ""}
                                    onChange={(e) => setForm({ ...form, brand_tone: e.target.value })}
                                    data-testid="business-tone"
                                >
                                    <option value="">— pick one —</option>
                                    <option value="professional">Professional</option>
                                    <option value="casual">Casual / Friendly</option>
                                    <option value="witty">Witty / Sharp</option>
                                    <option value="empathetic">Empathetic / Supportive</option>
                                    <option value="bold">Bold / Provocative</option>
                                    <option value="academic">Academic / Authoritative</option>
                                </select>
                            </div>
                            <div>
                                <label className="zm-label">Forbidden words/phrases (comma-separated)</label>
                                <input
                                    className="zm-input bg-white"
                                    value={(form.brand_forbidden_words || []).join(", ")}
                                    onChange={(e) => setForm({ ...form, brand_forbidden_words: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                    placeholder="leverage, synergy, in this fast-paced world"
                                    data-testid="business-forbidden-words"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="zm-label">Example sentences you like (one per line, max 3)</label>
                            <textarea
                                rows={3}
                                className="zm-input bg-white"
                                value={(form.brand_voice_examples || []).join("\n")}
                                onChange={(e) => setForm({ ...form, brand_voice_examples: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3) })}
                                placeholder="We don't sell software. We sell back the time founders waste on plumbing.&#10;Most marketers chase impressions. We track only what you can deposit in a bank."
                                data-testid="business-voice-examples"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="zm-label">Description</label>
                        <textarea rows={4} className="zm-input" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does your business do? What problem do you solve?" data-testid="business-description" />
                    </div>

                    <div className="flex justify-end pt-3">
                        <button disabled={saving} className="zm-btn-primary" data-testid="business-save">
                            {saving ? "Saving…" : "Save Profile"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
