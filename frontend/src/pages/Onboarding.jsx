import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Sparkle, ArrowRight, Globe, CheckCircle } from "@phosphor-icons/react";

export default function Onboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [url, setUrl] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [form, setForm] = useState({
        business_name: "", industry: "", location: "", target_audience: "",
        website_url: "", description: "",
    });
    const [saving, setSaving] = useState(false);

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

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post("/business", form);
            toast.success("Profile saved. Welcome to ZeroMark.");
            navigate("/dashboard");
        } catch (err) {
            toast.error("Save failed");
        } finally { setSaving(false); }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-[#2563EB] flex items-center justify-center">
                        <Sparkle size={18} weight="fill" className="text-white" />
                    </div>
                    <span className="font-display text-xl font-black tracking-tighter">ZEROMARK</span>
                </div>

                <div className="zm-card p-10">
                    <p className="zm-section-label mb-3">// Step {step} of 2 — Onboarding</p>
                    <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] mb-2">
                        {step === 1 ? "Let's start with your website." : "Confirm your business profile."}
                    </h1>
                    <p className="text-sm text-[#71717A] mb-8">
                        {step === 1
                            ? "We'll AI-scrape your homepage and pre-fill everything. You can always edit afterwards."
                            : "These details power every AI generation, lead score and growth plan."}
                    </p>

                    {step === 1 ? (
                        <div className="space-y-4" data-testid="onboarding-step1">
                            <label className="zm-label">Your website URL</label>
                            <div className="flex gap-2">
                                <span className="inline-flex items-center px-3 bg-[#F8FAFC] border border-r-0 border-[#E2E8F0] text-[#71717A]"><Globe size={16} weight="bold" /></span>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="example.com"
                                    className="zm-input flex-1"
                                    data-testid="onboarding-url"
                                    onKeyDown={(e) => e.key === "Enter" && autoFill()}
                                />
                            </div>
                            <button onClick={autoFill} disabled={analyzing || !url} className="zm-btn-primary w-full" data-testid="onboarding-autofill">
                                <Sparkle size={14} weight="fill" /> {analyzing ? "AI analysing your website…" : "Auto-fill from website"}
                                {!analyzing && <ArrowRight size={14} weight="bold" />}
                            </button>
                            <button onClick={skip} className="text-xs uppercase tracking-[0.15em] font-bold text-[#71717A] hover:text-[#0F172A] w-full pt-3" data-testid="onboarding-skip">
                                Skip — I'll fill manually
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={save} className="space-y-4" data-testid="onboarding-step2">
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
                                <input required className="zm-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} data-testid="onb-audience" />
                            </div>
                            <div>
                                <label className="zm-label">Description</label>
                                <textarea rows={3} className="zm-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="onb-description" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setStep(1)} className="zm-btn-secondary">Back</button>
                                <button type="submit" disabled={saving} className="zm-btn-primary flex-1" data-testid="onb-submit">
                                    {saving ? "Saving…" : "Save & enter ZeroMark"} <CheckCircle size={14} weight="bold" />
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
