import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Check, X, PencilSimple } from "@phosphor-icons/react";

export default function Approvals() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [editContent, setEditContent] = useState("");

    const load = () => {
        setLoading(true);
        api.get("/approvals").then((r) => setItems(r.data.approvals)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const approve = async (id) => {
        await api.post(`/approvals/${id}/approve`, {});
        toast.success("Approved");
        load();
    };
    const reject = async (id) => {
        await api.post(`/approvals/${id}/reject`, {});
        toast("Rejected");
        load();
    };
    const saveModify = async (id) => {
        await api.post(`/approvals/${id}/modify`, { content: editContent });
        toast.success("Modified & approved");
        setEditing(null);
        load();
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Quality control"
                title="Approval Queue"
                subtitle={`${items.length} pending review`}
            />
            <div className="px-8 py-6">
                {loading ? (
                    <p className="text-sm text-[#A1A1AA] p-12 zm-card">Loading…</p>
                ) : items.length === 0 ? (
                    <div className="zm-card p-16 text-center">
                        <p className="zm-section-label mb-2">// All clear</p>
                        <h3 className="font-display text-3xl font-bold tracking-tight">Inbox zero.</h3>
                        <p className="text-sm text-[#71717A] mt-2">No pending approvals. Create a campaign to populate this queue.</p>
                    </div>
                ) : (
                    <div className="space-y-4" data-testid="approvals-list">
                        {items.map((a) => (
                            <div key={a.id} className="zm-card" data-testid={`approval-${a.id}`}>
                                <div className="grid lg:grid-cols-[1fr_auto] gap-0">
                                    <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#E4E4E7]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="zm-badge bg-[#F59E0B] text-white">PENDING</span>
                                            <span className="text-xs uppercase tracking-[0.2em] text-[#71717A] font-bold">{a.channel}</span>
                                        </div>
                                        <h3 className="font-display text-xl font-bold tracking-tight mb-1">
                                            {a.campaign?.name || "Campaign"}
                                        </h3>
                                        {a.subject && <p className="text-sm text-[#71717A] mb-3">Subject: <span className="font-semibold text-[#09090B]">{a.subject}</span></p>}
                                        {editing === a.id ? (
                                            <textarea
                                                className="zm-input font-mono text-xs mt-3"
                                                rows={8}
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                data-testid={`edit-content-${a.id}`}
                                            />
                                        ) : (
                                            <pre className="bg-[#F4F4F5] border-l-2 border-[#09090B] p-4 text-xs whitespace-pre-wrap font-mono text-[#09090B]">
{a.content}
                                            </pre>
                                        )}
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mt-3">
                                            Submitted: {new Date(a.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-6 flex flex-col gap-2 min-w-[200px]">
                                        {editing === a.id ? (
                                            <>
                                                <button onClick={() => saveModify(a.id)} className="zm-btn-primary" data-testid={`save-modify-${a.id}`}>
                                                    <Check size={14} weight="bold" /> Save & Approve
                                                </button>
                                                <button onClick={() => setEditing(null)} className="zm-btn-secondary">Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => approve(a.id)} className="zm-btn-primary" data-testid={`approve-${a.id}`}>
                                                    <Check size={14} weight="bold" /> Approve
                                                </button>
                                                <button onClick={() => { setEditing(a.id); setEditContent(a.content); }} className="zm-btn-secondary" data-testid={`modify-${a.id}`}>
                                                    <PencilSimple size={14} weight="bold" /> Modify
                                                </button>
                                                <button onClick={() => reject(a.id)} className="zm-btn-destructive" data-testid={`reject-${a.id}`}>
                                                    <X size={14} weight="bold" /> Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
