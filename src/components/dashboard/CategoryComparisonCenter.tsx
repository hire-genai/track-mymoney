"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { PEOPLE, pastMonths, recentMonths } from "@/lib/finance-data";
import { fmt, fmtShort, getMonthTotals } from "@/lib/finance-calc";
import styles from "./dashboard.module.css";

interface MonthRow {
  month: string;
  short: string;
  income: number;
  fixed: number;
  guilt: number;
  invest: number;
  savings: number;
}

interface ActionItem {
  id: string;
  text: string;
  amount: number;
}

const FIXED_ACTIONS: ActionItem[] = [
  { id: "f-rent", text: "Move to a cheaper flat (Negotiate Rent)", amount: 8000 },
  { id: "f-ott", text: "Cancel unused OTT & Subscriptions", amount: 2500 },
  { id: "f-loan", text: "Refinance Car Loan / Switch Insurance", amount: 3500 },
  { id: "f-gym", text: "Switch to a cheaper Gym / Phone plan", amount: 1500 },
];

const GUILT_ACTIONS: ActionItem[] = [
  { id: "g-food", text: "Reduce Zomato/Swiggy to 2x a month", amount: 2000 },
  { id: "g-coffee", text: "Brew Coffee at Home (Skip Starbucks)", amount: 1500 },
  { id: "g-shop", text: "Pause Impulse Shopping (Amazon/Myntra)", amount: 3000 },
];

const FIXED_MAX = FIXED_ACTIONS.reduce((s, a) => s + a.amount, 0);
const GUILT_MAX = GUILT_ACTIONS.reduce((s, a) => s + a.amount, 0);

const YEARLY_SAVINGS_GOAL = 300000;

function sumActive(actions: ActionItem[], active: Set<string>): number {
  return actions.reduce((s, a) => s + (active.has(a.id) ? a.amount : 0), 0);
}

export default function CategoryComparisonCenter() {
  const { activePerson, txns, authenticated } = useFinance();
  const person = PEOPLE[activePerson];

  // Full 12-month window for the yearly command-center view
  const months12 = useMemo(() => recentMonths(12), []);

  const rows: MonthRow[] = useMemo(
    () =>
      months12
        .slice()
        .reverse()
        .map((m) => {
          const list = txns[activePerson]?.[m] || [];
          const totals = list.length > 0
            ? getMonthTotals(list)
            : authenticated
              ? { income: 0, fixed: 0, invest: 0, savings: 0, guilt: 0, net: 0 }
              : pastMonths[activePerson]?.[m] || { income: 0, fixed: 0, invest: 0, savings: 0, guilt: 0, net: 0 };
          return {
            month: m,
            short: m.split(" ")[0],
            income: totals.income,
            fixed: totals.fixed,
            guilt: totals.guilt,
            invest: totals.invest,
            savings: totals.savings,
          };
        }),
    [months12, txns, activePerson, authenticated],
  );

  // ───── Action-center state ─────
  const [fixedActive, setFixedActive] = useState<Set<string>>(new Set());
  const [guiltActive, setGuiltActive] = useState<Set<string>>(new Set());
  const [fixedSlider, setFixedSlider] = useState(0);
  const [guiltSlider, setGuiltSlider] = useState(0);

  const fixedCut = fixedSlider;
  const guiltCut = guiltSlider;

  function toggleAction(type: "fixed" | "guilt", id: string) {
    if (type === "fixed") {
      const next = new Set(fixedActive);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setFixedActive(next);
      setFixedSlider(sumActive(FIXED_ACTIONS, next));
    } else {
      const next = new Set(guiltActive);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setGuiltActive(next);
      setGuiltSlider(sumActive(GUILT_ACTIONS, next));
    }
  }

  function greedyActiveSet(actions: ActionItem[], value: number): Set<string> {
    const next = new Set<string>();
    let acc = 0;
    for (const a of actions) {
      if (acc + a.amount <= value) {
        next.add(a.id);
        acc += a.amount;
      }
    }
    return next;
  }

  function onSliderChange(type: "fixed" | "guilt", value: number) {
    if (type === "fixed") {
      setFixedSlider(value);
      setFixedActive(greedyActiveSet(FIXED_ACTIONS, value));
    } else {
      setGuiltSlider(value);
      setGuiltActive(greedyActiveSet(GUILT_ACTIONS, value));
    }
  }

  // ───── Derived totals ─────
  const totals = useMemo(() => {
    let yIncome = 0;
    let yFixed = 0;
    let yGuilt = 0;
    const adjRows = rows.map((r) => {
      const fAdj = Math.max(0, r.fixed - fixedCut);
      const gAdj = Math.max(0, r.guilt - guiltCut);
      yIncome += r.income;
      yFixed += fAdj;
      yGuilt += gAdj;
      return { ...r, fixedAdj: fAdj, guiltAdj: gAdj };
    });
    const yExpenses = yFixed + yGuilt;
    const yNet = yIncome - yExpenses;
    return { adjRows, yIncome, yExpenses, yNet };
  }, [rows, fixedCut, guiltCut]);

  // ───── Insights (computed from real data) ─────
  const insights = useMemo(() => {
    const fixedVals = rows.map((r) => r.fixed).filter((v) => v > 0);
    const guiltVals = rows.map((r) => r.guilt).filter((v) => v > 0);
    const incomeVals = rows.map((r) => r.income).filter((v) => v > 0);

    const fixedAvg = fixedVals.length ? fixedVals.reduce((a, b) => a + b, 0) / fixedVals.length : 0;
    const guiltAvg = guiltVals.length ? guiltVals.reduce((a, b) => a + b, 0) / guiltVals.length : 0;
    const incomeAvg = incomeVals.length ? incomeVals.reduce((a, b) => a + b, 0) / incomeVals.length : 0;

    // Anomaly: max fixed > 1.8× average
    let anomaly: { month: string; fixed: number; avg: number } | null = null;
    for (const r of rows) {
      if (fixedAvg > 0 && r.fixed > fixedAvg * 1.8) {
        if (!anomaly || r.fixed > anomaly.fixed) anomaly = { month: r.month, fixed: r.fixed, avg: fixedAvg };
      }
    }

    const fixedRatio = incomeAvg > 0 ? (fixedAvg / incomeAvg) * 100 : 0;

    // Guilt peak
    let guiltPeak = rows[0];
    for (const r of rows) if (r.guilt > (guiltPeak?.guilt || 0)) guiltPeak = r;

    return { fixedAvg, guiltAvg, incomeAvg, anomaly, fixedRatio, guiltPeak };
  }, [rows]);

  // ───── Action step text ─────
  const actionStep = useMemo(() => {
    const { yNet } = totals;
    if (yNet < 0) {
      const perMonthGap = Math.ceil(Math.abs(yNet) / 12);
      return {
        tone: "bad" as const,
        html: (
          <>
            💡 <strong>Next Step:</strong> You are still in a deficit. Cut at least{" "}
            <strong>{fmtShort(perMonthGap)}/month</strong> more to break even.
          </>
        ),
      };
    }
    if (yNet < YEARLY_SAVINGS_GOAL) {
      const gap = Math.ceil((YEARLY_SAVINGS_GOAL - yNet) / 12);
      return {
        tone: "warn" as const,
        html: (
          <>
            💡 <strong>Next Step:</strong> Positive cash flow — need <strong>{fmtShort(gap)}/month</strong> more to hit
            your {fmtShort(YEARLY_SAVINGS_GOAL)} yearly goal.
          </>
        ),
      };
    }
    return {
      tone: "good" as const,
      html: (
        <>
          🎉 <strong>Excellent!</strong> You hit your yearly savings goal of{" "}
          <strong>{fmtShort(YEARLY_SAVINGS_GOAL)}</strong>.
        </>
      ),
    };
  }, [totals]);

  function autoOptimize() {
    const baseExpenses = rows.reduce((s, r) => s + r.fixed + r.guilt, 0);
    const baseIncome = rows.reduce((s, r) => s + r.income, 0);
    const needed = YEARLY_SAVINGS_GOAL - (baseIncome - baseExpenses);
    if (needed <= 0) {
      onSliderChange("fixed", 0);
      onSliderChange("guilt", 0);
      return;
    }
    const perMonth = Math.ceil(needed / 12);
    const g = Math.min(GUILT_MAX, perMonth);
    const f = Math.min(FIXED_MAX, perMonth - g);
    onSliderChange("guilt", g);
    onSliderChange("fixed", f);
  }

  // ───── Chart dims ─────
  const CHART_W = 640;
  const CHART_H = 240;
  const PAD_L = 42;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 28;
  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;
  const barW = Math.max(6, (innerW / totals.adjRows.length) * 0.55);
  const colStep = innerW / totals.adjRows.length;
  const yMax = Math.max(
    1,
    ...totals.adjRows.map((r) => Math.max(r.income, r.fixedAdj + r.guiltAdj)),
  );
  const yStep = Math.ceil(yMax / 4 / 1000) * 1000;
  const yTicks = [0, yStep, yStep * 2, yStep * 3, yStep * 4];

  function y(v: number): number {
    return PAD_T + innerH - (v / (yTicks[yTicks.length - 1] || 1)) * innerH;
  }

  // Line path for income
  const linePath = totals.adjRows
    .map((r, i) => {
      const cx = PAD_L + colStep * i + colStep / 2;
      return `${i === 0 ? "M" : "L"}${cx.toFixed(1)},${y(r.income).toFixed(1)}`;
    })
    .join(" ");

  // ───── Chat ─────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ sender: "bot" | "user"; text: string }[]>([
    {
      sender: "bot",
      text: `Hi ${person.name}! I analyzed your last 12 months. ${
        insights.anomaly
          ? `Spotted a fixed-cost spike in ${insights.anomaly.month.split(" ")[0]} (${fmtShort(insights.anomaly.fixed)}). `
          : ""
      }Try the Action Center — I'll explain impact as you check items.`,
    },
  ]);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, chatOpen]);

  function send(text?: string) {
    const q = (text ?? chatInput).trim();
    if (!q) return;
    setMessages((m) => [...m, { sender: "user", text: q }]);
    setChatInput("");
    const reply = generateReply(q.toLowerCase());
    setTimeout(() => setMessages((m) => [...m, { sender: "bot", text: reply }]), 500);
  }

  function generateReply(input: string): string {
    const yNet = totals.yNet;
    if (/ott|subscription|cancel/.test(input))
      return `Cancelling unused OTT/subs saves ₹2,500/mo = ${fmtShort(30000)} a year — the easiest pain-free cut you can make.`;
    if (/leak|spend|expense/.test(input))
      return insights.anomaly
        ? `Biggest leak: ${insights.anomaly.month.split(" ")[0]} (fixed hit ${fmtShort(insights.anomaly.fixed)} vs avg ${fmtShort(Math.round(insights.anomaly.avg))}). Fixed takes ~${insights.fixedRatio.toFixed(0)}% of income — try "Negotiate Rent" to see yearly impact.`
        : `Fixed costs average ${fmtShort(Math.round(insights.fixedAvg))} (${insights.fixedRatio.toFixed(0)}% of income). Target is 50–60% — check off items to tighten it.`;
    if (/invest|grow/.test(input))
      return yNet < 0
        ? `Hold on — yearly deficit of ${fmtShort(Math.abs(yNet))}. Fix cash flow first before investing.`
        : `Surplus of ${fmtShort(yNet)}. Suggested order: 1) 6-month emergency fund, 2) EPF/PPF, 3) monthly SIP in an index fund.`;
    const anomalyMonth = insights.anomaly?.month.split(" ")[0]?.toLowerCase();
    if (anomalyMonth && (input.includes(anomalyMonth) || /anomaly|spike/.test(input)))
      return insights.anomaly
        ? `In ${insights.anomaly.month.split(" ")[0]}, fixed costs jumped to ${fmtShort(insights.anomaly.fixed)} (avg is ${fmtShort(Math.round(insights.anomaly.avg))}). Likely annual insurance/tax. Create a sinking fund — divide annual expenses by 12 and save monthly.`
        : "No major anomaly detected across your 12 months — spending looks steady.";
    return `Try the Action Center on the right. Checking "Negotiate Rent" or "Skip Zomato" will instantly show the yearly impact on your chart.`;
  }

  // ───── Render ─────
  return (
    <div className={styles.ccCenter}>
      {/* Yearly stats banner */}
      <div className={styles.ccBanner}>
        <div className={styles.ccBannerLeft}>
          <h2>My Money Command Center</h2>
          <p>Review the detailed leaks, check off actionable cuts, and watch your yearly chart update instantly.</p>
        </div>
        <div className={styles.ccStats}>
          <div className={styles.ccStat}>
            <div className={styles.ccStatValue}>{fmtShort(totals.yIncome)}</div>
            <div className={styles.ccStatLabel}>Yearly Income</div>
          </div>
          <div className={styles.ccStat}>
            <div className={styles.ccStatValue}>{fmtShort(totals.yExpenses)}</div>
            <div className={styles.ccStatLabel}>Yearly Expenses</div>
          </div>
          <div className={styles.ccStat}>
            <div
              className={styles.ccStatValue}
              style={{
                color: totals.yNet < 0 ? "#fecaca" : totals.yNet < YEARLY_SAVINGS_GOAL ? "#fde68a" : "#a7f3d0",
              }}
            >
              {totals.yNet < 0 ? "-" : ""}
              {fmtShort(Math.abs(totals.yNet))}
            </div>
            <div className={styles.ccStatLabel}>Yearly Net Saved</div>
          </div>
        </div>
      </div>

      <div className={styles.ccGrid}>
        {/* ── Left: Chart + Insights ── */}
        <div className={styles.ccCard}>
          <h3>📊 12-Month Breakdown (Leaks Identified)</h3>

          <div className={styles.ccChartWrap}>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className={styles.ccChart} role="img" aria-label="12-month breakdown">
              {/* grid + y labels */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={PAD_L} y1={y(t)} x2={CHART_W - PAD_R} y2={y(t)} stroke="#f1f5f9" strokeWidth={1} />
                  <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
                    {t >= 1000 ? `₹${(t / 1000).toFixed(0)}k` : `₹${t}`}
                  </text>
                </g>
              ))}

              {/* stacked bars: fixed (bottom) + guilt (top) */}
              {totals.adjRows.map((r, i) => {
                const cx = PAD_L + colStep * i + (colStep - barW) / 2;
                const fixedH = y(0) - y(r.fixedAdj);
                const guiltH = y(0) - y(r.guiltAdj);
                const fixedY = y(r.fixedAdj);
                const guiltY = y(r.fixedAdj + r.guiltAdj);
                return (
                  <g key={r.month}>
                    {r.fixedAdj > 0 && (
                      <rect
                        x={cx}
                        y={fixedY}
                        width={barW}
                        height={fixedH}
                        fill="#f59e0b"
                        rx={3}
                      />
                    )}
                    {r.guiltAdj > 0 && (
                      <rect
                        x={cx}
                        y={guiltY}
                        width={barW}
                        height={guiltH}
                        fill="#ec4899"
                        rx={3}
                      />
                    )}
                    <text x={cx + barW / 2} y={CHART_H - PAD_B + 14} textAnchor="middle" fontSize={9.5} fill="#64748b" fontWeight={600}>
                      {r.short}
                    </text>
                  </g>
                );
              })}

              {/* income line */}
              <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {totals.adjRows.map((r, i) => {
                const cx = PAD_L + colStep * i + colStep / 2;
                return <circle key={r.month} cx={cx} cy={y(r.income)} r={3} fill="#10b981" />;
              })}
            </svg>

            <div className={styles.ccLegend}>
              <span><i style={{ background: "#10b981" }} /> Income</span>
              <span><i style={{ background: "#f59e0b" }} /> Fixed Costs</span>
              <span><i style={{ background: "#ec4899" }} /> Guilt-Free</span>
            </div>
          </div>

          {/* Insights panel */}
          <div className={styles.ccInsightPanel}>
            <div className={styles.ccInsightHeader}>🚨 Detailed Financial Health Check</div>
            <div className={styles.ccInsightList}>
              {insights.anomaly ? (
                <div className={styles.ccInsightItem}>
                  <span>📍</span>
                  <div>
                    <b>The {insights.anomaly.month.split(" ")[0]} Anomaly:</b> Fixed Costs spiked to{" "}
                    <b>{fmt(insights.anomaly.fixed)}</b>. Normal average is{" "}
                    <b>{fmt(Math.round(insights.anomaly.avg))}</b>. Likely an annual insurance/tax bill.{" "}
                    <i>(Tip: create a sinking fund for annual expenses.)</i>
                  </div>
                </div>
              ) : (
                <div className={styles.ccInsightItem}>
                  <span>📍</span>
                  <div>
                    <b>Steady fixed costs:</b> No month exceeds 1.8× the average — no spike anomaly across the last 12
                    months.
                  </div>
                </div>
              )}

              <div className={styles.ccInsightItem}>
                <span>⚖️</span>
                <div>
                  <b>Fixed Cost Ratio ({insights.fixedRatio.toFixed(0)}%):</b> Target is under 50%. You average{" "}
                  <b>{fmt(Math.round(insights.fixedAvg))}/mo</b> on fixed items.{" "}
                  {insights.fixedRatio > 60 ? "Too high — hurts investing capacity." : "Healthy band."}
                </div>
              </div>

              {insights.guiltPeak && (
                <div className={styles.ccInsightItem}>
                  <span>🎉</span>
                  <div>
                    <b>Guilt-Free Spending:</b> Averages <b>{fmt(Math.round(insights.guiltAvg))}/mo</b>, peaking in{" "}
                    <b>{insights.guiltPeak.short}</b> ({fmt(insights.guiltPeak.guilt)}). Trimming{" "}
                    <b>₹2,000/mo</b> = <b>{fmtShort(24000)}</b> per year.
                  </div>
                </div>
              )}
            </div>
            <div
              className={`${styles.ccActionStep} ${
                actionStep.tone === "good"
                  ? styles.ccActionGood
                  : actionStep.tone === "warn"
                    ? styles.ccActionWarn
                    : styles.ccActionBad
              }`}
            >
              {actionStep.html}
            </div>
          </div>
        </div>

        {/* ── Right: Action Center ── */}
        <div className={styles.ccCard}>
          <h3>🕹️ Action Center (Recurring Monthly Cuts)</h3>
          <p className={styles.ccCardSub}>
            Check items below. Cuts apply to <b>every month</b> to show the compounding yearly effect.
          </p>

          {/* Fixed */}
          <div className={styles.ccSliderGroup}>
            <div className={styles.ccSliderHead}>
              <span>Total Monthly Fixed Cut</span>
              <span className={styles.ccSliderVal} style={{ color: "#f59e0b" }}>
                -{fmtShort(fixedCut)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={FIXED_MAX}
              value={fixedSlider}
              step={500}
              onChange={(e) => onSliderChange("fixed", parseInt(e.target.value))}
              className={`${styles.ccSlider} ${styles.ccSliderFixed}`}
            />
          </div>
          <ul className={styles.ccActionList}>
            {FIXED_ACTIONS.map((a) => {
              const active = fixedActive.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`${styles.ccActionItem} ${active ? styles.ccActionActive : ""}`}
                  onClick={() => toggleAction("fixed", a.id)}
                >
                  <div className={styles.ccActionLeft}>
                    <div className={styles.ccCheckbox}>{active && <span>✓</span>}</div>
                    <span className={styles.ccActionText}>{a.text}</span>
                  </div>
                  <span className={styles.ccActionAmount}>-{fmtShort(a.amount)}/mo</span>
                </li>
              );
            })}
          </ul>

          {/* Guilt */}
          <div className={styles.ccSliderGroup}>
            <div className={styles.ccSliderHead}>
              <span>Total Monthly Guilt-Free Cut</span>
              <span className={styles.ccSliderVal} style={{ color: "#ec4899" }}>
                -{fmtShort(guiltCut)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={GUILT_MAX}
              value={guiltSlider}
              step={500}
              onChange={(e) => onSliderChange("guilt", parseInt(e.target.value))}
              className={`${styles.ccSlider} ${styles.ccSliderGuilt}`}
            />
          </div>
          <ul className={styles.ccActionList}>
            {GUILT_ACTIONS.map((a) => {
              const active = guiltActive.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`${styles.ccActionItem} ${active ? styles.ccActionActive : ""}`}
                  onClick={() => toggleAction("guilt", a.id)}
                >
                  <div className={styles.ccActionLeft}>
                    <div className={styles.ccCheckbox}>{active && <span>✓</span>}</div>
                    <span className={styles.ccActionText}>{a.text}</span>
                  </div>
                  <span className={styles.ccActionAmount}>-{fmtShort(a.amount)}/mo</span>
                </li>
              );
            })}
          </ul>

          <button type="button" className={styles.ccOptimizeBtn} onClick={autoOptimize}>
            ✨ Auto-Optimize Everything
          </button>
        </div>
      </div>

      {/* Floating AI chat widget */}
      <div className={styles.ccChatWrap}>
        {chatOpen && (
          <div className={styles.ccChatWindow}>
            <div className={styles.ccChatHeader}>
              <div className={styles.ccChatHeaderL}>
                <div className={styles.ccBotAvatar}>🤖</div>
                <div>My Advisor</div>
              </div>
              <button type="button" className={styles.ccChatClose} onClick={() => setChatOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            <div className={styles.ccChatBody} ref={chatBodyRef}>
              {messages.map((m, i) => (
                <div key={i} className={`${styles.ccMsg} ${m.sender === "bot" ? styles.ccMsgBot : styles.ccMsgUser}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className={styles.ccChatChips}>
              {["What about OTT?", "Explain the spike", "Can I invest now?"].map((c) => (
                <button key={c} type="button" className={styles.ccChip} onClick={() => send(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className={styles.ccChatInputRow}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Ask about saving, investing…"
                className={styles.ccChatInput}
              />
              <button type="button" className={styles.ccChatSend} onClick={() => send()} aria-label="Send">
                ➤
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          className={styles.ccChatToggle}
          onClick={() => setChatOpen((v) => !v)}
          aria-label={chatOpen ? "Close advisor" : "Open advisor"}
        >
          💬
        </button>
      </div>
    </div>
  );
}
