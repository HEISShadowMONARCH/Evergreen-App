import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created! Check your email to confirm, then log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, margin: "0 0 4px", color: "#1B2A1A" }}>Evergreen</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7D63" }}>
          {mode === "login" ? "Log in to see your routines." : "Create an account to save your routines anywhere."}
        </p>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #D8E0CC", fontSize: 14 }}
        />
        {error && <div style={{ fontSize: 12, color: "#B0584F" }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: "#4C7A5C" }}>{info}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#1B2A1A", color: "#F1F4EC", fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
          style={{ background: "none", border: "none", color: "#4C7A5C", fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
