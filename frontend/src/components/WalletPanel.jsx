import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Wallet, ArrowsClockwise, Plus, CheckCircle, ClockCounterClockwise } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/locale";

function loadRazorpay() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

export default function WalletPanel() {
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [topupAmount, setTopupAmount] = useState(2500);
    const [loading, setLoading] = useState(false);
    const [savingAR, setSavingAR] = useState(false);
    const [arEnabled, setAREnabled] = useState(false);
    const [arThreshold, setARThreshold] = useState(1000);
    const [arAmount, setARAmount] = useState(2500);

    const load = async () => {
        try {
            const [w, t] = await Promise.all([
                api.get("/wallet"),
                api.get("/wallet/transactions?limit=10"),
            ]);
            setWallet(w.data.wallet);
            setTransactions(t.data.transactions || []);
            setAREnabled(!!w.data.wallet?.auto_recharge_enabled);
            setARThreshold(w.data.wallet?.auto_recharge_threshold || 1000);
            setARAmount(w.data.wallet?.auto_recharge_amount || 2500);
        } catch {
            // Silent
        }
    };
    useEffect(() => { load(); }, []);

    const localeInfo = wallet ? { currency: wallet.currency, symbol: wallet.currency === "INR" ? "₹" : "$", locale: wallet.currency === "INR" ? "en-IN" : "en-US" } : null;

    const topUp = async () => {
        if (!topupAmount || topupAmount <= 0) { toast.error("Enter an amount"); return; }
        setLoading(true);
        try {
            const ok = await loadRazorpay();
            if (!ok) { toast.error("Razorpay SDK failed to load"); return; }
            const order = await api.post("/wallet/topup", { amount: Number(topupAmount) });
            const opts = {
                key: order.data.key_id,
                order_id: order.data.order_id,
                amount: order.data.amount * 100,
                currency: order.data.currency,
                name: "ZeroMark Wallet",
                description: `Top-up ${order.data.amount} ${order.data.currency}`,
                handler: async (resp) => {
                    try {
                        const r = await api.post("/wallet/topup/verify", {
                            razorpay_order_id: resp.razorpay_order_id,
                            razorpay_payment_id: resp.razorpay_payment_id,
                            razorpay_signature: resp.razorpay_signature,
                        });
                        toast.success(`Wallet credited · balance ${formatCurrency(r.data.balance, localeInfo)}`);
                        load();
                    } catch (err) {
                        toast.error(err.response?.data?.detail || "Verification failed");
                    }
                },
                theme: { color: "#2563EB" },
                modal: { ondismiss: () => setLoading(false) },
            };
            new window.Razorpay(opts).open();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Top-up failed");
        } finally {
            setLoading(false);
        }
    };

    const saveAutoRecharge = async () => {
        setSavingAR(true);
        try {
            await api.put("/wallet/auto-recharge", {
                enabled: arEnabled,
                threshold: Number(arThreshold),
                top_up_amount: Number(arAmount),
            });
            toast.success(arEnabled ? "Auto-recharge enabled" : "Auto-recharge disabled");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally { setSavingAR(false); }
    };

    if (!wallet) return null;

    return (
        <div className="space-y-5" data-testid="wallet-panel">
            {/* Balance hero */}
            <div className="zm-card bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-0 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Wallet size={16} weight="fill" className="text-[#2563EB]" />
                            <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/60">// ZeroMark wallet</p>
                        </div>
                        <p className="font-display text-5xl sm:text-6xl font-black tracking-tighter mt-1" data-testid="wallet-balance">
                            {formatCurrency(wallet.balance, localeInfo)}
                        </p>
                        <p className="text-xs text-white/60 mt-1">
                            Funds AI generations, hosted landing pages, email + SMS sends.
                        </p>
                        {wallet.auto_recharge_enabled && (
                            <span className="inline-flex items-center gap-1 mt-3 zm-badge bg-[#10B981] text-white">
                                <CheckCircle size={10} weight="fill" /> Auto-recharge ON
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[260px]">
                        <label className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/60">Top up</label>
                        <div className="flex gap-2">
                            <input
                                type="number" min="100"
                                value={topupAmount}
                                onChange={(e) => setTopupAmount(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm font-bold flex-1 focus:outline-none focus:border-[#2563EB]"
                                data-testid="wallet-topup-amount"
                            />
                            <button
                                onClick={topUp} disabled={loading}
                                className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
                                data-testid="wallet-topup-button"
                            >
                                {loading ? <ArrowsClockwise size={14} weight="bold" className="animate-spin" /> : <Plus size={14} weight="bold" />}
                                Top up
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {[500, 1000, 2500, 5000].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setTopupAmount(p)}
                                    className="text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80"
                                >
                                    +{formatCurrency(p, localeInfo)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Auto-recharge config */}
            <div className="zm-card p-5 sm:p-6">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div>
                        <p className="zm-section-label">// Auto-recharge</p>
                        <h3 className="font-display text-lg font-bold tracking-tight mt-1">Refill the wallet automatically</h3>
                        <p className="text-xs text-[#64748B] mt-1">When balance drops below threshold, we auto-charge your saved card via Razorpay.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox" checked={arEnabled}
                            onChange={(e) => setAREnabled(e.target.checked)}
                            className="sr-only peer"
                            data-testid="wallet-ar-toggle"
                        />
                        <span className="relative w-11 h-6 bg-[#E2E8F0] peer-checked:bg-[#10B981] rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></span>
                        <span className="text-sm font-bold">{arEnabled ? "ON" : "OFF"}</span>
                    </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="zm-label">Trigger when balance drops below</label>
                        <input type="number" min="0" value={arThreshold}
                            onChange={(e) => setARThreshold(e.target.value)}
                            disabled={!arEnabled}
                            className="zm-input disabled:opacity-50"
                            data-testid="wallet-ar-threshold"
                        />
                    </div>
                    <div>
                        <label className="zm-label">Top-up amount each time</label>
                        <input type="number" min="0" value={arAmount}
                            onChange={(e) => setARAmount(e.target.value)}
                            disabled={!arEnabled}
                            className="zm-input disabled:opacity-50"
                            data-testid="wallet-ar-amount"
                        />
                    </div>
                </div>
                <button onClick={saveAutoRecharge} disabled={savingAR}
                    className="zm-btn-primary text-sm mt-4" data-testid="wallet-ar-save">
                    {savingAR ? "Saving…" : "Save"}
                </button>
            </div>

            {/* Transactions */}
            <div className="zm-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
                    <ClockCounterClockwise size={14} weight="bold" className="text-[#64748B]" />
                    <p className="zm-section-label">// Recent transactions</p>
                </div>
                {transactions.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">No transactions yet</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                <th className="text-left px-5 py-2 zm-section-label">Type</th>
                                <th className="text-right px-3 py-2 zm-section-label">Amount</th>
                                <th className="text-right px-3 py-2 zm-section-label">Balance after</th>
                                <th className="text-left px-5 py-2 zm-section-label">Date</th>
                            </tr>
                        </thead>
                        <tbody data-testid="wallet-transactions">
                            {transactions.map((t) => (
                                <tr key={t.id} className="border-b border-[#E2E8F0] last:border-b-0">
                                    <td className="px-5 py-3">
                                        <span className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{t.type}</span>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono font-bold text-[#10B981]">
                                        +{formatCurrency(t.amount, localeInfo)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(t.balance_after, localeInfo)}</td>
                                    <td className="px-5 py-3 text-xs text-[#64748B]">{new Date(t.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
