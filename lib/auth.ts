import type { NextRequest } from "next/server";
import { userClient } from "@/lib/supabase";

/**
 * Resolve the authenticated user id from the request's Bearer token.
 * Validates the JWT against Supabase Auth. Returns null when missing/invalid.
 */
export async function getUserId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await userClient(token).auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
