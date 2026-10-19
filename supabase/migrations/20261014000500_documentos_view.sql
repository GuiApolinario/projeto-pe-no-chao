-- Visão da Central de Comprovantes: cada documento com o lançamento a que comprova
-- (despesa direta ou via pagamento), para filtrar por mês, categoria, fornecedor e valor.
create view public.v_documentos with (security_invoker = true) as
select
  doc.*,
  coalesce(v.qtd, 0)::int as vinculos,
  dsp.id as despesa_id, dsp.codigo as despesa_codigo, dsp.descricao as despesa_descricao,
  dsp.categoria_id, cat.nome as categoria, dsp.fornecedor_id, fo.nome as fornecedor,
  rec.id as receita_id, rec.codigo as receita_codigo,
  -- data usada para filtros e organização em pastas: a do documento, senão a do lançamento
  coalesce(doc.data_documento, dsp.data_compra, dsp.data_emissao, dsp.data_vencimento, rec.data, doc.enviado_em::date) as data_referencia
from public.documentos doc
left join lateral (select count(*) qtd from public.documento_vinculos x where x.documento_id = doc.id) v on true
left join lateral (
  select d.* from public.documento_vinculos x
  left join public.pagamentos p on x.entidade = 'pagamento' and p.id = x.registro_id
  join public.despesas d on d.id = case when x.entidade = 'despesa' then x.registro_id else p.despesa_id end
  where x.documento_id = doc.id and x.entidade in ('despesa', 'pagamento')
  limit 1) dsp on true
left join lateral (
  select r.id, r.codigo, coalesce(r.data_recebimento, r.data_prevista) as data from public.documento_vinculos x join public.receitas r on r.id = x.registro_id
  where x.documento_id = doc.id and x.entidade = 'receita' limit 1) rec on true
left join public.categorias cat on cat.id = dsp.categoria_id
left join public.fornecedores fo on fo.id = dsp.fornecedor_id;

-- Responsáveis pela conciliação (permite exibir o nome de quem realizou e conferiu)
alter table public.extratos
  add constraint extratos_realizado_por_fkey foreign key (realizado_por) references public.perfis(id),
  add constraint extratos_conferido_por_fkey foreign key (conferido_por) references public.perfis(id);
