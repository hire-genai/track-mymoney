"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./landing.module.css";
import { useLocaleCurrency } from "./useLocaleCurrency";
import {
  IconArrowRight,
  IconSparkles,
  IconShield,
  IconUsers,
  IconTarget,
  IconTrendingUp,
  IconLock,
  IconZap,
  IconCheck,
  IconUpload,
  IconChart,
} from "./icons";

/* ─── Reveal-on-scroll (ENHANCEMENT only — content is visible by default) ─── */
function useReveal() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mark visible immediately if already in view at mount, so first-paint content never stays hidden.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ─── Count-up number ─── */
function Counter({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  const { ref, visible } = useReveal();
  useEffect(() => {
    if (!visible) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, to, duration]);
  return (
    <span ref={ref}>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

const DEMO_BARS = [68, 52, 81, 44, 73];
const DEMO_MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct"];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const heroRef = useRef<HTMLDivElement>(null);
  const money = useLocaleCurrency();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHeroMouse = useCallback((e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setMouse({ x, y });
  }, []);

  // Demo numbers (unit = your local currency, formatted via Intl)
  const d = {
    total: money.format(3428),
    delta: "-8.4%",
    goalCurrent: money.format(7200),
    goalTarget: money.format(10000),
    saved: money.format(314),
    rows: [
      { label: "Groceries", amount: money.format(984), pct: 29, color: "#10b981" },
      { label: "Rent", amount: money.format(1800), pct: 52, color: "#4f46e5" },
      { label: "Dining", amount: money.format(342), pct: 10, color: "#f59e0b" },
      { label: "Transport", amount: money.format(156), pct: 5, color: "#06b6d4" },
    ],
  };

  return (
    <div className={styles.page}>
      {/* ═══ NAV ═══ */}
      <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <div className={styles.brandLogo}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 14 L6 6 L9 10 L13 3 L16 9" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.brandLogoGlow} aria-hidden="true" />
            </div>
            <span className={styles.brandName}>Track<em>MyMoney</em></span>
          </Link>

          <nav className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#showcase">Showcase</a>
            <a href="#how">How it works</a>
            <a href="#why">Why</a>
          </nav>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.navSignIn}>Sign in</Link>
            <Link href="/login" className={styles.navCta}>
              <span>Start free</span>
              <IconArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section
        ref={heroRef}
        className={styles.hero}
        onMouseMove={onHeroMouse}
        style={{
          ["--mx" as string]: `${mouse.x}%`,
          ["--my" as string]: `${mouse.y}%`,
        }}
      >
        <div className={styles.heroSpotlight} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroGlowEmerald} aria-hidden="true" />
        <div className={styles.heroGlowIndigo} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={styles.heroPill}>
              <span className={styles.heroPillOrb} />
              <span>v2.0 · AI categorization is live</span>
            </div>

            <h1 className={styles.heroTitle}>
              Know exactly where<br />
              your <span className={styles.heroGrad}>money</span> goes.
            </h1>

            <p className={styles.heroSub}>
              Drop a bank statement. We parse every transaction, categorize it with AI,
              and turn months of noise into a clear, honest picture you can act on today.
            </p>

            <div className={styles.heroCtas}>
              <Link href="/login" className={styles.ctaPrimary}>
                <span className={styles.ctaPrimaryBg} />
                <span className={styles.ctaPrimaryText}>
                  Get started — free
                  <IconArrowRight size={14} />
                </span>
              </Link>
              <a href="#showcase" className={styles.ctaGhost}>
                <span className={styles.ctaGhostDot} />
                See it in action
              </a>
            </div>

            <div className={styles.heroProof}>
              <div className={styles.proofAvatars}>
                <div className={styles.proofAv} style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}>M</div>
                <div className={styles.proofAv} style={{ background: "linear-gradient(135deg,#4f46e5,#4338ca)" }}>K</div>
                <div className={styles.proofAv} style={{ background: "linear-gradient(135deg,#9333ea,#7c3aed)" }}>A</div>
                <div className={styles.proofAv} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>+</div>
              </div>
              <div className={styles.proofText}>
                <span>Trusted by couples &amp; serious savers worldwide</span>
              </div>
            </div>
          </div>

          {/* ── Hero visual ── */}
          <div className={styles.heroRight} aria-hidden="true">
            <div className={styles.heroStage}>
              <div className={`${styles.heroCard} ${styles.heroCardBack}`}>
                <div className={styles.hcMiniHead}>
                  <IconTarget size={14} />
                  <span>Vacation fund</span>
                  <strong>72%</strong>
                </div>
                <div className={styles.hcMiniBar}>
                  <div style={{ width: "72%" }} />
                </div>
                <div className={styles.hcMiniMeta}>
                  <span>{d.goalCurrent} of {d.goalTarget}</span>
                  <span>On track</span>
                </div>
              </div>

              <div className={`${styles.heroCard} ${styles.heroCardMain}`}>
                <div className={styles.hcHeader}>
                  <div className={styles.hcHeaderLeft}>
                    <div className={styles.hcAvatar}>M</div>
                    <div>
                      <div className={styles.hcName}>October 2026</div>
                      <div className={styles.hcSmall}>47 transactions</div>
                    </div>
                  </div>
                  <span className={styles.hcLive}>
                    <span className={styles.hcLiveDot} />
                    Live
                  </span>
                </div>

                <div className={styles.hcTotalRow}>
                  <div>
                    <div className={styles.hcTotalLabel}>Total spent</div>
                    <div className={styles.hcTotal}>{d.total}</div>
                  </div>
                  <div className={styles.hcDelta}>
                    <IconTrendingUp size={12} />
                    <span>{d.delta}</span>
                  </div>
                </div>

                <div className={styles.hcBars}>
                  {DEMO_BARS.map((h, i) => (
                    <div key={i} className={styles.hcBarCol}>
                      <div
                        className={`${styles.hcBar} ${i === 4 ? styles.hcBarActive : ""}`}
                        style={{ height: `${h}%` }}
                      />
                      <span>{DEMO_MONTHS[i]}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.hcDivider} />

                <div className={styles.hcRows}>
                  {d.rows.map((row) => (
                    <div key={row.label} className={styles.hcRow}>
                      <div className={styles.hcRowDot} style={{ background: row.color }} />
                      <span className={styles.hcRowLabel}>{row.label}</span>
                      <div className={styles.hcRowBar}>
                        <div style={{ width: `${row.pct}%`, background: `linear-gradient(90deg, ${row.color}aa, ${row.color})` }} />
                      </div>
                      <strong>{row.amount}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${styles.floatChip} ${styles.floatChipA}`}>
                <IconSparkles size={14} />
                <div>
                  <strong>AI categorized</strong>
                  <span>47 transactions · 2.3s</span>
                </div>
              </div>

              <div className={`${styles.floatChip} ${styles.floatChipB}`}>
                <div className={styles.floatChipIcon}>
                  <IconTrendingUp size={13} />
                </div>
                <div>
                  <strong>Saved {d.saved}</strong>
                  <span>vs last month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY ═══ */}
      <WhySection />

      {/* ═══ SHOWCASE ═══ */}
      <ShowcaseSection money={money.format} />

      {/* ═══ FEATURES BENTO ═══ */}
      <FeaturesBento />

      {/* ═══ HOW ═══ */}
      <HowSection />

      {/* ═══ TESTIMONIALS ═══ */}

      {/* ═══ CTA ═══ */}
      <FinalCta />

      {/* ═══ FOOTER ═══ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.brand}>
              <div className={styles.brandLogo}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 14 L6 6 L9 10 L13 3 L16 9" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={styles.brandName}>Track<em>MyMoney</em></span>
            </div>
            <p className={styles.footerTag}>
              Budgeting built on your real bank statements.<br />Honest numbers, every month.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h5>Product</h5>
              <a href="#features">Features</a>
              <a href="#showcase">Showcase</a>
              <a href="#how">How it works</a>
            </div>
            <div>
              <h5>Account</h5>
              <Link href="/login">Sign in</Link>
              <Link href="/login">Create account</Link>
            </div>
            <div>
              <h5>Learn</h5>
              <a href="#why">Why it matters</a>
              <a href="#how">Getting started</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Track-MyMoney · Built with care</span>
          <span>Your data stays yours</span>
        </div>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function StatsBar() {
  return (
    <section className={styles.statsBar}>
      <div className={styles.statsInner}>
        {[
          { value: 60, suffix: "s", label: "From statement to insights", color: "#10b981" },
          { value: 47, suffix: "+", label: "Smart categories detected", color: "#4f46e5" },
          { value: 100, suffix: "%", label: "Private — your data stays yours", color: "#9333ea" },
          { value: 0, suffix: "", label: "Manual entry required", color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className={styles.statCell}>
            <div className={styles.statValue} style={{ color: s.color }}>
              <Counter to={s.value} suffix={s.suffix} />
            </div>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statGlow} style={{ background: `radial-gradient(circle, ${s.color}22, transparent 70%)` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section id="why" className={styles.why}>
      <div className={styles.whyInner}>
        <div className={styles.whyLeft}>
          <div className={styles.sectionEyebrow}>The real problem</div>
          <h2 className={styles.sectionTitle}>
            Most people don&apos;t have<br />
            a <span className={styles.titleItalic}>spending</span> problem —<br />
            they have a <span className={styles.heroGrad}>visibility</span> problem.
          </h2>
          <p className={styles.whyBody}>
            Money quietly leaves every month, and nobody can explain where it went.
            That silence is what makes bills feel tight, savings feel impossible,
            and financial conversations with partners feel uncomfortable.
          </p>
          <p className={styles.whyBody}>
            Track-MyMoney gives you the honest picture, automatically, every month —
            so you can make decisions based on reality, not anxiety.
          </p>
          <Link href="/login" className={styles.ctaPrimary} style={{ marginTop: 32, display: "inline-flex" }}>
            <span className={styles.ctaPrimaryBg} />
            <span className={styles.ctaPrimaryText}>
              See your picture
              <IconArrowRight size={14} />
            </span>
          </Link>
        </div>

        <div className={styles.whyRight}>
          {[
            { heading: "Instant clarity", body: "Every transaction classified, totalled, and trended — month over month, person by person.", color: "#10b981", icon: IconSparkles },
            { heading: "Honest conversations", body: "Show both partners side-by-side. No blame, no surprises. Just the numbers in one shared place.", color: "#9333ea", icon: IconUsers },
            { heading: "Goals that stick", body: "Set a goal — a trip, an emergency fund, a down payment. Each month's surplus moves it forward.", color: "#4f46e5", icon: IconTarget },
            { heading: "Zero busywork", body: "No spreadsheets, no manual tagging. Drop your statement in — AI handles the rest in 60 seconds.", color: "#f59e0b", icon: IconZap },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.heading} className={styles.whyCard}>
                <div className={styles.whyCardIcon} style={{ background: `${c.color}18`, color: c.color }}>
                  <Icon size={18} />
                </div>
                <div className={styles.whyCardContent}>
                  <h3>{c.heading}</h3>
                  <p>{c.body}</p>
                </div>
                <div className={styles.whyCardAccent} style={{ background: `linear-gradient(180deg, ${c.color}, transparent)` }} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ShowcaseSection({ money }: { money: (n: number) => string }) {
  return (
    <section id="showcase" className={styles.showcase}>
      <div className={styles.showcaseInner}>
        <div className={styles.showcaseHead}>
          <div className={styles.sectionEyebrow}>What you&apos;ll see</div>
          <h2 className={styles.sectionTitle}>Dashboards that look as<br />honest as they feel.</h2>
        </div>

        <div className={styles.showcaseGrid}>
          <div className={`${styles.showcaseCard} ${styles.showcaseWide}`}>
            <div className={styles.scBadge}>Monthly breakdown</div>
            <div className={styles.scTitle}>Where it actually went in October</div>
            <div className={styles.scSub}>Every transaction labeled, every category totalled</div>

            <div className={styles.scCats}>
              {[
                { name: "Fixed costs", amount: money(2145), pct: 62, color: "#4f46e5", target: "50-60%", status: "warn" },
                { name: "Investments", amount: money(520), pct: 15, color: "#10b981", target: "≥10%", status: "good" },
                { name: "Savings", amount: money(280), pct: 8, color: "#06b6d4", target: "≥5%", status: "good" },
                { name: "Guilt-free", amount: money(483), pct: 14, color: "#ec4899", target: "≤35%", status: "good" },
              ].map((c) => (
                <div key={c.name} className={styles.scCatRow}>
                  <div className={styles.scCatLeft}>
                    <div className={styles.scCatDot} style={{ background: c.color }} />
                    <div>
                      <div className={styles.scCatName}>{c.name}</div>
                      <div className={styles.scCatTarget}>Target: {c.target}</div>
                    </div>
                  </div>
                  <div className={styles.scCatBar}>
                    <div style={{ width: `${c.pct}%`, background: `linear-gradient(90deg, ${c.color}, ${c.color}dd)` }} />
                  </div>
                  <div className={styles.scCatRight}>
                    <strong>{c.amount}</strong>
                    <span className={`${styles.scCatPct} ${styles[`scStatus_${c.status}`]}`}>{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.showcaseCard}>
            <div className={styles.scBadge} style={{ background: "#f3e8ff", color: "#7c3aed" }}>Couples view</div>
            <div className={styles.scTitle}>Side-by-side, no drama</div>
            <div className={styles.scSub}>Spending across both partners this month</div>

            <div className={styles.scCouple}>
              <div className={styles.scCoupleRow}>
                <div className={styles.scCoupleAvatar} style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>M</div>
                <div className={styles.scCoupleBar}>
                  <div style={{ width: "62%", background: "linear-gradient(90deg,#10b981,#059669)" }} />
                </div>
                <strong>{money(3428)}</strong>
              </div>
              <div className={styles.scCoupleRow}>
                <div className={styles.scCoupleAvatar} style={{ background: "linear-gradient(135deg,#9333ea,#7c3aed)" }}>A</div>
                <div className={styles.scCoupleBar}>
                  <div style={{ width: "48%", background: "linear-gradient(90deg,#9333ea,#7c3aed)" }} />
                </div>
                <strong>{money(2681)}</strong>
              </div>
            </div>

            <div className={styles.scCoupleFoot}>
              <div>
                <span>Combined</span>
                <strong>{money(6109)}</strong>
              </div>
              <div>
                <span>Shared</span>
                <strong>{money(1840)}</strong>
              </div>
            </div>
          </div>

          <div className={styles.showcaseCard}>
            <div className={styles.scBadge} style={{ background: "#dbeafe", color: "#1e40af" }}>Goals</div>
            <div className={styles.scTitle}>Progress you can feel</div>
            <div className={styles.scSub}>Real surplus pushing each goal forward</div>

            <div className={styles.scGoals}>
              {[
                { name: "Emergency fund", pct: 84, amount: money(8400), target: money(10000), color: "#10b981" },
                { name: "Japan trip", pct: 54, amount: money(3250), target: money(6000), color: "#4f46e5" },
                { name: "New laptop", pct: 32, amount: money(640), target: money(2000), color: "#f59e0b" },
              ].map((g) => (
                <div key={g.name} className={styles.scGoalRow}>
                  <div className={styles.scGoalHead}>
                    <span>{g.name}</span>
                    <strong>{g.pct}%</strong>
                  </div>
                  <div className={styles.scGoalBar}>
                    <div style={{ width: `${g.pct}%`, background: g.color }} />
                  </div>
                  <div className={styles.scGoalFoot}>
                    <span>{g.amount}</span>
                    <span>of {g.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.showcaseCard} ${styles.showcaseWide} ${styles.scInsightCard}`}>
            <div className={styles.scInsightIcon}>
              <IconSparkles size={22} />
            </div>
            <div className={styles.scInsightBody}>
              <div className={styles.scInsightTag}>AI insight</div>
              <h3>Dining spend jumped 34% this month.</h3>
              <p>
                You spent <strong>{money(342)}</strong> on dining — up from <strong>{money(255)}</strong> in September.
                At this pace you&apos;ll hit <strong>{money(4100)}</strong>/year on restaurants alone.
                Consider setting a dining budget of <strong>{money(280)}/month</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesBento() {
  return (
    <section id="features" className={styles.features}>
      <div className={styles.featuresInner}>
        <div className={styles.featuresMeta}>
          <div className={styles.sectionEyebrow}>Features</div>
          <h2 className={styles.sectionTitle}>
            Everything you need<br />to take real control.
          </h2>
          <p className={styles.featuresLead}>
            No bloat. No ads. No sold data. Just the tools you actually use.
          </p>
        </div>

        <div className={styles.bento}>
          <div className={`${styles.bentoCell} ${styles.bentoImport}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#ecfdf5,#a7f3d0)", color: "#047857" }}>
                <IconUpload size={22} />
              </div>
            </div>
            <h3>Universal import</h3>
            <p>PDF and CSV from any major bank. No credentials, no OAuth, no third-party connections. Just your file.</p>
            <div className={styles.bentoBankList}>
              {["Chase", "BofA", "Wells", "HDFC", "ICICI", "+ 40 more"].map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
          </div>

          <div className={`${styles.bentoCell} ${styles.bentoAI}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#eef2ff,#c7d2fe)", color: "#4338ca" }}>
                <IconSparkles size={22} />
              </div>
            </div>
            <h3>AI that learns</h3>
            <p>Groceries, rent, dining, travel — every line labeled sensibly. Fix any category once, it sticks.</p>
            <div className={styles.bentoTags}>
              <span style={{ background: "#dcfce7", color: "#15803d" }}>Groceries</span>
              <span style={{ background: "#dbeafe", color: "#1e40af" }}>Transport</span>
              <span style={{ background: "#fef3c7", color: "#b45309" }}>Dining</span>
              <span style={{ background: "#f3e8ff", color: "#7c3aed" }}>Rent</span>
            </div>
          </div>

          <div className={`${styles.bentoCell} ${styles.bentoPrivacy}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#f1f5f9,#cbd5e1)", color: "#334155" }}>
                <IconShield size={22} />
              </div>
            </div>
            <h3>Private by default</h3>
            <p>Statements and transactions live in your account only. Delete anything, anytime.</p>
          </div>

          <div className={`${styles.bentoCell} ${styles.bentoCouple}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#fdf4ff,#e9d5ff)", color: "#7c3aed" }}>
                <IconUsers size={22} />
              </div>
            </div>
            <h3>Couples mode</h3>
            <p>Compare side-by-side, split shared costs, and see combined KPIs — without merging bank accounts.</p>
            <div className={styles.bentoCoupleMini}>
              <div className={styles.bcmPerson} style={{ background: "linear-gradient(135deg,#10b981,#047857)" }}>M</div>
              <div className={styles.bcmVs}>vs</div>
              <div className={styles.bcmPerson} style={{ background: "linear-gradient(135deg,#9333ea,#7c3aed)" }}>A</div>
            </div>
          </div>

          <div className={`${styles.bentoCell} ${styles.bentoGoals}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#fef9c3,#fde68a)", color: "#b45309" }}>
                <IconTarget size={22} />
              </div>
            </div>
            <h3>Savings goals</h3>
            <p>Set it, forget it — surplus auto-flows toward goals every month, no math required.</p>
            <div className={styles.bentoGoalRing}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#fef3c7" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#goalGrad)" strokeWidth="8"
                  strokeDasharray={`${Math.PI * 80 * 0.68} ${Math.PI * 80}`}
                  strokeDashoffset={Math.PI * 80 * 0.25}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
                <defs>
                  <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
              </svg>
              <div className={styles.bentoGoalRingText}>
                <strong>68%</strong>
                <span>funded</span>
              </div>
            </div>
          </div>

          <div className={`${styles.bentoCell} ${styles.bentoTrends}`}>
            <div className={styles.bentoIconWrap}>
              <div className={styles.bentoIcon} style={{ background: "linear-gradient(135deg,#ecfeff,#a5f3fc)", color: "#0e7490" }}>
                <IconChart size={22} />
              </div>
            </div>
            <h3>Month-over-month trends</h3>
            <p>Catch the sneaky creep in subscriptions, dining, or travel before it eats your buffer.</p>
            <div className={styles.bentoTrendBars}>
              {[42, 55, 38, 61, 48, 72, 58, 83].map((h, i) => (
                <div key={i} className={styles.bentoTrendBar} style={{
                  height: `${h}%`,
                  background: i === 7 ? "linear-gradient(180deg,#0891b2,#0e7490)" : "linear-gradient(180deg,#67e8f9,#06b6d4)",
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section id="how" className={styles.how}>
      <div className={styles.howInner}>
        <div className={styles.sectionEyebrow} style={{ textAlign: "center" }}>How it works</div>
        <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>
          Three steps. One honest view.
        </h2>
        <p className={styles.howLead}>
          No setup fatigue. No onboarding tunnel. From signup to real insight in under two minutes.
        </p>

        <div className={styles.steps}>
          {[
            { n: "01", icon: IconUpload, title: "Upload your statement", body: "Drop a PDF or CSV from your bank. Duplicates are handled automatically — re-upload the same file and nothing breaks.", detail: "PDF · CSV · 50+ banks supported", color: "#10b981" },
            { n: "02", icon: IconSparkles, title: "Review the auto-categorized view", body: "Every transaction parsed and labeled with AI in seconds. Fix any category with a single click — the system adapts to you.", detail: "Groceries · Rent · Dining · Transport · Investments", color: "#4f46e5" },
            { n: "03", icon: IconTarget, title: "Act on what you see", body: "Compare months, see your partner's picture side-by-side, push surplus toward goals. Real clarity, real action.", detail: "Monthly KPIs · Savings goals · Couple comparison", color: "#9333ea" },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.n} className={styles.step}>
                <div className={styles.stepLeft}>
                  <div className={styles.stepNum} style={{ ["--c" as string]: step.color }}>
                    <span>{step.n}</span>
                    <div className={styles.stepNumGlow} style={{ background: `radial-gradient(circle, ${step.color}44, transparent 70%)` }} />
                  </div>
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepIcon} style={{ background: `${step.color}15`, color: step.color }}>
                    <Icon size={16} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <div className={styles.stepDetail}>{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaBg} aria-hidden="true">
        <div className={styles.ctaOrb1} />
        <div className={styles.ctaOrb2} />
        <div className={styles.ctaOrb3} />
        <div className={styles.ctaGrid} />
      </div>
      <div className={styles.ctaInner}>
        <div className={styles.ctaBadge}>
          <IconSparkles size={13} />
          Start today — free forever
        </div>
        <h2 className={styles.ctaTitle}>
          Your future self will thank you<br />
          for starting right now.
        </h2>
        <p className={styles.ctaSub}>
          Every month you wait is another month of blind spending.
          Take 60 seconds — see the real picture.
        </p>
        <div className={styles.ctaButtons}>
          <Link href="/login" className={styles.ctaPrimaryDark}>
            Create your free account
            <IconArrowRight size={14} />
          </Link>
          <a href="#features" className={styles.ctaGhostDark}>
            Browse features
          </a>
        </div>
        <div className={styles.ctaMicro}>
          <span><IconCheck size={13} /> No credit card</span>
          <span><IconCheck size={13} /> Delete anytime</span>
          <span><IconCheck size={13} /> Setup in 60 seconds</span>
        </div>
      </div>
    </section>
  );
}
