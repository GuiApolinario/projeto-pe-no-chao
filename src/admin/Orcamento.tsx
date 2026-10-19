import { useEffect, useState } from 'react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro, useSessao } from '../lib/sessao';
import { opcoesStatus } from '../lib/rotulos';
import { dinheiro, pct } from '../lib/formato';
import { Aviso, Botao, Cartao, Rotulo, Selo, Texto, TituloPagina, cx, useAviso } from '../components/ui';
import { CadastroSimples } from '../components/CadastroSimples';
import { Tabela, type Coluna } from '../components/Tabela';
import type { Campo } from '../components/Formulario';

const camposOrcamento: Campo[] = [
  { nome: 'fonte_id', rotulo: 'Fonte de recurso', tipo: 'ref', obrigatorio: true, ref: { tabela: 'fontes_recurso', rotulo: 'nome' } },
  { nome: 'categoria_id', rotulo: 'Categoria orçamentária', tipo: 'ref', obrigatorio: true, ref: { tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'despesa', parent_id: 'null' }, ordem: 'ordem' } },
  { nome: 'instrumento_id', rotulo: 'Instrumento de parceria', tipo: 'ref', ref: { tabela: 'instrumentos', rotulo: 'numero' } },
  { nome: 'meta_id', rotulo: 'Meta / atividade', tipo: 'ref', ref: { tabela: 'metas', rotulo: 'descricao' } },
  { nome: 'valor_aprovado', rotulo: 'Valor aprovado', tipo: 'dinheiro', obrigatorio: true },
  { nome: 'valor_revisado', rotulo: 'Valor revisado (se autorizado)', tipo: 'dinheiro', ajuda: 'Normalmente alterado apenas por remanejamento autorizado.' },
  { nome: 'validade_inicio', rotulo: 'Validade — início', tipo: 'data', obrigatorio: true },
  { nome: 'validade_fim', rotulo: 'Validade — fim', tipo: 'data', obrigatorio: true },
  { nome: 'alerta_percentual', rotulo: 'Alertar a partir de (%)', tipo: 'numero', obrigatorio: true },
  { nome: 'documento_ref', rotulo: 'Documento que fundamenta a aprovação', tipo: 'texto', largura: 3, placeholder: 'Ex.: Plano de trabalho aprovado — Termo de Fomento nº…' },
  { nome: 'descricao', rotulo: 'Descrição', tipo: 'area' },
];

const camposRemanejamento: Campo[] = [
  { nome: 'origem_id', rotulo: 'Retirar de (item de origem)', tipo: 'ref', obrigatorio: true, ref: { tabela: 'v_execucao_orcamentaria', rotulo: 'rotulo' } },
  { nome: 'destino_id', rotulo: 'Acrescentar em (item de destino)', tipo: 'ref', obrigatorio: true, ref: { tabela: 'v_execucao_orcamentaria', rotulo: 'rotulo' } },
  { nome: 'valor', rotulo: 'Valor', tipo: 'dinheiro', obrigatorio: true },
  { nome: 'justificativa', rotulo: 'Justificativa', tipo: 'area', obrigatorio: true },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function Decisao({ r, onFeito }: { r: any; onFeito: () => void }) {
  const avisar = useAviso();
  const [doc, setDoc] = useState('');
  const [obs, setObs] = useState('');
  const [aberto, setAberto] = useState(false);
  async function decidir(autorizar: boolean) {
    const { error } = await supabase.rpc('decidir_remanejamento', { p_id: r.id, p_autorizar: autorizar, p_obs: obs || null, p_documento: doc || null });
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', autorizar ? 'Remanejamento autorizado e orçamento atualizado.' : 'Remanejamento negado.');
    setAberto(false); onFeito();
  }
  if (!aberto) return <Botao pequeno variante="secundario" onClick={() => setAberto(true)}>Decidir</Botao>;
  return (
    <div className="flex min-w-[260px] flex-col gap-1.5 text-left">
      <Rotulo texto="Documento de autorização"><Texto value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Ofício, ata, aditivo…" /></Rotulo>
      <Rotulo texto="Observação"><Texto value={obs} onChange={(e) => setObs(e.target.value)} /></Rotulo>
      <div className="flex gap-1">
        <Botao pequeno disabled={doc.trim().length < 3} onClick={() => decidir(true)}>Autorizar</Botao>
        <Botao pequeno variante="perigo" onClick={() => decidir(false)}>Negar</Botao>
        <Botao pequeno variante="fantasma" onClick={() => setAberto(false)}>Voltar</Botao>
      </div>
    </div>
  );
}

export default function Orcamento() {
  const { filtro } = useFiltro();
  const { pode } = useSessao();
  const [itens, setItens] = useState<any[]>([]);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let q = supabase.from('v_execucao_orcamentaria').select('*').lte('validade_inicio', filtro.fim).gte('validade_fim', filtro.inicio).order('fonte').order('categoria');
    if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId);
    q.then(({ data }) => setItens(data || []));
  }, [filtro, versao]);

  const colunasExec: Coluna[] = [
    { chave: 'fonte', titulo: 'Fonte', render: (l) => <span>{l.fonte}{l.vinculado && <Selo tom="roxo">vinculado</Selo>}</span>, exportar: (l) => l.fonte },
    { chave: 'categoria', titulo: 'Categoria' },
    { chave: 'valor_aprovado', titulo: 'Aprovado', tipo: 'dinheiro' },
    { chave: 'valor_atualizado', titulo: 'Atualizado', tipo: 'dinheiro' },
    { chave: 'executado', titulo: 'Executado (pago)', tipo: 'dinheiro' },
    { chave: 'comprometido', titulo: 'Comprometido', tipo: 'dinheiro' },
    { chave: 'saldo', titulo: 'Saldo orçamentário', tipo: 'dinheiro', render: (l) => <span className={cx('tabular-nums', Number(l.saldo) < 0 && 'font-semibold text-red-700')}>{dinheiro(l.saldo)}</span> },
    { chave: 'percentual_executado', titulo: '% executado', tipo: 'numero', render: (l) => (
      <div className="flex min-w-[110px] items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(l.percentual_executado ?? 0))}%`, background: Number(l.percentual_comprometido) > 100 ? '#e34948' : Number(l.percentual_comprometido) >= Number(l.alerta_percentual) ? '#eda100' : '#2a78d6' }} />
        </div>
        <span className="w-12 text-right text-xs tabular-nums">{pct(l.percentual_executado)}</span>
      </div>), exportar: (l) => l.percentual_executado },
    { chave: 'percentual_comprometido', titulo: '% exec.+compr.', tipo: 'numero', oculta: true },
    { chave: 'documento_ref', titulo: 'Fundamento', oculta: true },
  ];

  const estourados = itens.filter((i) => Number(i.percentual_comprometido) > 100);
  return (
    <div className="space-y-6">
      <TituloPagina titulo="Controle orçamentário" descricao="Comparação entre orçamento aprovado, atualizado e executado. Executado = pagamentos efetivos; comprometido = despesas contratadas/lançadas/aprovadas ainda não pagas." />
      {estourados.length > 0 && <Aviso tom="atencao" titulo="Categorias acima do orçamento">{estourados.map((e) => `${e.categoria} (${e.fonte}): ${pct(e.percentual_comprometido)}`).join(' · ')}. Verifique a necessidade de remanejamento autorizado.</Aviso>}
      <Aviso tom="info">Recursos de fontes vinculadas são controlados separadamente: o sistema não considera que o saldo de uma fonte possa cobrir despesas de outra, e remanejamentos entre fontes vinculadas são bloqueados.</Aviso>

      <Cartao titulo="Execução orçamentária no período" semPadding>
        <Tabela tabela="v_execucao_orcamentaria" colunas={colunasExec} recarregar={versao} ordem={{ coluna: 'fonte', asc: true }}
          fixos={(q) => { q = q.lte('validade_inicio', filtro.fim).gte('validade_fim', filtro.inicio); if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId); return q; }}
          totais={['valor_aprovado', 'valor_atualizado', 'executado', 'comprometido', 'saldo']} nomeExportacao="execucao-orcamentaria" tituloImpressao="Execução orçamentária"
          vazio="Nenhum item de orçamento vigente no período." />
      </Cartao>

      <Cartao titulo="Itens do orçamento aprovado" semPadding>
        <CadastroSimples tabela="orcamento_itens" titulo="Item de orçamento" campos={camposOrcamento} podeEditar={pode('admin', 'financeiro')}
          select="*, fontes_recurso(nome), categorias(nome)" padrao={{ alerta_percentual: 80, validade_inicio: filtro.inicio, validade_fim: filtro.fim }}
          depoisDeSalvar={() => setVersao((v) => v + 1)} ordem={{ coluna: 'validade_inicio', asc: false }}
          colunas={[
            { chave: 'fonte', titulo: 'Fonte', render: (l) => l.fontes_recurso?.nome, exportar: (l) => l.fontes_recurso?.nome, ordenavel: false },
            { chave: 'categoria', titulo: 'Categoria', render: (l) => l.categorias?.nome, exportar: (l) => l.categorias?.nome, ordenavel: false },
            { chave: 'valor_aprovado', titulo: 'Aprovado', tipo: 'dinheiro' },
            { chave: 'valor_revisado', titulo: 'Revisado', tipo: 'dinheiro' },
            { chave: 'validade_inicio', titulo: 'Início', tipo: 'data' },
            { chave: 'validade_fim', titulo: 'Fim', tipo: 'data' },
            { chave: 'documento_ref', titulo: 'Fundamento' },
          ]} />
      </Cartao>

      <Cartao titulo="Solicitações de remanejamento" semPadding>
        <div className="px-4 pt-3 text-xs text-slate-500">Remanejamentos nunca são automáticos: são solicitados com justificativa e só alteram o orçamento após autorização de um administrador, com o documento correspondente.</div>
        <CadastroSimples tabela="remanejamentos" titulo="Solicitação de remanejamento" campos={camposRemanejamento} podeEditar={pode('admin', 'financeiro')}
          select="*, origem:orcamento_itens!remanejamentos_origem_id_fkey(categorias(nome), fontes_recurso(nome)), destino:orcamento_itens!remanejamentos_destino_id_fkey(categorias(nome), fontes_recurso(nome))"
          ordem={{ coluna: 'solicitado_em', asc: false }} depoisDeSalvar={() => setVersao((v) => v + 1)}
          colunas={[
            { chave: 'solicitado_em', titulo: 'Solicitado em', tipo: 'data' },
            { chave: 'origem', titulo: 'De', render: (l) => `${l.origem?.categorias?.nome} (${l.origem?.fontes_recurso?.nome})`, exportar: (l) => l.origem?.categorias?.nome, ordenavel: false },
            { chave: 'destino', titulo: 'Para', render: (l) => `${l.destino?.categorias?.nome} (${l.destino?.fontes_recurso?.nome})`, exportar: (l) => l.destino?.categorias?.nome, ordenavel: false },
            { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' },
            { chave: 'justificativa', titulo: 'Justificativa' },
            { chave: 'status', titulo: 'Situação', tipo: 'status' },
            { chave: 'documento_autorizacao', titulo: 'Autorização' },
          ]}
          filtros={[{ chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: opcoesStatus(['solicitado', 'autorizado', 'negado']), aplicar: (q, v) => q.eq('status', v) }]}
          acoesExtras={(l, recarregar) => l.status === 'solicitado' && pode('admin') ? <Decisao r={l} onFeito={() => { recarregar(); setVersao((v) => v + 1); }} /> : null} />
      </Cartao>
    </div>
  );
}
