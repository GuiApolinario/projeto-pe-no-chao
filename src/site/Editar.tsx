// Área da equipe sem banco de dados: edita textos, imagens, PIX e contatos do site.
// Grava no próprio repositório (um commit só) usando uma chave de acesso do GitHub guardada neste aparelho.
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, ImagePlus, LogOut, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Aviso, AreaTexto, Rotulo, Texto, useAviso } from '../components/ui';
import { ClienteGitHub, ErroGitHub, REPO_PADRAO, type ArquivoParaGravar } from '../prestacao/github';
import { ErroArquivo, prepararImagemSite } from '../prestacao/imagem';
import { CamposSite } from '../prestacao/AdminSite';
import { paraBanco, paraFormulario, validarSite, type FormSite } from '../prestacao/siteConfig';
import { Cartao } from '../prestacao/componentes';
import { CAMPOS_CONTEUDO, CAMPOS_IMAGEM, GRUPOS, PADROES, imagemDe, sobrescritas, textosParaFormulario, type CampoImagem } from './conteudo';
import { recarregarConfigSite } from './Site';

const CHAVE_LS = 'pnc-github-token';
const ARQUIVO_SITE = 'public/site.json';
type Aba = 'textos' | 'dados' | 'imagens';
interface Nova { bytes: Uint8Array; ext: string; tipo: string; previa: string; path: string }

const lerToken = () => { try { return localStorage.getItem(CHAVE_LS) ?? sessionStorage.getItem(CHAVE_LS) ?? ''; } catch { return ''; } };
const guardarToken = (t: string, lembrar: boolean) => { try { sessionStorage.setItem(CHAVE_LS, t); if (lembrar) localStorage.setItem(CHAVE_LS, t); } catch { /* sem armazenamento */ } };
const esquecerToken = () => { try { localStorage.removeItem(CHAVE_LS); sessionStorage.removeItem(CHAVE_LS); } catch { /* sem armazenamento */ } };

export default function EditarSite() {
  const [token, setToken] = useState(lerToken);
  const [repo, setRepo] = useState(REPO_PADRAO);
  useEffect(() => { fetch('/site.json', { cache: 'no-cache' }).then((r) => r.json()).then((c) => { if (typeof c.github_repo === 'string' && c.github_repo) setRepo(c.github_repo); }).catch(() => undefined); }, []);
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <meta name="robots" content="noindex" />
      <h1 className="font-titulo text-3xl font-extrabold text-slate-900">Editar o site</h1>
      {token ? <Painel token={token} repo={repo} sair={() => { esquecerToken(); setToken(''); }} /> : <Entrada aoEntrar={(t, l) => { guardarToken(t, l); setToken(t); }} />}
    </section>
  );
}

function Entrada({ aoEntrar }: { aoEntrar: (t: string, lembrar: boolean) => void }) {
  const [t, setT] = useState('');
  const [lembrar, setLembrar] = useState(true);
  return (
    <form className="mt-4 max-w-xl space-y-4" onSubmit={(e) => { e.preventDefault(); if (t.trim()) aoEntrar(t.trim(), lembrar); }}>
      <p className="text-slate-600">Aqui a equipe muda os textos, as imagens, o PIX e os contatos do site. Para entrar, cole a <strong>chave de acesso</strong> do GitHub (o passo a passo para criar está em <code>docs/EDITAR-O-SITE.md</code>).</p>
      <Rotulo texto="Chave de acesso"><Texto type="password" autoComplete="off" value={t} onChange={(e) => setT(e.target.value)} placeholder="github_pat_…" data-teste="token" /></Rotulo>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />Lembrar neste aparelho (use só no seu computador ou celular)</label>
      <button data-teste="entrar" className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800">Entrar</button>
    </form>
  );
}

function Painel({ token, repo, sair }: { token: string; repo: string; sair: () => void }) {
  const avisar = useAviso();
  const [cliente] = useState(() => new ClienteGitHub(token, repo));
  const [ramo, setRamo] = useState('');
  const [bruto, setBruto] = useState<Record<string, unknown> | null>(null);
  const [erroInicial, setErroInicial] = useState('');
  const [aba, setAba] = useState<Aba>('textos');
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [site, setSite] = useState<FormSite | null>(null);
  const [imagens, setImagens] = useState<Record<string, string>>({});
  const [novas, setNovas] = useState<Record<string, Nova>>({});
  const [original, setOriginal] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [publicado, setPublicado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { ramo: r } = await cliente.verificar();
      const t = await cliente.lerTexto(r, ARQUIVO_SITE);
      const j = (t ? JSON.parse(t) : {}) as Record<string, unknown>;
      const tx = textosParaFormulario(j.textos as Record<string, string>);
      const f = paraFormulario(j);
      const im = Object.fromEntries(Object.entries((j.imagens as Record<string, string>) ?? {}).filter(([, v]) => typeof v === 'string' && v));
      setRamo(r); setBruto(j); setTextos(tx); setSite(f); setImagens(im); setNovas({});
      setOriginal(JSON.stringify([tx, f, im]));
    } catch (e) {
      setErroInicial(e instanceof ErroGitHub ? e.message : 'Não foi possível abrir o arquivo do site.');
    }
  }, [cliente]);
  useEffect(() => { carregar(); }, [carregar]);

  if (erroInicial) return (
    <div className="mt-4 space-y-3"><Aviso tom="erro" titulo="Não foi possível entrar">{erroInicial}</Aviso>
      <button onClick={sair} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50">Tentar com outra chave</button></div>
  );
  if (!bruto || !site) return <p className="py-10 text-center text-slate-500">Conectando ao GitHub…</p>;

  const sujo = JSON.stringify([textos, site, imagens]) !== original || Object.keys(novas).length > 0;

  async function escolherImagem(c: CampoImagem, arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const r = await prepararImagemSite(arquivo, c.chave === 'hero' ? 1400 : c.chave === 'qr_pix' ? 900 : 800, c.chave !== 'hero');
      const path = `public/imagens/site/${c.chave}-${Date.now().toString(36)}.${r.ext}`;
      const anterior = novas[c.chave]?.previa; if (anterior) URL.revokeObjectURL(anterior);
      setNovas({ ...novas, [c.chave]: { ...r, path, previa: URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: r.tipo })) } });
    } catch (e) { avisar('erro', e instanceof ErroArquivo ? e.message : 'Não foi possível usar esta imagem.'); }
  }
  function removerImagem(c: CampoImagem) {
    const { [c.chave]: _a, ...resto } = novas; void _a; setNovas(resto);
    const { [c.chave]: _b, ...im } = imagens; void _b; setImagens(im);
  }

  async function salvar() {
    const problemas = validarSite(site!);
    setErros(problemas);
    if (problemas.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSalvando(true);
    try {
      const imagensFinais: Record<string, string> = { ...imagens };
      const arquivos: ArquivoParaGravar[] = [];
      for (const [k, n] of Object.entries(novas)) { imagensFinais[k] = '/' + n.path.replace(/^public\//, ''); arquivos.push({ path: n.path, bytes: n.bytes }); }
      // relê o arquivo agora: se outra pessoa mexeu em outro campo, preserva
      const atual = JSON.parse((await cliente.lerTexto(ramo, ARQUIVO_SITE)) ?? '{}') as Record<string, unknown>;
      const novo: Record<string, unknown> = { ...atual, ...paraBanco(site!), textos: sobrescritas(textos), imagens: imagensFinais };
      arquivos.push({ path: ARQUIVO_SITE, texto: JSON.stringify(novo, null, 2) + '\n' });
      await cliente.gravar(ramo, arquivos, 'Atualiza o conteúdo do site pelo painel');
      Object.values(novas).forEach((n) => URL.revokeObjectURL(n.previa));
      recarregarConfigSite();
      setPublicado(true);
      await carregar();
      avisar('ok', 'Salvo! As mudanças aparecem no site em cerca de 2 minutos.');
    } catch (e) {
      avisar('erro', e instanceof ErroGitHub ? e.message : 'Não foi possível salvar agora. Tente de novo.');
    } finally { setSalvando(false); }
  }

  const abas: [Aba, string][] = [['textos', 'Textos do site'], ['dados', 'PIX, contatos e campanha'], ['imagens', 'Imagens e QR Code']];
  return (
    <div className="mt-4 space-y-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600">Tudo o que você mudar aqui vale para o site inteiro. Depois de salvar, leva cerca de 2 minutos para aparecer.</p>
        <button onClick={sair} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sair</button>
      </div>
      {publicado && <Aviso tom="ok" titulo="Alteração enviada">O site está sendo atualizado. Recarregue a página pública em 2 minutos para ver. <a className="underline" href={`https://github.com/${repo}/actions`} target="_blank" rel="noreferrer">Acompanhar</a></Aviso>}
      {erros.length > 0 && <Aviso tom="erro" titulo="Revise antes de salvar"><ul className="list-disc pl-5">{erros.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>}

      <div role="tablist" className="flex flex-wrap gap-2">
        {abas.map(([id, r]) => <button key={id} role="tab" aria-selected={aba === id} data-teste={`aba-${id}`} onClick={() => setAba(id)} className={`rounded-full px-5 py-2.5 text-sm font-bold ${aba === id ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-300 hover:bg-slate-50'}`}>{r}</button>)}
      </div>

      {aba === 'textos' && (
        <div className="space-y-4">
          {GRUPOS.map((g) => (
            <details key={g.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" open={g.id === 'home'}>
              <summary className="cursor-pointer font-titulo text-xl font-bold text-slate-900">{g.titulo}</summary>
              {g.descricao && <p className="mt-1 text-sm text-slate-500">{g.descricao}</p>}
              <div className="mt-4 grid gap-4">
                {CAMPOS_CONTEUDO.filter((c) => c.grupo === g.id).map((c) => (
                  <Rotulo key={c.chave} texto={c.rotulo} ajuda={c.ajuda}>
                    {c.longo
                      ? <AreaTexto rows={c.padrao.length > 300 ? 8 : 3} value={textos[c.chave]} onChange={(e) => setTextos({ ...textos, [c.chave]: e.target.value })} maxLength={4000} data-teste={c.chave} />
                      : <Texto value={textos[c.chave]} onChange={(e) => setTextos({ ...textos, [c.chave]: e.target.value })} maxLength={300} data-teste={c.chave} />}
                    {textos[c.chave] !== PADROES[c.chave] && <button type="button" onClick={() => setTextos({ ...textos, [c.chave]: PADROES[c.chave] })} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 underline"><RotateCcw className="h-3 w-3" />Restaurar texto original</button>}
                  </Rotulo>
                ))}
              </div>
            </details>
          ))}
          <p className="text-sm text-slate-500">Dica: apague o texto de um campo para deixá-lo em branco no site.</p>
        </div>
      )}

      {aba === 'dados' && <CamposSite f={site} setF={setSite} ocultarSobre />}

      {aba === 'imagens' && (
        <div className="space-y-5">
          {CAMPOS_IMAGEM.map((c) => {
            const atual = novas[c.chave]?.previa ?? (imagens[c.chave] ? imagemDe(imagens, c.chave) : c.padrao);
            return (
              <Cartao key={c.chave} titulo={c.rotulo} subtitulo={c.ajuda}>
                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                    {atual ? <img src={atual} alt={`Imagem atual: ${c.rotulo}`} className="max-h-36 max-w-36 object-contain" data-teste={`previa-${c.chave}`} /> : <p className="px-3 text-center text-xs text-slate-500">Em branco</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                      <ImagePlus className="h-4 w-4" />{atual ? 'Trocar imagem' : 'Enviar imagem'}
                      <input type="file" accept="image/*" className="sr-only" data-teste={`arquivo-${c.chave}`} onChange={(e) => { escolherImagem(c, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {(novas[c.chave] || imagens[c.chave]) && <div><button type="button" onClick={() => removerImagem(c)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 underline"><Trash2 className="h-4 w-4" />{c.padrao ? 'Voltar à imagem original' : 'Remover imagem'}</button></div>}
                    {novas[c.chave] && <p className="text-xs font-semibold text-amber-700">Nova imagem escolhida: clique em “Salvar alterações”.</p>}
                  </div>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{sujo ? <span className="font-semibold text-amber-700">Há alterações não salvas</span> : 'Tudo salvo.'} <Link to="/" target="_blank" className="ml-2 inline-flex items-center gap-1 underline">Ver o site<ExternalLink className="h-3 w-3" /></Link></p>
          <div className="flex gap-2">
            <button disabled={!sujo || salvando} onClick={carregar} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40">Descartar</button>
            <button data-teste="salvar" disabled={!sujo || salvando} onClick={salvar} className="rounded-full bg-slate-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
