-- =====================================================================
-- Prestação de contas SIMPLES — Projeto Pé no Chão
-- Rode este arquivo UMA vez no Supabase: SQL Editor → New query → Run.
-- É independente do sistema administrativo completo (tabelas com prefixo "pc_").
--
-- O que ele cria:
--   * pc_lancamentos  entradas (doações…) e saídas (gastos) com valor, data, categoria
--                     e fotos de comprovantes
--   * pc_publico      o que o SITE PÚBLICO enxerga (sem anotações internas, sem nomes
--                     escondidos e sem fotos marcadas como privadas)
--   * pc_historico    registro automático e imutável de quem criou/alterou/apagou
--   * pc_admins       quem pode lançar dados (você define com pc_tornar_admin)
--   * dois depósitos de fotos: prestacao-publica (aparece no site) e
--     prestacao-privada (só a equipe)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------
create table if not exists public.pc_admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text,
  criado_em timestamptz not null default now()
);

create or replace function public.pc_eh_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.pc_admins where user_id = auth.uid()) $$;

-- Só o dono do projeto (SQL Editor) pode chamar: select public.pc_tornar_admin('email@...');
create or replace function public.pc_tornar_admin(p_email text)
returns text language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Não encontrei o usuário "%". Crie-o antes em Authentication → Users.', p_email;
  end if;
  insert into public.pc_admins (user_id, email) values (v_id, lower(trim(p_email))) on conflict do nothing;
  return 'Pronto: ' || lower(trim(p_email)) || ' agora é administrador(a) da prestação de contas.';
end $$;
revoke execute on function public.pc_tornar_admin(text) from public, anon, authenticated;

create or replace function public.pc_remover_admin(p_email text)
returns text language plpgsql security definer set search_path = public
as $$
begin
  delete from public.pc_admins where lower(email) = lower(trim(p_email));
  return 'Acesso removido de ' || p_email;
end $$;
revoke execute on function public.pc_remover_admin(text) from public, anon, authenticated;

alter table public.pc_admins enable row level security;
drop policy if exists pc_admins_ler on public.pc_admins;
create policy pc_admins_ler on public.pc_admins for select to authenticated using (public.pc_eh_admin());
revoke all on public.pc_admins from anon;
revoke insert, update, delete on public.pc_admins from authenticated;

-- ---------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------
create table if not exists public.pc_lancamentos (
  id                  uuid primary key default gen_random_uuid(),
  tipo                text not null check (tipo in ('entrada', 'saida')),
  data                date not null,
  valor               numeric(12,2) not null check (valor > 0 and valor < 100000000),
  categoria           text not null check (length(trim(categoria)) between 2 and 60),
  descricao           text not null check (length(trim(descricao)) between 3 and 300),
  contraparte         text check (contraparte is null or length(contraparte) <= 120),  -- quem doou / quem recebeu
  mostrar_contraparte boolean not null default false,                                  -- nome só aparece no site se marcado
  publicar            boolean not null default true,                                   -- false = só a equipe vê
  -- fotos/PDFs: [{"path":"2026/10/abc.jpg","publico":true,"nome":"nota.jpg","tipo":"image/jpeg"}]
  anexos              jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 6),
  observacao_interna  text check (observacao_interna is null or length(observacao_interna) <= 1000),
  criado_por          uuid default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists pc_lancamentos_data on public.pc_lancamentos (data desc);

create or replace function public.pc_validar_lancamento()
returns trigger language plpgsql set search_path = public
as $$
declare a jsonb;
begin
  new.categoria := trim(new.categoria);
  new.descricao := trim(new.descricao);
  new.contraparte := nullif(trim(coalesce(new.contraparte, '')), '');
  new.atualizado_em := now();
  for a in select * from jsonb_array_elements(new.anexos) loop
    if jsonb_typeof(a) <> 'object'
       or coalesce(a ->> 'path', '') = '' or (a ->> 'path') ~ '(\.\.|^/)' or length(a ->> 'path') > 200
       or (a ->> 'publico') not in ('true', 'false') then
      raise exception 'Anexo inválido: informe "path" e "publico".';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists pc_lancamentos_validar on public.pc_lancamentos;
create trigger pc_lancamentos_validar before insert or update on public.pc_lancamentos
  for each row execute function public.pc_validar_lancamento();

alter table public.pc_lancamentos enable row level security;
drop policy if exists pc_lancamentos_admin on public.pc_lancamentos;
create policy pc_lancamentos_admin on public.pc_lancamentos for all to authenticated
  using (public.pc_eh_admin()) with check (public.pc_eh_admin());
revoke all on public.pc_lancamentos from anon;

-- ---------------------------------------------------------------------
-- Histórico (somente inserção, automático)
-- ---------------------------------------------------------------------
create table if not exists public.pc_historico (
  id            bigserial primary key,
  lancamento_id uuid not null,
  acao          text not null,
  antes         jsonb,
  depois        jsonb,
  usuario_id    uuid,
  usuario_email text,
  em            timestamptz not null default now()
);
create index if not exists pc_historico_lanc on public.pc_historico (lancamento_id, em desc);

create or replace function public.pc_registrar_historico()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if tg_op = 'DELETE' then
    insert into public.pc_historico (lancamento_id, acao, antes, usuario_id, usuario_email)
    values (old.id, 'exclusao', to_jsonb(old), auth.uid(), v_email);
    return old;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) - 'atualizado_em' = to_jsonb(new) - 'atualizado_em' then return new; end if;
    insert into public.pc_historico (lancamento_id, acao, antes, depois, usuario_id, usuario_email)
    values (new.id, 'alteracao', to_jsonb(old), to_jsonb(new), auth.uid(), v_email);
    return new;
  end if;
  insert into public.pc_historico (lancamento_id, acao, depois, usuario_id, usuario_email)
  values (new.id, 'criacao', to_jsonb(new), auth.uid(), v_email);
  return new;
end $$;
drop trigger if exists pc_lancamentos_historico on public.pc_lancamentos;
create trigger pc_lancamentos_historico after insert or update or delete on public.pc_lancamentos
  for each row execute function public.pc_registrar_historico();

create or replace function public.pc_historico_imutavel()
returns trigger language plpgsql
as $$ begin raise exception 'O histórico não pode ser alterado nem apagado.'; end $$;
drop trigger if exists pc_historico_sem_alterar on public.pc_historico;
create trigger pc_historico_sem_alterar before update or delete on public.pc_historico
  for each row execute function public.pc_historico_imutavel();
drop trigger if exists pc_historico_sem_truncate on public.pc_historico;
create trigger pc_historico_sem_truncate before truncate on public.pc_historico
  for each statement execute function public.pc_historico_imutavel();

alter table public.pc_historico enable row level security;
drop policy if exists pc_historico_ler on public.pc_historico;
create policy pc_historico_ler on public.pc_historico for select to authenticated using (public.pc_eh_admin());
revoke all on public.pc_historico from anon;
revoke insert, update, delete, truncate on public.pc_historico from authenticated;

-- ---------------------------------------------------------------------
-- O que o site público enxerga
-- ---------------------------------------------------------------------
create or replace view public.pc_publico as
select
  l.id, l.tipo, l.data, l.valor, l.categoria, l.descricao,
  case when l.mostrar_contraparte then l.contraparte end as contraparte,
  coalesce((
    select jsonb_agg(jsonb_build_object('path', a ->> 'path', 'nome', a ->> 'nome', 'tipo', a ->> 'tipo'))
    from jsonb_array_elements(l.anexos) a
    where (a ->> 'publico')::boolean
  ), '[]'::jsonb) as anexos,
  l.atualizado_em
from public.pc_lancamentos l
where l.publicar;

grant select on public.pc_publico to anon, authenticated;

-- ---------------------------------------------------------------------
-- Fotos: dois depósitos (limite de 5 MB por arquivo)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('prestacao-publica', 'prestacao-publica', true,  5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('prestacao-privada', 'prestacao-privada', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pc_storage_ler on storage.objects;
create policy pc_storage_ler on storage.objects for select to authenticated
  using (bucket_id in ('prestacao-publica', 'prestacao-privada') and public.pc_eh_admin());
drop policy if exists pc_storage_enviar on storage.objects;
create policy pc_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id in ('prestacao-publica', 'prestacao-privada') and public.pc_eh_admin());
drop policy if exists pc_storage_apagar on storage.objects;
create policy pc_storage_apagar on storage.objects for delete to authenticated
  using (bucket_id in ('prestacao-publica', 'prestacao-privada') and public.pc_eh_admin());

-- =====================================================================
-- PARTE 2 — Painel do administrador
-- Configurações do site (PIX, contatos, textos, campanha, necessidades),
-- equipe, saúde do banco e "ping" que o robô do GitHub usa para manter o
-- projeto Supabase ativo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configurações do site: todos leem (é o que aparece no site), só admin grava
-- ---------------------------------------------------------------------
create table if not exists public.pc_site (
  id             int primary key default 1 check (id = 1),
  valor          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);
insert into public.pc_site (id) values (1) on conflict (id) do nothing;

create or replace function public.pc_validar_site()
returns trigger language plpgsql set search_path = public
as $$
declare
  k text; v jsonb; n jsonb; t text; limite int;
  permitidos text[] := array['pix_chave', 'pix_tipo', 'pix_nome', 'pix_cidade', 'banco_texto', 'whatsapp', 'instagram', 'email',
                             'endereco', 'texto_sobre', 'campanha_titulo', 'campanha_meta', 'campanha_arrecadado', 'necessidades'];
begin
  if jsonb_typeof(new.valor) <> 'object' then raise exception 'Configuração inválida.'; end if;
  if length(new.valor::text) > 30000 then raise exception 'Configuração grande demais.'; end if;
  for k, v in select key, value from jsonb_each(new.valor) loop
    if not (k = any(permitidos)) then raise exception 'Campo não permitido: %', k; end if;
    if k = 'necessidades' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 30 then raise exception 'A lista de necessidades aceita até 30 itens.'; end if;
      for n in select value from jsonb_array_elements(v) loop
        if jsonb_typeof(n) <> 'object'
           or jsonb_typeof(n -> 'titulo') is distinct from 'string'
           or length(trim(n ->> 'titulo')) not between 2 and 120
           or length(coalesce(n ->> 'descricao', '')) > 300
           or coalesce(n ->> 'prioridade', 'media') not in ('alta', 'media', 'baixa') then
          raise exception 'Item inválido na lista de necessidades.';
        end if;
      end loop;
    elsif k in ('campanha_meta', 'campanha_arrecadado') then
      if jsonb_typeof(v) not in ('null', 'number', 'string')
         or (jsonb_typeof(v) <> 'null' and (v #>> '{}') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$') then
        raise exception 'Valor da campanha inválido (use apenas números).';
      end if;
    else
      if jsonb_typeof(v) not in ('null', 'string') then raise exception 'O campo % deve ser texto.', k; end if;
      t := v #>> '{}';
      limite := 300;
      if k = 'texto_sobre' then limite := 4000; end if;
      if t is not null and length(t) > limite then raise exception 'Texto longo demais em %.', k; end if;
      if t is not null and t <> '' then
        if k = 'whatsapp' and t !~ '^[0-9+() -]{8,20}$' then raise exception 'WhatsApp inválido.';
        elsif k = 'instagram' and t !~ '^@?[A-Za-z0-9._]{1,30}$' then raise exception 'Instagram inválido.';
        elsif k = 'email' and t !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-mail inválido.';
        elsif k = 'pix_tipo' and t not in ('CNPJ', 'CPF', 'E-mail', 'Telefone', 'Chave aleatória') then raise exception 'Tipo de chave PIX inválido.';
        end if;
      end if;
    end if;
  end loop;
  new.id := 1;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists pc_site_validar on public.pc_site;
create trigger pc_site_validar before insert or update on public.pc_site
  for each row execute function public.pc_validar_site();

-- histórico das mudanças do site (mesma tabela imutável; id fixo para as configurações)
create or replace function public.pc_registrar_historico_site()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if tg_op = 'UPDATE' and old.valor = new.valor then return new; end if;
  insert into public.pc_historico (lancamento_id, acao, antes, depois, usuario_id, usuario_email)
  values ('00000000-0000-0000-0000-00000000c0f1', 'site', case when tg_op = 'UPDATE' then old.valor end, new.valor, auth.uid(), v_email);
  return new;
end $$;
drop trigger if exists pc_site_historico on public.pc_site;
create trigger pc_site_historico after insert or update on public.pc_site
  for each row execute function public.pc_registrar_historico_site();

alter table public.pc_site enable row level security;
drop policy if exists pc_site_ler on public.pc_site;
create policy pc_site_ler on public.pc_site for select to anon, authenticated using (true);
drop policy if exists pc_site_inserir on public.pc_site;
create policy pc_site_inserir on public.pc_site for insert to authenticated with check (public.pc_eh_admin());
drop policy if exists pc_site_alterar on public.pc_site;
create policy pc_site_alterar on public.pc_site for update to authenticated using (public.pc_eh_admin()) with check (public.pc_eh_admin());
revoke all on public.pc_site from anon;
grant select on public.pc_site to anon;
revoke delete, truncate on public.pc_site from authenticated;

-- ---------------------------------------------------------------------
-- Equipe: administradores gerenciam administradores (a pessoa já precisa ter
-- usuário criado em Authentication → Users)
-- ---------------------------------------------------------------------
create or replace function public.pc_adicionar_admin(p_email text)
returns text language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
  if not public.pc_eh_admin() then raise exception 'Apenas administradores podem dar acesso.'; end if;
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'Não encontrei "%". Crie o usuário antes em Supabase → Authentication → Users.', p_email;
  end if;
  insert into public.pc_admins (user_id, email) values (v_id, v_email) on conflict do nothing;
  return v_email || ' agora pode lançar a prestação de contas.';
end $$;

create or replace function public.pc_retirar_admin(p_email text)
returns text language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
  if not public.pc_eh_admin() then raise exception 'Apenas administradores podem retirar acesso.'; end if;
  select user_id into v_id from public.pc_admins where lower(email) = v_email;
  if v_id is null then raise exception '% não é administrador(a).', p_email; end if;
  if v_id = auth.uid() then raise exception 'Você não pode retirar o seu próprio acesso.'; end if;
  delete from public.pc_admins where user_id = v_id;
  return 'Acesso de ' || v_email || ' retirado.';
end $$;

revoke execute on function public.pc_adicionar_admin(text), public.pc_retirar_admin(text) from public, anon;
grant execute on function public.pc_adicionar_admin(text), public.pc_retirar_admin(text) to authenticated;

-- ---------------------------------------------------------------------
-- Manter o banco ativo: o robô do GitHub chama pc_ping() todo dia.
-- (Projetos gratuitos do Supabase pausam após ~7 dias sem atividade.)
-- ---------------------------------------------------------------------
create table if not exists public.pc_atividade (
  id          int primary key default 1 check (id = 1),
  ultimo_ping timestamptz,
  total       bigint not null default 0
);
insert into public.pc_atividade (id) values (1) on conflict (id) do nothing;
alter table public.pc_atividade enable row level security;
revoke all on public.pc_atividade from anon, authenticated;

create or replace function public.pc_ping()
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare t timestamptz;
begin
  -- grava no máximo uma vez por minuto (evita abuso); qualquer chamada já conta como atividade
  update public.pc_atividade set ultimo_ping = now(), total = total + 1
   where id = 1 and (ultimo_ping is null or ultimo_ping < now() - interval '1 minute')
  returning ultimo_ping into t;
  if t is null then select ultimo_ping into t from public.pc_atividade where id = 1; end if;
  return t;
end $$;
grant execute on function public.pc_ping() to anon, authenticated;

create or replace function public.pc_saude()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.pc_eh_admin() then raise exception 'Apenas administradores.'; end if;
  return jsonb_build_object(
    'agora', now(),
    'lancamentos', (select count(*) from public.pc_lancamentos),
    'publicados', (select count(*) from public.pc_lancamentos where publicar),
    'sem_comprovante', (select count(*) from public.pc_lancamentos where jsonb_array_length(anexos) = 0),
    'ultima_alteracao', (select max(atualizado_em) from public.pc_lancamentos),
    'ultimo_ping', (select ultimo_ping from public.pc_atividade where id = 1),
    'total_pings', (select total from public.pc_atividade where id = 1),
    'administradores', (select count(*) from public.pc_admins));
end $$;
revoke execute on function public.pc_saude() from public, anon;
grant execute on function public.pc_saude() to authenticated;
