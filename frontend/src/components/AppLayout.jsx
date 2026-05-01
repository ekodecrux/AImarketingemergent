import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
    SquaresFour, Users, CheckSquare, Buildings,
    ChartBar, Receipt, SignOut, Sparkle, Compass, Plugs, Crosshair,
    Tray, ChartLineUp, UsersThree, Globe, Pulse, Article, CalendarBlank, List, X,
    Crown, Lightning, House, Rocket, ChatCircleText, Gear, PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";
import ChatbotWidget from "@/components/ChatbotWidget";
import OnboardingWizard from "@/components/OnboardingWizard";

// Simplified 4-group navigation: Home · Grow · Engage · Settings
const baseSections = [
    {
        title: "Home",
        icon: House,
        items: [
            { to: "/dashboard", label: "Dashboard", icon: SquaresFour, testid: "nav-dashboard" },
            { to: "/analytics", label: "Live Analytics", icon: Pulse, testid: "nav-analytics", badge: "LIVE" },
            { to: "/reports", label: "Reports", icon: ChartBar, testid: "nav-reports" },
        ],
    },
    {
        title: "Grow",
        icon: Rocket,
        items: [
            { to: "/growth", label: "Growth Studio", icon: ChartLineUp, testid: "nav-growth" },
            { to: "/content", label: "Content Studio", icon: Article, testid: "nav-content" },
            { to: "/schedule", label: "Auto-publish", icon: CalendarBlank, testid: "nav-schedule", badge: "AUTO" },
            { to: "/landing-pages", label: "Landing Pages", icon: Globe, testid: "nav-landing-pages" },
        ],
    },
    {
        title: "Engage",
        icon: ChatCircleText,
        items: [
            { to: "/leads", label: "Leads (CRM)", icon: Users, testid: "nav-leads" },
            { to: "/scraping", label: "Lead Discovery", icon: Compass, testid: "nav-scraping" },
            { to: "/campaigns", label: "Campaigns", icon: PaperPlaneTilt, testid: "nav-campaigns" },
            { to: "/approvals", label: "Approvals", icon: CheckSquare, testid: "nav-approvals" },
            { to: "/inbox", label: "Inbox", icon: Tray, testid: "nav-inbox" },
            { to: "/competitors", label: "Competitor Watch", icon: Crosshair, testid: "nav-competitors" },
            { to: "/ad-campaigns", label: "Ad Campaigns", icon: Lightning, testid: "nav-ad-campaigns", badge: "PAID" },
        ],
    },
    {
        title: "Settings",
        icon: Gear,
        items: [
            { to: "/business", label: "Business Profile", icon: Buildings, testid: "nav-business" },
            { to: "/connect", label: "Connect Channels", icon: Plugs, testid: "nav-connect", badge: "REAL" },
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
    const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };

    // Auto-close drawer on route change (mobile)
    useEffect(() => { setOpen(false); }, [location.pathname]);

    // Lock body scroll when drawer open
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // Add admin entry if user is admin
    const sections = [...baseSections];
    if ((user?.role || "user") === "admin") {
        sections.push({
            title: "Admin",
            icon: Crown,
            items: [
                { to: "/admin", label: "Platform Console", icon: Crown, testid: "nav-admin", badge: "OWNER" },
            ],
        });
    }

    const Sidebar = (
        <>
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
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

            <nav className="flex-1 px-3 py-4 overflow-y-auto" data-testid="sidebar-nav">
                {sections.map((section, sIdx) => {
                    const SIcon = section.icon;
                    return (
                        <div key={section.title} className={sIdx > 0 ? "mt-5" : ""}>
                            <div className="px-3 mb-2 flex items-center gap-1.5">
                                {SIcon ? <SIcon size={11} weight="bold" className="text-[#94A3B8]" /> : null}
                                <p className="text-[10px] uppercase tracking-[0.12em] text-[#94A3B8] font-bold">{section.title}</p>
                            </div>
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
                    );
                })}
            </nav>

            <div className="border-t border-[#E2E8F0] p-4 shrink-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" data-testid="user-name">{user?.first_name} {user?.last_name}</p>
                        <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
                    </div>
                    <NotificationsBell />
                    <button onClick={handleLogout} data-testid="logout-button"
                        className="p-2 hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#EF4444] transition-colors rounded-xl"
                        title="Logout">
                        <SignOut size={18} weight="bold" />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="h-screen flex bg-[#F8FAFC] overflow-hidden" data-testid="app-shell">
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

            {/* Sidebar — frozen/static on desktop (h-screen + own scroll), drawer on mobile */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r border-[#E2E8F0] flex flex-col lg:h-screen shrink-0 transform transition-transform duration-200 ease-out ${
                    open ? "translate-x-0" : "-translate-x-full"
                } lg:translate-x-0`}
                data-testid="sidebar"
            >
                {Sidebar}
            </aside>

            {/* Main — only this scrolls */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0 h-screen" data-testid="main-content">
                <Outlet />
            </main>
            <ChatbotWidget />
            <OnboardingWizard />
        </div>
    );
}
