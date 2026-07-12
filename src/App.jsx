import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, LogOut, Heart } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import ResetPassword from "./ResetPassword";
import NotificationToggle from "./NotificationToggle";
import Dashboard from "./Dashboard";

const PALETTE = ["#4C7A5C", "#C99A4B", "#8A6FB0", "#B0584F", "#3D7C93", "#7A8A3F"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LETTERS = ["S","M","T","W","T","F","S"];
const STORAGE_KEY = "evergreen-grid-data";
const SUPPORT_LINK = "https://selar.com/showlove/dmonarch";

function fmtDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [recovering, setRecovering] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState("daily");
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [goal, setGoal] = useState(20);
  const [annualGoal, setAnnualGoal] = useState("");
  const [view, setView] = useState("grid"); // 'grid' | 'dashboard'
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load this user's data once logged in
  useEffect(() => {
    if (!session) {
      setLoaded(session === null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_data")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          setRoutines(data.data.routines || []);
          setCompletions(data.data.completions || {});
        }
      } catch (e) {
        setError("Couldn't load your saved data.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  // Scroll to today's column once loaded
  useEffect(() => {
    if (loaded && scrollRef.current) {
      const todayCol = scrollRef.current.querySelector('[data-today="true"]');
      if (todayCol) todayCol.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [loaded, viewDate]);

  const persist = useCallback((nextRoutines, nextCompletions) => {
    if (!session) return;
    (async () => {
      try {
        const { error } = await supabase.from("user_data").upsert({
          user_id: session.user.id,
          data: { routines: nextRoutines, completions: nextCompletions },
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      } catch (e) {
        setError("Couldn't save — your changes may not persist.");
      }
    })();
  }, [session]);

  const addRoutine = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const routine = {
      id: `${Date.now()}`,
      name: trimmed,
      frequency: freq,
      weekday: freq === "weekly" ? Number(weekday) : null,
      dayOfMonth: freq === "monthly" ? Number(dayOfMonth) : null,
      goal: Number(goal) || 0,
      annualGoal: Number(annualGoal) || 0,
      color: PALETTE[routines.length % PALETTE.length],
    };
    const next = [...routines, routine];
    setRoutines(next);
    persist(next, completions);
    setName("");
    setFreq("daily");
    setGoal(20);
    setAnnualGoal("");
    setShowForm(false);
  };

  const removeRoutine = (id) => {
    const next = routines.filter((r) => r.id !== id);
    const nextCompletions = Object.fromEntries(
      Object.entries(completions).filter(([k]) => !k.startsWith(`${id}:`))
    );
    setRoutines(next);
    setCompletions(nextCompletions);
    persist(next, nextCompletions);
  };

  const isDue = (routine, y, m, d) => {
    const date = new Date(y, m, d);
    if (routine.frequency === "daily") return true;
    if (routine.frequency === "weekly") return date.getDay() === routine.weekday;
    if (routine.frequency === "monthly") {
      const lastDay = daysInMonth(y, m);
      return d === Math.min(routine.dayOfMonth, lastDay);
    }
    return false;
  };

  const toggle = (routineId, dateStr, isFuture) => {
    if (isFuture) return;
    const key = `${routineId}:${dateStr}`;
    const next = { ...completions };
    if (next[key]) delete next[key];
    else next[key] = true;
    setCompletions(next);
    persist(routines, next);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const total = daysInMonth(year, month);
  const today = new Date();
  const days = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  const countFor = (routine) => {
    let count = 0;
    days.forEach((d) => {
      if (completions[`${routine.id}:${fmtDate(year, month, d)}`]) count++;
    });
    return count;
  };

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", background: "#F1F4EC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", color: "#6B7D63" }}>Loading…</div>;
  }
  if (recovering) {
    return <ResetPassword onDone={() => setRecovering(false)} />;
  }
  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F4EC", fontFamily: "'Inter', sans-serif", color: "#20301F" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
        .ev-btn { transition: transform .12s ease; }
        .ev-btn:active { transform: scale(0.96); }
        .ev-cell { transition: all .12s ease; cursor: pointer; }
        .ev-cell:hover:not(.ev-disabled) { filter: brightness(0.95); }
        .ev-scroll::-webkit-scrollbar { height: 6px; }
        .ev-scroll::-webkit-scrollbar-thumb { background: #D3DCC5; border-radius: 3px; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid #4C7A5C; outline-offset: 2px; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 14px 60px" }}>
        <header style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "#6B7D63", textTransform: "uppercase" }}>
              Routine grid
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 28, margin: "2px 0 0", color: "#1B2A1A" }}>
              Evergreen
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 8, cursor: "pointer", padding: 6 }} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", minWidth: 88, textAlign: "center" }}>{MONTHS[month].slice(0,3)} {year}</div>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 8, cursor: "pointer", padding: 6 }} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 8, cursor: "pointer", padding: 6, marginLeft: 4, display: "flex" }} aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {!loaded ? (
          <div style={{ color: "#6B7D63", fontSize: 14 }}>Loading your routines…</div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <button
                className="ev-btn"
                onClick={() => setShowForm((s) => !s)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, background: "#1B2A1A", color: "#F1F4EC",
                  border: "none", borderRadius: 20, padding: "7px 14px", fontSize: 13, cursor: "pointer",
                }}
              >
                <Plus size={14} /> Add routine
              </button>

              {showForm && (
                <div style={{ marginTop: 10, background: "#fff", border: "1px solid #E1E7D9", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    autoFocus
                    placeholder="Routine name (e.g. Workout)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={freq} onChange={(e) => setFreq(e.target.value)} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {freq === "weekly" && (
                      <select value={weekday} onChange={(e) => setWeekday(e.target.value)} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w, i) => <option key={w} value={i}>{w}</option>)}
                      </select>
                    )}
                    {freq === "monthly" && (
                      <select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
                      </select>
                    )}
                    <input
                      type="number"
                      min="0"
                      placeholder="Goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      title="Monthly goal count"
                      style={{ width: 70, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Annual goal"
                      value={annualGoal}
                      onChange={(e) => setAnnualGoal(e.target.value)}
                      title="Optional: annual goal count"
                      style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowForm(false)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #D8E0CC", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    <button className="ev-btn" onClick={addRoutine} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#4C7A5C", color: "#fff", fontSize: 13, cursor: "pointer" }}>Save</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                onClick={() => setView("grid")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  border: "1px solid #E1E7D9",
                  background: view === "grid" ? "#1B2A1A" : "#fff",
                  color: view === "grid" ? "#F1F4EC" : "#1B2A1A",
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setView("dashboard")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  border: "1px solid #E1E7D9",
                  background: view === "dashboard" ? "#1B2A1A" : "#fff",
                  color: view === "dashboard" ? "#F1F4EC" : "#1B2A1A",
                }}
              >
                Dashboard
              </button>
            </div>

            {view === "dashboard" ? (
              <Dashboard routines={routines} completions={completions} year={year} month={month} monthLabel={MONTHS[month]} />
            ) : routines.length === 0 ? (
              <div style={{ fontSize: 13, color: "#8B9A83", padding: "20px 0" }}>
                Add a routine above to start filling in the grid.
              </div>
            ) : (
              <div ref={scrollRef} className="ev-scroll" style={{ overflowX: "auto", background: "#fff", border: "1px solid #E1E7D9", borderRadius: 12 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 620 + days.length * 30 }}>
                  <thead>
                    <tr>
                      <th style={{
                        position: "sticky", left: 0, background: "#1B2A1A", color: "#F1F4EC", zIndex: 2,
                        textAlign: "left", padding: "10px 12px", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 13, minWidth: 150,
                      }}>Routine</th>
                      <th style={{ background: "#1B2A1A", color: "#F1F4EC", padding: "10px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, minWidth: 46 }}>Goal</th>
                      {days.map((d) => {
                        const dow = new Date(year, month, d).getDay();
                        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                        return (
                          <th
                            key={d}
                            data-today={isToday ? "true" : "false"}
                            style={{
                              background: isToday ? "#4C7A5C" : "#1B2A1A", color: "#F1F4EC",
                              padding: "6px 4px", minWidth: 30, fontWeight: 500,
                            }}
                          >
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, opacity: 0.7 }}>{DAY_LETTERS[dow]}</div>
                            <div style={{ fontSize: 12 }}>{d}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {routines.map((r, ri) => (
                      <tr key={r.id} style={{ background: ri % 2 === 0 ? "#fff" : "#FAFBF7" }}>
                        <td style={{
                          position: "sticky", left: 0, background: ri % 2 === 0 ? "#fff" : "#FAFBF7", zIndex: 1,
                          padding: "8px 12px", borderBottom: "1px solid #ECEFE4", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13 }}>{r.name}</span>
                          <button onClick={() => removeRoutine(r.id)} aria-label={`Remove ${r.name}`} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#C7B4AE", display: "flex", padding: 2 }}>
                            <Trash2 size={11} />
                          </button>
                        </td>
                        <td style={{ textAlign: "center", borderBottom: "1px solid #ECEFE4", fontFamily: "'JetBrains Mono', monospace", color: "#6B7D63" }}>
                          {countFor(r)}/{r.goal || "–"}
                        </td>
                        {days.map((d) => {
                          const date = new Date(year, month, d);
                          const due = isDue(r, year, month, d);
                          const key = `${r.id}:${fmtDate(year, month, d)}`;
                          const done = !!completions[key];
                          const isFuture = date > today && date.toDateString() !== today.toDateString();
                          return (
                            <td key={d} style={{ textAlign: "center", borderBottom: "1px solid #ECEFE4", padding: 3 }}>
                              {due ? (
                                <div
                                  className={`ev-cell ${isFuture ? "ev-disabled" : ""}`}
                                  role="button"
                                  aria-label={`${r.name} on ${fmtDate(year, month, d)}, ${done ? "done" : "not done"}`}
                                  onClick={() => toggle(r.id, fmtDate(year, month, d), isFuture)}
                                  style={{
                                    width: 22, height: 22, margin: "0 auto", borderRadius: 5,
                                    background: done ? r.color : "transparent",
                                    border: `1.4px solid ${done ? r.color : "#D8E0CC"}`,
                                    opacity: isFuture ? 0.4 : 1,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: isFuture ? "default" : "pointer",
                                  }}
                                >
                                  {done && <Check size={13} color="#fff" strokeWidth={3} />}
                                </div>
                              ) : (
                                <div style={{ width: 22, height: 22, margin: "0 auto" }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {error && <div style={{ marginTop: 12, fontSize: 12, color: "#B0584F" }}>{error}</div>}

            <footer style={{ marginTop: 32, textAlign: "center" }}>
              <a
                href={SUPPORT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, background: "#B0584F", color: "#fff",
                  border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                <Heart size={14} /> Support this app
              </a>
              <NotificationToggle userId={session.user.id} />
            </footer>
          </>
        )}
      </div>
      <SpeedInsights />
    </div>
  );
}
