-- Testes da prestação de contas simples (supabase/prestacao/01_prestacao_simples.sql)
\set QUIET on
set client_min_messages = notice;
create schema if not exists teste;
grant usage on schema teste to anon, authenticated;

create or replace function teste.como(p_id uuid) returns void language plpgsql as $$
begin
  if p_id is null then perform set_config('request.jwt.claims', '{}', false); execute 'set role anon';
  else perform set_config('request.jwt.claims', json_build_object('sub', p_id)::text, false); execute 'set role authenticated'; end if;
end $$;
create or replace function teste.deve_falhar(p_sql text, p_trecho text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if position(lower(p_trecho) in lower(sqlerrm)) = 0 then
      raise exception 'Mensagem inesperada. Esperado "%", obtido "%". SQL: %', p_trecho, sqlerrm, p_sql; end if;
    return;
  end;
  raise exception 'Deveria ter falhado ("%"): %', p_trecho, p_sql;
end $$;
create or replace function teste.igual(p_obtido anyelement, p_esperado anyelement, p_desc text) returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then raise exception 'FALHA [%]: esperado %, obtido %', p_desc, p_esperado, p_obtido; end if;
  raise notice 'ok - %', p_desc;
end $$;
grant execute on all functions in schema teste to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pc-admin@teste'),
  ('00000000-0000-0000-0000-0000000000b1', 'pc-comum@teste');

-- ---------------------------------------------------------------- administradores
select teste.deve_falhar($$select public.pc_tornar_admin('naoexiste@teste')$$, 'Não encontrei');
select public.pc_tornar_admin('PC-Admin@teste');
select teste.igual((select count(*)::int from public.pc_admins), 1, 'administrador cadastrado pelo dono (ignora maiúsculas)');

select teste.como('00000000-0000-0000-0000-0000000000b1');
select teste.deve_falhar($$select public.pc_tornar_admin('pc-comum@teste')$$, 'permission denied');
select teste.igual(public.pc_eh_admin(), false, 'usuário comum não é admin');
select teste.igual((select count(*)::int from public.pc_admins), 0, 'usuário comum não vê a lista de admins');

-- ---------------------------------------------------------------- escrita só para admin
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('entrada', '2026-01-10', 10, 'Doações via PIX', 'tentativa')$$, 'row-level security');
select teste.como(null);
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('entrada', '2026-01-10', 10, 'Doações via PIX', 'tentativa')$$, 'permission denied');
select teste.deve_falhar($$select * from public.pc_lancamentos$$, 'permission denied');
select teste.deve_falhar($$select * from public.pc_historico$$, 'permission denied');

select teste.como('00000000-0000-0000-0000-0000000000a1');
insert into public.pc_lancamentos (id, tipo, data, valor, categoria, descricao, contraparte, mostrar_contraparte, publicar, anexos, observacao_interna) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'entrada', '2026-01-10', 1250.50, 'Doações via PIX', 'Doações de janeiro', 'Campanha de verão', true, true,
   '[{"path":"2026/01/a.jpg","publico":true,"nome":"a.jpg","tipo":"image/jpeg"},{"path":"2026/01/b.jpg","publico":false,"nome":"b.jpg","tipo":"image/jpeg"}]', 'conversar com a diretoria'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'saida', '2026-01-15', 300, 'Alimentação', 'Lanche do treino', 'Padaria do Zé', false, true, '[]', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'saida', '2026-01-20', 80, 'Transporte', 'Rascunho só da equipe', null, false, false, '[]', 'ainda sem nota');
select teste.igual((select count(*)::int from public.pc_lancamentos), 3, 'admin grava e lê tudo');
select teste.igual(public.pc_eh_admin(), true, 'admin reconhecido');

-- ---------------------------------------------------------------- validações
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('entrada', '2026-01-10', 0, 'Doações via PIX', 'zero')$$, 'check');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('entrada', '2026-01-10', -5, 'Doações via PIX', 'negativo')$$, 'check');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('troca', '2026-01-10', 5, 'Doações via PIX', 'tipo ruim')$$, 'check');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao) values ('entrada', '2026-01-10', 5, 'Doações via PIX', 'a')$$, 'check');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao, anexos) values ('entrada', '2026-01-10', 5, 'X1', 'anexo sem path', '[{"publico":true}]')$$, 'Anexo inválido');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao, anexos) values ('entrada', '2026-01-10', 5, 'X1', 'path perigoso', '[{"path":"../x","publico":true}]')$$, 'Anexo inválido');
select teste.deve_falhar($$insert into public.pc_lancamentos (tipo, data, valor, categoria, descricao, anexos) values ('entrada', '2026-01-10', 5, 'X1', 'muitos anexos', '[{"path":"a","publico":true},{"path":"b","publico":true},{"path":"c","publico":true},{"path":"d","publico":true},{"path":"e","publico":true},{"path":"f","publico":true},{"path":"g","publico":true}]')$$, 'check');

-- ---------------------------------------------------------------- o que o público vê
select teste.como(null);
select teste.igual((select count(*)::int from public.pc_publico), 2, 'público vê só o que está marcado para publicar');
select teste.igual((select contraparte from public.pc_publico where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Campanha de verão', 'nome aparece quando autorizado');
select teste.igual((select contraparte from public.pc_publico where id = 'aaaaaaaa-0000-0000-0000-000000000002'), null::text, 'nome fica oculto quando não autorizado');
select teste.igual((select jsonb_array_length(anexos) from public.pc_publico where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'só a foto pública aparece');
select teste.igual((select anexos -> 0 ->> 'path' from public.pc_publico where id = 'aaaaaaaa-0000-0000-0000-000000000001'), '2026/01/a.jpg', 'foto pública correta');
select teste.deve_falhar($$select observacao_interna from public.pc_publico$$, 'column');
select teste.igual((select sum(valor) from public.pc_publico where tipo = 'saida'), 300.00::numeric, 'rascunho escondido não entra nas somas públicas');

-- ---------------------------------------------------------------- edição, histórico e exclusão
select teste.como('00000000-0000-0000-0000-0000000000a1');
update public.pc_lancamentos set valor = 310 where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.pc_lancamentos set publicar = true where id = 'aaaaaaaa-0000-0000-0000-000000000003';
delete from public.pc_lancamentos where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select teste.igual((select count(*)::int from public.pc_historico where lancamento_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 2, 'criação e alteração registradas');
select teste.igual((select count(*)::int from public.pc_historico where lancamento_id = 'aaaaaaaa-0000-0000-0000-000000000003' and acao = 'exclusao'), 1, 'exclusão registrada (com os dados antigos)');
select teste.igual((select usuario_email from public.pc_historico where acao = 'criacao' limit 1), 'pc-admin@teste', 'histórico guarda quem fez');
select teste.deve_falhar($$update public.pc_historico set acao = 'x'$$, 'permission denied');
select teste.deve_falhar($$delete from public.pc_historico$$, 'permission denied');
reset role;
select teste.deve_falhar($$delete from public.pc_historico$$, 'não pode ser alterado');
select teste.deve_falhar($$truncate public.pc_historico$$, 'não pode ser alterado');
select teste.como('00000000-0000-0000-0000-0000000000b1');
select teste.igual((select count(*)::int from public.pc_historico), 0, 'usuário comum não lê o histórico');

-- ---------------------------------------------------------------- fotos
reset role;
select teste.igual((select public from storage.buckets where id = 'prestacao-publica'), true, 'depósito público marcado como público');
select teste.igual((select public from storage.buckets where id = 'prestacao-privada'), false, 'depósito privado marcado como privado');
select teste.igual((select file_size_limit from storage.buckets where id = 'prestacao-privada'), 5242880::bigint, 'limite de 5 MB');
select teste.como('00000000-0000-0000-0000-0000000000a1');
insert into storage.objects (bucket_id, name) values ('prestacao-publica', '2026/01/a.jpg'), ('prestacao-privada', '2026/01/b.jpg');
select teste.igual((select count(*)::int from storage.objects where bucket_id like 'prestacao%'), 2, 'admin envia e lista fotos');
delete from storage.objects where name = '2026/01/b.jpg';
select teste.igual((select count(*)::int from storage.objects where bucket_id like 'prestacao%'), 1, 'admin apaga fotos');
select teste.como('00000000-0000-0000-0000-0000000000b1');
select teste.deve_falhar($$insert into storage.objects (bucket_id, name) values ('prestacao-publica', 'x.jpg')$$, 'row-level security');
select teste.igual((select count(*)::int from storage.objects where bucket_id like 'prestacao%'), 0, 'usuário comum não lista fotos');
select teste.como(null);
select teste.deve_falhar($$insert into storage.objects (bucket_id, name) values ('prestacao-privada', 'x.jpg')$$, 'row-level security');
select teste.igual((select count(*)::int from storage.objects where bucket_id like 'prestacao%'), 0, 'anônimo não lista fotos');

reset role;
\echo '✔ Prestação de contas: todos os testes passaram.'

-- =====================================================================
-- PARTE 2: configurações do site, equipe, saúde e ping
-- =====================================================================
\set QUIET on
-- ---------------------------------------------------------------- configurações do site
select teste.como(null);
select teste.igual((select count(*)::int from public.pc_site), 1, 'visitante lê as configurações públicas do site');
select teste.deve_falhar($$update public.pc_site set valor = '{"pix_chave":"x"}'$$, 'permission denied');
select teste.como('00000000-0000-0000-0000-0000000000b1');
update public.pc_site set valor = '{"pix_chave":"x"}';
select teste.igual((select valor ->> 'pix_chave' from public.pc_site), null::text, 'usuário comum não altera o site (RLS)');
select teste.como('00000000-0000-0000-0000-0000000000a1');
update public.pc_site set valor = '{"pix_chave":"11222333000181","pix_tipo":"CNPJ","pix_nome":"Projeto Pe no Chao","whatsapp":"(15) 99999-1234","instagram":"@projetopenochao","email":"contato@exemplo.org","campanha_meta":"5000","campanha_arrecadado":1800.5,"necessidades":[{"titulo":"Leite em pó","prioridade":"alta"},{"titulo":"Bolas","descricao":"Para o treino","prioridade":"media"}]}';
select teste.igual((select valor ->> 'pix_chave' from public.pc_site), '11222333000181', 'admin salva configurações do site');
select teste.igual((select jsonb_array_length(valor -> 'necessidades') from public.pc_site), 2, 'lista de necessidades salva');
select teste.igual((select atualizado_por from public.pc_site), '00000000-0000-0000-0000-0000000000a1'::uuid, 'guarda quem alterou');
select teste.deve_falhar($$update public.pc_site set valor = '{"campo_inventado":"x"}'$$, 'Campo não permitido');
select teste.deve_falhar($$update public.pc_site set valor = '{"whatsapp":"abc"}'$$, 'WhatsApp inválido');
select teste.deve_falhar($$update public.pc_site set valor = '{"instagram":"https://x.com/a"}'$$, 'Instagram inválido');
select teste.deve_falhar($$update public.pc_site set valor = '{"email":"semarroba"}'$$, 'E-mail inválido');
select teste.deve_falhar($$update public.pc_site set valor = '{"pix_tipo":"Cartão"}'$$, 'Tipo de chave');
select teste.deve_falhar($$update public.pc_site set valor = '{"campanha_meta":"-5"}'$$, 'Valor da campanha');
select teste.deve_falhar($$update public.pc_site set valor = '{"campanha_meta":"abc"}'$$, 'Valor da campanha');
select teste.deve_falhar($$update public.pc_site set valor = jsonb_build_object('texto_sobre', repeat('a', 4001))$$, 'longo demais');
select teste.deve_falhar($$update public.pc_site set valor = '{"necessidades":[{"titulo":"x"}]}'$$, 'Item inválido');
select teste.deve_falhar($$update public.pc_site set valor = '{"necessidades":[{"titulo":"Item válido","prioridade":"urgentíssima"}]}'$$, 'Item inválido');
select teste.deve_falhar($$update public.pc_site set valor = (select jsonb_build_object('necessidades', jsonb_agg(jsonb_build_object('titulo', 'Item ' || g))) from generate_series(1, 31) g)$$, 'até 30');
select teste.deve_falhar($$update public.pc_site set valor = '[]'$$, 'inválida');
select teste.deve_falhar($$delete from public.pc_site$$, 'permission denied');
select teste.igual((select count(*)::int from public.pc_historico where acao = 'site'), 1, 'mudança do site registrada no histórico');
select teste.como(null);
select teste.igual((select valor -> 'necessidades' -> 0 ->> 'titulo' from public.pc_site), 'Leite em pó', 'visitante enxerga o que o admin salvou');

-- ---------------------------------------------------------------- equipe
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'nova-pessoa@teste');
select teste.como('00000000-0000-0000-0000-0000000000b1');
select teste.deve_falhar($$select public.pc_adicionar_admin('nova-pessoa@teste')$$, 'Apenas administradores');
select teste.como(null);
select teste.deve_falhar($$select public.pc_adicionar_admin('nova-pessoa@teste')$$, 'permission denied');
select teste.como('00000000-0000-0000-0000-0000000000a1');
select teste.deve_falhar($$select public.pc_adicionar_admin('ninguem@teste')$$, 'Não encontrei');
select public.pc_adicionar_admin('Nova-Pessoa@teste');
select teste.igual((select count(*)::int from public.pc_admins), 2, 'admin dá acesso a outra pessoa');
select teste.como('00000000-0000-0000-0000-0000000000c1');
select teste.igual(public.pc_eh_admin(), true, 'pessoa nova passa a ser admin');
select public.pc_retirar_admin('pc-admin@teste');
select teste.como('00000000-0000-0000-0000-0000000000a1');
select teste.igual(public.pc_eh_admin(), false, 'acesso retirado vale na hora');
select teste.como('00000000-0000-0000-0000-0000000000c1');
select teste.deve_falhar($$select public.pc_retirar_admin('nova-pessoa@teste')$$, 'próprio acesso');
select teste.deve_falhar($$select public.pc_retirar_admin('visitante@teste')$$, 'não é administrador');
select public.pc_adicionar_admin('pc-admin@teste');
select teste.igual((select count(*)::int from public.pc_admins), 2, 'acesso devolvido');

-- ---------------------------------------------------------------- saúde e ping
select teste.como(null);
select teste.deve_falhar($$select public.pc_saude()$$, 'permission denied');
select teste.deve_falhar($$select * from public.pc_atividade$$, 'permission denied');
select teste.como('00000000-0000-0000-0000-0000000000b1');
select teste.deve_falhar($$select public.pc_saude()$$, 'Apenas administradores');
select teste.como(null);
select public.pc_ping();
select teste.como('00000000-0000-0000-0000-0000000000a1');
select teste.igual((public.pc_saude() ->> 'total_pings')::int, 1, 'ping do robô conta como atividade (visitante anônimo pode chamar)');
select teste.igual((public.pc_saude() ->> 'ultimo_ping') is not null, true, 'saúde mostra o último ping');
select teste.como(null);
select public.pc_ping();
select teste.como('00000000-0000-0000-0000-0000000000a1');
select teste.igual((public.pc_saude() ->> 'total_pings')::int, 1, 'ping repetido em menos de 1 minuto não infla o contador');
select teste.igual((public.pc_saude() ->> 'lancamentos')::int, 2, 'saúde conta os lançamentos');
select teste.igual((public.pc_saude() ->> 'administradores')::int, 2, 'saúde conta os administradores');
reset role;
update public.pc_atividade set ultimo_ping = now() - interval '2 days';
select teste.como(null);
select public.pc_ping();
select teste.como('00000000-0000-0000-0000-0000000000a1');
select teste.igual((public.pc_saude() ->> 'total_pings')::int, 2, 'passado 1 minuto, o ping volta a contar');
reset role;
\echo '✔ Prestação de contas (parte 2): todos os testes passaram.'
