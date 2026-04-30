import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Robot, Lightning, ArrowsClockwise, CheckCircle, WarningCircle, Sparkle, ChartLineUp } from "@phosphor-icons/react";

const AGGR_OPTIONS = [
    { v: "cautious", label: "Cautious", desc: "Suggest only" },
    { v: "balanced", label: "Balanced", desc: "Auto up to 2/day" },
    { v: "aggressive", label: "Aggressive", desc: "Auto up to 3/day" },
];

export default function CopilotPanel() {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => api.get("/copilot/state").then((r) => setState(r.data));
    useEffect(() => { load(); }, []);

    const toggle = async (enabled, aggressiveness) => {
        setBusy(true);
        try {
            await api.put("/copilot/toggle", { enabled, aggressiveness });
            toast.success(enabled ? `Co-Pilot ${aggressiveness}` : "Co-Pilot off");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        } finally { setBusy(false); }
    };

    const runNow = async () => {
        setBusy(true);
        const t = toast.loading("Running daily cycle…");
        try {
            await api.post("/copilot/run-now");
            toast.success("Daily brief generated", { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Cycle failed", { id: t });
        } finally { setBusy(false); }
    };

    if (!state) return null;
    const cfg = state.settings || {};
    const brief = state.last_brief;
    const sent = brief?.ai?.sentiment;
    const sentClass = sent === "urgent" ? "border-l-[#EF4444] bg-[#EF4444]/5"
        : sent === "positive" ? "border-l-[#10B981] bg-[#10B981]/5"
            : "border-l-[#2563EB] bg-[#F8FAFC]";

    return (
        <div className="zm-card p-6" data-testid="copilot-panel">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-md bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shrink-0">
                        <Robot size={20} weight="fill" className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                            AI Growth Co-Pilot
                            {cfg.enabled ? (
                                <span className="zm-badge bg-[#10B981] text-white"><CheckCircle size={9} weight="fill" /> ON</span>
                            ) : (
                                <span className="zm-badge bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569]">OFF</span>
                            )}
                        </h3>
                        <p className="text-xs text-[#64748B] mt-0.5">Reviews your state daily, auto-generates content, and writes a friendly brief.</p>
                    </div>
                </div>
                <button onClick={runNow} disabled={busy} className="zm-btn-secondary text-xs" data-testid="copilot-run-now">
                    {busy ? <ArrowsClockwise size={12} weight="bold" className="animate-spin" /> : <Lightning size={12} weight="fill" />}
                    Run cycle now
                </button>
            </div>

            {/* Aggressiveness pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-5">
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#94A3B8] mr-1">// Mode</span>
                {AGGR_OPTIONS.map((opt) => (
                    <button key={opt.v} onClick={() => toggle(true, opt.v)}
                        disabled={busy}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                            cfg.enabled && cfg.aggressiveness === opt.v
                                ? "bg-[#0F172A] text-white"
                                : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                        }`}
                        data-testid={`copilot-mode-${opt.v}`}
                        title={opt.desc}>
                        {opt.label}
                    </button>
                ))}
                <button onClick={() => toggle(false, cfg.aggressiveness || "balanced")} disabled={busy}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                        !cfg.enabled
                            ? "bg-[#EF4444] text-white"
                            : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#EF4444] hover:text-[#EF4444]"
                    }`}
                    data-testid="copilot-mode-off">
                    Pause
                </button>
            </div>

            {/* Brief */}
            {brief ? (
                <div className={`p-4 rounded-xl border-l-2 ${sentClass}`} data-testid="copilot-brief">
                    <p className="font-display text-base font-bold tracking-tight">{brief.ai?.headline}</p>
                    <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">{brief.ai?.body}</p>
                    {brief.ai?.next_step && (
                        <p className="text-xs text-[#0F172A] font-bold mt-2 flex items-center gap-1">
                            <Sparkle size={11} weight="fill" className="text-[#2563EB]" /> {brief.ai.next_step}
                        </p>
                    )}
                    {brief.snapshot && (
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#E2E8F0]/60">
                            <Mini label="MTD leads" value={brief.snapshot.mtd_leads} target={brief.snapshot.monthly_target} />
                            <Mini label="Pace gap" value={brief.snapshot.pace_gap} highlight={brief.snapshot.pace_gap > 0} />
                            <Mini label="Pending posts" value={brief.snapshot.pending_schedules} />
                        </div>
                    )}
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold mt-3">{new Date(brief.created_at).toLocaleString()}</p>
                </div>
            ) : (
                <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <ChartLineUp size={24} weight="bold" className="mx-auto text-[#94A3B8] mb-2" />
                    <p className="text-sm text-[#64748B]">No brief yet. Toggle Co-Pilot ON or click "Run cycle now".</p>
                </div>
            )}

            {/* Recent actions */}
            {(state.recent_actions || []).length > 0 && (
                <div className="mt-4">
                    <p className="zm-section-label mb-2">// Recent autonomous actions</p>
                    <div className="space-y-1.5" data-testid="copilot-actions">
                        {state.recent_actions.slice(0, 4).map((a) => (
                            <div key={a.id} className="text-xs flex items-start gap-2 text-[#475569]">
                                <Lightning size={11} weight="fill" className="text-[#F59E0B] mt-0.5 shrink-0" />
                                <span><strong>{a.type}</strong> · {a.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function Mini({ label, value, target, highlight }) {
    return (
        <div>
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold">{label}</p>
            <p className={`font-display text-base font-black tracking-tight mt-0.5 ${highlight ? "text-[#EF4444]" : "text-[#0F172A]"}`}>
                {value}{target ? <span className="text-xs font-bold text-[#94A3B8]"> / {target}</span> : ""}
            </p>
        </div>
    );
}
