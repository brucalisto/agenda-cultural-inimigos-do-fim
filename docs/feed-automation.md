# Automação de feeds

O endpoint `POST /api/public/sync-feeds` sincroniza todas as fontes ativas cadastradas no painel.
Ele exige `Authorization: Bearer <FEED_SYNC_SECRET>` e nunca aceita chamadas anônimas.

## Secrets da aplicação

- `FEED_SYNC_SECRET`: segredo longo usado pelo agendador.
- `NOTION_API_KEY`: token da integração interna do Notion.
- `NOTION_DATABASE_ID` (opcional): ID da base, caso não esteja presente na URL cadastrada.
- `NOTION_DATA_SOURCE_ID` (opcional): ID direto da data source na API Notion 2025-09-03.

A base precisa ser compartilhada com a integração criada no Notion. Sem isso, a carga inicial exportada continua preservada, mas a sincronização ao vivo retorna um erro explícito.

## GitHub Actions

O workflow `sync-feeds.yml` chama o endpoint a cada 10 minutos. Configure no repositório:

- variável `FEED_SYNC_URL`: URL pública do aplicativo, sem barra final;
- secret `FEED_SYNC_SECRET`: o mesmo valor cadastrado na aplicação.

O agendador também pode ser substituído por um cron no Coolify/VPS chamando o mesmo endpoint.
