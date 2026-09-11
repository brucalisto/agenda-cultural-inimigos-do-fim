# Instagram via Meta Business Discovery

A área **Fontes / Feeds** usa a API oficial da Meta para monitorar perfis profissionais do Instagram (Business ou Creator) cadastrados no painel.

## Secrets do servidor

Configure estes secrets no ambiente do Lovable Cloud:

- `META_INSTAGRAM_ACCESS_TOKEN`: Page Access Token da Página vinculada à conta profissional autenticadora.
- `META_INSTAGRAM_ACCOUNT_ID`: ID de `instagram_business_account` da conta profissional autenticadora.
- `META_GRAPH_API_VERSION`: opcional. O padrão do código é `v26.0`.

Nunca coloque tokens no frontend, no GitHub ou em variáveis `VITE_*`.

## Obter um token adequado para produção

O token gerado pelo Graph API Explorer é usado apenas para teste. Para produção, gere primeiro um User Access Token de longa duração e, a partir dele, recupere o Page Access Token da Página vinculada ao Instagram.

1. Gere no Graph API Explorer um User Access Token do app `INIMIGOS DO FIM` com:
   - `pages_show_list`
   - `business_management`
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_read_engagement`
2. Troque o token curto por um token de longa duração usando o endpoint OAuth da Meta com o App ID e o App Secret.
3. Com o token longo, consulte `/me/accounts?fields=id,name,access_token,instagram_business_account`.
4. Na Página vinculada à conta profissional autenticadora, copie:
   - `access_token` -> `META_INSTAGRAM_ACCESS_TOKEN`
   - `instagram_business_account.id` -> `META_INSTAGRAM_ACCOUNT_ID`
5. Confira o token no Access Token Debugger antes de colocá-lo em produção.

## Funcionamento

Ao sincronizar uma fonte do Instagram, o backend:

1. extrai o username da URL cadastrada;
2. consulta `business_discovery` pela conta profissional autenticadora;
3. busca até 12 publicações recentes;
4. lê legenda, tipo de mídia, permalink, timestamp e imagens disponíveis;
5. envia o conteúdo para a IA;
6. separa múltiplos eventos quando necessário;
7. verifica duplicidade;
8. envia os itens para Revisão.

Perfis do Instagram podem ser adicionados, pausados e removidos diretamente na tela **Fontes / Feeds**. A FUNDACC não é mais uma fonte fixa obrigatória.

## Compatibilidade temporária

Se os dois secrets da Meta ainda não estiverem configurados, o código mantém temporariamente o fallback anterior de leitura pública do Instagram. Assim, a publicação da mudança não derruba o fluxo atual enquanto a credencial oficial não é instalada.
