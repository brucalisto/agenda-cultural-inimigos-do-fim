import { supabaseAdmin } from "@/integrations/supabase/client.server";

function configuredAdminEmails() {
  return new Set(
    (process.env["ADMIN_EMAILS"] || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function resolveAdminAccess(accessToken: string) {
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !auth.user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const profileAdmin = profile?.role === "admin";
  const appMetadataAdmin = auth.user.app_metadata?.role === "admin";
  const email = auth.user.email?.trim().toLowerCase() || "";
  const emailAdmin = Boolean(email && configuredAdminEmails().has(email));

  return {
    user: auth.user,
    isAdmin: profileAdmin || appMetadataAdmin || emailAdmin,
    source: profileAdmin ? "profile" : appMetadataAdmin ? "app_metadata" : emailAdmin ? "admin_email" : "none",
  } as const;
}
