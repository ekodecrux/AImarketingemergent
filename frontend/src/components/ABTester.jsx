import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { TestTube, Sparkle, ArrowsClockwise, Trophy, CheckCircle, Copy } from "@phosphor-icons/react";

const KINDS = [
    { v: "subject", label: "Email subject" },
    { v: "headline", label: "Ad / blog headline" },
    { v: "cta", label: "CTA button text" },
];

export default function ABTester({ defaultKind = "subject", defaultText = "" }) {
    const [kind, setKind] = useState(defaultKind);
    const [text, setText] = useState(defaultText);
    const [audience, setAudience] = useState("");
    const [n, setN] = useState(3);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const run = async () => {
        if (!text.trim()) { toast.error("Enter base text"); return; }
        setLoading(true);
        try {
            const r = await api.post("/ab-test/generate", {
                base_text: text.trim(), kind, audience: audience || undefined, n: Number(n),
            });
            setResult(r.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || "AB test failed");
        } finally { setLoading(false); }
    };

    const copyVariant = (v) => {
        navigator.clipboard.writeText(v);
        toast.success("Copied to clipboard");
    };

    return (
        <div className="zm-card p-6" data-testid="ab-tester">
            <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-md bg-[#FEF3C7] flex items-center justify-center shrink-0">
                    <TestTube size={18} weight="fill" className="text-[#D97706]" />
                </div>
                <div>
                    <h3 className="font-display text-lg font-bold tracking-tight">AI A/B variant tester</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Generate 3-5 rewrites with predicted CTR uplift. AI picks the winner.</p>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="zm-label">What are you testing?</label>
                    <div className="flex flex-wrap gap-1.5">
                        {KINDS.map((k) => (
                            <button key={k.v} onClick={() => setKind(k.v)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                                    kind === k.v ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]"
                                }`} data-testid={`ab-kind-${k.v}`}>
                                {k.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="zm-label">Original text</label>
                    <input value={text} onChange={(e) => setText(e.target.value)}
                        placeholder={kind === "cta" ? "Get started" : kind === "subject" ? "Our new feature is here" : "The future of marketing"}
                        className="zm-input" data-testid="ab-base-text" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="zm-label">Audience <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                        <input value={audience} onChange={(e) => setAudience(e.target.value)}
                            placeholder="e.g. SaaS founders, D2C buyers"
                            className="zm-input" data-testid="ab-audience" />
                    </div>
                    <div>
                        <label className="zm-label">Variants</label>
                        <select value={n} onChange={(e) => setN(Number(e.target.value))} className="zm-input" data-testid="ab-n">
                            <option value={2}>2 variants</option>
                            <option value={3}>3 variants</option>
                            <option value={4}>4 variants</option>
                            <option value={5}>5 variants</option>
                        </select>
                    </div>
                </div>
                <button onClick={run} disabled={loading || !text.trim()} className="zm-btn-primary" data-testid="ab-run">
                    {loading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
                    {loading ? "Generating…" : "Generate variants"}
                </button>
            </div>

            {result && (
                <div className="mt-6 pt-6 border-t border-[#E2E8F0]" data-testid="ab-result">
                    <p className="zm-section-label mb-3">// Variants · winner highlighted</p>
                    <div className="space-y-2">
                        {result.variants.map((v, i) => {
                            const isWinner = i === result.recommended_index;
                            const uplift = v.predicted_ctr_uplift_pct || 0;
                            return (
                                <div key={i} className={`p-4 rounded-xl border-2 transition-colors ${
                                    isWinner ? "border-[#10B981] bg-[#10B981]/5" : "border-[#E2E8F0] bg-white"
                                }`} data-testid={`ab-variant-${i}`}>
                                    <div className="flex items-start gap-3">
                                        {isWinner && <Trophy size={18} weight="fill" className="text-[#F59E0B] mt-0.5 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-display text-base font-bold">{v.text}</p>
                                            <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                                <span className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] uppercase">{v.angle}</span>
                                                <span className={`zm-badge ${uplift >= 0 ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                                                    {uplift >= 0 ? "+" : ""}{uplift}% CTR uplift
                                                </span>
                                                {isWinner && <span className="zm-badge bg-[#10B981] text-white"><CheckCircle size={9} weight="fill" /> WINNER</span>}
                                            </div>
                                            <p className="text-xs text-[#64748B] mt-2">{v.rationale}</p>
                                        </div>
                                        <button onClick={() => copyVariant(v.text)} className="text-[#64748B] hover:text-[#0F172A] shrink-0" title="Copy">
                                            <Copy size={14} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {result.reasoning && (
                        <div className="mt-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-bold mb-1">// Why this winner?</p>
                            <p className="text-sm text-[#0F172A] leading-relaxed">{result.reasoning}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
