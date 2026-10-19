import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeftRight, Banknote, BarChart3, BookOpenCheck, CalendarClock, DatabaseBackup, FileArchive,
  FileBarChart, Gift, Globe, History, Landmark, LayoutDashboard, LogOut, Menu, Receipt, Settings, ShieldCheck, Users, Wallet, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFiltro, useSessao, type Papel } from '../lib/sessao';
import { PAPEIS } from '../lib/rotulos';
import { hojeISO, inicioFimMes } from '../lib/formato';
import { Carregando, Selecao, Texto, cx } from '../components/ui';

interface ItemMenu { para: string; rotulo: string; icone: typeof Activity; papeis?: Papel[] }
const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  { grupo: 'Visão geral', itens: [
    { para: '/admin', rotulo: 'Painel financeiro', icone: LayoutDashboard },
    { para: '/admin/alertas', rotulo: 'Alertas e pendências', icone: AlertTriangle },
  ] },
  { grupo: 'Financeiro', itens: [
    { para: '/admin/movimentacoes', rotulo: 'Movimentações', icone: ArrowLeftRight },
    { para: '/admin/receitas', rotulo: 'Receitas', icone: Wallet },
    { para: '/admin/despesas', rotulo: 'Despesas', icone: Receipt },
    { para: '/admin/comprovantes', rotulo: 'Comprovantes', icone: FileArchive },
    { para: '/admin/orcamento', rotulo: 'Orçamento', icone: BarChart3 },
    { para: '/admin/conciliacao', rotulo: 'Conciliação bancária', icone: Landmark, papeis: ['admin', 'financeiro', 'conferente'] },
    { para: '/admin/doacoes-bens', rotulo: 'Doações em bens', icone: Gift },
  ] },
  { grupo: 'Social', itens: [
    { para: '/admin/atividades', rotulo: 'Atividades', icone: Activity },
    { para: '/admin/resultados', rotulo: 'Resultados sociais', icone: BookOpenCheck },
    { para: '/admin/beneficiarios', rotulo: 'Participantes (restrito)', icone: Users, papeis: ['admin', 'atividades'] },
  ] },
  { grupo: 'Prestação de contas', itens: [
    { para: '/admin/relatorios', rotulo: 'Relatórios', icone: FileBarChart },
    { para: '/admin/prazos', rotulo: 'Prazos e obrigações', icone: CalendarClock },
  ] },
  { grupo: 'Administração', itens: [
    { para: '/admin/cadastros', rotulo: 'Cadastros do projeto', icone: Settings },
    { para: '/admin/site', rotulo: 'Site e doações', icone: Globe, papeis: ['admin'] },
    { para: '/admin/usuarios', rotulo: 'Usuários', icone: ShieldCheck, papeis: ['admin'] },
    { para: '/admin/auditoria', rotulo: 'Auditoria', icone: History, papeis: ['admin', 'conferente'] },
    { para: '/admin/backup', rotulo: 'Backup', icone: DatabaseBackup, papeis: ['admin'] },
  ] },
];

function SeletorPeriodo() {
  const { filtro, setFiltro } = useFiltro();
  const [periodos, setPeriodos] = useState<{ id: string; nome: string; data_inicio: string; data_fim: string }[]>([]);
  const [fontes, setFontes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from('periodos').select('id, nome, data_inicio, data_fim').order('data_inicio', { ascending: false }).then(({ data }) => setPeriodos(data || []));
    supabase.from('fontes_recurso').select('id, nome').order('nome').then(({ data }) => setFontes(data || []));
  }, []);
  const hoje = hojeISO();
  const [mi, mf] = inicioFimMes(hoje);
  const anterior = inicioFimMes(new Date(Date.parse(mi + 'T12:00:00Z') - 86400000 * 2).toISOString().slice(0, 10));
  const ano = hoje.slice(0, 4);
  const rapidos: Record<string, [string, string, string]> = {
    'mes': [mi, mf, 'Mês atual'],
    'mes-anterior': [anterior[0], anterior[1], 'Mês anterior'],
    'ano': [`${ano}-01-01`, `${ano}-12-31`, `Ano de ${ano}`],
    'ano-anterior': [`${Number(ano) - 1}-01-01`, `${Number(ano) - 1}-12-31`, `Ano de ${Number(ano) - 1}`],
  };
  const atual = filtro.periodoId ? `p:${filtro.periodoId}` : Object.entries(rapidos).find(([, v]) => v[0] === filtro.inicio && v[1] === filtro.fim)?.[0] ?? 'personalizado';

  function escolher(v: string) {
    if (v.startsWith('p:')) {
      const p = periodos.find((x) => x.id === v.slice(2));
      if (p) setFiltro({ ...filtro, inicio: p.data_inicio, fim: p.data_fim, periodoId: p.id, rotulo: p.nome });
    } else if (rapidos[v]) {
      setFiltro({ ...filtro, inicio: rapidos[v][0], fim: rapidos[v][1], periodoId: null, rotulo: rapidos[v][2] });
    } else setFiltro({ ...filtro, periodoId: null, rotulo: 'Personalizado' });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={atual} onChange={(e) => escolher(e.target.value)} aria-label="Período"
        className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm">
        <optgroup label="Atalhos">
          {Object.entries(rapidos).map(([k, v]) => <option key={k} value={k}>{v[2]}</option>)}
          <option value="personalizado">Intervalo personalizado</option>
        </optgroup>
        {periodos.length > 0 && <optgroup label="Períodos de prestação de contas">
          {periodos.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nome}</option>)}
        </optgroup>}
      </select>
      {atual === 'personalizado' && <>
        <Texto type="date" value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value, periodoId: null, rotulo: 'Personalizado' })} className="w-auto py-1.5" aria-label="Início" />
        <Texto type="date" value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value, periodoId: null, rotulo: 'Personalizado' })} className="w-auto py-1.5" aria-label="Fim" />
      </>}
      <Selecao opcoes={fontes.map((f) => ({ valor: f.id, rotulo: f.nome }))} vazio="Todas as fontes" value={filtro.fonteId ?? ''}
        onChange={(e) => setFiltro({ ...filtro, fonteId: e.target.value || null })} className="w-auto max-w-[220px] py-1.5" aria-label="Fonte de recurso" />
    </div>
  );
}

export default function LayoutAdmin() {
  const { carregando, sessao, perfil, pode, sair, erroPerfil, recarregarPerfil } = useSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setMenuAberto(false), [local.pathname]);

  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  if (!perfil && erroPerfil) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-semibold">Não foi possível carregar seu acesso</p>
        <p className="mt-2 text-sm text-slate-600">{erroPerfil}</p>
        <div className="mt-4 flex justify-center gap-3 text-sm"><button className="underline" onClick={recarregarPerfil}>Tentar novamente</button><button className="underline" onClick={sair}>Sair</button></div>
      </div>
    );
  }
  if (!perfil) return <Carregando texto="Carregando perfil…" />;
  if (!perfil.ativo) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-semibold">Acesso desativado</p>
        <p className="mt-2 text-sm text-slate-600">Seu usuário está inativo. Fale com o administrador do projeto.</p>
        <button className="mt-4 text-sm underline" onClick={sair}>Sair</button>
      </div>
    );
  }

  const menu = (
    <nav className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <img src="/logo-640.jpg" alt="Projeto Pé no Chão" className="h-10 w-auto" />
      </Link>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {MENU.map((g) => {
          const itens = g.itens.filter((i) => !i.papeis || pode(...i.papeis));
          if (!itens.length) return null;
          return (
            <div key={g.grupo}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.grupo}</p>
              {itens.map((i) => (
                <NavLink key={i.para} to={i.para} end={i.para === '/admin'}
                  className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm', isActive ? 'bg-sol-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
                  <i.icone className="h-4 w-4 shrink-0" />{i.rotulo}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
        <p className="font-medium text-slate-700">{perfil.nome || perfil.email}</p>
        <p>{PAPEIS[perfil.papel]}</p>
        <button onClick={sair} className="mt-2 inline-flex items-center gap-1 text-slate-600 hover:text-red-600"><LogOut className="h-3.5 w-3.5" />Sair</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{menu}</aside>
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute right-2 top-3 rounded p-1 text-slate-500" onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            {menu}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <button className="rounded p-1 text-slate-600 lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
            <div className="mr-auto min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Projeto Pé no Chão</p>
              <p className="text-xs text-slate-500">Gestão financeira e prestação de contas</p>
            </div>
            <SeletorPeriodo />
            <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 text-xs sm:flex">
              <Banknote className="h-4 w-4 text-sol-600" />
              <div><p className="font-medium text-slate-700">{perfil.nome || perfil.email}</p><p className="text-slate-500">{PAPEIS[perfil.papel]}</p></div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}

