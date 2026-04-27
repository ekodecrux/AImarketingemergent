import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    SquaresFour, Users, Megaphone, CheckSquare, Buildings,
    ChartBar, Receipt, SignOut, Sparkle, Compass, Plugs,
    Tray, ChartLineUp, UsersThree, Globe, Pulse,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";

const sections = [
    {
        title: "Workspace",
        items: [
            { to: "/dashboard", label: "Dashboard", icon: SquaresFour, testid: "nav-dashboard" },
            { to: "/analytics", label: "Live Analytics", icon: Pulse, testid: "nav-analytics", badge: "LIVE" },
            { to: "/inbox", label: "Inbox", icon: Tray, testid: "nav-inbox" },
            { to: "/approvals", label: "Approvals", icon: CheckSquare, testid: "nav-approvals" },
        ],
    },
    {
        title: "Pipeline",
        items: [
            { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
            { to: "/campaigns", label: "Campaigns", icon: Megaphone, testid: "nav-campaigns" },
            { to: "/scraping", label: "Lead Discovery", icon: Compass, testid: "nav-scraping" },
            { to: "/landing-pages", label: "Landing Pages", icon: Globe, testid: "nav-landing-pages" },
        ],
    },
    {
        title: "Growth",
        items: [
            { to: "/growth", label: "Growth Studio", icon: ChartLineUp, testid: "nav-growth" },
            { to: "/reports", label: "Reports", icon: ChartBar, testid: "nav-reports" },
        ],
    },
    {
        title: "Settings",
        items: [
            { to: "/business", label: "Business Profile", icon: Buildings, testid: "nav-business" },
            { to: "/integrations", label: "Integrations", icon: Plugs, testid: "nav-integrations" },
            { to: "/team", label: "Team", icon: UsersThree, testid: "nav-team" },
            { to: "/billing", label: "Billing", icon: Receipt, testid: "nav-billing" },
        ],
    },
];

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => { await logout(); navigate("/login"); };

    return (
        <div className="min-h-screen flex bg-[#F8FAFC]">
            <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col">
                <div className="px-6 py-5 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center rounded-xl">
                            <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                        </div>
                        <h1 className="font-display text-xl font-black tracking-tight">ZeroMark</h1>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#71717A] mt-1.5 font-bold">AI Marketing Engine</p>
                </div>

                <nav className="flex-1 px-3 py-4 overflow-y-auto">
                    {sections.map((section, sIdx) => (
                        <div key={section.title} className={sIdx > 0 ? "mt-5" : ""}>
                            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] text-[#A1A1AA] font-bold">{section.title}</p>
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    data-testid={item.testid}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors rounded-xl ${
                                            isActive
                                                ? "bg-[#0F172A] text-white"
                                                : "text-[#52525B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                                        }`
                                    }
                                >
                                    <item.icon size={16} weight="bold" />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="border-t border-[#E2E8F0] p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate" data-testid="user-name">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-[#71717A] truncate">{user?.email}</p>
                        </div>
                        <NotificationsBell />
                        <button
                            onClick={handleLogout}
                            data-testid="logout-button"
                            className="p-2 hover:bg-[#F8FAFC] text-[#71717A] hover:text-[#2563EB] transition-colors rounded-xl"
                            title="Logout"
                        >
                            <SignOut size={18} weight="bold" />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-x-hidden">
                <Outlet />
            </main>
        </div>
    );
}
