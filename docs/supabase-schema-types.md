# Tipagem do schema Supabase

`src/integrations/supabase/types.ts` continua sendo o snapshot gerado automaticamente pelo Supabase/Lovable.

As migrações mais recentes da comunidade, marketplace e contratos editoriais avançaram antes da regeneração automática desse arquivo. Para evitar casts inseguros e, ao mesmo tempo, não editar manualmente um arquivo gerado, `src/integrations/supabase/database.ts` amplia o snapshot com as tabelas/funções novas e com colunas adicionadas por migração, como `interpreted_contents.time_was_informed`.

Todos os clientes Supabase da aplicação devem importar `Database` de `./database`. Quando o snapshot oficial for regenerado e já contiver essas estruturas, a camada de extensão poderá ser simplificada/removida sem mudança no restante da aplicação.
