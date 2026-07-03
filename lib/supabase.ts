import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Service-role client — SERVER ONLY. Bypasses Row-Level Security, so every query
 * here MUST scope by user_id manually. Never import this into client code.
 */
export function serviceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * User-scoped client built from a bearer token. RLS applies. We use it server-side
 * to validate the caller's session and resolve their user id.
 */
export function userClient(accessToken: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Browser client — uses the public anon key only. RLS enforces that a signed-in
 * user can read nothing but their own rows (e.g. the audit log).
 */
export function browserClient() {
  return createClient(url, anonKey);
}
