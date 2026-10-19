// Prestação de contas "sem banco": os registros ficam em public/dados/prestacao.json e as fotos em public/comprovantes/.
// Tudo o que está aqui é PÚBLICO (o site é estático), por isso só entra o que pode aparecer para qualquer pessoa.
import type { Anexo, Lancamento } from './tipos';

export const CAMINHO_DADOS = 'public/dados/prestacao.json';
export const URL_DADOS = '/dados/prestacao.json';

const reData = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function anexoValido(a: unknown): Anexo | null {
  if (!a || typeof a !== 'object') return null;
  const x = a as Record<string, unknown>;
  const path = txt(x.path, 200);
  if (!/^comprovantes\/[\w./-]+$/.test(path) || path.includes('..')) return null;
  return { path, nome: txt(x.nome, 120) || undefined, tipo: txt(x.tipo, 40) || undefined, publico: true };
}

/** Lê o arquivo de dados ignorando qualquer item mal formado. */
export function lerLista(texto: string | null | undefined): Lancamento[] {
  if (!texto) return [];
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return []; }
  const lista = Array.isArray(bruto) ? bruto : (bruto as { lancamentos?: unknown })?.lancamentos;
  if (!Array.isArray(lista)) return [];
  const res: Lancamento[] = [];
  for (const i of lista) {
    const x = i as Record<string, unknown>;
    const valor = Number(x?.valor);
    if (!x || (x.tipo !== 'entrada' && x.tipo !== 'saida') || typeof x.data !== 'string' || !reData.test(x.data) || !(valor > 0) || !Number.isFinite(valor)) continue;
    const id = txt(x.id, 60);
    if (!id) continue;
    res.push({
      id, tipo: x.tipo, data: x.data, valor: Math.round(valor * 100) / 100,
      categoria: txt(x.categoria, 60), descricao: txt(x.descricao, 300),
      contraparte: txt(x.contraparte, 120) || null,
      anexos: (Array.isArray(x.anexos) ? x.anexos : []).map(anexoValido).filter((a): a is Anexo => !!a).slice(0, 6),
      atualizado_em: txt(x.atualizado_em, 40) || `${x.data}T12:00:00Z`,
    });
  }
  return res;
}

export function serializar(lista: Lancamento[]): string {
  const ordenada = [...lista].sort((a, b) => (a.data === b.data ? a.id.localeCompare(b.id) : b.data.localeCompare(a.data)));
  const limpa = ordenada.map((l) => ({ id: l.id, tipo: l.tipo, data: l.data, valor: l.valor, categoria: l.categoria, descricao: l.descricao, contraparte: l.contraparte, anexos: l.anexos.map((a) => ({ path: a.path, nome: a.nome, tipo: a.tipo })), atualizado_em: l.atualizado_em }));
  return JSON.stringify({ lancamentos: limpa }, null, 2) + '\n';
}

/** Insere ou substitui (pelo id). */
export function salvarNaLista(lista: Lancamento[], l: Lancamento): Lancamento[] {
  return lista.some((x) => x.id === l.id) ? lista.map((x) => (x.id === l.id ? l : x)) : [...lista, l];
}
export const removerDaLista = (lista: Lancamento[], id: string) => lista.filter((x) => x.id !== id);

export const caminhoNoRepositorio = (a: Anexo) => `public/${a.path}`;
export const urlDaFoto = (a: Anexo) => `/${a.path}`;

export function novoCaminhoFoto(dataISO: string, id: string, tipo: string): string {
  const ext = tipo === 'application/pdf' ? 'pdf' : tipo === 'image/png' ? 'png' : 'jpg';
  return `comprovantes/${dataISO.slice(0, 4)}/${dataISO.slice(5, 7)}/${id}.${ext}`;
}
