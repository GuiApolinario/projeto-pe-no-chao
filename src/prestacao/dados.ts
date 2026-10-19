import { useCallback, useEffect, useState } from 'react';
import { hojeISO } from '../lib/formato';
import { lerLista, URL_DADOS } from './arquivo';
import { modoArquivo, modoDemo, obterCliente, temBackend, type ConfigPrestacao } from './config';
import { lancamentosDemo } from './demo';
import type { Lancamento } from './tipos';

export type EstadoDados = 'carregando' | 'ok' | 'erro' | 'sem-configuracao';

/** Lê da visão pública (pc_publico): só o que a equipe marcou para aparecer no site. */
export async function carregarPublico(c: ConfigPrestacao): Promise<Lancamento[]> {
  const sb = obterCliente(c);
  const res: Lancamento[] = [];
  for (let de = 0; de < 50000; de += 1000) {
    const { data, error } = await sb.from('pc_publico').select('*').order('data', { ascending: false }).order('id').range(de, de + 999);
    if (error) throw error;
    res.push(...((data as Lancamento[]) ?? []));
    if (!data || data.length < 1000) break;
  }
  return res;
}

export function usePrestacaoPublica(c: ConfigPrestacao | null) {
  const [estado, setEstado] = useState<EstadoDados>('carregando');
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!c) return;
    if (modoDemo(c)) { setLancs(lancamentosDemo(hojeISO())); setEstado('ok'); return; }
    if (modoArquivo(c)) {
      try {
        const r = await fetch(URL_DADOS, { cache: 'no-cache' });
        setLancs(r.ok ? lerLista(await r.text()) : []);
        setEstado('ok');
      } catch (e) { setErro((e as Error).message); setEstado('erro'); }
      return;
    }
    if (!temBackend(c)) { setEstado('sem-configuracao'); return; }
    setEstado('carregando');
    try { setLancs(await carregarPublico(c)); setEstado('ok'); }
    catch (e) { setErro((e as { message?: string })?.message ?? String(e)); setEstado('erro'); }
  }, [c]);

  useEffect(() => { carregar(); }, [carregar]);
  return { estado, lancs, erro, recarregar: carregar };
}
