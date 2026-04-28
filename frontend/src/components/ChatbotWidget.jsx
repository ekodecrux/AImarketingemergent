import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import { ChatCircle, X, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";

export default function ChatbotWidget() {
    const [open, setOpen] = useState(false);
    const [msgs, setMsgs] = useState([
        { role: "assistant", content: "Hey! I'm your ZeroMark guide. Ask anything — 'how do I find leads?', 'set a target', 'why is my forecast at risk?'" },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [msgs, open]);

    const send = async (e) => {
        e?.preventDefault();
        const text = input.trim();
        if (!text || sending) return;
        setMsgs((m) => [...m, { role: "user", content: text }]);
        setInput("");
        setSending(true);
        try {
            const r = await api.post("/assistant/chat", {
                message: text,
                history: msgs.slice(-8),
            });
            setMsgs((m) => [...m, { role: "assistant", content: r.data.reply }]);
        } catch (err) {
            setMsgs((m) => [...m, { role: "assistant", content: "I hit a snag — please try again or check the [Setup Checklist](/dashboard)." }]);
        } finally {
            setSending(false);
        }
    };

    const renderInline = (txt) => {
        // Render [label](/path) as router link
        const parts = txt.split(/(\[[^\]]+\]\([^)]+\))/g);
        return parts.map((p, i) => {
            const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (m) return <a key={i} href={m[2]} className="text-[#2563EB] font-semibold underline">{m[1]}</a>;
            return <span key={i}>{p}</span>;
        });
    };

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#2563EB] text-white shadow-xl hover:bg-[#1D4ED8] transition-colors flex items-center justify-center"
                aria-label="Open assistant"
                data-testid="chatbot-toggle"
            >
                {open ? <X size={22} weight="bold" /> : <ChatCircle size={22} weight="fill" />}
            </button>

            {open && (
                <div className="fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-[380px] h-[500px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden" data-testid="chatbot-panel">
                    <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#2563EB] flex items-center justify-center">
                            <Sparkle size={14} weight="fill" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold">ZeroMark Guide</p>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-white/60">AI-powered · always on</p>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
                        {msgs.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                    m.role === "user"
                                        ? "bg-[#2563EB] text-white rounded-br-sm"
                                        : "bg-white text-[#0F172A] rounded-bl-sm border border-[#E2E8F0]"
                                }`}>
                                    {renderInline(m.content)}
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                    <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                    <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={send} className="border-t border-[#E2E8F0] p-3 flex gap-2 bg-white">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything…"
                            className="zm-input flex-1 text-sm"
                            data-testid="chatbot-input"
                        />
                        <button type="submit" disabled={sending || !input.trim()} className="zm-btn-primary px-3" data-testid="chatbot-send">
                            <PaperPlaneTilt size={14} weight="fill" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
