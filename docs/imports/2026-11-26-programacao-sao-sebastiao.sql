-- Importação editorial autorizada: imagens recebidas em 26/11/2026.
-- Executar no banco de produção correto, depois de verificar os candidatos a duplicidade.
-- Não altera ou exclui registros existentes. Horários locais de São Paulo.
BEGIN;
WITH incoming(manual_key,title,category,event_date,location,full_description) AS (
 VALUES
  ('manual-2026-11-sao-sebastiao-entre', 'Espetáculo Entre', 'Dança', '2026-11-26 19:30-03'::timestamptz, 'Teatro Municipal', '19h30 — Apresentação do Corpo Estável de Dança com participação de oito grupos convidados.
20h30 — Sessão extra com apresentação exclusiva do Corpo Estável de Dança.'),
  ('manual-2026-11-sao-sebastiao-as-brabas', 'Música na Janela — Banda As Brabas', 'Música', '2026-11-27 20:00-03'::timestamptz, 'Casa da Música', 'Apresentação da Banda As Brabas às 20h.'),
  ('manual-2026-11-sao-sebastiao-vem-pro-centro', 'Vem Pro Centro', 'Cultura Popular', '2026-11-28 10:00-03'::timestamptz, 'Centro', 'Programação anunciada das 10h às 17h. Algumas atrações têm horário de encerramento posterior, conforme a publicação original.
10h às 12h — DJ Lost.
12h às 14h — Daniel Navarro.
12h às 16h — Intervenção artística itinerante Duo Palhaçal 100sacional, com Flechada na Lua.
14h às 18h — Intervenção artística itinerante Homem Aranha e Gwen Aranha.
14h às 15h30 — Dixieland Folia.
15h30 às 17h30 — DJ Riva DeciBéis.
10h às 16h — Pipoca, algodão doce e brinquedos infláveis.
10h às 14h — Jogos de Antigamente com Cia o Castelo das Artes.
10h30 às 12h — Claudinho Milito.
12h às 16h — KKKarica, caricaturas temáticas com Akemy Hayashi.
13h às 14h30 — Kombirutas Duo.
13h às 15h — Oficina de Aquarela com Patrícia Barbuscia.
14h às 17h30 — Intervenção Pintura Artística com Houston Charles — Cia Brincantes.
15h às 16h30 — Banda Marcelo Zaffani.'),
  ('manual-2026-11-sao-sebastiao-cadu-carrasco', 'Cadu Carrasco — Área do Piquenique', 'Música, MPB', '2026-11-28 17:00-03'::timestamptz, 'Área do Piquenique', 'Apresentação de Cadu Carrasco (MPB) às 17h.'),
  ('manual-2026-11-sao-sebastiao-luau-arrastao', 'Luau Arrastão', 'Música', '2026-11-28 19:00-03'::timestamptz, 'Arrastão', '19h — DJ Gee.
21h — Pinguim.'),
  ('manual-2026-11-sao-sebastiao-jantar-para-seis', 'Cinema Pontos MIS — Jantar para Seis', 'Cinema', '2026-11-28 19:30-03'::timestamptz, NULL, 'Exibição de Jantar para Seis, às 19h30. Local não informado na imagem.'),
  ('manual-2026-11-sao-sebastiao-rallyson-salles', 'Música na Praça do Surf — Rallyson Salles', 'Música, MPB', '2026-11-28 20:00-03'::timestamptz, 'Praça do Surf — Maresias', 'Apresentação de Rallyson Salles (MPB) às 20h.'),
  ('manual-2026-11-sao-sebastiao-luah-alves', 'Música na Praça Pôr do Sol — Luah Alves', 'Música, Sertanejo', '2026-11-28 20:00-03'::timestamptz, 'Praça Pôr do Sol — Boiçucanga', 'Apresentação de Luah Alves (sertanejo) às 20h.'),
  ('manual-2026-11-sao-sebastiao-casinha-caicara', 'Casinha Caiçara — Culinária e Artesanato', 'Cultura Popular, Oficina', '2026-11-29 14:00-03'::timestamptz, 'Casinha Caiçara', '14h às 18h — Culinária Caiçara com Angélica Souza.
15h — Oficina de Artesanato Identitário com Tiago Fortunato.'),
  ('manual-2026-11-sao-sebastiao-boranda', 'Borandá: Auto do Migrante', 'Teatro', '2026-11-29 18:00-03'::timestamptz, 'Teatro Municipal', 'Apresentação do Corpo Estável de Teatro às 18h.')
)
INSERT INTO public.interpreted_contents (
 title,category,summary,full_description,event_date,location,city,price,keywords,
 extracted_data,missing_fields,warnings,confidence_score,model_used,prompt_version,review_status,reviewed_at
)
SELECT title,category,split_part(full_description,E'\n',1),full_description,event_date,location,'São Sebastião',NULL,
 ARRAY[]::text[],
 jsonb_build_object('manualImportKey',manual_key,'source','manual-image-import','submittedAt','2026-11-26'),
 CASE WHEN location IS NULL THEN ARRAY['location','price']::text[] ELSE ARRAY['price']::text[] END,
 ARRAY[]::text[],0.95,'manual-visual-review','manual-import-v1','publicado',now()
FROM incoming i
WHERE NOT EXISTS (
 SELECT 1 FROM public.interpreted_contents e
 WHERE e.extracted_data->>'manualImportKey'=i.manual_key
 OR (lower(trim(e.title))=lower(trim(i.title)) AND (e.event_date AT TIME ZONE 'America/Sao_Paulo')::date=(i.event_date AT TIME ZONE 'America/Sao_Paulo')::date AND lower(trim(coalesce(e.city,'')))=lower('São Sebastião'))
)
RETURNING id,title,event_date,review_status;
COMMIT;
