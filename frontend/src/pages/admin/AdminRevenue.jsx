import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminRevenue() {
    const [rev, setRev] = useState(null);
    useEffect(() => { api.get("/admin/revenue").then((r) => setRev(r.data)); }, []);
    if (!rev) return <div className="p-12 text-sm text-[#64748B]">Loading…</div>;

    return (
        <div className="px-6 py-6 space-y-6" data-testid="admin-revenue-page">
            <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#F59E0B] font-bold">// Revenue</p>
                <h1 className="font-display text-3xl font-black tracking-tight mt-1">Revenue & Plans</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card label="MRR" value={`₹${rev.mrr_inr.toLocaleString()}`} accent="#10B981" />
                <Card label="ARR" value={`₹${rev.arr_inr.toLocaleString()}`} />
                <Card label="Last 30d · subscriptions" value={`₹${rev.revenue_30d_inr.toLocaleString()}`} accent="#2563EB" />
                <Card label="Last 30d · wallet top-ups" value={`₹${rev.wallet_topups_30d_inr.toLocaleString()}`} accent="#F59E0B" />
            </div>

            <div className="zm-card overflow-hidden" data-testid="admin-by-plan-table">
                <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]"><p className="zm-section-label">// MRR by plan</p></div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[#E2E8F0]">
                            <th className="text-left px-5 py-2 zm-section-label">Plan</th>
                            <th className="text-right px-3 py-2 zm-section-label">Subscribers</th>
                            <th className="text-right px-3 py-2 zm-section-label">Price</th>
                            <th className="text-right px-5 py-2 zm-section-label">MRR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rev.by_plan.map((p) => (
                            <tr key={p.plan} className="border-b border-[#E2E8F0] last:border-b-0">
                                <td className="px-5 py-3"><span className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{p.plan}</span></td>
                                <td className="px-3 py-3 text-right font-mono">{p.count}</td>
                                <td className="px-3 py-3 text-right font-mono">₹{p.price_inr.toLocaleString()}</td>
                                <td className="px-5 py-3 text-right font-mono font-bold text-[#10B981]">₹{p.mrr_inr.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="zm-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]"><p className="zm-section-label">// Recent payments</p></div>
                {rev.recent_payments.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">No payments in the last 30 days</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                <th className="text-left px-5 py-2 zm-section-label">User</th>
                                <th className="text-left px-3 py-2 zm-section-label">Plan</th>
                                <th className="text-right px-3 py-2 zm-section-label">Amount</th>
                                <th className="text-left px-5 py-2 zm-section-label">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rev.recent_payments.map((p) => (
                                <tr key={p.id} className="border-b border-[#E2E8F0] last:border-b-0">
                                    <td className="px-5 py-3 font-mono text-[11px] text-[#64748B]">{p.user_id?.slice(0, 12)}…</td>
                                    <td className="px-3 py-3"><span className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{p.plan_id}</span></td>
                                    <td className="px-3 py-3 text-right font-mono font-bold">₹{(p.amount_inr || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-xs text-[#64748B]">{new Date(p.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function Card({ label, value, accent }) {
    return (
        <div className="zm-card p-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] font-bold">{label}</p>
            <p className="font-display text-3xl font-black tracking-tighter mt-2" style={accent ? { color: accent } : undefined}>{value}</p>
        </div>
    );
}
