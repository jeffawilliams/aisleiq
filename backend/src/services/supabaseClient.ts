import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

// Standard client — subject to RLS, used for user-scoped queries
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client — bypasses RLS, used only for server-side writes (e.g. scan_events)
// Falls back to anon key if service role key is not configured (inserts will be limited by RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseKey);
