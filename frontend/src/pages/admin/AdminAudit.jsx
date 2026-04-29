import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminAudit() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [tp, setTp] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        api.get(`/admin/audit-log?page=${page}&limit=30`).then((r) => {
            setItems(r.data.items || []);
            setTp(r.data.total_pages || 0);
            setTotal(r.data.total || 0);
        });
    }, [page]);

    return (
        <div className="px-6 py-6 space-y-5" data-testid="admin-audit-page">
            <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#F59E0B] font-bold">// Audit</p>
                <h1 className="font-display text-3xl font-black tracking-tight mt-1">Admin actions log</h1>
                <p className="text-sm text-[#64748B] mt-1">{total} entries · subscription changes, wallet credits, discounts, role flips, suspensions.</p>
            </div>

            <div className="zm-card overflow-hidden">
                {items.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-[#94A3B8]">No admin actions logged yet</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                <th className="text-left px-5 py-2 zm-section-label">When</th>
                                <th className="text-left px-3 py-2 zm-section-label">Actor</th>
                                <th className="text-left px-3 py-2 zm-section-label">Action</th>
                                <th className="text-left px-3 py-2 zm-section-label">Target</th>
                                <th className="text-left px-5 py-2 zm-section-label">Payload</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((a) => (
                                <tr key={a.id} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC]">
                                    <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-xs font-mono">{a.actor_email}</td>
                                    <td className="px-3 py-3"><span className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{a.action}</span></td>
                                    <td className="px-3 py-3 text-xs font-mono text-[#64748B]">{a.target_user_id?.slice(0, 12)}…</td>
                                    <td className="px-5 py-3"><pre className="text-[10px] font-mono bg-[#F8FAFC] p-2 rounded overflow-x-auto max-w-md">{JSON.stringify(a.payload, null, 0)}</pre></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {tp > 1 && (
                    <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] text-xs">
                        <span>Page {page} / {tp}</span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40">Prev</button>
                            <button onClick={() => setPage((p) => Math.min(tp, p + 1))} disabled={page >= tp} className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
