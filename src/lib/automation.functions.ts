import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";

type AutomationActionType = Database["public"]["Enums"]["automation_action_type"];

export const getRules = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .order("priority", { ascending: false });
    
    if (error) throw error;
    return data;
  });

export const saveRule = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.string().optional(),
    nome: z.string(),
    descricao: z.string().optional().nullable(),
    ativo: z.boolean().optional(),
    priority: z.number().optional(),
    conditions: z.any().optional(),
    action_type: z.enum([
      'apenas_registrar',
      'sinalizar',
      'ignorar',
      'enviar_para_revisao',
      'aprovar',
      'publicar',
      'responder',
      'solicitar_exclusao'
    ]),
    action_config: z.any().optional(),
    requires_approval: z.boolean().optional()
  }).parse(d))
  .handler(async ({ data }) => {
    const { id, ...ruleData } = data;
    
    const payload = {
      nome: ruleData.nome,
      descricao: ruleData.descricao ?? null,
      ativo: ruleData.ativo ?? true,
      priority: ruleData.priority ?? 0,
      conditions: ruleData.conditions ?? {},
      action_type: ruleData.action_type as AutomationActionType,
      action_config: ruleData.action_config ?? {},
      requires_approval: ruleData.requires_approval ?? true,
      updated_at: new Date().toISOString()
    };
    
    let result;
    if (id) {
      result = await supabaseAdmin
        .from("automation_rules")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from("automation_rules")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
    }
    
    if (result.error) throw result.error;
    return result.data;
  });

export const getAutomationHistory = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("automation_actions")
      .select(`
        *,
        automation_rules (nome),
        whatsapp_messages (text_content, caption)
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) throw error;
    return data;
  });

export const simulateAutomation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ messageId: z.string() }).parse(d))
  .handler(async ({ data: { messageId } }) => {
    // Fetch message
    const { data: message, error: msgError } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*, whatsapp_groups(*)")
      .eq("id", messageId)
      .single();
    
    if (msgError) throw msgError;
    if (!message) throw new Error("Mensagem não encontrada");

    // Fetch active rules
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("ativo", true)
      .order("priority", { ascending: false });
    
    if (rulesError) throw rulesError;

    // Simple matching logic (for simulation)
    let matchedRule = null;
    for (const rule of rules) {
      const conditions = rule.conditions as any;
      if (conditions && conditions.keywords && Array.isArray(conditions.keywords)) {
        const text = (message.text_content || message.caption || "").toLowerCase();
        if (conditions.keywords.some((k: string) => text.includes(k.toLowerCase()))) {
          matchedRule = rule;
          break;
        }
      }
    }

    if (!matchedRule) {
      return { status: "no_match" };
    }

    // Register action as SIMULATED
    const { data: action, error: actionError } = await supabaseAdmin
      .from("automation_actions")
      .insert({
        rule_id: matchedRule.id,
        message_id: message.id,
        action_type: matchedRule.action_type as AutomationActionType,
        execution_mode: "simular",
        status: "simulado",
        request_payload: {
          action: matchedRule.action_type,
          config: matchedRule.action_config,
          original_message: message.id
        },
        response_payload: {
          simulated: true,
          message: `Ação ${matchedRule.action_type} seria executada no modo real.`
        },
        executed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (actionError) throw actionError;

    return { status: "matched", rule: matchedRule, action };
  });
