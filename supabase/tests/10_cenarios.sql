-- =====================================================================
-- Cenários obrigatórios de teste (item 20 do escopo)
-- Executados como os papéis reais (authenticated/anon) com RLS ativo.
-- =====================================================================
\set QUIET on
set client_min_messages = notice;

create schema teste;
grant usage on schema teste to anon, authenticated;

-- entra como um usuário (ou anônimo quando p_id é null)
create function teste.como(p_id uuid) returns void language plpgsql as $$
begin
  if p_id is null then
    perform set_config('request.jwt.claims', '{}', false);
    execute 'set role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_id)::text, false);
    execute 'set role authenticated';
  end if;
end $$;

-- executa um comando que DEVE falhar com a mensagem esperada
create function teste.deve_falhar(p_sql text, p_trecho text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_trecho) in lower(sqlerrm)) = 0 then
      raise exception 'Falhou com mensagem inesperada. Esperado "%", obtido "%". SQL: %', p_trecho, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'Deveria ter falhado ("%"): %', p_trecho, p_sql;
end $$;

create function teste.igual(p_obtido anyelement, p_esperado anyelement, p_desc text) returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception 'FALHA [%]: esperado %, obtido %', p_desc, p_esperado, p_obtido;
  end if;
  raise notice 'ok - %', p_desc;
end $$;
grant execute on all functions in schema teste to anon, authenticated;

-- Usuários (o primeiro vira admin automaticamente)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste'),
  ('00000000-0000-0000-0000-00000000000f', 'financeiro@teste'),
  ('00000000-0000-0000-0000-00000000000c', 'conferente@teste'),
  ('00000000-0000-0000-0000-00000000000b', 'visualizador@teste'),
  ('00000000-0000-0000-0000-00000000000d', 'atividades@teste');

select teste.igual((select papel::text from perfis where email = 'admin@teste'), 'admin', 'primeiro usuário vira admin');
select teste.igual((select papel::text from perfis where email = 'financeiro@teste'), 'visualizador', 'demais usuários entram como visualizador');

-- IDs fixos para facilitar
\set ADMIN '\'00000000-0000-0000-0000-00000000000a\''
\set FIN '\'00000000-0000-0000-0000-00000000000f\''
\set CONF '\'00000000-0000-0000-0000-00000000000c\''
\set VIS '\'00000000-0000-0000-0000-00000000000b\''
\set ATV '\'00000000-0000-0000-0000-00000000000d\''

-- ---------------------------------------------------------------------
-- Permissões: só admin altera papéis
-- ---------------------------------------------------------------------
select teste.como(:FIN);
update perfis set papel = 'admin' where id = :FIN;  -- sem efeito (RLS)
reset role;
select teste.igual((select papel::text from perfis where id = :FIN), 'visualizador', 'usuário não promove a si mesmo');

select teste.como(:ADMIN);
update perfis set papel = 'financeiro' where id = :FIN;
update perfis set papel = 'conferente' where id = :CONF;
update perfis set papel = 'atividades' where id = :ATV;
select teste.deve_falhar($$update perfis set papel = 'visualizador' where id = '00000000-0000-0000-0000-00000000000a'$$, 'último administrador');

-- ---------------------------------------------------------------------
-- Configuração: período, fontes, contas, fornecedores
-- ---------------------------------------------------------------------
insert into periodos (id, nome, data_inicio, data_fim) values
  ('11111111-0000-0000-0000-000000000001', '1º semestre/2026', '2026-01-01', '2026-06-30'),
  ('11111111-0000-0000-0000-000000000002', '2º semestre/2026', '2026-07-01', '2026-12-31');
insert into fontes_recurso (id, nome, tipo, vinculado) values
  ('22222222-0000-0000-0000-000000000001', 'Doações (livre)', 'privado', false),
  ('22222222-0000-0000-0000-000000000002', 'Termo de Fomento (teste)', 'publico', true);
insert into contas_bancarias (id, nome, banco, agencia, numero_conta, saldo_inicial, data_saldo_inicial, fonte_id) values
  ('33333333-0000-0000-0000-000000000001', 'Conta movimento', 'Banco X', '0001', '12345-6', 1000.00, '2026-01-01', null),
  ('33333333-0000-0000-0000-000000000002', 'Conta exclusiva fomento', 'Banco Y', '0002', '99999-0', 0, '2026-01-01',
   '22222222-0000-0000-0000-000000000002');
insert into fornecedores (id, nome, cpf_cnpj) values
  ('44444444-0000-0000-0000-000000000001', 'Mercado Bom Preço', '11.111.111/0001-11'),
  ('44444444-0000-0000-0000-000000000002', 'Loja de Esportes', '22.222.222/0001-22'),
  ('44444444-0000-0000-0000-000000000003', 'Sem documento', null);

-- ---------------------------------------------------------------------
-- 1) Cadastro de receita e atualização do saldo
-- ---------------------------------------------------------------------
select teste.como(:FIN);
insert into receitas (id, status, data_recebimento, categoria_id, descricao, valor_recebido, forma_recebimento, conta_id, fonte_id)
values ('55555555-0000-0000-0000-000000000001', 'recebida', '2026-02-10',
        (select id from categorias where nome = 'Doações de pessoas físicas'), 'Doações via PIX fevereiro',
        5000.00, 'PIX', '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001');
select teste.igual((select periodo_id from receitas where id = '55555555-0000-0000-0000-000000000001'),
                   '11111111-0000-0000-0000-000000000001'::uuid, 'período atribuído automaticamente pela data');
select teste.igual(saldo_contabil_em_seguro('2026-02-28'), 6000.00::numeric, 'saldo = inicial 1000 + receita 5000');

-- receita prevista não entra no saldo
insert into receitas (status, data_prevista, categoria_id, descricao, valor_previsto, fonte_id, parcela_numero, parcela_total)
values ('prevista', '2026-03-15', (select id from categorias where nome = 'Repasse de parceria ou convênio'),
        'Parcela 1/2 do termo', 2000.00, '22222222-0000-0000-0000-000000000002', 1, 2);
select teste.igual(saldo_contabil_em_seguro('2026-03-31'), 6000.00::numeric, 'receita prevista não altera saldo');

-- receita de uma fonte não entra na conta exclusiva de outra
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id)
  values ('recebida', '2026-02-11', (select id from categorias where nome = 'Doações de empresas'), 'Doação errada', 10,
          '33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001')$$, 'exclusiva de outra fonte');
-- receita recebida exige conta e valor
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, fonte_id)
  values ('recebida', '2026-02-11', (select id from categorias where nome = 'Doações de empresas'), 'Sem conta', 10,
          '22222222-0000-0000-0000-000000000001')$$, 'receita_recebida_completa');
-- categoria de despesa não serve para receita
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id)
  values ('recebida', '2026-02-11', (select id from categorias where nome = 'Taxas bancárias'), 'Categoria errada', 10,
          '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')$$, 'não é uma categoria de receita');

-- ---------------------------------------------------------------------
-- 2) Despesa com nota fiscal e comprovante de pagamento
-- ---------------------------------------------------------------------
insert into despesas (id, data_compra, fornecedor_id, descricao, categoria_id, quantidade, valor_unitario, desconto,
                      fonte_id, numero_documento_fiscal, justificativa, forma_pagamento, conta_id, status)
values ('66666666-0000-0000-0000-000000000001', '2026-02-15', '44444444-0000-0000-0000-000000000001',
        'Lanches para atividade esportiva', (select id from categorias where nome = 'Alimentação e lanches'),
        10, 25.50, 5.00, '22222222-0000-0000-0000-000000000001', 'NF-1001', 'Lanche das crianças no treino', 'PIX',
        '33333333-0000-0000-0000-000000000001', 'aprovada');
select teste.igual((select valor_total from despesas where id = '66666666-0000-0000-0000-000000000001'), 250.00::numeric,
                   'valor total = 10 × 25,50 − 5,00');
select teste.igual((select situacao_documental from despesas where id = '66666666-0000-0000-0000-000000000001'), 'sem_documentos',
                   'despesa nova sem documentos');
select teste.igual((select count(*)::int from despesa_checklist where despesa_id = '66666666-0000-0000-0000-000000000001'), 5,
                   'checklist gerado com os itens ativos');

insert into documentos (id, storage_path, nome_arquivo, mime_type, tamanho_bytes, tipo_documento, valor) values
  ('77777777-0000-0000-0000-000000000001', '2026/02/nf-1001.pdf', 'nf-1001.pdf', 'application/pdf', 1000, 'nota_fiscal', 250),
  ('77777777-0000-0000-0000-000000000002', '2026/02/pix-1001.jpg', 'pix.jpg', 'image/jpeg', 2000, 'comprovante_pix', 250);
insert into documento_vinculos (documento_id, entidade, registro_id) values
  ('77777777-0000-0000-0000-000000000001', 'despesa', '66666666-0000-0000-0000-000000000001');
select teste.igual((select situacao_documental from despesas where id = '66666666-0000-0000-0000-000000000001'), 'incompleta',
                   'só NF anexada → documentação incompleta');

insert into pagamentos (id, despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('88888888-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '2026-02-16', 250.00, 'PIX',
   '33333333-0000-0000-0000-000000000001');
insert into documento_vinculos (documento_id, entidade, registro_id) values
  ('77777777-0000-0000-0000-000000000002', 'pagamento', '88888888-0000-0000-0000-000000000001');
select teste.igual((select status || '/' || situacao_pagamento || '/' || situacao_documental from despesas
                    where id = '66666666-0000-0000-0000-000000000001'), 'paga/quitada/aguardando_conferencia',
                   'pagamento integral + NF + PIX → paga e aguardando conferência');
select teste.igual(saldo_contabil_em_seguro('2026-02-28'), 5750.00::numeric, 'saldo após pagamento = 6000 − 250');

-- anexar arquivo não valida documento: só a conferência valida
select teste.deve_falhar($$update documentos set status = 'validado' where id = '77777777-0000-0000-0000-000000000001'$$,
                         'função de conferência');
select teste.deve_falhar($$select conferir_documento('77777777-0000-0000-0000-000000000001', 'validado')$$, 'Apenas conferentes');
select teste.como(:CONF);
select conferir_documento('77777777-0000-0000-0000-000000000001', 'validado');
select conferir_documento('77777777-0000-0000-0000-000000000002', 'validado');
reset role;
select teste.igual((select situacao_documental from despesas where id = '66666666-0000-0000-0000-000000000001'), 'validada',
                   'documentos conferidos → documentação validada');
select teste.como(:CONF);
select teste.deve_falhar($$select conferir_documento('77777777-0000-0000-0000-000000000002', 'rejeitado', '')$$, 'motivo da rejeição');
select conferir_documento('77777777-0000-0000-0000-000000000002', 'rejeitado', 'Comprovante ilegível');
reset role;
select teste.igual((select situacao_documental from despesas where id = '66666666-0000-0000-0000-000000000001'), 'rejeitada',
                   'documento rejeitado → despesa devolvida para correção');

-- mesmo documento em outro registro exige justificativa
select teste.como(:FIN);
select teste.deve_falhar($$insert into documento_vinculos (documento_id, entidade, registro_id) values
  ('77777777-0000-0000-0000-000000000001', 'receita', '55555555-0000-0000-0000-000000000001')$$, 'justificativa');

-- ---------------------------------------------------------------------
-- 3) Despesa sem comprovante gera alerta
-- ---------------------------------------------------------------------
insert into despesas (id, data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id, status)
values ('66666666-0000-0000-0000-000000000002', '2026-03-05', '44444444-0000-0000-0000-000000000003',
        'Gás de cozinha', (select id from categorias where nome = 'Material de consumo'), 120.00,
        '22222222-0000-0000-0000-000000000001', 'lancada');
select teste.igual((select count(*)::int from v_alertas where tipo = 'comprovante_ausente'
                    and registro_id = '66666666-0000-0000-0000-000000000002'), 1, 'alerta de comprovante ausente');

-- ---------------------------------------------------------------------
-- 4) Pagamento parcial e quitação posterior
-- ---------------------------------------------------------------------
insert into despesas (id, data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id, status, numero_documento_fiscal)
values ('66666666-0000-0000-0000-000000000003', '2026-03-10', '44444444-0000-0000-0000-000000000002',
        'Bolas e coletes', (select id from categorias where nome = 'Materiais esportivos'), 300.00,
        '22222222-0000-0000-0000-000000000001', 'aprovada', 'NF-77');
insert into pagamentos (id, despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('88888888-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000003', '2026-03-10', 100.00, 'PIX',
   '33333333-0000-0000-0000-000000000001');
select teste.igual((select situacao_pagamento || '/' || valor_pago from despesas where id = '66666666-0000-0000-0000-000000000003'),
                   'parcial/100.00', 'pagamento parcial registrado');
select teste.deve_falhar($$insert into pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('66666666-0000-0000-0000-000000000003', '2026-04-10', 250.00, 'PIX', '33333333-0000-0000-0000-000000000001')$$, 'excede o saldo devedor');
insert into pagamentos (id, despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('88888888-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000003', '2026-04-10', 200.00, 'PIX',
   '33333333-0000-0000-0000-000000000001');
select teste.igual((select status || '/' || situacao_pagamento from despesas where id = '66666666-0000-0000-0000-000000000003'),
                   'paga/quitada', 'quitação posterior → paga');
select teste.deve_falhar($$update despesas set valor_total = 200 where id = '66666666-0000-0000-0000-000000000003'$$, 'menor que o valor já pago');
select teste.deve_falhar($$update pagamentos set valor = 50 where id = '88888888-0000-0000-0000-000000000003'$$, 'não podem ser editados');
-- despesa de fonte livre não pode ser paga pela conta exclusiva do fomento
select teste.deve_falhar($$insert into pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('66666666-0000-0000-0000-000000000002', '2026-03-06', 10, 'PIX', '33333333-0000-0000-0000-000000000002')$$, 'exclusiva de outra fonte');
-- fornecedor obrigatório para pagar
insert into despesas (id, data_compra, descricao, categoria_id, valor_total, fonte_id, status)
values ('66666666-0000-0000-0000-000000000009', '2026-03-07', 'Sem beneficiário', (select id from categorias where nome = 'Material de consumo'),
        15, '22222222-0000-0000-0000-000000000001', 'lancada');
select teste.deve_falhar($$insert into pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('66666666-0000-0000-0000-000000000009', '2026-03-07', 15, 'PIX', '33333333-0000-0000-0000-000000000001')$$, 'Identifique o fornecedor');
select teste.igual((select count(*)::int from v_alertas where tipo = 'sem_beneficiario'), 1, 'alerta de despesa sem beneficiário');

-- ---------------------------------------------------------------------
-- 5) Cancelamento e estorno
-- ---------------------------------------------------------------------
select teste.deve_falhar($$update despesas set status = 'cancelada', cancel_justificativa = 'Compra desfeita pelo fornecedor'
  where id = '66666666-0000-0000-0000-000000000003'$$, 'pagamentos ativos');
select teste.deve_falhar($$update pagamentos set estornado = true where id = '88888888-0000-0000-0000-000000000003'$$, 'estorno_justificado');
update pagamentos set estornado = true, estorno_justificativa = 'PIX devolvido pelo banco' where id = '88888888-0000-0000-0000-000000000003';
select teste.igual((select status || '/' || situacao_pagamento || '/' || valor_pago from despesas
                    where id = '66666666-0000-0000-0000-000000000003'), 'aprovada/parcial/100.00', 'estorno reabre o saldo devedor');
select teste.deve_falhar($$update pagamentos set estornado = false where id = '88888888-0000-0000-0000-000000000003'$$, 'não pode ser desfeito');
delete from despesas where id = '66666666-0000-0000-0000-000000000002';  -- RLS: sem política de exclusão
select teste.igual((select count(*)::int from despesas where id = '66666666-0000-0000-0000-000000000002'), 1, 'exclusão de despesa bloqueada (RLS)');
reset role;
select teste.deve_falhar($$delete from despesas where id = '66666666-0000-0000-0000-000000000002'$$, 'não podem ser excluídos');
select teste.como(:FIN);
select teste.deve_falhar($$update despesas set status = 'cancelada' where id = '66666666-0000-0000-0000-000000000002'$$, 'despesa_cancelamento_justificado');
update despesas set status = 'cancelada', cancel_justificativa = 'Lançada em duplicidade por engano' where id = '66666666-0000-0000-0000-000000000002';
select teste.igual((select cancelado_por from despesas where id = '66666666-0000-0000-0000-000000000002'), :FIN::uuid,
                   'cancelamento registra o responsável');
select teste.deve_falhar($$update despesas set status = 'lancada' where id = '66666666-0000-0000-0000-000000000002'$$, 'não pode ser reativada');

-- ---------------------------------------------------------------------
-- 6) Duplicidades
-- ---------------------------------------------------------------------
select teste.deve_falhar($$insert into despesas (data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id, numero_documento_fiscal)
  values ('2026-03-12', '44444444-0000-0000-0000-000000000002', 'Mesma NF', (select id from categorias where nome = 'Materiais esportivos'),
          300, '22222222-0000-0000-0000-000000000001', 'nf-77')$$, 'despesas_doc_fiscal_unico');
insert into despesas (id, data_compra, fornecedor_id, descricao, categoria_id, valor_total, fonte_id)
values ('66666666-0000-0000-0000-000000000004', '2026-02-17', '44444444-0000-0000-0000-000000000001', 'Lanches (repetido?)',
        (select id from categorias where nome = 'Alimentação e lanches'), 250.00, '22222222-0000-0000-0000-000000000001');
select teste.igual((select count(*)::int from v_despesas_duplicadas), 1, 'suspeita de duplicidade identificada');
insert into duplicidades_revisadas (despesa_a, despesa_b, justificativa) values
  ('66666666-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000004', 'Compras distintas em dias diferentes');
select teste.igual((select count(*)::int from v_despesas_duplicadas), 0, 'revisão humana remove a suspeita');

-- ---------------------------------------------------------------------
-- 7) Orçamento x execução e remanejamento
-- ---------------------------------------------------------------------
insert into orcamento_itens (id, fonte_id, categoria_id, valor_aprovado, validade_inicio, validade_fim) values
  ('99999999-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   (select id from categorias where nome = 'Alimentação e lanches'), 600.00, '2026-01-01', '2026-12-31'),
  ('99999999-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001',
   (select id from categorias where nome = 'Materiais esportivos'), 300.00, '2026-01-01', '2026-12-31'),
  ('99999999-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002',
   (select id from categorias where nome = 'Materiais pedagógicos'), 1000.00, '2026-01-01', '2026-12-31');
select teste.igual((select executado || '/' || comprometido || '/' || saldo from v_execucao_orcamentaria
                    where id = '99999999-0000-0000-0000-000000000001'), '250.00/250.00/100.00',
                   'alimentação: executado 250, comprometido 250 (despesa em aberto), saldo 100');
select teste.igual((select count(*)::int from v_alertas where tipo = 'orcamento'), 2, 'alertas de orçamento ≥ 80%');
select teste.igual((select count(*)::int from v_alertas where tipo = 'regra_orcamento'), 1, 'categoria sem previsão orçamentária na fonte');

select teste.deve_falhar($$insert into remanejamentos (origem_id, destino_id, valor, justificativa) values
  ('99999999-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 100, 'Necessidade de mais lanches')$$, 'recurso vinculado');
insert into remanejamentos (id, origem_id, destino_id, valor, justificativa) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001',
   50, 'Ajuste entre categorias da fonte livre');
select teste.igual((select valor_atualizado from v_execucao_orcamentaria where id = '99999999-0000-0000-0000-000000000001'),
                   600.00::numeric, 'remanejamento solicitado não altera orçamento');
select teste.deve_falhar($$select decidir_remanejamento('aaaaaaaa-0000-0000-0000-000000000001', true, 'ok', 'Ata 1')$$, 'Apenas administradores');
select teste.como(:ADMIN);
select decidir_remanejamento('aaaaaaaa-0000-0000-0000-000000000001', true, 'Aprovado em reunião', 'Ata 03/2026');
select teste.igual((select valor_atualizado from v_execucao_orcamentaria where id = '99999999-0000-0000-0000-000000000001'),
                   650.00::numeric, 'remanejamento autorizado atualiza o orçamento');

-- ---------------------------------------------------------------------
-- 8) Conciliação bancária com diferença identificável
-- ---------------------------------------------------------------------
select teste.como(:FIN);
insert into extratos (id, conta_id, data_inicio, data_fim, saldo_inicial, saldo_final) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '2026-02-01', '2026-02-28', 1000.00, 5745.00);
insert into extrato_linhas (id, extrato_id, data, descricao, valor, fitid) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-02-10', 'PIX RECEBIDO', 5000.00, 'F1'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-02-16', 'PIX ENVIADO MERCADO', -250.00, 'F2'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-02-28', 'TARIFA PACOTE', -5.00, 'F3');
select teste.deve_falhar($$update extrato_linhas set status = 'conciliado', pagamento_id = '88888888-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'diferente do pagamento');
update extrato_linhas set status = 'conciliado', receita_id = '55555555-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-000000000001';
update extrato_linhas set status = 'conciliado', pagamento_id = '88888888-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-000000000002';
select teste.deve_falhar($$insert into extrato_linhas (extrato_id, data, descricao, valor, status, pagamento_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '2026-02-16', 'duplicada', -250.00, 'conciliado', '88888888-0000-0000-0000-000000000001')$$,
  'extrato_linhas_pagamento');
select teste.igual((select count(*)::int from v_alertas where tipo = 'conciliacao'), 1, 'linha sem conciliação gera alerta');
select teste.deve_falhar($$select concluir_conciliacao('bbbbbbbb-0000-0000-0000-000000000001')$$, 'sem conciliação');
-- diferença identificável: tarifa não lançada no sistema
select teste.igual((select diferenca from saldos_contas('2026-02-28') where conta_id = '33333333-0000-0000-0000-000000000001'), null::numeric,
                   'sem extrato concluído não há diferença calculada');
update extrato_linhas set status = 'ignorado', tipo_ajuste = 'tarifa', observacao = 'Tarifa a lançar como despesa bancária'
  where id = 'cccccccc-0000-0000-0000-000000000003';
select concluir_conciliacao('bbbbbbbb-0000-0000-0000-000000000001');
select teste.igual((select diferenca from saldos_contas('2026-02-28') where conta_id = '33333333-0000-0000-0000-000000000001'), -5.00::numeric,
                   'diferença extrato x sistema = −5,00 (tarifa)');
select teste.deve_falhar($$update pagamentos set estornado = true, estorno_justificativa = 'tentativa de estorno conciliado'
  where id = '88888888-0000-0000-0000-000000000001'$$, 'conciliado');

-- ---------------------------------------------------------------------
-- 9) Filtros e totais (por mês, categoria e fonte)
-- ---------------------------------------------------------------------
select teste.igual((select count(*)::int from v_movimentacoes where fonte_id = '22222222-0000-0000-0000-000000000002'), 1,
                   'filtro por fonte (fomento: 1 receita prevista)');
select teste.igual((select sum(valor_realizado) from v_movimentacoes where tipo = 'despesa' and data between '2026-03-01' and '2026-03-31'),
                   100.00::numeric, 'despesas realizadas em março (somente pagamentos ativos)');
select teste.igual((select sum(valor) from despesas_por_categoria('2026-01-01', '2026-12-31')), 350.00::numeric,
                   'despesas por categoria somam os pagamentos ativos (250 + 100)');
select teste.igual((select sum(despesas) from serie_mensal('2026-01-01', '2026-06-30')), 350.00::numeric,
                   'série mensal coincide com os pagamentos');

-- ---------------------------------------------------------------------
-- 10) Dashboard: indicadores coerentes com os registros
-- ---------------------------------------------------------------------
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'saldo_inicial')::numeric, 1000.00, 'dashboard: saldo inicial');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'receitas_recebidas')::numeric, 5000.00, 'dashboard: receitas');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'despesas_pagas')::numeric, 350.00, 'dashboard: despesas pagas');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'saldo_contabil')::numeric, 5650.00, 'dashboard: saldo contábil');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'receitas_a_receber')::numeric, 2000.00, 'dashboard: a receber (não somado ao caixa)');
-- a pagar: 200 (bolas) + 15 (sem beneficiário) + 250 (lanches repetido) = 465
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'despesas_a_pagar')::numeric, 465.00, 'dashboard: despesas a pagar');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'saldo_disponivel')::numeric, 5185.00, 'dashboard: saldo disponível');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30') ->> 'saldo_bancario_conciliado')::numeric, 5745.00, 'dashboard: saldo conciliado');
select teste.igual((dashboard_resumo('2026-01-01', '2026-06-30', '22222222-0000-0000-0000-000000000002') ->> 'despesas_pagas')::numeric, 0.00,
                   'dashboard filtrado por fonte vinculada');

-- ---------------------------------------------------------------------
-- 11) Período fechado protegido
-- ---------------------------------------------------------------------
select fechar_periodo('11111111-0000-0000-0000-000000000001', 'Fechamento do semestre');
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id)
  values ('recebida', '2026-05-01', (select id from categorias where nome = 'Doações de empresas'), 'Após fechamento', 10,
          '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')$$, 'está fechado');
select teste.deve_falhar($$update despesas set descricao = 'alterada' where id = '66666666-0000-0000-0000-000000000001'$$, 'está fechado');
select teste.deve_falhar($$insert into pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('66666666-0000-0000-0000-000000000003', '2026-05-10', 50, 'PIX', '33333333-0000-0000-0000-000000000001')$$, 'período fechado');
-- pagamento em período aberto de despesa de período fechado é permitido (mantém histórico)
insert into pagamentos (despesa_id, data_pagamento, valor, forma_pagamento, conta_id) values
  ('66666666-0000-0000-0000-000000000003', '2026-07-05', 200, 'PIX', '33333333-0000-0000-0000-000000000001');
select teste.igual((select status from despesas where id = '66666666-0000-0000-0000-000000000003'), 'paga',
                   'quitação no período seguinte atualiza a situação');
select teste.deve_falhar($$select reabrir_periodo('11111111-0000-0000-0000-000000000001', 'Correção de lançamento')$$, 'Apenas administradores');
select teste.como(:ADMIN);
select teste.deve_falhar($$select reabrir_periodo('11111111-0000-0000-0000-000000000001', 'curta')$$, 'justificativa');
select reabrir_periodo('11111111-0000-0000-0000-000000000001', 'Correção de lançamento solicitada pelo conferente');
select teste.igual((select count(*)::int from periodo_eventos), 2, 'fechamento e reabertura registrados');

-- ---------------------------------------------------------------------
-- 12) Conferência: edição volta para pendente; financeiro não confere
-- ---------------------------------------------------------------------
select teste.como(:FIN);
select teste.deve_falhar($$update despesas set conferencia = 'aprovado' where id = '66666666-0000-0000-0000-000000000004'$$, 'conferência');
select teste.deve_falhar($$select conferir_lancamento('despesas', '66666666-0000-0000-0000-000000000004', 'aprovado')$$, 'Apenas conferentes');
select teste.como(:CONF);
select conferir_lancamento('despesas', '66666666-0000-0000-0000-000000000004', 'aprovado', 'Conferido');
select teste.como(:FIN);
update despesas set descricao = 'Lanches (segunda compra)' where id = '66666666-0000-0000-0000-000000000004';
select teste.igual((select conferencia from despesas where id = '66666666-0000-0000-0000-000000000004'), 'pendente',
                   'edição após conferência volta para pendente');
insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id, conferencia)
values ('recebida', '2026-07-02', (select id from categorias where nome = 'Doações de empresas'), 'Tentativa já aprovada', 10,
        '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'aprovado');
select teste.igual((select conferencia from receitas where descricao = 'Tentativa já aprovada'), 'pendente',
                   'lançamento novo sempre nasce pendente de conferência');

-- ---------------------------------------------------------------------
-- 13) Permissões por perfil, LGPD e documentos privados
-- ---------------------------------------------------------------------
select teste.como(:VIS);
select teste.igual((select count(*)::int from receitas) > 0, true, 'visualizador consulta receitas');
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id)
  values ('recebida', '2026-07-01', (select id from categorias where nome = 'Doações de empresas'), 'Visualizador', 10,
          '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')$$, 'row-level security');
select teste.igual((select count(*)::int from contas_bancarias), 0, 'visualizador não vê dados bancários');
select teste.igual((select count(*)::int from contas_resumo), 2, 'visualizador vê apenas o nome das contas');
select teste.igual((select count(*)::int from auditoria), 0, 'visualizador não vê auditoria');

select teste.como(:ATV);
insert into beneficiarios (id, nome, bairro, autorizacao_imagem) values
  ('dddddddd-0000-0000-0000-000000000001', 'Criança A', 'Jardim Dandara', false),
  ('dddddddd-0000-0000-0000-000000000002', 'Criança B', 'Jardim Cerrado', true);
insert into atividades (id, data, bairro, tipo, titulo, participantes_qtd, publicar) values
  ('eeeeeeee-0000-0000-0000-000000000001', '2026-07-04', 'Jardim Dandara', 'Atividade esportiva', 'Treino de futebol', 2, true),
  ('eeeeeeee-0000-0000-0000-000000000002', '2026-07-11', 'Jardim Dandara', 'Atividade esportiva', 'Treino de futebol', 1, false);
insert into participacoes values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001');
select teste.igual((resumo_social('2026-07-01', '2026-07-31') ->> 'participantes_unicos')::int, 2, 'participantes únicos = 2');
select teste.igual((resumo_social('2026-07-01', '2026-07-31') ->> 'atendimentos')::int, 3, 'atendimentos (participações) = 3');
select teste.deve_falhar($$insert into receitas (status, data_recebimento, categoria_id, descricao, valor_recebido, conta_id, fonte_id)
  values ('recebida', '2026-07-01', (select id from categorias where nome = 'Doações de empresas'), 'Atividades', 10,
          '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')$$, 'row-level security');

select teste.como(:FIN);
select teste.igual((select count(*)::int from beneficiarios), 0, 'financeiro não acessa dados das crianças (LGPD)');
select teste.como(:VIS);
select teste.igual((select count(*)::int from participacoes), 0, 'visualizador não acessa listas nominais');

-- documento sensível
select teste.como(:FIN);
insert into documentos (id, storage_path, nome_arquivo, mime_type, tamanho_bytes, tipo_documento, sensivel) values
  ('77777777-0000-0000-0000-000000000009', '2026/07/extrato.pdf', 'extrato.pdf', 'application/pdf', 500, 'extrato_bancario', true);
insert into storage.objects (bucket_id, name) values ('documentos', '2026/07/extrato.pdf'), ('documentos', '2026/02/nf-1001.pdf');
select teste.como(:VIS);
select teste.igual((select count(*)::int from documentos where sensivel), 0, 'visualizador não vê documento sensível');
select teste.igual((select count(*)::int from storage.objects), 1, 'visualizador baixa só arquivos não sensíveis');
select teste.deve_falhar($$insert into storage.objects (bucket_id, name) values ('documentos', 'x.pdf')$$, 'row-level security');
select teste.como(null);
select teste.igual((select count(*)::int from storage.objects), 0, 'anônimo não acessa comprovantes');
select teste.deve_falhar($$select count(*) from receitas$$, 'permission denied');
select teste.deve_falhar($$select dashboard_resumo('2026-01-01', '2026-12-31')$$, 'permission denied');
select teste.igual((select count(*)::int from configuracoes), 1, 'anônimo lê só a configuração pública do site');
insert into contatos (tipo, nome, email, mensagem, consentimento) values ('voluntario', 'Maria Voluntária', 'maria@ex.com', 'Quero ajudar', true);
select teste.deve_falhar($$insert into contatos (tipo, nome, consentimento) values ('contato', 'Sem consentimento', false)$$, 'row-level security');
select teste.deve_falhar($$select * from contatos$$, 'permission denied');

-- transparência pública: desligada por padrão, depois só agregados de períodos publicados
select teste.igual((transparencia_publica() ->> 'ativo')::boolean, false, 'transparência desativada por padrão');
reset role;
update configuracoes set valor = valor || '{"mostrar_transparencia": true}' where chave = 'site';
update periodos set publicar_transparencia = true where id = '11111111-0000-0000-0000-000000000001';
select teste.como(null);
select teste.igual((transparencia_publica() -> 'periodos' -> 0 ->> 'despesas')::numeric, 350.00, 'transparência: despesas do período publicado');
select teste.igual(jsonb_array_length(transparencia_publica() -> 'atividades_recentes'), 1, 'transparência: só atividades marcadas para publicar');
select teste.igual(position('Criança' in transparencia_publica()::text), 0, 'transparência sem nomes de crianças');
select teste.igual(position('Mercado' in transparencia_publica()::text), 0, 'transparência sem nomes de fornecedores');

-- ---------------------------------------------------------------------
-- 14) Auditoria imutável
-- ---------------------------------------------------------------------
select teste.como(:CONF);
select teste.igual((select count(*) > 20 from auditoria), true, 'conferente consulta a trilha de auditoria');
select teste.igual((select count(*)::int from auditoria where tabela = 'pagamentos' and acao = 'alteracao'
                    and dados_novos ->> 'estornado' = 'true'), 1, 'estorno registrado na auditoria');
select teste.como(:ADMIN);
select teste.deve_falhar($$delete from auditoria$$, 'permission denied');
select teste.deve_falhar($$update auditoria set acao = 'x'$$, 'permission denied');
reset role;
select teste.deve_falhar($$delete from auditoria$$, 'não pode ser alterado');
select teste.deve_falhar($$truncate auditoria$$, 'não pode ser alterado');

reset role;
\echo '✔ Todos os cenários passaram.'
