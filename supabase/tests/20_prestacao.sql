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
