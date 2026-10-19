import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { ArrowDownRight, ArrowUpRight, Download, Eye, EyeOff, FileSpreadsheet, LogOut, Paperclip, Pencil, Search, Trash2 } from 'lucide-react';
import { useConfigSite } from '../site/Site';
import { data as fmtData, dinheiro, mesAno } from '../lib/formato';
import { exportarCSV, exportarXLSX, type ColunaExport } from '../lib/exportar';
import { Aviso, Rotulo, Texto, useAviso, useConfirmacao } from '../components/ui';
import { apagarAnexos } from './armazenamento';
import { buscar, ordenarRecentes, resumo } from './calculos';
import { temBackend, obterCliente, type ConfigPrestacao } from './config';
import { FormLancamento, rascunhoDe, rascunhoVazio } from './FormLancamento';
import { CartoesResumo, Miniatura, useLightbox, type ItemVisual } from './componentes';
import { urlParaEquipe } from './armazenamento';
import type { Lancamento, TipoLancamento } from './tipos';

const POR_PAGINA = 20;

function Moldura({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>;
}

// ------------------------------------------------------------------ login
function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setCarregando(true); setErro(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) setErro(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
  }
  async function recuperar() {
    if (!email.trim()) return setErro('Digite seu e-mail acima para receber o link de nova senha.');
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/prestacao-de-contas/gerenciar` });
    if (error) setErro(error.message); else { setErro(null); setInfo('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.'); }
  }
  return (
    <Moldura>
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-100">
        <h1 className="font-titulo text-3xl font-extrabold text-slate-900">Área da equipe</h1>
        <p className="mt-1 text-slate-600">Entre para registrar entradas, gastos e comprovantes.</p>
        <form onSubmit={entrar} className="mt-6 space-y-4">
          <Rotulo texto="E-mail"><Texto type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-teste="login-email" /></Rotulo>
          <Rotulo texto="Senha"><Texto type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} data-teste="login-senha" /></Rotulo>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {info && <Aviso tom="ok">{info}</Aviso>}
          <button type="submit" disabled={carregando} data-teste="login-entrar" className="w-full rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50">{carregando ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" onClick={recuperar} className="w-full text-center text-sm text-slate-500 hover:text-slate-800">Esqueci minha senha</button>
        </form>
      </div>
    </Moldura>
  );
}

function NovaSenha({ sb, onFeito }: { sb: SupabaseClient; onFeito: () => void }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 10) return setErro('Use pelo menos 10 caracteres.');
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) setErro(error.message); else onFeito();
  }
  return (
    <Moldura>
      <form onSubmit={salvar} className="mx-auto max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-100">
        <h1 className="font-titulo text-3xl font-extrabold">Criar nova senha</h1>
        <Rotulo texto="Nova senha" ajuda="Mínimo de 10 caracteres."><Texto type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Rotulo>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <button type="submit" className="w-full rounded-full bg-slate-900 py-3 font-bold text-white">Salvar senha</button>
      </form>
    </Moldura>
  );
}

// ------------------------------------------------------------------ painel da equipe
function Painel({ sb, config, email }: { sb: SupabaseClient; config: ConfigPrestacao; email: string }) {
  const avisar = useAviso();
  const { confirmar, elemento: confirmacao } = useConfirmacao();
  const lightbox = useLightbox();
  const [lancs, setLancs] = useState<Lancamento[] | null>(null);
  const [form, setForm] = useState<ReturnType<typeof rascunhoVazio> | null>(null);
  const [tipo, setTipo] = useState<'todos' | TipoLancamento>('todos');
  const [mes, setMes] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'sem-foto' | 'escondidos'>('todos');
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const carregar = useCallback(async () => {
    const res: Lancamento[] = [];
    for (let de = 0; de < 50000; de += 1000) {
      const { data, error } = await sb.from('pc_lancamentos').select('*').order('data', { ascending: false }).order('id').range(de, de + 999);
      if (error) { avisar('erro', `Não foi possível carregar: ${error.message}`); return; }
      res.push(...((data as Lancamento[]) ?? []));
      if (!data || data.length < 1000) break;
    }
    setLancs(res);
  }, [sb, avisar]);
  useEffect(() => { carregar(); }, [carregar]);

  const todos = lancs ?? [];
  const r = useMemo(() => resumo(todos), [todos]);
  const escondidos = todos.filter((l) => l.publicar === false).length;
  const meses = useMemo(() => [...new Set(todos.map((l) => l.data.slice(0, 7)))].sort().reverse(), [todos]);
  const lista = useMemo(() => {
    let l = todos;
    if (tipo !== 'todos') l = l.filter((x) => x.tipo === tipo);
    if (mes) l = l.filter((x) => x.data.startsWith(mes));
    if (filtro === 'sem-foto') l = l.filter((x) => !x.anexos.length);
    if (filtro === 'escondidos') l = l.filter((x) => x.publicar === false);
    return ordenarRecentes(buscar(l, busca));
  }, [todos, tipo, mes, busca, filtro]);

  async function excluir(l: Lancamento) {
    const ok = await confirmar({ titulo: 'Excluir este registro?', texto: <>“{l.descricao}” — {dinheiro(l.valor)}. Ele some da lista e do site. O histórico guarda uma cópia dos dados (e a foto será apagada). Se só quiser esconder do site, use “Esconder”.</>, perigo: true, rotuloOk: 'Excluir' });
    if (!ok) return;
    const { error } = await sb.from('pc_lancamentos').delete().eq('id', l.id);
    if (error) return avisar('erro', `Não foi possível excluir: ${error.message}`);
    await apagarAnexos(sb, l.anexos);
    avisar('ok', 'Registro excluído.'); carregar();
  }

  async function alternarSite(l: Lancamento) {
    const { error } = await sb.from('pc_lancamentos').update({ publicar: l.publicar === false }).eq('id', l.id);
    if (error) return avisar('erro', error.message);
    avisar('ok', l.publicar === false ? 'Agora aparece no site.' : 'Escondido do site.'); carregar();
  }

  async function verFotos(l: Lancamento, indice: number) {
    try {
      const itens: ItemVisual[] = await Promise.all(l.anexos.map(async (a) => ({ url: await urlParaEquipe(sb, config, a), nome: a.nome ?? 'Comprovante', pdf: a.tipo === 'application/pdf' || a.path.endsWith('.pdf') })));
      lightbox.abrir(itens, indice);
    } catch { avisar('erro', 'Não foi possível abrir o comprovante.'); }
  }

  const colunasExport: ColunaExport<Lancamento>[] = [
    { chave: 'data', titulo: 'Data', tipo: 'data' },
    { chave: 'tipo', titulo: 'Tipo', valor: (l) => (l.tipo === 'entrada' ? 'Entrada' : 'Gasto') },
    { chave: 'categoria', titulo: 'Categoria' }, { chave: 'descricao', titulo: 'Descrição' },
    { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' },
    { chave: 'contraparte', titulo: 'Quem' },
    { chave: 'anexos', titulo: 'Comprovantes', valor: (l) => l.anexos.length },
    { chave: 'publicar', titulo: 'No site', valor: (l) => (l.publicar === false ? 'Não' : 'Sim') },
  ];

  const Pilula = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={() => { onClick(); setMostrar(POR_PAGINA); }} aria-pressed={ativo} className={`rounded-full px-4 py-2 text-sm font-semibold ${ativo ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 hover:bg-sol-50'}`}>{children}</button>
  );

  return (
    <Moldura>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-titulo text-3xl font-extrabold text-slate-900 sm:text-4xl">Prestação de contas — equipe</h1>
          <p className="text-slate-600">Registre o dinheiro que entra e sai, com os comprovantes. Tudo que estiver marcado “aparece no site” é publicado na hora.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link to="/prestacao-de-contas" className="rounded-full px-4 py-2 font-semibold ring-1 ring-slate-300 hover:bg-white">Ver página pública</Link>
          <button onClick={() => sb.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-slate-600 hover:bg-white"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">Conectado como {email}</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <button data-teste="novo-entrada" onClick={() => setForm(rascunhoVazio('entrada'))} className="flex items-center justify-center gap-3 rounded-3xl bg-blue-600 px-6 py-6 text-xl font-bold text-white shadow-lg shadow-blue-200 transition hover:brightness-110"><ArrowUpRight className="h-7 w-7" />Entrou dinheiro</button>
        <button data-teste="novo-saida" onClick={() => setForm(rascunhoVazio('saida'))} className="flex items-center justify-center gap-3 rounded-3xl bg-orange-600 px-6 py-6 text-xl font-bold text-white shadow-lg shadow-orange-200 transition hover:brightness-110"><ArrowDownRight className="h-7 w-7" />Saiu dinheiro</button>
      </div>

      {lancs === null ? <p className="py-10 text-center text-slate-500">Carregando…</p> : (
        <>
          <CartoesResumo r={r} rotuloPeriodo="todo o período registrado" />
          {(escondidos > 0 || r.semComprovante > 0) && (
            <p className="mt-3 text-sm text-slate-600">
              {r.semComprovante > 0 && <button className="mr-4 underline" onClick={() => setFiltro('sem-foto')}>{r.semComprovante} sem comprovante</button>}
              {escondidos > 0 && <button className="underline" onClick={() => setFiltro('escondidos')}>{escondidos} escondido(s) do site</button>}
            </p>
          )}

          <details className="mt-6 rounded-2xl bg-sol-50 p-4 text-sm text-slate-700 ring-1 ring-sol-200" open={!todos.length}>
            <summary className="cursor-pointer font-semibold">Como usar (3 passos)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Toque em <strong>Entrou dinheiro</strong> ou <strong>Saiu dinheiro</strong>.</li>
              <li>Preencha valor, data e “o que foi?”, escolha o tipo e <strong>tire uma foto do comprovante</strong>.</li>
              <li>Antes de mostrar a foto no site, use <strong>Cobrir dados</strong> para esconder CPF, conta bancária, telefone e nomes. Salve — pronto!</li>
            </ol>
          </details>

          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Pilula ativo={tipo === 'todos'} onClick={() => setTipo('todos')}>Tudo</Pilula>
              <Pilula ativo={tipo === 'entrada'} onClick={() => setTipo('entrada')}>Entradas</Pilula>
              <Pilula ativo={tipo === 'saida'} onClick={() => setTipo('saida')}>Gastos</Pilula>
              <select value={mes} onChange={(e) => { setMes(e.target.value); setMostrar(POR_PAGINA); }} aria-label="Mês" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
                <option value="">Todos os meses</option>{meses.map((m) => <option key={m} value={m}>{mesAno(m + '-01')}</option>)}
              </select>
              <select value={filtro} onChange={(e) => { setFiltro(e.target.value as typeof filtro); setMostrar(POR_PAGINA); }} aria-label="Filtro" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
                <option value="todos">Todos os registros</option><option value="sem-foto">Sem comprovante</option><option value="escondidos">Escondidos do site</option>
              </select>
              <div className="ml-auto flex gap-2">
                <button onClick={() => exportarCSV(lista, colunasExport, 'prestacao-de-contas')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white"><Download className="h-4 w-4" />CSV</button>
                <button onClick={() => exportarXLSX(lista, colunasExport, 'prestacao-de-contas', 'Prestação de contas')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white"><FileSpreadsheet className="h-4 w-4" />Excel</button>
              </div>
            </div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(POR_PAGINA); }} placeholder="Buscar nos registros…" aria-label="Buscar" className="w-full rounded-full border-2 border-slate-200 bg-white py-3 pl-12 pr-4 focus:border-sol-400 focus:outline-none" />
            </div>

            {!lista.length ? <p className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">{todos.length ? 'Nenhum registro com estes filtros.' : 'Nenhum registro ainda. Comece pelos botões acima!'}</p> : (
              <ul className="space-y-3" data-teste="lista-equipe">
                {lista.slice(0, mostrar).map((l) => (
                  <li key={l.id} className={`flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 ${l.publicar === false ? 'opacity-70' : ''}`} data-teste="registro">
                    <span className="w-1.5 shrink-0 rounded-full" style={{ background: l.tipo === 'entrada' ? '#2a78d6' : '#eb6834' }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>{fmtData(l.data)}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{l.categoria}</span>
                        {l.publicar === false ? <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><EyeOff className="h-3 w-3" />escondido do site</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><Eye className="h-3 w-3" />no site</span>}
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">{l.descricao}</p>
                      {l.contraparte && <p className="text-sm text-slate-500">{l.tipo === 'entrada' ? 'De' : 'Para'}: {l.contraparte}{l.mostrar_contraparte ? '' : ' (nome escondido no site)'}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {l.anexos.length ? l.anexos.map((a, i) => <Anexo key={a.path} sb={sb} config={config} anexo={a} onClick={() => verFotos(l, i)} />) : <span className="flex items-center gap-1 text-xs text-amber-700"><Paperclip className="h-3 w-3" />sem comprovante</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <button onClick={() => setForm(rascunhoDe(l))} data-teste="editar" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-slate-300 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Editar</button>
                        <button onClick={() => alternarSite(l)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-slate-300 hover:bg-slate-50">{l.publicar === false ? <><Eye className="h-3.5 w-3.5" />Mostrar no site</> : <><EyeOff className="h-3.5 w-3.5" />Esconder</>}</button>
                        <button onClick={() => excluir(l)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-red-700 ring-1 ring-red-200 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Excluir</button>
                      </div>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-right font-titulo text-lg font-bold tabular-nums" style={{ color: l.tipo === 'entrada' ? '#1d4ed8' : '#c2410c' }}>{l.tipo === 'entrada' ? '+' : '−'} {dinheiro(l.valor)}</p>
                  </li>
                ))}
              </ul>
            )}
            {lista.length > mostrar && <div className="mt-5 text-center"><button onClick={() => setMostrar(mostrar + POR_PAGINA)} className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white">Mostrar mais ({lista.length - mostrar})</button></div>}
          </section>
        </>
      )}

      {form && <FormLancamento sb={sb} config={config} inicial={form} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); carregar(); }} />}
      {lightbox.elemento}
      {confirmacao}
    </Moldura>
  );
}

function Anexo({ sb, config, anexo, onClick }: { sb: SupabaseClient; config: ConfigPrestacao; anexo: Lancamento['anexos'][number]; onClick: () => void }) {
  const [url, setUrl] = useState('');
  const pdf = anexo.tipo === 'application/pdf' || anexo.path.endsWith('.pdf');
  useEffect(() => { let v = true; if (!pdf) urlParaEquipe(sb, config, anexo).then((u) => v && setUrl(u)).catch(() => {}); return () => { v = false; }; }, [sb, config, anexo, pdf]);
  return (
    <div className="relative">
      <Miniatura item={{ url, nome: anexo.nome ?? 'Comprovante', pdf }} onClick={onClick} />
      <span className={`absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${anexo.publico ? 'bg-emerald-600' : 'bg-slate-500'}`}>{anexo.publico ? 'site' : 'privada'}</span>
    </div>
  );
}

// ------------------------------------------------------------------ porta de entrada
export default function Gerenciar() {
  const config = useConfigSite();
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const sb = useMemo(() => (config && temBackend(config) ? obterCliente(config) : null), [config]);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = sb.auth.onAuthStateChange((evento, s) => { setSessao(s); if (evento === 'PASSWORD_RECOVERY') setRecuperando(true); });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    setAdmin(null);
    if (!sb || !sessao) return;
    let vivo = true;
    sb.rpc('pc_eh_admin').then(({ data, error }) => vivo && setAdmin(!error && data === true));
    return () => { vivo = false; };
  }, [sb, sessao?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) return <Moldura><p className="py-16 text-center text-slate-500">Carregando…</p></Moldura>;
  if (!sb) return <Moldura><div className="mx-auto max-w-lg rounded-3xl bg-sol-50 p-8 text-center ring-1 ring-sol-200"><p className="font-titulo text-2xl font-bold">Área da equipe ainda não configurada</p><p className="mt-2 text-slate-600">Falta ligar o banco de dados do projeto. Veja o passo a passo em docs/PRESTACAO.md.</p></div></Moldura>;
  if (sessao === undefined) return <Moldura><p className="py-16 text-center text-slate-500">Carregando…</p></Moldura>;
  if (recuperando) return <NovaSenha sb={sb} onFeito={() => setRecuperando(false)} />;
  if (!sessao) return <Login sb={sb} />;
  if (admin === null) return <Moldura><p className="py-16 text-center text-slate-500">Verificando acesso…</p></Moldura>;
  if (!admin) {
    return (
      <Moldura><div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow ring-1 ring-slate-100">
        <p className="font-titulo text-2xl font-bold">Sem permissão</p>
        <p className="mt-2 text-slate-600">O usuário <strong>{sessao.user.email}</strong> ainda não foi autorizado a lançar a prestação de contas. Peça a quem administra o projeto.</p>
        <button onClick={() => sb.auth.signOut()} className="mt-5 rounded-full bg-slate-900 px-6 py-2.5 font-bold text-white">Sair</button>
      </div></Moldura>
    );
  }
  return <Painel sb={sb} config={config} email={sessao.user.email ?? ''} />;
}
