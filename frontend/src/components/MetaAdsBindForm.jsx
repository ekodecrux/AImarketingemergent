import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lock, ArrowSquareOut, MegaphoneSimple, Lightning, CheckCircle } from "@phosphor-icons/react";

export default function MetaAdsBindForm({ status, onChange }) {
    const [open, setOpen] = useState(false);
    const [token, setToken] = useState("");
    const [acct, setAcct] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const r = await api.post("/integrations/meta-ads/bind", { access_token: token, ad_account_id: acct });
            toast.success(`Connected ad account: ${r.data.ad_account_name} (${r.data.currency})`);
            setOpen(false); setToken(""); setAcct("");
            onChange?.();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Bind failed");
        } finally {
            setSubmitting(false);
        }
    };

    const disconnect = async () => {
        if (!window.confirm("Disconnect Meta Ads? Future ad-spend syncs will pause until you reconnect.")) return;
        try {
            await api.delete("/integrations/meta-ads");
            toast.success("Meta Ads disconnected");
            onChange?.();
        } catch {
            toast.error("Disconnect failed");
        }
    };

    if (status?.healthy && !open) {
        return (
            <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-2" data-testid="meta-ads-connected">
                <p className="text-xs text-[#10B981] font-bold flex items-center gap-1.5">
                    <CheckCircle size={12} weight="fill" /> {status.account_label || "Ad account live"}
                </p>
                <div className="flex gap-2">
                    <button onClick={() => setOpen(true)} className="zm-btn-secondary text-xs py-2" data-testid="meta-ads-reconnect">Reconnect</button>
                    <button onClick={disconnect} className="zm-btn-secondary text-xs py-2 text-[#DC2626]" data-testid="meta-ads-disconnect">Disconnect</button>
                </div>
            </div>
        );
    }

    if (!open) {
        return (
            <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                <button onClick={() => setOpen(true)} className="zm-btn-primary text-xs py-2 bg-[#000]" data-testid="meta-ads-bind-open">
                    <MegaphoneSimple size={14} weight="fill" /> Bind your Meta Ad Account
                </button>
                <p className="text-[10px] text-[#A1A1AA] mt-1.5">Real campaigns charge your card — only connect when you're ready to spend.</p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3" data-testid="meta-ads-bind-form">
            <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-2">// 5-step setup</p>
                <ol className="text-[11px] text-[#0F172A] space-y-1 mb-3">
                    <li>1. Go to <a href="https://business.facebook.com/settings/system-users/" target="_blank" rel="noreferrer" className="text-[#2563EB] underline inline-flex items-center gap-0.5">Business Manager → System Users <ArrowSquareOut size={9} weight="bold" /></a></li>
                    <li>2. Generate token with scopes: <code className="font-mono bg-[#F8FAFC] px-1">ads_management, ads_read</code></li>
                    <li>3. Get your Ad Account ID at <a href="https://business.facebook.com/settings/ad-accounts/" target="_blank" rel="noreferrer" className="text-[#2563EB] underline inline-flex items-center gap-0.5">Settings → Ad Accounts <ArrowSquareOut size={9} weight="bold" /></a> (format: act_…)</li>
                    <li>4. Verify card on file in your Ad Account</li>
                    <li>5. Paste both below — we verify scope + status before saving</li>
                </ol>
            </div>
            <div>
                <label className="zm-label">System User Access Token</label>
                <input
                    type="password" required minLength={30}
                    value={token} onChange={(e) => setToken(e.target.value)}
                    className="zm-input font-mono text-xs"
                    placeholder="EAAJZB…"
                    data-testid="meta-ads-token"
                />
            </div>
            <div>
                <label className="zm-label">Ad Account ID</label>
                <input
                    required pattern="^act_[0-9]+$"
                    value={acct} onChange={(e) => setAcct(e.target.value)}
                    className="zm-input font-mono text-xs"
                    placeholder="act_1234567890"
                    data-testid="meta-ads-acct"
                />
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="zm-btn-primary text-xs py-2 bg-[#000]" data-testid="meta-ads-submit">
                    <Lightning size={12} weight="fill" /> {submitting ? "Verifying…" : "Verify & connect"}
                </button>
                <button type="button" onClick={() => { setOpen(false); setToken(""); setAcct(""); }} className="zm-btn-secondary text-xs py-2">Cancel</button>
            </div>
            <p className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                <Lock size={10} weight="fill" /> Token stored encrypted at rest. We verify scopes + ad account status before persisting.
            </p>
        </form>
    );
}
