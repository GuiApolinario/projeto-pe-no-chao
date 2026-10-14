// Formulário organizado por seções, definido por configuração.
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { AreaTexto, Caixa, CampoDinheiro, Rotulo, Selecao, Texto, cx } from './ui';

export type Valores = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Campo {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'area' | 'numero' | 'dinheiro' | 'data' | 'select' | 'booleano' | 'ref' | 'email' | 'inteiro';
  obrigatorio?: boolean | ((v: Valores) => boolean);
  opcoes?: { valor: string; rotulo: string }[];
  ref?: { tabela: string; rotulo: string; filtro?: Record<string, string | boolean>; ordem?: string };
  secao?: string;
  ajuda?: ReactNode;
  largura?: 1 | 2 | 3;
  visivel?: (v: Valores) => boolean;
  desabilitado?: boolean | ((v: Valores) => boolean);
  placeholder?: string;
}

const cache = new Map<string, Promise<{ valor: string; rotulo: string }[]>>();

export function limparCacheOpcoes(tabela?: string) {
  for (const k of [...cache.keys()]) if (!tabela || k.startsWith(tabela + '|')) cache.delete(k);
}

export function useOpcoes(ref?: Campo['ref']) {
  const [opcoes, setOpcoes] = useState<{ valor: string; rotulo: string }[]>([]);
  const chave = ref ? `${ref.tabela}|${ref.rotulo}|${JSON.stringify(ref.filtro ?? {})}` : '';
  useEffect(() => {
    if (!ref) return;
    if (!cache.has(chave)) {
      let q = supabase.from(ref.tabela).select(`id, ${ref.rotulo}`);
      for (const [k, v] of Object.entries(ref.filtro ?? {})) q = v === 'null' ? q.is(k, null) : q.eq(k, v);
      cache.set(chave, Promise.resolve(q.order(ref.ordem ?? ref.rotulo).limit(1000)).then(({ data }) =>
        ((data as unknown as Record<string, string>[]) || []).map((r) => ({ valor: r.id, rotulo: r[ref.rotulo] }))));
    }
    let vivo = true;
    cache.get(chave)!.then((o) => vivo && setOpcoes(o));
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return opcoes;
}

function CampoRef({ campo, valor, onChange, desabilitado }: { campo: Campo; valor: string; onChange: (v: string) => void; desabilitado?: boolean }) {
  const opcoes = useOpcoes(campo.ref);
  return <Selecao opcoes={opcoes} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} disabled={desabilitado} />;
}

export function obrigatorio(c: Campo, v: Valores) {
  return typeof c.obrigatorio === 'function' ? c.obrigatorio(v) : !!c.obrigatorio;
}

/** Retorna a lista de campos obrigatórios não preenchidos. */
export function validar(campos: Campo[], v: Valores): string[] {
  return campos.filter((c) => (!c.visivel || c.visivel(v)) && obrigatorio(c, v) && (v[c.nome] === null || v[c.nome] === undefined || String(v[c.nome]).trim() === ''))
    .map((c) => c.rotulo);
}

/** Converte strings vazias em null antes de gravar. */
export function normalizar(campos: Campo[], v: Valores): Valores {
  const r: Valores = {};
  for (const c of campos) {
    if (c.visivel && !c.visivel(v)) { r[c.nome] = c.tipo === 'booleano' ? false : null; continue; }
    let x = v[c.nome];
    if (typeof x === 'string') x = x.trim();
    if (x === '' || x === undefined) x = c.tipo === 'booleano' ? false : null;
    if ((c.tipo === 'numero' || c.tipo === 'inteiro') && x !== null) x = Number(String(x).replace(',', '.'));
    r[c.nome] = x;
  }
  return r;
}

export function Formulario({ campos, valores, onChange, colunas = 3 }: { campos: Campo[]; valores: Valores; onChange: (v: Valores) => void; colunas?: 2 | 3 }) {
  const secoes: { nome: string; campos: Campo[] }[] = [];
  for (const c of campos) {
    if (c.visivel && !c.visivel(valores)) continue;
    const s = c.secao ?? '';
    let sec = secoes.find((x) => x.nome === s);
    if (!sec) { sec = { nome: s, campos: [] }; secoes.push(sec); }
    sec.campos.push(c);
  }
  const set = (nome: string, v: unknown) => onChange({ ...valores, [nome]: v });
  const grade = colunas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  const span = (l?: number) => (l === 3 ? (colunas === 3 ? 'sm:col-span-3' : 'sm:col-span-2') : l === 2 ? 'sm:col-span-2' : '');

  return (
    <div className="space-y-5">
      {secoes.map((s) => (
        <fieldset key={s.nome} className="space-y-3">
          {s.nome && <legend className="mb-1 w-full border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.nome}</legend>}
          <div className={cx('grid grid-cols-1 gap-3', grade)}>
            {s.campos.map((c) => {
              const v = valores[c.nome];
              const des = typeof c.desabilitado === 'function' ? c.desabilitado(valores) : c.desabilitado;
              if (c.tipo === 'booleano') {
                return <div key={c.nome} className={cx(span(c.largura), 'flex items-end pb-1')}><Caixa rotulo={c.rotulo} checked={!!v} onChange={(x) => set(c.nome, x)} ajuda={c.ajuda} /></div>;
              }
              return (
                <Rotulo key={c.nome} texto={c.rotulo} obrigatorio={obrigatorio(c, valores)} ajuda={c.ajuda} className={span(c.largura ?? (c.tipo === 'area' ? 3 : 1))}>
                  {c.tipo === 'area' ? <AreaTexto value={v ?? ''} onChange={(e) => set(c.nome, e.target.value)} disabled={des} placeholder={c.placeholder} />
                    : c.tipo === 'dinheiro' ? <CampoDinheiro valor={v} onChange={(x) => set(c.nome, x)} disabled={des} />
                    : c.tipo === 'select' ? <Selecao opcoes={c.opcoes ?? []} value={v ?? ''} onChange={(e) => set(c.nome, e.target.value)} disabled={des} />
                    : c.tipo === 'ref' ? <CampoRef campo={c} valor={v} onChange={(x) => set(c.nome, x)} desabilitado={des} />
                    : <Texto type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' || c.tipo === 'inteiro' ? 'number' : c.tipo === 'email' ? 'email' : 'text'}
                        step={c.tipo === 'numero' ? 'any' : undefined} value={v ?? ''} onChange={(e) => set(c.nome, e.target.value)} disabled={des} placeholder={c.placeholder} />}
                </Rotulo>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
