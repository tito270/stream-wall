// Deno Edge Function: provision-admin
// Creates a default admin user (admin@admin.com / 123456) only if no admin exists yet.
// Uses the service role to bypass RLS safely.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type,authorization");
  return new Response(JSON.stringify(body), { ...init, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1) If any admin already exists, no-op
    const { data: existingAdmins, error: adminsErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (adminsErr) throw adminsErr;
    if (existingAdmins && existingAdmins.length > 0) {
      return json({ ok: true, alreadyProvisioned: true });
    }

    const email = "admin@admin.com";
    const password = "123456";

    // 2) Try to create the admin user
    let adminUserId: string | null = null;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      // If user exists, find by listing users and filtering client-side
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      const found = list.users?.find((u: any) => u.email?.toLowerCase() === email);
      if (!found) throw createErr; // Can't find the user and creation failed
      adminUserId = found.id;
    } else {
      adminUserId = created.user?.id ?? null;
    }

    if (!adminUserId) throw new Error("Failed to resolve admin user id");

    // 3) Ensure profile exists
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ user_id: adminUserId, username: "admin" }, { onConflict: "user_id" });
    if (profileErr) throw profileErr;

    // 4) Ensure admin role exists
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: adminUserId, role: "admin" as any }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return json({ ok: true, created: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
});