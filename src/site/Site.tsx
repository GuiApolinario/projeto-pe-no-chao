import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { Check, Copy, Heart, HandHeart, Instagram, Lock, Mail, MapPin, Menu, MessageCircle, Package, Sun, Users, X } from 'lucide-react';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { gerarPixCopiaECola } from '../lib/pix';
import { data as fmtData, dinheiro, lerDinheiro, mesAno, num } from '../lib/formato';
import { cx } from '../components/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ConfigSite {
  pix_chave?: string | null; pix_tipo?: string | null; pix_nome?: string | null; pix_cidade?: string | null; banco_texto?: string | null;
  whatsapp?: string | null; instagram?: string | null; email?: string | null; endereco?: string | null; texto_sobre?: string | null;
  mostrar_transparencia?: boolean; campanha_titulo?: string | null; campanha_meta?: string | null; campanha_arrecadado?: string | null;
}

let cacheConfig: Promise<ConfigSite> | null = null;
export function useConfigSite() {
  const [c, setC] = useState<ConfigSite | null>(null);
  useEffect(() => {
    if (!supabaseConfigurado) { setC({}); return; }
    cacheConfig ??= Promise.resolve(supabase.from('configuracoes').select('valor').eq('chave', 'site').maybeSingle()).then(({ data }) => (data?.valor as ConfigSite) ?? {});
    cacheConfig.then(setC);
  }, []);
  return c;
}

const CORES_PES = ['#E83E8C', '#F7D23E', '#F28C28', '#2457C5', '#E53935', '#7CB342', '#8D5B3E', '#F4B183'];

/** Pegada estilizada, nas cores do logotipo. */
export function Pe({ cor, className, espelhar }: { cor: string; className?: string; espelhar?: boolean }) {
  return (
    <svg viewBox="0 0 40 64" className={className} style={espelhar ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <path d="M14 22c-6 6-8 20-4 30 3 8 13 10 17 3 4-6 1-12 3-19 2-7 0-15-6-16-4-1-7 0-10 2z" fill={cor} stroke="#111" strokeWidth="2.2" />
      {[[8, 16, 4.2], [14, 9, 3.4], [21, 6, 3], [28, 7, 2.6], [33, 11, 2.2]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={cor} stroke="#111" strokeWidth="1.8" />)}
    </svg>
  );
}

function FaixaPes() {
  return (
    <div className="flex items-end justify-center gap-3 py-2" aria-hidden="true">
      {CORES_PES.map((c, i) => <Pe key={c} cor={c} espelhar={i % 2 === 1} className={cx('h-8 w-5', i % 2 ? 'translate-y-1' : '-translate-y-1')} />)}
    </div>
  );
}

function Titulo({ sobre, children, centro }: { sobre?: string; children: ReactNode; centro?: boolean }) {
  return (
    <div className={cx('mb-8', centro && 'text-center')}>
      {sobre && <p className="mb-1 text-sm font-bold uppercase tracking-widest text-sol-600">{sobre}</p>}
      <h2 className="font-titulo text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{children}</h2>
    </div>
  );
}

const linkWhats = (n?: string | null, txt = 'Olá! Quero ajudar o Projeto Pé no Chão.') => n ? `https://wa.me/55${n.replace(/\D/g, '').replace(/^55/, '')}?text=${encodeURIComponent(txt)}` : null;

// ------------------------------------------------------------------ layout
export function LayoutSite() {
  const [aberto, setAberto] = useState(false);
  const c = useConfigSite();
  const local = useLocation();
  useEffect(() => { setAberto(false); window.scrollTo(0, 0); }, [local.pathname]);
  const links = [['/', 'Início'], ['/doe', 'Como ajudar'], ...(c?.mostrar_transparencia ? [['/transparencia', 'Transparência']] : []), ['/contato', 'Contato']];
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-800">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>
      <header className="sticky top-0 z-40 border-b border-sol-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link to="/" aria-label="Projeto Pé no Chão — início"><img src="/logo-640.jpg" alt="Projeto Pé no Chão" className="h-12 w-auto sm:h-14" /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {links.map(([to, r]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => cx('rounded-full px-4 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-sol-100 text-slate-900' : 'text-slate-600 hover:bg-sol-50 hover:text-slate-900')}>{r}</NavLink>
            ))}
            <Link to="/doe" className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-marca-rosa px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-110"><Heart className="h-4 w-4 fill-white" />Doe agora</Link>
          </nav>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setAberto(!aberto)} aria-label="Menu" aria-expanded={aberto}>{aberto ? <X /> : <Menu />}</button>
        </div>
        {aberto && (
          <nav className="border-t border-sol-100 px-4 py-3 md:hidden" aria-label="Principal (celular)">
            {links.map(([to, r]) => <NavLink key={to} to={to} end className="block rounded-lg px-3 py-2.5 font-semibold text-slate-700 hover:bg-sol-50">{r}</NavLink>)}
            <Link to="/doe" className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-marca-rosa px-5 py-3 font-bold text-white"><Heart className="h-4 w-4 fill-white" />Doe agora</Link>
          </nav>
        )}
      </header>
      <main id="conteudo" className="flex-1"><Outlet /></main>
      <footer className="bg-slate-900 text-slate-300">
        <FaixaPes />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-titulo text-2xl font-extrabold text-white">Projeto Pé no Chão</p>
            <p className="mt-2 text-sm">Ações com crianças e com a comunidade em Votorantim/SP.</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Fale com a gente</p>
            {c?.whatsapp && <a className="flex items-center gap-2 hover:text-white" href={linkWhats(c.whatsapp)!} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            {c?.instagram && <a className="flex items-center gap-2 hover:text-white" href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4" />@{c.instagram.replace('@', '')}</a>}
            {c?.email && <a className="flex items-center gap-2 hover:text-white" href={`mailto:${c.email}`}><Mail className="h-4 w-4" />{c.email}</a>}
            {c?.endereco && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{c.endereco}</p>}
            <Link to="/contato" className="block hover:text-white">Formulário de contato</Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Transparência</p>
            {c?.mostrar_transparencia && <Link to="/transparencia" className="block hover:text-white">Prestação de contas</Link>}
            <Link to="/privacidade" className="block hover:text-white">Privacidade e proteção de dados</Link>
            <Link to="/entrar" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"><Lock className="h-3.5 w-3.5" />Área da equipe</Link>
          </div>
        </div>
        <p className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Projeto Pé no Chão · Votorantim/SP</p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ início
export function Inicio() {
  const c = useConfigSite();
  const [tr, setTr] = useState<any>(null);
  const [nec, setNec] = useState<any[]>([]);
  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.rpc('transparencia_publica').then(({ data }) => setTr(data));
    supabase.from('necessidades').select('*').eq('ativo', true).order('ordem').limit(6).then(({ data }) => setNec(data || []));
  }, []);
  const atividades = tr?.atividades_recentes ?? [];
  const meta = Number(c?.campanha_meta || 0), arrec = Number(c?.campanha_arrecadado || 0);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-sol-50 via-white to-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-sol-400/90" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full border-[18px] border-dashed border-sol-300/60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-sol-700 shadow-sm ring-1 ring-sol-200"><Sun className="h-4 w-4" />Votorantim · São Paulo</p>
            <h1 className="font-titulo text-4xl font-extrabold leading-[1.05] text-slate-900 sm:text-6xl">Infância com <span className="text-marca-rosa">pé no chão</span>, <span className="text-marca-azul">sol</span> e <span className="text-marca-verde">alegria</span>.</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">O Projeto Pé no Chão realiza ações com crianças e com a comunidade nos bairros Jardim Dandara e Jardim Cerrado. Cada doação vira brincadeira, aprendizado e cuidado — com prestação de contas aberta.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/doe" className="inline-flex items-center gap-2 rounded-full bg-marca-rosa px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-200 hover:brightness-110"><Heart className="h-5 w-5 fill-white" />Quero doar</Link>
              <Link to="/doe#voluntario" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-slate-800 ring-2 ring-slate-900 hover:bg-slate-50"><HandHeart className="h-5 w-5" />Ser voluntário</Link>
            </div>
          </div>
          <div className="relative">
            <img src="/logo.jpg" alt="Logotipo do Projeto Pé no Chão: sol com pezinhos coloridos e guarda-chuva de frevo" className="relative w-full rounded-[2rem] bg-white p-4 shadow-xl ring-1 ring-sol-100" />
          </div>
        </div>
      </section>

      <FaixaPes />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Titulo sobre="Quem somos">Um projeto da comunidade, para a comunidade</Titulo>
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4 text-lg leading-relaxed text-slate-600">
            {c?.texto_sobre ? c.texto_sobre.split(/\n+/).map((p, i) => <p key={i}>{p}</p>) : (
              <>
                <p>O Projeto Pé no Chão é uma iniciativa social de Votorantim/SP que desenvolve ações voltadas ao atendimento de crianças e ao fortalecimento da comunidade.</p>
                <p>Nossa atuação acontece nos bairros Jardim Dandara e Jardim Cerrado, com atividades que unem convivência, esporte, cultura, alimentação e cuidado.</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[[Users, 'Crianças no centro', 'bg-pink-50 text-marca-rosa'], [Sun, 'Convivência e brincadeira', 'bg-sol-50 text-sol-700'], [Package, 'Doações bem cuidadas', 'bg-blue-50 text-marca-azul'], [Check, 'Contas abertas', 'bg-green-50 text-marca-verde']].map(([Ic, t, cl]: any) => (
              <div key={t} className={cx('flex flex-col gap-2 rounded-2xl p-5', cl)}><Ic className="h-7 w-7" /><p className="font-titulo text-lg font-bold leading-tight text-slate-800">{t}</p></div>
            ))}
          </div>
        </div>
      </section>

      {c?.campanha_titulo && meta > 0 && (
        <section className="bg-sol-400">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-800">Campanha</p>
            <h2 className="font-titulo text-3xl font-extrabold text-slate-900">{c.campanha_titulo}</h2>
            <div className="mx-auto mt-5 h-5 max-w-xl overflow-hidden rounded-full bg-white/70 ring-2 ring-slate-900" role="progressbar" aria-valuenow={Math.round((arrec / meta) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-marca-rosa" style={{ width: `${Math.min(100, (arrec / meta) * 100)}%` }} />
            </div>
            <p className="mt-2 font-semibold text-slate-900">{dinheiro(arrec)} de {dinheiro(meta)}</p>
            <Link to="/doe" className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800"><Heart className="h-5 w-5" />Contribuir</Link>
          </div>
        </section>
      )}

      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Titulo sobre="Como ajudar" centro>Toda ajuda faz diferença</Titulo>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ['Doe pelo PIX', 'Rápido e seguro. Toda entrada é registrada no nosso sistema de prestação de contas.', '/doe', '#E83E8C'],
              ['Doe alimentos e materiais', 'Veja a lista do que mais precisamos agora e combine a entrega.', '/doe#bens', '#2457C5'],
              ['Seja voluntário', 'Tem um tempinho e um talento? Venha somar com a gente nas atividades.', '/doe#voluntario', '#7CB342'],
            ].map(([t, d, l, cor]) => (
              <Link key={t} to={l} className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-md">
                <Pe cor={cor} className="mb-4 h-12 w-8" />
                <h3 className="font-titulo text-2xl font-bold text-slate-900">{t}</h3>
                <p className="mt-2 text-slate-600">{d}</p>
                <span className="mt-4 inline-block font-semibold text-slate-900 group-hover:underline">Saiba mais →</span>
              </Link>
            ))}
          </div>
          {nec.length > 0 && (
            <div className="mt-10 rounded-3xl bg-white p-6 ring-1 ring-slate-100">
              <p className="mb-3 font-titulo text-xl font-bold">Precisamos agora</p>
              <ul className="flex flex-wrap gap-2">{nec.map((n) => <li key={n.id} className={cx('rounded-full px-4 py-1.5 text-sm font-semibold', n.prioridade === 'alta' ? 'bg-pink-100 text-pink-800' : 'bg-sol-100 text-slate-800')}>{n.titulo}</li>)}</ul>
            </div>
          )}
        </div>
      </section>

      {atividades.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Titulo sobre="Acontece no projeto">Atividades recentes</Titulo>
          <div className="grid gap-5 md:grid-cols-3">
            {atividades.slice(0, 6).map((a: any, i: number) => (
              <article key={i} className="rounded-3xl border-t-8 bg-white p-6 shadow-sm ring-1 ring-slate-100" style={{ borderTopColor: CORES_PES[i % CORES_PES.length] }}>
                <p className="text-sm text-slate-500">{fmtData(a.data)}{a.bairro ? ` · ${a.bairro}` : ''}</p>
                <h3 className="mt-1 font-titulo text-xl font-bold text-slate-900">{a.titulo}</h3>
                {a.descricao && <p className="mt-2 line-clamp-4 text-slate-600">{a.descricao}</p>}
                {a.participantes_qtd > 0 && <p className="mt-3 text-sm font-semibold text-sol-700">{num(a.participantes_qtd)} participações</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bg-marca-azul">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center text-white md:flex-row md:text-left">
          <div className="flex-1">
            <h2 className="font-titulo text-3xl font-extrabold">Transparência é parte do nosso jeito de fazer</h2>
            <p className="mt-2 text-blue-100">Cada real recebido e cada compra realizada são registrados com comprovante e conferidos antes de entrar na prestação de contas.</p>
          </div>
          {c?.mostrar_transparencia ? <Link to="/transparencia" className="rounded-full bg-white px-7 py-3 font-bold text-marca-azul hover:bg-blue-50">Ver prestação de contas</Link>
            : <Link to="/contato" className="rounded-full bg-white px-7 py-3 font-bold text-marca-azul hover:bg-blue-50">Fale com a gente</Link>}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ doe
function FormContato({ tipoInicial, titulo, campoMensagem = 'Mensagem' }: { tipoInicial: string; titulo?: string; campoMensagem?: string }) {
  const [v, setV] = useState({ tipo: tipoInicial, nome: '', email: '', telefone: '', mensagem: '', consentimento: false, site: '' });
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'ok' | 'erro'>('livre');
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (v.site) return; // campo-armadilha contra robôs
    setEstado('enviando');
    const { error } = await supabase.from('contatos').insert({ tipo: v.tipo, nome: v.nome.trim(), email: v.email.trim() || null, telefone: v.telefone.trim() || null, mensagem: v.mensagem.trim() || null, consentimento: v.consentimento });
    setEstado(error ? 'erro' : 'ok');
  }
  if (estado === 'ok') return <div className="rounded-2xl bg-green-50 p-6 text-center text-green-800"><Check className="mx-auto mb-2 h-8 w-8" /><p className="font-semibold">Mensagem enviada! Obrigado — em breve entraremos em contato.</p></div>;
  const campo = 'w-full rounded-xl border-2 border-slate-200 px-4 py-3 focus:border-sol-400 focus:outline-none';
  return (
    <form onSubmit={enviar} className="space-y-3">
      {titulo && <p className="font-titulo text-xl font-bold">{titulo}</p>}
      <input className="hidden" tabIndex={-1} autoComplete="off" value={v.site} onChange={(e) => setV({ ...v, site: e.target.value })} aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="sr-only">Assunto</span>
          <select className={campo} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            <option value="contato">Contato geral</option><option value="voluntario">Quero ser voluntário(a)</option>
            <option value="doacao_bens">Quero doar alimentos/materiais</option><option value="empresa">Empresa / parceria</option>
          </select></label>
        <label className="sm:col-span-2"><span className="sr-only">Nome</span><input required minLength={2} maxLength={120} placeholder="Seu nome *" className={campo} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></label>
        <label><span className="sr-only">E-mail</span><input type="email" maxLength={160} placeholder="E-mail" className={campo} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label><span className="sr-only">Telefone/WhatsApp</span><input maxLength={30} placeholder="Telefone / WhatsApp" className={campo} value={v.telefone} onChange={(e) => setV({ ...v, telefone: e.target.value })} /></label>
      </div>
      <label className="block"><span className="sr-only">{campoMensagem}</span><textarea maxLength={2000} rows={4} placeholder={campoMensagem} className={campo} value={v.mensagem} onChange={(e) => setV({ ...v, mensagem: e.target.value })} /></label>
      <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" required checked={v.consentimento} onChange={(e) => setV({ ...v, consentimento: e.target.checked })} className="mt-1" />
        <span>Autorizo o Projeto Pé no Chão a usar estes dados apenas para responder a este contato, conforme a <Link to="/privacidade" className="underline">política de privacidade</Link>.</span></label>
      {estado === 'erro' && <p className="text-sm text-red-600">Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp.</p>}
      {(!v.email.trim() && !v.telefone.trim()) && v.nome && <p className="text-xs text-slate-500">Informe e-mail ou telefone para podermos responder.</p>}
      <button disabled={estado === 'enviando' || (!v.email.trim() && !v.telefone.trim())} className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50">{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
    </form>
  );
}

function CaixaPix({ c }: { c: ConfigSite }) {
  const [valor, setValor] = useState<number | null>(null);
  const [outro, setOutro] = useState('');
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const payload = useMemo(() => (c.pix_chave && c.pix_nome ? gerarPixCopiaECola({ chave: c.pix_chave, nome: c.pix_nome, cidade: c.pix_cidade || 'VOTORANTIM', valor, descricao: 'Doacao Pe no Chao' }) : ''), [c, valor]);
  useEffect(() => { if (payload) QRCode.toDataURL(payload, { margin: 1, width: 280, color: { dark: '#111111', light: '#ffffff' } }).then(setQr); }, [payload]);
  if (!payload) return <div className="rounded-3xl bg-sol-50 p-8 text-center text-slate-600 ring-1 ring-sol-200">A chave PIX oficial do projeto será publicada aqui em breve. Enquanto isso, <Link to="/contato" className="font-semibold underline">fale com a gente</Link>.</div>;
  async function copiar(t: string) { try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem permissão */ } }
  return (
    <div className="grid items-center gap-8 rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100 md:grid-cols-[auto_1fr] md:p-10">
      <div className="text-center">
        {qr && <img src={qr} alt={`QR Code PIX${valor ? ` de ${dinheiro(valor)}` : ''}`} className="mx-auto h-64 w-64 rounded-2xl ring-4 ring-sol-300" />}
        <p className="mt-2 text-sm text-slate-500">Aponte a câmera do app do seu banco</p>
      </div>
      <div className="space-y-5">
        <div>
          <p className="mb-2 font-semibold text-slate-700">Escolha um valor (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {[10, 25, 50, 100, 200].map((v) => <button key={v} onClick={() => { setValor(v); setOutro(''); }} className={cx('rounded-full px-5 py-2 font-bold ring-2 transition', valor === v ? 'bg-marca-rosa text-white ring-marca-rosa' : 'bg-white text-slate-800 ring-slate-200 hover:ring-marca-rosa')}>R$ {v}</button>)}
            <input inputMode="decimal" placeholder="Outro valor" value={outro} onChange={(e) => { setOutro(e.target.value); const v = lerDinheiro(e.target.value); setValor(v && Number(v) > 0 ? Number(v) : null); }} className="w-32 rounded-full px-4 py-2 ring-2 ring-slate-200 focus:outline-none focus:ring-marca-rosa" aria-label="Outro valor" />
            {valor && <button onClick={() => { setValor(null); setOutro(''); }} className="text-sm text-slate-500 underline">qualquer valor</button>}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Chave PIX{c.pix_tipo ? ` (${c.pix_tipo})` : ''}</p>
          <div className="flex items-center justify-between gap-2"><p className="break-all font-mono text-lg font-semibold">{c.pix_chave}</p><button onClick={() => copiar(c.pix_chave!)} className="shrink-0 rounded-lg p-2 hover:bg-slate-200" aria-label="Copiar chave"><Copy className="h-5 w-5" /></button></div>
          <p className="mt-1 text-sm text-slate-600">Favorecido: <strong>{c.pix_nome}</strong></p>
        </div>
        <button onClick={() => copiar(payload)} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 font-bold text-white hover:bg-slate-800">
          {copiado ? <><Check className="h-5 w-5" />Copiado!</> : <><Copy className="h-5 w-5" />Copiar PIX Copia e Cola{valor ? ` (${dinheiro(valor)})` : ''}</>}
        </button>
        <p className="text-xs text-slate-500">Confira sempre o nome do favorecido antes de confirmar. O projeto nunca pede doações por mensagens de números desconhecidos.</p>
        {c.banco_texto && <p className="whitespace-pre-line text-sm text-slate-600"><strong>Transferência/depósito:</strong><br />{c.banco_texto}</p>}
      </div>
    </div>
  );
}

export function Doe() {
  const c = useConfigSite();
  const [nec, setNec] = useState<any[]>([]);
  const local = useLocation();
  useEffect(() => { if (supabaseConfigurado) supabase.from('necessidades').select('*').eq('ativo', true).order('ordem').then(({ data }) => setNec(data || [])); }, []);
  useEffect(() => { if (local.hash) setTimeout(() => document.querySelector(local.hash)?.scrollIntoView({ behavior: 'smooth' }), 150); }, [local.hash, c]);
  if (!c) return <div className="py-20 text-center text-slate-500">Carregando…</div>;
  return (
    <>
      <section className="bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <Titulo sobre="Doe agora">Sua doação vira cuidado com as crianças</Titulo>
          <CaixaPix c={c} />
          <p className="mt-4 text-center text-sm text-slate-500">Quer recibo? Envie o comprovante para nós pelo formulário de contato ou WhatsApp informando nome e CPF/CNPJ.</p>
        </div>
      </section>
      <section id="bens" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-14">
        <Titulo sobre="Doação de alimentos e materiais">Do que precisamos</Titulo>
        {nec.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {nec.map((n, i) => (
              <li key={n.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                <Pe cor={CORES_PES[i % CORES_PES.length]} className="h-10 w-6 shrink-0" />
                <div><p className="font-semibold text-slate-900">{n.titulo} {n.prioridade === 'alta' && <span className="ml-1 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-800">urgente</span>}</p>{n.descricao && <p className="text-sm text-slate-600">{n.descricao}</p>}</div>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-600">Fale com a gente para saber o que está faltando no momento.</p>}
        <div className="mt-8 grid gap-6 rounded-3xl bg-slate-50 p-6 md:grid-cols-2">
          <div className="space-y-2 text-slate-600">
            <p className="font-titulo text-xl font-bold text-slate-900">Como entregar</p>
            {c.endereco ? <p className="flex gap-2"><MapPin className="mt-1 h-4 w-4 shrink-0" />{c.endereco}</p> : <p>Combine a entrega com a equipe pelo formulário ao lado.</p>}
            {linkWhats(c.whatsapp, 'Olá! Quero doar alimentos/materiais para o Projeto Pé no Chão.') && <a href={linkWhats(c.whatsapp, 'Olá! Quero doar alimentos/materiais para o Projeto Pé no Chão.')!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-bold text-white"><MessageCircle className="h-4 w-4" />Combinar pelo WhatsApp</a>}
            <p className="text-sm">Doações em bens são registradas em controle próprio (separado do caixa) e o destino de cada item é anotado.</p>
          </div>
          <FormContato tipoInicial="doacao_bens" titulo="Quero doar itens" campoMensagem="O que você gostaria de doar?" />
        </div>
      </section>
      <section id="voluntario" className="scroll-mt-24 bg-green-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <Titulo sobre="Voluntariado">Venha somar com a gente</Titulo>
            <p className="text-lg text-slate-600">Recreação, esporte, reforço escolar, cozinha, organização de doações, comunicação… Conte o que você gosta de fazer e quando tem disponibilidade.</p>
            <p className="mt-4 text-sm text-slate-500">Empresas e parceiros: use o mesmo formulário e escolha “empresa” no assunto, ou escreva para nós.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm"><FormContato tipoInicial="voluntario" titulo="Quero ser voluntário(a)" campoMensagem="Como você gostaria de ajudar? Quais dias e horários?" /></div>
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ transparência
export function Transparencia() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { supabase.rpc('transparencia_publica').then(({ data }) => setD(data ?? { ativo: false })); }, []);
  if (!d) return <div className="py-20 text-center text-slate-500">Carregando…</div>;
  if (!d.ativo) return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><Titulo centro>Prestação de contas</Titulo><p className="text-slate-600">O portal de transparência está sendo preparado. Para informações, <Link to="/contato" className="underline">fale com a gente</Link>.</p></div>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <Titulo sobre="Transparência">Prestação de contas</Titulo>
      <p className="mb-8 max-w-3xl text-slate-600">Resumo dos valores recebidos e pagos em cada período publicado. Os números vêm diretamente do nosso sistema de gestão, onde cada lançamento possui comprovante e passa por conferência. Para preservar a privacidade, não divulgamos nomes de doadores, fornecedores ou participantes.</p>
      {!d.periodos.length && <p className="text-slate-500">Nenhum período publicado ainda.</p>}
      <div className="space-y-6">
        {d.periodos.map((p: any) => {
          const max = Math.max(1, ...p.por_categoria.map((x: any) => Number(x.valor)));
          return (
            <article key={p.nome} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-titulo text-2xl font-bold">{p.nome}</h3>
                <p className="text-sm text-slate-500">{fmtData(p.inicio)} a {fmtData(p.fim)} · {p.fechado ? 'período fechado' : 'em andamento (valores parciais)'}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-blue-50 p-4"><p className="text-sm text-slate-600">Recebido</p><p className="text-2xl font-bold tabular-nums">{dinheiro(p.receitas)}</p></div>
                <div className="rounded-2xl bg-orange-50 p-4"><p className="text-sm text-slate-600">Pago</p><p className="text-2xl font-bold tabular-nums">{dinheiro(p.despesas)}</p></div>
                <div className="rounded-2xl bg-sol-50 p-4"><p className="text-sm text-slate-600">Atividades</p><p className="text-2xl font-bold tabular-nums">{num(p.atividades)}</p></div>
                <div className="rounded-2xl bg-green-50 p-4"><p className="text-sm text-slate-600">Participações</p><p className="text-2xl font-bold tabular-nums">{num(p.atendimentos)}</p></div>
              </div>
              {p.por_categoria.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 font-semibold">Onde o dinheiro foi aplicado</p>
                  <ul className="space-y-2">
                    {p.por_categoria.map((x: any) => (
                      <li key={x.categoria} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm sm:grid-cols-[220px_1fr_auto]">
                        <span className="truncate text-slate-700">{x.categoria}</span>
                        <span className="order-3 col-span-2 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-[#eb6834]" style={{ width: `${(Number(x.valor) / max) * 100}%` }} /></span>
                        <span className="tabular-nums font-semibold">{dinheiro(x.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {d.atividades_recentes.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 font-titulo text-2xl font-bold">Atividades realizadas</h3>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-100">
            {d.atividades_recentes.map((a: any, i: number) => <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-3"><span><strong>{a.titulo}</strong> <span className="text-slate-500">· {a.tipo}{a.bairro ? ` · ${a.bairro}` : ''}</span></span><span className="text-sm text-slate-500">{mesAno(a.data)} · {num(a.participantes_qtd)} participações</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ contato e privacidade
export function Contato() {
  const c = useConfigSite();
  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-[1fr_1.2fr]">
      <div>
        <Titulo sobre="Contato">Fale com o Projeto Pé no Chão</Titulo>
        <div className="space-y-3 text-slate-600">
          {linkWhats(c?.whatsapp) && <a href={linkWhats(c?.whatsapp)!} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900"><MessageCircle className="h-5 w-5 text-[#25D366]" />WhatsApp</a>}
          {c?.instagram && <a href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900"><Instagram className="h-5 w-5 text-marca-rosa" />@{c.instagram.replace('@', '')}</a>}
          {c?.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-slate-900"><Mail className="h-5 w-5 text-marca-azul" />{c.email}</a>}
          {c?.endereco && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-5 w-5 text-marca-laranja" />{c.endereco}</p>}
          <p>Votorantim · São Paulo</p>
        </div>
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><FormContato tipoInicial="contato" /></div>
    </section>
  );
}

export function Privacidade() {
  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-slate-700">
      <Titulo sobre="LGPD">Privacidade e proteção de dados</Titulo>
      <p>O Projeto Pé no Chão trata dados pessoais apenas para as finalidades informadas, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Estatuto da Criança e do Adolescente.</p>
      <h3 className="font-titulo text-xl font-bold">Formulários do site</h3>
      <p>Nome, e-mail, telefone e mensagem enviados pelos formulários são usados somente para responder ao seu contato, com o seu consentimento. Esses dados ficam acessíveis apenas à administração do projeto.</p>
      <h3 className="font-titulo text-xl font-bold">Crianças e adolescentes</h3>
      <p>Dados de participantes são coletados com autorização dos responsáveis, no mínimo necessário, e nunca são publicados. Fotografias só são divulgadas com autorização de uso de imagem.</p>
      <h3 className="font-titulo text-xl font-bold">Doações</h3>
      <p>Doações recebidas são registradas no sistema de prestação de contas. Nomes de doadores não são divulgados publicamente.</p>
      <h3 className="font-titulo text-xl font-bold">Seus direitos</h3>
      <p>Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pela página de <Link to="/contato" className="underline">contato</Link>.</p>
    </section>
  );
}
