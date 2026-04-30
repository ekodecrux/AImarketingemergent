import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Plus, Trash, ArrowsClockwise, MagnifyingGlass, Lightbulb, Crosshair, X } from "@phosphor-icons/react";

export default function Competitors() {
    const [items, setItems] = useState([]);
    const [url, setUrl] = useState("");
    const [nickname, setNickname] = useState("");
    const [busy, setBusy] = useState(false);
    const [scanning, setScanning] = useState(null);

    const load = () => api.get("/competitors").then((r) => setItems(r.data.items || []));
    useEffect(() => { load(); }, []);

    const add = async () => {
        if (!url) { toast.error("URL required"); return; }
        setBusy(true);
        try {
            await api.post("/competitors", { url, nickname });
            toast.success("Competitor added");
            setUrl(""); setNickname("");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        } finally { setBusy(false); }
    };
    const del = async (cid) => {
        if (!window.confirm("Remove this competitor?")) return;
        await api.delete(`/competitors/${cid}`);
        toast.success("Removed"); load();
    };
    const scan = async (cid) => {
        setScanning(cid);
        try {
            await api.post(`/competitors/${cid}/scan`);
            toast.success("Scan complete");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Scan failed");
        } finally { setScanning(null); }
    };

    return (
        <div data-testid="competitors-page">
            <PageHeader
                eyebrow="// Competitive intelligence"
                title="Competitor Watch"
                subtitle="Track up to 3 competitors. AI tells you what they're doing — and how to beat them."
            />
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Add form */}
                <div className="zm-card p-5 sm:p-6 border-l-2 border-l-[#2563EB]">
                    <p className="zm-section-label mb-3">// Track a new competitor ({items.length}/3)</p>
                    <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
                        <input value={url} onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://competitor.com"
                            className="zm-input" data-testid="competitor-url" />
                        <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                            placeholder="Nickname (optional)"
                            className="zm-input" data-testid="competitor-nickname" />
                        <button onClick={add} disabled={busy || items.length >= 3}
                            className="zm-btn-primary whitespace-nowrap" data-testid="competitor-add">
                            <Plus size={12} weight="bold" /> Track
                        </button>
                    </div>
                </div>

                {/* List */}
                {items.length === 0 ? (
                    <div className="zm-card p-12 text-center">
                        <Crosshair size={28} weight="fill" className="mx-auto text-[#94A3B8] mb-2" />
                        <p className="text-sm text-[#64748B]">No competitors tracked yet. Add up to 3.</p>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-5" data-testid="competitor-list">
                        {items.map((c) => {
                            const ai = c.last_ai || {};
                            return (
                                <div key={c.id} className="zm-card p-6" data-testid={`competitor-${c.id}`}>
                                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-display text-lg font-bold tracking-tight truncate">{c.nickname}</h3>
                                            <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-[#64748B] hover:text-[#2563EB] truncate block">{c.url}</a>
                                            {c.last_scanned_at && (
                                                <p className="text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold mt-1">last scanned · {new Date(c.last_scanned_at).toLocaleString()}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button onClick={() => scan(c.id)} disabled={scanning === c.id} className="zm-btn-secondary text-xs" data-testid={`scan-${c.id}`}>
                                                {scanning === c.id ? <ArrowsClockwise size={11} weight="bold" className="animate-spin" /> : <MagnifyingGlass size={11} weight="bold" />}
                                                {scanning === c.id ? "Scanning…" : (c.last_scanned_at ? "Re-scan" : "Scan")}
                                            </button>
                                            <button onClick={() => del(c.id)} className="zm-btn-secondary text-xs" data-testid={`del-${c.id}`}>
                                                <Trash size={11} weight="bold" />
                                            </button>
                                        </div>
                                    </div>

                                    {ai.current_positioning && (
                                        <>
                                            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-3">
                                                <p className="zm-section-label text-[9px] mb-1">// Their positioning</p>
                                                <p className="text-sm text-[#0F172A] leading-relaxed">{ai.current_positioning}</p>
                                                {ai.likely_target_audience && (
                                                    <p className="text-xs text-[#64748B] mt-1.5">Targeting: {ai.likely_target_audience}</p>
                                                )}
                                            </div>

                                            {(ai.strengths || []).length > 0 && (
                                                <div className="mb-3">
                                                    <p className="zm-section-label text-[9px] mb-1">// Strengths</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {ai.strengths.map((s, i) => (
                                                            <span key={i} className="zm-badge bg-[#DBEAFE] text-[#1D4ED8] text-[10px]">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(ai.weaknesses_you_can_exploit || []).length > 0 && (
                                                <div className="mb-3">
                                                    <p className="zm-section-label text-[9px] mb-1 text-[#10B981]">// Where you can win</p>
                                                    <ul className="space-y-1">
                                                        {ai.weaknesses_you_can_exploit.map((w, i) => (
                                                            <li key={i} className="text-xs text-[#0F172A] flex items-start gap-1.5">
                                                                <span className="text-[#10B981] font-black mt-0.5">→</span> {w}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {(ai.suggested_counter_moves || []).length > 0 && (
                                                <div className="bg-[#10B981]/5 border-l-2 border-l-[#10B981] rounded-r-lg p-3">
                                                    <p className="zm-section-label text-[9px] mb-2 text-[#065F46]"><Lightbulb size={10} weight="fill" className="inline" /> // Counter-moves</p>
                                                    <ol className="space-y-1.5 list-decimal list-inside">
                                                        {ai.suggested_counter_moves.map((m, i) => (
                                                            <li key={i} className="text-xs text-[#0F172A] font-semibold">{m}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {(c.last_changes || []).length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                                            <p className="zm-section-label text-[9px] mb-1 text-[#F59E0B]">// Changes since last scan</p>
                                            <ul className="space-y-0.5">
                                                {c.last_changes.map((ch, i) => (
                                                    <li key={i} className="text-[11px] text-[#475569]">⚡ {ch}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {!c.last_scanned_at && (
                                        <p className="text-xs text-[#94A3B8] text-center mt-2">Click "Scan" to run AI analysis.</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
