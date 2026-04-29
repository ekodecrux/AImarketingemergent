import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import ChatbotWidget from "@/components/ChatbotWidget";
import {
    Crown, Gauge, Users, CurrencyDollar, ClockCounterClockwise, SignOut, Eye,
    Shield, ArrowSquareOut,
} from "@phosphor-icons/react";

const NAV = [
    { to: "/admin", label: "Overview", icon: Gauge, end: true, testid: "admin-nav-overview" },
    { to: "/admin/users", label: "Users", icon: Users, testid: "admin-nav-users" },
    { to: "/admin/revenue", label: "Revenue & Plans", icon: CurrencyDollar, testid: "admin-nav-revenue" },
    { to: "/admin/audit", label: "Audit Log", icon: ClockCounterClockwise, testid: "admin-nav-audit" },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const [me, setMe] = useState(null);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        api.get("/auth/me")
            .then((r) => {
                const u = r.data.user;
                if ((u?.role || "user") !== "admin") {
                    setDenied(true);
                } else {
                    setMe(u);
                }
            })
            .catch(() => navigate("/login"));
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem("zm_token");
        navigate("/login");
    };

    if (denied) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <Shield size={36} weight="fill" className="mx-auto text-[#EF4444] mb-3" />
                    <h2 className="font-display text-2xl font-bold tracking-tight">Platform Admin only</h2>
                    <p className="text-sm text-[#64748B] mt-1">This console is reserved for ZeroMark platform owners.</p>
                    <button onClick={() => navigate("/dashboard")} className="zm-btn-primary mt-5">Go to user dashboard</button>
                </div>
            </div>
        );
    }
    if (!me) return <div className="min-h-screen flex items-center justify-center text-sm text-[#64748B]">Loading admin console…</div>;

    return (
        <div className="min-h-screen flex bg-[#0B1120] text-white" data-testid="admin-shell">
            {/* Admin Sidebar — distinct DARK theme to make it OBVIOUSLY a different surface */}
            <aside className="w-64 shrink-0 bg-[#0F172A] border-r border-white/5 flex flex-col">
                <div className="px-5 py-5 border-b border-white/5 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
                        <Crown size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                        <p className="font-display text-base font-black tracking-tight">ZeroMark</p>
                        <p className="text-[9px] uppercase tracking-[0.22em] text-[#F59E0B] font-bold">Platform Console</p>
                    </div>
                </div>

                <nav className="flex-1 py-4 px-3 space-y-1">
                    <p className="text-[9px] uppercase tracking-[0.22em] text-white/40 font-bold px-3 mb-2">// Admin</p>
                    {NAV.map((n) => (
                        <NavLink
                            key={n.to}
                            to={n.to}
                            end={n.end}
                            data-testid={n.testid}
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    isActive ? "bg-[#2563EB] text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                                }`
                            }
                        >
                            <n.icon size={16} weight="bold" /> {n.label}
                        </NavLink>
                    ))}

                    <div className="pt-5 mt-3 border-t border-white/5">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-white/40 font-bold px-3 mb-2">// Platform</p>
                        <a
                            href="/dashboard"
                            data-testid="admin-view-as-user"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white"
                        >
                            <Eye size={16} weight="bold" /> View as user <ArrowSquareOut size={11} weight="bold" className="ml-auto opacity-60" />
                        </a>
                    </div>
                </nav>

                <div className="p-3 border-t border-white/5">
                    <div className="px-3 py-2 mb-2">
                        <p className="text-xs font-bold truncate">{me.email}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#F59E0B] font-bold mt-0.5 flex items-center gap-1">
                            <Crown size={9} weight="fill" /> Super Admin
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        data-testid="admin-logout"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white"
                    >
                        <SignOut size={16} weight="bold" /> Sign out
                    </button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 bg-[#F8FAFC] text-[#0F172A] overflow-y-auto">
                <Outlet />
            </main>
            <ChatbotWidget />
        </div>
    );
}
