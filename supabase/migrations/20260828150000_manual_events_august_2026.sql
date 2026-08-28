-- Importação editorial dos cartazes recebidos em 28/08/2026.
-- Os registros usam uma chave estável para que a migração seja idempotente.

with manual_events (
  manual_key,
  title,
  category,
  summary,
  full_description,
  event_date,
  location,
  city,
  price,
  contact_name,
  contact_phone,
  contact_instagram,
  keywords,
  image_url,
  warnings
) as (
  values
    (
      'manual-2026-08-noite-forrozeira-quintal',
      'Noite Forrozeira no Quintal',
      'Música, Forró',
      'Noite de forró com Circulado de Fulô, Xiboca e Garibald, celebrando o aniversário do Doril.',
      'O Quintal recebe uma noite forrozeira com o ex-vocal do Circulado de Fulô, Xiboca e Garibald. O encontro também celebra o aniversário do Doril.',
      '2026-08-30 22:00:00+00'::timestamptz,
      'O Quintal — Av. dos Ipês, 655, Cidade Jardim',
      'Caraguatatuba',
      'R$ 30,00',
      'O Quintal',
      '(12) 99219-1001',
      null,
      array['forró', 'Circulado de Fulô', 'Xiboca', 'Garibald'],
      '/images/events/manual-2026-08/noite-forrozeira.webp',
      array[]::text[]
    ),
    (
      'manual-2026-09-reggae-independencia-05',
      '3º Reggae da Independência — sábado',
      'Música, Reggae',
      'Festival gratuito de reggae com bandas locais, intercâmbio cultural, arrecadação solidária e ação ambiental.',
      'Primeiro dia do 3º Reggae da Independência, na Praia do Camaroeiro. O evento reúne bandas locais e convidadas de São Paulo, arrecada 1 kg de alimento não perecível ou itens de higiene e limpeza e promove uma ação de limpeza da praia.',
      '2026-09-05 14:00:00+00'::timestamptz,
      'Praia do Camaroeiro',
      'Caraguatatuba',
      'Gratuito — doação solidária sugerida',
      'Associação ACURA',
      null,
      '@acura.associacao',
      array['reggae', 'solidariedade', 'meio ambiente', 'Praia do Camaroeiro'],
      '/images/events/manual-2026-08/reggae-independencia.webp',
      array['O cartaz informa 10h; a legenda informa programação das 11h às 23h. Foi utilizado o horário detalhado da legenda.']
    ),
    (
      'manual-2026-09-reggae-independencia-06',
      '3º Reggae da Independência — domingo',
      'Música, Reggae',
      'Segundo dia do festival gratuito de reggae, com arrecadação solidária e ação ambiental.',
      'Segundo dia do 3º Reggae da Independência, na Praia do Camaroeiro. O evento reúne bandas locais e convidadas de São Paulo, arrecada 1 kg de alimento não perecível ou itens de higiene e limpeza e promove uma ação de limpeza da praia.',
      '2026-09-06 14:00:00+00'::timestamptz,
      'Praia do Camaroeiro',
      'Caraguatatuba',
      'Gratuito — doação solidária sugerida',
      'Associação ACURA',
      null,
      '@acura.associacao',
      array['reggae', 'solidariedade', 'meio ambiente', 'Praia do Camaroeiro'],
      '/images/events/manual-2026-08/reggae-independencia.webp',
      array['O cartaz informa 10h; a legenda informa programação das 11h às 23h. Foi utilizado o horário detalhado da legenda.']
    ),
    (
      'manual-2026-08-samba-gabriel-tavares-siri-jack',
      'Gabriel Tavares no Siri Jack',
      'Música, Samba',
      'Gabriel Tavares abre a agenda de samba do fim de semana em Caraguatatuba.',
      'Apresentação de Gabriel Tavares no Siri Jack, parte da Agenda do Samba em Caraguá.',
      '2026-08-27 22:00:00+00'::timestamptz,
      'Siri Jack',
      'Caraguatatuba',
      'Não informado',
      'Gabriel Tavares',
      null,
      null,
      array['samba', 'Gabriel Tavares', 'Siri Jack'],
      '/images/events/manual-2026-08/gabriel-tavares.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-gabriel-louzada-escritorio',
      'Gabriel Louzada no Escritório Bar Caraguá',
      'Música, Samba',
      'Show de Gabriel Louzada no Escritório Bar Caraguá.',
      'Apresentação de Gabriel Louzada no Escritório Bar Caraguá, parte da Agenda do Samba em Caraguá.',
      '2026-08-27 23:00:00+00'::timestamptz,
      'Escritório Bar Caraguá — Av. Prestes Maia, 485',
      'Caraguatatuba',
      'Não informado',
      'Gabriel Louzada',
      null,
      '@gablouzadacantor',
      array['samba', 'Gabriel Louzada', 'Escritório Bar Caraguá'],
      '/images/events/manual-2026-08/gabriel-louzada.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-us-karas-fenix',
      'Us Karas na Fênix Conveniência',
      'Música, Samba',
      'Show do grupo Us Karas na Fênix Conveniência.',
      'Apresentação do grupo Us Karas na Fênix Conveniência, parte da Agenda do Samba em Caraguá.',
      '2026-08-27 23:00:00+00'::timestamptz,
      'Fênix Conveniência',
      'Caraguatatuba',
      'Não informado',
      'Us Karas',
      null,
      null,
      array['samba', 'Us Karas', 'Fênix Conveniência'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-simplicidade-buteco-28',
      'Simplicidade S/A no Buteco do Porto',
      'Música, Samba',
      'Simplicidade S/A se apresenta no Buteco do Porto.',
      'Apresentação do grupo Simplicidade S/A no Buteco do Porto, parte da Agenda do Samba em Caraguá.',
      '2026-08-28 22:00:00+00'::timestamptz,
      'Buteco do Porto',
      'Caraguatatuba',
      'Não informado',
      'Simplicidade S/A',
      null,
      null,
      array['samba', 'Simplicidade S/A', 'Buteco do Porto'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-encrespou-clube-bola',
      'Grupo Encrespou no Clube da Bola Caraguá',
      'Música, Samba',
      'O Grupo Encrespou se apresenta no Clube da Bola Caraguá.',
      'Apresentação do Grupo Encrespou no Clube da Bola Caraguá, parte da Agenda do Samba em Caraguá.',
      '2026-08-29 16:00:00+00'::timestamptz,
      'Clube da Bola Caraguá',
      'Caraguatatuba',
      'Não informado',
      'Grupo Encrespou',
      null,
      null,
      array['samba', 'Grupo Encrespou', 'Clube da Bola Caraguá'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-lua-rodrigo-bar-helio',
      'Lua e Rodrigo no Bar do Hélio',
      'Música, Samba',
      'Lua e Rodrigo se apresentam no Bar do Hélio.',
      'Apresentação de Lua e Rodrigo no Bar do Hélio, parte da Agenda do Samba em Caraguá.',
      '2026-08-29 18:00:00+00'::timestamptz,
      'Bar do Hélio',
      'Caraguatatuba',
      'Não informado',
      'Lua e Rodrigo',
      null,
      null,
      array['samba', 'Lua e Rodrigo', 'Bar do Hélio'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-frequencia-siri-jack',
      'Grupo Frequência no Siri Jack',
      'Música, Samba',
      'O Grupo Frequência se apresenta no Siri Jack.',
      'Apresentação do Grupo Frequência no Siri Jack, parte da Agenda do Samba em Caraguá.',
      '2026-08-29 23:00:00+00'::timestamptz,
      'Siri Jack',
      'Caraguatatuba',
      'Não informado',
      'Grupo Frequência',
      null,
      null,
      array['samba', 'Grupo Frequência', 'Siri Jack'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-simplicidade-sr-oliver',
      'Simplicidade S/A no Sr. Oliver',
      'Música, Samba',
      'Simplicidade S/A se apresenta no Sr. Oliver.',
      'Apresentação do grupo Simplicidade S/A no Sr. Oliver, parte da Agenda do Samba em Caraguá.',
      '2026-08-30 00:00:00+00'::timestamptz,
      'Sr. Oliver',
      'Caraguatatuba',
      'Não informado',
      'Simplicidade S/A',
      null,
      null,
      array['samba', 'Simplicidade S/A', 'Sr. Oliver'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-samba5-buteco-30',
      'Samba 5 no Buteco do Porto',
      'Música, Samba',
      'O grupo Samba 5 se apresenta no Buteco do Porto.',
      'Apresentação do grupo Samba 5 no Buteco do Porto, parte da Agenda do Samba em Caraguá.',
      '2026-08-30 22:00:00+00'::timestamptz,
      'Buteco do Porto',
      'Caraguatatuba',
      'Não informado',
      'Samba 5',
      null,
      null,
      array['samba', 'Samba 5', 'Buteco do Porto'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-samba5-sol-cia-29',
      'Samba 5 no Quiosque Sol & Cia — sábado',
      'Música, Samba',
      'Roda de samba com o grupo Samba 5 no Quiosque Sol & Cia.',
      'Apresentação recorrente do grupo Samba 5 aos sábados, domingos e feriados no Quiosque Sol & Cia. Esta publicação corresponde ao sábado, 29 de agosto.',
      '2026-08-29 15:30:00+00'::timestamptz,
      'Quiosque Sol & Cia',
      'Caraguatatuba',
      'Não informado',
      'Samba 5',
      null,
      null,
      array['samba', 'Samba 5', 'Quiosque Sol & Cia'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-08-samba-samba5-sol-cia-30',
      'Samba 5 no Quiosque Sol & Cia — domingo',
      'Música, Samba',
      'Roda de samba com o grupo Samba 5 no Quiosque Sol & Cia.',
      'Apresentação recorrente do grupo Samba 5 aos sábados, domingos e feriados no Quiosque Sol & Cia. Esta publicação corresponde ao domingo, 30 de agosto.',
      '2026-08-30 15:30:00+00'::timestamptz,
      'Quiosque Sol & Cia',
      'Caraguatatuba',
      'Não informado',
      'Samba 5',
      null,
      null,
      array['samba', 'Samba 5', 'Quiosque Sol & Cia'],
      null,
      array[]::text[]
    ),
    (
      'manual-2026-09-caca-talento-mojuba-02',
      'Caça Talento Mojubá — ensaio aberto',
      'Música, Dança',
      'Ensaio gratuito de canto, percussão e dança para participantes a partir de 14 anos.',
      'Ensaio do Caça Talento Mojubá para o 1º Festival Mojubá, previsto para novembro de 2026. A atividade trabalha samba, MPB, jazz, soul, axé, ponto cantado, Umbanda e Candomblé, além de percussão e dança. Os encontros acontecem às quartas-feiras.',
      '2026-09-02 21:30:00+00'::timestamptz,
      'Canto do Encanto — Av. José Herculano, 7109, Travessão',
      'Caraguatatuba',
      'Gratuito',
      'Canto do Encanto Oxi',
      '(12) 99775-6040',
      '@cantodoencantooxi',
      array['Mojubá', 'canto', 'percussão', 'dança', 'ensaio'],
      '/images/events/manual-2026-08/caca-talento-mojuba.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-forro-quarta-casarao',
      'Forró de Quarta com Trio Praiano e DJ Bitelo',
      'Música, Forró',
      'Forró de quarta com Trio Praiano e DJ Bitelo no Casarão Chopperia.',
      'Noite de forró com Trio Praiano — Forró Pé de Serra — e DJ Bitelo no Casarão Chopperia.',
      '2026-08-27 00:00:00+00'::timestamptz,
      'Casarão Chopperia — Av. Manoel Henrique de Oliveira, 1810',
      'Caraguatatuba',
      'R$ 15,00',
      'Casarão Chopperia',
      null,
      null,
      array['forró', 'Trio Praiano', 'DJ Bitelo', 'Casarão Chopperia'],
      '/images/events/manual-2026-08/forro-de-quarta.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-troca-sementes-mudas',
      'Troca de Sementes e Mudas Tradicionais',
      'Feira, Cultura Popular',
      'Troca gratuita de sementes e mudas durante feira de culinária, agroecologia e cultura regional.',
      'Encontro de troca de sementes e mudas tradicionais integrado à Feira de Empreendedoras, com culinária, agroecologia e cultura do Litoral Norte e Vale do Paraíba.',
      '2026-08-29 18:30:00+00'::timestamptz,
      'Biblioteca Municipal de São Sebastião — Rua Manoel Rufino, 15, Centro Histórico',
      'São Sebastião',
      'Gratuito',
      'Cozinha Itinerante',
      null,
      null,
      array['sementes', 'mudas', 'agroecologia', 'feira', 'cultura'],
      '/images/events/manual-2026-08/troca-sementes-mudas.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-kayla-makena-maresias',
      'Kayla Makena e Crias do Kemet',
      'Música, Reggae',
      'Apresentação de Kayla Makena e banda Crias do Kemet na Praça do Surf, em Maresias.',
      'Show de Kayla Makena e da banda Crias do Kemet, unindo reggae, resistência e ancestralidade na Praça do Surf.',
      '2026-08-29 23:00:00+00'::timestamptz,
      'Praça do Surf — Maresias',
      'São Sebastião',
      'Não informado',
      'Kayla Makena e Crias do Kemet',
      null,
      '@kayla_makenaa',
      array['reggae', 'Kayla Makena', 'Crias do Kemet', 'Maresias'],
      '/images/events/manual-2026-08/kayla-makena.webp',
      array[]::text[]
    ),
    (
      'manual-2026-08-raizes-movimento',
      'Raízes em Movimento',
      'Cultura Popular',
      'Apresentações culturais, roda de samba e exposição artística com entrada gratuita.',
      'Encontro para conhecer o projeto Raízes em Movimento e prestigiar a cultura popular, com apresentações culturais, roda de samba e exposição artística.',
      '2026-08-30 15:00:00+00'::timestamptz,
      'Espaço Cultural Casa da Democracia — Rua Rodrigues Alves, 123, Jardim Aruan',
      'Caraguatatuba',
      'Gratuito',
      'Raízes em Movimento',
      null,
      null,
      array['cultura popular', 'samba', 'exposição', 'Raízes em Movimento'],
      '/images/events/manual-2026-08/raizes-em-movimento.webp',
      array[]::text[]
    ),
    (
      'manual-2026-09-pratica-livre-forro-02',
      'Prática Livre de Forró com Anny Karoline',
      'Dança, Forró',
      'Prática livre e gratuita de forró, aberta também a quem não participa das turmas.',
      'Encontro semanal de prática livre de forró com Anny Karoline, aberto e gratuito para todos. A atividade acontece às quartas-feiras, depois das aulas em turma.',
      '2026-09-02 23:45:00+00'::timestamptz,
      'Martin de Sá',
      'Caraguatatuba',
      'Gratuito',
      'Anny Karoline',
      '(11) 97990-2506',
      '@forro.com.anny',
      array['forró', 'dança', 'prática livre', 'Anny Karoline', 'Martin de Sá'],
      '/images/events/manual-2026-08/pratica-livre-forro.webp',
      array[]::text[]
    )
)
insert into public.interpreted_contents (
  title,
  category,
  summary,
  full_description,
  event_date,
  location,
  city,
  price,
  contact_name,
  contact_phone,
  contact_instagram,
  keywords,
  image_url,
  extracted_data,
  missing_fields,
  warnings,
  confidence_score,
  model_used,
  prompt_version,
  review_status,
  reviewed_at
)
select
  event.title,
  event.category,
  event.summary,
  event.full_description,
  event.event_date,
  event.location,
  event.city,
  event.price,
  event.contact_name,
  event.contact_phone,
  event.contact_instagram,
  event.keywords,
  event.image_url,
  jsonb_build_object(
    'manualImportKey', event.manual_key,
    'source', 'manual-image-import',
    'submittedAt', '2026-08-28T00:00:00Z'
  ),
  array[]::text[],
  event.warnings,
  1,
  'codex-visual-review',
  'manual-import-v1',
  'publicado',
  now()
from manual_events event
where not exists (
  select 1
  from public.interpreted_contents existing
  where existing.extracted_data ->> 'manualImportKey' = event.manual_key
);

-- Enriquece registros já publicados identificados como o mesmo evento.
update public.interpreted_contents
set
  location = 'Centro Comunitário do Pegorelli “Wilson Schmidt Cardoso”',
  full_description = 'Evento dedicado ao patrimônio, à arte e aos ofícios da cultura popular, com puxada de rede, oficina de capoeira, brincadeiras tradicionais, oficina de pipa, Caixa de Saberes e o Teatro Mamulengo “O que cê traz de bom?”. Programação sujeita a alteração.',
  image_url = '/images/events/manual-2026-08/folclore-em-festa.webp',
  updated_at = now()
where id = '9bbac646-320d-48f2-9271-24ede6450d14';

update public.interpreted_contents
set
  price = 'Gratuito',
  contact_name = 'Canto do Encanto Oxi',
  contact_phone = '(12) 99775-6040',
  contact_instagram = '@cantodoencantooxi',
  full_description = 'Ensaio gratuito do Caça Talento Mojubá para participantes a partir de 14 anos, com canto, percussão e dança. Os encontros acontecem às quartas-feiras, das 18h30 às 21h, em preparação para o 1º Festival Mojubá, previsto para novembro de 2026.',
  image_url = '/images/events/manual-2026-08/caca-talento-mojuba.webp',
  updated_at = now()
where id = '43eeecf1-020d-4c5b-90b8-46e521fb7a7f';

update public.interpreted_contents
set
  price = 'Gratuito',
  contact_name = 'Anny Karoline',
  contact_phone = '(11) 97990-2506',
  contact_instagram = '@forro.com.anny',
  full_description = 'Prática livre e gratuita de forró com Anny Karoline, aberta também a quem não é aluno. Acontece às quartas-feiras, das 20h45 às 21h45, em Martin de Sá.',
  image_url = '/images/events/manual-2026-08/pratica-livre-forro.webp',
  updated_at = now()
where id = 'ec2dbdbd-5249-4adc-b989-ba4bec6a3d83';

update public.interpreted_contents
set
  full_description = 'Programação do 6º Sarau Ancestral com roda de capoeira e musicalidade, abertura oficial, poesia, Berimbacústico, Maculelê, samba de roda e abertura da Maleta Ancestral. Atividades a partir das 19h no Instituto Capoeira Lobo Guará, em Cambury.',
  image_url = '/images/events/manual-2026-08/sarau-ancestral.webp',
  updated_at = now()
where id = '45a90cee-3e1c-4b31-820c-9b6f0cd1222f';

update public.interpreted_contents
set
  full_description = 'Programação de bandas locais no Varanda Musical Paúba: abertura da casa às 18h; Pablo Porfírio às 19h; Caraúna convida Fiona da Rabeca às 20h30; Naiah e o Forró Encantado às 22h. Entrada gratuita com acesso pela praia; comidas e bebidas à venda, cooler liberado e cadeiras de praia bem-vindas.',
  image_url = '/images/events/manual-2026-08/varanda-musical-pauba.webp',
  updated_at = now()
where id = '1eb761a7-ff1b-4b38-a7cb-048f40bb42d6';

update public.interpreted_contents
set
  image_url = '/images/events/manual-2026-08/projeto-pretas-citronela.webp',
  full_description = coalesce(full_description, '') || E'\n\nO Projeto das Pretas Ilhabela participa da programação a partir de 28 de agosto.',
  updated_at = now()
where id = '938042c6-27e3-44a2-a60a-b548e10c5a4c';

-- O mesmo Forró no Vinil já estava publicado duas vezes. Mantém o registro
-- proveniente da agenda revisada e desativa a interpretação redundante.
update public.interpreted_contents
set
  title = 'Inimigos do Fim — Forró no Vinil',
  category = 'Música, Forró',
  summary = 'Forró no Vinil com Baile dos Ratos e DJ Carcará no Pitanga.',
  full_description = 'Inimigos do Fim apresenta Forró no Vinil com Baile dos Ratos e DJ Carcará. Com convite: R$ 15 até 20h20 e R$ 25 após esse horário; sem convite: R$ 35.',
  event_date = '2026-08-28 22:30:00+00'::timestamptz,
  location = 'Pitanga — Av. Pedro de Paula Moraes, 544, Saco da Capela',
  city = 'Ilhabela',
  price = 'R$ 15 até 20h20; R$ 25 após; R$ 35 sem convite',
  image_url = '/images/events/manual-2026-08/forro-no-vinil.webp',
  updated_at = now()
where id = 'ec2eabf5-7665-40de-99f4-c59bc9eb524e';

update public.interpreted_contents
set
  review_status = 'desativado',
  warnings = array_append(coalesce(warnings, array[]::text[]), 'Registro desativado por duplicidade com ec2eabf5-7665-40de-99f4-c59bc9eb524e.'),
  updated_at = now()
where id = '4f476704-31e6-449f-a7bd-8962092a1cba';
