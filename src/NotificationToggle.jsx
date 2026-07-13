import { useState, useEffect, useMemo } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = "BNiMwkTUOnc7cS92AAB71NU-p4K35dqE_RYW9GFlfiZuEXnQkhdILYXF7ckulCVWI69cekeSdiuWA_Br9M14_iY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const FALLBACK_TIMEZONES = [
  "UTC", "Africa/Lagos", "Africa/Cairo", "Africa/Johannesburg", "Africa/Nairobi",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
];

function getTimezoneList() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // fall through
  }
  return FALLBACK_TIMEZONES;
}

const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export default function NotificationToggle({ userId }) {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [time1, setTime1] = useState("09:00");
  const [time2, setTime2] = useState("18:00");
  const [useSecond, setUseSecond] = useState(false);
  const [saved, setSaved] = useState(null);

  const timezoneList = useMemo(getTimezoneList, []);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setStatus("on");
          const { data } = await supabase
            .from("push_subscriptions")
            .select("reminder_hour, reminder_minute, reminder_hour_2, reminder_minute_2, timezone")
            .eq("endpoint", sub.endpoint)
            .maybeSingle();
          if (data) {
            const t1 = `${String(data.reminder_hour).padStart(2, "0")}:${String(data.reminder_minute).padStart(2, "0")}`;
            setTime1(t1);
            setTimezone(data.timezone || detectedTimezone);
            if (data.reminder_hour_2 !== null && data.reminder_hour_2 !== undefined) {
              const t2 = `${String(data.reminder_hour_2).padStart(2, "0")}:${String(data.reminder_minute_2).padStart(2, "0")}`;
              setTime2(t2);
              setUseSecond(true);
            }
            setSaved({ time1: t1, useSecond: data.reminder_hour_2 != null, time2: data.reminder_hour_2 != null ? `${String(data.reminder_hour_2).padStart(2, "0")}:${String(data.reminder_minute_2).padStart(2, "0")}` : null, timezone: data.timezone });
          }
        } else {
          setStatus("off");
        }
      } catch {
        setStatus("off");
      }
    })();
  }, []);

  const buildPayload = (sub) => {
    const json = sub.toJSON();
    const [h1, m1] = time1.split(":").map(Number);
    const payload = {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      reminder_hour: h1,
      reminder_minute: m1,
      timezone,
      last_sent_date: null,
    };
    if (useSecond) {
      const [h2, m2] = time2.split(":").map(Number);
      payload.reminder_hour_2 = h2;
      payload.reminder_minute_2 = m2;
      payload.last_sent_date_2 = null;
    } else {
      payload.reminder_hour_2 = null;
      payload.reminder_minute_2 = null;
      payload.last_sent_date_2 = null;
    }
    return payload;
  };

  const save = async (sub) => {
    const { error: dbError } = await supabase
      .from("push_subscriptions")
      .upsert(buildPayload(sub), { onConflict: "endpoint" });
    if (dbError) throw dbError;
    setSaved({ time1, useSecond, time2: useSecond ? time2 : null, timezone });
  };

  const enable = async () => {
    setError("");
    setStatus("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications were blocked. You can allow them in your browser's site settings.");
        setStatus("off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await save(sub);
      setStatus("on");
    } catch (err) {
      setError(err.message || "Couldn't enable notifications.");
      setStatus("off");
    }
  };

  const updateSettings = async () => {
    setError("");
    setStatus("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setStatus("off");
        return;
      }
      await save(sub);
      setStatus("on");
    } catch (err) {
      setError(err.message || "Couldn't update reminder settings.");
      setStatus("on");
    }
  };

  const disable = async () => {
    setStatus("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch (err) {
      setError(err.message || "Couldn't disable notifications.");
      setStatus("on");
    }
  };

  if (status === "unsupported" || status === "checking") return null;

  const dirty =
    !saved ||
    saved.time1 !== time1 ||
    saved.useSecond !== useSecond ||
    (useSecond && saved.time2 !== time2) ||
    saved.timezone !== timezone;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 12, marginLeft: "auto", marginRight: "auto", width: "100%", maxWidth: 300 }}>
      {status === "on" && (
        <div style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 10, padding: 12, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: "#6B7D63", display: "flex", flexDirection: "column", gap: 3 }}>
            Timezone
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #D8E0CC", fontSize: 12 }}
            >
              {timezoneList.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 11, color: "#6B7D63", display: "flex", flexDirection: "column", gap: 3 }}>
            Reminder 1
            <input
              type="time"
              value={time1}
              onChange={(e) => setTime1(e.target.value)}
              style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #D8E0CC", fontSize: 12 }}
            />
          </label>

          <label style={{ fontSize: 11, color: "#6B7D63", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={useSecond} onChange={(e) => setUseSecond(e.target.checked)} />
            Add a second reminder
          </label>
          {useSecond && (
            <label style={{ fontSize: 11, color: "#6B7D63", display: "flex", flexDirection: "column", gap: 3 }}>
              Reminder 2
              <input
                type="time"
                value={time2}
                onChange={(e) => setTime2(e.target.value)}
                style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #D8E0CC", fontSize: 12 }}
              />
            </label>
          )}

          {dirty && (
            <button
              onClick={updateSettings}
              disabled={status === "busy"}
              style={{ background: "#4C7A5C", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
            >
              Save reminder settings
            </button>
          )}
        </div>
      )}

      {status === "on" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: "#4C7A5C", color: "#fff",
              border: "1px solid #E1E7D9", borderRadius: 20, padding: "6px 14px", fontSize: 12,
            }}
          >
            <Bell size={13} /> Reminders on
          </div>
          <button
            onClick={disable}
            disabled={status === "busy"}
            style={{ background: "none", border: "none", color: "#B0584F", fontSize: 11, cursor: status === "busy" ? "default" : "pointer", padding: 2, textDecoration: "underline" }}
          >
            {status === "busy" ? "Working…" : "Turn off reminders"}
          </button>
        </div>
      ) : (
        <button
          onClick={enable}
          disabled={status === "busy"}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "#fff", color: "#1B2A1A",
            border: "1px solid #E1E7D9", borderRadius: 20, padding: "6px 14px", fontSize: 12,
            cursor: status === "busy" ? "default" : "pointer",
          }}
        >
          <BellOff size={13} />
          {status === "busy" ? "Working…" : "Turn on daily reminders"}
        </button>
      )}
      {error && <div style={{ fontSize: 11, color: "#B0584F", textAlign: "center", maxWidth: 260 }}>{error}</div>}
    </div>
  );
}
