# Etapa 0 — Auditoria e estabilização

Data: 2026-09-14

Objetivo: estabilizar o fluxo `fontes → interpretação → revisão → publicação → agenda` antes de ampliar comunidade, marketplace e novas automações.

## 🔴 Críticos

- [x] **Fuso horário canônico da agenda** — `America/Sao_Paulo` já foi centralizado para eventos vindos da IA e para a interface pública/admin.
- [x] **Publicação de eventos da comunidade ainda usava o timezone da sessão do banco** — corrigido nesta etapa para converter `date + time` explicitamente de `America/Sao_Paulo` para `timestamptz`.
- [x] **Comparação de duplicidades por data usava `YYYY-MM-DD` do ISO bruto** — corrigido para comparar o dia civil no fuso da agenda.
- [x] **Arquivo `.env` versionado e não ignorado** — removido da árvore atual; `.env`/`.env.*` passaram a ser ignorados e foi criado `.env.example` sem valores.
- [ ] **URLs temporárias de mídia externa** — posts do Instagram ainda podem salvar `scontent/cdninstagram` em `image_url`; essas URLs expiram. Próxima correção: espelhar a imagem de capa no bucket `event-images` durante a ingestão.

## 🟠 Importantes

- [ ] **Geocodificação em endpoint público** — `/api/public/events` aceita POST público que consulta Nominatim e grava latitude/longitude com acesso administrativo. Mover geocodificação para ingestão/publicação e tornar a API pública somente leitura.
- [ ] **Tipos Supabase desatualizados** — `src/integrations/supabase/types.ts` não representa ainda as tabelas mais novas de comunidade/marketplace. Regenerar para reduzir casts e erros silenciosos.
- [ ] **Preço com contrato divergente** — IA trabalha com número; banco usa `text`. Definir contrato canônico com `price_amount`/`price_label` ou normalizador único.
- [ ] **Evento sem horário** — `interpreted_contents.event_date` é `timestamptz`; eventos de comunidade sem `start_time` viram meia-noite. Precisamos representar explicitamente `time_not_informed` e exibir “Horário não informado”.
- [ ] **Limite fixo de 2.000 eventos na API pública** — suficiente agora, mas deve virar consulta paginada/por janela de datas antes de escalar.
- [ ] **Observabilidade dos provedores de IA** — persistir tentativa/provedor/latência/erro por conteúdo para facilitar diagnóstico e cálculo de confiabilidade.

## 🟡 Melhorias estruturais

- [ ] Criar painel **Saúde da Agenda** com anomalias: evento sem data/local, horário suspeito, imagem quebrada, duplicidade, item preso, feed desatualizado e falha de IA.
- [ ] Criar evidência por campo (“data veio da legenda”, “horário veio da imagem 3 do carrossel”).
- [ ] Consolidar estados de processamento/revisão em um contrato único.
- [ ] Adicionar testes automatizados de timezone, recorrência, duplicidade, publicação e fallbacks de IA.
- [x] Adicionar CI mínimo com `lint` + `build` em PRs e em `main`.

## Segurança da comunidade

A fundação de comunidade já habilita RLS e migrações posteriores restringem moderação/marketplace. Ainda falta uma auditoria dedicada de:

- uploads e tipos/tamanhos de mídia;
- spam/rate limit em posts, mensagens e envios de eventos;
- acesso a chat e membership;
- exclusão/edição entre usuários;
- dados privados de perfil;
- moderação e trilha de auditoria.

## Ordem de execução

1. Integridade de dados, datas/horários, mídia, duplicidade e estados.
2. Segurança de APIs e comunidade.
3. Saúde da Agenda, observabilidade e testes.
4. Performance e escala.
5. Retomar novas funcionalidades do roadmap.
