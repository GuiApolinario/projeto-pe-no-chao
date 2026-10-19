// Modo edição: a equipe navega pelo próprio site e muda textos, imagens, PIX e contatos no lugar onde aparecem.
// Nada vai ao ar até clicar em “Salvar”; aí vira um commit só no GitHub, que publica o site sozinho.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, LogOut, Save } from 'lucide-react';
import { Aviso, Modal } from '../components/ui';
import { CamposSite } from '../prestacao/AdminSite';
import { ContasArquivo } from '../prestacao/ContasArquivo';
import { ClienteGitHub, ErroGitHub, REPO_PADRAO, type ArquivoParaGravar } from '../prestacao/github';
import { ErroArquivo, prepararImagemSite } from '../prestacao/imagem';
import { paraBanco, paraFormulario, validarSite, type FormSite } from '../prestacao/siteConfig';
import { EdicaoCtx, type Edicao } from './contextoEdicao';
import { sobrescritas, textosParaFormulario } from './conteudo';
import { esquecerToken, ligarModoEdicao, lerToken, modoEdicaoLigado } from './token';

const ARQUIVO_SITE = 'public/site.json';
type ChaveImagem = 'logo' | 'hero' | 'qr_pix';
/** url: caminho publicado (ou null = voltar ao original); previa: foto local ainda não publicada; pendente: arquivo a gravar */
interface EstadoImagem { url: string | null; previa?: string; pendente?: { bytes: Uint8Array; path: string } }

export function ProvedorEdicao({ children }: { children: ReactNode }) {
  const [token] = useState(lerToken);
  const [ligado] = useState(modoEdicaoLigado);
  const [repo, setRepo] = useState(REPO_PADRAO);
  const [estado, setEstado] = useState<'conectando' | 'ok' | 'erro'>('conectando');
  const [mensagem, setMensagem] = useState('');
  const [cliente, setCliente] = useState<ClienteGitHub | null>(null);
  const [ramo, setRamo] = useState('');
  const [bruto, setBruto] = useState<Record<string, unknown> | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [versoes, setVersoes] = useState<Record<string, number>>({});
  const [site, setSite] = useState<FormSite | null>(null);
  const [siteTocado, setSiteTocado] = useState(false);
  const [imagens, setImagens] = useState<Partial<Record<ChaveImagem, EstadoImagem>>>({});
  const [prestacaoAtiva, setPrestacaoAtiva] = useState<boolean | null>(null);
  const [salvo, setSalvo] = useState('{}');
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState<'dados' | 'contas' | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [recado, setRecado] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);
  const local = useLocation();
  const ativo = !!token && ligado && estado === 'ok';

  // conecta ao GitHub quando o modo edição é ligado
  useEffect(() => {
    if (!token || !ligado) return;
    let vivo = true;
    (async () => {
      try {
        const c = await fetch('/site.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({}));
        const nome = typeof c.github_repo === 'string' && c.github_repo ? c.github_repo : REPO_PADRAO;
        const cl = new ClienteGitHub(token, nome);
        const { ramo: r } = await cl.verificar();
        const t = await cl.lerTexto(r, ARQUIVO_SITE);
        const j = (t ? JSON.parse(t) : {}) as Record<string, unknown>;
        if (!vivo) return;
        setRepo(nome); setCliente(cl); setRamo(r); setBruto(j); setSite(paraFormulario(j));
        setEstado('ok');
      } catch (e) {
        if (!vivo) return;
        setMensagem(e instanceof ErroGitHub ? e.message : 'Não foi possível abrir o arquivo do site.');
        setEstado('erro');
      }
    })();
    return () => { vivo = false; };
  }, [token, ligado]);

  const instantaneo = useMemo(() => JSON.stringify({ textos, site: siteTocado ? site : null, imagens: Object.entries(imagens).map(([k, v]) => [k, v?.url ?? null]), prestacaoAtiva }), [textos, site, siteTocado, imagens, prestacaoAtiva]);
  const sujo = instantaneo !== salvo && (Object.keys(textos).length > 0 || siteTocado || Object.keys(imagens).length > 0 || prestacaoAtiva !== null);

  // links não navegam enquanto se edita (clicar no texto do menu edita o texto); a barra tem os atalhos
  useEffect(() => {
    if (!ativo) return;
    const bloquear = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('[data-barra-edicao]') || alvo.matches('input[type=file]')) return;
      if (alvo.closest('a')?.closest('header, footer, main')) e.preventDefault();
    };
    document.addEventListener('click', bloquear, true);
    return () => document.removeEventListener('click', bloquear, true);
  }, [ativo]);

  useEffect(() => {
    if (!ativo || !sujo) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [ativo, sujo]);

  const setTexto = useCallback((chave: string, valor: string) => {
    setTextos((t) => ({ ...t, [chave]: valor }));
    setVersoes((v) => ({ ...v, [chave]: (v[chave] ?? 0) + 1 }));
  }, []);

  const escolherImagem = useCallback(async (chave: ChaveImagem, arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const r = await prepararImagemSite(arquivo, chave === 'hero' ? 1400 : chave === 'qr_pix' ? 900 : 800, chave !== 'hero');
      const path = `public/imagens/site/${chave}-${Date.now().toString(36)}.${r.ext}`;
      const previa = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: r.tipo }));
      setImagens((m) => { if (m[chave]?.previa) URL.revokeObjectURL(m[chave]!.previa!); return { ...m, [chave]: { url: '/' + path.replace(/^public\//, ''), previa, pendente: { bytes: r.bytes, path } } }; });
    } catch (e) { setRecado({ tom: 'erro', texto: e instanceof ErroArquivo ? e.message : 'Não foi possível usar esta imagem.' }); }
  }, []);

  const aplicar = useCallback(<T extends object>(c: T): T => {
    const base = c as Record<string, unknown>;
    const r: Record<string, unknown> = { ...base };
    if (siteTocado && site) Object.assign(r, paraBanco(site));
    r.textos = { ...((base.textos as Record<string, string>) ?? {}), ...textos };
    const im: Record<string, string> = { ...((base.imagens as Record<string, string>) ?? {}) };
    for (const [k, v] of Object.entries(imagens)) { if (!v || !v.url) delete im[k]; else im[k] = v.previa ?? v.url; }
    r.imagens = im;
    if (prestacaoAtiva !== null) r.prestacao_ativa = prestacaoAtiva;
    return r as T;
  }, [site, siteTocado, textos, imagens, prestacaoAtiva]);

  async function salvar() {
    if (!cliente || !site) return;
    if (siteTocado) {
      const problemas = validarSite(site);
      setErros(problemas);
      if (problemas.length) { setModal('dados'); return; }
    }
    setSalvando(true);
    try {
      const atual = JSON.parse((await cliente.lerTexto(ramo, ARQUIVO_SITE)) ?? '{}') as Record<string, unknown>;
      const completo = textosParaFormulario(atual.textos as Record<string, string>);
      Object.assign(completo, textos);
      const imgsFinais: Record<string, string> = { ...((atual.imagens as Record<string, string>) ?? {}) };
      const arquivos: ArquivoParaGravar[] = [];
      for (const [k, v] of Object.entries(imagens)) {
        if (!v || !v.url) delete imgsFinais[k];
        else { imgsFinais[k] = v.url; if (v.pendente) arquivos.push({ path: v.pendente.path, bytes: v.pendente.bytes }); }
      }
      const novo: Record<string, unknown> = { ...atual, ...(siteTocado ? paraBanco(site) : {}), textos: sobrescritas(completo), imagens: imgsFinais };
      if (prestacaoAtiva !== null) novo.prestacao_ativa = prestacaoAtiva;
      arquivos.push({ path: ARQUIVO_SITE, texto: JSON.stringify(novo, null, 2) + '\n' });
      await cliente.gravar(ramo, arquivos, 'Atualiza o conteúdo do site pelo modo edição');
      setImagens((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v && { ...v, pendente: undefined }])));
      setBruto(novo);
      setSalvo(instantaneo);
      setRecado({ tom: 'ok', texto: 'Salvo! As mudanças ficam no ar em cerca de 2 minutos.' });
    } catch (e) {
      setRecado({ tom: 'erro', texto: e instanceof ErroGitHub ? e.message : 'Não foi possível salvar agora. Tente de novo.' });
    } finally { setSalvando(false); }
  }

  function sair(esquecer = false) {
    if (sujo && !window.confirm('Há mudanças que ainda não foram salvas. Sair mesmo assim?')) return;
    ligarModoEdicao(false); if (esquecer) esquecerToken();
    window.location.assign('/');
  }

  const valor: Edicao = useMemo(() => ({
    ativo, setTexto, versao: (k: string) => versoes[k] ?? 0, escolherImagem,
    abrirDados: () => { setSiteTocado(true); setModal('dados'); },
    abrirContas: () => setModal('contas'),
    aplicar,
  }), [ativo, setTexto, versoes, escolherImagem, aplicar]);

  const naPrestacaoAtiva = prestacaoAtiva ?? !!(bruto?.prestacao_ativa);
  return (
    <EdicaoCtx.Provider value={valor}>
      {children}
      {token && ligado && (
        <div data-barra-edicao data-edicao-ui className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-sky-500 bg-white px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
            {estado === 'conectando' && <p className="text-sm text-slate-600">Conectando ao GitHub…</p>}
            {estado === 'erro' && <><p className="text-sm font-semibold text-red-700">{mensagem}</p><button onClick={() => sair(true)} className="rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-slate-300">Usar outra chave</button></>}
            {estado === 'ok' && (
              <>
                <p className="text-sm font-bold text-sky-700">Modo edição</p>
                <p className="hidden text-xs text-slate-500 lg:block">Clique em qualquer texto para mudar. Nada vai ao ar até você salvar.</p>
                <nav aria-label="Páginas" className="flex flex-wrap gap-1 text-xs font-semibold">
                  {([['/', 'Início'], ['/doe', 'Como ajudar'], ['/prestacao-de-contas', 'Prestação'], ['/contato', 'Contato'], ['/privacidade', 'Privacidade']] as const).map(([to, r]) => (
                    <Link key={to} to={to} className={`rounded-full px-3 py-1.5 ${local.pathname === to ? 'bg-sky-100 text-sky-800' : 'text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{r}</Link>
                  ))}
                </nav>
                <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" data-teste="aba-prestacao" checked={naPrestacaoAtiva} onChange={(e) => setPrestacaoAtiva(e.target.checked)} />Mostrar a aba “Prestação de contas”</label>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button data-teste="abrir-dados" onClick={() => { setSiteTocado(true); setModal('dados'); }} className="rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ring-slate-300 hover:bg-slate-50">PIX, contatos e campanha</button>
                  {naPrestacaoAtiva && <button data-teste="abrir-contas" onClick={() => setModal('contas')} className="rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ring-slate-300 hover:bg-slate-50">Lançar entradas e gastos</button>}
                  <span className="text-xs font-semibold text-amber-700">{sujo ? 'Alterações não salvas' : ''}</span>
                  <button data-teste="salvar" disabled={!sujo || salvando} onClick={salvar} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"><Save className="h-4 w-4" />{salvando ? 'Salvando…' : 'Salvar'}</button>
                  <button data-teste="sair-edicao" onClick={() => sair()} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ring-slate-300 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Ver como visitante</button>
                  <button onClick={() => sair(true)} className="inline-flex items-center gap-1 text-xs text-slate-500 underline"><LogOut className="h-3 w-3" />Esquecer a chave</button>
                </div>
              </>
            )}
          </div>
          {recado && <div className="mx-auto mt-2 max-w-6xl" onClick={() => setRecado(null)}><Aviso tom={recado.tom}>{recado.texto} <a className="underline" href={`https://github.com/${repo}/actions`} target="_blank" rel="noreferrer">Acompanhar</a></Aviso></div>}
        </div>
      )}
      <div className={ativo ? 'h-24' : 'hidden'} aria-hidden="true" />
      {ativo && modal === 'dados' && site && (
        <Modal aberto titulo="PIX, contatos e campanha" onFechar={() => setModal(null)} largura="max-w-4xl"
          rodape={<button data-teste="concluir-dados" onClick={() => { const p = validarSite(site); setErros(p); if (!p.length) setModal(null); }} className="rounded-full bg-slate-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Concluir</button>}>
          <div data-edicao-ui className="space-y-4">
            <p className="text-sm text-slate-600">O que você mudar aparece na página por trás. Para publicar, clique em <strong>Salvar</strong> na barra azul.</p>
            {erros.length > 0 && <Aviso tom="erro" titulo="Revise antes de continuar"><ul className="list-disc pl-5">{erros.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>}
            <CamposSite f={site} setF={setSite} ocultarSobre />
          </div>
        </Modal>
      )}
      {ativo && modal === 'contas' && cliente && (
        <Modal aberto titulo="Prestação de contas: entradas e gastos" onFechar={() => setModal(null)} largura="max-w-4xl">
          <div data-edicao-ui><ContasArquivo cliente={cliente} ramo={ramo} /></div>
        </Modal>
      )}
    </EdicaoCtx.Provider>
  );
}
