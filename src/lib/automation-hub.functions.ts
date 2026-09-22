import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.object({ accessToken: z.string().min(1) });
const AssignAgendaGroup = Token.extend({
  groupId: z.string().min(1).max(160),
  groupName: z.string().min(1).max(160),
});

export const getAutomationHub = createServerFn({ method: "POST" })
  .inputValidator((input) => Token.parse(input))
  .handler(async ({ data }) => {
    const [{ requireAdminAccess }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/feed-sources.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    await requireAdminAccess(data.accessToken);
    const { data: groups, error } = await supabaseAdmin
      .from("whatsapp_groups")
      .select("external_group_id,nome,ativo,autorizado")
      .eq("ativo", true)
      .eq("autorizado", true)
      .order("nome");
    if (error) throw new Error("Não foi possível carregar os grupos da agenda.");
    return { groups: groups ?? [] };
  });

export const assignAgendaGroup = createServerFn({ method: "POST" })
  .inputValidator((input) => AssignAgendaGroup.parse(input))
  .handler(async ({ data }) => {
    const [{ requireAdminAccess }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/feed-sources.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    await requireAdminAccess(data.accessToken);
    const externalId = data.groupId.trim().toLowerCase();
    if (!/^\d{5,}(-\d+)?@g\.us$/.test(externalId)) {
      throw new Error("Selecione um grupo do WhatsApp válido ou informe seu ID completo.");
    }
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("whatsapp_groups")
      .select("nome")
      .eq("external_group_id", externalId)
      .maybeSingle();
    if (lookupError) throw new Error("Não foi possível verificar esse grupo.");
    const { error } = await supabaseAdmin.from("whatsapp_groups").upsert({
      external_group_id: externalId,
      nome: existing?.nome || data.groupName.trim(),
      ativo: true,
      autorizado: true,
      automation_mode: "monitorar",
      updated_at: new Date().toISOString(),
    }, { onConflict: "external_group_id" });
    if (error) throw new Error("Não foi possível associar o grupo à agenda.");
    return { ok: true, externalId };
  });
