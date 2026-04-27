import { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("zm_token");
        if (!token) {
            setLoading(false);
            return;
        }
        api.get("/auth/me")
            .then((r) => setUser(r.data.user))
            .catch(() => localStorage.removeItem("zm_token"))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const r = await api.post("/auth/login", { email, password });
        localStorage.setItem("zm_token", r.data.token);
        setUser(r.data.user);
        return r.data.user;
    };

    const register = async (data) => {
        const r = await api.post("/auth/register", data);
        localStorage.setItem("zm_token", r.data.token);
        setUser(r.data.user);
        return r.data.user;
    };

    const setSession = (token, userData) => {
        localStorage.setItem("zm_token", token);
        setUser(userData);
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch (_) {}
        localStorage.removeItem("zm_token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, setSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
