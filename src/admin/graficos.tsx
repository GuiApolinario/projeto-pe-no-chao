// Configuração comum dos gráficos (paleta validada para daltonismo, ordem fixa).
import type { ReactNode } from 'react';
import { dinheiro } from '../lib/formato';

export const SERIE = {
  receitas: '#2a78d6',
  despesas: '#eb6834',
  saldo: '#6250d6',
  aprovado: '#c3c2b7',
  executado: '#2a78d6',
  comprometido: '#eda100',
};

// paleta categórica (ordem fixa; acima de 8 categorias agrupa em "Outras")
export const CATEGORICAS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const COR_OUTRAS = '#9a9890';

export const eixo = { fontSize: 11, fill: '#52514e' };
export const grade = { stroke: '#e7e5e0', strokeDasharray: '0' };

export function moedaCurta(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (a >= 1000) return `R$ ${(v / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.', ',')} mil`;
  return `R$ ${v.toFixed(0)}`;
}

/** Dica (tooltip) com valores em reais e texto em cores de texto, não da série. */
export function Dica({ active, payload, label, rotulo }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; rotulo?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-800">{rotulo ? rotulo(String(label)) : label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-700">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="ml-auto font-medium tabular-nums">{dinheiro(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legenda({ itens }: { itens: { cor: string; rotulo: ReactNode }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {itens.map((i, k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />{i.rotulo}</span>)}
    </div>
  );
}

/** Agrupa categorias além da 7ª em "Outras" para não gerar cores novas. */
export function agruparCategorias<T extends { categoria: string; valor: number }>(itens: T[]): (T & { cor: string })[] {
  const ord = [...itens].sort((a, b) => b.valor - a.valor);
  if (ord.length <= CATEGORICAS.length) return ord.map((x, i) => ({ ...x, cor: CATEGORICAS[i] }));
  const topo = ord.slice(0, CATEGORICAS.length - 1).map((x, i) => ({ ...x, cor: CATEGORICAS[i] }));
  const resto = ord.slice(CATEGORICAS.length - 1).reduce((a, x) => a + Math.round(x.valor * 100), 0) / 100;
  return [...topo, { ...ord[0], categoria: 'Outras', categoria_id: null, valor: resto, cor: COR_OUTRAS } as T & { cor: string }];
}
