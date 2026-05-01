import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lock, ArrowSquareOut, MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";

export default function HunterBindForm() {
    const [status, setStatus] = useState(null);
    const [open, setOpen] = useState(false);
    const [key, setKey] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const load = async () => {
        try {
            const r = await api.get("/integrations");
            const h = r.data.integrations?.hunter;
            setStatus(h?.connected ? { connected: true } : null);
        } catch {
            /* ignore */
        }
    };

    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const r = await api.post("/integrations/hunter/bind", { api_key: key });
            toast.success(`Hunter ${r.data.plan} · ${r.data.quota_used}/${r.data.quota_total} calls used`);
            setOpen(false); setKey(""); load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Hunter verification failed");
        } finally {
            setSubmitting(false);
        }
    };

    const disconnect = async () => {
        if (!window.confirm("Disconnect Hunter? Lead enrichment will fall back to AI-only.")) return;
        await api.delete("/integrations/hunter");
        toast.success("Hunter disconnected");
        load();
    };

    return (
        <div className="zm-card p-5" data-testid="hunter-card">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-sm bg-[#FF6B35]">
                        <MagnifyingGlass size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-display text-sm font-bold tracking-tight">Hunter.io · Lead enrichment</h4>
                        <p className="text-xs text-[#71717A]">Real role + email finder · upgrades CRM enrichment</p>
                    </div>
                </div>
                <span className={`zm-badge text-[9px] ${status?.connected ? "bg-[#10B981] text-white" : "bg-[#F8FAFC] text-[#71717A] border border-[#E2E8F0]"}`}>
                    {status?.connected ? <><CheckCircle size={9} weight="fill" /> Connected</> : "Optional"}
                </span>
            </div>

            {status?.connected && !open ? (
                <div className="space-y-2">
                    <p className="text-[11px] text-[#10B981]">Lead enrichment now uses Hunter + AI hybrid.</p>
                    <div className="flex gap-2">
                        <button onClick={() => setOpen(true)} className="zm-btn-secondary text-xs py-2" data-testid="hunter-reconnect">Update key</button>
                        <button onClick={disconnect} className="zm-btn-secondary text-xs py-2 text-[#DC2626]" data-testid="hunter-disconnect">Disconnect</button>
                    </div>
                </div>
            ) : !open ? (
                <button onClick={() => setOpen(true)} className="zm-btn-secondary text-xs py-2 w-full" data-testid="hunter-bind-open">
                    Add Hunter API key
                </button>
            ) : (
                <form onSubmit={submit} className="space-y-3 mt-2" data-testid="hunter-bind-form">
                    <p className="text-[11px] text-[#71717A]">
                        Get your API key from <a href="https://hunter.io/api-keys" target="_blank" rel="noreferrer" className="text-[#2563EB] underline inline-flex items-center gap-0.5">hunter.io/api-keys <ArrowSquareOut size={9} weight="bold" /></a>. Free tier supports 25 verifications/mo.
                    </p>
                    <input
                        type="password" required minLength={20}
                        value={key} onChange={(e) => setKey(e.target.value)}
                        className="zm-input font-mono text-xs"
                        placeholder="abcd1234ef…"
                        data-testid="hunter-key"
                    />
                    <div className="flex gap-2">
                        <button type="submit" disabled={submitting} className="zm-btn-primary text-xs py-2 flex-1" data-testid="hunter-submit">
                            {submitting ? "Verifying…" : "Verify & save"}
                        </button>
                        <button type="button" onClick={() => { setOpen(false); setKey(""); }} className="zm-btn-secondary text-xs py-2">Cancel</button>
                    </div>
                    <p className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                        <Lock size={10} weight="fill" /> Key encrypted at rest.
                    </p>
                </form>
            )}
        </div>
    );
}
