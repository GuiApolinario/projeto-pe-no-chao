import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Camera, EyeOff, FileText, Loader2, Trash2 } from 'lucide-react';
import { hojeISO, lerDinheiro } from '../lib/formato';
import { Aviso, AreaTexto, Caixa, CampoDinheiro, Modal, Rotulo, Texto, useAviso } from '../components/ui';
import { apagarAnexos, baixarAnexo, enviarAnexo, mudarVisibilidade, urlParaEquipe } from './armazenamento';
import { CATEGORIAS, CATEGORIA_OUTRAS, EXEMPLOS_DESCRICAO } from './categorias';
import type { ConfigPrestacao } from './config';
import { ErroArquivo, prepararArquivo } from './imagem';
import { EditorTarja } from './Tarja';
import type { Anexo, Lancamento, TipoLancamento } from './tipos';

interface NovoArquivo { chave: string; file: File; publico: boolean; previa: string }
interface Rascunho {
  id?: string; tipo: TipoLancamento; data: string; valor: string; categoria: string; categoriaOutra: string; descricao: string;
  contraparte: string; mostrar_contraparte: boolean; publicar: boolean; observacao_interna: string;
  existentes: Anexo[]; novos: NovoArquivo[]; removidos: Anexo[];
}

export function rascunhoVazio(tipo: TipoLancamento): Rascunho {
  return { tipo, data: hojeISO(), valor: '', categoria: '', categoriaOutra: '', descricao: '', contraparte: '', mostrar_contraparte: false, publicar: true, observacao_interna: '', existentes: [], novos: [], removidos: [] };
}

export function rascunhoDe(l: Lancamento): Rascunho {
  const conhecida = CATEGORIAS[l.tipo].includes(l.categoria);
  return {
    id: l.id, tipo: l.tipo, data: l.data, valor: Number(l.valor).toFixed(2), categoria: conhecida ? l.categoria : CATEGORIA_OUTRAS[l.tipo], categoriaOutra: conhecida ? '' : l.categoria,
    descricao: l.descricao, contraparte: l.contraparte ?? '', mostrar_contraparte: !!l.mostrar_contraparte, publicar: l.publicar !== false,
    observacao_interna: l.observacao_interna ?? '', existentes: l.anexos.map((a) => ({ ...a, publico: !!a.publico })), novos: [], removidos: [],
  };
}

function Interruptor({ marcado, onChange, rotulo }: { marcado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={marcado} aria-label={rotulo} onClick={() => onChange(!marcado)} data-teste="interruptor-site"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${marcado ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${marcado ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function PreviaExistente({ sb, config, anexo }: { sb: SupabaseClient; config: ConfigPrestacao; anexo: Anexo }) {
  const [url, setUrl] = useState<string | null>(null);
  const pdf = anexo.tipo === 'application/pdf' || anexo.path.endsWith('.pdf');
  useEffect(() => { let v = true; if (!pdf) urlParaEquipe(sb, config, anexo).then((u) => v && setUrl(u)).catch(() => {}); return () => { v = false; }; }, [sb, config, anexo, pdf]);
  if (pdf) return <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-slate-100 text-red-600"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold">PDF</span></div>;
  return <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Loader2 className="m-5 h-6 w-6 animate-spin text-slate-400" />}</div>;
}

export function FormLancamento({ sb, config, inicial, onFechar, onSalvo }: { sb: SupabaseClient; config: ConfigPrestacao; inicial: Rascunho; onFechar: () => void; onSalvo: () => void }) {
  const avisar = useAviso();
  const [r, setR] = useState<Rascunho>(inicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<{ origem: 'novo' | 'existente'; chave: string; arquivo: File } | null>(null);
  const [historico, setHistorico] = useState<{ id: number; acao: string; em: string; usuario_email: string | null }[] | null>(null);
  const entrada = r.tipo === 'entrada';
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setR((x) => ({ ...x, [k]: v }));
  const totalAnexos = r.existentes.length + r.novos.length;
  const algumPublico = r.existentes.some((a) => a.publico) || r.novos.some((n) => n.publico);

  useEffect(() => () => r.novos.forEach((n) => URL.revokeObjectURL(n.previa)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function escolher(lista: FileList | null) {
    const arquivos = [...(lista ?? [])];
    for (const f of arquivos) {
      if (totalAnexos + arquivos.indexOf(f) >= 6) { avisar('erro', 'Cada registro aceita até 6 comprovantes.'); break; }
      try {
        const pronto = await prepararArquivo(f);
        setR((x) => ({ ...x, novos: [...x.novos, { chave: crypto.randomUUID(), file: pronto, publico: x.tipo === 'saida', previa: pronto.type.startsWith('image/') ? URL.createObjectURL(pronto) : '' }] }));
      } catch (e) { avisar('erro', e instanceof ErroArquivo ? e.message : 'Não foi possível usar este arquivo.'); }
    }
    if (input.current) input.current.value = '';
  }

  async function cobrirExistente(a: Anexo) {
    try { setEditando({ origem: 'existente', chave: a.path, arquivo: await baixarAnexo(sb, a) }); }
    catch { avisar('erro', 'Não foi possível abrir a foto para editar.'); }
  }

  function concluirTarja(f: File) {
    if (!editando) return;
    const previa = URL.createObjectURL(f);
    if (editando.origem === 'novo') {
      setR((x) => ({ ...x, novos: x.novos.map((n) => (n.chave === editando.chave ? (URL.revokeObjectURL(n.previa), { ...n, file: f, previa }) : n)) }));
    } else {
      setR((x) => {
        const antigo = x.existentes.find((a) => a.path === editando.chave)!;
        return { ...x, existentes: x.existentes.filter((a) => a !== antigo), removidos: [...x.removidos, antigo], novos: [...x.novos, { chave: crypto.randomUUID(), file: f, publico: !!antigo.publico, previa }] };
      });
    }
    setEditando(null);
  }

  async function verHistorico() {
    if (!r.id) return;
    const { data } = await sb.from('pc_historico').select('id, acao, em, usuario_email').eq('lancamento_id', r.id).order('em', { ascending: false }).limit(20);
    setHistorico(data ?? []);
  }

  async function salvar() {
    const valor = lerDinheiro(r.valor);
    const categoria = r.categoria === CATEGORIA_OUTRAS[r.tipo] && r.categoriaOutra.trim() ? r.categoriaOutra.trim() : r.categoria;
    const faltas: string[] = [];
    if (!valor || Number(valor) <= 0) faltas.push('o valor');
    if (!r.data) faltas.push('a data');
    if (r.descricao.trim().length < 3) faltas.push('a descrição (o que foi?)');
    if (!categoria) faltas.push('o tipo/categoria');
    setErros(faltas);
    if (faltas.length) return;

    setSalvando(true);
    const enviados: Anexo[] = [];
    const movidos: Anexo[] = [];
    try {
      const existentes: Anexo[] = [];
      for (const a of r.existentes) {
        const original = inicial.existentes.find((o) => o.path === a.path);
        if (original && !!original.publico !== !!a.publico) { const m = await mudarVisibilidade(sb, original, !!a.publico); movidos.push(m); existentes.push(m); } else existentes.push(a);
      }
      for (const n of r.novos) enviados.push(await enviarAnexo(sb, n.file, n.publico));
      const dados = {
        tipo: r.tipo, data: r.data, valor, categoria, descricao: r.descricao.trim(), contraparte: r.contraparte.trim() || null,
        mostrar_contraparte: !!r.contraparte.trim() && r.mostrar_contraparte, publicar: r.publicar,
        anexos: [...existentes, ...enviados], observacao_interna: r.observacao_interna.trim() || null,
      };
      const { error } = r.id ? await sb.from('pc_lancamentos').update(dados).eq('id', r.id) : await sb.from('pc_lancamentos').insert(dados);
      if (error) throw error;
      if (r.removidos.length) await apagarAnexos(sb, r.removidos);
      avisar('ok', r.id ? 'Registro atualizado.' : entrada ? 'Entrada registrada. Obrigado!' : 'Gasto registrado.');
      onSalvo();
    } catch (e) {
      await apagarAnexos(sb, enviados).catch(() => {});
      avisar('erro', `Não foi possível salvar: ${(e as { message?: string })?.message ?? 'erro desconhecido'}`);
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal aberto titulo={r.id ? 'Editar registro' : entrada ? '💰 Entrou dinheiro' : '🧾 Saiu dinheiro'} onFechar={onFechar} largura="max-w-2xl"
        rodape={<>
          <button className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50" onClick={onFechar}>Cancelar</button>
          <button data-teste="salvar-lancamento" onClick={salvar} disabled={salvando}
            className="rounded-full bg-slate-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>}>
        <div className="space-y-5">
          {erros.length > 0 && <Aviso tom="erro">Falta preencher: {erros.join(', ')}.</Aviso>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Rotulo texto="Valor" obrigatorio><CampoDinheiro valor={r.valor} onChange={(v) => set('valor', v)} aria-label="Valor" data-teste="campo-valor" autoFocus /></Rotulo>
            <Rotulo texto="Data" obrigatorio>
              <div className="flex gap-2">
                <Texto type="date" value={r.data} max={hojeISO()} onChange={(e) => set('data', e.target.value)} aria-label="Data" data-teste="campo-data" />
                <button type="button" className="shrink-0 rounded-lg px-3 text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-50" onClick={() => set('data', hojeISO())}>Hoje</button>
              </div>
            </Rotulo>
          </div>

          <Rotulo texto="O que foi?" obrigatorio ajuda="Escreva de um jeito que qualquer pessoa entenda.">
            <Texto value={r.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder={EXEMPLOS_DESCRICAO[r.tipo]} maxLength={300} aria-label="O que foi?" data-teste="campo-descricao" />
          </Rotulo>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-600">{entrada ? 'De onde veio?' : 'Com o que foi gasto?'} <span className="text-red-600">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS[r.tipo].map((c) => (
                <button key={c} type="button" aria-pressed={r.categoria === c} onClick={() => set('categoria', c)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${r.categoria === c ? (entrada ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white') : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-sol-50'}`}>{c}</button>
              ))}
            </div>
            {r.categoria === CATEGORIA_OUTRAS[r.tipo] && <div className="mt-2"><Texto value={r.categoriaOutra} onChange={(e) => set('categoriaOutra', e.target.value)} placeholder="Se quiser, descreva o tipo (opcional)" maxLength={60} aria-label="Outro tipo" /></div>}
          </fieldset>

          <div className="rounded-2xl bg-slate-50 p-4">
            <Rotulo texto={entrada ? 'Quem doou? (opcional)' : 'Quem recebeu / onde comprou? (opcional)'}>
              <Texto value={r.contraparte} onChange={(e) => set('contraparte', e.target.value)} maxLength={120} aria-label="Nome" />
            </Rotulo>
            {r.contraparte.trim() && <div className="mt-2"><Caixa rotulo="Mostrar este nome no site" ajuda={entrada ? 'Só marque se a pessoa ou empresa autorizou. Por padrão, o nome fica escondido.' : 'Fornecedores costumam poder aparecer; evite mostrar nomes de pessoas físicas.'} checked={r.mostrar_contraparte} onChange={(v) => set('mostrar_contraparte', v)} /></div>}
          </div>

          <section className="space-y-3 rounded-2xl border-2 border-dashed border-slate-200 p-4" aria-label="Comprovantes">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">Comprovantes <span className="text-sm font-normal text-slate-500">({totalAnexos}/6)</span></p>
              <button type="button" data-teste="adicionar-foto" onClick={() => input.current?.click()} disabled={totalAnexos >= 6}
                className="inline-flex items-center gap-2 rounded-full bg-sol-500 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-sol-400 disabled:opacity-50"><Camera className="h-4 w-4" />Tirar foto ou escolher arquivo</button>
              <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" data-teste="entrada-arquivo" onChange={(e) => escolher(e.target.files)} />
            </div>
            <p className="text-xs text-slate-500">Notas, recibos e comprovantes de PIX (foto ou PDF). As fotos são reduzidas automaticamente.</p>
            {algumPublico && <Aviso tom="atencao" titulo="Antes de mostrar no site">Cubra com tarja preta CPF, telefone, chave PIX, número de conta e nomes de crianças. Use o botão “Cobrir dados” em cada foto.</Aviso>}

            <ul className="space-y-2">
              {r.existentes.map((a) => (
                <li key={a.path} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-100">
                  <PreviaExistente sb={sb} config={config} anexo={a} />
                  <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium text-slate-800">{a.nome ?? 'Comprovante'}</p>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-600"><Interruptor marcado={!!a.publico} onChange={(v) => setR((x) => ({ ...x, existentes: x.existentes.map((e) => (e === a ? { ...e, publico: v } : e)) }))} rotulo="Mostrar no site" />{a.publico ? 'Aparece no site' : 'Só a equipe vê'}</label></div>
                  {(a.tipo ?? '').startsWith('image/') && <button type="button" onClick={() => cobrirExistente(a)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-50"><EyeOff className="h-3.5 w-3.5" />Cobrir dados</button>}
                  <button type="button" aria-label="Remover comprovante" onClick={() => setR((x) => ({ ...x, existentes: x.existentes.filter((e) => e !== a), removidos: [...x.removidos, a] }))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
              {r.novos.map((n) => (
                <li key={n.chave} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-100" data-teste="comprovante-novo">
                  {n.previa ? <img src={n.previa} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-slate-100 text-red-600"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold">PDF</span></div>}
                  <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium text-slate-800">{n.file.name}</p>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-600"><Interruptor marcado={n.publico} onChange={(v) => setR((x) => ({ ...x, novos: x.novos.map((e) => (e.chave === n.chave ? { ...e, publico: v } : e)) }))} rotulo="Mostrar no site" />{n.publico ? 'Vai aparecer no site' : 'Só a equipe vai ver'}</label></div>
                  {n.previa && <button type="button" data-teste="cobrir-dados" onClick={() => setEditando({ origem: 'novo', chave: n.chave, arquivo: n.file })} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-50"><EyeOff className="h-3.5 w-3.5" />Cobrir dados</button>}
                  <button type="button" aria-label="Remover comprovante" onClick={() => { URL.revokeObjectURL(n.previa); setR((x) => ({ ...x, novos: x.novos.filter((e) => e.chave !== n.chave) })); }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <label className="flex items-center justify-between gap-3">
              <span><span className="block font-semibold text-slate-800">Aparece no site</span><span className="text-xs text-slate-500">{r.publicar ? 'Qualquer pessoa verá este registro.' : 'Escondido: só a equipe vê (rascunho).'}</span></span>
              <Interruptor marcado={r.publicar} onChange={(v) => set('publicar', v)} rotulo="Aparece no site" />
            </label>
            <Rotulo texto="Anotação interna (só a equipe vê)"><AreaTexto rows={2} value={r.observacao_interna} onChange={(e) => set('observacao_interna', e.target.value)} maxLength={1000} /></Rotulo>
          </div>

          {r.id && (
            <div className="text-xs text-slate-500">
              {historico === null ? <button type="button" className="underline" onClick={verHistorico}>Ver histórico de alterações</button> : (
                <ul className="space-y-1">{historico.map((h) => <li key={h.id}>{new Date(h.em).toLocaleString('pt-BR')} — {h.acao === 'criacao' ? 'criado' : h.acao === 'alteracao' ? 'alterado' : 'excluído'} por {h.usuario_email ?? 'sistema'}</li>)}</ul>
              )}
            </div>
          )}
        </div>
      </Modal>
      {editando && <EditorTarja arquivo={editando.arquivo} onConcluir={concluirTarja} onCancelar={() => setEditando(null)} />}
    </>
  );
}
