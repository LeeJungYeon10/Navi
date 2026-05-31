import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const hasConfig =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes("PASTE_YOUR");

export function isSupabaseConfigured() {
  return Boolean(hasConfig);
}

export async function getSupabase() {
  if (!hasConfig) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
