import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    SquaresFour, Users, Megaphone, CheckSquare, Buildings,
    ChartBar, Receipt, SignOut, Sparkle, Compass, Plugs,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: SquaresFour, testid: "nav-dashboard" },
    { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone, testid: "nav-campaigns" },
    { to: "/approvals", label: "Approvals", icon: CheckSquare, testid: "nav-approvals" },
    { to: "/scraping", label: "Scrape", icon: Compass, testid: "nav-scraping" },
    { to: "/integrations", label: "Integrations", icon: Plugs, testid: "nav-integrations" },
    { to: "/business", label: "Business", icon: Buildings, testid: "nav-business" },
    { to: "/reports", label: "Reports", icon: ChartBar, testid: "nav-reports" },
    { to: "/billing", label: "Billing", icon: Receipt, testid: "nav-billing" },
];

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex bg-[#F4F4F5]">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-[#E4E4E7] flex flex-col">
                <div className="px-6 py-6 border-b border-[#E4E4E7]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#002EB8] flex items-center justify-center">
                            <Sparkle size={16} weight="fill" className="text-white" />
                        </div>
                        <h1 className="font-display text-xl font-black tracking-tighter">ZEROMARK</h1>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#71717A] mt-1">AI Marketing Engine</p>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-0.5">
                    <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.25em] text-[#A1A1AA] font-bold">Navigation</p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            data-testid={item.testid}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive
                                        ? "bg-[#09090B] text-white"
                                        : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B]"
                                }`
                            }
                        >
                            <item.icon size={18} weight="bold" />
                            {item.label}
                        </NavLink>
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
                            className="p-2 hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#E32636] transition-colors"
                            title="Logout"
                        >
                            <SignOut size={18} weight="bold" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-x-hidden">
                <Outlet />
            </main>
        </div>
    );
}
