import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Check, Crown } from "@phosphor-icons/react";

function loadRazorpay() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

export default function Billing() {
    const [plans, setPlans] = useState([]);
    const [sub, setSub] = useState(null);
    const [loading, setLoading] = useState(null);

    const load = async () => {
        const [p, s] = await Promise.all([api.get("/subscription/plans"), api.get("/subscription/me")]);
        setPlans(p.data.plans);
        setSub(s.data.subscription);
    };
    useEffect(() => { load(); }, []);

    const checkout = async (planId) => {
        setLoading(planId);
        try {
            const ok = await loadRazorpay();
            if (!ok) { toast.error("Razorpay SDK failed to load"); return; }
            const order = await api.post("/subscription/checkout", { plan_id: planId });
            const opts = {
                key: order.data.key_id,
                order_id: order.data.order_id,
                amount: order.data.amount,
                currency: order.data.currency,
                name: "ZeroMark AI",
                description: `${order.data.plan.name} subscription`,
                handler: async (resp) => {
                    try {
                        await api.post("/subscription/verify-payment", {
                            razorpay_order_id: resp.razorpay_order_id,
                            razorpay_payment_id: resp.razorpay_payment_id,
                            razorpay_signature: resp.razorpay_signature,
                            plan_id: planId,
                        });
                        toast.success(`Subscribed to ${order.data.plan.name}`);
                        load();
                    } catch (err) {
                        toast.error("Verification failed");
                    }
                },
                theme: { color: "#002EB8" },
                modal: { ondismiss: () => setLoading(null) },
            };
            new window.Razorpay(opts).open();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Checkout failed");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Subscription"
                title="Billing & Plans"
                subtitle={sub ? `Current plan: ${sub.plan} · Status ${sub.status}` : ""}
            />
            <div className="px-8 py-6">
                <div className="grid md:grid-cols-3 gap-0 zm-card" data-testid="plans">
                    {plans.map((p, i) => {
                        const isCurrent = sub?.plan?.toLowerCase() === p.id;
                        const isFeatured = p.id === "pro";
                        return (
                            <div
                                key={p.id}
                                data-testid={`plan-${p.id}`}
                                className={`p-8 ${i < 2 ? "md:border-r border-b md:border-b-0" : ""} border-[#E4E4E7] ${isFeatured ? "bg-[#09090B] text-white" : "bg-white"}`}
                            >
                                {isFeatured && (
                                    <div className="flex items-center gap-1 mb-4">
                                        <Crown size={14} weight="fill" />
                                        <span className="text-[10px] uppercase tracking-[0.25em] font-bold">Most popular</span>
                                    </div>
                                )}
                                <h3 className={`font-display text-3xl font-black tracking-tighter ${isFeatured ? "text-white" : "text-[#09090B]"}`}>{p.name}</h3>
                                <div className="my-4">
                                    <span className="font-display text-5xl font-black tracking-tighter">₹{p.price_inr}</span>
                                    <span className={`text-sm ${isFeatured ? "text-white/60" : "text-[#71717A]"}`}> /mo</span>
                                </div>
                                <ul className="space-y-2 mb-6">
                                    {p.features.map((f) => (
                                        <li key={f} className={`flex items-start gap-2 text-sm ${isFeatured ? "text-white/80" : "text-[#71717A]"}`}>
                                            <Check size={14} weight="bold" className={isFeatured ? "text-[#10B981] mt-0.5" : "text-[#002EB8] mt-0.5"} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    disabled={isCurrent || loading === p.id}
                                    onClick={() => checkout(p.id)}
                                    data-testid={`subscribe-${p.id}`}
                                    className={isFeatured ? "zm-btn bg-white text-[#09090B] hover:bg-[#F4F4F5] w-full" : "zm-btn-primary w-full"}
                                >
                                    {isCurrent ? "Current plan" : (loading === p.id ? "Opening…" : "Subscribe")}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="zm-card p-6 mt-6">
                    <p className="zm-section-label mb-2">// Test mode</p>
                    <p className="text-sm text-[#71717A]">
                        Razorpay is in test mode. Use test card <span className="font-mono text-[#09090B]">4111 1111 1111 1111</span>,
                        any future expiry, any CVV. UPI test: <span className="font-mono text-[#09090B]">success@razorpay</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
