// Tabela com paginação no servidor, busca, filtros combinados, ordenação,
// totais que respeitam os filtros e exportação (CSV, Excel, PDF/impressão).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Printer, Search, X } from 'lucide-react';
import { buscarTodos, mensagemErro, supabase } from '../lib/supabase';
import { data as fmtData, dinheiro, num, somar } from '../lib/formato';
import { exportarCSV, exportarXLSX, type ColunaExport } from '../lib/exportar';
import { abrirPDF, novoPDF } from '../lib/pdf';
import { Botao, Selecao, Selo, Texto, cx, useAviso } from './ui';
import { rotuloStatus } from '../lib/rotulos';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = any;
export type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Coluna {
  chave: string;
  titulo: string;
  tipo?: 'texto' | 'dinheiro' | 'data' | 'status' | 'numero';
  render?: (l: Linha) => ReactNode;
  exportar?: (l: Linha) => unknown;
  ordenavel?: boolean;
  oculta?: boolean; // só na exportação
  classe?: string;
}

export interface FiltroTabela {
  chave: string;
  rotulo: string;
  tipo: 'select' | 'data';
  opcoes?: { valor: string; rotulo: string }[];
  aplicar: (q: Consulta, valor: string) => Consulta;
}

interface Props {
  tabela: string;
  select?: string;
  colunas: Coluna[];
  busca?: string[];
  filtros?: FiltroTabela[];
  filtrosIniciais?: Record<string, string>;
  fixos?: (q: Consulta) => Consulta;
  ordem?: { coluna: string; asc?: boolean };
  porPagina?: number;
  totais?: string[];
  onLinha?: (l: Linha) => void;
  destacar?: (l: Linha) => boolean;
  acoes?: (l: Linha) => ReactNode;
  nomeExportacao?: string;
  tituloImpressao?: string;
  recarregar?: number;
  vazio?: ReactNode;
  ferramentas?: ReactNode;
}

function celula(c: Coluna, l: Linha): ReactNode {
  if (c.render) return c.render(l);
  const v = l[c.chave];
  if (c.tipo === 'dinheiro') return <span className="tabular-nums">{dinheiro(v)}</span>;
  if (c.tipo === 'data') return fmtData(v);
  if (c.tipo === 'numero') return num(v);
  if (c.tipo === 'status') return v ? <Selo status={v} /> : '—';
  return v ?? '—';
}

export function paraExport(colunas: Coluna[]): ColunaExport<Linha>[] {
  return colunas.map((c) => ({
    chave: c.chave,
    titulo: c.titulo,
    tipo: c.tipo === 'dinheiro' ? 'dinheiro' : c.tipo === 'data' ? 'data' : c.tipo === 'numero' ? 'numero' : 'texto',
    valor: (l: Linha) => {
      const v = c.exportar ? c.exportar(l) : l[c.chave];
      return c.tipo === 'status' && typeof v === 'string' ? rotuloStatus(v) : v;
    },
  }));
}

export function Tabela(p: Props) {
  const avisar = useAviso();
  const porPagina = p.porPagina ?? 25;
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [valores, setValores] = useState<Record<string, string>>(p.filtrosIniciais ?? {});
  const [ordem, setOrdem] = useState(p.ordem ?? { coluna: 'criado_em', asc: false });
  const [carregando, setCarregando] = useState(true);
  const [somas, setSomas] = useState<Record<string, number>>({});
  const [exportando, setExportando] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setBusca(termo); setPagina(0); }, 350); return () => clearTimeout(t); }, [termo]);
  useEffect(() => { if (p.filtrosIniciais) setValores(p.filtrosIniciais); }, [JSON.stringify(p.filtrosIniciais)]); // eslint-disable-line react-hooks/exhaustive-deps

  const aplicarFiltros = useCallback((q: Consulta) => {
    if (p.fixos) q = p.fixos(q);
    if (busca && p.busca?.length) {
      const t = busca.replace(/[,()%*\\]/g, ' ').trim();
      if (t) q = q.or(p.busca.map((c) => `${c}.ilike.*${t}*`).join(','));
    }
    for (const f of p.filtros ?? []) {
      const v = valores[f.chave];
      if (v) q = f.aplicar(q, v);
    }
    return q;
  }, [p.fixos, p.busca, p.filtros, busca, valores]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      let q = supabase.from(p.tabela).select(p.select ?? '*', { count: 'exact' });
      q = aplicarFiltros(q).order(ordem.coluna, { ascending: !!ordem.asc, nullsFirst: false });
      if (ordem.coluna !== 'id') q = q.order('id', { ascending: true });
      const { data, error, count } = await q.range(pagina * porPagina, pagina * porPagina + porPagina - 1);
      if (error) throw error;
      setLinhas((data as unknown as Linha[]) || []);
      setTotal(count ?? 0);
      if (p.totais?.length) {
        const todos = await buscarTodos<Linha>((de, ate) => aplicarFiltros(supabase.from(p.tabela).select(p.totais!.join(','))).range(de, ate));
        setSomas(Object.fromEntries(p.totais.map((k) => [k, somar(todos.map((t) => t[k]))])));
      }
    } catch (e) {
      avisar('erro', mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [p.tabela, p.select, p.totais, aplicarFiltros, ordem, pagina, porPagina, avisar]);

  useEffect(() => { carregar(); }, [carregar, p.recarregar]);

  const visiveis = useMemo(() => p.colunas.filter((c) => !c.oculta), [p.colunas]);
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  async function todosFiltrados() {
    return buscarTodos<Linha>((de, ate) =>
      aplicarFiltros(supabase.from(p.tabela).select(p.select ?? '*')).order(ordem.coluna, { ascending: !!ordem.asc }).order('id').range(de, ate));
  }

  async function exportar(tipo: 'csv' | 'xlsx' | 'pdf') {
    setExportando(true);
    try {
      const todos = await todosFiltrados();
      const cols = paraExport(p.colunas);
      const nome = `${p.nomeExportacao ?? p.tabela}-${new Date().toISOString().slice(0, 10)}`;
      if (tipo === 'csv') exportarCSV(todos, cols, nome);
      else if (tipo === 'xlsx') await exportarXLSX(todos, cols, nome);
      else {
        const d = await novoPDF({ titulo: p.tituloImpressao ?? 'Relatório', subtitulo: descricaoFiltros(), paisagem: cols.length > 6 });
        const totaisFmt = p.totais ? Object.fromEntries(p.totais.map((k) => [k, dinheiro(somar(todos.map((t) => t[k])))])) : undefined;
        d.tabela(todos, cols, { totais: totaisFmt, tamanho: cols.length > 9 ? 6.5 : 7.5 });
        abrirPDF(d.finalizar(), nome + '.pdf');
      }
      avisar('ok', `${todos.length} registro(s) exportado(s).`);
    } catch (e) {
      avisar('erro', mensagemErro(e));
    } finally {
      setExportando(false);
    }
  }

  function descricaoFiltros() {
    const partes = (p.filtros ?? []).filter((f) => valores[f.chave]).map((f) => {
      const v = valores[f.chave];
      return `${f.rotulo}: ${f.tipo === 'data' ? fmtData(v) : f.opcoes?.find((o) => o.valor === v)?.rotulo ?? v}`;
    });
    if (busca) partes.push(`Busca: "${busca}"`);
    return partes.join(' · ') || 'Sem filtros adicionais';
  }

  const filtrosAtivos = Object.values(valores).filter(Boolean).length + (busca ? 1 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {p.busca && (
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Texto placeholder="Pesquisar…" value={termo} onChange={(e) => setTermo(e.target.value)} className="pl-9" aria-label="Pesquisar" />
            </div>
          )}
          {p.ferramentas}
          <div className="ml-auto flex gap-1">
            <Botao variante="secundario" pequeno onClick={() => exportar('csv')} disabled={exportando} icone={<FileText className="h-3.5 w-3.5" />}>CSV</Botao>
            <Botao variante="secundario" pequeno onClick={() => exportar('xlsx')} disabled={exportando} icone={<FileSpreadsheet className="h-3.5 w-3.5" />}>Excel</Botao>
            <Botao variante="secundario" pequeno onClick={() => exportar('pdf')} carregando={exportando} icone={<Printer className="h-3.5 w-3.5" />}>Imprimir</Botao>
          </div>
        </div>
        {!!p.filtros?.length && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {p.filtros.map((f) => (
              <label key={f.chave} className="block">
                <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{f.rotulo}</span>
                {f.tipo === 'select'
                  ? <Selecao opcoes={f.opcoes ?? []} vazio="Todos" value={valores[f.chave] ?? ''} onChange={(e) => { setValores({ ...valores, [f.chave]: e.target.value }); setPagina(0); }} className="py-1.5" />
                  : <Texto type="date" value={valores[f.chave] ?? ''} onChange={(e) => { setValores({ ...valores, [f.chave]: e.target.value }); setPagina(0); }} className="py-1.5" />}
              </label>
            ))}
            {filtrosAtivos > 0 && (
              <div className="flex items-end">
                <Botao variante="fantasma" pequeno icone={<X className="h-3.5 w-3.5" />} onClick={() => { setValores({}); setTermo(''); setPagina(0); }}>Limpar filtros</Botao>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-h-[65vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              {visiveis.map((c) => {
                const ordenavel = c.ordenavel !== false && !c.render;
                const ativa = ordem.coluna === c.chave;
                return (
                  <th key={c.chave} scope="col" className={cx('whitespace-nowrap px-3 py-2.5', (c.tipo === 'dinheiro' || c.tipo === 'numero') && 'text-right')}>
                    {ordenavel ? (
                      <button className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => setOrdem({ coluna: c.chave, asc: ativa ? !ordem.asc : true })}>
                        {c.titulo}{ativa && (ordem.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    ) : c.titulo}
                  </th>
                );
              })}
              {p.acoes && <th className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carregando && !linhas.length ? (
              <tr><td colSpan={visiveis.length + 1} className="px-3 py-10 text-center text-slate-500">Carregando…</td></tr>
            ) : !linhas.length ? (
              <tr><td colSpan={visiveis.length + 1} className="px-3 py-10 text-center text-slate-500">{p.vazio ?? 'Nenhum registro encontrado.'}</td></tr>
            ) : linhas.map((l) => (
              <tr key={l.id ?? JSON.stringify(l)} onClick={() => p.onLinha?.(l)}
                className={cx(p.onLinha && 'cursor-pointer', 'hover:bg-sol-50/60', p.destacar?.(l) && 'bg-amber-50/70', carregando && 'opacity-60')}>
                {visiveis.map((c) => (
                  <td key={c.chave} className={cx('px-3 py-2 align-top text-slate-700', (c.tipo === 'dinheiro' || c.tipo === 'numero') && 'text-right whitespace-nowrap', c.tipo === 'data' && 'whitespace-nowrap', c.classe)}>
                    {celula(c, l)}
                  </td>
                ))}
                {p.acoes && <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>{p.acoes(l)}</td>}
              </tr>
            ))}
          </tbody>
          {p.totais?.length && linhas.length > 0 ? (
            <tfoot className="sticky bottom-0 bg-slate-50 text-sm font-semibold text-slate-800 shadow-[0_-1px_0_0_#e2e8f0]">
              <tr>
                {visiveis.map((c, i) => (
                  <td key={c.chave} className={cx('px-3 py-2', c.tipo === 'dinheiro' && 'text-right tabular-nums whitespace-nowrap')}>
                    {p.totais!.includes(c.chave) ? dinheiro(somas[c.chave] ?? 0) : i === 0 ? `Total (${total} reg.)` : ''}
                  </td>
                ))}
                {p.acoes && <td />}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        <span>{total === 0 ? 'Nenhum registro' : `${pagina * porPagina + 1}–${Math.min(total, (pagina + 1) * porPagina)} de ${total}`}</span>
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" pequeno disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Botao>
          <span>Página {pagina + 1} de {paginas}</span>
          <Botao variante="fantasma" pequeno disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Botao>
        </div>
      </div>
    </div>
  );
}
