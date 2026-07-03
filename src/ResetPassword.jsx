import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F4EC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap');`}</style>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E1E7D9", borderRadius: 14, padding: 28, width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24, margin: "0 0 4px", color: "#1B2A1A" }}>Set a new password</h1>
        <input
          type="password"
          required
          minLength={6}
          placeholder="New password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
        />
        {error && <div style={{ fontSize: 12, color: "#B0584F" }}>{error}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#1B2A1A", color: "#F1F4EC", fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
