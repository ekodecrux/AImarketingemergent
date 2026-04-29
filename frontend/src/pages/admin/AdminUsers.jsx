import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { MagnifyingGlass, CaretLeft, CaretRight, Crown, X, Pencil } from "@phosphor-icons/react";

const PLAN_OPTIONS = ["FREE_TRIAL", "BASIC", "PRO", "ENTERPRISE"];

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, total_pages: 0 });
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingUid, setEditingUid] = useState(null);

    const fetchUsers = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit) });
        if (search) params.append("q", search);
        api.get(`/admin/users?${params.toString()}`)
            .then((r) => {
                setUsers(r.data.users || []);
                setPagination((p) => ({ ...p, total: r.data.total || 0, total_pages: r.data.total_pages || 0 }));
            })
            .finally(() => setLoading(false));
    }, [pagination.page, pagination.limit, search]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        const id = setTimeout(() => {
            if (searchInput !== search) {
                setSearch(searchInput);
                setPagination((p) => ({ ...p, page: 1 }));
            }
        }, 350);
        return () => clearTimeout(id);
    }, [searchInput, search]);

    const fromIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const toIdx = Math.min(pagination.page * pagination.limit, pagination.total);

    const goPage = (n) => {
        if (n < 1 || (pagination.total_pages && n > pagination.total_pages)) return;
        setPagination((p) => ({ ...p, page: n }));
    };

    return (
        <div className="px-6 py-6 space-y-5" data-testid="admin-users-page">
            <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#F59E0B] font-bold">// Platform users</p>
                <h1 className="font-display text-3xl font-black tracking-tight mt-1">Subscribed users</h1>
                <p className="text-sm text-[#64748B] mt-1">Edit subscription, wallet, discounts and roles.</p>
            </div>

            <div className="zm-card overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
                    <p className="zm-section-label">{pagination.total.toLocaleString()} total · showing {fromIdx}–{toIdx}</p>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <MagnifyingGlass size={14} weight="bold" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search email / phone / name…"
                                className="zm-input pl-8 text-xs py-1.5 w-64"
                                data-testid="admin-users-search" />
                        </div>
                        <select value={pagination.limit}
                            onChange={(e) => setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                            className="zm-input text-xs py-1.5 w-auto"
                            data-testid="admin-users-page-size">
                            <option value={10}>10 / page</option>
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                <th className="text-left px-4 py-2 zm-section-label">User</th>
                                <th className="text-left px-3 py-2 zm-section-label">Plan</th>
                                <th className="text-left px-3 py-2 zm-section-label">Auth</th>
                                <th className="text-right px-3 py-2 zm-section-label">Leads</th>
                                <th className="text-right px-3 py-2 zm-section-label">Camps</th>
                                <th className="text-left px-3 py-2 zm-section-label">Joined</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && users.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8] text-sm">Loading…</td></tr>
                            )}
                            {!loading && users.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                                    {search ? `No match for "${search}"` : "No users"}
                                </td></tr>
                            )}
                            {users.map((u) => (
                                <tr key={u.id} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC]" data-testid={`admin-user-row-${u.id}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <p className="font-bold flex items-center gap-1.5">
                                                    {u.first_name} {u.last_name}
                                                    {u.role === "admin" && <Crown size={11} weight="fill" className="text-[#F59E0B]" />}
                                                    {u.suspended && <span className="zm-badge bg-[#FEE2E2] text-[#991B1B]">SUSPENDED</span>}
                                                </p>
                                                <p className="text-xs text-[#64748B]">{u.email || u.phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{u.subscription?.plan || "—"}</span>
                                    </td>
                                    <td className="px-3 py-3"><span className="text-xs text-[#64748B]">{u.auth_provider || "email"}</span></td>
                                    <td className="px-3 py-3 text-right font-mono">{u.lead_count}</td>
                                    <td className="px-3 py-3 text-right font-mono">{u.campaign_count}</td>
                                    <td className="px-3 py-3 text-xs text-[#64748B]">{u.created_at?.slice(0, 10)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <button onClick={() => setEditingUid(u.id)} className="zm-btn-secondary text-xs" data-testid={`edit-user-${u.id}`}>
                                            <Pencil size={11} weight="bold" /> Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination.total_pages > 0 && (
                    <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3 bg-[#F8FAFC]">
                        <p className="text-xs text-[#64748B] font-semibold">Page {pagination.page} of {pagination.total_pages}</p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => goPage(pagination.page - 1)} disabled={pagination.page <= 1 || loading}
                                className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40" data-testid="admin-users-prev">
                                <CaretLeft size={12} weight="bold" /> Prev
                            </button>
                            <button onClick={() => goPage(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages || loading}
                                className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40" data-testid="admin-users-next">
                                Next <CaretRight size={12} weight="bold" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {editingUid && (
                <UserEditModal uid={editingUid} onClose={() => { setEditingUid(null); fetchUsers(); }} />
            )}
        </div>
    );
}


function UserEditModal({ uid, onClose }) {
    const [data, setData] = useState(null);
    const [tab, setTab] = useState("subscription");
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState("PRO");
    const [duration, setDuration] = useState(1);
    const [walletAmount, setWalletAmount] = useState(0);
    const [walletReason, setWalletReason] = useState("");
    const [discount, setDiscount] = useState(0);
    const [discountUntil, setDiscountUntil] = useState("");
    const [discountNote, setDiscountNote] = useState("");
    const [role, setRole] = useState("user");

    const reload = () => api.get(`/admin/users/${uid}`).then((r) => {
        setData(r.data);
        setPlan(r.data.subscription?.plan || "PRO");
        setRole(r.data.user?.role || "user");
        setDiscount(r.data.discount?.percent || 0);
        setDiscountUntil(r.data.discount?.valid_until || "");
        setDiscountNote(r.data.discount?.note || "");
    });
    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [uid]);

    if (!data) {
        return (
            <div className="fixed inset-0 z-50 bg-[#0F172A]/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 text-sm">Loading…</div>
            </div>
        );
    }

    const u = data.user;

    const setSubscription = async () => {
        setBusy(true);
        try {
            await api.post(`/admin/users/${uid}/subscription`, { plan, duration_months: Number(duration) });
            toast.success(`Subscription set to ${plan} for ${duration} mo`);
            reload();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    const adjustWallet = async () => {
        setBusy(true);
        try {
            await api.post(`/admin/users/${uid}/wallet/adjust`, { amount: Number(walletAmount), reason: walletReason });
            toast.success(`Wallet adjusted by ${walletAmount}`);
            setWalletAmount(0); setWalletReason("");
            reload();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    const saveDiscount = async () => {
        setBusy(true);
        try {
            await api.post(`/admin/users/${uid}/discount`, {
                percent: Number(discount),
                valid_until: discountUntil || null,
                note: discountNote || null,
            });
            toast.success(`Discount set to ${discount}%`);
            reload();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    const setUserRole = async () => {
        setBusy(true);
        try {
            await api.post(`/admin/users/${uid}/role`, { role });
            toast.success(`Role set to ${role}`);
            reload();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    const toggleSuspend = async () => {
        const newSusp = !u.suspended;
        const reason = newSusp ? (window.prompt("Suspend reason") || "Manual suspension") : "";
        setBusy(true);
        try {
            await api.post(`/admin/users/${uid}/suspend`, { suspended: newSusp, reason });
            toast.success(newSusp ? "User suspended" : "User reactivated");
            reload();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };

    const TABS = [
        { v: "subscription", label: "Subscription" },
        { v: "wallet", label: "Wallet" },
        { v: "discount", label: "Discount" },
        { v: "role", label: "Role & Suspend" },
        { v: "history", label: "Audit history" },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="admin-user-edit-modal">
                <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
                    <div>
                        <h3 className="font-display text-xl font-black tracking-tight">{u.first_name} {u.last_name}</h3>
                        <p className="text-xs text-[#64748B]">{u.email || u.phone} · joined {u.created_at?.slice(0, 10)}</p>
                    </div>
                    <button onClick={onClose} className="text-[#64748B] hover:text-[#0F172A]"><X size={20} weight="bold" /></button>
                </div>

                {/* Snapshot row */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <Snap label="Plan" value={data.subscription?.plan || "—"} />
                    <Snap label="Wallet" value={data.wallet ? `${data.wallet.currency} ${data.wallet.balance}` : "—"} />
                    <Snap label="Discount" value={data.discount?.percent ? `${data.discount.percent}%` : "—"} />
                    <Snap label="Stats" value={`${data.stats.leads} leads · ${data.stats.campaigns} camps`} />
                </div>

                <div className="border-b border-[#E2E8F0] flex overflow-x-auto">
                    {TABS.map((t) => (
                        <button key={t.v} onClick={() => setTab(t.v)}
                            data-testid={`tab-${t.v}`}
                            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] whitespace-nowrap border-b-2 ${
                                tab === t.v ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {tab === "subscription" && (
                        <div className="space-y-4" data-testid="tab-subscription-content">
                            <div>
                                <label className="zm-label">Plan</label>
                                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="zm-input" data-testid="edit-plan-select">
                                    {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="zm-label">Duration (months)</label>
                                <input type="number" min="1" max="60" value={duration} onChange={(e) => setDuration(e.target.value)} className="zm-input" data-testid="edit-duration" />
                            </div>
                            <p className="text-xs text-[#64748B]">No payment is charged. Subscription is set manually for this user.</p>
                            <button onClick={setSubscription} disabled={busy} className="zm-btn-primary" data-testid="save-subscription">
                                {busy ? "Saving…" : "Set subscription"}
                            </button>
                        </div>
                    )}

                    {tab === "wallet" && (
                        <div className="space-y-4" data-testid="tab-wallet-content">
                            <p className="text-sm">Current balance: <strong>{data.wallet?.currency || "INR"} {data.wallet?.balance ?? 0}</strong></p>
                            <div>
                                <label className="zm-label">Amount (positive = credit, negative = debit)</label>
                                <input type="number" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} className="zm-input" data-testid="edit-wallet-amount" />
                            </div>
                            <div>
                                <label className="zm-label">Reason <span className="text-[#94A3B8] font-normal">(min 3 chars)</span></label>
                                <input value={walletReason} onChange={(e) => setWalletReason(e.target.value)} className="zm-input"
                                    placeholder="e.g. goodwill credit, refund, promo" data-testid="edit-wallet-reason" />
                            </div>
                            <button onClick={adjustWallet} disabled={busy} className="zm-btn-primary" data-testid="save-wallet">
                                {busy ? "Saving…" : "Apply adjustment"}
                            </button>
                        </div>
                    )}

                    {tab === "discount" && (
                        <div className="space-y-4" data-testid="tab-discount-content">
                            <div>
                                <label className="zm-label">Discount percent (0-100)</label>
                                <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} className="zm-input" data-testid="edit-discount-pct" />
                            </div>
                            <div>
                                <label className="zm-label">Valid until <span className="text-[#94A3B8] font-normal">(ISO date, optional)</span></label>
                                <input type="date" value={discountUntil ? discountUntil.slice(0, 10) : ""} onChange={(e) => setDiscountUntil(e.target.value)} className="zm-input" />
                            </div>
                            <div>
                                <label className="zm-label">Note</label>
                                <input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} className="zm-input" placeholder="Why this discount?" />
                            </div>
                            <button onClick={saveDiscount} disabled={busy} className="zm-btn-primary" data-testid="save-discount">
                                {busy ? "Saving…" : "Apply discount"}
                            </button>
                        </div>
                    )}

                    {tab === "role" && (
                        <div className="space-y-4" data-testid="tab-role-content">
                            <div>
                                <label className="zm-label">Role</label>
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="zm-input" data-testid="edit-role-select">
                                    <option value="user">user</option>
                                    <option value="admin">admin (platform owner)</option>
                                </select>
                            </div>
                            <button onClick={setUserRole} disabled={busy} className="zm-btn-primary" data-testid="save-role">{busy ? "Saving…" : "Set role"}</button>
                            <hr className="my-4" />
                            <p className="text-xs text-[#64748B]">Suspend prevents the user from logging in.</p>
                            <button onClick={toggleSuspend} disabled={busy}
                                className={`text-sm font-bold px-4 py-2 rounded-xl ${u.suspended ? "bg-[#10B981] text-white hover:bg-[#059669]" : "bg-[#EF4444] text-white hover:bg-[#DC2626]"}`}
                                data-testid="toggle-suspend">
                                {u.suspended ? "Reactivate user" : "Suspend user"}
                            </button>
                        </div>
                    )}

                    {tab === "history" && (
                        <div className="space-y-2" data-testid="tab-history-content">
                            {data.audit_log.length === 0 && <p className="text-sm text-[#64748B]">No admin actions yet.</p>}
                            {data.audit_log.map((a) => (
                                <div key={a.id} className="border border-[#E2E8F0] rounded-lg p-3 text-sm">
                                    <p className="font-bold">{a.action}</p>
                                    <p className="text-xs text-[#64748B]">{a.actor_email} · {new Date(a.created_at).toLocaleString()}</p>
                                    <pre className="text-[11px] bg-[#F8FAFC] p-2 mt-1 rounded font-mono overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Snap({ label, value }) {
    return (
        <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#94A3B8] font-bold">{label}</p>
            <p className="font-display text-base font-black tracking-tight mt-0.5">{value}</p>
        </div>
    );
}
