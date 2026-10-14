import { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet, FolderArchive } from 'lucide-react';
import { BUCKET, buscarTodos, mensagemErro, supabase } from '../lib/supabase';
import { useFiltro } from '../lib/sessao';
import { TIPOS_DOCUMENTO, rotuloStatus } from '../lib/rotulos';
import { data as fmtData, dinheiro, mesAno, num, pct, somar } from '../lib/formato';
import { baixar, paraCSV, planilhaXLSX, type ColunaExport } from '../lib/exportar';
import { abrirPDF, novoPDF } from '../lib/pdf';
import { AreaTexto, Aviso, Botao, Caixa, Cartao, Rotulo, Selecao, Texto, TituloPagina, useAviso } from '../components/ui';
import { useOpcoes } from '../components/Formulario';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>;

const SECOES = {
  identificacao: 'Identificação do projeto',
  resumo: 'Resumo executivo e saldos',
  receitas: 'Relação das receitas',
  despesas: 'Relação detalhada das despesas',
  a_pagar: 'Despesas pendentes de pagamento',
  orcamento: 'Execução orçamentária',
  graficos: 'Gráficos financeiros',
  documentos: 'Índice de documentos anexados',
  pendencias: 'Pendências documentais',
  conciliacao: 'Resultado da conciliação bancária',
  atividades: 'Atividades e resultados sociais',
  observacoes: 'Observações e justificativas',
  assinaturas: 'Responsáveis e assinaturas',
} as const;
type Secao = keyof typeof SECOES;

const MODELOS: Record<string, { nome: string; secoes: Secao[] }> = {
  mensal: { nome: 'Relatório financeiro do período (mensal)', secoes: ['identificacao', 'resumo', 'receitas', 'despesas', 'a_pagar', 'orcamento', 'graficos', 'documentos', 'pendencias', 'conciliacao', 'observacoes', 'assinaturas'] },
  despesas: { nome: 'Relatório detalhado de despesas', secoes: ['identificacao', 'despesas', 'pendencias'] },
  receitas: { nome: 'Relatório de receitas', secoes: ['identificacao', 'receitas'] },
  orcamento: { nome: 'Relatório de execução orçamentária', secoes: ['identificacao', 'orcamento', 'graficos'] },
  atividades: { nome: 'Relatório de atividades', secoes: ['identificacao', 'atividades', 'observacoes', 'assinaturas'] },
  consolidado: { nome: 'Relatório consolidado (financeiro + social)', secoes: Object.keys(SECOES) as Secao[] },
};

async function carregar(inicio: string, fim: string, fonte: string | null) {
  const f = (q: any) => (fonte ? q.eq('fonte_id', fonte) : q);
  const p = { p_inicio: inicio, p_fim: fim, p_fonte: fonte };
  const [projeto, resumo, serie, cats, social, saldos] = await Promise.all([
    supabase.from('projeto').select('*').eq('id', 1).single(),
    supabase.rpc('dashboard_resumo', p), supabase.rpc('serie_mensal', p), supabase.rpc('despesas_por_categoria', p),
    supabase.rpc('resumo_social', { p_inicio: inicio, p_fim: fim }), supabase.rpc('saldos_contas', { p_data: fim }),
  ]);
  const erro = [projeto, resumo, serie, cats, social].find((x) => x.error)?.error;
  if (erro) throw erro;
  const receitas = await buscarTodos<Linha>((de, ate) => f(supabase.from('receitas').select('*, categorias(nome), fontes_recurso(nome), contas_resumo(nome)'))
    .or(`and(data_recebimento.gte.${inicio},data_recebimento.lte.${fim}),and(data_recebimento.is.null,data_prevista.gte.${inicio},data_prevista.lte.${fim})`).neq('status', 'cancelada').order('data_recebimento').range(de, ate));
  const despesas = await buscarTodos<Linha>((de, ate) => f(supabase.from('despesas').select('*, categorias!despesas_categoria_id_fkey(nome), fontes_recurso(nome), fornecedores(nome, cpf_cnpj)'))
    .or(`and(data_compra.gte.${inicio},data_compra.lte.${fim}),and(data_compra.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`).not('status', 'in', '(prevista,cancelada)').order('data_compra').range(de, ate));
  const pagamentos = await buscarTodos<Linha>((de, ate) => supabase.from('pagamentos').select('*, despesas!inner(codigo, fonte_id, descricao)').eq('estornado', false).gte('data_pagamento', inicio).lte('data_pagamento', fim).range(de, ate));
  const pagFiltrados = fonte ? pagamentos.filter((x) => x.despesas?.fonte_id === fonte) : pagamentos;
  const documentos = await buscarTodos<Linha>((de, ate) => supabase.from('v_documentos').select('*').gte('data_referencia', inicio).lte('data_referencia', fim).order('data_referencia').range(de, ate));
  const orc = await f(supabase.from('v_execucao_orcamentaria').select('*').lte('validade_inicio', fim).gte('validade_fim', inicio).order('fonte'));
  const atividades = await buscarTodos<Linha>((de, ate) => supabase.from('atividades').select('*').gte('data', inicio).lte('data', fim).order('data').range(de, ate));
  const extratos = await supabase.from('extratos').select('*, contas_resumo(nome)').lte('data_inicio', fim).gte('data_fim', inicio).order('data_fim');
  // documentos de pagamento contam como comprovante de pagamento da despesa
  const docsPorDespesa = new Map<string, Linha[]>();
  for (const d of documentos) if (d.despesa_id) docsPorDespesa.set(d.despesa_id, [...(docsPorDespesa.get(d.despesa_id) ?? []), d]);
  return { projeto: projeto.data, resumo: resumo.data, serie: serie.data || [], cats: cats.data || [], social: social.data, saldos: saldos.data || [],
    receitas, despesas, pagamentos: pagFiltrados, documentos, orcamento: orc.data || [], atividades, extratos: extratos.data || [], docsPorDespesa };
}
type Dados = Awaited<ReturnType<typeof carregar>>;

const COL_RECEITAS: ColunaExport<Linha>[] = [
  { chave: 'codigo', titulo: 'Código' }, { chave: 'data', titulo: 'Data', tipo: 'data', valor: (l) => l.data_recebimento ?? l.data_prevista },
  { chave: 'descricao', titulo: 'Descrição' }, { chave: 'origem', titulo: 'Origem', valor: (l) => l.doador_nome || l.origem },
  { chave: 'categoria', titulo: 'Categoria', valor: (l) => l.categorias?.nome }, { chave: 'fonte', titulo: 'Fonte', valor: (l) => l.fontes_recurso?.nome },
  { chave: 'referencia_bancaria', titulo: 'Documento' }, { chave: 'status', titulo: 'Situação', valor: (l) => rotuloStatus(l.status) },
  { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro', valor: (l) => (l.status === 'recebida' ? l.valor_recebido : l.valor_previsto) },
];

function colDespesas(d: Dados): ColunaExport<Linha>[] {
  const tem = (l: Linha, tipos: string[]) => (d.docsPorDespesa.get(l.id) ?? []).some((x) => tipos.includes(x.tipo_documento)) ? 'Sim' : 'Não';
  return [
    { chave: 'codigo', titulo: 'Código' }, { chave: 'data', titulo: 'Data', tipo: 'data', valor: (l) => l.data_compra ?? l.data_emissao ?? l.data_vencimento },
    { chave: 'fornecedor', titulo: 'Fornecedor', valor: (l) => l.fornecedores?.nome }, { chave: 'descricao', titulo: 'Descrição' },
    { chave: 'categoria', titulo: 'Categoria', valor: (l) => l.categorias?.nome }, { chave: 'forma_pagamento', titulo: 'Forma pgto.' },
    { chave: 'numero_documento_fiscal', titulo: 'Doc. fiscal' }, { chave: 'nf', titulo: 'NF/recibo anexo', valor: (l) => tem(l, ['nota_fiscal', 'recibo']) },
    { chave: 'pgto', titulo: 'Compr. pgto.', valor: (l) => tem(l, ['comprovante_pix', 'comprovante_transferencia', 'comprovante_quitacao']) },
    { chave: 'fonte', titulo: 'Fonte', valor: (l) => l.fontes_recurso?.nome }, { chave: 'situacao_documental', titulo: 'Situação doc.', valor: (l) => rotuloStatus(l.situacao_documental) },
    { chave: 'valor_total', titulo: 'Valor', tipo: 'dinheiro' }, { chave: 'valor_pago', titulo: 'Pago', tipo: 'dinheiro' },
  ];
}
const COL_ORC: ColunaExport<Linha>[] = [
  { chave: 'fonte', titulo: 'Fonte' }, { chave: 'categoria', titulo: 'Categoria' }, { chave: 'valor_aprovado', titulo: 'Aprovado', tipo: 'dinheiro' },
  { chave: 'valor_atualizado', titulo: 'Atualizado', tipo: 'dinheiro' }, { chave: 'executado', titulo: 'Executado', tipo: 'dinheiro' },
  { chave: 'comprometido', titulo: 'Comprometido', tipo: 'dinheiro' }, { chave: 'saldo', titulo: 'Saldo', tipo: 'dinheiro' },
  { chave: 'percentual_executado', titulo: '% exec.', valor: (l) => pct(l.percentual_executado) },
];
const COL_DOCS: ColunaExport<Linha>[] = [
  { chave: 'codigo', titulo: 'Código' }, { chave: 'data_referencia', titulo: 'Data', tipo: 'data' }, { chave: 'tipo', titulo: 'Tipo', valor: (l) => TIPOS_DOCUMENTO[l.tipo_documento] },
  { chave: 'lancamento', titulo: 'Lançamento', valor: (l) => l.despesa_codigo ?? l.receita_codigo ?? '' }, { chave: 'nome_arquivo', titulo: 'Arquivo' },
  { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' }, { chave: 'status', titulo: 'Conferência', valor: (l) => rotuloStatus(l.status) },
];
const COL_ATIV: ColunaExport<Linha>[] = [
  { chave: 'codigo', titulo: 'Código' }, { chave: 'data', titulo: 'Data', tipo: 'data' }, { chave: 'titulo', titulo: 'Atividade' }, { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'bairro', titulo: 'Bairro' }, { chave: 'participantes_qtd', titulo: 'Participações', tipo: 'numero' }, { chave: 'resultados', titulo: 'Resultados' },
];

export default function Relatorios() {
  const { filtro } = useFiltro();
  const avisar = useAviso();
  const fontes = useOpcoes({ tabela: 'fontes_recurso', rotulo: 'nome' });
  const [modelo, setModelo] = useState('mensal');
  const [secoes, setSecoes] = useState<Secao[]>(MODELOS.mensal.secoes);
  const [inicio, setInicio] = useState(filtro.inicio);
  const [fim, setFim] = useState(filtro.fim);
  const [fonte, setFonte] = useState(filtro.fonteId ?? '');
  const [obs, setObs] = useState('');
  const [gerando, setGerando] = useState<string | null>(null);
  useEffect(() => { setInicio(filtro.inicio); setFim(filtro.fim); setFonte(filtro.fonteId ?? ''); }, [filtro]);
  useEffect(() => setSecoes(MODELOS[modelo].secoes), [modelo]);

  const nomeFonte = fontes.find((x) => x.valor === fonte)?.rotulo;
  const subtitulo = `Período: ${fmtData(inicio)} a ${fmtData(fim)}${nomeFonte ? ` · Fonte: ${nomeFonte}` : ' · Todas as fontes'}`;

  async function gerarPDF(d: Dados) {
    const pdf = await novoPDF({ titulo: MODELOS[modelo].nome, subtitulo, entidade: d.projeto?.entidade_responsavel ?? d.projeto?.nome_oficial, paisagem: true });
    const tem = (s: Secao) => secoes.includes(s);
    const r = d.resumo;
    pdf.titulo(MODELOS[modelo].nome);
    pdf.paragrafo('Documento gerado pelo sistema de gestão financeira do Projeto Pé no Chão a partir dos lançamentos registrados. Não substitui automaticamente o formulário ou modelo oficial exigido pelo órgão financiador; quando houver modelo obrigatório, utilize as planilhas exportadas para preenchê-lo.', 8.5);
    if (tem('identificacao')) {
      const pj = d.projeto ?? {};
      const pend = (v: unknown) => (v ? String(v) : 'Pendente de configuração');
      pdf.subtitulo('1. Identificação');
      pdf.pares([['Projeto', pend(pj.nome_oficial)], ['Entidade responsável', pend(pj.entidade_responsavel)], ['CNPJ', pend(pj.cnpj)], ['Município', pend(pj.municipio)],
        ['Responsável legal', pend(pj.responsavel_legal)], ['Responsável financeiro', pend(pj.responsavel_financeiro)], ['Período de referência', `${fmtData(inicio)} a ${fmtData(fim)}`], ['Fonte de recurso', nomeFonte ?? 'Todas']]);
    }
    if (tem('resumo')) {
      pdf.subtitulo('2. Resumo executivo');
      pdf.pares([
        ['Saldo inicial', dinheiro(r.saldo_inicial)], ['(+) Receitas recebidas', dinheiro(r.receitas_recebidas)], ['(-) Despesas pagas', dinheiro(r.despesas_pagas)],
        ['(=) Saldo final contábil', dinheiro(r.saldo_contabil)], ['Despesas lançadas e não pagas', dinheiro(r.despesas_a_pagar)], ['Recursos comprometidos', dinheiro(r.compromissos)],
        ['Saldo disponível', dinheiro(r.saldo_disponivel)], ['Receitas previstas a receber', dinheiro(r.receitas_a_receber)],
        ['Saldo bancário conciliado', r.saldo_bancario_conciliado === null ? 'Sem conciliação concluída' : `${dinheiro(r.saldo_bancario_conciliado)} em ${fmtData(r.data_conciliacao)}`],
        ['Despesas com documentação completa', `${num(r.documentacao?.com_comprovantes_qtd)} (${dinheiro(r.documentacao?.com_comprovantes_valor)})`],
        ['Despesas com pendência documental', `${num(r.documentacao?.pendentes_qtd)} (${dinheiro(r.documentacao?.pendentes_valor)})`],
      ]);
      if (r.saldos_vinculados?.length) pdf.pares(r.saldos_vinculados.map((v: Linha) => [`Saldo vinculado — ${v.fonte}`, dinheiro(v.saldo)]));
    }
    if (tem('receitas')) {
      pdf.subtitulo('3. Receitas');
      pdf.tabela(d.receitas, COL_RECEITAS, { totais: { valor: dinheiro(somar(d.receitas.filter((x) => x.status === 'recebida').map((x) => x.valor_recebido))) + ' recebido' } });
    }
    if (tem('despesas')) {
      pdf.subtitulo('4. Despesas');
      pdf.tabela(d.despesas, colDespesas(d), { tamanho: 7, totais: { valor_total: dinheiro(somar(d.despesas.map((x) => x.valor_total))), valor_pago: dinheiro(somar(d.despesas.map((x) => x.valor_pago))) } });
      pdf.paragrafo(`Pagamentos efetivados no período (base do saldo): ${dinheiro(somar(d.pagamentos.map((x) => x.valor)))} em ${d.pagamentos.length} pagamento(s).`, 8.5);
    }
    if (tem('a_pagar')) {
      const ap = d.despesas.filter((x) => ['lancada', 'aprovada', 'contratada'].includes(x.status) && Number(x.valor_total) > Number(x.valor_pago));
      pdf.subtitulo('5. Despesas pendentes de pagamento');
      pdf.tabela(ap, [...colDespesas(d).filter((c) => ['codigo', 'data', 'fornecedor', 'descricao'].includes(c.chave)), { chave: 'data_vencimento', titulo: 'Vencimento', tipo: 'data' }, { chave: 'restante', titulo: 'A pagar', tipo: 'dinheiro', valor: (l) => somar([l.valor_total, -l.valor_pago]) }],
        { totais: { restante: dinheiro(somar(ap.map((x) => somar([x.valor_total, -x.valor_pago])))) } });
    }
    if (tem('orcamento')) {
      pdf.subtitulo('6. Execução orçamentária');
      pdf.tabela(d.orcamento, COL_ORC, { totais: { valor_aprovado: dinheiro(somar(d.orcamento.map((x: Linha) => x.valor_aprovado))), valor_atualizado: dinheiro(somar(d.orcamento.map((x: Linha) => x.valor_atualizado))), executado: dinheiro(somar(d.orcamento.map((x: Linha) => x.executado))), comprometido: dinheiro(somar(d.orcamento.map((x: Linha) => x.comprometido))), saldo: dinheiro(somar(d.orcamento.map((x: Linha) => x.saldo))) } });
    }
    if (tem('graficos')) {
      pdf.barras('7. Receitas x despesas por mês', d.serie.map((s: Linha) => ({ rotulo: mesAno(s.mes), valores: [Number(s.receitas), Number(s.despesas)] })), ['Receitas recebidas', 'Despesas pagas'], [[42, 120, 214], [235, 104, 52]]);
      if (d.cats.length) pdf.barras('Despesas pagas por categoria', d.cats.slice(0, 8).map((c: Linha) => ({ rotulo: c.categoria, valores: [Number(c.valor)] })), ['Valor pago'], [[235, 104, 52]]);
      if (d.orcamento.length) pdf.barras('Orçamento atualizado x executado', d.orcamento.slice(0, 8).map((o: Linha) => ({ rotulo: o.categoria, valores: [Number(o.valor_atualizado), Number(o.executado)] })), ['Atualizado', 'Executado'], [[160, 160, 155], [42, 120, 214]]);
    }
    if (tem('documentos')) {
      pdf.subtitulo('8. Índice de documentos');
      pdf.tabela(d.documentos, COL_DOCS, { tamanho: 7 });
    }
    if (tem('pendencias')) {
      const pend = d.despesas.filter((x) => ['sem_documentos', 'incompleta', 'rejeitada'].includes(x.situacao_documental));
      pdf.subtitulo('9. Pendências documentais');
      pdf.tabela(pend, colDespesas(d).filter((c) => ['codigo', 'data', 'fornecedor', 'descricao', 'situacao_documental', 'valor_total'].includes(c.chave)));
    }
    if (tem('conciliacao')) {
      pdf.subtitulo('10. Conciliação bancária');
      pdf.tabela(d.saldos, [{ chave: 'conta', titulo: 'Conta' }, { chave: 'saldo_contabil', titulo: 'Saldo no sistema', tipo: 'dinheiro' }, { chave: 'saldo_extrato', titulo: 'Último extrato conciliado', tipo: 'dinheiro' },
        { chave: 'data_extrato', titulo: 'Data do extrato', tipo: 'data' }, { chave: 'diferenca', titulo: 'Diferença na data', tipo: 'dinheiro' }]);
      pdf.tabela(d.extratos, [{ chave: 'conta', titulo: 'Conta', valor: (l) => l.contas_resumo?.nome }, { chave: 'data_inicio', titulo: 'De', tipo: 'data' }, { chave: 'data_fim', titulo: 'Até', tipo: 'data' },
        { chave: 'saldo_final', titulo: 'Saldo final', tipo: 'dinheiro' }, { chave: 'status', titulo: 'Situação', valor: (l) => rotuloStatus(l.status) }]);
    }
    if (tem('atividades') && d.social) {
      pdf.subtitulo('11. Atividades e resultados sociais');
      pdf.pares([['Atividades realizadas', num(d.social.atividades)], ['Atendimentos (participações)', num(d.social.atendimentos)], ['Participantes únicos (listas nominais)', num(d.social.participantes_unicos)]]);
      pdf.tabela(d.atividades, COL_ATIV, { tamanho: 7 });
      if (d.social.metas?.length) pdf.tabela(d.social.metas, [{ chave: 'meta', titulo: 'Meta' }, { chave: 'indicador', titulo: 'Indicador' }, { chave: 'valor_meta', titulo: 'Previsto', tipo: 'numero' }, { chave: 'atividades', titulo: 'Atividades', tipo: 'numero' }, { chave: 'atendimentos', titulo: 'Atendimentos', tipo: 'numero' }]);
    }
    if (tem('observacoes')) {
      pdf.subtitulo('12. Observações e justificativas');
      pdf.paragrafo(obs.trim() || 'Sem observações.');
    }
    if (tem('assinaturas')) {
      const pj = d.projeto ?? {};
      pdf.subtitulo('Responsáveis');
      pdf.assinaturas([`${pj.responsavel_financeiro ?? '________________'}\nElaboração (responsável financeiro)`, `${pj.responsavel_conferencia ?? '________________'}\nConferência`, `${pj.responsavel_legal ?? '________________'}\nResponsável legal`]);
    }
    return pdf.finalizar();
  }

  async function planilha(d: Dados) {
    return planilhaXLSX<Linha>([
      { nome: 'Resumo', linhas: Object.entries({ 'Saldo inicial': d.resumo.saldo_inicial, 'Receitas recebidas': d.resumo.receitas_recebidas, 'Despesas pagas': d.resumo.despesas_pagas, 'Saldo final contábil': d.resumo.saldo_contabil, 'A pagar': d.resumo.despesas_a_pagar, 'Comprometido': d.resumo.compromissos, 'Saldo disponível': d.resumo.saldo_disponivel, 'A receber': d.resumo.receitas_a_receber }).map(([k, v]) => ({ k, v })),
        colunas: [{ chave: 'k', titulo: `Indicador (${fmtData(inicio)} a ${fmtData(fim)})` }, { chave: 'v', titulo: 'Valor', tipo: 'dinheiro' }] },
      { nome: 'Receitas', linhas: d.receitas, colunas: COL_RECEITAS },
      { nome: 'Despesas', linhas: d.despesas, colunas: colDespesas(d) },
      { nome: 'Pagamentos', linhas: d.pagamentos, colunas: [{ chave: 'codigo', titulo: 'Código' }, { chave: 'despesa', titulo: 'Despesa', valor: (l) => l.despesas?.codigo }, { chave: 'data_pagamento', titulo: 'Data', tipo: 'data' }, { chave: 'forma_pagamento', titulo: 'Forma' }, { chave: 'referencia', titulo: 'Referência' }, { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' }] },
      { nome: 'Orçamento', linhas: d.orcamento, colunas: COL_ORC },
      { nome: 'Documentos', linhas: d.documentos, colunas: COL_DOCS },
      { nome: 'Atividades', linhas: d.atividades, colunas: COL_ATIV },
    ]);
  }

  async function executar(tipo: 'pdf' | 'xlsx' | 'zip') {
    setGerando(tipo === 'zip' ? 'Preparando pacote…' : 'Gerando…');
    try {
      const d = await carregar(inicio, fim, fonte || null);
      const nome = `${modelo}-${inicio}-a-${fim}`;
      if (tipo === 'pdf') abrirPDF(await gerarPDF(d), `${nome}.pdf`);
      else if (tipo === 'xlsx') baixar(await planilha(d), `${nome}.xlsx`);
      else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        zip.file(`00-relatorio-${nome}.pdf`, (await gerarPDF(d)).output('blob'));
        zip.file(`00-planilhas-${nome}.xlsx`, await planilha(d));
        const linhasIndice: Linha[] = [];
        for (let i = 0; i < d.documentos.length; i++) {
          const doc = d.documentos[i];
          setGerando(`Baixando documento ${i + 1} de ${d.documentos.length}…`);
          const pasta = `${doc.data_referencia.slice(0, 7)}/${(doc.categoria ?? (doc.receita_codigo ? 'Receitas' : 'Outros')).replace(/[\\/:*?"<>|]/g, '-')}`;
          const arquivo = `${pasta}/${doc.despesa_codigo ?? doc.receita_codigo ?? 'SEM-VINCULO'}_${doc.codigo}_${doc.tipo_documento}.${doc.mime_type === 'application/pdf' ? 'pdf' : doc.mime_type.split('/')[1].replace('jpeg', 'jpg')}`;
          const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
          if (error || !blob) { linhasIndice.push({ ...doc, arquivo_pacote: 'ERRO AO BAIXAR' }); continue; }
          zip.file(`comprovantes/${arquivo}`, blob);
          linhasIndice.push({ ...doc, arquivo_pacote: `comprovantes/${arquivo}` });
        }
        zip.file('indice-de-comprovantes.csv', paraCSV(linhasIndice, [...COL_DOCS, { chave: 'arquivo_pacote', titulo: 'Arquivo no pacote' }]));
        setGerando('Compactando…');
        baixar(await zip.generateAsync({ type: 'blob' }), `pacote-prestacao-de-contas-${inicio}-a-${fim}.zip`);
      }
      avisar('ok', 'Relatório gerado.');
    } catch (e) { avisar('erro', mensagemErro(e)); } finally { setGerando(null); }
  }

  return (
    <div className="space-y-5">
      <TituloPagina titulo="Relatórios e prestação de contas" descricao="Relatórios gerados a partir dos mesmos dados do painel: totais, tabelas e gráficos coincidem com os lançamentos." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Cartao titulo="Configurar relatório">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Rotulo texto="Modelo"><Selecao vazio={false} opcoes={Object.entries(MODELOS).map(([k, v]) => ({ valor: k, rotulo: v.nome }))} value={modelo} onChange={(e) => setModelo(e.target.value)} /></Rotulo>
              <Rotulo texto="Fonte de recurso"><Selecao opcoes={fontes} vazio="Todas as fontes" value={fonte} onChange={(e) => setFonte(e.target.value)} /></Rotulo>
              <Rotulo texto="Início"><Texto type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Rotulo>
              <Rotulo texto="Fim"><Texto type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Rotulo>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500">Atalhos:</span>
              {[['Ano corrente', `${new Date().getFullYear()}-01-01`, `${new Date().getFullYear()}-12-31`], ['Ano anterior', `${new Date().getFullYear() - 1}-01-01`, `${new Date().getFullYear() - 1}-12-31`]].map(([r, a, b]) => (
                <button key={r} className="rounded-full bg-slate-100 px-2.5 py-1 hover:bg-slate-200" onClick={() => { setInicio(a); setFim(b); }}>{r} (relatório anual)</button>
              ))}
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Seções incluídas</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(SECOES) as Secao[]).map((s) => <Caixa key={s} rotulo={SECOES[s]} checked={secoes.includes(s)} onChange={(v) => setSecoes(v ? [...secoes, s] : secoes.filter((x) => x !== s))} />)}
              </div>
            </fieldset>
            {secoes.includes('observacoes') && <Rotulo texto="Observações e justificativas do período"><AreaTexto rows={4} value={obs} onChange={(e) => setObs(e.target.value)} /></Rotulo>}
          </div>
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo="Gerar">
            <div className="flex flex-col gap-2">
              <Botao icone={<FileDown className="h-4 w-4" />} onClick={() => executar('pdf')} disabled={!!gerando}>PDF (paginado, com cabeçalho e rodapé)</Botao>
              <Botao variante="secundario" icone={<FileSpreadsheet className="h-4 w-4" />} onClick={() => executar('xlsx')} disabled={!!gerando}>Planilha Excel (todas as tabelas)</Botao>
              <Botao variante="secundario" icone={<FolderArchive className="h-4 w-4" />} onClick={() => executar('zip')} carregando={!!gerando}>{gerando ?? 'Pacote de documentos (ZIP)'}</Botao>
            </div>
            <p className="mt-3 text-xs text-slate-500">O pacote ZIP reúne o PDF, as planilhas, o índice de comprovantes e todos os arquivos organizados em pastas por mês e categoria.</p>
          </Cartao>
          <Aviso tom="atencao">Os relatórios do sistema não substituem automaticamente o modelo oficial do financiador. Quando houver formulário obrigatório, use a planilha exportada para preenchê-lo.</Aviso>
        </div>
      </div>
    </div>
  );
}
