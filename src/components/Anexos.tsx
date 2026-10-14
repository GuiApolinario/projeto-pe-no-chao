// Upload, listagem, visualização e conferência de documentos vinculados a um registro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FileText, Link2Off, Loader2, Paperclip, Upload, XCircle } from 'lucide-react';
import { BUCKET, mensagemErro, supabase } from '../lib/supabase';
import { data as fmtData, dinheiro, hojeISO, lerDinheiro, tamanhoArquivo } from '../lib/formato';
import { TIPOS_DOCUMENTO, opcoes } from '../lib/rotulos';
import { useSessao } from '../lib/sessao';
import { AreaTexto, Botao, Caixa, CampoDinheiro, Modal, Rotulo, Selecao, Selo, Texto, Vazio, useAviso, useConfirmacao } from './ui';

export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export interface DocumentoRow {
  id: string; codigo: string; storage_path: string; nome_arquivo: string; mime_type: string; tamanho_bytes: number;
  tipo_documento: string; descricao: string | null; data_documento: string | null; valor: number | null; sensivel: boolean;
  autorizado_publicacao: boolean; status: string; obs_conferente: string | null; enviado_em: string; enviado_por: string | null;
  conferido_em: string | null;
}

let limiteMB: number | null = null;
async function tamanhoMaximoMB(): Promise<number> {
  if (limiteMB !== null) return limiteMB;
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'upload').maybeSingle();
  limiteMB = Number((data?.valor as { tamanho_maximo_mb?: number })?.tamanho_maximo_mb) || 10;
  return limiteMB;
}

export async function validarArquivo(f: File): Promise<string | null> {
  if (!TIPOS_ACEITOS.includes(f.type)) return `"${f.name}": formato não aceito. Use JPG, PNG, WEBP ou PDF.`;
  const max = await tamanhoMaximoMB();
  if (f.size > max * 1024 * 1024) return `"${f.name}": arquivo maior que ${max} MB.`;
  if (f.size === 0) return `"${f.name}": arquivo vazio.`;
  // confere a assinatura do arquivo (evita extensões trocadas)
  const cab = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  const hex = [...cab].map((b) => b.toString(16).padStart(2, '0')).join('');
  const ok = (f.type === 'application/pdf' && hex.startsWith('25504446'))
    || (f.type === 'image/jpeg' && hex.startsWith('ffd8ff'))
    || (f.type === 'image/png' && hex.startsWith('89504e47'))
    || (f.type === 'image/webp' && hex.startsWith('52494646') && hex.slice(16, 24) === '57454250');
  return ok ? null : `"${f.name}": o conteúdo não corresponde ao tipo do arquivo.`;
}

export async function enviarDocumento(f: File, meta: { tipo_documento: string; descricao?: string; data_documento?: string | null; valor?: string | null; sensivel?: boolean; autorizado_publicacao?: boolean }, vinculo?: { entidade: string; registro_id: string; justificativa?: string }) {
  const erro = await validarArquivo(f);
  if (erro) throw new Error(erro);
  const hoje = hojeISO();
  const seguro = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
  const caminho = `${hoje.slice(0, 4)}/${hoje.slice(5, 7)}/${crypto.randomUUID()}-${seguro}`;
  const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type, upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from('documentos').insert({
    storage_path: caminho, nome_arquivo: f.name, mime_type: f.type, tamanho_bytes: f.size,
    tipo_documento: meta.tipo_documento, descricao: meta.descricao || null, data_documento: meta.data_documento || null,
    valor: meta.valor || null, sensivel: !!meta.sensivel, autorizado_publicacao: !!meta.autorizado_publicacao,
  }).select().single();
  if (error) throw error;
  if (vinculo) {
    const v = await supabase.from('documento_vinculos').insert({ documento_id: data.id, ...vinculo });
    if (v.error) throw v.error;
  }
  return data as DocumentoRow;
}

export async function urlAssinada(caminho: string, baixarComo?: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 300, baixarComo ? { download: baixarComo } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

// ------------------------------------------------------------------ miniatura
export function Miniatura({ doc, onClick, tamanho = 'h-20 w-20' }: { doc: DocumentoRow; onClick?: () => void; tamanho?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    if (doc.mime_type.startsWith('image/')) urlAssinada(doc.storage_path).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => { vivo = false; };
  }, [doc.storage_path, doc.mime_type]);
  return (
    <button type="button" onClick={onClick} className={`${tamanho} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-sol-400`} title={doc.nome_arquivo}>
      {doc.mime_type.startsWith('image/')
        ? (url ? <img src={url} alt={doc.descricao ?? doc.nome_arquivo} className="h-full w-full object-cover" loading="lazy" /> : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />)
        : <span className="flex flex-col items-center text-red-600"><FileText className="h-7 w-7" /><span className="text-[10px] font-semibold">PDF</span></span>}
    </button>
  );
}

// ------------------------------------------------------------------ visualizador
export function Visualizador({ doc, onFechar, onAlterado }: { doc: DocumentoRow | null; onFechar: () => void; onAlterado?: () => void }) {
  const { pode } = useSessao();
  const avisar = useAviso();
  const [url, setUrl] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [vinculos, setVinculos] = useState<{ entidade: string; registro_id: string; justificativa: string | null }[]>([]);

  useEffect(() => {
    setUrl(null); setObs(doc?.obs_conferente ?? '');
    if (!doc) return;
    urlAssinada(doc.storage_path).then(setUrl).catch((e) => avisar('erro', mensagemErro(e)));
    supabase.from('documento_vinculos').select('entidade, registro_id, justificativa').eq('documento_id', doc.id).then(({ data }) => setVinculos(data || []));
  }, [doc, avisar]);

  async function conferir(status: string) {
    if (!doc) return;
    setSalvando(true);
    const { error } = await supabase.rpc('conferir_documento', { p_id: doc.id, p_status: status, p_obs: obs || null });
    setSalvando(false);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Conferência registrada.');
    onAlterado?.();
    onFechar();
  }

  async function baixar() {
    if (!doc) return;
    try { window.location.href = await urlAssinada(doc.storage_path, doc.nome_arquivo); } catch (e) { avisar('erro', mensagemErro(e)); }
  }

  if (!doc) return null;
  return (
    <Modal aberto titulo={`${doc.codigo} — ${TIPOS_DOCUMENTO[doc.tipo_documento] ?? doc.tipo_documento}`} onFechar={onFechar} largura="max-w-5xl"
      rodape={<>
        <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={baixar}>Baixar original</Botao>
        {url && <a href={url} target="_blank" rel="noreferrer"><Botao variante="secundario" icone={<ExternalLink className="h-4 w-4" />}>Abrir em nova aba</Botao></a>}
      </>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-h-[50vh] items-center justify-center rounded-lg bg-slate-100">
          {!url ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            : doc.mime_type === 'application/pdf'
              ? <iframe src={url} title={doc.nome_arquivo} className="h-[65vh] w-full rounded-lg bg-white" />
              : <img src={url} alt={doc.descricao ?? doc.nome_arquivo} className="max-h-[70vh] w-auto rounded-lg object-contain" />}
        </div>
        <div className="space-y-3 text-sm">
          <dl className="space-y-1.5">
            <div><dt className="text-xs text-slate-500">Arquivo</dt><dd className="break-all">{doc.nome_arquivo} ({tamanhoArquivo(doc.tamanho_bytes)})</dd></div>
            <div><dt className="text-xs text-slate-500">Situação</dt><dd><Selo status={doc.status} /></dd></div>
            {doc.descricao && <div><dt className="text-xs text-slate-500">Descrição</dt><dd>{doc.descricao}</dd></div>}
            <div><dt className="text-xs text-slate-500">Data do documento</dt><dd>{fmtData(doc.data_documento)}</dd></div>
            <div><dt className="text-xs text-slate-500">Valor associado</dt><dd>{dinheiro(doc.valor)}</dd></div>
            <div><dt className="text-xs text-slate-500">Enviado em</dt><dd>{new Date(doc.enviado_em).toLocaleString('pt-BR')}</dd></div>
            <div><dt className="text-xs text-slate-500">Vínculos</dt><dd>{vinculos.length ? vinculos.map((v, i) => <span key={i} className="block">{v.entidade}{v.justificativa ? ` — ${v.justificativa}` : ''}</span>) : 'Nenhum'}</dd></div>
            {doc.sensivel && <div><Selo tom="roxo">Documento sensível (acesso restrito)</Selo></div>}
          </dl>
          {pode('admin', 'conferente') ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conferência</p>
              <Rotulo texto="Observações do conferente"><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Obrigatório em caso de rejeição" /></Rotulo>
              <div className="flex flex-wrap gap-2">
                <Botao variante="primario" pequeno carregando={salvando} icone={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => conferir('validado')}>Validar</Botao>
                <Botao variante="perigo" pequeno disabled={salvando || obs.trim().length < 5} icone={<XCircle className="h-3.5 w-3.5" />} onClick={() => conferir('rejeitado')}>Rejeitar p/ correção</Botao>
              </div>
              <p className="text-[11px] text-slate-500">Validar significa que o documento foi conferido conforme as regras cadastradas — anexar um arquivo, por si só, não o torna válido.</p>
            </div>
          ) : doc.obs_conferente ? <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">Conferente: {doc.obs_conferente}</p> : null}
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ envio
export function FormEnvio({ aberto, onFechar, onEnviado, vinculo, tipoPadrao = 'nota_fiscal', tipos }: {
  aberto: boolean; onFechar: () => void; onEnviado: () => void;
  vinculo?: { entidade: string; registro_id: string }; tipoPadrao?: string; tipos?: string[];
}) {
  const avisar = useAviso();
  const input = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [meta, setMeta] = useState({ tipo_documento: tipoPadrao, descricao: '', data_documento: '', valor: '', sensivel: false, autorizado_publicacao: false });
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => { if (aberto) { setArquivos([]); setErros([]); setMeta((m) => ({ ...m, tipo_documento: tipoPadrao, descricao: '', valor: '' })); } }, [aberto, tipoPadrao]);

  async function escolher(lista: FileList | null) {
    const fs = [...(lista ?? [])];
    const errs = (await Promise.all(fs.map(validarArquivo))).filter(Boolean) as string[];
    setErros(errs);
    setArquivos(fs.filter((_f, i) => !errs.some((e) => e.startsWith(`"${fs[i].name}"`))));
  }

  async function enviar() {
    setEnviando(true);
    let ok = 0;
    for (const f of arquivos) {
      try {
        await enviarDocumento(f, { ...meta, valor: meta.valor ? lerDinheiro(meta.valor) : null, data_documento: meta.data_documento || null }, vinculo);
        ok++;
      } catch (e) {
        avisar('erro', mensagemErro(e));
      }
    }
    setEnviando(false);
    if (ok) { avisar('ok', `${ok} documento(s) enviado(s).`); onEnviado(); onFechar(); }
  }

  const tiposOpcoes = opcoes(TIPOS_DOCUMENTO).filter((o) => !tipos || tipos.includes(o.valor));
  return (
    <Modal aberto={aberto} titulo="Anexar documentos" onFechar={onFechar} largura="max-w-xl"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={enviar} carregando={enviando} disabled={!arquivos.length}>Enviar {arquivos.length > 0 && `(${arquivos.length})`}</Botao></>}>
      <div className="space-y-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-sol-400 hover:bg-sol-50"
        >
          <Upload className="h-6 w-6 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Clique ou arraste os arquivos aqui</p>
          <p className="text-xs text-slate-500">JPG, PNG, WEBP ou PDF. No celular, é possível fotografar a nota direto pela câmera.</p>
          <input ref={input} type="file" multiple accept={TIPOS_ACEITOS.join(',')} className="hidden" onChange={(e) => escolher(e.target.files)} />
        </div>
        {erros.map((e) => <p key={e} className="text-xs text-red-600">{e}</p>)}
        {arquivos.length > 0 && <ul className="text-xs text-slate-600">{arquivos.map((f) => <li key={f.name}>• {f.name} ({tamanhoArquivo(f.size)})</li>)}</ul>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo texto="Tipo de documento" obrigatorio><Selecao opcoes={tiposOpcoes} vazio={false} value={meta.tipo_documento} onChange={(e) => setMeta({ ...meta, tipo_documento: e.target.value })} /></Rotulo>
          <Rotulo texto="Data do documento"><Texto type="date" value={meta.data_documento} onChange={(e) => setMeta({ ...meta, data_documento: e.target.value })} /></Rotulo>
          <Rotulo texto="Valor associado"><CampoDinheiro valor={meta.valor} onChange={(v) => setMeta({ ...meta, valor: v })} /></Rotulo>
          <Rotulo texto="Descrição"><Texto value={meta.descricao} onChange={(e) => setMeta({ ...meta, descricao: e.target.value })} /></Rotulo>
        </div>
        <Caixa rotulo="Documento sensível" ajuda="Dados bancários, pessoais ou contratos: visível apenas para administrador, financeiro e conferente." checked={meta.sensivel} onChange={(v) => setMeta({ ...meta, sensivel: v })} />
        {meta.tipo_documento === 'foto_atividade' && (
          <Caixa rotulo="Há autorização de uso de imagem de todas as pessoas identificáveis" ajuda="Exigido pela LGPD/ECA para qualquer divulgação." checked={meta.autorizado_publicacao} onChange={(v) => setMeta({ ...meta, autorizado_publicacao: v })} />
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ painel de anexos de um registro
export function Anexos({ entidade, registroId, podeEnviar, tipoPadrao, incluirPagamentos, onAlterado, titulo = 'Documentos anexados' }: {
  entidade: string; registroId: string; podeEnviar: boolean; tipoPadrao?: string; incluirPagamentos?: string[]; onAlterado?: () => void; titulo?: string;
}) {
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [docs, setDocs] = useState<(DocumentoRow & { vinculo_id: string; vinculo_entidade: string })[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [envio, setEnvio] = useState(false);
  const [vendo, setVendo] = useState<DocumentoRow | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = supabase.from('documento_vinculos').select('id, entidade, documentos(*)');
    q = incluirPagamentos?.length
      ? q.or(`and(entidade.eq.${entidade},registro_id.eq.${registroId}),and(entidade.eq.pagamento,registro_id.in.(${incluirPagamentos.join(',')}))`)
      : q.eq('entidade', entidade).eq('registro_id', registroId);
    const { data, error } = await q.order('criado_em');
    setCarregando(false);
    if (error) return avisar('erro', mensagemErro(error));
    setDocs(((data || []) as unknown as { id: string; entidade: string; documentos: DocumentoRow | null }[])
      .filter((v) => v.documentos).map((v) => ({ ...v.documentos!, vinculo_id: v.id, vinculo_entidade: v.entidade })));
  }, [entidade, registroId, incluirPagamentos?.join(','), avisar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  async function desvincular(vinculoId: string) {
    const ok = await confirmar({ titulo: 'Desvincular documento', texto: 'O arquivo continuará guardado na Central de Comprovantes, mas deixará de comprovar este registro. A ação fica registrada na auditoria.', perigo: true, rotuloOk: 'Desvincular' });
    if (!ok) return;
    const { error } = await supabase.from('documento_vinculos').delete().eq('id', vinculoId);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Documento desvinculado.');
    carregar(); onAlterado?.();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Paperclip className="h-4 w-4" />{titulo} ({docs.length})</p>
        {podeEnviar && <Botao variante="secundario" pequeno icone={<Upload className="h-3.5 w-3.5" />} onClick={() => setEnvio(true)}>Anexar</Botao>}
      </div>
      {carregando ? <p className="text-xs text-slate-500">Carregando…</p> : !docs.length ? <Vazio>Nenhum documento anexado.</Vazio> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {docs.map((d) => (
            <li key={d.vinculo_id} className="flex items-center gap-3 p-2">
              <Miniatura doc={d} onClick={() => setVendo(d)} tamanho="h-14 w-14" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-slate-800">{TIPOS_DOCUMENTO[d.tipo_documento] ?? d.tipo_documento}{d.vinculo_entidade === 'pagamento' && <span className="ml-1 text-xs font-normal text-slate-500">(do pagamento)</span>}</p>
                <p className="truncate text-xs text-slate-500">{d.codigo} · {d.nome_arquivo}{d.valor ? ` · ${dinheiro(d.valor)}` : ''}</p>
                {d.obs_conferente && <p className="text-xs text-amber-800">Conferente: {d.obs_conferente}</p>}
              </div>
              <Selo status={d.status} />
              {podeEnviar && <Botao variante="fantasma" pequeno onClick={() => desvincular(d.vinculo_id)} aria-label="Desvincular"><Link2Off className="h-3.5 w-3.5" /></Botao>}
            </li>
          ))}
        </ul>
      )}
      <FormEnvio aberto={envio} onFechar={() => setEnvio(false)} onEnviado={() => { carregar(); onAlterado?.(); }} vinculo={{ entidade, registro_id: registroId }} tipoPadrao={tipoPadrao} />
      <Visualizador doc={vendo} onFechar={() => setVendo(null)} onAlterado={() => { carregar(); onAlterado?.(); }} />
      {elemento}
    </div>
  );
}
