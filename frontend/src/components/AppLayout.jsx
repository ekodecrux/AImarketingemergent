import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
    SquaresFour, Users, Megaphone, CheckSquare, Buildings,
    ChartBar, Receipt, SignOut, Sparkle, Compass, Plugs,
    Tray, ChartLineUp, UsersThree, Globe, Pulse, Article, CalendarBlank, List, X,
    Crown, Lightning, Question,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";
import ChatbotWidget from "@/components/ChatbotWidget";

const baseSections = [
    {
        title: "Run",
        items: [
            { to: "/dashboard", label: "Dashboard", icon: SquaresFour, testid: "nav-dashboard" },
            { to: "/analytics", label: "Live Analytics", icon: Pulse, testid: "nav-analytics", badge: "LIVE" },
            { to: "/inbox", label: "Inbox", icon: Tray, testid: "nav-inbox" },
            { to: "/approvals", label: "Approvals", icon: CheckSquare, testid: "nav-approvals" },
        ],
    },
    {
        title: "Strategy",
        items: [
            { to: "/business", label: "Business Profile", icon: Buildings, testid: "nav-business" },
            { to: "/growth", label: "Growth Studio", icon: ChartLineUp, testid: "nav-growth" },
        ],
    },
    {
        title: "Execution Engine",
        items: [
            { to: "/leads", label: "Leads (CRM)", icon: Users, testid: "nav-leads" },
            { to: "/scraping", label: "Lead Discovery", icon: Compass, testid: "nav-scraping" },
            { to: "/campaigns", label: "Campaigns", icon: Megaphone, testid: "nav-campaigns" },
            { to: "/ad-campaigns", label: "Ad Campaigns", icon: Lightning, testid: "nav-ad-campaigns", badge: "PAID" },
            { to: "/landing-pages", label: "Landing Pages", icon: Globe, testid: "nav-landing-pages" },
        ],
    },
    {
        title: "Posts & Content",
        items: [
            { to: "/content", label: "Content Studio", icon: Article, testid: "nav-content" },
            { to: "/schedule", label: "Auto-publish", icon: CalendarBlank, testid: "nav-schedule", badge: "AUTO" },
        ],
    },
    {
        title: "Reports",
        items: [
            { to: "/reports", label: "Reports & Analysis", icon: ChartBar, testid: "nav-reports" },
        ],
    },
    {
        title: "Settings",
        items: [
            { to: "/integrations", label: "Integrations", icon: Plugs, testid: "nav-integrations" },
            { to: "/team", label: "Team & Alerts", icon: UsersThree, testid: "nav-team" },
            { to: "/billing", label: "Billing", icon: Receipt, testid: "nav-billing" },
        ],
    },
];

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const handleLogout = async () => { await logout(); navigate("/login"); };

    // Auto-close drawer on route change (mobile)
    useEffect(() => { setOpen(false); }, [location.pathname]);

    // Lock body scroll when drawer open
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // Add admin section if user is admin
    const sections = [...baseSections];
    if ((user?.role || "user") === "admin") {
        sections.push({
            title: "Admin",
            items: [
                { to: "/admin", label: "Super Admin", icon: Crown, testid: "nav-admin", badge: "PRO" },
            ],
        });
    }

    const Sidebar = (
        <>
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center rounded-xl">
                        <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h1 className="font-display text-xl font-black tracking-tight">ZeroMark</h1>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-bold">AI Marketing Engine</p>
                    </div>
                </div>
                <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 hover:bg-[#F8FAFC] rounded-md text-[#64748B]" aria-label="Close menu">
                    <X size={18} weight="bold" />
                </button>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto">
                {sections.map((section, sIdx) => (
                    <div key={section.title} className={sIdx > 0 ? "mt-5" : ""}>
                        <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] text-[#94A3B8] font-bold">{section.title}</p>
                        {section.items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                data-testid={item.testid}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors rounded-xl ${
                                        isActive ? "bg-[#0F172A] text-white" : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                                    }`
                                }
                            >
                                <item.icon size={16} weight="bold" />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="border-t border-[#E2E8F0] p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" data-testid="user-name">{user?.first_name} {user?.last_name}</p>
                        <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
                    </div>
                    <NotificationsBell />
                    <button onClick={handleLogout} data-testid="logout-button"
                        className="p-2 hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#2563EB] transition-colors rounded-xl"
                        title="Logout">
                        <SignOut size={18} weight="bold" />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="min-h-screen flex bg-[#F8FAFC]">
            {/* Mobile top bar */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
                <button onClick={() => setOpen(true)} className="p-1.5 -ml-1 hover:bg-[#F8FAFC] rounded-md" aria-label="Open menu" data-testid="mobile-menu-toggle">
                    <List size={20} weight="bold" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#0F172A] flex items-center justify-center rounded-md">
                        <Sparkle size={14} weight="fill" className="text-[#2563EB]" />
                    </div>
                    <span className="font-display text-base font-black tracking-tight">ZeroMark</span>
                </div>
                <NotificationsBell />
            </header>

            {/* Mobile drawer overlay */}
            {open && (
                <div className="lg:hidden fixed inset-0 bg-[#0F172A]/40 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            )}

            {/* Sidebar — fixed on mobile (drawer), static on desktop */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r border-[#E2E8F0] flex flex-col transform transition-transform duration-200 ease-out ${
                    open ? "translate-x-0" : "-translate-x-full"
                } lg:translate-x-0`}
                data-testid="sidebar"
            >
                {Sidebar}
            </aside>

            <main className="flex-1 min-w-0 overflow-x-hidden pt-14 lg:pt-0">
                <Outlet />
            </main>
            <ChatbotWidget />
        </div>
    );
}
