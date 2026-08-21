# Plano de Implementação - Etapa 4: Recebimento de Eventos da Evolution API

Esta etapa foca na criação da infraestrutura para receber webhooks da Evolution API, processar as mensagens e registrar logs detalhados.

## 1. Banco de Dados
- Criar a tabela `webhook_events` para auditar todas as requisições recebidas.
- Aplicar políticas de RLS (Admins veem tudo, Revisores têm acesso limitado).

## 2. Adaptador de Dados
- Criar `src/lib/adapters/evolution.ts` para converter o payload variado da Evolution API em um formato interno padronizado.
- Garantir que segredos e campos sensíveis não vazem para outras partes do sistema.

## 3. Webhook (Endpoint)
- Implementar a Edge Function (TanStack Server Route) em `src/routes/api/public/whatsapp-webhook.ts`.
- Validar o segredo `WHATSAPP_WEBHOOK_SECRET` via header `x-webhook-secret`.
- Registrar cada evento em `webhook_events`.
- Verificar autorização do grupo e registrar mensagens válidas em `whatsapp_messages`.
- Retornar HTTP 200 rapidamente, processando logicamente de forma assíncrona/segura.

## 4. Interface de Logs
- Implementar `src/routes/logs.tsx` para visualização das tentativas de entrega de webhooks.
- Restringir visualização do payload JSON apenas para administradores.

## Detalhes Técnicos
- **URL do Webhook:** `https://id-preview--{project-id}.lovable.app/api/public/whatsapp-webhook`
- **Header de Autenticação:** `x-webhook-secret`
- **Secret Requerido:** O usuário deverá cadastrar a secret `WHATSAPP_WEBHOOK_SECRET` no painel Lovable.
- **Segurança:** O endpoint utiliza `supabaseAdmin` para bypassar RLS apenas para escrita sistêmica necessária.

---
**Nota:** A secret `WHATSAPP_WEBHOOK_SECRET` deve ser configurada pelo usuário antes de testar a integração.
