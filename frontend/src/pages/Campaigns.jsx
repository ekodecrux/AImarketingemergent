import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { ModalShell } from "@/pages/Leads";
import { Plus, PaperPlaneTilt, Sparkle, Trash, EnvelopeSimple, ChatCircle, WhatsappLogo, FacebookLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react";

const CHANNELS = [
    { v: "EMAIL", label: "Email", icon: EnvelopeSimple },
    { v: "SMS", label: "SMS", icon: ChatCircle },
    { v: "WHATSAPP", label: "WhatsApp", icon: WhatsappLogo },
    { v: "FACEBOOK", label: "Facebook", icon: FacebookLogo },
    { v: "INSTAGRAM", label: "Instagram", icon: InstagramLogo },
    { v: "LINKEDIN", label: "LinkedIn", icon: LinkedinLogo },
];

const STATUS_STYLES = {
    PENDING_APPROVAL: "bg-[#F59E0B] text-white",
    APPROVED: "bg-[#002EB8] text-white",
    REJECTED: "bg-[#E32636] text-white",
    SENT: "bg-[#10B981] text-white",
    FAILED: "bg-[#18181B] text-white",
    MODIFIED: "bg-[#002EB8] text-white",
};

export default function Campaigns() {
    const [items, setItems] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        api.get("/campaigns").then((r) => setItems(r.data.campaigns)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const sendCampaign = async (id) => {
        const t = toast.loading("Sending campaign…");
        try {
            const r = await api.post(`/campaigns/${id}/send`);
            toast.success(`Sent to ${r.data.sent} recipients`, { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Send failed", { id: t });
        }
    };

    const deleteCampaign = async (id) => {
        await api.delete(`/campaigns/${id}`);
        toast.success("Campaign deleted");
        load();
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Outreach"
                title="Campaigns"
                subtitle={`${items.length} total`}
                action={
                    <button data-testid="new-campaign-button" onClick={() => setShowCreate(true)} className="zm-btn-primary">
                        <Plus size={14} weight="bold" /> New Campaign
                    </button>
                }
            />
            <div className="px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 zm-card" data-testid="campaigns-grid">
                    {loading && <div className="p-12 text-[#A1A1AA] text-sm">Loading…</div>}
                    {!loading && items.length === 0 && (
                        <div className="p-12 col-span-full text-center">
                            <p className="text-[#A1A1AA] text-sm mb-4">No campaigns yet.</p>
                            <button onClick={() => setShowCreate(true)} className="zm-btn-primary">
                                <Plus size={14} weight="bold" /> Create your first
                            </button>
                        </div>
                    )}
                    {items.map((c, i) => {
                        const ch = CHANNELS.find((x) => x.v === c.channel) || CHANNELS[0];
                        return (
                            <div
                                key={c.id}
                                data-testid={`campaign-card-${c.id}`}
                                className={`p-6 border-[#E4E4E7] ${i % 3 !== 2 ? "lg:border-r" : ""} ${i % 2 !== 1 ? "md:border-r" : ""} border-b`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 bg-[#F4F4F5] flex items-center justify-center">
                                        <ch.icon size={18} weight="bold" />
                                    </div>
                                    <span className={`zm-badge ${STATUS_STYLES[c.status] || "bg-[#F4F4F5] text-[#09090B]"}`}>
                                        {c.status}
                                    </span>
                                </div>
                                <h3 className="font-display text-lg font-bold tracking-tight mb-1 line-clamp-1">{c.name}</h3>
                                <p className="text-xs text-[#71717A] mb-3">{c.channel} · {c.type}</p>
                                <p className="text-sm text-[#71717A] line-clamp-3 min-h-[60px]">{c.content}</p>
                                <p className="text-xs text-[#A1A1AA] mt-4 mb-4">
                                    Sent: {c.sent_count || 0} · Failed: {c.failed_count || 0}
                                </p>
                                <div className="flex gap-2">
                                    {(c.status === "APPROVED" || c.status === "MODIFIED") && (
                                        <button onClick={() => sendCampaign(c.id)} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`send-campaign-${c.id}`}>
                                            <PaperPlaneTilt size={12} weight="bold" /> Send Now
                                        </button>
                                    )}
                                    <button onClick={() => deleteCampaign(c.id)} className="zm-btn-secondary text-xs py-2" data-testid={`delete-campaign-${c.id}`}>
                                        <Trash size={12} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        </div>
    );
}

function CreateCampaignModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: "", type: "EMAIL_BLAST", channel: "EMAIL", content: "", subject: "" });
    const [aiOpen, setAiOpen] = useState(false);
    const [aiData, setAiData] = useState({ goal: "", tone: "professional", audience: "", product: "" });
    const [aiLoading, setAiLoading] = useState(false);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        if (!aiData.goal) { toast.error("Set a goal first"); return; }
        setAiLoading(true);
        try {
            const r = await api.post("/ai/generate-content", { ...aiData, channel: form.channel });
            setForm((f) => ({ ...f, content: r.data.content, subject: r.data.subject || f.subject }));
            toast.success("Generated by Groq AI");
            setAiOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.detail || "AI failed");
        } finally {
            setAiLoading(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const typeFromChannel = {
                EMAIL: "EMAIL_BLAST", SMS: "SMS_BLAST", WHATSAPP: "WHATSAPP",
                FACEBOOK: "SOCIAL_POST", INSTAGRAM: "SOCIAL_POST", LINKEDIN: "SOCIAL_POST",
            }[form.channel];
            await api.post("/campaigns", { ...form, type: typeFromChannel });
            toast.success("Campaign sent for approval");
            onCreated();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Create failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell title="New Campaign" eyebrow="// Compose & route" onClose={onClose} size="lg">
            <form onSubmit={submit} className="space-y-5" data-testid="create-campaign-form">
                <div>
                    <label className="zm-label">Campaign Name</label>
                    <input required className="zm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="campaign-name" />
                </div>

                <div>
                    <label className="zm-label">Channel</label>
                    <div className="grid grid-cols-3 gap-2">
                        {CHANNELS.map((c) => (
                            <button
                                key={c.v} type="button"
                                onClick={() => setForm({ ...form, channel: c.v })}
                                data-testid={`channel-${c.v}`}
                                className={`flex flex-col items-center gap-1 px-2 py-3 border text-xs uppercase tracking-[0.1em] font-bold ${
                                    form.channel === c.v ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#09090B]"
                                }`}
                            >
                                <c.icon size={18} weight="bold" />
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {form.channel === "EMAIL" && (
                    <div>
                        <label className="zm-label">Subject Line</label>
                        <input className="zm-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="campaign-subject" />
                    </div>
                )}

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="zm-label mb-0">Content</label>
                        <button type="button" onClick={() => setAiOpen(!aiOpen)} className="text-xs uppercase tracking-[0.15em] font-bold text-[#002EB8] hover:underline flex items-center gap-1" data-testid="toggle-ai-panel">
                            <Sparkle size={12} weight="fill" /> AI Generate
                        </button>
                    </div>
                    {aiOpen && (
                        <div className="bg-[#F4F4F5] border-l-2 border-[#002EB8] p-4 mb-3 space-y-3">
                            <div>
                                <label className="zm-label">Goal</label>
                                <input className="zm-input" placeholder="e.g., Book a free demo" value={aiData.goal} onChange={(e) => setAiData({ ...aiData, goal: e.target.value })} data-testid="ai-goal" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="zm-label">Tone</label>
                                    <select className="zm-input" value={aiData.tone} onChange={(e) => setAiData({ ...aiData, tone: e.target.value })} data-testid="ai-tone">
                                        {["professional", "friendly", "urgent", "playful", "luxurious"].map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="zm-label">Product / Offer</label>
                                    <input className="zm-input" value={aiData.product} onChange={(e) => setAiData({ ...aiData, product: e.target.value })} data-testid="ai-product" />
                                </div>
                            </div>
                            <button type="button" onClick={generate} disabled={aiLoading} className="zm-btn-dark w-full" data-testid="ai-generate-button">
                                <Sparkle size={14} weight="fill" /> {aiLoading ? "Generating with Groq…" : "Generate with Groq AI"}
                            </button>
                        </div>
                    )}
                    <textarea required rows={8} className="zm-input font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write or generate content. Use {{name}} {{email}} {{company}} for personalisation." data-testid="campaign-content" />
                </div>

                <p className="text-xs text-[#71717A] bg-[#F4F4F5] p-3 border-l-2 border-[#F59E0B]">
                    Campaigns require approval before sending. They land in the Approvals queue.
                </p>

                <div className="flex gap-3">
                    <button type="submit" disabled={loading} className="zm-btn-primary flex-1" data-testid="submit-campaign">
                        {loading ? "Creating…" : "Send for approval"}
                    </button>
                    <button type="button" onClick={onClose} className="zm-btn-secondary">Cancel</button>
                </div>
            </form>
        </ModalShell>
    );
}
