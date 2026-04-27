import { useState } from "react";
import api from "@/lib/api";
import { Sparkle, ArrowsClockwise, Lightning, Warning, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function BriefingCard({ initial }) {
    const [briefing, setBriefing] = useState(initial?.briefing || null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const r = await api.post("/briefing/generate");
            setBriefing(r.data.briefing.briefing);
            toast.success("New briefing ready");
        } catch (e) { toast.error("Briefing failed"); }
        finally { setLoading(false); }
    };

    return (
        <div className="zm-card bg-[#0E0F11] text-white border-0" data-testid="briefing-card">
            <div className="p-6 border-b border-white/10 flex items-start justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold">// Daily AI briefing</p>
                    <h3 className="font-display text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
                        <Sparkle size={16} weight="fill" className="text-[#F59E0B]" />
                        Growth signal
                    </h3>
                </div>
                <button onClick={generate} disabled={loading} className="text-xs uppercase tracking-[0.15em] font-bold text-white/80 hover:text-white flex items-center gap-1" data-testid="briefing-refresh">
                    <ArrowsClockwise size={12} weight="bold" className={loading ? "animate-spin" : ""} />
                    {loading ? "Thinking…" : (briefing ? "Refresh" : "Generate")}
                </button>
            </div>
            <div className="p-6">
                {!briefing ? (
                    <div className="py-8 text-center">
                        <p className="text-sm text-white/60 mb-4">No briefing yet. One click to get your first AI growth report.</p>
                        <button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#0E0F11] text-xs uppercase tracking-[0.15em] font-bold hover:bg-[#FAF7F2]" data-testid="briefing-generate">
                            <Sparkle size={12} weight="fill" /> Generate briefing
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="font-display text-lg font-bold tracking-tight mb-6 leading-snug">{briefing.headline}</p>
                        <div className="grid md:grid-cols-3 gap-6 text-sm">
                            <Section title="Wins" items={briefing.wins} icon={Lightning} color="#10B981" />
                            <Section title="Risks" items={briefing.risks} icon={Warning} color="#F59E0B" />
                            <Section title="Actions today" items={briefing.actions} icon={ArrowRight} color="#FFFFFF" emphasis />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Section({ title, items, icon: Icon, color, emphasis }) {
    return (
        <div>
            <p className="zm-section-label text-white/60 mb-3 flex items-center gap-1">
                <Icon size={11} weight="bold" style={{ color }} /> {title}
            </p>
            <ul className="space-y-2">
                {(items || []).map((it, i) => (
                    <li key={i} className={`text-xs leading-relaxed ${emphasis ? "text-white" : "text-white/80"} flex gap-2`}>
                        <span className="text-white/40 font-mono">{String(i + 1).padStart(2, "0")}</span>
                        <span>{it}</span>
                    </li>
                ))}
                {(!items || items.length === 0) && <li className="text-xs text-white/40">—</li>}
            </ul>
        </div>
    );
}
