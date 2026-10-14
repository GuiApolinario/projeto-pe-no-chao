-- =====================================================================
-- DADOS FICTÍCIOS DE DEMONSTRAÇÃO — NÃO EXECUTAR NO PROJETO REAL
--
-- Use em um projeto Supabase SEPARADO (ex.: "pe-no-chao-demo") para
-- treinamento da equipe. Todos os nomes, valores e documentos são inventados
-- e marcados com [DEMO]. Executar no SQL Editor após aplicar as migrações.
-- =====================================================================
do $$
declare
  v_per uuid; v_fonte_livre uuid; v_fonte_termo uuid; v_conta uuid; v_conta_termo uuid;
  v_f1 uuid; v_f2 uuid; v_f3 uuid; v_d uuid; v_a uuid;
  cat_receita_pf uuid := (select id from public.categorias where nome = 'Doações de pessoas físicas');
  cat_receita_rep uuid := (select id from public.categorias where nome = 'Repasse de parceria ou convênio');
  cat_alim uuid := (select id from public.categorias where nome = 'Alimentação e lanches');
  cat_esp uuid := (select id from public.categorias where nome = 'Materiais esportivos');
  cat_ped uuid := (select id from public.categorias where nome = 'Materiais pedagógicos');
begin
  if exists (select 1 from public.receitas) then
    raise exception 'Este banco já possui lançamentos. Os dados de demonstração só podem ser carregados em um projeto vazio.';
  end if;

  update public.projeto set nome_oficial = '[DEMO] Projeto Pé no Chão', entidade_responsavel = '[DEMO] Associação Fictícia',
    responsavel_legal = '[DEMO] Maria Exemplo', responsavel_financeiro = '[DEMO] João Exemplo', responsavel_conferencia = '[DEMO] Ana Exemplo'
  where id = 1;

  insert into public.periodos (nome, data_inicio, data_fim, publicar_transparencia) values ('[DEMO] 1º semestre/2026', '2026-01-01', '2026-06-30', true) returning id into v_per;
  insert into public.periodos (nome, data_inicio, data_fim) values ('[DEMO] 2º semestre/2026', '2026-07-01', '2026-12-31');
  insert into public.instrumentos (tipo, numero, concedente, data_inicio, data_fim, valor_total)
    values ('Termo de fomento', '[DEMO] TF 000/2026', '[DEMO] Prefeitura Fictícia', '2026-01-01', '2026-12-31', 12000);
  insert into public.fontes_recurso (nome, tipo, vinculado) values ('[DEMO] Doações livres', 'privado', false) returning id into v_fonte_livre;
  insert into public.fontes_recurso (nome, tipo, vinculado, instrumento_id) values ('[DEMO] Termo de fomento', 'publico', true,
    (select id from public.instrumentos where numero = '[DEMO] TF 000/2026')) returning id into v_fonte_termo;
  insert into public.contas_bancarias (nome, banco, saldo_inicial, data_saldo_inicial) values ('[DEMO] Conta movimento', 'Banco Fictício', 500, '2026-01-01') returning id into v_conta;
  insert into public.contas_bancarias (nome, banco, saldo_inicial, data_saldo_inicial, fonte_id) values ('[DEMO] Conta do termo', 'Banco Fictício', 0, '2026-01-01', v_fonte_termo) returning id into v_conta_termo;
  insert into public.fornecedores (nome, cpf_cnpj) values ('[DEMO] Mercadinho da Vila', '00.000.000/0001-91') returning id into v_f1;
  insert into public.fornecedores (nome, cpf_cnpj) values ('[DEMO] Esportes Ltda', '11.222.333/0001-81') returning id into v_f2;
  insert into public.fornecedores (nome) values ('[DEMO] Papelaria (sem CNPJ)') returning id into v_f3;

  insert into public.orcamento_itens (fonte_id, categoria_id, valor_aprovado, validade_inicio, validade_fim, documento_ref) values
    (v_fonte_termo, cat_esp, 4000, '2026-01-01', '2026-12-31', '[DEMO] Plano de trabalho'),
    (v_fonte_termo, cat_ped, 3000, '2026-01-01', '2026-12-31', '[DEMO] Plano de trabalho'),
    (v_fonte_livre, cat_alim, 2500, '2026-01-01', '2026-12-31', '[DEMO] Decisão da diretoria');

  insert into public.receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, forma_recebimento, conta_id, fonte_id, origem) values
    ('recebida', '2026-01-15', cat_receita_pf, '[DEMO] Doações via PIX — janeiro', 1250.00, 'PIX', v_conta, v_fonte_livre, 'Campanha fictícia'),
    ('recebida', '2026-02-10', cat_receita_rep, '[DEMO] Repasse parcela 1/2', 6000.00, 'Transferência', v_conta_termo, v_fonte_termo, 'Prefeitura fictícia'),
    ('recebida', '2026-03-12', cat_receita_pf, '[DEMO] Doações via PIX — março', 830.50, 'PIX', v_conta, v_fonte_livre, 'Campanha fictícia');
  insert into public.receitas (status, data_prevista, categoria_id, descricao, valor_previsto, fonte_id, parcela_numero, parcela_total) values
    ('prevista', '2026-08-10', cat_receita_rep, '[DEMO] Repasse parcela 2/2', 6000.00, v_fonte_termo, 2, 2);

  insert into public.despesas (status, data_compra, fornecedor_id, descricao, categoria_id, quantidade, valor_unitario, fonte_id, numero_documento_fiscal, justificativa, conta_id, forma_pagamento)
    values ('aprovada', '2026-02-20', v_f2, '[DEMO] Bolas de futebol', cat_esp, 10, 89.90, v_fonte_termo, 'DEMO-NF-1', 'Treinos semanais', v_conta_termo, 'PIX') returning id into v_d;
  insert into public.pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values (v_d, '2026-02-21', 899.00, 'PIX', v_conta_termo);
  insert into public.despesas (status, data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id, justificativa, conta_id, forma_pagamento)
    values ('aprovada', '2026-03-05', v_f1, '[DEMO] Lanches do mês', cat_alim, 420.00, v_fonte_livre, 'Lanche das atividades', v_conta, 'PIX') returning id into v_d;
  insert into public.pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values (v_d, '2026-03-06', 200.00, 'PIX', v_conta);
  insert into public.despesas (status, data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id)
    values ('lancada', '2026-04-02', v_f3, '[DEMO] Cartolinas e tintas (sem nota — gera alerta)', cat_ped, 150.00, v_fonte_termo);

  insert into public.atividades (data, bairro, tipo, titulo, descricao, participantes_qtd, publicar) values
    ('2026-02-28', 'Jardim Dandara', 'Atividade esportiva', '[DEMO] Torneio de futebol', 'Atividade fictícia de demonstração.', 35, true),
    ('2026-03-20', 'Jardim Cerrado', 'Oficina', '[DEMO] Oficina de pintura', 'Atividade fictícia de demonstração.', 22, true);
  insert into public.necessidades (titulo, prioridade) values ('[DEMO] Leite em pó', 'alta'), ('[DEMO] Bolas e cones', 'media');
  insert into public.obrigacoes (titulo, prazo, status, alerta_dias) values ('[DEMO] Prestação de contas parcial', '2026-07-31', 'em_preparacao', 30);
end $$;
