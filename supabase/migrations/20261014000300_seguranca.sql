-- =====================================================================
-- Migração 3/4: Row Level Security (permissões no servidor) e Storage
--
--   admin         → tudo, inclusive usuários, configurações e reaberturas
--   financeiro    → receitas, despesas, pagamentos, orçamento, conciliação
--   atividades    → atividades, beneficiários, participações, fotos
--   conferente    → leitura geral + conferência (via funções) + auditoria
--   visualizador  → leitura dos dados não sensíveis
--   anon (site)   → somente configurações públicas, necessidades, envio de contato
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'projeto', 'periodos', 'periodo_eventos', 'instrumentos', 'fontes_recurso', 'contas_bancarias',
    'categorias', 'metas', 'fornecedores', 'documentos', 'documento_vinculos', 'receitas', 'despesas',
    'pagamentos', 'duplicidades_revisadas', 'checklist_modelos', 'despesa_checklist', 'doacoes_bens',
    'orcamento_itens', 'remanejamentos', 'extratos', 'extrato_linhas', 'atividades', 'atividade_despesas',
    'beneficiarios', 'participacoes', 'obrigacoes', 'configuracoes', 'necessidades', 'contatos', 'auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- perfis ----------
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or public.eh_equipe());
create policy perfis_admin on public.perfis for update to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

-- ---------- leitura geral para a equipe; escrita por papel ----------
-- (macro para reduzir repetição)
create or replace function public._politicas_padrao(p_tabela text, p_escrita text)
returns void language plpgsql as $$
begin
  execute format('create policy %I on public.%I for select to authenticated using (public.eh_equipe())',
                 p_tabela || '_ler', p_tabela);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                 p_tabela || '_inserir', p_tabela, p_escrita);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                 p_tabela || '_alterar', p_tabela, p_escrita, p_escrita);
end $$;

select public._politicas_padrao('projeto',            $$public.tem_papel('admin')$$);
select public._politicas_padrao('periodos',           $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('instrumentos',       $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('fontes_recurso',     $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('categorias',         $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('metas',              $$public.tem_papel('admin','financeiro','atividades')$$);
select public._politicas_padrao('fornecedores',       $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('receitas',           $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('despesas',           $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('pagamentos',         $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('checklist_modelos',  $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('despesa_checklist',  $$public.tem_papel('admin','financeiro','conferente')$$);
select public._politicas_padrao('doacoes_bens',       $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('orcamento_itens',    $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('remanejamentos',     $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('extratos',           $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('extrato_linhas',     $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('atividades',         $$public.tem_papel('admin','atividades')$$);
select public._politicas_padrao('atividade_despesas', $$public.tem_papel('admin','atividades','financeiro')$$);
select public._politicas_padrao('obrigacoes',         $$public.tem_papel('admin','financeiro')$$);
select public._politicas_padrao('necessidades',       $$public.tem_papel('admin')$$);
select public._politicas_padrao('duplicidades_revisadas', $$public.tem_papel('admin','financeiro','conferente')$$);

drop function public._politicas_padrao(text, text);

create policy periodo_eventos_ler on public.periodo_eventos for select to authenticated using (public.eh_equipe());

-- exclusões permitidas apenas onde fazem sentido (cadastros auxiliares sem histórico financeiro)
create policy atividade_despesas_excluir on public.atividade_despesas for delete to authenticated
  using (public.tem_papel('admin','atividades','financeiro'));
create policy necessidades_excluir on public.necessidades for delete to authenticated using (public.tem_papel('admin'));
create policy extrato_linhas_excluir on public.extrato_linhas for delete to authenticated
  using (public.tem_papel('admin','financeiro') and status = 'pendente'
         and exists (select 1 from public.extratos e where e.id = extrato_id and e.status = 'em_andamento'));
create policy extratos_excluir on public.extratos for delete to authenticated
  using (public.tem_papel('admin','financeiro') and status = 'em_andamento'
         and not exists (select 1 from public.extrato_linhas l where l.extrato_id = extratos.id and l.status <> 'pendente'));

-- ---------- contas bancárias: dados bancários com acesso restrito ----------
create policy contas_ler on public.contas_bancarias for select to authenticated
  using (public.tem_papel('admin','financeiro','conferente'));
create policy contas_inserir on public.contas_bancarias for insert to authenticated
  with check (public.tem_papel('admin','financeiro'));
create policy contas_alterar on public.contas_bancarias for update to authenticated
  using (public.tem_papel('admin','financeiro')) with check (public.tem_papel('admin','financeiro'));

-- visão sem agência/número para os demais perfis
create view public.contas_resumo as
  select id, nome, tipo, fonte_id, ativo from public.contas_bancarias where public.eh_equipe();
alter view public.contas_resumo owner to postgres;
revoke all on public.contas_resumo from anon;

-- ---------- documentos ----------
create policy documentos_ler on public.documentos for select to authenticated
  using (public.eh_equipe() and (not sensivel or public.tem_papel('admin','financeiro','conferente')));
create policy documentos_inserir on public.documentos for insert to authenticated
  with check (public.tem_papel('admin','financeiro','atividades'));
create policy documentos_alterar on public.documentos for update to authenticated
  using (public.tem_papel('admin','financeiro') or (public.tem_papel('atividades') and enviado_por = auth.uid()))
  with check (public.tem_papel('admin','financeiro') or (public.tem_papel('atividades') and enviado_por = auth.uid()));

create policy vinculos_ler on public.documento_vinculos for select to authenticated using (public.eh_equipe());
create policy vinculos_inserir on public.documento_vinculos for insert to authenticated
  with check (public.tem_papel('admin','financeiro') or (public.tem_papel('atividades') and entidade in ('atividade','beneficiario')));
create policy vinculos_excluir on public.documento_vinculos for delete to authenticated
  using (public.tem_papel('admin','financeiro') or (public.tem_papel('atividades') and entidade in ('atividade','beneficiario')));

-- ---------- LGPD: dados de crianças e adolescentes ----------
create policy beneficiarios_ler on public.beneficiarios for select to authenticated
  using (public.tem_papel('admin','atividades'));
create policy beneficiarios_inserir on public.beneficiarios for insert to authenticated
  with check (public.tem_papel('admin','atividades'));
create policy beneficiarios_alterar on public.beneficiarios for update to authenticated
  using (public.tem_papel('admin','atividades')) with check (public.tem_papel('admin','atividades'));

create policy participacoes_ler on public.participacoes for select to authenticated
  using (public.tem_papel('admin','atividades'));
create policy participacoes_inserir on public.participacoes for insert to authenticated
  with check (public.tem_papel('admin','atividades'));
create policy participacoes_excluir on public.participacoes for delete to authenticated
  using (public.tem_papel('admin','atividades'));

-- ---------- configurações ----------
create policy configuracoes_ler_publico on public.configuracoes for select to anon, authenticated
  using (publico or public.eh_equipe());
create policy configuracoes_escrever on public.configuracoes for insert to authenticated with check (public.tem_papel('admin'));
create policy configuracoes_alterar on public.configuracoes for update to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

-- ---------- site público ----------
create policy necessidades_ler_publico on public.necessidades for select to anon using (ativo);

create policy contatos_enviar on public.contatos for insert to anon, authenticated
  with check (consentimento and status = 'novo');
create policy contatos_ler on public.contatos for select to authenticated using (public.tem_papel('admin'));
create policy contatos_alterar on public.contatos for update to authenticated
  using (public.tem_papel('admin')) with check (public.tem_papel('admin'));

-- ---------- auditoria: somente leitura para admin/conferente ----------
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.tem_papel('admin','conferente'));

-- privilégios explícitos (defesa em profundidade, além do RLS)
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;
revoke all on public.auditoria_id_seq from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on public.configuracoes, public.necessidades to anon;
grant insert on public.contatos to anon;
revoke truncate on all tables in schema public from authenticated;

-- funções internas não devem ser chamadas diretamente pelo cliente
revoke execute on function public.recalcular_pagamento_despesa(uuid) from public, anon, authenticated;
revoke execute on function public.recalcular_situacao_documental(uuid) from public, anon, authenticated;
revoke execute on function public.gerar_checklist_despesa(uuid) from public, anon, authenticated;
revoke execute on function public.documentos_da_despesa(uuid) from public, anon, authenticated;
revoke execute on function public.conferir_lancamento(text, uuid, text, text) from public, anon;
revoke execute on function public.conferir_documento(uuid, text, text) from public, anon;
revoke execute on function public.fechar_periodo(uuid, text) from public, anon;
revoke execute on function public.reabrir_periodo(uuid, text) from public, anon;
revoke execute on function public.decidir_remanejamento(uuid, boolean, text, text) from public, anon;
revoke execute on function public.concluir_conciliacao(uuid) from public, anon;
revoke execute on function public.reabrir_conciliacao(uuid) from public, anon;
grant execute on function public.conferir_lancamento(text, uuid, text, text) to authenticated;
grant execute on function public.conferir_documento(uuid, text, text) to authenticated;
grant execute on function public.fechar_periodo(uuid, text) to authenticated;
grant execute on function public.reabrir_periodo(uuid, text) to authenticated;
grant execute on function public.decidir_remanejamento(uuid, boolean, text, text) to authenticated;
grant execute on function public.concluir_conciliacao(uuid) to authenticated;
grant execute on function public.reabrir_conciliacao(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: bucket privado para comprovantes (sem links públicos)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- consulta sem RLS (a política abaixo precisa enxergar documentos ocultos para o usuário)
create or replace function public.arquivo_sensivel(p_path text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.documentos d where d.storage_path = p_path and d.sensivel) $$;
revoke execute on function public.arquivo_sensivel(text) from public, anon;
grant execute on function public.arquivo_sensivel(text) to authenticated;

-- leitura: somente equipe, e documentos sensíveis apenas para admin/financeiro/conferente
create policy documentos_storage_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.eh_equipe() and (
    public.tem_papel('admin','financeiro','conferente')
    or not public.arquivo_sensivel(name)));
-- envio: perfis que lançam documentos; sem atualização e sem exclusão (arquivos imutáveis)
create policy documentos_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.tem_papel('admin','financeiro','atividades'));
