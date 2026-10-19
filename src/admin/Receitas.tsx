import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Plus } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro, useSessao } from '../lib/sessao';
import { FORMAS_PAGAMENTO, opcoes, opcoesStatus, rotuloStatus } from '../lib/rotulos';
import { data as fmtData, hojeISO } from '../lib/formato';
import { Aviso, Botao, Modal, Selo, TituloPagina, useAviso, useConfirmacao } from '../components/ui';
import { Tabela, type Coluna, type FiltroTabela, type Linha } from '../components/Tabela';
import { Formulario, normalizar, useOpcoes, validar, type Campo, type Valores } from '../components/Formulario';
import { Anexos } from '../components/Anexos';
import { Historico, PainelConferencia } from './comum';

const SELECT = '*, categorias(nome), fontes_recurso(nome), contas_resumo(nome)';

export const camposReceita: Campo[] = [
  { nome: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, secao: 'Identificação', opcoes: opcoesStatus(['prevista', 'recebida']),
    ajuda: 'Prevista: ainda não entrou no caixa. Recebida: valor creditado na conta.' },
  { nome: 'categoria_id', rotulo: 'Categoria', tipo: 'ref', obrigatorio: true, secao: 'Identificação', ref: { tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'receita', ativo: true }, ordem: 'ordem' } },
  { nome: 'fonte_id', rotulo: 'Fonte de recurso', tipo: 'ref', obrigatorio: true, secao: 'Identificação', ref: { tabela: 'fontes_recurso', rotulo: 'nome', filtro: { ativo: true } } },
  { nome: 'descricao', rotulo: 'Descrição detalhada', tipo: 'area', obrigatorio: true, secao: 'Identificação' },
  { nome: 'instrumento_id', rotulo: 'Instrumento de parceria', tipo: 'ref', secao: 'Identificação', ref: { tabela: 'instrumentos', rotulo: 'numero' }, ajuda: 'Se houver termo, convênio ou contrato.' },
  { nome: 'periodo_referencia', rotulo: 'Período de referência', tipo: 'texto', secao: 'Identificação', placeholder: 'Ex.: março/2026, parcela 2' },

  { nome: 'data_prevista', rotulo: 'Data prevista', tipo: 'data', secao: 'Previsão', obrigatorio: (v) => v.status === 'prevista' },
  { nome: 'valor_previsto', rotulo: 'Valor previsto', tipo: 'dinheiro', secao: 'Previsão', obrigatorio: (v) => v.status === 'prevista' },
  { nome: 'data_competencia', rotulo: 'Data de competência', tipo: 'data', secao: 'Previsão' },
  { nome: 'parcela_numero', rotulo: 'Parcela nº', tipo: 'inteiro', secao: 'Previsão' },
  { nome: 'parcela_total', rotulo: 'Total de parcelas', tipo: 'inteiro', secao: 'Previsão' },

  { nome: 'data_recebimento', rotulo: 'Data de recebimento', tipo: 'data', secao: 'Recebimento', obrigatorio: true, visivel: (v) => v.status === 'recebida' },
  { nome: 'valor_recebido', rotulo: 'Valor recebido', tipo: 'dinheiro', secao: 'Recebimento', obrigatorio: true, visivel: (v) => v.status === 'recebida' },
  { nome: 'forma_recebimento', rotulo: 'Forma de recebimento', tipo: 'select', secao: 'Recebimento', opcoes: opcoes(FORMAS_PAGAMENTO), visivel: (v) => v.status === 'recebida' },
  { nome: 'conta_id', rotulo: 'Conta de destino', tipo: 'ref', secao: 'Recebimento', obrigatorio: true, ref: { tabela: 'contas_resumo', rotulo: 'nome', filtro: { ativo: true } }, visivel: (v) => v.status === 'recebida' },
  { nome: 'referencia_bancaria', rotulo: 'Documento / referência bancária', tipo: 'texto', secao: 'Recebimento', visivel: (v) => v.status === 'recebida' },

  { nome: 'origem', rotulo: 'Origem do recurso', tipo: 'texto', secao: 'Origem', placeholder: 'Ex.: Campanha de Natal, Prefeitura…' },
  { nome: 'doador_nome', rotulo: 'Doador / patrocinador / concedente', tipo: 'texto', secao: 'Origem' },
  { nome: 'doador_documento', rotulo: 'CPF/CNPJ do doador', tipo: 'texto', secao: 'Origem' },
  { nome: 'observacoes', rotulo: 'Observações', tipo: 'area', secao: 'Origem' },
];

export default function Receitas() {
  const { filtro } = useFiltro();
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [params, setParams] = useSearchParams();
  const [aberto, setAberto] = useState<Valores | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const categorias = useOpcoes({ tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'receita' } });
  const fontes = useOpcoes({ tabela: 'fontes_recurso', rotulo: 'nome' });
  const editavel = pode('admin', 'financeiro') && aberto?.status !== 'cancelada';

  async function abrir(id: string) {
    const { data, error } = await supabase.from('receitas').select(SELECT).eq('id', id).single();
    if (error) return avisar('erro', mensagemErro(error));
    setErros([]); setAberto(data);
  }
  useEffect(() => { const id = params.get('abrir'); if (id) { abrir(id); setParams({}, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!aberto) return;
    const f = validar(camposReceita, aberto);
    setErros(f);
    if (f.length) return;
    setSalvando(true);
    const dados = normalizar(camposReceita, aberto);
    const q = aberto.id ? supabase.from('receitas').update(dados).eq('id', aberto.id).select(SELECT).single() : supabase.from('receitas').insert(dados).select(SELECT).single();
    const { data, error } = await q;
    setSalvando(false);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', aberto.id ? 'Receita atualizada.' : `Receita ${data.codigo} registrada. Anexe o comprovante de recebimento.`);
    setAberto(data); setVersao((v) => v + 1);
  }

  async function cancelar() {
    if (!aberto?.id) return;
    const j = await confirmar({ titulo: `Cancelar ${aberto.codigo}`, texto: 'O lançamento continuará no histórico com a situação "cancelada" e deixará de compor os saldos.', justificativa: true, perigo: true, rotuloOk: 'Cancelar receita' });
    if (!j) return;
    const { data, error } = await supabase.from('receitas').update({ status: 'cancelada', cancel_justificativa: j }).eq('id', aberto.id).select(SELECT).single();
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Receita cancelada.'); setAberto(data); setVersao((v) => v + 1);
  }

  const filtros: FiltroTabela[] = useMemo(() => [
    { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: opcoesStatus(['prevista', 'atrasada', 'recebida', 'cancelada']),
      aplicar: (q, v) => v === 'atrasada' ? q.eq('status', 'prevista').lt('data_prevista', hojeISO()) : q.eq('status', v) },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: categorias, aplicar: (q, v) => q.eq('categoria_id', v) },
    { chave: 'fonte', rotulo: 'Fonte', tipo: 'select', opcoes: fontes, aplicar: (q, v) => q.eq('fonte_id', v) },
    { chave: 'conferencia', rotulo: 'Conferência', tipo: 'select', opcoes: opcoesStatus(['pendente', 'em_analise', 'aprovado', 'rejeitado']), aplicar: (q, v) => q.eq('conferencia', v) },
  ], [categorias, fontes]);

  const colunas: Coluna[] = [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'data_recebimento', titulo: 'Recebimento', tipo: 'data' },
    { chave: 'data_prevista', titulo: 'Previsão', tipo: 'data' },
    { chave: 'descricao', titulo: 'Descrição', classe: 'min-w-[200px]' },
    { chave: 'categoria', titulo: 'Categoria', render: (l) => l.categorias?.nome, exportar: (l) => l.categorias?.nome, ordenavel: false },
    { chave: 'doador_nome', titulo: 'Doador / origem', render: (l) => l.doador_nome || l.origem || '—', exportar: (l) => l.doador_nome || l.origem },
    { chave: 'fonte', titulo: 'Fonte', render: (l) => l.fontes_recurso?.nome, exportar: (l) => l.fontes_recurso?.nome, ordenavel: false },
    { chave: 'valor_previsto', titulo: 'Previsto', tipo: 'dinheiro' },
    { chave: 'valor_recebido', titulo: 'Recebido', tipo: 'dinheiro' },
    { chave: 'conta', titulo: 'Conta', render: (l) => l.contas_resumo?.nome ?? '—', exportar: (l) => l.contas_resumo?.nome, ordenavel: false },
    { chave: 'status', titulo: 'Situação', render: (l: Linha) => <Selo status={l.status === 'prevista' && l.data_prevista < hojeISO() ? 'atrasada' : l.status} />, exportar: (l) => rotuloStatus(l.status === 'prevista' && l.data_prevista < hojeISO() ? 'atrasada' : l.status) },
    { chave: 'conferencia', titulo: 'Conferência', tipo: 'status' },
    { chave: 'referencia_bancaria', titulo: 'Referência', oculta: true },
    { chave: 'forma_recebimento', titulo: 'Forma', oculta: true },
    { chave: 'observacoes', titulo: 'Observações', oculta: true },
  ];

  return (
    <div>
      <TituloPagina titulo="Receitas e entradas" descricao="Cada entrada financeira registrada individualmente. Valores previstos não são somados ao caixa. Doações em bens ficam no módulo próprio."
        acoes={pode('admin', 'financeiro') && <Botao variante="sol" icone={<Plus className="h-4 w-4" />} onClick={() => { setErros([]); setAberto({ status: 'recebida', data_recebimento: hojeISO(), fonte_id: filtro.fonteId ?? '' }); }}>Nova receita</Botao>} />
      <Tabela tabela="receitas" select={SELECT} colunas={colunas} busca={['descricao', 'codigo', 'doador_nome', 'origem', 'referencia_bancaria']}
        filtros={filtros} filtrosIniciais={params.get('status') ? { status: params.get('status')! } : undefined}
        fixos={(q) => { q = q.or(`and(data_recebimento.gte.${filtro.inicio},data_recebimento.lte.${filtro.fim}),and(data_recebimento.is.null,data_prevista.gte.${filtro.inicio},data_prevista.lte.${filtro.fim})`); if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId); return q; }}
        ordem={{ coluna: 'data_recebimento', asc: false }} totais={['valor_previsto', 'valor_recebido']} recarregar={versao}
        onLinha={(l) => abrir(l.id)} destacar={(l) => l.status === 'prevista' && l.data_prevista < hojeISO()}
        nomeExportacao="receitas" tituloImpressao={`Receitas — ${fmtData(filtro.inicio)} a ${fmtData(filtro.fim)}`} />

      <Modal aberto={!!aberto} titulo={aberto?.id ? `Receita ${aberto.codigo}` : 'Nova receita'} onFechar={() => setAberto(null)} largura="max-w-4xl"
        rodape={<>
          {aberto?.id && editavel && <Botao variante="secundario" icone={<Ban className="h-4 w-4 text-red-600" />} onClick={cancelar}>Cancelar receita</Botao>}
          <Botao variante="secundario" onClick={() => setAberto(null)}>Fechar</Botao>
          {editavel && <Botao onClick={salvar} carregando={salvando}>Salvar</Botao>}
        </>}>
        {aberto && (
          <div className="space-y-4">
            {aberto.status === 'cancelada' && <Aviso tom="atencao" titulo="Receita cancelada">{aberto.cancel_justificativa}</Aviso>}
            {erros.length > 0 && <Aviso tom="erro">Preencha: {erros.join(', ')}.</Aviso>}
            <fieldset disabled={!editavel}><Formulario campos={camposReceita} valores={aberto} onChange={setAberto} /></fieldset>
            {aberto.id && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Anexos entidade="receita" registroId={aberto.id} podeEnviar={pode('admin', 'financeiro')} tipoPadrao="comprovante_recebimento" titulo="Comprovantes de recebimento" />
                <div className="space-y-3">
                  <PainelConferencia tabela="receitas" id={aberto.id} situacao={aberto.conferencia} obs={aberto.obs_conferencia} conferidoEm={aberto.conferido_em} onAlterado={() => { abrir(aberto.id); setVersao((v) => v + 1); }} />
                  <Historico tabela="receitas" id={aberto.id} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      {elemento}
    </div>
  );
}
