import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import {
    Users, Buildings, Megaphone, Article, Globe, ChartLineUp, Crown,
    MagnifyingGlass, CaretLeft, CaretRight,
} from "@phosphor-icons/react";

export default function Admin() {
    const [overview, setOverview] = useState(null);
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, total_pages: 0 });
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [denied, setDenied] = useState(false);

    // Initial overview load
    useEffect(() => {
        api.get("/admin/overview")
            .then((r) => setOverview(r.data))
            .catch((e) => { if (e.response?.status === 403) setDenied(true); })
            .finally(() => setLoadingOverview(false));
    }, []);

    // Paginated users list (fires on page or search change)
    const fetchUsers = useCallback(() => {
        setLoadingUsers(true);
        const params = new URLSearchParams({
            page: String(pagination.page),
            limit: String(pagination.limit),
        });
        if (search) params.append("q", search);
        api.get(`/admin/users?${params.toString()}`)
            .then((r) => {
                setUsers(r.data.users || []);
                setPagination((p) => ({
                    ...p,
                    total: r.data.total || 0,
                    total_pages: r.data.total_pages || 0,
                }));
            })
            .catch((e) => { if (e.response?.status === 403) setDenied(true); })
            .finally(() => setLoadingUsers(false));
    }, [pagination.page, pagination.limit, search]);

    useEffect(() => { if (!denied) fetchUsers(); }, [fetchUsers, denied]);

    // Debounce search input → search param
    useEffect(() => {
        const id = setTimeout(() => {
            if (searchInput !== search) {
                setSearch(searchInput);
                setPagination((p) => ({ ...p, page: 1 }));
            }
        }, 350);
        return () => clearTimeout(id);
    }, [searchInput, search]);

    if (loadingOverview) return <div className="p-12 text-sm text-[#64748B]">Loading…</div>;
    if (denied) return (
        <div className="p-12 text-center">
            <Crown size={32} weight="fill" className="mx-auto mb-3 text-[#F59E0B]" />
            <h2 className="font-display text-xl font-bold mb-1">Admin only</h2>
            <p className="text-sm text-[#64748B]">This area is restricted to workspace administrators.</p>
        </div>
    );
    if (!overview) return null;

    const t = overview.totals;
    const stats = [
        { label: "Total users", value: t.users, icon: Users },
        { label: "Workspaces", value: t.workspaces, icon: Buildings },
        { label: "Total leads", value: t.leads.toLocaleString(), icon: ChartLineUp },
        { label: "Campaigns", value: t.campaigns, icon: Megaphone },
        { label: "Content kits", value: t.content_kits, icon: Article },
        { label: "Landing pages", value: t.landing_pages, icon: Globe },
    ];

    const goPage = (n) => {
        if (n < 1 || (pagination.total_pages && n > pagination.total_pages)) return;
        setPagination((p) => ({ ...p, page: n }));
    };

    const fromIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const toIdx = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div data-testid="admin-page">
            <PageHeader
                eyebrow={<><Crown size={11} weight="fill" className="text-[#F59E0B] inline mr-1" /> // Super admin</>}
                title="Platform Overview"
                subtitle="System-wide users, workspaces, growth and subscriptions."
            />

            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="admin-stats">
                    {stats.map((s) => (
                        <div key={s.label} className="zm-card p-5">
                            <s.icon size={18} weight="bold" className="text-[#2563EB]" />
                            <p className="font-display text-3xl font-black tracking-tight mt-2">{s.value}</p>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] font-bold mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="zm-card p-6">
                        <p className="zm-section-label mb-3">// Growth · last 7 days</p>
                        <div className="flex gap-8">
                            <div>
                                <p className="font-display text-4xl font-black tracking-tight text-[#2563EB]">{overview.growth.new_users_7d}</p>
                                <p className="text-xs text-[#64748B] font-semibold mt-1">New signups</p>
                            </div>
                            <div>
                                <p className="font-display text-4xl font-black tracking-tight text-[#10B981]">{overview.growth.active_7d}</p>
                                <p className="text-xs text-[#64748B] font-semibold mt-1">Active users</p>
                            </div>
                        </div>
                    </div>
                    <div className="zm-card p-6">
                        <p className="zm-section-label mb-3">// Auth provider mix</p>
                        <div className="flex flex-wrap gap-2">
                            {overview.by_provider.map((p) => (
                                <span key={p.provider} className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5">
                                    {p.provider}: <strong className="ml-1">{p.count}</strong>
                                </span>
                            ))}
                        </div>
                        <p className="zm-section-label mt-5 mb-3">// Subscription mix</p>
                        <div className="flex flex-wrap gap-2">
                            {overview.by_plan.map((p) => (
                                <span key={p.plan} className="zm-badge bg-[#DBEAFE] text-[#1D4ED8] px-3 py-1.5">
                                    {p.plan}: <strong className="ml-1">{p.count}</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Users table with pagination + search */}
                <div className="zm-card overflow-hidden" data-testid="admin-users-table">
                    <div className="px-6 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="zm-section-label">// All users · {pagination.total.toLocaleString()}</p>
                            {pagination.total > 0 && (
                                <span className="text-[11px] text-[#94A3B8] font-semibold">
                                    Showing {fromIdx}–{toIdx}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <MagnifyingGlass size={14} weight="bold" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                                <input
                                    type="search"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search email, phone, name…"
                                    className="zm-input pl-8 text-xs py-1.5 w-56"
                                    data-testid="admin-users-search"
                                />
                            </div>
                            <select
                                value={pagination.limit}
                                onChange={(e) => setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                                className="zm-input text-xs py-1.5 w-auto"
                                data-testid="admin-users-page-size"
                            >
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
                                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                    <th className="text-left px-4 py-2 zm-section-label">User</th>
                                    <th className="text-left px-3 py-2 zm-section-label">Auth</th>
                                    <th className="text-left px-3 py-2 zm-section-label">Plan</th>
                                    <th className="text-right px-3 py-2 zm-section-label">Leads</th>
                                    <th className="text-right px-3 py-2 zm-section-label">Camps</th>
                                    <th className="text-left px-4 py-2 zm-section-label">Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingUsers && users.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8] text-sm">Loading…</td></tr>
                                )}
                                {!loadingUsers && users.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                                        {search ? `No users match “${search}”` : "No users yet"}
                                    </td></tr>
                                )}
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC]">
                                        <td className="px-4 py-3">
                                            <p className="font-bold">{u.first_name} {u.last_name}</p>
                                            <p className="text-xs text-[#64748B]">{u.email || u.phone}</p>
                                        </td>
                                        <td className="px-3 py-3"><span className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]">{u.auth_provider || "email"}</span></td>
                                        <td className="px-3 py-3">{u.subscription?.plan || "—"}</td>
                                        <td className="px-3 py-3 text-right font-mono">{u.lead_count}</td>
                                        <td className="px-3 py-3 text-right font-mono">{u.campaign_count}</td>
                                        <td className="px-4 py-3 text-xs text-[#64748B]">{u.created_at?.slice(0, 10)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination footer */}
                    {pagination.total_pages > 0 && (
                        <div className="px-6 py-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3 bg-[#F8FAFC]" data-testid="admin-users-pagination">
                            <p className="text-xs text-[#64748B] font-semibold">
                                Page {pagination.page} of {pagination.total_pages}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => goPage(pagination.page - 1)}
                                    disabled={pagination.page <= 1 || loadingUsers}
                                    className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
                                    data-testid="admin-users-prev"
                                >
                                    <CaretLeft size={12} weight="bold" /> Prev
                                </button>
                                {pageNumbers(pagination.page, pagination.total_pages).map((n, i) =>
                                    n === "…" ? (
                                        <span key={`gap-${i}`} className="px-1.5 text-[11px] text-[#94A3B8]">…</span>
                                    ) : (
                                        <button
                                            key={n}
                                            onClick={() => goPage(n)}
                                            disabled={loadingUsers}
                                            className={`text-xs font-bold w-8 h-7 rounded-md transition-colors ${
                                                n === pagination.page
                                                    ? "bg-[#0F172A] text-white"
                                                    : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                                            }`}
                                            data-testid={`admin-users-page-${n}`}
                                        >
                                            {n}
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => goPage(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.total_pages || loadingUsers}
                                    className="zm-btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40"
                                    data-testid="admin-users-next"
                                >
                                    Next <CaretRight size={12} weight="bold" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Compact pagination: show first, last, current ±1 with ellipses
function pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...out].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
        result.push(sorted[i]);
    }
    return result;
}
