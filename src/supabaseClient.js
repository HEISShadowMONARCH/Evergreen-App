import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// FIX #1: Fail fast if env vars are missing rather than producing a broken
// client that throws cryptic errors later in auth/db calls.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. " +
    "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file."
  );
}

// FIX #2: Singleton — reuse the same client across hot reloads and strict-mode
// double-invocations instead of creating a new instance each time.
let _client;
export function getSupabase() {
  if (!_client) _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

export const supabase = getSupabase();
