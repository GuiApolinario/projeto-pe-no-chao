-- =====================================================================
-- Migração 4/4: visões, cálculos (dashboard, orçamento, alertas,
-- transparência pública) e dados iniciais de configuração
--
-- Convenções de cálculo (documentadas em docs/REGRAS-FINANCEIRAS.md):
--   * Saída de caixa = PAGAMENTOS não estornados (nunca o valor da despesa),
--     o que impede descontar duas vezes a mesma despesa.
--   * Entrada de caixa = receitas com status "recebida" (previstas não contam).
--   * Doações em bens nunca entram no caixa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabela geral de movimentações (respeita o RLS de quem consulta)
-- ---------------------------------------------------------------------
create view public.v_movimentacoes with (security_invoker = true) as
select
  r.id, r.codigo, 'receita'::text as tipo,
  coalesce(r.data_recebimento, r.data_prevista) as data,
  r.descricao, r.categoria_id, c.nome as categoria,
  coalesce(nullif(r.doador_nome, ''), r.origem) as contraparte,
  coalesce(r.valor_recebido, r.valor_previsto) as valor,
  case when r.status = 'recebida' then r.valor_recebido else 0 end as valor_realizado,
  r.forma_recebimento as forma, r.conta_id, cr.nome as conta,
  r.fonte_id, f.nome as fonte, r.periodo_id,
  case when r.status = 'prevista' and r.data_prevista < current_date then 'atrasada' else r.status end as situacao_financeira,
  null::text as situacao_documental,
  (select count(*) from public.documento_vinculos v where v.entidade = 'receita' and v.registro_id = r.id)::int as anexos,
  r.conferencia, pc.nome as conferente
from public.receitas r
join public.categorias c on c.id = r.categoria_id
join public.fontes_recurso f on f.id = r.fonte_id
left join public.contas_resumo cr on cr.id = r.conta_id
left join public.perfis pc on pc.id = r.conferido_por
union all
select
  d.id, d.codigo, 'despesa'::text,
  coalesce(d.data_compra, d.data_emissao, d.data_vencimento),
  d.descricao, d.categoria_id, c.nome,
  fo.nome,
  d.valor_total,
  d.valor_pago,
  d.forma_pagamento, d.conta_id, cr.nome,
  d.fonte_id, f.nome, d.periodo_id,
  case when d.status in ('lancada', 'aprovada', 'contratada') and d.situacao_pagamento = 'parcial' then 'parcialmente_paga'
       else d.status end,
  d.situacao_documental,
  ((select count(*) from public.documento_vinculos v where v.entidade = 'despesa' and v.registro_id = d.id)
   + (select count(*) from public.documento_vinculos v join public.pagamentos p on p.id = v.registro_id
      where v.entidade = 'pagamento' and p.despesa_id = d.id))::int,
  d.conferencia, pc.nome
from public.despesas d
left join public.categorias c on c.id = d.categoria_id
join public.fontes_recurso f on f.id = d.fonte_id
left join public.fornecedores fo on fo.id = d.fornecedor_id
left join public.contas_resumo cr on cr.id = d.conta_id
left join public.perfis pc on pc.id = d.conferido_por;

-- ---------------------------------------------------------------------
-- Saldo contábil em uma data (opcionalmente por fonte)
-- ---------------------------------------------------------------------
create or replace function public.saldo_contabil_em(p_data date, p_fonte uuid default null)
returns numeric language sql stable security definer set search_path = public
as $$
  select
    coalesce((select sum(c.saldo_inicial) from public.contas_bancarias c
              where c.data_saldo_inicial <= p_data + 1 and (p_fonte is null or c.fonte_id = p_fonte)), 0)
  + coalesce((select sum(r.valor_recebido) from public.receitas r join public.contas_bancarias c on c.id = r.conta_id
              where r.status = 'recebida' and r.data_recebimento <= p_data and r.data_recebimento >= c.data_saldo_inicial
                and (p_fonte is null or r.fonte_id = p_fonte)), 0)
  - coalesce((select sum(p.valor) from public.pagamentos p
              join public.despesas d on d.id = p.despesa_id
              join public.contas_bancarias c on c.id = p.conta_id
              where not p.estornado and p.data_pagamento <= p_data and p.data_pagamento >= c.data_saldo_inicial
                and (p_fonte is null or d.fonte_id = p_fonte)), 0)
$$;

create or replace function public._saldo_conta_em(p_conta uuid, p_data date)
returns numeric language sql stable security definer set search_path = public
as $$
  select c.saldo_inicial
    + coalesce((select sum(r.valor_recebido) from public.receitas r where r.conta_id = c.id and r.status = 'recebida'
                and r.data_recebimento between c.data_saldo_inicial and p_data), 0)
    - coalesce((select sum(p.valor) from public.pagamentos p where p.conta_id = c.id and not p.estornado
                and p.data_pagamento between c.data_saldo_inicial and p_data), 0)
  from public.contas_bancarias c where c.id = p_conta
$$;

create or replace function public.saldos_contas(p_data date default current_date)
returns table (conta_id uuid, conta text, fonte text, saldo_inicial numeric, entradas numeric, saidas numeric,
               saldo_contabil numeric, saldo_extrato numeric, data_extrato date, diferenca numeric)
language sql stable security definer set search_path = public
as $$
  select c.id, c.nome, f.nome, c.saldo_inicial,
    coalesce(e.v, 0), coalesce(s.v, 0),
    c.saldo_inicial + coalesce(e.v, 0) - coalesce(s.v, 0),
    x.saldo_final, x.data_fim,
    case when x.saldo_final is null then null
         else x.saldo_final - public._saldo_conta_em(c.id, x.data_fim) end
  from public.contas_bancarias c
  left join public.fontes_recurso f on f.id = c.fonte_id
  left join lateral (select sum(r.valor_recebido) v from public.receitas r where r.conta_id = c.id and r.status = 'recebida'
                     and r.data_recebimento between c.data_saldo_inicial and p_data) e on true
  left join lateral (select sum(p.valor) v from public.pagamentos p where p.conta_id = c.id and not p.estornado
                     and p.data_pagamento between c.data_saldo_inicial and p_data) s on true
  left join lateral (select ex.saldo_final, ex.data_fim from public.extratos ex where ex.conta_id = c.id
                     and ex.status = 'concluida' and ex.data_fim <= p_data order by ex.data_fim desc limit 1) x on true
  where public.tem_papel('admin', 'financeiro', 'conferente')
  order by c.nome
$$;


-- ---------------------------------------------------------------------
-- Execução orçamentária
-- ---------------------------------------------------------------------
create view public.v_execucao_orcamentaria with (security_invoker = true) as
select
  oi.id, oi.fonte_id, f.nome as fonte, f.vinculado, oi.categoria_id, c.nome as categoria, oi.meta_id,
  oi.descricao, oi.validade_inicio, oi.validade_fim, oi.documento_ref, oi.alerta_percentual,
  c.nome || ' — ' || f.nome || ' (' || to_char(oi.validade_inicio, 'DD/MM/YY') || ' a ' || to_char(oi.validade_fim, 'DD/MM/YY') || ')' as rotulo,
  oi.valor_aprovado,
  coalesce(oi.valor_revisado, oi.valor_aprovado) as valor_atualizado,
  coalesce(ex.v, 0)::numeric(14,2) as executado,
  coalesce(co.v, 0)::numeric(14,2) as comprometido,
  (coalesce(oi.valor_revisado, oi.valor_aprovado) - coalesce(ex.v, 0) - coalesce(co.v, 0))::numeric(14,2) as saldo,
  case when coalesce(oi.valor_revisado, oi.valor_aprovado) = 0 then null
       else round(coalesce(ex.v, 0) * 100 / coalesce(oi.valor_revisado, oi.valor_aprovado), 2) end as percentual_executado,
  case when coalesce(oi.valor_revisado, oi.valor_aprovado) = 0 then null
       else round((coalesce(ex.v, 0) + coalesce(co.v, 0)) * 100 / coalesce(oi.valor_revisado, oi.valor_aprovado), 2) end as percentual_comprometido
from public.orcamento_itens oi
join public.fontes_recurso f on f.id = oi.fonte_id
join public.categorias c on c.id = oi.categoria_id
left join lateral (
  select sum(p.valor) v from public.pagamentos p join public.despesas d on d.id = p.despesa_id
  where not p.estornado and d.fonte_id = oi.fonte_id and d.categoria_id = oi.categoria_id
    and p.data_pagamento between oi.validade_inicio and oi.validade_fim) ex on true
left join lateral (
  select sum(d.valor_total - d.valor_pago) v from public.despesas d
  where d.status in ('contratada', 'lancada', 'aprovada') and d.fonte_id = oi.fonte_id and d.categoria_id = oi.categoria_id
    and coalesce(d.data_compra, d.data_emissao, d.data_vencimento) between oi.validade_inicio and oi.validade_fim) co on true;

-- ---------------------------------------------------------------------
-- Suspeitas de duplicidade (para revisão humana)
-- ---------------------------------------------------------------------
create view public.v_despesas_duplicadas with (security_invoker = true) as
select a.id as despesa_a, a.codigo as codigo_a, b.id as despesa_b, b.codigo as codigo_b,
       a.valor_total, fo.nome as fornecedor,
       coalesce(a.data_compra, a.data_emissao, a.data_vencimento) as data_a,
       coalesce(b.data_compra, b.data_emissao, b.data_vencimento) as data_b,
       case when lower(a.numero_documento_fiscal) = lower(b.numero_documento_fiscal) then 'Mesmo número de documento fiscal'
            else 'Mesmo fornecedor e valor em datas próximas' end as motivo
from public.despesas a
join public.despesas b on a.id < b.id
  and a.status <> 'cancelada' and b.status <> 'cancelada'
  and a.valor_total = b.valor_total
  and a.fornecedor_id is not distinct from b.fornecedor_id
  and (lower(a.numero_documento_fiscal) = lower(b.numero_documento_fiscal)
       or abs(coalesce(a.data_compra, a.data_emissao, a.data_vencimento)
            - coalesce(b.data_compra, b.data_emissao, b.data_vencimento)) <= 3)
left join public.fornecedores fo on fo.id = a.fornecedor_id
where not exists (select 1 from public.duplicidades_revisadas r
                  where (r.despesa_a = a.id and r.despesa_b = b.id) or (r.despesa_a = b.id and r.despesa_b = a.id));

-- ---------------------------------------------------------------------
-- Alertas (indicam necessidade de revisão; nunca declaram irregularidade)
-- ---------------------------------------------------------------------
create view public.v_alertas with (security_invoker = true) as
select 'comprovante_ausente'::text as tipo, 'atencao'::text as gravidade,
       'Despesa com documentação ' || case d.situacao_documental when 'sem_documentos' then 'ausente' else 'incompleta' end
         || ': ' || d.descricao as mensagem,
       'despesa'::text as entidade, d.id as registro_id, d.codigo,
       coalesce(d.data_compra, d.data_emissao, d.data_vencimento) as data
from public.despesas d
where d.status not in ('prevista', 'cancelada', 'reembolsada') and d.situacao_documental in ('sem_documentos', 'incompleta')
union all
select 'documento_rejeitado', 'critico', 'Documento devolvido para correção: ' || d.descricao, 'despesa', d.id, d.codigo,
       coalesce(d.data_compra, d.data_emissao, d.data_vencimento)
from public.despesas d where d.situacao_documental = 'rejeitada' and d.status <> 'cancelada'
union all
select 'sem_categoria', 'atencao', 'Despesa sem categoria: ' || d.descricao, 'despesa', d.id, d.codigo,
       coalesce(d.data_compra, d.data_emissao, d.data_vencimento)
from public.despesas d where d.categoria_id is null and d.status <> 'cancelada'
union all
select 'sem_beneficiario', 'atencao', 'Despesa sem fornecedor/beneficiário identificado: ' || d.descricao, 'despesa', d.id, d.codigo,
       coalesce(d.data_compra, d.data_emissao, d.data_vencimento)
from public.despesas d where d.fornecedor_id is null and d.status not in ('prevista', 'cancelada')
union all
select 'orcamento', case when e.percentual_comprometido > 100 then 'critico' else 'atencao' end,
       'Orçamento de "' || e.categoria || '" (' || e.fonte || ') em ' || e.percentual_comprometido || '% (executado + comprometido)',
       'orcamento', e.id, null, e.validade_fim
from public.v_execucao_orcamentaria e where e.percentual_comprometido >= e.alerta_percentual
union all
select 'duplicidade', 'atencao', 'Possível lançamento duplicado: ' || x.codigo_a || ' e ' || x.codigo_b || ' (' || x.motivo || ')',
       'despesa', x.despesa_a, x.codigo_a, x.data_a
from public.v_despesas_duplicadas x
union all
select 'conciliacao', 'atencao',
       'Extrato de ' || to_char(e.data_inicio, 'DD/MM/YYYY') || ' a ' || to_char(e.data_fim, 'DD/MM/YYYY') || ' com ' ||
       (select count(*) from public.extrato_linhas l where l.extrato_id = e.id and l.status = 'pendente') || ' linha(s) sem conciliação',
       'extrato', e.id, null, e.data_fim
from public.extratos e
where e.status = 'em_andamento' and exists (select 1 from public.extrato_linhas l where l.extrato_id = e.id and l.status = 'pendente')
union all
select 'conciliacao', 'critico',
       'Extrato importado não fecha: saldo inicial + movimentos difere do saldo final em R$ ' ||
       to_char(e.saldo_final - e.saldo_inicial - coalesce((select sum(valor) from public.extrato_linhas l where l.extrato_id = e.id), 0), 'FM999G999G990D00'),
       'extrato', e.id, null, e.data_fim
from public.extratos e
where e.saldo_final <> e.saldo_inicial + coalesce((select sum(valor) from public.extrato_linhas l where l.extrato_id = e.id), 0)
union all
select 'prazo', case when o.prazo < current_date then 'critico' else 'atencao' end,
       case when o.prazo < current_date then 'Prazo vencido: ' else 'Prazo próximo: ' end || o.titulo || ' (' || to_char(o.prazo, 'DD/MM/YYYY') || ')',
       'obrigacao', o.id, null, o.prazo
from public.obrigacoes o
where o.status not in ('enviada', 'aprovada', 'aprovada_com_ressalvas', 'concluida') and o.prazo - current_date <= o.alerta_dias
union all
select 'receita_atrasada', 'atencao', 'Receita prevista e não recebida: ' || r.descricao, 'receita', r.id, r.codigo, r.data_prevista
from public.receitas r where r.status = 'prevista' and r.data_prevista < current_date
union all
select 'regra_orcamento', 'atencao', 'Categoria sem previsão no orçamento da fonte "' || f.nome || '": ' || d.descricao,
       'despesa', d.id, d.codigo, coalesce(d.data_compra, d.data_emissao, d.data_vencimento)
from public.despesas d join public.fontes_recurso f on f.id = d.fonte_id
where d.status not in ('cancelada', 'prevista') and d.categoria_id is not null
  and exists (select 1 from public.orcamento_itens oi where oi.fonte_id = d.fonte_id)
  and not exists (select 1 from public.orcamento_itens oi where oi.fonte_id = d.fonte_id and oi.categoria_id = d.categoria_id)
union all
select 'regra_vigencia', 'atencao', 'Despesa fora da vigência do instrumento "' || coalesce(i.numero, i.tipo) || '": ' || d.descricao,
       'despesa', d.id, d.codigo, coalesce(d.data_compra, d.data_emissao, d.data_vencimento)
from public.despesas d join public.instrumentos i on i.id = d.instrumento_id
where d.status <> 'cancelada'
  and (coalesce(d.data_compra, d.data_emissao, d.data_vencimento) < i.data_inicio
       or coalesce(d.data_compra, d.data_emissao, d.data_vencimento) > i.data_fim);

-- ---------------------------------------------------------------------
-- Dashboard financeiro
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumo(p_inicio date, p_fim date, p_fonte uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v jsonb;
  v_saldo_ini numeric; v_saldo_fim numeric; v_receb numeric; v_pago numeric;
  v_a_pagar numeric; v_compromissos numeric; v_a_receber numeric; v_atrasadas numeric;
  v_conciliado numeric; v_data_conc date;
begin
  if not public.eh_equipe() then raise exception 'Acesso restrito à equipe do projeto.'; end if;

  v_saldo_ini := public.saldo_contabil_em(p_inicio - 1, p_fonte);
  v_saldo_fim := public.saldo_contabil_em(p_fim, p_fonte);

  select coalesce(sum(valor_recebido), 0) into v_receb from public.receitas
  where status = 'recebida' and data_recebimento between p_inicio and p_fim and (p_fonte is null or fonte_id = p_fonte);

  select coalesce(sum(p.valor), 0) into v_pago from public.pagamentos p join public.despesas d on d.id = p.despesa_id
  where not p.estornado and p.data_pagamento between p_inicio and p_fim and (p_fonte is null or d.fonte_id = p_fonte);

  select coalesce(sum(valor_total - valor_pago) filter (where status in ('lancada', 'aprovada')), 0),
         coalesce(sum(valor_total - valor_pago) filter (where status in ('contratada', 'lancada', 'aprovada')), 0)
    into v_a_pagar, v_compromissos
  from public.despesas
  where coalesce(data_compra, data_emissao, data_vencimento) <= p_fim and (p_fonte is null or fonte_id = p_fonte);

  select coalesce(sum(valor_previsto) filter (where data_prevista between p_inicio and p_fim), 0),
         coalesce(sum(valor_previsto) filter (where data_prevista < least(current_date, p_fim + 1)), 0)
    into v_a_receber, v_atrasadas
  from public.receitas where status = 'prevista' and (p_fonte is null or fonte_id = p_fonte);

  select sum(x.saldo_final), max(x.data_fim) into v_conciliado, v_data_conc
  from public.contas_bancarias c
  join lateral (select ex.saldo_final, ex.data_fim from public.extratos ex where ex.conta_id = c.id and ex.status = 'concluida'
                and ex.data_fim <= p_fim order by ex.data_fim desc limit 1) x on true
  where p_fonte is null or c.fonte_id = p_fonte;

  v := jsonb_build_object(
    'saldo_inicial', v_saldo_ini,
    'receitas_recebidas', v_receb,
    'despesas_pagas', v_pago,
    'saldo_contabil', v_saldo_fim,
    'despesas_a_pagar', v_a_pagar,
    'compromissos', v_compromissos,
    'saldo_disponivel', v_saldo_fim - v_compromissos,
    'receitas_a_receber', v_a_receber,
    'receitas_atrasadas', v_atrasadas,
    'saldo_bancario_conciliado', v_conciliado,
    'data_conciliacao', v_data_conc,
    'saldos_vinculados', coalesce((
      select jsonb_agg(jsonb_build_object('fonte_id', f.id, 'fonte', f.nome, 'saldo', public.saldo_contabil_em(p_fim, f.id)) order by f.nome)
      from public.fontes_recurso f where f.vinculado and (p_fonte is null or f.id = p_fonte)), '[]'::jsonb),
    'documentacao', (
      select jsonb_build_object(
        'com_comprovantes_qtd', count(*) filter (where situacao_documental in ('aguardando_conferencia', 'validada')),
        'com_comprovantes_valor', coalesce(sum(valor_total) filter (where situacao_documental in ('aguardando_conferencia', 'validada')), 0),
        'pendentes_qtd', count(*) filter (where situacao_documental in ('sem_documentos', 'incompleta', 'rejeitada')),
        'pendentes_valor', coalesce(sum(valor_total) filter (where situacao_documental in ('sem_documentos', 'incompleta', 'rejeitada')), 0),
        'por_situacao', coalesce((select jsonb_object_agg(s, n) from (
            select situacao_documental s, count(*) n from public.despesas d2
            where d2.status not in ('prevista', 'cancelada', 'reembolsada')
              and coalesce(d2.data_compra, d2.data_emissao, d2.data_vencimento) between p_inicio and p_fim
              and (p_fonte is null or d2.fonte_id = p_fonte)
            group by 1) z), '{}'::jsonb))
      from public.despesas
      where status not in ('prevista', 'cancelada', 'reembolsada')
        and coalesce(data_compra, data_emissao, data_vencimento) between p_inicio and p_fim
        and (p_fonte is null or fonte_id = p_fonte)),
    'orcamento', (
      select jsonb_build_object('aprovado', coalesce(sum(valor_aprovado), 0), 'atualizado', coalesce(sum(valor_atualizado), 0),
             'executado', coalesce(sum(executado), 0), 'comprometido', coalesce(sum(comprometido), 0),
             'percentual', case when coalesce(sum(valor_atualizado), 0) = 0 then null
                                else round(sum(executado) * 100 / sum(valor_atualizado), 2) end)
      from public.v_execucao_orcamentaria
      where validade_inicio <= p_fim and validade_fim >= p_inicio and (p_fonte is null or fonte_id = p_fonte)),
    'pendentes_conferencia',
      (select count(*) from public.receitas where conferencia in ('pendente', 'em_analise') and status <> 'cancelada'
         and (p_fonte is null or fonte_id = p_fonte))
      + (select count(*) from public.despesas where conferencia in ('pendente', 'em_analise') and status <> 'cancelada'
         and (p_fonte is null or fonte_id = p_fonte)),
    'doacoes_bens_estimado', (select coalesce(sum(valor_estimado), 0) from public.doacoes_bens
                              where status <> 'cancelado' and data_recebimento between p_inicio and p_fim)
  );
  return v;
end $$;

create or replace function public.serie_mensal(p_inicio date, p_fim date, p_fonte uuid default null)
returns table (mes date, receitas numeric, despesas numeric, saldo_final numeric)
language sql stable security definer set search_path = public
as $$
  select m::date,
    coalesce((select sum(valor_recebido) from public.receitas r where r.status = 'recebida'
              and r.data_recebimento between greatest(m::date, p_inicio) and least((m + interval '1 month - 1 day')::date, p_fim)
              and (p_fonte is null or r.fonte_id = p_fonte)), 0),
    coalesce((select sum(p.valor) from public.pagamentos p join public.despesas d on d.id = p.despesa_id
              where not p.estornado
              and p.data_pagamento between greatest(m::date, p_inicio) and least((m + interval '1 month - 1 day')::date, p_fim)
              and (p_fonte is null or d.fonte_id = p_fonte)), 0),
    public.saldo_contabil_em(least((m + interval '1 month - 1 day')::date, p_fim), p_fonte)
  from generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') m
  where public.eh_equipe()
$$;

create or replace function public.despesas_por_categoria(p_inicio date, p_fim date, p_fonte uuid default null)
returns table (categoria_id uuid, categoria text, valor numeric)
language sql stable security definer set search_path = public
as $$
  select d.categoria_id, coalesce(c.nome, 'Sem categoria'), sum(p.valor)
  from public.pagamentos p
  join public.despesas d on d.id = p.despesa_id
  left join public.categorias c on c.id = d.categoria_id
  where not p.estornado and p.data_pagamento between p_inicio and p_fim
    and (p_fonte is null or d.fonte_id = p_fonte) and public.eh_equipe()
  group by 1, 2 order by 3 desc
$$;

-- ---------------------------------------------------------------------
-- Painel social (somente números agregados; sem dados pessoais)
-- ---------------------------------------------------------------------
create or replace function public.resumo_social(p_inicio date, p_fim date)
returns jsonb language sql stable security definer set search_path = public
as $$
  select case when not public.eh_equipe() then null else jsonb_build_object(
    'atividades', (select count(*) from public.atividades where data between p_inicio and p_fim),
    'atendimentos', (select coalesce(sum(participantes_qtd), 0) from public.atividades where data between p_inicio and p_fim),
    'participacoes_nominais', (select count(*) from public.participacoes pa join public.atividades a on a.id = pa.atividade_id
                               where a.data between p_inicio and p_fim),
    'participantes_unicos', (select count(distinct pa.beneficiario_id) from public.participacoes pa
                             join public.atividades a on a.id = pa.atividade_id where a.data between p_inicio and p_fim),
    'por_bairro', coalesce((select jsonb_agg(jsonb_build_object('bairro', b, 'atividades', n, 'atendimentos', t))
                   from (select coalesce(bairro, 'Não informado') b, count(*) n, sum(participantes_qtd) t
                         from public.atividades where data between p_inicio and p_fim group by 1 order by 2 desc) x), '[]'),
    'por_tipo', coalesce((select jsonb_agg(jsonb_build_object('tipo', tp, 'atividades', n, 'atendimentos', t))
                 from (select tipo tp, count(*) n, sum(participantes_qtd) t
                       from public.atividades where data between p_inicio and p_fim group by 1 order by 2 desc) x), '[]'),
    'por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', m, 'atividades', n, 'atendimentos', t) order by m)
                from (select date_trunc('month', data)::date m, count(*) n, sum(participantes_qtd) t
                      from public.atividades where data between p_inicio and p_fim group by 1) x), '[]'),
    'metas', coalesce((select jsonb_agg(jsonb_build_object('meta', me.descricao, 'indicador', me.indicador, 'valor_meta', me.valor_meta,
                 'unidade', me.unidade, 'atividades', (select count(*) from public.atividades a where a.meta_id = me.id and a.data between p_inicio and p_fim),
                 'atendimentos', (select coalesce(sum(a.participantes_qtd), 0) from public.atividades a where a.meta_id = me.id and a.data between p_inicio and p_fim)))
                 from public.metas me where me.ativo), '[]')
  ) end
$$;

-- ---------------------------------------------------------------------
-- Transparência pública (site): só períodos marcados para publicação,
-- só totais agregados, sem nomes de doadores, fornecedores ou crianças
-- ---------------------------------------------------------------------
create or replace function public.transparencia_publica()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce((select (valor ->> 'mostrar_transparencia')::boolean from public.configuracoes where chave = 'site'), false) = false then
    return jsonb_build_object('ativo', false);
  end if;
  return jsonb_build_object(
    'ativo', true,
    'periodos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', pe.nome, 'inicio', pe.data_inicio, 'fim', pe.data_fim, 'fechado', pe.status = 'fechado',
        'receitas', (select coalesce(sum(valor_recebido), 0) from public.receitas r
                     where r.status = 'recebida' and r.data_recebimento between pe.data_inicio and pe.data_fim),
        'despesas', (select coalesce(sum(p.valor), 0) from public.pagamentos p
                     where not p.estornado and p.data_pagamento between pe.data_inicio and pe.data_fim),
        'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', cat, 'valor', v) order by v desc) from (
            select coalesce(c.nome, 'Outras') cat, sum(p.valor) v from public.pagamentos p
            join public.despesas d on d.id = p.despesa_id left join public.categorias c on c.id = d.categoria_id
            where not p.estornado and p.data_pagamento between pe.data_inicio and pe.data_fim group by 1) z), '[]'),
        'atividades', (select count(*) from public.atividades a where a.data between pe.data_inicio and pe.data_fim),
        'atendimentos', (select coalesce(sum(participantes_qtd), 0) from public.atividades a where a.data between pe.data_inicio and pe.data_fim)
      ) order by pe.data_inicio desc)
      from public.periodos pe where pe.publicar_transparencia), '[]'),
    'atividades_recentes', coalesce((
      select jsonb_agg(x order by x.data desc) from (
        select a.data, a.titulo, a.tipo, a.bairro, a.descricao, a.participantes_qtd
        from public.atividades a where a.publicar order by a.data desc limit 12) x), '[]')
  );
end $$;

grant execute on function public.transparencia_publica() to anon, authenticated;
revoke execute on function public.saldo_contabil_em(date, uuid) from public, anon;
revoke execute on function public._saldo_conta_em(uuid, date) from public, anon, authenticated;
revoke execute on function public.saldos_contas(date) from public, anon;
revoke execute on function public.dashboard_resumo(date, date, uuid) from public, anon;
revoke execute on function public.serie_mensal(date, date, uuid) from public, anon;
revoke execute on function public.despesas_por_categoria(date, date, uuid) from public, anon;
revoke execute on function public.resumo_social(date, date) from public, anon;
grant execute on function public.saldo_contabil_em(date, uuid), public.saldos_contas(date),
  public.dashboard_resumo(date, date, uuid), public.serie_mensal(date, date, uuid),
  public.despesas_por_categoria(date, date, uuid), public.resumo_social(date, date) to authenticated;
-- saldo_contabil_em é security definer: restringe à equipe
create or replace function public.saldo_contabil_em_seguro(p_data date, p_fonte uuid default null)
returns numeric language sql stable security definer set search_path = public
as $$ select case when public.eh_equipe() then public.saldo_contabil_em(p_data, p_fonte) end $$;
revoke execute on function public.saldo_contabil_em(date, uuid) from authenticated;
grant execute on function public.saldo_contabil_em_seguro(date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dados iniciais (configuração; nenhum dado financeiro é presumido)
-- ---------------------------------------------------------------------
insert into public.projeto (id, nome_oficial, municipio, publico_atendido)
values (1, 'Projeto Pé no Chão', 'Votorantim/SP', null);

insert into public.categorias (tipo, nome, ordem) values
  ('receita', 'Repasse de parceria ou convênio', 1),
  ('receita', 'Doações de pessoas físicas', 2),
  ('receita', 'Doações de empresas', 3),
  ('receita', 'Patrocínios', 4),
  ('receita', 'Campanhas de arrecadação', 5),
  ('receita', 'Eventos beneficentes', 6),
  ('receita', 'Receitas próprias', 7),
  ('receita', 'Rendimentos financeiros', 8),
  ('receita', 'Outras receitas', 9),
  ('despesa', 'Alimentação e lanches', 1),
  ('despesa', 'Cestas básicas e gêneros alimentícios', 2),
  ('despesa', 'Materiais esportivos', 3),
  ('despesa', 'Materiais pedagógicos', 4),
  ('despesa', 'Material de consumo', 5),
  ('despesa', 'Transporte e combustível', 6),
  ('despesa', 'Serviços de terceiros', 7),
  ('despesa', 'Recursos humanos e encargos', 8),
  ('despesa', 'Água, energia, internet e operacionais', 9),
  ('despesa', 'Manutenção e reparos', 10),
  ('despesa', 'Equipamentos e bens permanentes', 11),
  ('despesa', 'Eventos e atividades comunitárias', 12),
  ('despesa', 'Divulgação e comunicação', 13),
  ('despesa', 'Taxas bancárias', 14),
  ('despesa', 'Outras despesas autorizadas', 15);

insert into public.checklist_modelos (item, criterio, obrigatorio, ativo, ordem) values
  ('Documento fiscal ou recibo aceito', 'doc:nota_fiscal|recibo', true, true, 1),
  ('Comprovante de pagamento', 'doc:comprovante_pix|comprovante_transferencia|comprovante_quitacao', true, true, 2),
  ('Identificação do fornecedor (CPF/CNPJ)', 'campo:fornecedor', true, true, 3),
  ('Justificativa da despesa', 'campo:justificativa', true, true, 4),
  ('Autorização prévia de compra', 'doc:autorizacao_compra', true, false, 5),
  ('Cotação ou orçamento', 'doc:orcamento_cotacao', true, false, 6),
  ('Evidência da entrega ou execução', 'doc:foto_produto|lista_materiais|relatorio|foto_atividade', false, true, 7);

insert into public.configuracoes (chave, valor, publico) values
  ('site', jsonb_build_object(
     'pix_chave', null, 'pix_tipo', null, 'pix_nome', null, 'pix_cidade', 'VOTORANTIM',
     'banco_texto', null, 'whatsapp', null, 'instagram', null, 'email', null, 'endereco', null,
     'texto_sobre', null, 'mostrar_transparencia', false,
     'campanha_titulo', null, 'campanha_meta', null, 'campanha_arrecadado', null), true),
  ('status_obrigacoes', '["em_preparacao","em_revisao","aguardando_documentos","pronta_para_envio","enviada","aprovada","aprovada_com_ressalvas","devolvida_para_correcao"]', false),
  ('tipos_atividade', '["Atividade esportiva","Atividade pedagógica","Recreação","Distribuição de alimentos","Evento comunitário","Oficina","Reunião com famílias","Outra"]', false),
  ('bairros', '["Jardim Dandara","Jardim Cerrado"]', false),
  ('upload', '{"tamanho_maximo_mb": 10}', false);
