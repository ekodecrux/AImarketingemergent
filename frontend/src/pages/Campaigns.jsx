import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { ModalShell } from "@/pages/Leads";
import { Plus, PaperPlaneTilt, Sparkle, Trash, Copy, PencilSimple, EnvelopeSimple, ChatCircle, WhatsappLogo, FacebookLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react";

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
    APPROVED: "bg-[#2563EB] text-white",
    REJECTED: "bg-[#E32636] text-white",
    SENT: "bg-[#10B981] text-white",
    FAILED: "bg-[#27272A] text-white",
    MODIFIED: "bg-[#2563EB] text-white",
};

export default function Campaigns() {
    const [items, setItems] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null); // campaign object being edited
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
            toast.success(r.data?.message || `Queued for delivery`, { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Send failed", { id: t });
        }
    };

    const duplicateCampaign = async (id) => {
        const t = toast.loading("Duplicating…");
        try {
            await api.post(`/campaigns/${id}/duplicate`);
            toast.success("Duplicated — edit & send for approval", { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Duplicate failed", { id: t });
        }
    };

    const deleteCampaign = async (id) => {
        if (!window.confirm("Delete this campaign?")) return;
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
            <div className="px-4 sm:px-6 lg:px-8 py-6">
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
                                className={`p-6 border-[#E2E8F0] ${i % 3 !== 2 ? "lg:border-r" : ""} ${i % 2 !== 1 ? "md:border-r" : ""} border-b`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 bg-[#F8FAFC] flex items-center justify-center">
                                        <ch.icon size={18} weight="bold" />
                                    </div>
                                    <span className={`zm-badge ${STATUS_STYLES[c.status] || "bg-[#F8FAFC] text-[#0F172A]"}`}>
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
                                    {c.status === "PENDING_APPROVAL" && (
                                        <button onClick={() => setEditing(c)} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`edit-campaign-${c.id}`}>
                                            <PencilSimple size={12} weight="bold" /> Edit
                                        </button>
                                    )}
                                    {(c.status === "APPROVED" || c.status === "MODIFIED") && (
                                        <button onClick={() => sendCampaign(c.id)} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`send-campaign-${c.id}`}>
                                            <PaperPlaneTilt size={12} weight="bold" /> Send Now
                                        </button>
                                    )}
                                    {(c.status === "SENT" || c.status === "FAILED") && (
                                        <button onClick={() => duplicateCampaign(c.id)} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`rerun-campaign-${c.id}`}>
                                            <Copy size={12} weight="bold" /> Rerun
                                        </button>
                                    )}
                                    <button onClick={() => duplicateCampaign(c.id)} className="zm-btn-secondary text-xs py-2" title="Duplicate" data-testid={`duplicate-campaign-${c.id}`}>
                                        <Copy size={12} weight="bold" />
                                    </button>
                                    <button onClick={() => deleteCampaign(c.id)} className="zm-btn-secondary text-xs py-2" title="Delete" data-testid={`delete-campaign-${c.id}`}>
                                        <Trash size={12} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
            {editing && <EditCampaignModal campaign={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
        </div>
    );
}

function EditCampaignModal({ campaign, onClose, onSaved }) {
    const [form, setForm] = useState({
        name: campaign.name || "",
        channel: campaign.channel || "EMAIL",
        subject: campaign.subject || "",
        content: campaign.content || "",
        recipient_scope: campaign.recipient_scope || "all_leads",
        recipient_statuses: campaign.recipient_statuses || [],
        recipient_lead_ids: campaign.recipient_lead_ids || [],
        extra_recipients_raw: (campaign.extra_recipients || []).join(", "),
    });
    const [saving, setSaving] = useState(false);
    const [leadsPreview, setLeadsPreview] = useState({ total: 0, leads: [] });

    useEffect(() => {
        api.get("/leads", { params: { limit: 100, page: 1 } })
            .then((r) => setLeadsPreview({ total: r.data?.pagination?.total || 0, leads: r.data?.leads || [] }))
            .catch(() => setLeadsPreview({ total: 0, leads: [] }));
    }, []);

    const toggleStatus = (s) => setForm((f) => ({
        ...f,
        recipient_statuses: f.recipient_statuses.includes(s) ? f.recipient_statuses.filter((x) => x !== s) : [...f.recipient_statuses, s],
    }));
    const toggleLead = (id) => setForm((f) => ({
        ...f,
        recipient_lead_ids: f.recipient_lead_ids.includes(id) ? f.recipient_lead_ids.filter((x) => x !== id) : [...f.recipient_lead_ids, id],
    }));

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const extras = (form.extra_recipients_raw || "")
                .split(/[,\n\s;]+/).map((s) => s.trim()).filter(Boolean);
            await api.patch(`/campaigns/${campaign.id}`, {
                name: form.name,
                channel: form.channel,
                subject: form.subject,
                content: form.content,
                recipient_scope: form.recipient_scope,
                recipient_statuses: form.recipient_scope === "by_status" ? form.recipient_statuses : null,
                recipient_lead_ids: form.recipient_scope === "selected" ? form.recipient_lead_ids : null,
                extra_recipients: extras.length ? extras : null,
            });
            toast.success("Campaign updated");
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Update failed");
        } finally {
            setSaving(false);
        }
    };

    const extraPlaceholder = form.channel === "EMAIL" ? "extra@example.com, …" : "+911234567890, …";

    return (
        <ModalShell title="Edit campaign" eyebrow="// Pending approval" onClose={onClose} size="lg">
            <form onSubmit={submit} className="space-y-5" data-testid="edit-campaign-form">
                <div>
                    <label className="zm-label">Campaign Name</label>
                    <input required className="zm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="edit-campaign-name" />
                </div>
                <div>
                    <label className="zm-label">Channel</label>
                    <div className="grid grid-cols-3 gap-2">
                        {CHANNELS.map((c) => (
                            <button key={c.v} type="button" onClick={() => setForm({ ...form, channel: c.v })}
                                data-testid={`edit-channel-${c.v}`}
                                className={`flex flex-col items-center gap-1 px-2 py-3 border text-xs uppercase tracking-[0.1em] font-bold ${
                                    form.channel === c.v ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#71717A] border-[#E2E8F0] hover:border-[#0F172A]"
                                }`}>
                                <c.icon size={18} weight="bold" />
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="zm-label">Recipients</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        {[
                            { v: "all_leads", label: "All leads" },
                            { v: "by_status", label: "By status" },
                            { v: "selected", label: "Pick leads" },
                            { v: "manual", label: "Manual entry" },
                        ].map((o) => (
                            <button key={o.v} type="button" onClick={() => setForm({ ...form, recipient_scope: o.v })}
                                className={`px-2 py-2 text-xs uppercase tracking-[0.1em] font-bold border ${
                                    form.recipient_scope === o.v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white text-[#71717A] border-[#E2E8F0] hover:border-[#2563EB]"
                                }`}>{o.label}</button>
                        ))}
                    </div>
                    {form.recipient_scope === "all_leads" && (
                        <p className="text-xs text-[#64748B] bg-[#F8FAFC] p-2 border-l-2 border-l-[#2563EB]">
                            Will send to <span className="font-bold text-[#0F172A]">{leadsPreview.total}</span> leads.
                        </p>
                    )}
                    {form.recipient_scope === "by_status" && (
                        <div className="flex flex-wrap gap-2">
                            {["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "NOT_INTERESTED"].map((s) => (
                                <label key={s} className="text-xs inline-flex items-center gap-1.5 px-2 py-1 border border-[#E2E8F0] rounded-md cursor-pointer hover:border-[#2563EB]">
                                    <input type="checkbox" checked={form.recipient_statuses.includes(s)} onChange={() => toggleStatus(s)} />
                                    {s}
                                </label>
                            ))}
                        </div>
                    )}
                    {form.recipient_scope === "selected" && (
                        <div className="max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-md divide-y divide-[#E2E8F0]">
                            {leadsPreview.leads.map((l) => (
                                <label key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#F8FAFC] cursor-pointer">
                                    <input type="checkbox" checked={form.recipient_lead_ids.includes(l.id)} onChange={() => toggleLead(l.id)} />
                                    <span className="font-semibold flex-1 truncate">{l.name}</span>
                                    <span className="text-[#64748B] truncate">{l.email || l.phone || "—"}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    {(form.recipient_scope === "manual" || form.recipient_scope === "all_leads") && (
                        <div className="mt-3">
                            <label className="zm-label text-[11px]">
                                {form.recipient_scope === "manual" ? "Recipients" : "Extra recipients (optional)"}
                            </label>
                            <textarea rows={2} className="zm-input text-xs" value={form.extra_recipients_raw}
                                onChange={(e) => setForm({ ...form, extra_recipients_raw: e.target.value })}
                                placeholder={extraPlaceholder} data-testid="edit-extra-recipients" />
                        </div>
                    )}
                </div>
                {form.channel === "EMAIL" && (
                    <div>
                        <label className="zm-label">Subject</label>
                        <input className="zm-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="edit-campaign-subject" />
                    </div>
                )}
                <div>
                    <label className="zm-label">Content</label>
                    <textarea required rows={8} className="zm-input font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} data-testid="edit-campaign-content" />
                </div>
                <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="zm-btn-primary flex-1" data-testid="edit-campaign-submit">
                        {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={onClose} className="zm-btn-secondary">Cancel</button>
                </div>
            </form>
        </ModalShell>
    );
}

function CreateCampaignModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        name: "", type: "EMAIL_BLAST", channel: "EMAIL", content: "", subject: "",
        recipient_scope: "all_leads", recipient_statuses: [], recipient_lead_ids: [], extra_recipients_raw: "",
    });
    const [aiOpen, setAiOpen] = useState(false);
    const [aiData, setAiData] = useState({ goal: "", tone: "professional", audience: "", product: "" });
    const [aiLoading, setAiLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [leadsPreview, setLeadsPreview] = useState({ total: 0, leads: [] });

    // Load a quick preview of the user's leads so they can pick recipients visually
    useEffect(() => {
        api.get("/leads", { params: { limit: 100, page: 1 } })
            .then((r) => setLeadsPreview({ total: r.data?.pagination?.total || 0, leads: r.data?.leads || [] }))
            .catch(() => setLeadsPreview({ total: 0, leads: [] }));
    }, []);

    const toggleStatus = (s) => {
        setForm((f) => ({
            ...f,
            recipient_statuses: f.recipient_statuses.includes(s)
                ? f.recipient_statuses.filter((x) => x !== s)
                : [...f.recipient_statuses, s],
        }));
    };
    const toggleLead = (id) => {
        setForm((f) => ({
            ...f,
            recipient_lead_ids: f.recipient_lead_ids.includes(id)
                ? f.recipient_lead_ids.filter((x) => x !== id)
                : [...f.recipient_lead_ids, id],
        }));
    };

    const generate = async () => {
        if (!aiData.goal) { toast.error("Set a goal first"); return; }
        setAiLoading(true);
        try {
            const r = await api.post("/ai/generate-content", { ...aiData, channel: form.channel });
            setForm((f) => ({ ...f, content: r.data.content, subject: r.data.subject || f.subject }));
            toast.success("Generated by AI");
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
            const extras = (form.extra_recipients_raw || "")
                .split(/[,\n\s;]+/).map((s) => s.trim()).filter(Boolean);
            const payload = {
                name: form.name,
                type: typeFromChannel,
                channel: form.channel,
                content: form.content,
                subject: form.subject,
                recipient_scope: form.recipient_scope,
                recipient_statuses: form.recipient_scope === "by_status" ? form.recipient_statuses : null,
                recipient_lead_ids: form.recipient_scope === "selected" ? form.recipient_lead_ids : null,
                extra_recipients: extras.length ? extras : null,
            };
            await api.post("/campaigns", payload);
            toast.success("Campaign sent for approval");
            onCreated();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Create failed");
        } finally {
            setLoading(false);
        }
    };

    const extraPlaceholder = form.channel === "EMAIL"
        ? "extra1@example.com, extra2@example.com"
        : "+911234567890, +919876543210";

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
                                    form.channel === c.v ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#71717A] border-[#E2E8F0] hover:border-[#0F172A]"
                                }`}
                            >
                                <c.icon size={18} weight="bold" />
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recipients */}
                <div>
                    <label className="zm-label">Recipients</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        {[
                            { v: "all_leads", label: "All leads" },
                            { v: "by_status", label: "By status" },
                            { v: "selected", label: "Pick leads" },
                            { v: "manual", label: "Manual entry" },
                        ].map((o) => (
                            <button key={o.v} type="button" onClick={() => setForm({ ...form, recipient_scope: o.v })}
                                data-testid={`recipient-scope-${o.v}`}
                                className={`px-2 py-2 text-xs uppercase tracking-[0.1em] font-bold border ${
                                    form.recipient_scope === o.v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white text-[#71717A] border-[#E2E8F0] hover:border-[#2563EB]"
                                }`}>{o.label}</button>
                        ))}
                    </div>

                    {form.recipient_scope === "all_leads" && (
                        <p className="text-xs text-[#64748B] bg-[#F8FAFC] p-2 border-l-2 border-l-[#2563EB]">
                            Will send to <span className="font-bold text-[#0F172A]">{leadsPreview.total}</span> leads in your CRM (emails or phones, depending on channel).
                        </p>
                    )}

                    {form.recipient_scope === "by_status" && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "NOT_INTERESTED"].map((s) => (
                                    <label key={s} className="text-xs inline-flex items-center gap-1.5 px-2 py-1 border border-[#E2E8F0] rounded-md cursor-pointer hover:border-[#2563EB]">
                                        <input type="checkbox" checked={form.recipient_statuses.includes(s)} onChange={() => toggleStatus(s)} data-testid={`recipient-status-${s}`} />
                                        {s}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-[#64748B]">{form.recipient_statuses.length} status(es) selected.</p>
                        </div>
                    )}

                    {form.recipient_scope === "selected" && (
                        <div className="max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-md divide-y divide-[#E2E8F0]" data-testid="recipient-lead-picker">
                            {leadsPreview.leads.length === 0 && (
                                <p className="p-3 text-xs text-[#94A3B8]">No leads yet — add some first.</p>
                            )}
                            {leadsPreview.leads.map((l) => (
                                <label key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#F8FAFC] cursor-pointer">
                                    <input type="checkbox" checked={form.recipient_lead_ids.includes(l.id)} onChange={() => toggleLead(l.id)} data-testid={`recipient-lead-${l.id}`} />
                                    <span className="font-semibold flex-1 truncate">{l.name}</span>
                                    <span className="text-[#64748B] truncate">{l.email || l.phone || "—"}</span>
                                    <span className="zm-badge bg-[#F8FAFC] text-[10px]">{l.status}</span>
                                </label>
                            ))}
                            <p className="p-2 text-[10px] text-[#94A3B8] bg-[#F8FAFC]">{form.recipient_lead_ids.length} selected of {leadsPreview.leads.length} shown.</p>
                        </div>
                    )}

                    {(form.recipient_scope === "manual" || form.recipient_scope === "all_leads") && (
                        <div className="mt-3">
                            <label className="zm-label text-[11px]">
                                {form.recipient_scope === "manual" ? "Recipients" : "Extra recipients (optional)"}
                                {" · "}{form.channel === "EMAIL" ? "emails" : "phone numbers (E.164)"}
                            </label>
                            <textarea rows={2} className="zm-input text-xs" value={form.extra_recipients_raw}
                                onChange={(e) => setForm({ ...form, extra_recipients_raw: e.target.value })}
                                placeholder={extraPlaceholder}
                                data-testid="campaign-extra-recipients" />
                            <p className="text-[10px] text-[#94A3B8] mt-1">Separate multiple with commas or new lines. These are sent in addition to leads above.</p>
                        </div>
                    )}
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
                        <button type="button" onClick={() => setAiOpen(!aiOpen)} className="text-xs uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline flex items-center gap-1" data-testid="toggle-ai-panel">
                            <Sparkle size={12} weight="fill" /> AI Generate
                        </button>
                    </div>
                    {aiOpen && (
                        <div className="bg-[#F8FAFC] border-l-2 border-[#2563EB] p-4 mb-3 space-y-3">
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
                                <Sparkle size={14} weight="fill" /> {aiLoading ? "Generating…" : "Generate with AI"}
                            </button>
                        </div>
                    )}
                    <textarea required rows={8} className="zm-input font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write or generate content. Use {{name}} {{email}} {{company}} for personalisation." data-testid="campaign-content" />
                </div>

                <p className="text-xs text-[#71717A] bg-[#F8FAFC] p-3 border-l-2 border-[#F59E0B]">
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
