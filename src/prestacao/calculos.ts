// Cálculos da prestação de contas. Dinheiro sempre somado em centavos inteiros.
import { centavos } from '../lib/formato';
import { categoriaDoGrafico } from './categorias';
import type { Lancamento, TipoLancamento } from './tipos';

export interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
  qtdEntradas: number;
  qtdSaidas: number;
  /** quanto de cada R$ 100 que entraram já foi usado (null se nada entrou) */
  pctUsado: number | null;
  semComprovante: number;
}

export function resumo(lancs: Lancamento[]): Resumo {
  let e = 0, s = 0, qe = 0, qs = 0, sem = 0;
  for (const l of lancs) {
    const c = centavos(l.valor);
    if (l.tipo === 'entrada') { e += c; qe++; } else { s += c; qs++; }
    if (!l.anexos?.length) sem++;
  }
  return { entradas: e / 100, saidas: s / 100, saldo: (e - s) / 100, qtdEntradas: qe, qtdSaidas: qs, pctUsado: e > 0 ? (s / e) * 100 : null, semComprovante: sem };
}

export function anosDisponiveis(lancs: Lancamento[]): number[] {
  return [...new Set(lancs.map((l) => Number(l.data.slice(0, 4))))].sort((a, b) => b - a);
}

/** ano null = todos; mes 0 = ano inteiro */
export function filtrarPeriodo(lancs: Lancamento[], ano: number | null, mes: number): Lancamento[] {
  return lancs.filter((l) => (ano === null || Number(l.data.slice(0, 4)) === ano) && (!mes || Number(l.data.slice(5, 7)) === mes));
}

export interface PontoMes {
  mes: string; // aaaa-mm
  entradas: number;
  saidas: number;
  /** saldo acumulado desde o começo dos registros até o fim do mês */
  saldo: number;
}

function proximoMes(m: string): string {
  const [a, n] = m.split('-').map(Number);
  return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`;
}

/** Série mês a mês. hoje = aaaa-mm-dd (para não mostrar meses futuros vazios do ano corrente). */
export function porMes(lancs: Lancamento[], ano: number | null, hoje: string): PontoMes[] {
  if (!lancs.length) return [];
  const meses = lancs.map((l) => l.data.slice(0, 7)).sort();
  let inicio = meses[0];
  let fim = meses[meses.length - 1];
  if (ano !== null) {
    const doAno = meses.filter((m) => m.startsWith(String(ano)));
    const ultimoComDados = doAno[doAno.length - 1] ?? `${ano}-01`;
    const anoAtual = Number(hoje.slice(0, 4));
    inicio = `${ano}-01`;
    // anos passados aparecem completos; o ano corrente vai até o mês atual (ou o último com dados)
    fim = ano < anoAtual ? `${ano}-12` : ano === anoAtual && hoje.slice(0, 7) > ultimoComDados ? hoje.slice(0, 7) : ultimoComDados;
  }
  const porChave = new Map<string, { e: number; s: number }>();
  let acumuladoAntes = 0;
  for (const l of lancs) {
    const m = l.data.slice(0, 7);
    const c = centavos(l.valor) * (l.tipo === 'entrada' ? 1 : -1);
    if (m < inicio) { acumuladoAntes += c; continue; }
    const p = porChave.get(m) ?? { e: 0, s: 0 };
    if (l.tipo === 'entrada') p.e += centavos(l.valor); else p.s += centavos(l.valor);
    porChave.set(m, p);
  }
  const res: PontoMes[] = [];
  let acc = acumuladoAntes;
  for (let m = inicio; m <= fim; m = proximoMes(m)) {
    const p = porChave.get(m) ?? { e: 0, s: 0 };
    acc += p.e - p.s;
    res.push({ mes: m, entradas: p.e / 100, saidas: p.s / 100, saldo: acc / 100 });
  }
  return res;
}

export interface FatiaCategoria { categoria: string; valor: number; pct: number; qtd: number }

export function porCategoria(lancs: Lancamento[], tipo: TipoLancamento): FatiaCategoria[] {
  const mapa = new Map<string, { c: number; q: number }>();
  for (const l of lancs) {
    if (l.tipo !== tipo) continue;
    const k = categoriaDoGrafico(tipo, l.categoria);
    const p = mapa.get(k) ?? { c: 0, q: 0 };
    p.c += centavos(l.valor); p.q++;
    mapa.set(k, p);
  }
  const total = [...mapa.values()].reduce((a, p) => a + p.c, 0);
  return [...mapa.entries()]
    .map(([categoria, p]) => ({ categoria, valor: p.c / 100, qtd: p.q, pct: total ? (p.c / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function buscar(lancs: Lancamento[], termo: string): Lancamento[] {
  const palavras = sem(termo.trim()).split(/\s+/).filter(Boolean);
  if (!palavras.length) return lancs;
  return lancs.filter((l) => {
    const texto = sem(`${l.descricao} ${l.categoria} ${l.contraparte ?? ''}`);
    return palavras.every((p) => texto.includes(p));
  });
}

export function ordenarRecentes(lancs: Lancamento[]): Lancamento[] {
  return [...lancs].sort((a, b) => (a.data === b.data ? b.atualizado_em.localeCompare(a.atualizado_em) : b.data.localeCompare(a.data)));
}

export function ultimaAtualizacao(lancs: Lancamento[]): string | null {
  return lancs.reduce<string | null>((m, l) => (!m || l.atualizado_em > m ? l.atualizado_em : m), null);
}
