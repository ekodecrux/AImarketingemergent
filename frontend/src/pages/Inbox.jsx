import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { ChatCircle, EnvelopeSimple, WhatsappLogo, ArrowRight, Tray } from "@phosphor-icons/react";

const ICONS = { EMAIL: EnvelopeSimple, SMS: ChatCircle, WHATSAPP: WhatsappLogo };

export default function Inbox() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/communications/inbox")
            .then((r) => setMessages(r.data.messages))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <PageHeader
                eyebrow="// Conversations"
                title="Inbox"
                subtitle="Inbound replies from leads, auto-routed via Twilio webhooks."
            />
            <div className="px-8 py-6">
                <div className="bg-white border border-[#E4E4E7] border-l-2 border-l-[#002EB8] p-4 mb-6 text-xs text-[#71717A]">
                    <span className="font-bold text-[#09090B] uppercase tracking-[0.15em]">// Set up: </span>
                    Point your Twilio phone-number SMS webhook to{" "}
                    <code className="bg-[#F4F4F5] px-1.5 py-0.5 font-mono">{`${process.env.REACT_APP_BACKEND_URL}/api/webhooks/twilio/sms`}</code>{" "}
                    — replies will land here automatically and the lead moves to INTERESTED.
                </div>

                {loading ? (
                    <p className="text-sm text-[#A1A1AA] zm-card p-12 text-center">Loading…</p>
                ) : messages.length === 0 ? (
                    <div className="zm-card p-16 text-center" data-testid="empty-inbox">
                        <Tray size={32} weight="bold" className="mx-auto mb-4 text-[#A1A1AA]" />
                        <p className="zm-section-label mb-2">// Inbox zero</p>
                        <h3 className="font-display text-2xl font-bold tracking-tight">No inbound replies yet.</h3>
                    </div>
                ) : (
                    <div className="zm-card divide-y divide-[#E4E4E7]" data-testid="inbox-list">
                        {messages.map((m) => {
                            const Icon = ICONS[m.channel] || EnvelopeSimple;
                            return (
                                <Link key={m.id} to={`/leads/${m.lead_id}`} className="flex gap-4 p-5 hover:bg-[#F9F9FB] transition-colors" data-testid={`inbox-${m.id}`}>
                                    <div className="w-10 h-10 bg-[#F4F4F5] flex items-center justify-center flex-shrink-0">
                                        <Icon size={18} weight="bold" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-semibold text-sm">{m.lead?.name || "Unknown"}</span>
                                            <span className="zm-badge bg-[#F4F4F5] text-[#09090B]">{m.channel}</span>
                                            <span className="text-[10px] text-[#A1A1AA] ml-auto">{new Date(m.sent_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-[#71717A] line-clamp-2">{m.content}</p>
                                    </div>
                                    <ArrowRight size={16} weight="bold" className="text-[#A1A1AA] mt-3" />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
