import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    ArrowLeft, Sparkle, EnvelopeSimple, ChatCircle, WhatsappLogo,
    PaperPlaneTilt, ArrowDown, ArrowUp, Robot, Plus,
} from "@phosphor-icons/react";

const CHANNEL_ICON = {
    EMAIL: EnvelopeSimple, SMS: ChatCircle, WHATSAPP: WhatsappLogo,
};

export default function LeadDetail() {
    const { id } = useParams();
    const [lead, setLead] = useState(null);
    const [comms, setComms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scoring, setScoring] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [logForm, setLogForm] = useState({ channel: "EMAIL", direction: "INBOUND", content: "" });
    const [aiInput, setAiInput] = useState("");
    const [aiReply, setAiReply] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const load = () => {
        setLoading(true);
        api.get(`/leads/${id}`)
            .then((r) => { setLead(r.data.lead); setComms(r.data.communications); })
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const reScore = async () => {
        setScoring(true);
        try {
            const r = await api.post("/leads/score-batch", { lead_ids: [id] });
            toast.success(`Scored: ${r.data.results[0]?.score ?? "?"}/100`);
            load();
        } catch (e) { toast.error("Score failed"); }
        finally { setScoring(false); }
    };

    const submitLog = async (e) => {
        e.preventDefault();
        await api.post(`/leads/${id}/communications`, logForm);
        toast.success("Logged");
        setLogForm({ channel: "EMAIL", direction: "INBOUND", content: "" });
        setShowLog(false);
        load();
    };

    const draftReply = async () => {
        if (!aiInput) { toast.error("Paste the inbound message first"); return; }
        setAiLoading(true);
        try {
            const r = await api.post(`/leads/${id}/ai-reply`, { inbound_message: aiInput, channel: "EMAIL", tone: "professional" });
            setAiReply(r.data.reply);
        } catch (e) { toast.error("AI failed"); }
        finally { setAiLoading(false); }
    };

    if (loading) return <div className="p-12 text-sm text-[#71717A]">Loading…</div>;
    if (!lead) return <div className="p-12 text-sm text-[#71717A]">Not found</div>;

    return (
        <div>
            <PageHeader
                eyebrow="// Lead profile"
                title={lead.name}
                subtitle={`${lead.company || "—"} · ${lead.email || lead.phone || ""}`}
                action={
                    <div className="flex gap-3">
                        <Link to="/leads" className="zm-btn-secondary"><ArrowLeft size={14} weight="bold" /> Back</Link>
                        <button onClick={reScore} disabled={scoring} className="zm-btn-dark" data-testid="rescore-lead">
                            <Sparkle size={14} weight="fill" /> {scoring ? "Scoring…" : "Re-score with AI"}
                        </button>
                    </div>
                }
            />
            <div className="px-8 py-6 grid lg:grid-cols-3 gap-6">
                {/* Left: profile + score */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="zm-card p-6">
                        <p className="zm-section-label mb-2">// AI Score</p>
                        <div className="flex items-baseline gap-2">
                            <span className="font-display text-6xl font-black tracking-tighter" data-testid="lead-score">{lead.score || 0}</span>
                            <span className="text-sm text-[#71717A]">/ 100</span>
                        </div>
                        {lead.score_reason && (
                            <div className="mt-4 p-3 bg-[#F8FAFC] border-l-2 border-[#2563EB]">
                                <p className="text-xs text-[#71717A] leading-relaxed">{lead.score_reason}</p>
                            </div>
                        )}
                    </div>

                    <div className="zm-card p-6 space-y-3 text-sm">
                        <p className="zm-section-label mb-2">// Profile</p>
                        <Field label="Name" value={lead.name} />
                        <Field label="Company" value={lead.company || "—"} />
                        <Field label="Email" value={lead.email || "—"} />
                        <Field label="Phone" value={lead.phone || "—"} />
                        <Field label="Source" value={lead.source} />
                        <Field label="Status" value={lead.status} />
                        <Field label="Notes" value={lead.notes || "—"} />
                    </div>
                </div>

                {/* Right: communications + AI reply */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="zm-card">
                        <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
                            <div>
                                <p className="zm-section-label">// Conversation</p>
                                <h3 className="font-display text-xl font-bold tracking-tight mt-1">Communication history</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowAI(!showAI)} className="zm-btn-dark text-xs py-2" data-testid="open-ai-reply">
                                    <Robot size={12} weight="fill" /> AI Reply
                                </button>
                                <button onClick={() => setShowLog(!showLog)} className="zm-btn-secondary text-xs py-2" data-testid="open-log-comm">
                                    <Plus size={12} weight="bold" /> Log
                                </button>
                            </div>
                        </div>

                        {showLog && (
                            <form onSubmit={submitLog} className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-3" data-testid="log-comm-form">
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={logForm.direction} onChange={(e) => setLogForm({ ...logForm, direction: e.target.value })} className="zm-input">
                                        <option value="INBOUND">Inbound</option>
                                        <option value="OUTBOUND">Outbound</option>
                                    </select>
                                    <select value={logForm.channel} onChange={(e) => setLogForm({ ...logForm, channel: e.target.value })} className="zm-input">
                                        {["EMAIL", "SMS", "WHATSAPP", "LINKEDIN", "FACEBOOK", "INSTAGRAM"].map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <textarea required value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} rows={3} className="zm-input" placeholder="What was said?" />
                                <button className="zm-btn-primary w-full" data-testid="submit-log-comm">Log communication</button>
                            </form>
                        )}

                        {showAI && (
                            <div className="p-6 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-3" data-testid="ai-reply-panel">
                                <p className="zm-label mb-1">Inbound message from lead</p>
                                <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} rows={3} className="zm-input" placeholder="Paste what they said…" />
                                <button onClick={draftReply} disabled={aiLoading} className="zm-btn-dark w-full" data-testid="ai-draft-reply">
                                    <Sparkle size={12} weight="fill" /> {aiLoading ? "Drafting…" : "Draft reply with Groq"}
                                </button>
                                {aiReply && (
                                    <div className="bg-white border-l-2 border-[#2563EB] p-3">
                                        <p className="zm-section-label mb-1">// Suggested reply</p>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiReply}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div data-testid="comm-history">
                            {comms.length === 0 ? (
                                <p className="p-12 text-center text-sm text-[#A1A1AA]">No communications yet</p>
                            ) : comms.map((c) => {
                                const Icon = CHANNEL_ICON[c.channel] || EnvelopeSimple;
                                const isInbound = c.direction === "INBOUND";
                                return (
                                    <div key={c.id} className={`p-5 border-b border-[#E2E8F0] last:border-b-0 flex gap-3 ${isInbound ? "bg-[#F8FAFC]" : "bg-white"}`}>
                                        <div className="w-8 h-8 bg-white border border-[#E2E8F0] flex items-center justify-center flex-shrink-0">
                                            <Icon size={14} weight="bold" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="zm-badge bg-[#0F172A] text-white inline-flex items-center gap-1">
                                                    {isInbound ? <ArrowDown size={10} weight="bold" /> : <ArrowUp size={10} weight="bold" />}
                                                    {c.direction}
                                                </span>
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold">{c.channel}</span>
                                                <span className="text-[10px] text-[#A1A1AA] ml-auto">{new Date(c.sent_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#0F172A]">{c.content || "(campaign send)"}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value }) {
    return (
        <div className="flex justify-between gap-3 border-b border-[#F8FAFC] pb-2 last:border-b-0 last:pb-0">
            <span className="text-xs uppercase tracking-[0.15em] text-[#71717A] font-bold">{label}</span>
            <span className="text-sm text-right break-all">{value}</span>
        </div>
    );
}
