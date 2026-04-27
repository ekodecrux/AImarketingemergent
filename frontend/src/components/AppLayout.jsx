import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    SquaresFour, Users, Megaphone, CheckSquare, Buildings,
    ChartBar, Receipt, SignOut, Sparkle, Compass, Plugs,
    Tray, ChartLineUp,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const sections = [
    {
        title: "Workspace",
        items: [
            { to: "/dashboard", label: "Dashboard", icon: SquaresFour, testid: "nav-dashboard" },
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
            { to: "/billing", label: "Billing", icon: Receipt, testid: "nav-billing" },
        ],
    },
];

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => { await logout(); navigate("/login"); };

    return (
        <div className="min-h-screen flex bg-[#F4F4F5]">
            <aside className="w-64 bg-white border-r border-[#E4E4E7] flex flex-col">
                <div className="px-6 py-5 border-b border-[#E4E4E7]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#002EB8] flex items-center justify-center rounded-sm">
                            <Sparkle size={16} weight="fill" className="text-white" />
                        </div>
                        <h1 className="font-display text-lg font-bold tracking-tight">ZeroMark</h1>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#71717A] mt-1 font-semibold">AI Marketing Engine</p>
                </div>

                <nav className="flex-1 px-3 py-4 overflow-y-auto">
                    {sections.map((section, sIdx) => (
                        <div key={section.title} className={sIdx > 0 ? "mt-5" : ""}>
                            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] text-[#A1A1AA] font-semibold">{section.title}</p>
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    data-testid={item.testid}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-sm ${
                                            isActive
                                                ? "bg-[#09090B] text-white"
                                                : "text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]"
                                        }`
                                    }
                                >
                                    <item.icon size={16} weight="bold" />
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="border-t border-[#E4E4E7] p-4">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" data-testid="user-name">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-[#71717A] truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            data-testid="logout-button"
                            className="p-2 hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#E32636] transition-colors rounded-sm"
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
