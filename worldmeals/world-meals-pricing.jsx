import { useState } from "react";

const PLANS = [
  {
    id: "explorer",
    name: "Explorer",
    emoji: "🌱",
    monthly: 0,
    annual: 0,
    color: "#888",
    bg: "#F5F5F0",
    desc: "Taste the world for free",
    features: [
      { text: "Browse 100+ world dishes", included: true },
      { text: "Filter by country & region", included: true },
      { text: "5 AI recipe generations/month", included: true },
      { text: "Save up to 5 favourites", included: true },
      { text: "Spice substitution engine", included: false },
      { text: "Weekly meal planner", included: false },
      { text: "AI Fridge Chef (unlimited)", included: false },
      { text: "World Tour Challenge", included: false },
      { text: "Nutrition dashboard", included: false },
    ],
    cta: "Start free",
    ctaBg: "#F5F5F0",
    ctaColor: "#1a1a18",
    ctaBorder: "1px solid #E5E5E0",
  },
  {
    id: "chef",
    name: "Chef",
    emoji: "👨‍🍳",
    monthly: 7.99,
    annual: 4.99,
    color: "#fff",
    bg: "#1a1a18",
    desc: "Cook the world every week",
    badge: "Most popular",
    features: [
      { text: "Everything in Explorer", included: true },
      { text: "Unlimited AI recipe generations", included: true },
      { text: "Spice substitution engine", included: true },
      { text: "Weekly meal planner", included: true },
      { text: "AI Fridge Chef (unlimited)", included: true },
      { text: "World Tour Challenge + badges", included: true },
      { text: "Full nutrition dashboard", included: true },
      { text: "Smart grocery list", included: false },
      { text: "Live chef classes", included: false },
    ],
    cta: "Start 7-day free trial",
    ctaBg: "#fff",
    ctaColor: "#1a1a18",
    ctaBorder: "none",
  },
  {
    id: "passport",
    name: "Passport",
    emoji: "✈️",
    monthly: 14.99,
    annual: 9.99,
    color: "#085041",
    bg: "#E1F5EE",
    desc: "The full global experience",
    features: [
      { text: "Everything in Chef", included: true },
      { text: "Smart grocery list", included: true },
      { text: "Live chef classes from native cooks", included: true },
      { text: "Snap & identify any dish (camera AI)", included: true },
      { text: "Exclusive regional dish drops", included: true },
      { text: "Early access to new features", included: true },
      { text: "Priority support", included: true },
      { text: "Ad-free forever", included: true },
      { text: "Family sharing (up to 5)", included: true },
    ],
    cta: "Go Passport",
    ctaBg: "#1a1a18",
    ctaColor: "#fff",
    ctaBorder: "none",
  },
];

const FAQS = [
  { q: "Will I be charged anything today?", a: "No. The 7-day free trial on Chef gives you full access with zero charge. We only charge after the trial ends, and you can cancel anytime before then." },
  { q: "How does payment work?", a: "All payments are processed by Stripe — the same technology used by Amazon, Spotify, and Airbnb. We never see your card details. Ever. Stripe handles everything securely." },
  { q: "Can I pay with Apple Pay or Google Pay?", a: "Yes — both are supported. Just tap the button at checkout and authenticate with Face ID or fingerprint. No card entry needed." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel with one tap, no questions asked. If you cancel during a billing period, you keep access until the period ends." },
  { q: "What's the difference between monthly and annual?", a: "Annual saves you up to 38%. For Chef, that's $35.88 back in your pocket every year. You're billed once and covered for 12 months." },
  { q: "Is there a refund policy?", a: "Yes — if you're not happy in the first 14 days, we'll refund you in full. No arguments, no complicated process." },
];

const TESTIMONIALS = [
  { name: "Sarah M.", country: "🇬🇧 London", text: "I was terrified of cooking Indian food — too spicy, too complex. The substitution engine changed everything. Made Butter Chicken mild and dairy-free on my first try.", plan: "Chef" },
  { name: "James K.", country: "🇺🇸 New York", text: "The meal planner alone is worth the subscription. I plan my whole week in 5 minutes, know exactly what it costs, and I've cooked dishes from 14 countries in 2 months.", plan: "Passport" },
  { name: "Amina T.", country: "🇦🇪 Dubai", text: "The fridge chef feature is like magic. I type whatever I have at home and it gives me a real dish from somewhere in the world. I've discovered so many cuisines I never knew.", plan: "Chef" },
];

export default function PricingPage() {
  const [billing, setBilling] = useState("annual");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payStep, setPayStep] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSelect = (plan) => {
    if (plan.id === "explorer") return;
    setSelectedPlan(plan);
    setPayStep("method");
  };

  const handlePay = (method) => {
    setPayStep("confirm");
    setProcessing(false);
  };

  const handleConfirm = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  const price = (plan) => billing === "annual" ? plan.annual : plan.monthly;
  const savings = (plan) => plan.monthly > 0 ? Math.round(((plan.monthly - plan.annual) / plan.monthly) * 100) : 0;

  if (success) return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: "#FAFAF8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Welcome to World Meals {selectedPlan?.name}!</div>
        <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 24 }}>Your payment was handled securely by Stripe. We didn't see a single digit of your card — just a confirmation that you're in. Time to cook the world! 🌍</div>
        <div style={{ background: "#F0FDF4", borderRadius: 14, padding: "14px 18px", marginBottom: 20, textAlign: "left" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#166534", marginBottom: 8, letterSpacing: "0.05em" }}>WHAT HAPPENS NEXT</div>
          {["Check your email for your receipt from Stripe","Your account is now active — all features unlocked","Start your World Tour Challenge 🏆","Plan your first world meal week 📅"].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "#166534", alignItems: "flex-start" }}>
              <span style={{ marginTop: 1 }}>✓</span>{s}
            </div>
          ))}
        </div>
        <button onClick={() => { setSuccess(false); setSelectedPlan(null); setPayStep(null); }}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "#1a1a18", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Start cooking 🍽
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: "#FAFAF8", minHeight: "100vh", color: "#1a1a18" }}>

      {/* HEADER */}
      <div style={{ background: "#1a1a18", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>🌍</span>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>World Meals</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>Secured by Stripe 🔒</div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 60px" }}>

        {/* HERO */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#888", marginBottom: 10, textTransform: "uppercase" }}>Simple, honest pricing</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8, lineHeight: 1.2 }}>Cook the world.<br />Pay once a month.</div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>No hidden fees. No surprise charges. Cancel anytime.</div>

          {/* BILLING TOGGLE */}
          <div style={{ display: "inline-flex", background: "#EBEBEB", borderRadius: 30, padding: 3, gap: 2 }}>
            {["monthly", "annual"].map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ padding: "7px 18px", borderRadius: 24, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: billing === b ? "#1a1a18" : "transparent", color: billing === b ? "#fff" : "#888", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
                {b === "annual" ? "Annual" : "Monthly"}
                {b === "annual" && <span style={{ fontSize: 10, background: "#22C55E", color: "#fff", borderRadius: 10, padding: "1px 6px" }}>Save 38%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* PLANS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 32 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: plan.bg, borderRadius: 18, padding: "20px 16px", position: "relative", border: plan.id === "chef" ? "2px solid #1a1a18" : "1px solid #E5E5E0" }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#22C55E", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontSize: 24, marginBottom: 6 }}>{plan.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: plan.color || "#1a1a18", marginBottom: 2 }}>{plan.name}</div>
              <div style={{ fontSize: 11, color: plan.id === "chef" ? "#888" : "#999", marginBottom: 12 }}>{plan.desc}</div>
              <div style={{ marginBottom: 16 }}>
                {plan.monthly === 0 ? (
                  <div style={{ fontSize: 28, fontWeight: 800, color: plan.color || "#1a1a18" }}>Free</div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: plan.id === "chef" ? "#aaa" : "#888", marginTop: 4 }}>$</span>
                      <span style={{ fontSize: 30, fontWeight: 800, color: plan.color || "#1a1a18" }}>{price(plan).toFixed(2)}</span>
                      <span style={{ fontSize: 11, color: plan.id === "chef" ? "#888" : "#999" }}>/mo</span>
                    </div>
                    {billing === "annual" && savings(plan) > 0 && (
                      <div style={{ fontSize: 11, color: "#22C55E", fontWeight: 600, marginTop: 2 }}>Save {savings(plan)}% vs monthly</div>
                    )}
                    {billing === "annual" && (
                      <div style={{ fontSize: 10, color: plan.id === "chef" ? "#666" : "#999", marginTop: 1 }}>Billed ${(price(plan) * 12).toFixed(2)}/year</div>
                    )}
                  </>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: f.included ? "#22C55E" : plan.id === "chef" ? "#444" : "#ccc", flexShrink: 0, marginTop: 1 }}>{f.included ? "✓" : "–"}</span>
                    <span style={{ fontSize: 11, color: f.included ? (plan.color || "#1a1a18") : plan.id === "chef" ? "#555" : "#bbb", lineHeight: 1.4 }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => handleSelect(plan)}
                style={{ width: "100%", padding: "11px", borderRadius: 12, border: plan.ctaBorder, background: plan.ctaBg, color: plan.ctaColor, fontSize: 13, fontWeight: 700, cursor: plan.id === "explorer" ? "default" : "pointer" }}>
                {plan.cta}
              </button>
              {plan.id === "chef" && (
                <div style={{ textAlign: "center", fontSize: 10, color: "#666", marginTop: 8 }}>No card required for trial</div>
              )}
            </div>
          ))}
        </div>

        {/* TRUST BAR */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EBEBEB", padding: "14px 18px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: "0.05em", marginBottom: 12, textAlign: "center" }}>PAYMENT SECURITY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              ["🔒", "256-bit SSL", "Bank-level encryption on every transaction"],
              ["🏦", "Powered by Stripe", "We never see your card. Not one digit."],
              ["↩️", "14-day refund", "Not happy? Full refund, no questions."],
            ].map(([ic, title, desc]) => (
              <div key={title} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TESTIMONIALS */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, textAlign: "center" }}>What our cooks say</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid #EBEBEB", padding: "14px 16px" }}>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 10 }}>"{t.text}"</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5F5F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{t.name[0]}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>{t.country}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, background: "#F5F5F0", borderRadius: 10, padding: "2px 8px", color: "#666" }}>{t.plan}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Frequently asked</div>
          {FAQS.map((f, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #EBEBEB", marginBottom: 6, overflow: "hidden" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a18" }}>{f.q}</span>
                <span style={{ fontSize: 16, color: "#888", flexShrink: 0, marginLeft: 8 }}>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 16px 13px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <div style={{ background: "#1a1a18", borderRadius: 18, padding: "24px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🌍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Ready to cook the world?</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Join thousands of home cooks exploring global cuisine</div>
          <button onClick={() => handleSelect(PLANS[1])}
            style={{ width: "100%", maxWidth: 280, padding: "13px", borderRadius: 12, border: "none", background: "#fff", color: "#1a1a18", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
            Start free trial — Chef plan
          </button>
          <div style={{ fontSize: 11, color: "#555" }}>7 days free · No card required · Cancel anytime</div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {selectedPlan && payStep && (
        <div onClick={e => e.target === e.currentTarget && setPayStep(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px 36px" }}>

            {/* METHOD SELECTION */}
            {payStep === "method" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>Complete your order</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{selectedPlan.name} · ${price(selectedPlan).toFixed(2)}/mo · {billing}</div>
                  </div>
                  <button onClick={() => setPayStep(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
                </div>
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>🔒</span>
                  <div style={{ fontSize: 12, color: "#166534" }}>Payments processed by <b>Stripe</b> — we never see your card details</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: "0.05em", marginBottom: 10 }}>CHOOSE HOW TO PAY</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => handlePay("apple")}
                    style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #E5E5E0", background: "#000", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    🍎 Apple Pay
                  </button>
                  <button onClick={() => handlePay("google")}
                    style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #E5E5E0", background: "#fff", color: "#1a1a18", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>G</span> Google Pay
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                    <div style={{ flex: 1, height: "0.5px", background: "#E5E5E0" }} />
                    <span style={{ fontSize: 11, color: "#bbb" }}>or pay with debit card</span>
                    <div style={{ flex: 1, height: "0.5px", background: "#E5E5E0" }} />
                  </div>
                  <button onClick={() => handlePay("card")}
                    style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #E5E5E0", background: "#F5F5F0", color: "#1a1a18", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    💳 Debit card via Stripe
                  </button>
                </div>
                <div style={{ textAlign: "center", fontSize: 10, color: "#bbb", marginTop: 14 }}>
                  Your payment info goes directly to Stripe's encrypted servers.<br />World Meals never receives or stores it.
                </div>
              </>
            )}

            {/* CONFIRM */}
            {payStep === "confirm" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Confirm your plan</div>
                  <button onClick={() => setPayStep("method")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
                </div>
                <div style={{ background: selectedPlan.id === "chef" ? "#1a1a18" : "#F5F5F0", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{selectedPlan.emoji}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: selectedPlan.id === "chef" ? "#fff" : "#1a1a18" }}>{selectedPlan.name} Plan</div>
                      <div style={{ fontSize: 12, color: selectedPlan.id === "chef" ? "#888" : "#999" }}>{selectedPlan.desc}</div>
                    </div>
                  </div>
                  <div style={{ height: "0.5px", background: selectedPlan.id === "chef" ? "#333" : "#E5E5E0", marginBottom: 12 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: selectedPlan.id === "chef" ? "#aaa" : "#888" }}>{billing === "annual" ? "Annual plan" : "Monthly plan"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: selectedPlan.id === "chef" ? "#fff" : "#1a1a18" }}>${billing === "annual" ? (price(selectedPlan) * 12).toFixed(2) : price(selectedPlan).toFixed(2)}</span>
                  </div>
                  {billing === "annual" && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: selectedPlan.id === "chef" ? "#aaa" : "#888" }}>You save</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#22C55E" }}>${((selectedPlan.monthly - selectedPlan.annual) * 12).toFixed(2)}/year</span>
                    </div>
                  )}
                  {selectedPlan.id === "chef" && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "#aaa" }}>7-day free trial</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#22C55E" }}>Included</span>
                    </div>
                  )}
                </div>
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#166534" }}>
                  🔒 Stripe will process this payment. World Meals sees only a confirmation — never your card details.
                </div>
                <button onClick={handleConfirm} disabled={processing}
                  style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: processing ? "#ccc" : "#1a1a18", color: "#fff", fontSize: 15, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", marginBottom: 8 }}>
                  {processing ? "Processing via Stripe…" : selectedPlan.id === "chef" ? "Start free trial" : `Pay $${billing === "annual" ? (price(selectedPlan) * 12).toFixed(2) : price(selectedPlan).toFixed(2)}`}
                </button>
                <div style={{ textAlign: "center", fontSize: 11, color: "#bbb" }}>
                  {selectedPlan.id === "chef" ? "You won't be charged until your 7-day trial ends" : "Secure payment · Cancel anytime"}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
