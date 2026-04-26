import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Campaigns from "@/pages/Campaigns";
import Approvals from "@/pages/Approvals";
import Business from "@/pages/Business";
import Reports from "@/pages/Reports";
import Billing from "@/pages/Billing";
import Scraping from "@/pages/Scraping";

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
                    style: { background: "#09090B", color: "#fff", border: "none", borderRadius: 0, fontFamily: "Manrope" },
                }} />
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                    <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

                    <Route element={<Protected><AppLayout /></Protected>}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/leads" element={<Leads />} />
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/approvals" element={<Approvals />} />
                        <Route path="/scraping" element={<Scraping />} />
                        <Route path="/business" element={<Business />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/billing" element={<Billing />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
