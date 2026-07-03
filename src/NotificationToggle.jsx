import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = "BNiMwkTUOnc7cS92AAB71NU-p4K35dqE_RYW9GFlfiZuEXnQkhdILYXF7ckulCVWI69cekeSdiuWA_Br9M14_iY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationToggle({ userId }) {
  const [status, setStatus] = useState("checking"); // checking | unsupported | off | on | busy
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      } catch {
        setStatus("off");
      }
    })();
  }, []);

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
      const json = sub.toJSON();
      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      if (dbError) throw dbError;
      setStatus("on");
    } catch (err) {
      setError(err.message || "Couldn't enable notifications.");
      setStatus("off");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 10 }}>
      <button
        onClick={status === "on" ? disable : enable}
        disabled={status === "busy"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: status === "on" ? "#4C7A5C" : "#fff",
          color: status === "on" ? "#fff" : "#1B2A1A",
          border: "1px solid #E1E7D9", borderRadius: 20, padding: "6px 14px", fontSize: 12,
          cursor: status === "busy" ? "default" : "pointer",
        }}
      >
        {status === "on" ? <Bell size={13} /> : <BellOff size={13} />}
        {status === "busy" ? "Working…" : status === "on" ? "Daily reminders on" : "Turn on daily reminders"}
      </button>
      {error && <div style={{ fontSize: 11, color: "#B0584F", textAlign: "center", maxWidth: 240 }}>{error}</div>}
    </div>
  );
}
