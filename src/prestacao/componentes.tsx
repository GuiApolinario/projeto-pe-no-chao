// Peças visuais compartilhadas entre a página pública e a área da equipe.
import { useEffect, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, PiggyBank, X } from 'lucide-react';
import { dinheiro, mesAno, num, pct } from '../lib/formato';
import { Dica, eixo, grade, SERIE } from '../admin/graficos';
import type { FatiaCategoria, PontoMes, Resumo } from './calculos';

/** Rótulo curto para o eixo vertical (sem "R$", que vai na legenda): 800 · 1,6 mil · 1,2 mi */
export function valorCurto(v: number): string {
  const a = Math.abs(v);
  const f = (n: number) => n.toFixed(n >= 10 ? 0 : 1).replace('.', ',').replace(',0', '');
  if (a >= 1_000_000) return `${f(v / 1_000_000)} mi`;
  if (a >= 1000) return `${f(v / 1000)} mil`;
  return String(Math.round(v));
}

export const COR_ENTRADA = SERIE.receitas; // azul
export const COR_SAIDA = SERIE.despesas;   // laranja
export const COR_SALDO = SERIE.saldo;      // roxo

export function Cartao({ titulo, subtitulo, children, className = '' }: { titulo: string; subtitulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6 ${className}`}>
      <h3 className="font-titulo text-xl font-bold text-slate-900">{titulo}</h3>
      {subtitulo && <p className="mb-3 text-sm text-slate-500">{subtitulo}</p>}
      <div className={subtitulo ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ 3 cartões grandes
export function CartoesResumo({ r, rotuloPeriodo }: { r: Resumo; rotuloPeriodo: string }) {
  const negativo = r.saldo < 0;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-blue-50 p-6 ring-1 ring-blue-100">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-blue-800"><ArrowUpRight className="h-5 w-5" />Entrou</p>
          <p className="mt-2 font-titulo text-4xl font-extrabold tabular-nums text-slate-900" data-teste="total-entrou">{dinheiro(r.entradas)}</p>
          <p className="mt-1 text-sm text-slate-600">{num(r.qtdEntradas)} {r.qtdEntradas === 1 ? 'registro' : 'registros'} de doações e entradas</p>
        </div>
        <div className="rounded-3xl bg-orange-50 p-6 ring-1 ring-orange-100">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-orange-800"><ArrowDownRight className="h-5 w-5" />Saiu</p>
          <p className="mt-2 font-titulo text-4xl font-extrabold tabular-nums text-slate-900" data-teste="total-saiu">{dinheiro(r.saidas)}</p>
          <p className="mt-1 text-sm text-slate-600">{num(r.qtdSaidas)} {r.qtdSaidas === 1 ? 'gasto registrado' : 'gastos registrados'}</p>
        </div>
        <div className={`rounded-3xl p-6 ring-1 ${negativo ? 'bg-red-50 ring-red-100' : 'bg-emerald-50 ring-emerald-100'}`}>
          <p className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${negativo ? 'text-red-800' : 'text-emerald-800'}`}><PiggyBank className="h-5 w-5" />{negativo ? 'Saldo negativo' : 'Sobrou'}</p>
          <p className="mt-2 font-titulo text-4xl font-extrabold tabular-nums text-slate-900" data-teste="total-saldo">{dinheiro(r.saldo)}</p>
          <p className="mt-1 text-sm text-slate-600">Entrou − saiu em {rotuloPeriodo}</p>
        </div>
      </div>
      {r.pctUsado !== null && (
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-slate-700">
            {r.pctUsado <= 100
              ? <>De cada <strong>R$ 100</strong> que entraram, <strong>R$ {Math.round(r.pctUsado)}</strong> já foram usados.</>
              : <>Neste período gastamos <strong>mais do que entrou</strong>, usando saldo de períodos anteriores.</>}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${Math.round(r.pctUsado)}% do que entrou já foi usado`}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pctUsado)}%`, background: COR_SAIDA }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ barras horizontais por categoria
export function BarrasCategoria({ fatias, cor, vazio }: { fatias: FatiaCategoria[]; cor: string; vazio: string }) {
  if (!fatias.length) return <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">{vazio}</p>;
  const max = Math.max(...fatias.map((f) => f.valor));
  return (
    <ul className="space-y-3">
      {fatias.map((f) => (
        <li key={f.categoria}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-800">{f.categoria}</span>
            <span className="shrink-0 tabular-nums text-slate-900"><strong>{dinheiro(f.valor)}</strong> <span className="text-slate-500">· {pct(f.pct)}</span></span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${f.categoria}: ${dinheiro(f.valor)}, ${pct(f.pct)}`}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%`, background: cor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ gráficos
export function GraficoMeses({ pontos, mesSelecionado, onMes }: { pontos: PontoMes[]; mesSelecionado?: string; onMes?: (mes: string) => void }) {
  if (!pontos.length) return <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">Ainda não há movimentação para mostrar.</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: COR_ENTRADA }} />Entrou</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: COR_SAIDA }} />Saiu</span>
        <span className="text-slate-400">· valores em reais (R$)</span>
      </div>
      <div className="h-64" role="img" aria-label="Gráfico de barras com o que entrou e o que saiu em cada mês">
        <ResponsiveContainer>
          <BarChart data={pontos} barGap={2}
            onClick={(e: { activeLabel?: string | number }) => { if (e?.activeLabel && onMes) onMes(String(e.activeLabel)); }}>
            <CartesianGrid vertical={false} {...grade} />
            <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={valorCurto} tick={eixo} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<Dica rotulo={mesAno} />} cursor={{ fill: '#f1f0ec' }} />
            <Bar dataKey="entradas" name="Entrou" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={26} className={onMes ? 'cursor-pointer' : ''}>
              {pontos.map((p) => <Cell key={p.mes} fillOpacity={mesSelecionado && p.mes !== mesSelecionado ? 0.3 : 1} />)}
            </Bar>
            <Bar dataKey="saidas" name="Saiu" fill={COR_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={26} className={onMes ? 'cursor-pointer' : ''}>
              {pontos.map((p) => <Cell key={p.mes} fillOpacity={mesSelecionado && p.mes !== mesSelecionado ? 0.3 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {onMes && <p className="mt-1 text-xs text-slate-500">Toque em um mês para ver só ele.</p>}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Ver os números em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-1">Mês</th><th className="text-right">Entrou</th><th className="text-right">Saiu</th><th className="text-right">Saldo</th></tr></thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {pontos.map((p) => <tr key={p.mes}><td className="py-1">{mesAno(p.mes + '-01')}</td><td className="text-right">{dinheiro(p.entradas)}</td><td className="text-right">{dinheiro(p.saidas)}</td><td className="text-right">{dinheiro(p.saldo)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function GraficoSaldo({ pontos }: { pontos: PontoMes[] }) {
  if (pontos.length < 2) return <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">O gráfico aparece quando houver pelo menos dois meses de registros.</p>;
  return (
    <div>
    <p className="mb-2 text-sm text-slate-400">Valores em reais (R$)</p>
    <div className="h-60" role="img" aria-label="Gráfico de linha com o saldo ao longo dos meses">
      <ResponsiveContainer>
        <LineChart data={pontos}>
          <CartesianGrid vertical={false} {...grade} />
          <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={valorCurto} tick={eixo} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<Dica rotulo={mesAno} />} />
          <Line type="monotone" dataKey="saldo" name="Saldo no fim do mês" stroke={COR_SALDO} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}

// ------------------------------------------------------------------ visualizador de comprovantes
export interface ItemVisual { url: string; nome: string; pdf: boolean }

export function Lightbox({ itens, indice, onFechar, onMudar }: { itens: ItemVisual[]; indice: number; onFechar: () => void; onMudar: (i: number) => void }) {
  const it = itens[indice];
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowLeft' && indice > 0) onMudar(indice - 1);
      if (e.key === 'ArrowRight' && indice < itens.length - 1) onMudar(indice + 1);
    };
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes; };
  }, [indice, itens.length, onFechar, onMudar]);
  if (!it) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90" role="dialog" aria-modal="true" aria-label="Comprovante" onClick={onFechar}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm">{it.nome} {itens.length > 1 && <span className="text-slate-400">({indice + 1} de {itens.length})</span>}</p>
        <div className="flex items-center gap-1">
          <a href={it.url} target="_blank" rel="noreferrer" className="rounded-full p-2 hover:bg-white/10" aria-label="Abrir em nova aba"><ExternalLink className="h-5 w-5" /></a>
          <a href={it.url} download={it.nome} className="rounded-full p-2 hover:bg-white/10" aria-label="Baixar"><Download className="h-5 w-5" /></a>
          <button onClick={onFechar} className="rounded-full p-2 hover:bg-white/10" aria-label="Fechar"><X className="h-6 w-6" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.stopPropagation()}>
        {indice > 0 && <button className="absolute left-2 z-10 rounded-full bg-white/15 p-3 text-white hover:bg-white/30" onClick={() => onMudar(indice - 1)} aria-label="Anterior"><ChevronLeft className="h-6 w-6" /></button>}
        {it.pdf
          ? <iframe src={it.url} title={it.nome} className="h-full w-full max-w-4xl rounded-xl bg-white" />
          : <img src={it.url} alt={it.nome} className="max-h-full max-w-full rounded-xl object-contain" />}
        {indice < itens.length - 1 && <button className="absolute right-2 z-10 rounded-full bg-white/15 p-3 text-white hover:bg-white/30" onClick={() => onMudar(indice + 1)} aria-label="Próximo"><ChevronRight className="h-6 w-6" /></button>}
      </div>
    </div>
  );
}

export function useLightbox() {
  const [estado, setEstado] = useState<{ itens: ItemVisual[]; indice: number } | null>(null);
  return {
    abrir: (itens: ItemVisual[], indice = 0) => setEstado({ itens, indice }),
    elemento: estado && <Lightbox itens={estado.itens} indice={estado.indice} onFechar={() => setEstado(null)} onMudar={(i) => setEstado({ ...estado, indice: i })} />,
  };
}

export function Miniatura({ item, onClick, tamanho = 'h-14 w-14' }: { item: ItemVisual; onClick: () => void; tamanho?: string }) {
  return (
    <button type="button" onClick={onClick} title={item.nome} aria-label={`Ver comprovante: ${item.nome}`}
      className={`${tamanho} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:ring-2 hover:ring-sol-400`}>
      {item.pdf ? <span className="flex flex-col items-center text-red-600"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold">PDF</span></span>
        : <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </button>
  );
}
