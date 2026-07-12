export function fmtDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function isDue(routine, y, m, d) {
  const date = new Date(y, m, d);
  if (routine.frequency === "daily") return true;
  if (routine.frequency === "weekly") return date.getDay() === routine.weekday;
  if (routine.frequency === "monthly") {
    const lastDay = daysInMonth(y, m);
    return d === Math.min(routine.dayOfMonth, lastDay);
  }
  return false;
}

function fmtDateObj(date) {
  return fmtDate(date.getFullYear(), date.getMonth(), date.getDate());
}

// Walks backward from today counting consecutive completed due-days.
// Stops at the first due day that wasn't completed (today itself is skipped
// if it's due but not yet completed, so the streak isn't broken mid-day).
export function currentStreak(routine, completions, today = new Date()) {
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // If today is due but not yet done, start checking from yesterday instead.
  if (isDue(routine, cursor.getFullYear(), cursor.getMonth(), cursor.getDate())) {
    const key = `${routine.id}:${fmtDateObj(cursor)}`;
    if (!completions[key]) {
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  for (let i = 0; i < 730; i++) {
    const y = cursor.getFullYear(), m = cursor.getMonth(), d = cursor.getDate();
    if (isDue(routine, y, m, d)) {
      const key = `${routine.id}:${fmtDate(y, m, d)}`;
      if (completions[key]) {
        streak++;
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Scans the last ~2 years for the longest run of consecutive completed due-days.
export function longestStreak(routine, completions, today = new Date()) {
  let longest = 0;
  let running = 0;
  const start = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
  const cursor = new Date(start);
  while (cursor <= today) {
    const y = cursor.getFullYear(), m = cursor.getMonth(), d = cursor.getDate();
    if (isDue(routine, y, m, d)) {
      const key = `${routine.id}:${fmtDate(y, m, d)}`;
      if (completions[key]) {
        running++;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

export function yearCompletionCount(routine, completions, year) {
  let count = 0;
  for (const key in completions) {
    if (completions[key] && key.startsWith(`${routine.id}:${year}-`)) count++;
  }
  return count;
}

export function yearDueCount(routine, year, today = new Date()) {
  let count = 0;
  const endDate = year === today.getFullYear() ? today : new Date(year, 11, 31);
  const cursor = new Date(year, 0, 1);
  while (cursor <= endDate) {
    if (isDue(routine, cursor.getFullYear(), cursor.getMonth(), cursor.getDate())) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// Daily completion rate for a given month, for charting.
export function dailyCompletionSeries(routines, completions, year, month, today = new Date()) {
  const total = daysInMonth(year, month);
  const series = [];
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month, d);
    if (date > today) break;
    let due = 0, done = 0;
    routines.forEach((r) => {
      if (isDue(r, year, month, d)) {
        due++;
        if (completions[`${r.id}:${fmtDate(year, month, d)}`]) done++;
      }
    });
    series.push({ day: d, rate: due > 0 ? Math.round((done / due) * 100) : 0, due, done });
  }
  return series;
}

export function monthStats(routines, completions, year, month, today = new Date()) {
  const series = dailyCompletionSeries(routines, completions, year, month, today);
  const totalDue = series.reduce((s, d) => s + d.due, 0);
  const totalDone = series.reduce((s, d) => s + d.done, 0);
  let bestDay = null;
  series.forEach((d) => {
    if (d.due > 0 && (!bestDay || d.rate > bestDay.rate)) bestDay = d;
  });
  let mostConsistent = null;
  routines.forEach((r) => {
    let due = 0, done = 0;
    series.forEach((d) => {
      if (isDue(r, year, month, d.day)) {
        due++;
        if (completions[`${r.id}:${fmtDate(year, month, d.day)}`]) done++;
      }
    });
    const rate = due > 0 ? done / due : 0;
    if (due > 0 && (!mostConsistent || rate > mostConsistent.rate)) {
      mostConsistent = { routine: r, rate, due, done };
    }
  });
  return {
    totalDue,
    totalDone,
    rate: totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0,
    bestDay,
    mostConsistent,
    series,
  };
}
