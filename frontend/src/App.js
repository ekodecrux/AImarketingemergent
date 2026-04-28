import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Onboarding from "@/pages/Onboarding";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import LeadDetail from "@/pages/LeadDetail";
import Campaigns from "@/pages/Campaigns";
import Approvals from "@/pages/Approvals";
import Inbox from "@/pages/Inbox";
import Business from "@/pages/Business";
import Reports from "@/pages/Reports";
import Billing from "@/pages/Billing";
import Scraping from "@/pages/Scraping";
import Integrations from "@/pages/Integrations";
import GrowthStudio from "@/pages/GrowthStudio";
import Team from "@/pages/Team";
import LandingPages from "@/pages/LandingPages";
import LandingPageEditor from "@/pages/LandingPageEditor";
import PublicLandingPage from "@/pages/PublicLandingPage";
import Analytics from "@/pages/Analytics";
import AuthCallback from "@/pages/AuthCallback";
import Content from "@/pages/Content";
import Schedule from "@/pages/Schedule";
import Admin from "@/pages/Admin";
import AdCampaigns from "@/pages/AdCampaigns";

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-sm text-[#71717A]">Authenticating…</div>;
    }
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

function PublicOnly({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-right" toastOptions={{
                    style: { background: "#0F172A", color: "#fff", border: "none", borderRadius: 12, fontFamily: "Source Sans 3" },
                }} />
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                    <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    {/* Public landing page (built by users) */}
                    <Route path="/p/:slug" element={<PublicLandingPage />} />

                    <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

                    <Route element={<Protected><AppLayout /></Protected>}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/leads" element={<Leads />} />
                        <Route path="/leads/:id" element={<LeadDetail />} />
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/approvals" element={<Approvals />} />
                        <Route path="/inbox" element={<Inbox />} />
                        <Route path="/landing-pages" element={<LandingPages />} />
                        <Route path="/landing-pages/:id" element={<LandingPageEditor />} />
                        <Route path="/growth" element={<GrowthStudio />} />
                        <Route path="/content" element={<Content />} />
                        <Route path="/schedule" element={<Schedule />} />
                        <Route path="/ad-campaigns" element={<AdCampaigns />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/scraping" element={<Scraping />} />
                        <Route path="/integrations" element={<Integrations />} />
                        <Route path="/business" element={<Business />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/team" element={<Team />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
