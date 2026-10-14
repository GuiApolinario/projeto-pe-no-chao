// Contextos globais: usuário conectado (com papel) e filtro de período/fonte.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { mensagemErro, supabase } from './supabase';
import { hojeISO } from './formato';

export type Papel = 'admin' | 'financeiro' | 'atividades' | 'conferente' | 'visualizador';

export interface Perfil { id: string; nome: string; email: string | null; papel: Papel; ativo: boolean; }

interface Sessao {
  carregando: boolean;
  erroPerfil: string | null;
  sessao: Session | null;
  perfil: Perfil | null;
  pode: (...papeis: Papel[]) => boolean;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  async function carregarPerfil(s: Session | null) {
    if (!s) { setPerfil(null); setErroPerfil(null); return; }
    try {
      const { data, error } = await supabase.from('perfis').select('*').eq('id', s.user.id).maybeSingle();
      if (error) throw error;
      setPerfil((data as Perfil) ?? null);
      setErroPerfil(data ? null : 'Seu usuário não possui perfil cadastrado. Fale com o administrador.');
    } catch (e) {
      setErroPerfil(mensagemErro(e));
    }
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data }) => { setSessao(data.session); await carregarPerfil(data.session); })
      .catch((e) => setErroPerfil(mensagemErro(e)))
      .finally(() => setCarregando(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSessao(s);
      // evita chamadas ao Supabase dentro do callback (recomendação da biblioteca)
      setTimeout(() => carregarPerfil(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const valor = useMemo<Sessao>(() => ({
    carregando,
    erroPerfil,
    sessao,
    perfil,
    pode: (...papeis) => !!perfil && perfil.ativo && (papeis.length === 0 || papeis.includes(perfil.papel)),
    sair: async () => { await supabase.auth.signOut(); },
    recarregarPerfil: () => carregarPerfil(sessao),
  }), [carregando, erroPerfil, sessao, perfil]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSessao fora do provedor');
  return c;
}

// ---------------------------------------------------------------- filtro global
export interface Filtro {
  inicio: string;
  fim: string;
  fonteId: string | null;
  periodoId: string | null;
  rotulo: string;
}

interface FiltroCtx { filtro: Filtro; setFiltro: (f: Filtro) => void; }
const CtxFiltro = createContext<FiltroCtx | null>(null);

function filtroInicial(): Filtro {
  try {
    const salvo = localStorage.getItem('pnc-filtro');
    if (salvo) return JSON.parse(salvo) as Filtro;
  } catch { /* armazenamento indisponível */ }
  const ano = hojeISO().slice(0, 4);
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, fonteId: null, periodoId: null, rotulo: `Ano de ${ano}` };
}

export function ProvedorFiltro({ children }: { children: ReactNode }) {
  const [filtro, setFiltroEstado] = useState<Filtro>(filtroInicial);
  const setFiltro = (f: Filtro) => {
    setFiltroEstado(f);
    try { localStorage.setItem('pnc-filtro', JSON.stringify(f)); } catch { /* ignora */ }
  };
  return <CtxFiltro.Provider value={{ filtro, setFiltro }}>{children}</CtxFiltro.Provider>;
}

export function useFiltro() {
  const c = useContext(CtxFiltro);
  if (!c) throw new Error('useFiltro fora do provedor');
  return c;
}
