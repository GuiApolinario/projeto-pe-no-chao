-- =====================================================================
-- Projeto Pé no Chão — Sistema de Gestão Financeira e Prestação de Contas
-- Migração 1/4: esquema (tabelas, tipos, sequências)
--
-- Regras gerais:
--   * Valores monetários sempre em numeric(14,2) (nunca float).
--   * Nenhum dado institucional é presumido: campos não informados ficam NULL
--     e a interface os exibe como "pendente de configuração".
--   * Lançamentos financeiros não são apagados: são cancelados/estornados
--     com justificativa (ver migração 2).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Usuários e perfis de acesso
-- ---------------------------------------------------------------------
create type public.papel_usuario as enum
  ('admin', 'financeiro', 'atividades', 'conferente', 'visualizador');

create table public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text,
  papel      public.papel_usuario not null default 'visualizador',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cadastro do projeto (registro único)
-- ---------------------------------------------------------------------
create table public.projeto (
  id                        int primary key default 1 check (id = 1),
  nome_oficial              text not null default 'Projeto Pé no Chão',
  entidade_responsavel      text,
  cnpj                      text,
  endereco                  text,
  municipio                 text default 'Votorantim/SP',
  telefone                  text,
  email                     text,
  responsavel_legal         text,
  responsavel_financeiro    text,
  responsavel_conferencia   text,
  inicio_execucao           date,
  fim_execucao              date,
  objetivos                 text,
  publico_atendido          text,
  regras_prestacao_contas   text,
  periodicidade_relatorios  text,
  prazo_relatorios          text,
  observacoes               text,
  atualizado_em             timestamptz not null default now(),
  atualizado_por            uuid
);

-- ---------------------------------------------------------------------
-- Períodos de prestação de contas
-- ---------------------------------------------------------------------
create table public.periodos (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null,
  data_inicio              date not null,
  data_fim                 date not null,
  status                   text not null default 'aberto' check (status in ('aberto', 'fechado')),
  publicar_transparencia   boolean not null default false,
  fechado_em               timestamptz,
  fechado_por              uuid,
  observacoes              text,
  criado_em                timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create table public.periodo_eventos (
  id            bigserial primary key,
  periodo_id    uuid not null references public.periodos(id),
  evento        text not null check (evento in ('fechamento', 'reabertura')),
  justificativa text,
  usuario_id    uuid,
  em            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Instrumentos de parceria, fontes de recursos, contas, categorias, metas
-- ---------------------------------------------------------------------
create table public.instrumentos (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null,  -- termo de fomento, termo de colaboração, convênio, contrato, acordo, outro
  numero                text,
  concedente            text,
  objeto                text,
  data_inicio           date,
  data_fim              date,
  valor_total           numeric(14,2) check (valor_total is null or valor_total >= 0),
  plano_trabalho        text,
  regras_prestacao      text,
  periodicidade         text,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now()
);

create table public.fontes_recurso (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique,
  tipo                   text not null default 'privado' check (tipo in ('publico', 'privado', 'proprio', 'misto')),
  vinculado              boolean not null default false,  -- recursos vinculados não se misturam com outras fontes
  instrumento_id         uuid references public.instrumentos(id),
  descricao              text,
  regras_elegibilidade   text,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now()
);

create table public.contas_bancarias (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null unique,
  banco               text,
  agencia             text,
  numero_conta        text,
  tipo                text default 'corrente',  -- corrente, poupança, aplicação, caixa (dinheiro)
  fonte_id            uuid references public.fontes_recurso(id),  -- conta exclusiva de uma fonte (opcional)
  saldo_inicial       numeric(14,2) not null default 0,
  data_saldo_inicial  date not null default current_date,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now()
);

create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('receita', 'despesa')),
  nome       text not null,
  parent_id  uuid references public.categorias(id),
  ativo      boolean not null default true,
  ordem      int not null default 0
);
create unique index categorias_nome_unico
  on public.categorias (tipo, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

create table public.metas (
  id              uuid primary key default gen_random_uuid(),
  instrumento_id  uuid references public.instrumentos(id),
  codigo          text,
  descricao       text not null,
  indicador       text,
  unidade         text,
  valor_meta      numeric(14,2),
  metodologia     text,  -- como contar (ex.: participantes únicos x atendimentos)
  ativo           boolean not null default true
);

create table public.fornecedores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cpf_cnpj   text,
  contato    text,
  observacoes text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create unique index fornecedores_doc_unico on public.fornecedores (cpf_cnpj) where cpf_cnpj is not null;

-- ---------------------------------------------------------------------
-- Documentos (arquivos no Storage privado, metadados aqui)
-- ---------------------------------------------------------------------
create sequence public.seq_documento;
create table public.documentos (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique default 'DOC-' || lpad(nextval('public.seq_documento')::text, 6, '0'),
  storage_path     text not null unique,
  nome_arquivo     text not null,
  mime_type        text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho_bytes    bigint not null check (tamanho_bytes > 0),
  tipo_documento   text not null check (tipo_documento in (
                     'nota_fiscal', 'recibo', 'comprovante_pix', 'comprovante_transferencia', 'boleto',
                     'comprovante_quitacao', 'extrato_bancario', 'contrato', 'orcamento_cotacao',
                     'autorizacao_compra', 'relatorio', 'lista_materiais', 'foto_produto',
                     'foto_atividade', 'lista_presenca', 'autorizacao_imagem', 'comprovante_recebimento',
                     'plano_trabalho', 'protocolo_envio', 'outro')),
  descricao        text,
  data_documento   date,
  valor            numeric(14,2),
  sensivel         boolean not null default false,  -- acesso só para admin/financeiro/conferente
  autorizado_publicacao boolean not null default false,  -- fotos com autorização de imagem
  status           text not null default 'aguardando' check (status in ('aguardando', 'validado', 'rejeitado')),
  conferido_por    uuid,
  conferido_em     timestamptz,
  obs_conferente   text,
  enviado_por      uuid default auth.uid(),
  enviado_em       timestamptz not null default now()
);

create table public.documento_vinculos (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.documentos(id),
  entidade      text not null check (entidade in (
                  'receita', 'despesa', 'pagamento', 'atividade', 'extrato', 'instrumento',
                  'obrigacao', 'orcamento', 'doacao_bem', 'remanejamento', 'beneficiario')),
  registro_id   uuid not null,
  justificativa text,  -- obrigatória quando o mesmo documento é vinculado a mais de um registro
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  unique (documento_id, entidade, registro_id)
);
create index documento_vinculos_registro on public.documento_vinculos (entidade, registro_id);

-- ---------------------------------------------------------------------
-- Receitas
-- ---------------------------------------------------------------------
create sequence public.seq_receita;
create table public.receitas (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique default 'REC-' || lpad(nextval('public.seq_receita')::text, 6, '0'),
  periodo_id            uuid not null references public.periodos(id),
  status                text not null default 'prevista' check (status in ('prevista', 'recebida', 'cancelada')),
  data_prevista         date,
  data_recebimento      date,
  data_competencia      date,
  origem                text,
  categoria_id          uuid not null references public.categorias(id),
  descricao             text not null check (length(trim(descricao)) >= 3),
  valor_previsto        numeric(14,2) check (valor_previsto is null or valor_previsto >= 0),
  valor_recebido        numeric(14,2) check (valor_recebido is null or valor_recebido >= 0),
  forma_recebimento     text,
  conta_id              uuid references public.contas_bancarias(id),
  referencia_bancaria   text,
  doador_nome           text,
  doador_documento      text,
  instrumento_id        uuid references public.instrumentos(id),
  fonte_id              uuid not null references public.fontes_recurso(id),
  periodo_referencia    text,
  parcela_numero        int,
  parcela_total         int,
  observacoes           text,
  conferencia           text not null default 'pendente' check (conferencia in ('pendente', 'em_analise', 'aprovado', 'rejeitado')),
  conferido_por         uuid,
  conferido_em          timestamptz,
  obs_conferencia       text,
  cancel_justificativa  text,
  cancelado_por         uuid,
  cancelado_em          timestamptz,
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_por        uuid,
  atualizado_em         timestamptz not null default now(),
  constraint receita_recebida_completa check (
    status <> 'recebida' or (data_recebimento is not null and valor_recebido > 0 and conta_id is not null)),
  constraint receita_prevista_completa check (
    status <> 'prevista' or (data_prevista is not null and valor_previsto > 0)),
  constraint receita_cancelamento_justificado check (
    status <> 'cancelada' or length(trim(coalesce(cancel_justificativa, ''))) >= 10)
);
create index receitas_datas on public.receitas (data_recebimento, data_prevista);
create index receitas_fonte on public.receitas (fonte_id);

-- ---------------------------------------------------------------------
-- Despesas e pagamentos (pagamentos parciais suportados)
-- ---------------------------------------------------------------------
create sequence public.seq_despesa;
create table public.despesas (
  id                        uuid primary key default gen_random_uuid(),
  codigo                    text not null unique default 'DES-' || lpad(nextval('public.seq_despesa')::text, 6, '0'),
  periodo_id                uuid not null references public.periodos(id),
  status                    text not null default 'lancada' check (status in (
                              'prevista', 'contratada', 'lancada', 'aprovada', 'paga', 'cancelada', 'reembolsada')),
  situacao_pagamento        text not null default 'em_aberto' check (situacao_pagamento in ('em_aberto', 'parcial', 'quitada')),
  situacao_documental       text not null default 'sem_documentos' check (situacao_documental in (
                              'sem_documentos', 'incompleta', 'aguardando_conferencia', 'rejeitada', 'validada')),
  data_compra               date,
  data_emissao              date,
  data_vencimento           date,
  data_competencia          date,
  fornecedor_id             uuid references public.fornecedores(id),
  descricao                 text not null check (length(trim(descricao)) >= 3),
  categoria_id              uuid references public.categorias(id),
  subcategoria_id           uuid references public.categorias(id),
  quantidade                numeric(12,3) not null default 1 check (quantidade > 0),
  valor_unitario            numeric(14,2) check (valor_unitario is null or valor_unitario >= 0),
  desconto                  numeric(14,2) not null default 0 check (desconto >= 0),
  valor_total               numeric(14,2) not null check (valor_total >= 0),
  valor_pago                numeric(14,2) not null default 0,  -- mantido por gatilho a partir de pagamentos
  forma_pagamento           text,
  conta_id                  uuid references public.contas_bancarias(id),
  tipo_documento_fiscal     text,
  numero_documento_fiscal   text,
  referencia_transacao      text,
  fonte_id                  uuid not null references public.fontes_recurso(id),
  instrumento_id            uuid references public.instrumentos(id),
  meta_id                   uuid references public.metas(id),
  centro_custo              text,
  justificativa             text,
  responsavel_compra        text,
  conferencia               text not null default 'pendente' check (conferencia in ('pendente', 'em_analise', 'aprovado', 'rejeitado')),
  conferido_por             uuid,
  conferido_em              timestamptz,
  obs_conferencia           text,
  observacoes               text,
  cancel_justificativa      text,
  cancelado_por             uuid,
  cancelado_em              timestamptz,
  criado_por                uuid default auth.uid(),
  criado_em                 timestamptz not null default now(),
  atualizado_por            uuid,
  atualizado_em             timestamptz not null default now(),
  constraint despesa_data_referencia check (coalesce(data_compra, data_emissao, data_vencimento) is not null),
  constraint despesa_categoria_obrigatoria check (status in ('prevista', 'cancelada') or categoria_id is not null),
  constraint despesa_cancelamento_justificado check (
    status not in ('cancelada', 'reembolsada') or length(trim(coalesce(cancel_justificativa, ''))) >= 10)
);
create index despesas_datas on public.despesas (data_compra, data_vencimento);
create index despesas_fonte on public.despesas (fonte_id);
create index despesas_categoria on public.despesas (categoria_id);
-- impede o mesmo documento fiscal do mesmo fornecedor ser lançado duas vezes
create unique index despesas_doc_fiscal_unico on public.despesas (fornecedor_id, lower(numero_documento_fiscal))
  where numero_documento_fiscal is not null and fornecedor_id is not null and status <> 'cancelada';

create sequence public.seq_pagamento;
create table public.pagamentos (
  id                     uuid primary key default gen_random_uuid(),
  codigo                 text not null unique default 'PAG-' || lpad(nextval('public.seq_pagamento')::text, 6, '0'),
  despesa_id             uuid not null references public.despesas(id),
  data_pagamento         date not null,
  valor                  numeric(14,2) not null check (valor > 0),
  forma_pagamento        text not null,
  conta_id               uuid not null references public.contas_bancarias(id),
  referencia             text,
  observacoes            text,
  estornado              boolean not null default false,
  estorno_justificativa  text,
  estornado_por          uuid,
  estornado_em           timestamptz,
  criado_por             uuid default auth.uid(),
  criado_em              timestamptz not null default now(),
  constraint estorno_justificado check (not estornado or length(trim(coalesce(estorno_justificativa, ''))) >= 10)
);
create index pagamentos_despesa on public.pagamentos (despesa_id);
create index pagamentos_data on public.pagamentos (data_pagamento);

-- revisão humana de suspeitas de duplicidade ("não é duplicata")
create table public.duplicidades_revisadas (
  despesa_a     uuid not null references public.despesas(id),
  despesa_b     uuid not null references public.despesas(id),
  justificativa text not null check (length(trim(justificativa)) >= 5),
  revisado_por  uuid default auth.uid(),
  revisado_em   timestamptz not null default now(),
  primary key (despesa_a, despesa_b)
);

-- ---------------------------------------------------------------------
-- Checklist documental configurável
-- ---------------------------------------------------------------------
create table public.checklist_modelos (
  id                       uuid primary key default gen_random_uuid(),
  item                     text not null,
  categoria_id             uuid references public.categorias(id),     -- null = todas as categorias
  fonte_id                 uuid references public.fontes_recurso(id), -- null = todas as fontes
  obrigatorio              boolean not null default true,
  -- como o item é atendido automaticamente: um tipo de documento vinculado,
  -- ou um campo preenchido da despesa ('campo:justificativa', 'campo:fornecedor')
  criterio                 text not null,
  valor_minimo             numeric(14,2),  -- só exigir a partir deste valor (ex.: cotação)
  ativo                    boolean not null default true,
  ordem                    int not null default 0
);

create table public.despesa_checklist (
  id             uuid primary key default gen_random_uuid(),
  despesa_id     uuid not null references public.despesas(id),
  modelo_id      uuid references public.checklist_modelos(id),
  item           text not null,
  criterio       text not null,
  obrigatorio    boolean not null default true,
  atendido       boolean not null default false,
  dispensado     boolean not null default false,
  dispensa_justificativa text,
  atualizado_em  timestamptz not null default now(),
  unique (despesa_id, modelo_id),
  constraint dispensa_justificada check (not dispensado or length(trim(coalesce(dispensa_justificativa, ''))) >= 5)
);

-- ---------------------------------------------------------------------
-- Doações em bens/serviços (módulo patrimonial — NÃO entra no caixa)
-- ---------------------------------------------------------------------
create sequence public.seq_doacao_bem;
create table public.doacoes_bens (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique default 'BEM-' || lpad(nextval('public.seq_doacao_bem')::text, 6, '0'),
  data_recebimento  date not null,
  tipo              text not null default 'bem' check (tipo in ('bem', 'servico')),
  doador_nome       text,
  doador_documento  text,
  descricao         text not null,
  quantidade        numeric(12,3),
  unidade           text,
  valor_estimado    numeric(14,2) check (valor_estimado is null or valor_estimado >= 0),
  criterio_valor    text,
  destino           text,
  observacoes       text,
  status            text not null default 'recebido' check (status in ('recebido', 'distribuido', 'em_estoque', 'cancelado')),
  cancel_justificativa text,
  criado_por        uuid default auth.uid(),
  criado_em         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orçamento e remanejamentos
-- ---------------------------------------------------------------------
create table public.orcamento_itens (
  id                 uuid primary key default gen_random_uuid(),
  fonte_id           uuid not null references public.fontes_recurso(id),
  instrumento_id     uuid references public.instrumentos(id),
  categoria_id       uuid not null references public.categorias(id),
  meta_id            uuid references public.metas(id),
  descricao          text,
  valor_aprovado     numeric(14,2) not null check (valor_aprovado >= 0),
  valor_revisado     numeric(14,2) check (valor_revisado is null or valor_revisado >= 0),
  validade_inicio    date not null,
  validade_fim       date not null,
  documento_ref      text,  -- documento que fundamenta a aprovação/alteração
  alerta_percentual  numeric(5,2) not null default 80,
  criado_em          timestamptz not null default now(),
  check (validade_fim >= validade_inicio),
  unique (fonte_id, categoria_id, validade_inicio)
);

create table public.remanejamentos (
  id               uuid primary key default gen_random_uuid(),
  origem_id        uuid not null references public.orcamento_itens(id),
  destino_id       uuid not null references public.orcamento_itens(id),
  valor            numeric(14,2) not null check (valor > 0),
  justificativa    text not null check (length(trim(justificativa)) >= 10),
  status           text not null default 'solicitado' check (status in ('solicitado', 'autorizado', 'negado')),
  documento_autorizacao text,
  solicitado_por   uuid default auth.uid(),
  solicitado_em    timestamptz not null default now(),
  decidido_por     uuid,
  decidido_em      timestamptz,
  obs_decisao      text,
  check (origem_id <> destino_id)
);

-- ---------------------------------------------------------------------
-- Conciliação bancária
-- ---------------------------------------------------------------------
create table public.extratos (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references public.contas_bancarias(id),
  data_inicio     date not null,
  data_fim        date not null,
  saldo_inicial   numeric(14,2) not null,
  saldo_final     numeric(14,2) not null,
  arquivo_nome    text,
  status          text not null default 'em_andamento' check (status in ('em_andamento', 'concluida')),
  realizado_por   uuid default auth.uid(),
  conferido_por   uuid,
  conferido_em    timestamptz,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create table public.extrato_linhas (
  id             uuid primary key default gen_random_uuid(),
  extrato_id     uuid not null references public.extratos(id) on delete cascade,
  data           date not null,
  descricao      text not null,
  documento      text,
  valor          numeric(14,2) not null check (valor <> 0),  -- + crédito / − débito
  fitid          text,
  status         text not null default 'pendente' check (status in ('pendente', 'conciliado', 'ignorado')),
  tipo_ajuste    text check (tipo_ajuste in ('tarifa', 'rendimento', 'estorno', 'ajuste')),
  pagamento_id   uuid references public.pagamentos(id),
  receita_id     uuid references public.receitas(id),
  conciliado_por uuid,
  conciliado_em  timestamptz,
  observacao     text,
  constraint linha_vinculo_unico check (num_nonnulls(pagamento_id, receita_id) <= 1),
  constraint linha_conciliada_valida check (
    status <> 'conciliado' or num_nonnulls(pagamento_id, receita_id) = 1),
  constraint linha_ignorada_justificada check (
    status <> 'ignorado' or length(trim(coalesce(observacao, ''))) >= 5)
);
create unique index extrato_linhas_fitid on public.extrato_linhas (extrato_id, fitid) where fitid is not null;
create unique index extrato_linhas_pagamento on public.extrato_linhas (pagamento_id) where pagamento_id is not null;
create unique index extrato_linhas_receita on public.extrato_linhas (receita_id) where receita_id is not null;

-- ---------------------------------------------------------------------
-- Atividades e resultados sociais (com cuidados de LGPD)
-- ---------------------------------------------------------------------
create sequence public.seq_atividade;
create table public.atividades (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique default 'ATV-' || lpad(nextval('public.seq_atividade')::text, 6, '0'),
  data               date not null,
  local              text,
  bairro             text,
  tipo               text not null,
  titulo             text not null,
  descricao          text,
  objetivo           text,
  responsavel        text,
  participantes_qtd  int not null default 0 check (participantes_qtd >= 0),  -- participações (atendimentos)
  publico_atendido   text,
  materiais          text,
  resultados         text,
  dificuldades       text,
  meta_id            uuid references public.metas(id),
  observacoes        text,
  publicar           boolean not null default false,  -- exibir no site (sem dados pessoais)
  criado_por         uuid default auth.uid(),
  criado_em          timestamptz not null default now()
);

create table public.atividade_despesas (
  atividade_id  uuid not null references public.atividades(id) on delete cascade,
  despesa_id    uuid not null references public.despesas(id),
  primary key (atividade_id, despesa_id)
);

create sequence public.seq_beneficiario;
create table public.beneficiarios (
  id                     uuid primary key default gen_random_uuid(),
  codigo                 text not null unique default 'BEN-' || lpad(nextval('public.seq_beneficiario')::text, 5, '0'),
  nome                   text not null,
  data_nascimento        date,
  responsavel_nome       text,
  responsavel_contato    text,
  bairro                 text,
  autorizacao_imagem     boolean not null default false,
  autorizacao_data       date,
  observacoes            text,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now()
);

create table public.participacoes (
  atividade_id     uuid not null references public.atividades(id) on delete cascade,
  beneficiario_id  uuid not null references public.beneficiarios(id),
  primary key (atividade_id, beneficiario_id)
);

-- ---------------------------------------------------------------------
-- Obrigações e prazos de prestação de contas
-- ---------------------------------------------------------------------
create table public.obrigacoes (
  id                   uuid primary key default gen_random_uuid(),
  titulo               text not null,
  instrumento_id       uuid references public.instrumentos(id),
  periodo_id           uuid references public.periodos(id),
  referencia_inicio    date,
  referencia_fim       date,
  prazo                date not null,
  documentos_exigidos  text,
  responsavel          text,
  status               text not null default 'em_preparacao',
  data_envio           date,
  protocolo            text,
  alerta_dias          int not null default 15 check (alerta_dias >= 0),
  pendencias           text,
  observacoes          text,
  criado_em            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Site público: configurações, necessidades e contatos
-- ---------------------------------------------------------------------
create table public.configuracoes (
  chave          text primary key,
  valor          jsonb not null,
  publico        boolean not null default false,
  atualizado_em  timestamptz not null default now()
);

create table public.necessidades (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  prioridade  text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  ativo       boolean not null default true,
  ordem       int not null default 0
);

create table public.contatos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('voluntario', 'doacao_bens', 'empresa', 'contato')),
  nome          text not null check (length(nome) between 2 and 120),
  email         text check (email is null or length(email) <= 160),
  telefone      text check (telefone is null or length(telefone) <= 30),
  mensagem      text check (mensagem is null or length(mensagem) <= 2000),
  consentimento boolean not null check (consentimento),
  status        text not null default 'novo' check (status in ('novo', 'respondido', 'arquivado')),
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trilha de auditoria (somente inserção, por gatilho)
-- ---------------------------------------------------------------------
create table public.auditoria (
  id              bigserial primary key,
  tabela          text not null,
  registro_id     text,
  acao            text not null,
  dados_antigos   jsonb,
  dados_novos     jsonb,
  usuario_id      uuid,
  usuario_email   text,
  em              timestamptz not null default now()
);
create index auditoria_registro on public.auditoria (tabela, registro_id);
create index auditoria_em on public.auditoria (em desc);
