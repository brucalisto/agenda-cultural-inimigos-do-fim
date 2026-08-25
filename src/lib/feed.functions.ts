import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestDefaultFeeds, ingestLegacyNotionExport } from "@/lib/feeds.server";

async function requireAdmin(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profileError || profile?.role !== "admin") throw new Error("Acesso restrito a administradores.");
}

export const syncDefaultFeeds = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    return ingestDefaultFeeds();
  });

export const importLegacyNotionAgenda = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    return ingestLegacyNotionExport();
  });
