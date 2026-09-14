import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getEventTool from "./tools/get-event";
import listAgendaTool from "./tools/list-agenda";
import searchEventsTool from "./tools/search-events";
import updateEventTool from "./tools/update-event";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "agenda-cultural-inimigos-do-fim",
  title: "Agenda Cultural - Inimigos do Fim",
  version: "0.1.0",
  instructions:
    "Consulte, pesquise e atualize eventos da Agenda Cultural - Inimigos do Fim. Respeite as permissões do usuário conectado e confirme antes de alterar um evento.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAgendaTool, searchEventsTool, getEventTool, updateEventTool],
});