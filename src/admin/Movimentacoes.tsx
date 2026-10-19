import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import { useFiltro } from '../lib/sessao';
import { opcoesStatus } from '../lib/rotulos';
import { data as fmtData } from '../lib/formato';
import { Selo, TituloPagina } from '../components/ui';
import { Tabela, type Coluna, type FiltroTabela } from '../components/Tabela';
import { useOpcoes } from '../components/Formulario';

export default function Movimentacoes() {
  const { filtro } = useFiltro();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const categorias = useOpcoes({ tabela: 'categorias', rotulo: 'nome' });
  const fontes = useOpcoes({ tabela: 'fontes_recurso', rotulo: 'nome' });
  const contas = useOpcoes({ tabela: 'contas_resumo', rotulo: 'nome' });

  const inicio = params.get('inicio') || filtro.inicio;
  const fim = params.get('fim') || filtro.fim;

  const filtros: FiltroTabela[] = useMemo(() => [
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [{ valor: 'receita', rotulo: 'Receita' }, { valor: 'despesa', rotulo: 'Despesa' }], aplicar: (q, v) => q.eq('tipo', v) },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: categorias, aplicar: (q, v) => q.eq('categoria_id', v) },
    { chave: 'fonte', rotulo: 'Fonte de recurso', tipo: 'select', opcoes: fontes, aplicar: (q, v) => q.eq('fonte_id', v) },
    { chave: 'conta', rotulo: 'Conta', tipo: 'select', opcoes: contas, aplicar: (q, v) => q.eq('conta_id', v) },
    { chave: 'situacao', rotulo: 'Situação financeira', tipo: 'select', opcoes: opcoesStatus(['prevista', 'atrasada', 'recebida', 'contratada', 'lancada', 'aprovada', 'parcialmente_paga', 'paga', 'cancelada', 'reembolsada']), aplicar: (q, v) => q.eq('situacao_financeira', v) },
    { chave: 'documental', rotulo: 'Situação documental', tipo: 'select', opcoes: opcoesStatus(['sem_documentos', 'incompleta', 'aguardando_conferencia', 'rejeitada', 'validada']), aplicar: (q, v) => q.eq('situacao_documental', v) },
    { chave: 'conferencia', rotulo: 'Conferência', tipo: 'select', opcoes: opcoesStatus(['pendente', 'em_analise', 'aprovado', 'rejeitado']), aplicar: (q, v) => q.eq('conferencia', v) },
  ], [categorias, fontes, contas]);

  const iniciais = useMemo(() => {
    const r: Record<string, string> = {};
    for (const k of ['tipo', 'categoria', 'fonte', 'conta', 'situacao', 'documental', 'conferencia']) { const v = params.get(k); if (v) r[k] = v; }
    return r;
  }, [params]);

  const colunas: Coluna[] = [
    { chave: 'data', titulo: 'Data', tipo: 'data' },
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'tipo', titulo: 'Tipo', render: (l) => <Selo tom={l.tipo === 'receita' ? 'ok' : 'erro'}>{l.tipo === 'receita' ? 'Receita' : 'Despesa'}</Selo>, exportar: (l) => (l.tipo === 'receita' ? 'Receita' : 'Despesa') },
    { chave: 'descricao', titulo: 'Descrição', classe: 'min-w-[220px]' },
    { chave: 'categoria', titulo: 'Categoria' },
    { chave: 'contraparte', titulo: 'Fornecedor / origem' },
    { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' },
    { chave: 'valor_realizado', titulo: 'Realizado', tipo: 'dinheiro' },
    { chave: 'forma', titulo: 'Forma' },
    { chave: 'conta', titulo: 'Conta' },
    { chave: 'fonte', titulo: 'Fonte' },
    { chave: 'situacao_financeira', titulo: 'Situação financeira', tipo: 'status', exportar: (l) => l.situacao_financeira },
    { chave: 'situacao_documental', titulo: 'Situação documental', tipo: 'status', exportar: (l) => l.situacao_documental },
    { chave: 'anexos', titulo: 'Anexos', render: (l) => <span className="inline-flex items-center gap-1 text-slate-600"><Paperclip className="h-3.5 w-3.5" />{l.anexos}</span>, exportar: (l) => l.anexos },
    { chave: 'conferencia', titulo: 'Conferência', tipo: 'status' },
    { chave: 'conferente', titulo: 'Conferente' },
  ];

  return (
    <div>
      <TituloPagina titulo="Movimentações" descricao={`Todos os lançamentos de ${fmtData(inicio)} a ${fmtData(fim)}. "Valor" é o total lançado; "Realizado" é o efetivamente recebido ou pago.`} />
      <Tabela
        tabela="v_movimentacoes"
        colunas={colunas}
        busca={['descricao', 'codigo', 'contraparte', 'categoria']}
        filtros={filtros}
        filtrosIniciais={iniciais}
        fixos={(q) => { q = q.gte('data', inicio).lte('data', fim); if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId); return q; }}
        ordem={{ coluna: 'data', asc: false }}
        totais={['valor', 'valor_realizado']}
        destacar={(l) => ['sem_documentos', 'incompleta', 'rejeitada'].includes(l.situacao_documental) || l.situacao_financeira === 'atrasada'}
        onLinha={(l) => nav(`/admin/${l.tipo === 'receita' ? 'receitas' : 'despesas'}?abrir=${l.id}`)}
        nomeExportacao="movimentacoes"
        tituloImpressao={`Movimentações — ${fmtData(inicio)} a ${fmtData(fim)}`}
      />
      <p className="mt-2 text-xs text-slate-500">Linhas destacadas têm pendência documental ou receita em atraso. Os totais respeitam todos os filtros aplicados.</p>
    </div>
  );
}
