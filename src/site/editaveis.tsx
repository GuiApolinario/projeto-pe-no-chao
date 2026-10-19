// Peças usadas pelas páginas: no modo edição viram campos editáveis no próprio lugar; no site normal são só texto/imagem.
import { useRef } from 'react';
import { ImagePlus, Pencil } from 'lucide-react';
import { useConfigSite } from './config';
import { useEdicao } from './contextoEdicao';
import { CAMPOS_CONTEUDO, imagemDe, tx } from './conteudo';

const LONGOS = new Set(CAMPOS_CONTEUDO.filter((c) => c.longo).map((c) => c.chave));

/** Texto do site. Com o modo edição ligado, é só clicar e digitar. */
export function T({ k }: { k: string }) {
  const ed = useEdicao();
  const c = useConfigSite();
  const valor = tx(c?.textos, k);
  if (!ed?.ativo) return <>{valor}</>;
  const longo = LONGOS.has(k);
  return (
    <span
      key={`${k}-${ed.versao(k)}`} contentEditable suppressContentEditableWarning spellCheck data-edicao-ui data-campo={k} role="textbox" aria-label={k}
      className={`inline-block min-w-[3ch] cursor-text rounded-sm outline-dashed outline-2 outline-offset-2 outline-sky-400/80 hover:bg-sky-100/60 focus:bg-sky-100 focus:outline-solid empty:before:text-slate-400 empty:before:content-['(em_branco)'] ${longo ? 'whitespace-pre-wrap' : ''}`}
      onKeyDown={(e) => { if (e.key === 'Enter' && !longo) { e.preventDefault(); e.currentTarget.blur(); } }}
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
      onBlur={(e) => { const novo = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\n$/, ''); if (novo !== valor) ed.setTexto(k, novo); }}
    >{valor}</span>
  );
}

/** Imagem do site. No modo edição aparece o botão “Trocar imagem” sobre ela. */
export function ImagemEditavel({ chave, className, alt, bloco }: { chave: 'logo' | 'hero' | 'qr_pix'; className?: string; alt: string; bloco?: boolean }) {
  const ed = useEdicao();
  const c = useConfigSite();
  const src = imagemDe(c?.imagens, chave);
  if (!ed?.ativo) return src ? <img src={src} alt={alt} className={className} /> : null;
  return (
    <span className={`relative ${bloco ? 'block' : 'inline-block'} outline-dashed outline-2 outline-offset-2 outline-sky-400/80`}>
      {src ? <img src={src} alt={alt} className={className} data-teste={`imagem-${chave}`} /> : null}
      <EnviarImagem chave={chave} rotulo={src ? 'Trocar imagem' : 'Enviar imagem'} />
    </span>
  );
}

export function EnviarImagem({ chave, rotulo }: { chave: 'logo' | 'hero' | 'qr_pix'; rotulo: string }) {
  const ed = useEdicao();
  const arquivo = useRef<HTMLInputElement>(null);
  if (!ed?.ativo) return null;
  return (
    <>
      <button type="button" data-edicao-ui data-teste={`trocar-${chave}`} onClick={(e) => { e.preventDefault(); arquivo.current?.click(); }}
        className="absolute inset-x-0 bottom-1 z-10 mx-auto flex w-max cursor-pointer items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-slate-900"><ImagePlus className="h-3.5 w-3.5" />{rotulo}</button>
      <input ref={arquivo} type="file" accept="image/*" className="sr-only" tabIndex={-1} data-teste={`arquivo-${chave}`} onChange={(e) => { ed.escolherImagem(chave, e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}

/** Pequeno botão “✏️ Editar …” que só existe no modo edição. */
export function BotaoEditar({ rotulo, acao, teste }: { rotulo: string; acao: 'dados' | 'contas'; teste?: string }) {
  const ed = useEdicao();
  if (!ed?.ativo) return null;
  return (
    <button type="button" data-edicao-ui data-teste={teste} onClick={acao === 'dados' ? ed.abrirDados : ed.abrirContas}
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-sky-700"><Pencil className="h-3.5 w-3.5" />{rotulo}</button>
  );
}

/** No modo edição, mostra também o que está em branco (para dar para preencher). */
export function useVer() {
  const ed = useEdicao();
  return (v: string) => !!ed?.ativo || !!v;
}
