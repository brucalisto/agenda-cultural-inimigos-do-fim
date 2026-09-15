# Etapa 0 — Auditoria e estabilização

Data: 2026-09-14

Objetivo: estabilizar o fluxo `fontes → interpretação → revisão → publicação → agenda` antes de ampliar comunidade, marketplace e novas automações.

## 🔴 Críticos

- [x] **Fuso horário canônico da agenda** — `America/Sao_Paulo` já foi centralizado para eventos vindos da IA e para a interface pública/admin.
- [x] **Publicação de eventos da comunidade ainda usava o timezone da sessão do banco** — corrigido para converter `date + time` explicitamente de `America/Sao_Paulo` para `timestamptz`.
- [x] **Comparação de duplicidades por data usava `YYYY-MM-DD` do ISO bruto** — corrigido para comparar o dia civil no fuso da agenda.
- [x] **URLs temporárias de mídia externa** — capas do Instagram agora são espelhadas no bucket `event-images`; sincronizações e manutenção protegida também reparam registros antigos em lotes pequenos sem nova interpretação por IA.
- [x] **Arquivo `.env` e preview da Lovable** — a tentativa de removê-lo quebrou o preview por faltar `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`; o arquivo foi restaurado exatamente como estava. Não remover/rotacionar configuração existente durante esta auditoria sem migração planejada e validação prévia.

## 🟠 Importantes

- [x] **Geocodificação em endpoint público** — `/api/public/events` agora é somente leitura; a geocodificação foi movida para manutenção protegida por `FEED_SYNC_SECRET`/`CRON_SECRET` e executada após a sincronização de feeds.
- [x] **Tipos Supabase desatualizados** — o snapshot gerado continua preservado em `types.ts`, enquanto `database.ts` amplia a tipagem com comunidade, marketplace, funções RPC e colunas recentes como `time_was_informed`. Os clientes Supabase passam a usar esse contrato e os casts manuais das telas novas foram removidos.
- [x] **Preço com contrato divergente** — criado normalizador único: `null` = valor não informado, `0` = gratuito e texto preservado = valor fixo/faixa/condição. A API pública também deriva `price_kind` e `price_label`, sem quebrar o campo legado `price`.
- [x] **Evento sem horário** — criado contrato canônico `time_was_informed`; datas sem horário são ancoradas no dia civil de `America/Sao_Paulo`, a API pública devolve somente `YYYY-MM-DD` nesses casos e a agenda exibe “Horário não informado” em vez de inventar `00:00`. Registros legados ambíguos permanecem `null` para não inferir informação inexistente.
- [x] **Limite fixo de 2.000 eventos na API pública** — substituído por leitura paginada em blocos de 500, preservando compatibilidade com o frontend atual e emitindo metadados/alerta caso o teto de segurança de 10.000 registros-fonte seja atingido.
- [x] **Observabilidade dos provedores de IA** — criada a trilha técnica `ai_provider_attempts`, registrando operação, modo, provedor/modelo, ordem da tentativa, sucesso/erro, latência, fallback e retry. O log não armazena prompt, conteúdo bruto, mídia ou chaves e uma falha na telemetria nunca bloqueia o processamento principal.

## 🟡 Melhorias estruturais

- [x] Criar painel **Saúde da Agenda** com anomalias: evento sem data/local, imagem instável, duplicidade, baixa confiança, item preso, feed desatualizado e falha de IA.
- [ ] Criar evidência por campo (“data veio da legenda”, “horário veio da imagem 3 do carrossel”).
- [ ] Consolidar estados de processamento/revisão em um contrato único.
- [x] Adicionar testes automatizados iniciais de timezone, normalização da IA, preço, recorrência e duplicidade.
- [ ] Adicionar testes específicos da cadeia de retry/fallback das IAs e de publicação ponta a ponta.
- [x] Adicionar CI com `lint` + testes + `build` em PRs e em `main`.

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
