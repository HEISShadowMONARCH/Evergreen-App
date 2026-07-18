import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, LogOut, Heart, HelpCircle, WifiOff, RefreshCw } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import ResetPassword from "./ResetPassword";
import NotificationToggle from "./NotificationToggle";
import Dashboard from "./Dashboard";
import Onboarding from "./Onboarding";

const PALETTE = ["#4C7A5C", "#C99A4B", "#8A6FB0", "#B0584F", "#3D7C93", "#7A8A3F"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LETTERS = ["S","M","T","W","T","F","S"];
const SUPPORT_LINK = "https://selar.com/showlove/dmonarch";

function fmtDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function cacheKey(userId) {
  return `evergreen-cache-${userId}`;
}
function onboardedKey(userId) {
  return `evergreen-onboarded-${userId}`;
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState("synced"); // 'synced' | 'offline' | 'syncing' | 'error'
  const scrollRef = useRef(null);
  const latestData = useRef({ routines: [], completions: {} });

  const today = useMemo(() => new Date(), [viewDate]);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Track browser online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Load this user's data once logged in — from Supabase if reachable,
  // falling back to the last locally cached copy if offline.
  useEffect(() => {
    if (!session) {
      setLoaded(session === null);
      return;
    }
    (async () => {
      const key = cacheKey(session.user.id);
      try {
        const { data, error } = await supabase
          .from("user_data")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        const nextRoutines = (data && data.data && data.data.routines) || [];
        const nextCompletions = (data && data.data && data.data.completions) || {};
        setRoutines(nextRoutines);
        setCompletions(nextCompletions);
        try {
          localStorage.setItem(key, JSON.stringify({ routines: nextRoutines, completions: nextCompletions }));
        } catch (e) {
          // cache write failure is non-fatal
        }
        setSyncStatus("synced");
      } catch (e) {
        // Likely offline — fall back to local cache so the app still works.
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            setRoutines(parsed.routines || []);
            setCompletions(parsed.completions || {});
            setSyncStatus("offline");
          } else {
            setError("Couldn't load your saved data.");
          }
        } catch (e2) {
          setError("Couldn't load your saved data.");
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  // Show the onboarding tutorial once, the first time a user logs in.
  useEffect(() => {
    if (session && loaded) {
      try {
        const seen = localStorage.getItem(onboardedKey(session.user.id));
        if (!seen) setShowOnboarding(true);
      } catch (e) {
        // ignore
      }
    }
  }, [session, loaded]);

  useEffect(() => {
    if (loaded && scrollRef.current) {
      const todayCol = scrollRef.current.querySelector('[data-today="true"]');
      if (todayCol) todayCol.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [loaded, viewDate]);

  // Keep a ref of the latest data so the "back online" listener can flush
  // whatever the user has locally, without stale closures.
  useEffect(() => {
    latestData.current = { routines, completions };
  }, [routines, completions]);

  const persist = useCallback((nextRoutines, nextCompletions) => {
    if (!session) return;
    const key = cacheKey(session.user.id);
    try {
      localStorage.setItem(key, JSON.stringify({ routines: nextRoutines, completions: nextCompletions }));
    } catch (e) {
      // non-fatal
    }
    setSyncStatus("syncing");
    (async () => {
      try {
        const { error } = await supabase.from("user_data").upsert({
          user_id: session.user.id,
          data: { routines: nextRoutines, completions: nextCompletions },
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setSyncStatus("synced");
      } catch (e) {
        // Offline or request failed — data is safe in localStorage and will
        // sync automatically once the connection returns.
        setSyncStatus("offline");
      }
    })();
  }, [session]);

  // When the browser comes back online, push whatever's currently local.
  useEffect(() => {
    if (isOnline && session && syncStatus === "offline") {
      persist(latestData.current.routines, latestData.current.completions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

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

  const toggle = (routineId, dateStr, locked) => {
    if (locked) return;
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
  const days = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  const countFor = (routine) => {
    let count = 0;
    days.forEach((d) => {
      if (completions[`${routine.id}:${fmtDate(year, month, d)}`]) count++;
    });
    return count;
  };

  const finishOnboarding = () => {
    setShowOnboarding(false);
    if (session) {
      try {
        localStorage.setItem(onboardedKey(session.user.id), "1");
      } catch (e) {
        // ignore
      }
    }
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#F1F4EC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", color: "#6B7D63" }}>
        Loading…
      </div>
    );
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
        * { box-sizing: border-box; min-width: 0; }
        html, body { overflow-x: hidden; max-width: 100%; }
        .ev-btn { transition: transform .12s ease; }
        .ev-btn:active { transform: scale(0.96); }
        .ev-cell { transition: all .12s ease; cursor: pointer; }
        .ev-cell:hover:not(.ev-disabled) { filter: brightness(0.95); }
        .ev-scroll::-webkit-scrollbar { height: 6px; }
        .ev-scroll::-webkit-scrollbar-thumb { background: #D3DCC5; border-radius: 3px; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid #4C7A5C; outline-offset: 2px; }
        @media (min-width: 700px) {
          .ev-stat-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 699px) {
          .ev-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {showOnboarding && <Onboarding onDone={finishOnboarding} />}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 14px 60px", overflowX: "hidden" }}>
        <header style={{ marginBottom: 18, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
            <button onClick={() => setShowOnboarding(true)} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 8, cursor: "pointer", padding: 6, marginLeft: 4, display: "flex" }} aria-label="Show tutorial">
              <HelpCircle size={16} />
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 8, cursor: "pointer", padding: 6, display: "flex" }} aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {(syncStatus === "offline" || syncStatus === "syncing") && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 14,
            color: syncStatus === "offline" ? "#B0584F" : "#6B7D63",
            background: syncStatus === "offline" ? "#FBEDEB" : "#F0F3EA",
            border: `1px solid ${syncStatus === "offline" ? "#E8C4BE" : "#E1E7D9"}`,
            borderRadius: 8, padding: "6px 10px",
          }}>
            {syncStatus === "offline" ? <WifiOff size={13} /> : <RefreshCw size={13} />}
            {syncStatus === "offline" ? "Offline — changes are saved on this device and will sync when you're back online." : "Syncing…"}
          </div>
        )}

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
                    onKeyDown={(e) => e.key === "Enter" && addRoutine()}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={freq} onChange={(e) => setFreq(e.target.value)} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {freq === "weekly" && (
                      <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w, i) => <option key={w} value={i}>{w}</option>)}
                      </select>
                    )}
                    {freq === "monthly" && (
                      <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}>
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
                        position: "sticky", left: 0, background: "#1B2A1A", color: "#F1F4EC", zIndex: 3,
                        textAlign: "left", padding: "10px 12px", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 13, width: 110, minWidth: 110, maxWidth: 110,
                      }}>Routine</th>
                      <th style={{ position: "sticky", left: 110, background: "#1B2A1A", color: "#F1F4EC", zIndex: 3, padding: "10px 6px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, width: 54, minWidth: 54, maxWidth: 54 }}>Freq</th>
                      <th style={{ position: "sticky", left: 164, background: "#1B2A1A", color: "#F1F4EC", zIndex: 3, padding: "10px 6px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, width: 44, minWidth: 44, maxWidth: 44 }}>Done</th>
                      <th style={{
                        position: "sticky", left: 208, background: "#1B2A1A", color: "#F1F4EC", zIndex: 3,
                        padding: "10px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, width: 68, minWidth: 68, maxWidth: 68,
                        boxShadow: "3px 0 6px -2px rgba(0,0,0,0.25)",
                      }}>Counter</th>
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
                    {routines.map((r, ri) => {
                      const rowBg = ri % 2 === 0 ? "#fff" : "#FAFBF7";
                      return (
                        <tr key={r.id} style={{ background: rowBg }}>
                          <td style={{
                            position: "sticky", left: 0, background: rowBg, zIndex: 1,
                            padding: 0, borderBottom: "1px solid #ECEFE4",
                            width: 110, minWidth: 110, maxWidth: 110,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                              <span
                                title={r.name}
                                style={{ fontSize: 13, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              >
                                {r.name}
                              </span>
                              <button onClick={() => removeRoutine(r.id)} aria-label={`Remove ${r.name}`} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#C7B4AE", display: "flex", padding: 2, flexShrink: 0 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                          <td
                            title={r.frequency === "weekly" ? `Every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][r.weekday]}` : r.frequency === "monthly" ? `Day ${r.dayOfMonth} of each month` : "Every day"}
                            style={{
                              position: "sticky", left: 110, background: rowBg, zIndex: 1,
                              textAlign: "center", borderBottom: "1px solid #ECEFE4", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B7D63",
                            }}
                          >
                            {r.frequency === "weekly" ? "Wkly" : r.frequency === "monthly" ? "Mthly" : "Daily"}
                          </td>
                          <td style={{
                            position: "sticky", left: 164, background: rowBg, zIndex: 1,
                            textAlign: "center", borderBottom: "1px solid #ECEFE4", fontFamily: "'JetBrains Mono', monospace", color: "#6B7D63",
                          }}>
                            {countFor(r)}
                          </td>
                          <td style={{
                            position: "sticky", left: 208, background: rowBg, zIndex: 1,
                            textAlign: "center", borderBottom: "1px solid #ECEFE4", fontFamily: "'JetBrains Mono', monospace", color: "#4C7A5C", fontWeight: 600,
                            boxShadow: "3px 0 6px -2px rgba(0,0,0,0.08)",
                          }}>
                            {r.goal || "–"}
                          </td>
                          {days.map((d) => {
                            const date = new Date(year, month, d);
                            const due = isDue(r, year, month, d);
                            const dateStr = fmtDate(year, month, d);
                            const key = `${r.id}:${dateStr}`;
                            const done = !!completions[key];
                            const isToday = date.toDateString() === today.toDateString();
                            const locked = date > today && !isToday;
                            return (
                              <td key={d} style={{ textAlign: "center", borderBottom: "1px solid #ECEFE4", padding: 3 }}>
                                {due ? (
                                  <div
                                    className={`ev-cell${locked ? " ev-disabled" : ""}`}
                                    role="button"
                                    tabIndex={locked ? -1 : 0}
                                    aria-label={`${r.name} on ${dateStr}, ${done ? "done" : "not done"}`}
                                    aria-pressed={done}
                                    onClick={() => toggle(r.id, dateStr, locked)}
                                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(r.id, dateStr, locked)}
                                    style={{
                                      width: 22, height: 22, margin: "0 auto", borderRadius: 5,
                                      background: done ? r.color : "transparent",
                                      border: `1.4px solid ${done ? r.color : "#D8E0CC"}`,
                                      opacity: locked ? 0.4 : 1,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      cursor: locked ? "default" : "pointer",
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
                      );
                    })}
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
