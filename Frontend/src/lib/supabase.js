import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Official Supabase Client for DocuMind AI Frontend
 * Used for live pgvector table telemetry, document counts, and cloud sync status.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Direct pgvector telemetry: Query the exact chunk count stored in Supabase
 */
export async function getSupabaseChunkCount() {
  try {
    const { count, error } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.warn("Supabase chunk count fetch error:", error.message);
      return null;
    }
    return count;
  } catch (err) {
    console.warn("Supabase network error:", err);
    return null;
  }
}

/**
 * Check Supabase pgvector connectivity and measure latency
 */
export async function testSupabaseConnection() {
  const startTime = performance.now();
  try {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true });

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return { connected: false, error: error.message, latencyMs };
    }
    return { connected: true, count: count ?? 0, latencyMs };
  } catch (err) {
    return { connected: false, error: err.message, latencyMs: 0 };
  }
}
