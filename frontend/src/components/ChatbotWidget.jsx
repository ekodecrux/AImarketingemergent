import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import { ChatCircle, X, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";

export default function ChatbotWidget() {
    const [open, setOpen] = useState(false);
    const [hasNewTip, setHasNewTip] = useState(false);
    const [msgs, setMsgs] = useState([
        { role: "assistant", content: "Hey! 👋 I'm your ZeroMark guide. I'll keep things simple — no marketing jargon. Try asking me:\n\n• \"How do I get my first lead?\"\n• \"Set my budget to ₹5000\"\n• \"Why is my forecast at risk?\"\n• \"Show me my best content\"\n\nOr just tell me what you're trying to do and I'll point you to the right page." },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    // First-visit auto-pop: tap on the assistant after 4s on first session
    useEffect(() => {
        const seen = sessionStorage.getItem("zm_chat_seen");
        if (!seen) {
            const t = setTimeout(() => {
                setHasNewTip(true);
                sessionStorage.setItem("zm_chat_seen", "1");
            }, 4000);
            return () => clearTimeout(t);
        }
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [msgs, open]);

    const QUICK_PROMPTS = [
        "How do I get my first lead?",
        "Where can I see my plan?",
        "Help me launch ad campaigns",
        "Why is my forecast at risk?",
    ];

    const send = async (text) => {
        const t = (text ?? input).trim();
        if (!t || sending) return;
        setMsgs((m) => [...m, { role: "user", content: t }]);
        setInput("");
        setSending(true);
        try {
            const r = await api.post("/assistant/chat", {
                message: t,
                history: msgs.slice(-8),
            });
            setMsgs((m) => [...m, { role: "assistant", content: r.data.reply }]);
        } catch (err) {
            setMsgs((m) => [...m, { role: "assistant", content: "I hit a snag — please try again or check the [Setup Checklist](/dashboard)." }]);
        } finally {
            setSending(false);
        }
    };

    const onSubmit = (e) => { e?.preventDefault(); send(); };

    const handleToggle = () => {
        setOpen(!open);
        setHasNewTip(false);
    };

    const renderInline = (txt) => {
        // Render [label](/path) as router link + simple newlines
        return txt.split("\n").map((line, lineIdx) => {
            const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
            return (
                <div key={lineIdx} className={lineIdx > 0 ? "mt-1" : ""}>
                    {parts.map((p, i) => {
                        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                        if (m) return <a key={i} href={m[2]} className="text-[#2563EB] font-semibold underline">{m[1]}</a>;
                        return <span key={i}>{p}</span>;
                    })}
                </div>
            );
        });
    };

    return (
        <>
            <button
                onClick={handleToggle}
                className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#2563EB] text-white shadow-xl hover:bg-[#1D4ED8] transition-colors flex items-center justify-center"
                aria-label="Open assistant"
                data-testid="chatbot-toggle"
            >
                {open ? <X size={22} weight="bold" /> : <ChatCircle size={22} weight="fill" />}
                {hasNewTip && !open && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#EF4444] border-2 border-white rounded-full animate-pulse" />
                )}
            </button>
            {hasNewTip && !open && (
                <div className="fixed bottom-24 right-5 z-40 max-w-[260px] bg-white rounded-2xl shadow-xl border border-[#E2E8F0] px-4 py-3 cursor-pointer animate-in"
                    onClick={handleToggle} data-testid="chatbot-tooltip">
                    <p className="text-xs font-bold text-[#0F172A]">Need help getting started?</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">I'll walk you through setting up your first marketing plan in under 2 minutes.</p>
                </div>
            )}

            {open && (
                <div className="fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-[400px] h-[540px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden" data-testid="chatbot-panel">
                    <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#2563EB] flex items-center justify-center">
                            <Sparkle size={14} weight="fill" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold">ZeroMark Guide</p>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-white/60">AI-powered · No jargon · Always on</p>
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

                    {/* Quick prompts shown only at start */}
                    {msgs.length <= 1 && !sending && (
                        <div className="px-3 pt-2 pb-1 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-[#94A3B8] font-bold mb-1.5">Quick questions</p>
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_PROMPTS.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => send(q)}
                                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                                        data-testid={`quick-prompt-${q.slice(0, 12)}`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="border-t border-[#E2E8F0] p-3 flex gap-2 bg-white">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask in plain English…"
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
