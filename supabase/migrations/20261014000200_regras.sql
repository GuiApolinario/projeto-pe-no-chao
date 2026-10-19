-- =====================================================================
-- Migração 2/4: funções e gatilhos com as regras de integridade financeira
-- =====================================================================

-- ---------------------------------------------------------------------
-- Papéis do usuário conectado
-- ---------------------------------------------------------------------
create or replace function public.meu_papel()
returns public.papel_usuario
language sql stable security definer set search_path = public
as $$ select papel from public.perfis where id = auth.uid() and ativo $$;

create or replace function public.tem_papel(variadic papeis public.papel_usuario[])
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.meu_papel() = any(papeis), false) $$;

create or replace function public.eh_equipe()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.meu_papel() is not null $$;

-- Ignora validações de "campos protegidos" quando a alteração é feita pelas
-- próprias rotinas do sistema (recalcular valor pago, situação documental...).
create or replace function public._modo_sistema()
returns boolean language sql stable
as $$ select coalesce(current_setting('app.modo_sistema', true), '') = 'on' $$;

-- ---------------------------------------------------------------------
-- Criação automática do perfil (o primeiro usuário vira administrador)
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.perfis where papel = 'admin') then 'visualizador'::public.papel_usuario else 'admin'::public.papel_usuario end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_usuario();

-- Impede que o último administrador ativo seja rebaixado/desativado
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.papel = 'admin' and old.ativo and (new.papel <> 'admin' or not new.ativo) then
    if (select count(*) from public.perfis where papel = 'admin' and ativo and id <> old.id) = 0 then
      raise exception 'Não é possível remover o último administrador ativo.';
    end if;
  end if;
  return new;
end $$;
create trigger perfis_ultimo_admin before update on public.perfis
  for each row execute function public.proteger_ultimo_admin();

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_id text;
  v_email text;
begin
  select email into v_email from public.perfis where id = auth.uid();
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
    insert into public.auditoria (tabela, registro_id, acao, dados_antigos, usuario_id, usuario_email)
    values (tg_table_name, v_id, 'exclusao', to_jsonb(old), auth.uid(), v_email);
    return old;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    v_id := (to_jsonb(new) ->> 'id');
    insert into public.auditoria (tabela, registro_id, acao, dados_antigos, dados_novos, usuario_id, usuario_email)
    values (tg_table_name, v_id, 'alteracao', to_jsonb(old), to_jsonb(new), auth.uid(), v_email);
    return new;
  else
    v_id := (to_jsonb(new) ->> 'id');
    insert into public.auditoria (tabela, registro_id, acao, dados_novos, usuario_id, usuario_email)
    values (tg_table_name, v_id, 'criacao', to_jsonb(new), auth.uid(), v_email);
    return new;
  end if;
end $$;

create or replace function public.auditoria_imutavel()
returns trigger language plpgsql
as $$ begin raise exception 'O histórico de auditoria não pode ser alterado ou excluído.'; end $$;

create trigger auditoria_sem_update before update or delete on public.auditoria
  for each row execute function public.auditoria_imutavel();
create trigger auditoria_sem_truncate before truncate on public.auditoria
  for each statement execute function public.auditoria_imutavel();

do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'projeto', 'periodos', 'instrumentos', 'fontes_recurso', 'contas_bancarias', 'categorias',
    'metas', 'fornecedores', 'documentos', 'documento_vinculos', 'receitas', 'despesas', 'pagamentos',
    'duplicidades_revisadas', 'checklist_modelos', 'despesa_checklist', 'doacoes_bens', 'orcamento_itens',
    'remanejamentos', 'extratos', 'extrato_linhas', 'atividades', 'atividade_despesas', 'beneficiarios',
    'participacoes', 'obrigacoes', 'configuracoes', 'necessidades']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.registrar_auditoria()', 'aud_' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Períodos: atribuição automática e bloqueio de períodos fechados
-- ---------------------------------------------------------------------
create or replace function public.periodo_da_data(p_data date)
returns uuid language sql stable set search_path = public
as $$
  select id from public.periodos
  where p_data between data_inicio and data_fim
  order by (status = 'aberto') desc, data_inicio desc
  limit 1
$$;

create or replace function public.data_em_periodo_fechado(p_data date)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.periodos where status = 'fechado' and p_data between data_inicio and data_fim) $$;

create or replace function public.validar_periodo_lancamento()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_data date;
  v_per public.periodos;
  v_status_antigo text;
begin
  if tg_table_name = 'receitas' then
    v_data := coalesce(new.data_recebimento, new.data_prevista, new.data_competencia);
  else
    v_data := coalesce(new.data_compra, new.data_emissao, new.data_vencimento);
  end if;

  if new.periodo_id is null then
    new.periodo_id := public.periodo_da_data(v_data);
    if new.periodo_id is null then
      raise exception 'Nenhum período cadastrado abrange a data %. Cadastre o período antes do lançamento.',
        to_char(v_data, 'DD/MM/YYYY');
    end if;
  end if;

  select * into v_per from public.periodos where id = new.periodo_id;
  if v_data not between v_per.data_inicio and v_per.data_fim then
    raise exception 'A data % está fora do período "%" (% a %).', to_char(v_data, 'DD/MM/YYYY'), v_per.nome,
      to_char(v_per.data_inicio, 'DD/MM/YYYY'), to_char(v_per.data_fim, 'DD/MM/YYYY');
  end if;

  if public._modo_sistema() then return new; end if;

  if v_per.status = 'fechado' then
    raise exception 'O período "%" está fechado. Reabra o período (com justificativa) para alterar lançamentos.', v_per.nome;
  end if;
  if tg_op = 'UPDATE' and old.periodo_id <> new.periodo_id then
    select status into v_status_antigo from public.periodos where id = old.periodo_id;
    if v_status_antigo = 'fechado' then
      raise exception 'O lançamento pertence a um período fechado e não pode ser movido.';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Conferência: só conferente/admin muda; edição de dados volta para "pendente"
-- ---------------------------------------------------------------------
create or replace function public.proteger_conferencia()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_ignorar text[] := array['conferencia', 'conferido_por', 'conferido_em', 'obs_conferencia',
                            'atualizado_por', 'atualizado_em', 'valor_pago', 'situacao_pagamento',
                            'situacao_documental', 'status'];
  v_campos_mudaram boolean;
  k text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  if public._modo_sistema() then return new; end if;

  if (new.conferencia, new.conferido_por, new.obs_conferencia) is distinct from
     (old.conferencia, old.conferido_por, old.obs_conferencia) then
    raise exception 'A situação de conferência só pode ser alterada pela função de conferência.';
  end if;

  foreach k in array v_ignorar loop
    v_old := v_old - k; v_new := v_new - k;
  end loop;
  v_campos_mudaram := v_old <> v_new;
  if v_campos_mudaram and old.conferencia <> 'pendente' then
    new.conferencia := 'pendente';
    new.conferido_por := null;
    new.conferido_em := null;
    new.obs_conferencia := 'Retornou para pendente após edição em ' || to_char(now(), 'DD/MM/YYYY HH24:MI');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Conta exclusiva de uma fonte: não aceitar movimentação de outra fonte
-- ---------------------------------------------------------------------
create or replace function public.validar_conta_fonte(p_conta uuid, p_fonte uuid)
returns void language plpgsql stable set search_path = public
as $$
declare v_fonte_conta uuid; v_nome text;
begin
  if p_conta is null then return; end if;
  select fonte_id, nome into v_fonte_conta, v_nome from public.contas_bancarias where id = p_conta;
  if v_fonte_conta is not null and v_fonte_conta <> p_fonte then
    raise exception 'A conta "%" é exclusiva de outra fonte de recurso. Recursos vinculados não podem ser misturados.', v_nome;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Receitas
-- ---------------------------------------------------------------------
create or replace function public.validar_receita()
returns trigger language plpgsql set search_path = public
as $$
declare v_tipo text;
begin
  select tipo into v_tipo from public.categorias where id = new.categoria_id;
  if v_tipo is distinct from 'receita' then
    raise exception 'A categoria informada não é uma categoria de receita.';
  end if;
  perform public.validar_conta_fonte(new.conta_id, new.fonte_id);
  if tg_op = 'INSERT' and not public._modo_sistema() then
    new.conferencia := 'pendente'; new.conferido_por := null; new.conferido_em := null; new.obs_conferencia := null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'cancelada' and new.status <> 'cancelada' and not public._modo_sistema() then
    raise exception 'Uma receita cancelada não pode ser reativada. Registre um novo lançamento.';
  end if;
  if new.status = 'cancelada' and (tg_op = 'INSERT' or old.status <> 'cancelada') then
    if exists (select 1 from public.extrato_linhas where receita_id = new.id and status = 'conciliado') then
      raise exception 'A receita está conciliada com o extrato. Desfaça a conciliação antes de cancelar.';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_em := now();
  end if;
  return new;
end $$;

create trigger receitas_periodo before insert or update on public.receitas
  for each row execute function public.validar_periodo_lancamento();
create trigger receitas_validar before insert or update on public.receitas
  for each row execute function public.validar_receita();
create trigger receitas_conferencia before update on public.receitas
  for each row execute function public.proteger_conferencia();

-- ---------------------------------------------------------------------
-- Despesas
-- ---------------------------------------------------------------------
create or replace function public.validar_despesa()
returns trigger language plpgsql set search_path = public
as $$
declare v_tipo text; v_pai uuid;
begin
  if new.categoria_id is not null then
    select tipo into v_tipo from public.categorias where id = new.categoria_id;
    if v_tipo is distinct from 'despesa' then
      raise exception 'A categoria informada não é uma categoria de despesa.';
    end if;
  end if;
  if new.subcategoria_id is not null then
    select parent_id into v_pai from public.categorias where id = new.subcategoria_id;
    if v_pai is distinct from new.categoria_id then
      raise exception 'A subcategoria não pertence à categoria selecionada.';
    end if;
  end if;

  -- valor total calculado a partir de quantidade × valor unitário − desconto
  if new.valor_unitario is not null then
    new.valor_total := round(new.quantidade * new.valor_unitario, 2) - new.desconto;
    if new.valor_total < 0 then raise exception 'O desconto é maior que o valor dos itens.'; end if;
  end if;

  perform public.validar_conta_fonte(new.conta_id, new.fonte_id);

  if tg_op = 'INSERT' and not public._modo_sistema() then
    new.conferencia := 'pendente'; new.conferido_por := null; new.conferido_em := null; new.obs_conferencia := null;
    new.valor_pago := 0; new.situacao_pagamento := 'em_aberto'; new.situacao_documental := 'sem_documentos';
  end if;

  if tg_op = 'UPDATE' then
    if new.valor_total < old.valor_pago then
      raise exception 'O valor total (R$ %) não pode ser menor que o valor já pago (R$ %).', new.valor_total, old.valor_pago;
    end if;
    if old.fonte_id <> new.fonte_id and old.valor_pago > 0 then
      raise exception 'Não é possível trocar a fonte de recurso de uma despesa com pagamentos registrados.';
    end if;
    if old.status in ('cancelada', 'reembolsada') and new.status <> old.status and not public._modo_sistema() then
      raise exception 'Despesa cancelada/reembolsada não pode ser reativada. Registre um novo lançamento.';
    end if;
    if new.status = 'paga' and old.status <> 'paga' and not public._modo_sistema() then
      raise exception 'A situação "paga" é definida automaticamente ao registrar pagamentos que quitem a despesa.';
    end if;
  elsif new.status = 'paga' then
    raise exception 'Cadastre a despesa e registre o(s) pagamento(s); a situação "paga" é automática.';
  end if;

  if new.status = 'cancelada' and (tg_op = 'INSERT' or old.status <> 'cancelada') then
    if exists (select 1 from public.pagamentos where despesa_id = new.id and not estornado) then
      raise exception 'A despesa possui pagamentos ativos. Estorne os pagamentos antes de cancelar.';
    end if;
    new.cancelado_por := auth.uid();
    new.cancelado_em := now();
  end if;
  if new.status = 'reembolsada' and (tg_op = 'INSERT' or old.status <> 'reembolsada') then
    new.cancelado_por := auth.uid();
    new.cancelado_em := now();
  end if;
  return new;
end $$;

create trigger despesas_periodo before insert or update on public.despesas
  for each row execute function public.validar_periodo_lancamento();
create trigger despesas_validar before insert or update on public.despesas
  for each row execute function public.validar_despesa();
create trigger despesas_conferencia before update on public.despesas
  for each row execute function public.proteger_conferencia();

-- Recalcula valor pago e situação de pagamento
create or replace function public.recalcular_pagamento_despesa(p_despesa uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_pago numeric(14,2); v_total numeric(14,2); v_status text;
begin
  select coalesce(sum(valor), 0) into v_pago from public.pagamentos where despesa_id = p_despesa and not estornado;
  select valor_total, status into v_total, v_status from public.despesas where id = p_despesa;
  perform set_config('app.modo_sistema', 'on', true);
  update public.despesas set
    valor_pago = v_pago,
    situacao_pagamento = case when v_pago = 0 then 'em_aberto' when v_pago < v_total then 'parcial' else 'quitada' end,
    status = case
      when v_status in ('cancelada', 'reembolsada') then v_status
      when v_pago >= v_total and v_total > 0 then 'paga'
      when v_status = 'paga' then 'aprovada'  -- estorno após quitação
      else v_status end
  where id = p_despesa;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

-- ---------------------------------------------------------------------
-- Pagamentos (parciais; estorno em vez de exclusão)
-- ---------------------------------------------------------------------
create or replace function public.validar_pagamento()
returns trigger language plpgsql set search_path = public
as $$
declare d public.despesas; v_ja_pago numeric(14,2);
begin
  if tg_op = 'UPDATE' then
    if (new.despesa_id, new.data_pagamento, new.valor, new.conta_id) is distinct from
       (old.despesa_id, old.data_pagamento, old.valor, old.conta_id) then
      raise exception 'Pagamentos não podem ser editados. Estorne e registre novamente.';
    end if;
    if old.estornado and not new.estornado then
      raise exception 'Um estorno não pode ser desfeito.';
    end if;
    if new.estornado and not old.estornado then
      if public.data_em_periodo_fechado(old.data_pagamento) then
        raise exception 'O pagamento está em período fechado. Reabra o período para estornar.';
      end if;
      if exists (select 1 from public.extrato_linhas where pagamento_id = old.id and status = 'conciliado') then
        raise exception 'O pagamento está conciliado com o extrato. Desfaça a conciliação antes de estornar.';
      end if;
      new.estornado_por := auth.uid();
      new.estornado_em := now();
    end if;
    return new;
  end if;

  select * into d from public.despesas where id = new.despesa_id;
  if d.status in ('cancelada', 'reembolsada', 'prevista') then
    raise exception 'Não é possível pagar uma despesa com situação "%".', d.status;
  end if;
  if public.data_em_periodo_fechado(new.data_pagamento) then
    raise exception 'A data do pagamento (%) está em um período fechado.', to_char(new.data_pagamento, 'DD/MM/YYYY');
  end if;
  if d.fornecedor_id is null then
    raise exception 'Identifique o fornecedor/beneficiário da despesa antes de registrar o pagamento.';
  end if;
  select coalesce(sum(valor), 0) into v_ja_pago from public.pagamentos where despesa_id = d.id and not estornado;
  if v_ja_pago + new.valor > d.valor_total then
    raise exception 'O pagamento excede o saldo devedor da despesa (restam R$ %).', d.valor_total - v_ja_pago;
  end if;
  perform public.validar_conta_fonte(new.conta_id, d.fonte_id);
  return new;
end $$;

create or replace function public.apos_pagamento()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.recalcular_pagamento_despesa(new.despesa_id);
  return null;
end $$;

create trigger pagamentos_validar before insert or update on public.pagamentos
  for each row execute function public.validar_pagamento();
create trigger pagamentos_apos after insert or update on public.pagamentos
  for each row execute function public.apos_pagamento();

-- ---------------------------------------------------------------------
-- Checklist documental e situação documental da despesa
-- ---------------------------------------------------------------------
create or replace function public.gerar_checklist_despesa(p_despesa uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare d public.despesas;
begin
  select * into d from public.despesas where id = p_despesa;
  insert into public.despesa_checklist (despesa_id, modelo_id, item, criterio, obrigatorio)
  select d.id, m.id, m.item, m.criterio, m.obrigatorio
  from public.checklist_modelos m
  where m.ativo
    and (m.categoria_id is null or m.categoria_id = d.categoria_id)
    and (m.fonte_id is null or m.fonte_id = d.fonte_id)
    and (m.valor_minimo is null or d.valor_total >= m.valor_minimo)
  order by m.ordem
  on conflict (despesa_id, modelo_id) do nothing;
end $$;

-- documentos ligados à despesa ou aos seus pagamentos ativos
create or replace function public.documentos_da_despesa(p_despesa uuid)
returns table (id uuid, tipo text, status text)
language sql stable security definer set search_path = public
as $$
  select distinct doc.id, doc.tipo_documento, doc.status
  from public.documentos doc
  join public.documento_vinculos v on v.documento_id = doc.id
  where (v.entidade = 'despesa' and v.registro_id = p_despesa)
     or (v.entidade = 'pagamento' and v.registro_id in (
           select pg.id from public.pagamentos pg where pg.despesa_id = p_despesa and not pg.estornado))
$$;

create or replace function public.recalcular_situacao_documental(p_despesa uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  d public.despesas;
  c record;
  v_docs int; v_rejeitados int; v_aguardando int;
  v_faltando int := 0;
  v_situacao text;
begin
  select * into d from public.despesas where id = p_despesa;
  if not found then return; end if;

  -- marca itens atendidos automaticamente
  for c in select * from public.despesa_checklist where despesa_id = d.id loop
    update public.despesa_checklist set
      atendido = case
        when c.criterio = 'campo:justificativa' then length(trim(coalesce(d.justificativa, ''))) >= 5
        when c.criterio = 'campo:fornecedor' then exists (
          select 1 from public.fornecedores f where f.id = d.fornecedor_id and f.cpf_cnpj is not null)
        when c.criterio like 'doc:%' then exists (
          select 1 from public.documentos_da_despesa(d.id) x where x.status <> 'rejeitado'
            and x.tipo = any(string_to_array(substring(c.criterio from 5), '|')))
        else c.atendido end,
      atualizado_em = now()
    where id = c.id;
  end loop;

  select count(*), count(*) filter (where status = 'rejeitado'), count(*) filter (where status = 'aguardando')
    into v_docs, v_rejeitados, v_aguardando from public.documentos_da_despesa(d.id);
  select count(*) into v_faltando from public.despesa_checklist
    where despesa_id = d.id and obrigatorio and not atendido and not dispensado;

  v_situacao := case
    when v_rejeitados > 0 then 'rejeitada'
    when v_docs = 0 and v_faltando > 0 then 'sem_documentos'
    when v_docs = 0 and not exists (select 1 from public.despesa_checklist where despesa_id = d.id) then 'sem_documentos'
    when v_faltando > 0 then 'incompleta'
    when v_aguardando > 0 then 'aguardando_conferencia'
    else 'validada' end;

  perform set_config('app.modo_sistema', 'on', true);
  update public.despesas set situacao_documental = v_situacao where id = d.id and situacao_documental <> v_situacao;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

create or replace function public.despesa_apos_salvar()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public._modo_sistema() then return null; end if;
  if tg_op = 'INSERT' or old.categoria_id is distinct from new.categoria_id or old.fonte_id <> new.fonte_id
     or old.valor_total <> new.valor_total then
    perform public.gerar_checklist_despesa(new.id);
  end if;
  perform public.recalcular_situacao_documental(new.id);
  if tg_op = 'UPDATE' and old.valor_total <> new.valor_total then
    perform public.recalcular_pagamento_despesa(new.id);
  end if;
  return null;
end $$;
create trigger despesas_apos after insert or update on public.despesas
  for each row execute function public.despesa_apos_salvar();

create or replace function public.checklist_apos_alterar()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  perform public.recalcular_situacao_documental(coalesce(new.despesa_id, old.despesa_id));
  return null;
end $$;
create trigger checklist_apos after update of dispensado, atendido on public.despesa_checklist
  for each row execute function public.checklist_apos_alterar();

-- Vínculos de documentos
create or replace function public.validar_vinculo_documento()
returns trigger language plpgsql set search_path = public
as $$
declare v_periodo_fechado boolean := false; v_despesa uuid;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.documento_vinculos where documento_id = new.documento_id)
       and length(trim(coalesce(new.justificativa, ''))) < 5 then
      raise exception 'Este documento já está vinculado a outro registro. Informe uma justificativa para o novo vínculo.';
    end if;
    return new;
  end if;
  -- exclusão de vínculo: proibida se o lançamento estiver em período fechado
  if old.entidade = 'despesa' then v_despesa := old.registro_id;
  elsif old.entidade = 'pagamento' then select despesa_id into v_despesa from public.pagamentos where id = old.registro_id;
  end if;
  if v_despesa is not null then
    select p.status = 'fechado' into v_periodo_fechado
    from public.despesas d join public.periodos p on p.id = d.periodo_id where d.id = v_despesa;
  elsif old.entidade = 'receita' then
    select p.status = 'fechado' into v_periodo_fechado
    from public.receitas r join public.periodos p on p.id = r.periodo_id where r.id = old.registro_id;
  end if;
  if coalesce(v_periodo_fechado, false) then
    raise exception 'O lançamento pertence a um período fechado; o documento não pode ser desvinculado.';
  end if;
  return old;
end $$;

create or replace function public.vinculo_apos_alterar()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r record; v_despesa uuid;
begin
  r := coalesce(new, old);
  if r.entidade = 'despesa' then v_despesa := r.registro_id;
  elsif r.entidade = 'pagamento' then select despesa_id into v_despesa from public.pagamentos where id = r.registro_id;
  end if;
  if v_despesa is not null then perform public.recalcular_situacao_documental(v_despesa); end if;
  return null;
end $$;

create trigger vinculos_validar before insert or delete on public.documento_vinculos
  for each row execute function public.validar_vinculo_documento();
create trigger vinculos_apos after insert or delete on public.documento_vinculos
  for each row execute function public.vinculo_apos_alterar();

create or replace function public.documento_apos_status()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in
    select distinct case when v.entidade = 'despesa' then v.registro_id else p.despesa_id end as despesa_id
    from public.documento_vinculos v
    left join public.pagamentos p on v.entidade = 'pagamento' and p.id = v.registro_id
    where v.documento_id = new.id and v.entidade in ('despesa', 'pagamento')
  loop
    if r.despesa_id is not null then perform public.recalcular_situacao_documental(r.despesa_id); end if;
  end loop;
  return null;
end $$;
create trigger documentos_status after update of status, tipo_documento on public.documentos
  for each row execute function public.documento_apos_status();

create or replace function public.proteger_documento()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'aguardando'; new.conferido_por := null; new.conferido_em := null; new.obs_conferente := null;
    new.enviado_por := coalesce(auth.uid(), new.enviado_por);
    return new;
  end if;
  if new.storage_path <> old.storage_path or new.mime_type <> old.mime_type or new.tamanho_bytes <> old.tamanho_bytes then
    raise exception 'O arquivo de um documento não pode ser substituído. Envie um novo documento.';
  end if;
  if public._modo_sistema() then return new; end if;
  if (new.status, new.conferido_por, new.obs_conferente) is distinct from (old.status, old.conferido_por, old.obs_conferente) then
    raise exception 'A conferência de documentos só pode ser registrada pela função de conferência.';
  end if;
  return new;
end $$;
create trigger documentos_proteger before insert or update on public.documentos
  for each row execute function public.proteger_documento();

-- ---------------------------------------------------------------------
-- Remanejamentos: nunca automáticos; autorizar exige administrador
-- ---------------------------------------------------------------------
create or replace function public.validar_remanejamento()
returns trigger language plpgsql set search_path = public
as $$
declare o public.orcamento_itens; d public.orcamento_itens; vo boolean; vd boolean;
begin
  select * into o from public.orcamento_itens where id = new.origem_id;
  select * into d from public.orcamento_itens where id = new.destino_id;
  if o.fonte_id <> d.fonte_id then
    select vinculado into vo from public.fontes_recurso where id = o.fonte_id;
    select vinculado into vd from public.fontes_recurso where id = d.fonte_id;
    if vo or vd then
      raise exception 'Remanejamento entre fontes diferentes não é permitido quando há recurso vinculado.';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'solicitado' then
    raise exception 'Remanejamento já decidido não pode ser alterado.';
  end if;
  if tg_op = 'INSERT' and new.status <> 'solicitado' then
    raise exception 'Remanejamentos são sempre registrados como "solicitado" e decididos depois.';
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status and not public._modo_sistema() then
    raise exception 'Use a função de decisão para autorizar ou negar o remanejamento.';
  end if;
  return new;
end $$;
create trigger remanejamentos_validar before insert or update on public.remanejamentos
  for each row execute function public.validar_remanejamento();

-- ---------------------------------------------------------------------
-- Conciliação: valida correspondências
-- ---------------------------------------------------------------------
create or replace function public.validar_linha_extrato()
returns trigger language plpgsql set search_path = public
as $$
declare e public.extratos; p public.pagamentos; r public.receitas;
begin
  select * into e from public.extratos where id = new.extrato_id;
  if e.status = 'concluida' and not public._modo_sistema() then
    raise exception 'A conciliação deste extrato já foi concluída.';
  end if;
  if new.pagamento_id is not null then
    select * into p from public.pagamentos where id = new.pagamento_id;
    if p.estornado then raise exception 'Pagamento estornado não pode ser conciliado.'; end if;
    if p.conta_id <> e.conta_id then raise exception 'O pagamento foi registrado em outra conta bancária.'; end if;
    if new.valor <> -p.valor then
      raise exception 'Valor do extrato (R$ %) diferente do pagamento (R$ %). Registre o ajuste correspondente.', new.valor, -p.valor;
    end if;
  end if;
  if new.receita_id is not null then
    select * into r from public.receitas where id = new.receita_id;
    if r.status <> 'recebida' then raise exception 'Somente receitas recebidas podem ser conciliadas.'; end if;
    if r.conta_id <> e.conta_id then raise exception 'A receita foi registrada em outra conta bancária.'; end if;
    if new.valor <> r.valor_recebido then
      raise exception 'Valor do extrato (R$ %) diferente da receita (R$ %).', new.valor, r.valor_recebido;
    end if;
  end if;
  if new.status = 'conciliado' and (tg_op = 'INSERT' or old.status <> 'conciliado') then
    new.conciliado_por := auth.uid();
    new.conciliado_em := now();
  elsif new.status = 'pendente' then
    new.pagamento_id := null; new.receita_id := null; new.conciliado_por := null; new.conciliado_em := null;
  end if;
  return new;
end $$;
create trigger extrato_linhas_validar before insert or update on public.extrato_linhas
  for each row execute function public.validar_linha_extrato();

-- ---------------------------------------------------------------------
-- Bloqueio de exclusões em tabelas financeiras (mesmo com permissão)
-- ---------------------------------------------------------------------
create or replace function public.impedir_exclusao()
returns trigger language plpgsql
as $$ begin raise exception 'Registros de "%" não podem ser excluídos. Use cancelamento ou estorno com justificativa.', tg_table_name; end $$;

create trigger receitas_sem_delete before delete on public.receitas for each row execute function public.impedir_exclusao();
create trigger despesas_sem_delete before delete on public.despesas for each row execute function public.impedir_exclusao();
create trigger pagamentos_sem_delete before delete on public.pagamentos for each row execute function public.impedir_exclusao();
create trigger documentos_sem_delete before delete on public.documentos for each row execute function public.impedir_exclusao();
create trigger periodos_sem_delete before delete on public.periodos for each row execute function public.impedir_exclusao();

-- ---------------------------------------------------------------------
-- Funções de operação (RPC) com verificação de papel
-- ---------------------------------------------------------------------
create or replace function public.conferir_lancamento(p_tabela text, p_id uuid, p_situacao text, p_obs text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.tem_papel('admin', 'conferente') then
    raise exception 'Apenas conferentes ou administradores podem registrar conferência.';
  end if;
  if p_situacao not in ('pendente', 'em_analise', 'aprovado', 'rejeitado') then
    raise exception 'Situação de conferência inválida.';
  end if;
  if p_situacao = 'rejeitado' and length(trim(coalesce(p_obs, ''))) < 5 then
    raise exception 'Informe o motivo da rejeição.';
  end if;
  if p_tabela not in ('receitas', 'despesas') then raise exception 'Tabela inválida.'; end if;
  perform set_config('app.modo_sistema', 'on', true);
  execute format('update public.%I set conferencia = $1, obs_conferencia = $2, conferido_por = auth.uid(), conferido_em = now()
                  where id = $3 and periodo_id in (select id from public.periodos where status = ''aberto'')', p_tabela)
    using p_situacao, p_obs, p_id;
  if not found then
    perform set_config('app.modo_sistema', 'off', true);
    raise exception 'Lançamento não encontrado ou em período fechado.';
  end if;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

create or replace function public.conferir_documento(p_id uuid, p_status text, p_obs text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.tem_papel('admin', 'conferente') then
    raise exception 'Apenas conferentes ou administradores podem conferir documentos.';
  end if;
  if p_status not in ('aguardando', 'validado', 'rejeitado') then raise exception 'Situação inválida.'; end if;
  if p_status = 'rejeitado' and length(trim(coalesce(p_obs, ''))) < 5 then
    raise exception 'Informe o motivo da rejeição para correção.';
  end if;
  perform set_config('app.modo_sistema', 'on', true);
  update public.documentos set status = p_status, obs_conferente = p_obs, conferido_por = auth.uid(), conferido_em = now()
  where id = p_id;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

create or replace function public.fechar_periodo(p_id uuid, p_obs text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.tem_papel('admin', 'financeiro') then raise exception 'Sem permissão para fechar períodos.'; end if;
  update public.periodos set status = 'fechado', fechado_em = now(), fechado_por = auth.uid()
  where id = p_id and status = 'aberto';
  if not found then raise exception 'Período não encontrado ou já fechado.'; end if;
  insert into public.periodo_eventos (periodo_id, evento, justificativa, usuario_id) values (p_id, 'fechamento', p_obs, auth.uid());
end $$;

create or replace function public.reabrir_periodo(p_id uuid, p_justificativa text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.tem_papel('admin') then raise exception 'Apenas administradores podem reabrir períodos.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 10 then raise exception 'Informe uma justificativa (mín. 10 caracteres).'; end if;
  update public.periodos set status = 'aberto', fechado_em = null, fechado_por = null where id = p_id and status = 'fechado';
  if not found then raise exception 'Período não encontrado ou já aberto.'; end if;
  insert into public.periodo_eventos (periodo_id, evento, justificativa, usuario_id) values (p_id, 'reabertura', p_justificativa, auth.uid());
end $$;

create or replace function public.decidir_remanejamento(p_id uuid, p_autorizar boolean, p_obs text, p_documento text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.remanejamentos; v_saldo_origem numeric(14,2);
begin
  if not public.tem_papel('admin') then raise exception 'Apenas administradores podem decidir remanejamentos.'; end if;
  select * into r from public.remanejamentos where id = p_id for update;
  if r.status <> 'solicitado' then raise exception 'Remanejamento já decidido.'; end if;
  perform set_config('app.modo_sistema', 'on', true);
  if p_autorizar then
    if length(trim(coalesce(p_documento, ''))) < 3 then
      perform set_config('app.modo_sistema', 'off', true);
      raise exception 'Informe o documento/ato que autoriza o remanejamento.';
    end if;
    select coalesce(valor_revisado, valor_aprovado) into v_saldo_origem from public.orcamento_itens where id = r.origem_id;
    if v_saldo_origem < r.valor then
      perform set_config('app.modo_sistema', 'off', true);
      raise exception 'O item de origem não possui valor suficiente.';
    end if;
    update public.orcamento_itens set valor_revisado = coalesce(valor_revisado, valor_aprovado) - r.valor,
      documento_ref = coalesce(documento_ref || ' | ', '') || p_documento where id = r.origem_id;
    update public.orcamento_itens set valor_revisado = coalesce(valor_revisado, valor_aprovado) + r.valor,
      documento_ref = coalesce(documento_ref || ' | ', '') || p_documento where id = r.destino_id;
  end if;
  update public.remanejamentos set status = case when p_autorizar then 'autorizado' else 'negado' end,
    decidido_por = auth.uid(), decidido_em = now(), obs_decisao = p_obs, documento_autorizacao = p_documento
  where id = p_id;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

create or replace function public.concluir_conciliacao(p_extrato uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare e public.extratos;
begin
  if not public.tem_papel('admin', 'financeiro', 'conferente') then raise exception 'Sem permissão.'; end if;
  select * into e from public.extratos where id = p_extrato;
  if exists (select 1 from public.extrato_linhas where extrato_id = p_extrato and status = 'pendente') then
    raise exception 'Ainda existem linhas do extrato sem conciliação ou justificativa.';
  end if;
  perform set_config('app.modo_sistema', 'on', true);
  update public.extratos set status = 'concluida',
    conferido_por = case when realizado_por is distinct from auth.uid() then auth.uid() else conferido_por end,
    conferido_em = case when realizado_por is distinct from auth.uid() then now() else conferido_em end
  where id = p_extrato;
  perform set_config('app.modo_sistema', 'off', true);
end $$;

create or replace function public.reabrir_conciliacao(p_extrato uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.tem_papel('admin') then raise exception 'Apenas administradores podem reabrir uma conciliação.'; end if;
  update public.extratos set status = 'em_andamento', conferido_por = null, conferido_em = null where id = p_extrato;
end $$;
