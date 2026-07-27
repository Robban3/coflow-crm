// Delad admin-grind för funktioner som skriver till lead_pool.
//
// lead_pool har admin-only INSERT/UPDATE i RLS, men allt arbete här görs med
// service_role — som passerar RLS helt. Kontrollen måste därför göras explicit i
// varje funktion, annars är policyn verkningslös.
//
// Mönstret följer upload-company-registry/index.ts:14-53: anon-klient med
// anroparens token för identitet och rollkoll, service-klient för själva
// arbetet.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AdminContext = {
  userId: string;
  orgId: string;
  service: SupabaseClient;
};

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

/** Kastar AuthError (401/403) om anroparen inte är inloggad admin med org. */
export async function requireAdmin(req: Request): Promise<AdminContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new AuthError(401, "Missing authorization");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Notera: verify_jwt räcker inte som skydd — den publika anon-nyckeln är
  // själv en signerad JWT. getUser() med anropartoken avvisar den.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) throw new AuthError(401, "Unauthorized");
  const userId = userData.user.id;

  const { data: roleRow } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new AuthError(403, "Admin access required");

  const service = createClient(url, serviceKey);

  const { data: profile } = await service
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  const orgId = profile?.organization_id as string | undefined;
  if (!orgId) throw new AuthError(403, "No organization");

  return { userId, orgId, service };
}
