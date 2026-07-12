import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

function getLocalHourMinute(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    return {
      hour: parseInt(map.hour, 10) % 24,
      minute: parseInt(map.minute, 10),
      dateStr: `${map.year}-${map.month}-${map.day}`,
    };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), dateStr: now.toISOString().slice(0, 10) };
  }
}

// Matches if we're in the same "bucket" as the target time, using a window
// wide enough to cover however often this function actually gets invoked.
function isDue(nowHour, nowMinute, targetHour, targetMinute, windowMinutes) {
  if (targetHour === null || targetHour === undefined) return false;
  const nowTotal = nowHour * 60 + nowMinute;
  const targetTotal = targetHour * 60 + targetMinute;
  return nowTotal >= targetTotal && nowTotal < targetTotal + windowMinutes;
}

export default async function handler(request, response) {
  const authHeader = request.headers["authorization"];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  // How often this function is actually being triggered (minutes).
  // Must match your scheduler's interval so we don't miss or double-send.
  const WINDOW_MINUTES = 15;

  webpush.setVapidDetails(
    "mailto:support@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
  if (error) {
    return response.status(500).json({ error: error.message });
  }

  const payload = JSON.stringify({
    title: "Evergreen 🌱",
    body: "Time to check off today's routines.",
    url: "/",
  });

  let sent = 0;
  let removed = 0;
  let skipped = 0;

  await Promise.all(
    (subs || []).map(async (sub) => {
      const { hour, minute, dateStr } = getLocalHourMinute(sub.timezone || "UTC");

      const slot1Due = isDue(hour, minute, sub.reminder_hour, sub.reminder_minute, WINDOW_MINUTES) && sub.last_sent_date !== dateStr;
      const slot2Due = isDue(hour, minute, sub.reminder_hour_2, sub.reminder_minute_2, WINDOW_MINUTES) && sub.last_sent_date_2 !== dateStr;

      if (!slot1Due && !slot2Due) {
        skipped++;
        return;
      }

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
        const updates = {};
        if (slot1Due) updates.last_sent_date = dateStr;
        if (slot2Due) updates.last_sent_date_2 = dateStr;
        await supabase.from("push_subscriptions").update(updates).eq("id", sub.id);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
    })
  );

  return response.status(200).json({ sent, removed, skipped, total: (subs || []).length });
}
