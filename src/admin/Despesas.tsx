import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, CheckSquare, CircleDollarSign, Plus, Square, Undo2, UserPlus } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro, useSessao } from '../lib/sessao';
import { FORMAS_PAGAMENTO, TIPOS_DOCUMENTO, opcoes, opcoesStatus } from '../lib/rotulos';
import { cpfCnpjValido, data as fmtData, dinheiro, hojeISO, lerDinheiro, somar } from '../lib/formato';
import { Aviso, Botao, CampoDinheiro, Modal, Rotulo, Selecao, Selo, Texto, TituloPagina, useAviso, useConfirmacao } from '../components/ui';
import { Tabela, type Coluna, type FiltroTabela } from '../components/Tabela';
import { Formulario, limparCacheOpcoes, normalizar, useOpcoes, validar, type Campo, type Valores } from '../components/Formulario';
import { Anexos } from '../components/Anexos';
import { Historico, PainelConferencia } from './comum';

const SELECT = '*, categorias!despesas_categoria_id_fkey(nome), fontes_recurso(nome), fornecedores(nome, cpf_cnpj)';

export const camposDespesa: Campo[] = [
  { nome: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, secao: 'Identificação', opcoes: opcoesStatus(['prevista', 'contratada', 'lancada', 'aprovada', 'paga']),
    desabilitado: (v) => v.status === 'paga', ajuda: '"Paga" é definida automaticamente quando os pagamentos quitam a despesa.' },
  { nome: 'descricao', rotulo: 'Descrição completa da aquisição ou serviço', tipo: 'area', obrigatorio: true, secao: 'Identificação' },
  { nome: 'fornecedor_id', rotulo: 'Fornecedor / beneficiário', tipo: 'ref', secao: 'Identificação', ref: { tabela: 'fornecedores', rotulo: 'nome', filtro: { ativo: true } },
    obrigatorio: (v) => v.status !== 'prevista' },
  { nome: 'categoria_id', rotulo: 'Categoria financeira', tipo: 'ref', secao: 'Identificação', obrigatorio: (v) => v.status !== 'prevista', ref: { tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'despesa', parent_id: 'null', ativo: true }, ordem: 'ordem' } },
  { nome: 'subcategoria_id', rotulo: 'Subcategoria', tipo: 'texto', secao: 'Identificação', visivel: () => false },
  { nome: 'fonte_id', rotulo: 'Fonte de recurso', tipo: 'ref', obrigatorio: true, secao: 'Identificação', ref: { tabela: 'fontes_recurso', rotulo: 'nome', filtro: { ativo: true } } },
  { nome: 'instrumento_id', rotulo: 'Instrumento de parceria', tipo: 'ref', secao: 'Identificação', ref: { tabela: 'instrumentos', rotulo: 'numero' } },
  { nome: 'meta_id', rotulo: 'Meta / atividade beneficiada', tipo: 'ref', secao: 'Identificação', ref: { tabela: 'metas', rotulo: 'descricao', filtro: { ativo: true } } },
  { nome: 'centro_custo', rotulo: 'Centro de custo', tipo: 'texto', secao: 'Identificação' },

  { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', secao: 'Valores', obrigatorio: true },
  { nome: 'valor_unitario', rotulo: 'Valor unitário', tipo: 'dinheiro', secao: 'Valores', ajuda: 'Se informado, o total é calculado automaticamente.' },
  { nome: 'desconto', rotulo: 'Desconto', tipo: 'dinheiro', secao: 'Valores' },
  { nome: 'valor_total', rotulo: 'Valor total', tipo: 'dinheiro', secao: 'Valores', obrigatorio: (v) => !v.valor_unitario, desabilitado: (v) => !!v.valor_unitario },

  { nome: 'data_compra', rotulo: 'Data da compra', tipo: 'data', secao: 'Datas', obrigatorio: (v) => !v.data_emissao && !v.data_vencimento },
  { nome: 'data_emissao', rotulo: 'Emissão do documento fiscal', tipo: 'data', secao: 'Datas' },
  { nome: 'data_vencimento', rotulo: 'Vencimento', tipo: 'data', secao: 'Datas' },
  { nome: 'data_competencia', rotulo: 'Competência', tipo: 'data', secao: 'Datas' },

  { nome: 'tipo_documento_fiscal', rotulo: 'Tipo de documento fiscal', tipo: 'select', secao: 'Documento e pagamento', opcoes: opcoes(['Nota fiscal eletrônica', 'Nota fiscal de serviço', 'Cupom fiscal', 'Recibo', 'Fatura', 'RPA', 'Outro']) },
  { nome: 'numero_documento_fiscal', rotulo: 'Número da NF / recibo', tipo: 'texto', secao: 'Documento e pagamento' },
  { nome: 'forma_pagamento', rotulo: 'Forma de pagamento prevista', tipo: 'select', secao: 'Documento e pagamento', opcoes: opcoes(FORMAS_PAGAMENTO) },
  { nome: 'conta_id', rotulo: 'Conta bancária prevista', tipo: 'ref', secao: 'Documento e pagamento', ref: { tabela: 'contas_resumo', rotulo: 'nome', filtro: { ativo: true } } },
  { nome: 'referencia_transacao', rotulo: 'Referência da transação', tipo: 'texto', secao: 'Documento e pagamento' },

  { nome: 'justificativa', rotulo: 'Justificativa da despesa', tipo: 'area', secao: 'Justificativa e responsáveis', ajuda: 'Por que a compra foi necessária e como se relaciona ao projeto.' },
  { nome: 'responsavel_compra', rotulo: 'Responsável pela compra', tipo: 'texto', secao: 'Justificativa e responsáveis' },
  { nome: 'observacoes', rotulo: 'Observações', tipo: 'area', secao: 'Justificativa e responsáveis' },
];

interface Pagamento { id: string; codigo: string; data_pagamento: string; valor: number; forma_pagamento: string; referencia: string | null; estornado: boolean; estorno_justificativa: string | null; contas_resumo: { nome: string } | null; }
interface ItemChecklist { id: string; item: string; obrigatorio: boolean; atendido: boolean; dispensado: boolean; dispensa_justificativa: string | null; criterio: string; }

function descreverCriterio(c: string) {
  if (c === 'campo:justificativa') return 'preencher a justificativa';
  if (c === 'campo:fornecedor') return 'fornecedor com CPF/CNPJ';
  if (c.startsWith('doc:')) return 'anexar: ' + c.slice(4).split('|').map((t) => TIPOS_DOCUMENTO[t] ?? t).join(' ou ');
  return c;
}

function NovoFornecedor({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (id: string) => void }) {
  const avisar = useAviso();
  const [v, setV] = useState({ nome: '', cpf_cnpj: '', contato: '' });
  const docInvalido = v.cpf_cnpj.trim() !== '' && !cpfCnpjValido(v.cpf_cnpj);
  async function salvar() {
    const { data, error } = await supabase.from('fornecedores').insert({ nome: v.nome.trim(), cpf_cnpj: v.cpf_cnpj.trim() || null, contato: v.contato.trim() || null }).select('id').single();
    if (error) return avisar('erro', mensagemErro(error));
    limparCacheOpcoes('fornecedores'); avisar('ok', 'Fornecedor cadastrado.'); onCriado(data.id); setV({ nome: '', cpf_cnpj: '', contato: '' });
  }
  return (
    <Modal aberto={aberto} titulo="Novo fornecedor / beneficiário" onFechar={onFechar} largura="max-w-md"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar} disabled={v.nome.trim().length < 2}>Cadastrar</Botao></>}>
      <div className="space-y-3">
        <Rotulo texto="Nome / razão social" obrigatorio><Texto value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} autoFocus /></Rotulo>
        <Rotulo texto="CPF ou CNPJ" ajuda={docInvalido ? <span className="text-amber-700">Dígitos verificadores não conferem — revise.</span> : 'Necessário para o checklist documental.'}><Texto value={v.cpf_cnpj} onChange={(e) => setV({ ...v, cpf_cnpj: e.target.value })} /></Rotulo>
        <Rotulo texto="Contato"><Texto value={v.contato} onChange={(e) => setV({ ...v, contato: e.target.value })} /></Rotulo>
      </div>
    </Modal>
  );
}

function Pagamentos({ despesa, onAlterado }: { despesa: Valores; onAlterado: () => void }) {
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [lista, setLista] = useState<Pagamento[]>([]);
  const [novo, setNovo] = useState<null | { data_pagamento: string; valor: string; forma_pagamento: string; conta_id: string; referencia: string }>(null);
  const contas = useOpcoes({ tabela: 'contas_resumo', rotulo: 'nome', filtro: { ativo: true } });
  const restante = somar([despesa.valor_total, -Number(despesa.valor_pago)]);
  const carregar = useCallback(async () => {
    const { data } = await supabase.from('pagamentos').select('*, contas_resumo(nome)').eq('despesa_id', despesa.id).order('data_pagamento');
    setLista((data as Pagamento[]) || []);
  }, [despesa.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function registrar() {
    if (!novo) return;
    const valor = lerDinheiro(novo.valor);
    const { error } = await supabase.from('pagamentos').insert({ despesa_id: despesa.id, data_pagamento: novo.data_pagamento, valor, forma_pagamento: novo.forma_pagamento, conta_id: novo.conta_id, referencia: novo.referencia || null });
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Pagamento registrado. Anexe o comprovante.'); setNovo(null); carregar(); onAlterado();
  }

  async function estornar(p: Pagamento) {
    const j = await confirmar({ titulo: `Estornar ${p.codigo}`, texto: `O pagamento de ${dinheiro(p.valor)} será mantido no histórico como estornado e o saldo devedor da despesa será reaberto.`, justificativa: true, perigo: true, rotuloOk: 'Estornar' });
    if (!j) return;
    const { error } = await supabase.from('pagamentos').update({ estornado: true, estorno_justificativa: j }).eq('id', p.id);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Pagamento estornado.'); carregar(); onAlterado();
  }

  const podePagar = pode('admin', 'financeiro') && !['prevista', 'cancelada', 'reembolsada'].includes(despesa.status) && restante > 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><CircleDollarSign className="h-4 w-4" />Pagamentos</p>
        {podePagar && <Botao pequeno variante="secundario" icone={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setNovo({ data_pagamento: hojeISO(), valor: restante.toFixed(2), forma_pagamento: despesa.forma_pagamento || 'PIX', conta_id: despesa.conta_id || '', referencia: '' })}>Registrar pagamento</Botao>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Total</p><p className="font-semibold tabular-nums">{dinheiro(despesa.valor_total)}</p></div>
        <div className="rounded-lg bg-emerald-50 p-2"><p className="text-slate-500">Pago</p><p className="font-semibold tabular-nums">{dinheiro(despesa.valor_pago)}</p></div>
        <div className="rounded-lg bg-amber-50 p-2"><p className="text-slate-500">Saldo devedor</p><p className="font-semibold tabular-nums">{dinheiro(restante)}</p></div>
      </div>
      {lista.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {lista.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-2 p-2 ${p.estornado ? 'opacity-60' : ''}`}>
              <span className="font-mono text-xs text-slate-500">{p.codigo}</span>
              <span>{fmtData(p.data_pagamento)}</span>
              <span className={`font-medium tabular-nums ${p.estornado ? 'line-through' : ''}`}>{dinheiro(p.valor)}</span>
              <span className="text-xs text-slate-500">{p.forma_pagamento} · {p.contas_resumo?.nome}{p.referencia ? ` · ${p.referencia}` : ''}</span>
              {p.estornado ? <Selo tom="neutro">Estornado: {p.estorno_justificativa}</Selo>
                : pode('admin', 'financeiro') && <Botao pequeno variante="fantasma" className="ml-auto" icone={<Undo2 className="h-3.5 w-3.5" />} onClick={() => estornar(p)}>Estornar</Botao>}
            </li>
          ))}
        </ul>
      )}
      {despesa.status === 'prevista' && <p className="text-xs text-slate-500">Despesas previstas não podem ser pagas: altere a situação para contratada, lançada ou aprovada.</p>}
      <Modal aberto={!!novo} titulo="Registrar pagamento" onFechar={() => setNovo(null)} largura="max-w-lg"
        rodape={<><Botao variante="secundario" onClick={() => setNovo(null)}>Cancelar</Botao><Botao onClick={registrar} disabled={!novo?.conta_id || !lerDinheiro(novo?.valor ?? '')}>Registrar</Botao></>}>
        {novo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Rotulo texto="Data efetiva do pagamento" obrigatorio><Texto type="date" value={novo.data_pagamento} onChange={(e) => setNovo({ ...novo, data_pagamento: e.target.value })} /></Rotulo>
            <Rotulo texto="Valor efetivamente pago" obrigatorio ajuda={`Saldo devedor: ${dinheiro(restante)}. Pagamentos parciais são permitidos.`}><CampoDinheiro valor={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} /></Rotulo>
            <Rotulo texto="Forma de pagamento" obrigatorio><Selecao vazio={false} opcoes={opcoes(FORMAS_PAGAMENTO)} value={novo.forma_pagamento} onChange={(e) => setNovo({ ...novo, forma_pagamento: e.target.value })} /></Rotulo>
            <Rotulo texto="Conta bancária utilizada" obrigatorio><Selecao opcoes={contas} value={novo.conta_id} onChange={(e) => setNovo({ ...novo, conta_id: e.target.value })} /></Rotulo>
            <Rotulo texto="Referência da transação (ID do PIX, nº do documento…)" className="sm:col-span-2"><Texto value={novo.referencia} onChange={(e) => setNovo({ ...novo, referencia: e.target.value })} /></Rotulo>
          </div>
        )}
      </Modal>
      {elemento}
    </div>
  );
}

function Checklist({ despesaId, versao, onAlterado }: { despesaId: string; versao: number; onAlterado: () => void }) {
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const carregar = useCallback(() => {
    supabase.from('despesa_checklist').select('*').eq('despesa_id', despesaId).order('atualizado_em').then(({ data }) => setItens((data as ItemChecklist[]) || []));
  }, [despesaId]);
  useEffect(() => { carregar(); }, [carregar, versao]);

  async function dispensar(i: ItemChecklist) {
    const j = await confirmar({ titulo: 'Dispensar item do checklist', texto: `Dispensar "${i.item}" para esta despesa? Use somente quando a regra do financiador permitir.`, justificativa: true, minimo: 5 });
    if (!j) return;
    const { error } = await supabase.from('despesa_checklist').update({ dispensado: true, dispensa_justificativa: j }).eq('id', i.id);
    if (error) return avisar('erro', mensagemErro(error));
    carregar(); onAlterado();
  }

  if (!itens.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><CheckSquare className="h-4 w-4" />Checklist documental</p>
      <ul className="space-y-1 rounded-lg border border-slate-200 p-2 text-sm">
        {itens.map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            {i.atendido || i.dispensado ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
            <div className="flex-1">
              <p className={i.atendido ? 'text-slate-700' : 'text-slate-900'}>{i.item}{!i.obrigatorio && <span className="text-xs text-slate-500"> (opcional)</span>}</p>
              {!i.atendido && !i.dispensado && <p className="text-xs text-slate-500">Para atender: {descreverCriterio(i.criterio)}</p>}
              {i.dispensado && <p className="text-xs text-slate-500">Dispensado: {i.dispensa_justificativa}</p>}
            </div>
            {!i.atendido && !i.dispensado && i.obrigatorio && pode('admin', 'conferente') && <Botao pequeno variante="fantasma" onClick={() => dispensar(i)}>Dispensar</Botao>}
          </li>
        ))}
      </ul>
      {elemento}
    </div>
  );
}

export default function Despesas() {
  const { filtro } = useFiltro();
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [params, setParams] = useSearchParams();
  const [aberto, setAberto] = useState<Valores | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [novoForn, setNovoForn] = useState(false);
  const categorias = useOpcoes({ tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'despesa' } });
  const fontes = useOpcoes({ tabela: 'fontes_recurso', rotulo: 'nome' });
  const fornecedores = useOpcoes({ tabela: 'fornecedores', rotulo: 'nome' });
  const subcats = useOpcoes(aberto?.categoria_id ? { tabela: 'categorias', rotulo: 'nome', filtro: { parent_id: aberto.categoria_id } } : undefined);
  const editavel = pode('admin', 'financeiro') && !['cancelada', 'reembolsada'].includes(aberto?.status);

  const abrir = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('despesas').select(SELECT).eq('id', id).single();
    if (error) return avisar('erro', mensagemErro(error));
    setErros([]); setAberto(data);
  }, [avisar]);
  useEffect(() => { const id = params.get('abrir'); if (id) { abrir(id); const p = new URLSearchParams(params); p.delete('abrir'); setParams(p, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pagamentosIds, setPagamentosIds] = useState<string[]>([]);
  useEffect(() => {
    if (!aberto?.id) { setPagamentosIds([]); return; }
    supabase.from('pagamentos').select('id').eq('despesa_id', aberto.id).then(({ data }) => setPagamentosIds((data || []).map((p) => p.id)));
  }, [aberto?.id, aberto?.valor_pago]);

  async function salvar() {
    if (!aberto) return;
    const f = validar(camposDespesa, aberto);
    setErros(f);
    if (f.length) return;
    setSalvando(true);
    const dados = normalizar(camposDespesa, aberto);
    dados.subcategoria_id = aberto.subcategoria_id || null;
    if (!dados.desconto) dados.desconto = 0;
    if (dados.valor_unitario) dados.valor_total = 0; // recalculado no servidor
    if (aberto.id && aberto.status === 'paga') delete dados.status;
    const q = aberto.id ? supabase.from('despesas').update(dados).eq('id', aberto.id).select(SELECT).single() : supabase.from('despesas').insert(dados).select(SELECT).single();
    const { data, error } = await q;
    setSalvando(false);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', aberto.id ? 'Despesa atualizada.' : `Despesa ${data.codigo} registrada. Agora anexe a nota fiscal e registre o pagamento.`);
    setAberto(data); setVersao((v) => v + 1);
  }

  async function cancelar(tipo: 'cancelada' | 'reembolsada') {
    if (!aberto?.id) return;
    const j = await confirmar({ titulo: tipo === 'cancelada' ? `Cancelar ${aberto.codigo}` : `Marcar ${aberto.codigo} como reembolsada`,
      texto: tipo === 'cancelada' ? 'O lançamento será preservado no histórico. Se houver pagamentos, estorne-os primeiro.' : 'Use quando o valor tiver sido devolvido ao projeto. Registre a devolução também como receita, se houver crédito em conta.',
      justificativa: true, perigo: true });
    if (!j) return;
    const { data, error } = await supabase.from('despesas').update({ status: tipo, cancel_justificativa: j }).eq('id', aberto.id).select(SELECT).single();
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Situação atualizada.'); setAberto(data); setVersao((v) => v + 1);
  }

  const filtros: FiltroTabela[] = useMemo(() => [
    { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: opcoesStatus(['prevista', 'contratada', 'lancada', 'aprovada', 'paga', 'cancelada', 'reembolsada']), aplicar: (q, v) => q.eq('status', v) },
    { chave: 'pagamento', rotulo: 'Pagamento', tipo: 'select', opcoes: [...opcoesStatus(['em_aberto', 'parcial', 'quitada']), { valor: 'pendente', rotulo: 'Não quitadas (lançadas/aprovadas)' }],
      aplicar: (q, v) => v === 'pendente' ? q.in('status', ['lancada', 'aprovada']).neq('situacao_pagamento', 'quitada') : q.eq('situacao_pagamento', v) },
    { chave: 'doc', rotulo: 'Documentação', tipo: 'select', opcoes: [...opcoesStatus(['sem_documentos', 'incompleta', 'aguardando_conferencia', 'rejeitada', 'validada']), { valor: 'pendente', rotulo: 'Com pendências' }, { valor: 'completa', rotulo: 'Completa' }],
      aplicar: (q, v) => v === 'pendente' ? q.in('situacao_documental', ['sem_documentos', 'incompleta', 'rejeitada']).not('status', 'in', '(prevista,cancelada,reembolsada)')
        : v === 'completa' ? q.in('situacao_documental', ['aguardando_conferencia', 'validada']) : q.eq('situacao_documental', v) },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: categorias, aplicar: (q, v) => q.eq('categoria_id', v) },
    { chave: 'fonte', rotulo: 'Fonte', tipo: 'select', opcoes: fontes, aplicar: (q, v) => q.eq('fonte_id', v) },
    { chave: 'fornecedor', rotulo: 'Fornecedor', tipo: 'select', opcoes: fornecedores, aplicar: (q, v) => q.eq('fornecedor_id', v) },
  ], [categorias, fontes, fornecedores]);

  const iniciais = useMemo(() => {
    const r: Record<string, string> = {};
    for (const k of ['status', 'pagamento', 'doc', 'categoria', 'fonte', 'fornecedor']) { const v = params.get(k); if (v) r[k] = v; }
    return r;
  }, [params]);

  const colunas: Coluna[] = [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'data_compra', titulo: 'Compra', tipo: 'data' },
    { chave: 'data_vencimento', titulo: 'Vencimento', tipo: 'data' },
    { chave: 'fornecedor', titulo: 'Fornecedor', render: (l) => l.fornecedores?.nome ?? <span className="text-amber-700">Não identificado</span>, exportar: (l) => l.fornecedores?.nome, ordenavel: false },
    { chave: 'cpf_cnpj', titulo: 'CPF/CNPJ', oculta: true, exportar: (l) => l.fornecedores?.cpf_cnpj },
    { chave: 'descricao', titulo: 'Descrição', classe: 'min-w-[200px]' },
    { chave: 'categoria', titulo: 'Categoria', render: (l) => l.categorias?.nome ?? <span className="text-amber-700">Sem categoria</span>, exportar: (l) => l.categorias?.nome, ordenavel: false },
    { chave: 'fonte', titulo: 'Fonte', render: (l) => l.fontes_recurso?.nome, exportar: (l) => l.fontes_recurso?.nome, ordenavel: false },
    { chave: 'valor_total', titulo: 'Valor total', tipo: 'dinheiro' },
    { chave: 'valor_pago', titulo: 'Pago', tipo: 'dinheiro' },
    { chave: 'numero_documento_fiscal', titulo: 'NF / recibo' },
    { chave: 'status', titulo: 'Situação', tipo: 'status' },
    { chave: 'situacao_documental', titulo: 'Documentação', tipo: 'status' },
    { chave: 'conferencia', titulo: 'Conferência', tipo: 'status' },
    { chave: 'forma_pagamento', titulo: 'Forma de pagamento', oculta: true },
    { chave: 'justificativa', titulo: 'Justificativa', oculta: true },
    { chave: 'data_emissao', titulo: 'Emissão', tipo: 'data', oculta: true },
  ];

  return (
    <div>
      <TituloPagina titulo="Despesas" descricao="Cada gasto com cadastro individual, pagamentos, comprovantes e conferência. Lançamentos não são excluídos: use cancelamento ou estorno."
        acoes={pode('admin', 'financeiro') && <Botao variante="sol" icone={<Plus className="h-4 w-4" />} onClick={() => { setErros([]); setAberto({ status: 'lancada', quantidade: 1, desconto: 0, data_compra: hojeISO(), fonte_id: filtro.fonteId ?? '' }); }}>Nova despesa</Botao>} />
      <Tabela tabela="despesas" select={SELECT} colunas={colunas} busca={['descricao', 'codigo', 'numero_documento_fiscal', 'justificativa']}
        filtros={filtros} filtrosIniciais={iniciais}
        fixos={(q) => { q = q.or(`and(data_compra.gte.${filtro.inicio},data_compra.lte.${filtro.fim}),and(data_compra.is.null,data_vencimento.gte.${filtro.inicio},data_vencimento.lte.${filtro.fim}),and(data_compra.is.null,data_vencimento.is.null,data_emissao.gte.${filtro.inicio},data_emissao.lte.${filtro.fim})`); if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId); return q; }}
        ordem={{ coluna: 'data_compra', asc: false }} totais={['valor_total', 'valor_pago']} recarregar={versao}
        onLinha={(l) => abrir(l.id)}
        destacar={(l) => !['prevista', 'cancelada', 'reembolsada'].includes(l.status) && ['sem_documentos', 'incompleta', 'rejeitada'].includes(l.situacao_documental)}
        nomeExportacao="despesas" tituloImpressao={`Despesas — ${fmtData(filtro.inicio)} a ${fmtData(filtro.fim)}`} />
      <p className="mt-2 text-xs text-slate-500">Linhas destacadas: despesas com documentação ausente, incompleta ou devolvida para correção.</p>

      <Modal aberto={!!aberto} titulo={aberto?.id ? `Despesa ${aberto.codigo}` : 'Nova despesa'} onFechar={() => setAberto(null)} largura="max-w-5xl"
        rodape={<>
          {aberto?.id && editavel && <>
            <Botao variante="secundario" icone={<Ban className="h-4 w-4 text-red-600" />} onClick={() => cancelar('cancelada')}>Cancelar despesa</Botao>
            {Number(aberto.valor_pago) > 0 && <Botao variante="secundario" onClick={() => cancelar('reembolsada')}>Marcar reembolsada</Botao>}
          </>}
          <Botao variante="secundario" onClick={() => setAberto(null)}>Fechar</Botao>
          {editavel && <Botao onClick={salvar} carregando={salvando}>Salvar</Botao>}
        </>}>
        {aberto && (
          <div className="space-y-4">
            {aberto.id && (
              <div className="flex flex-wrap gap-2">
                <Selo status={aberto.status} /><Selo status={aberto.situacao_pagamento} /><Selo status={aberto.situacao_documental} />
              </div>
            )}
            {['cancelada', 'reembolsada'].includes(aberto.status) && <Aviso tom="atencao" titulo={aberto.status === 'cancelada' ? 'Despesa cancelada' : 'Despesa reembolsada'}>{aberto.cancel_justificativa}</Aviso>}
            {erros.length > 0 && <Aviso tom="erro">Preencha: {erros.join(', ')}.</Aviso>}
            <fieldset disabled={!editavel} className="space-y-3">
              <Formulario campos={camposDespesa} valores={aberto} onChange={setAberto} />
              <div className="grid gap-3 sm:grid-cols-3">
                {subcats.length > 0 && (
                  <Rotulo texto="Subcategoria"><Selecao opcoes={subcats} value={aberto.subcategoria_id ?? ''} onChange={(e) => setAberto({ ...aberto, subcategoria_id: e.target.value })} /></Rotulo>
                )}
                {editavel && <div className="flex items-end"><Botao variante="fantasma" pequeno icone={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setNovoForn(true)}>Cadastrar novo fornecedor</Botao></div>}
              </div>
            </fieldset>
            {aberto.id && (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <Pagamentos despesa={aberto} onAlterado={() => { abrir(aberto.id); setVersao((v) => v + 1); }} />
                  <Checklist despesaId={aberto.id} versao={versao} onAlterado={() => { abrir(aberto.id); setVersao((v) => v + 1); }} />
                </div>
                <div className="space-y-4">
                  <Anexos entidade="despesa" registroId={aberto.id} incluirPagamentos={pagamentosIds} podeEnviar={pode('admin', 'financeiro')} tipoPadrao="nota_fiscal" titulo="Comprovantes e documentos"
                    onAlterado={() => { abrir(aberto.id); setVersao((v) => v + 1); }} />
                  <PainelConferencia tabela="despesas" id={aberto.id} situacao={aberto.conferencia} obs={aberto.obs_conferencia} conferidoEm={aberto.conferido_em} onAlterado={() => { abrir(aberto.id); setVersao((v) => v + 1); }} />
                  <Historico tabela="despesas" id={aberto.id} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <NovoFornecedor aberto={novoForn} onFechar={() => setNovoForn(false)} onCriado={(id) => { setNovoForn(false); setAberto((a) => a && { ...a, fornecedor_id: id }); }} />
      {elemento}
    </div>
  );
}
