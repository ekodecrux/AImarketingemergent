import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

export default function Business() {
    const [form, setForm] = useState({
        business_name: "", industry: "", location: "", target_audience: "",
        website_url: "", description: "",
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

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
            await api.post("/business", form);
            toast.success("Profile saved");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <PageHeader eyebrow="// Identity" title="Business Profile" subtitle="The single source of truth ZeroMark uses to generate AI content." />
            <div className="px-8 py-6 max-w-3xl">
                <form onSubmit={submit} className="zm-card p-8 space-y-5" data-testid="business-form">
                    {loading && <p className="text-sm text-[#A1A1AA]">Loading…</p>}
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
                            <label className="zm-label">Website URL</label>
                            <input className="zm-input" value={form.website_url || ""} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://…" data-testid="business-website" />
                        </div>
                    </div>

                    <div>
                        <label className="zm-label">Target Audience *</label>
                        <input required className="zm-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="Mid-market e-commerce founders" data-testid="business-audience" />
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
