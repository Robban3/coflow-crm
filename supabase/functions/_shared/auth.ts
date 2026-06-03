// Shared auth helper for edge functions.
// Verifies the caller's Supabase JWT (sent automatically by supabase.functions.invoke)
// and returns the authenticated user id, or null if unauthenticated.
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey);
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
