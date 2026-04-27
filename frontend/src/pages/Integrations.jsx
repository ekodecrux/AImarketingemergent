import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    WhatsappLogo, FacebookLogo, InstagramLogo, LinkedinLogo, TwitterLogo,
    Plug, PlugsConnected, Lock,
} from "@phosphor-icons/react";

const CHANNELS = [
    {
        id: "whatsapp", label: "WhatsApp Business", icon: WhatsappLogo, color: "#25D366",
        status: "ready", note: "Live via Twilio Sandbox. Recipients must opt-in once.",
        fields: [{ key: "from_number", label: "Twilio WA From Number (optional, defaults to sandbox)", placeholder: "+14155238886" }],
    },
    {
        id: "linkedin", label: "LinkedIn", icon: LinkedinLogo, color: "#0A66C2",
        status: "config", note: "Click 'Connect' to start OAuth (requires LINKEDIN_CLIENT_ID env). Or paste tokens manually.",
        oauth: true,
        fields: [
            { key: "access_token", label: "LinkedIn Access Token", type: "password" },
            { key: "company_urn", label: "Company URN (urn:li:organization:...)" },
        ],
    },
    {
        id: "facebook", label: "Facebook Pages", icon: FacebookLogo, color: "#1877F2",
        status: "config", note: "Click 'Connect' to OAuth (requires FACEBOOK_APP_ID env).",
        oauth: true,
        fields: [
            { key: "page_id", label: "Page ID" },
            { key: "access_token", label: "Page Access Token", type: "password" },
        ],
    },
    {
        id: "instagram", label: "Instagram Business", icon: InstagramLogo, color: "#E4405F",
        status: "config", note: "Use Facebook OAuth and link an IG Business account.",
        fields: [
            { key: "ig_user_id", label: "Instagram User ID" },
            { key: "access_token", label: "Long-lived Access Token", type: "password" },
        ],
    },
    {
        id: "twitter", label: "X (Twitter)", icon: TwitterLogo, color: "#000",
        status: "config", note: "Click 'Connect' to OAuth (requires TWITTER_CLIENT_ID env).",
        oauth: true,
        fields: [
            { key: "bearer_token", label: "Bearer Token", type: "password" },
        ],
    },
];

export default function Integrations() {
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});

    const load = () => {
        setLoading(true);
        api.get("/integrations")
            .then((r) => setItems(r.data.integrations || {}))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const save = async (channel) => {
        try {
            await api.post("/integrations", { channel, config: form, connected: true });
            toast.success(`${channel} connected`);
            setEditing(null);
            setForm({});
            load();
        } catch { toast.error("Save failed"); }
    };

    const disconnect = async (channel) => {
        await api.delete(`/integrations/${channel}`);
        toast("Disconnected");
        load();
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Channel hub"
                title="Integrations"
                subtitle="Connect your social, email and messaging accounts to run real campaigns."
            />
            <div className="px-8 py-6">
                <div className="bg-white border border-[#EDE5D4] border-l-2 border-l-[#F59E0B] p-6 mb-6">
                    <p className="zm-section-label mb-2">// Heads up</p>
                    <p className="text-sm text-[#71717A] leading-relaxed">
                        Email and SMS are <span className="font-bold text-[#0E0F11]">live out of the box</span>.
                        WhatsApp uses the Twilio sandbox (your recipients have to opt in once via a join code).
                        Social platforms (LinkedIn / Facebook / Instagram / X) require their own developer apps —
                        when you have credentials, paste them below and ZeroMark will start posting through them.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4" data-testid="integrations-list">
                    {CHANNELS.map((c) => {
                        const item = items[c.id];
                        const isConnected = !!item?.connected;
                        return (
                            <div key={c.id} className="zm-card p-6" data-testid={`integration-${c.id}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 flex items-center justify-center" style={{ background: c.color }}>
                                            <c.icon size={20} weight="fill" className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-display text-lg font-bold tracking-tight">{c.label}</h3>
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold">
                                                {isConnected ? "Connected" : (c.status === "ready" ? "Ready" : "Not connected")}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`zm-badge ${isConnected ? "bg-[#10B981] text-white" : "bg-[#FAF7F2] text-[#71717A]"}`}>
                                        {isConnected ? <PlugsConnected size={10} weight="bold" /> : <Plug size={10} weight="bold" />}
                                        {isConnected ? "ON" : "OFF"}
                                    </span>
                                </div>
                                <p className="text-xs text-[#71717A] leading-relaxed mb-4 min-h-[36px]">{c.note}</p>

                                {editing === c.id ? (
                                    <div className="space-y-3">
                                        {c.fields.map((f) => (
                                            <div key={f.key}>
                                                <label className="zm-label">{f.label}</label>
                                                <input
                                                    type={f.type || "text"}
                                                    placeholder={f.placeholder || ""}
                                                    value={form[f.key] || ""}
                                                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                                    className="zm-input"
                                                    data-testid={`integration-${c.id}-${f.key}`}
                                                />
                                            </div>
                                        ))}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={() => save(c.id)} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`save-integration-${c.id}`}>
                                                Save & Connect
                                            </button>
                                            <button onClick={() => { setEditing(null); setForm({}); }} className="zm-btn-secondary text-xs py-2">Cancel</button>
                                        </div>
                                        <p className="text-[10px] text-[#A1A1AA] flex items-center gap-1 pt-1">
                                            <Lock size={10} weight="fill" /> Tokens are stored encrypted at rest.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {c.oauth && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const r = await api.get(`/oauth/${c.id}/start`);
                                                        window.location.href = r.data.auth_url;
                                                    } catch (err) {
                                                        toast.error(err.response?.data?.detail || "OAuth not configured");
                                                    }
                                                }}
                                                className="zm-btn-primary text-xs py-2"
                                                style={{ background: c.color }}
                                                data-testid={`oauth-${c.id}`}
                                            >
                                                <c.icon size={14} weight="fill" /> Connect with {c.label.split(" ")[0]}
                                            </button>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditing(c.id); setForm({}); }} className="zm-btn-secondary flex-1 text-xs py-2" data-testid={`configure-${c.id}`}>
                                                {isConnected ? "Reconfigure manually" : "Manual config"}
                                            </button>
                                            {isConnected && (
                                                <button onClick={() => disconnect(c.id)} className="zm-btn-destructive text-xs py-2" data-testid={`disconnect-${c.id}`}>
                                                    Disconnect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
