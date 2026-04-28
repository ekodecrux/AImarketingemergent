import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import {
    Users, Buildings, Megaphone, Article, Globe, ChartLineUp, Crown, Lightning,
} from "@phosphor-icons/react";

export default function Admin() {
    const [overview, setOverview] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get("/admin/overview").then((r) => setOverview(r.data)),
            api.get("/admin/users").then((r) => setUsers(r.data.users || [])),
        ])
            .catch((e) => { if (e.response?.status === 403) setDenied(true); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-12 text-sm text-[#64748B]">Loading…</div>;
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

                {/* Users table */}
                <div className="zm-card overflow-hidden" data-testid="admin-users-table">
                    <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                        <p className="zm-section-label">// Recent users · {users.length}</p>
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
                </div>
            </div>
        </div>
    );
}
