# Etapa 0 — Auditoria e estabilização

Data: 2026-09-14

Objetivo: estabilizar o fluxo `fontes → interpretação → revisão → publicação → agenda` antes de ampliar comunidade, marketplace e novas automações.

## 🔴 Críticos

- [x] **Fuso horário canônico da agenda** — `America/Sao_Paulo` já foi centralizado para eventos vindos da IA e para a interface pública/admin.
- [x] **Publicação de eventos da comunidade ainda usava o timezone da sessão do banco** — corrigido para converter `date + time` explicitamente de `America/Sao_Paulo` para `timestamptz`.
- [x] **Comparação de duplicidades por data usava `YYYY-MM-DD` do ISO bruto** — corrigido para comparar o dia civil no fuso da agenda.
- [x] **URLs temporárias de mídia externa** — capas do Instagram agora são espelhadas no bucket `event-images`; sincronizações também reparam registros antigos sem nova interpretação por IA.
- [x] **Arquivo `.env` e preview da Lovable** — a tentativa de removê-lo quebrou o preview por faltar `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`; o arquivo foi restaurado exatamente como estava. Não remover/rotacionar configuração existente durante esta auditoria sem migração planejada e validação prévia.

## 🟠 Importantes

- [x] **Geocodificação em endpoint público** — `/api/public/events` agora é somente leitura; a geocodificação foi movida para manutenção protegida por `FEED_SYNC_SECRET`/`CRON_SECRET` e executada após a sincronização de feeds.
- [ ] **Tipos Supabase desatualizados** — `src/integrations/supabase/types.ts` não representa ainda todas as tabelas mais novas de comunidade/marketplace. Regenerar para reduzir casts e erros silenciosos.
- [ ] **Preço com contrato divergente** — IA trabalha com número; banco usa `text`. Definir contrato canônico com `price_amount`/`price_label` ou normalizador único.
- [ ] **Evento sem horário** — `interpreted_contents.event_date` é `timestamptz`; envios da comunidade sem `start_time` preservam `time_was_informed=false`, mas a interface ainda precisa tratar isso de forma canônica e exibir “Horário não informado”.
- [ ] **Limite fixo de 2.000 eventos na API pública** — suficiente agora, mas deve virar consulta paginada/por janela de datas antes de escalar.
- [ ] **Observabilidade dos provedores de IA** — persistir tentativa/provedor/latência/erro por conteúdo para facilitar diagnóstico e cálculo de confiabilidade.

## 🟡 Melhorias estruturais

- [ ] Criar painel **Saúde da Agenda** com anomalias: evento sem data/local, horário suspeito, imagem quebrada, duplicidade, item preso, feed desatualizado e falha de IA.
- [ ] Criar evidência por campo (“data veio da legenda”, “horário veio da imagem 3 do carrossel”).
- [ ] Consolidar estados de processamento/revisão em um contrato único.
- [ ] Adicionar testes automatizados de timezone, recorrência, duplicidade, publicação e fallbacks de IA.
- [x] Adicionar CI mínimo com `lint` + `build` em PRs e em `main`.

## Segurança da comunidade

### Corrigido nesta etapa

- [x] **Autoentrada em chats privados** — removida a condição que permitia a qualquer usuário adicionar a si próprio a uma sala cujo UUID conhecesse; membership agora depende do proprietário da sala.
- [x] **Escalada de status em eventos enviados pela comunidade** — membros só podem manter o próprio envio em estados editáveis/de revisão; `approved` e `published` continuam exclusivos da moderação/função protegida.
- [x] **Mensagens de chat mutáveis além do soft delete** — membros comuns não podem mais trocar corpo, sala, mídia, remetente ou reply de uma mensagem já enviada; somente `deleted_at` é permitido.
- [x] **Posts em espaços administrativos** — membros comuns só podem publicar em espaços ativos com `posting_policy = 'members'`; “Comunicados” continua reservado à moderação.
- [x] **Visibilidade de espaços/posts de membros** — conteúdo de espaços `members` exige autenticação e não vaza pela policy pública de posts.
- [x] **Fixação de posts** — autores comuns não podem alterar `pinned`; somente moderação.
- [x] **Perfis verificados** — perfis verificados continuam editáveis pelo proprietário, mas o selo `verified` só pode ser alterado pela moderação.

### Ainda pendente

- [ ] uploads e tipos/tamanhos de mídia;
- [ ] spam/rate limit em posts, mensagens e envios de eventos;
- [ ] política explícita para dados privados de perfil/contato;
- [ ] moderação e trilha de auditoria mais detalhada para ações da comunidade.

## Ordem de execução

1. Integridade de dados, datas/horários, mídia, duplicidade e estados.
2. Segurança de APIs e comunidade.
3. Saúde da Agenda, observabilidade e testes.
4. Performance e escala.
5. Retomar novas funcionalidades do roadmap.
