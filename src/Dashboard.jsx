import { useMemo } from "react";
import { Flame, Trophy, Target } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  currentStreak, longestStreak, yearCompletionCount, yearDueCount, monthStats,
} from "./utils";

export default function Dashboard({ routines, completions, year, month, monthLabel }) {
  const stats = useMemo(
    () => monthStats(routines, completions, year, month),
    [routines, completions, year, month]
  );

  const routineStats = useMemo(
    () =>
      routines.map((r) => ({
        routine: r,
        current: currentStreak(r, completions),
        longest: longestStreak(r, completions),
        yearDone: yearCompletionCount(r, completions, year),
        yearDue: yearDueCount(r, year),
      })),
    [routines, completions, year]
  );

  if (routines.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "#8B9A83", padding: "20px 0", textAlign: "center" }}>
        Add a routine to start seeing streaks, charts, and stats here.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div className="ev-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <StatCard label={`${monthLabel} completion`} value={`${stats.rate}%`} sub={`${stats.totalDone}/${stats.totalDue} done`} />
        <StatCard
          label="Best day"
          value={stats.bestDay ? `${monthLabel.slice(0, 3)} ${stats.bestDay.day}` : "—"}
          sub={stats.bestDay ? `${stats.bestDay.rate}% complete` : "No data yet"}
        />
        <StatCard
          label="Most consistent"
          value={stats.mostConsistent ? stats.mostConsistent.routine.name : "—"}
          sub={stats.mostConsistent ? `${Math.round(stats.mostConsistent.rate * 100)}%` : "No data yet"}
          truncate
        />
      </div>

      {/* Progress chart */}
      <div style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 12, padding: "14px 10px 6px" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, marginBottom: 8, paddingLeft: 6, color: "#1B2A1A" }}>
          Daily completion rate — {monthLabel}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={stats.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4C7A5C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4C7A5C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEFE4" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8B9A83" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8B9A83" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              formatter={(value) => [`${value}%`, "Completion"]}
              labelFormatter={(d) => `Day ${d}`}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E1E7D9" }}
            />
            <Area type="monotone" dataKey="rate" stroke="#4C7A5C" strokeWidth={2} fill="url(#rateFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-routine streaks + annual goals */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, color: "#1B2A1A" }}>
          Streaks & annual goals — {year}
        </div>
        {routineStats.map(({ routine, current, longest, yearDone, yearDue }) => {
          const annualGoal = routine.annualGoal || 0;
          const pct = annualGoal > 0 ? Math.min(100, Math.round((yearDone / annualGoal) * 100)) : null;
          return (
            <div key={routine.id} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: routine.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{routine.name}</span>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#4C7A5C", marginBottom: annualGoal > 0 ? 8 : 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Flame size={13} color="#C99A4B" /> {current} day{current === 1 ? "" : "s"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#8B9A83" }}>
                  <Trophy size={13} /> best {longest}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#8B9A83" }}>
                  <Target size={13} /> {yearDone}/{yearDue} this year
                </span>
              </div>
              {annualGoal > 0 && (
                <div>
                  <div style={{ height: 6, background: "#ECEFE4", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: routine.color, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#8B9A83", marginTop: 3 }}>
                    {yearDone}/{annualGoal} annual goal ({pct}%)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, truncate }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 10, padding: "10px 8px", textAlign: "center", minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 9, color: "#8B9A83", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1B2A1A", whiteSpace: truncate ? "nowrap" : "normal", overflow: truncate ? "hidden" : "visible", textOverflow: truncate ? "ellipsis" : "clip" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "#6B7D63", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
