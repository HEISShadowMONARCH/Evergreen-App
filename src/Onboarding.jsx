import { useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const STEPS = [
  {
    title: "Welcome to Evergreen 🌱",
    body: "A simple grid for tracking daily, weekly, and monthly routines. Here's a quick tour.",
  },
  {
    title: "Add a routine",
    body: "Tap \"Add routine\" to create one. Choose how often it repeats, and optionally set a monthly or annual goal.",
  },
  {
    title: "Mark today's progress",
    body: "In the Grid view, tap past and today's cell next to a routine to check it off. Future days are locked — only today and past days can be marked.",
  },
  {
    title: "Grid vs. Dashboard",
    body: "Switch to Dashboard to see streaks, completion charts, and annual goal progress for everything you're tracking.",
  },
  {
    title: "Make it yours 🎨",
    body: "Tap the palette icon up top to pick a color theme — Evergreen, Ocean, Sunset, Lavender, or Slate. Whatever suits your taste.",
  },
  {
    title: "Stay on track",
    body: "Turn on daily reminders (with your own timezone and times) so you don't forget. You can always find this tour again later.",
  },
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(27, 42, 26, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
      }}
    >
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%", position: "relative" }}>
        <button
          onClick={onDone}
          aria-label="Close tutorial"
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#8B9A83", display: "flex" }}
        >
          <X size={18} />
        </button>

        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19, color: "#1B2A1A", marginBottom: 10, paddingRight: 20 }}>
          {STEPS[step].title}
        </div>
        <div style={{ fontSize: 14, color: "#3D4F3B", lineHeight: 1.5, marginBottom: 20 }}>
          {STEPS[step].body}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: i === step ? "#4C7A5C" : "#E1E7D9",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
              color: step === 0 ? "#D8E0CC" : "#6B7D63", fontSize: 13, cursor: step === 0 ? "default" : "pointer", padding: 4,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {isLast ? (
            <button
              onClick={onDone}
              style={{ background: "#1B2A1A", color: "#F1F4EC", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}
            >
              Get started
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              style={{
                display: "flex", alignItems: "center", gap: 4, background: "#4C7A5C", color: "#fff",
                border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, cursor: "pointer",
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
