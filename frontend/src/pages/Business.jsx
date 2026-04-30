import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Sparkle, Globe } from "@phosphor-icons/react";

export default function Business() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        business_name: "", industry: "", location: "", target_audience: "",
        website_url: "", description: "",
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoFilling, setAutoFilling] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get("/business")
            .then((r) => { if (r.data.profile) setForm({ ...form, ...r.data.profile }); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const r = await api.post("/business", form);
            if (r.data?.plan_regenerating) {
                // Signal the Plan Overview to start polling, then redirect
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
            setForm({
                ...form,
                business_name: p.business_name || form.business_name,
                industry: p.industry || form.industry,
                location: p.location || form.location,
                target_audience: p.target_audience || form.target_audience,
                description: p.description || form.description,
                website_url: p.website_url || form.website_url,
            });
            toast.success("Auto-filled — review and save", { id: t });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Auto-fill failed", { id: t });
        } finally {
            setAutoFilling(false);
        }
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Identity"
                title="Business Profile"
                subtitle="The single source of truth ZeroMark uses for AI generation, lead scoring and growth plans."
                action={
                    <button onClick={autoFill} disabled={autoFilling} className="zm-btn-dark" data-testid="business-autofill">
                        <Sparkle size={14} weight="fill" /> {autoFilling ? "Analysing…" : "Auto-fill from URL"}
                    </button>
                }
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
                <form onSubmit={submit} className="zm-card p-8 space-y-5" data-testid="business-form">
                    {loading && <p className="text-sm text-[#A1A1AA]">Loading…</p>}
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
                            <label className="zm-label">Location *</label>
                            <input required className="zm-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bangalore, India" data-testid="business-location" />
                        </div>
                        <div>
                            <label className="zm-label">Target Audience *</label>
                            <input required className="zm-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="Mid-market e-commerce founders" data-testid="business-audience" />
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
