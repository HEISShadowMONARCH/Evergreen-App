import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

export default async function handler(request, response) {
  // Verify this is actually Vercel's cron calling us
  const authHeader = request.headers["authorization"];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }

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

  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err) {
        // 404/410 means the subscription is dead — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
    })
  );

  return response.status(200).json({ sent, removed, total: (subs || []).length });
}
