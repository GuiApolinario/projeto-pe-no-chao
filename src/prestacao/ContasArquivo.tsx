// Prestação de contas sem banco: a equipe lança entradas e gastos; cada salvamento é um commit no GitHub.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Camera, EyeOff, FileText, Pencil, Trash2 } from 'lucide-react';
import { data as fmtData, dinheiro, hojeISO, lerDinheiro } from '../lib/formato';
import { Aviso, Caixa, CampoDinheiro, Modal, Rotulo, Texto, useAviso, useConfirmacao } from '../components/ui';
import { CAMINHO_DADOS, caminhoNoRepositorio, lerLista, novoCaminhoFoto, removerDaLista, salvarNaLista, serializar, urlDaFoto } from './arquivo';
import { ordenarRecentes, resumo } from './calculos';
import { CATEGORIAS, CATEGORIA_OUTRAS, EXEMPLOS_DESCRICAO } from './categorias';
import { CartoesResumo, Miniatura, useLightbox } from './componentes';
import { ClienteGitHub, ErroGitHub, type ArquivoParaGravar } from './github';
import { ErroArquivo, prepararArquivo } from './imagem';
import { EditorTarja } from './Tarja';
import type { Anexo, Lancamento, TipoLancamento } from './tipos';

interface Novo { chave: string; file: File; previa: string }
interface Rascunho { id?: string; tipo: TipoLancamento; data: string; valor: string; categoria: string; categoriaOutra: string; descricao: string; contraparte: string; mostrar: boolean; existentes: Anexo[]; novos: Novo[]; removidos: Anexo[]; coberto: boolean }

const vazio = (tipo: TipoLancamento): Rascunho => ({ tipo, data: hojeISO(), valor: '', categoria: '', categoriaOutra: '', descricao: '', contraparte: '', mostrar: false, existentes: [], novos: [], removidos: [], coberto: false });
const deLanc = (l: Lancamento): Rascunho => {
  const conhecida = CATEGORIAS[l.tipo].includes(l.categoria);
  return { id: l.id, tipo: l.tipo, data: l.data, valor: l.valor.toFixed(2), categoria: conhecida ? l.categoria : CATEGORIA_OUTRAS[l.tipo], categoriaOutra: conhecida ? '' : l.categoria, descricao: l.descricao, contraparte: l.contraparte ?? '', mostrar: !!l.contraparte, existentes: l.anexos, novos: [], removidos: [], coberto: true };
};

export function ContasArquivo({ cliente, ramo }: { cliente: ClienteGitHub; ramo: string }) {
  const avisar = useAviso();
  const { confirmar, elemento: confirmacao } = useConfirmacao();
  const lightbox = useLightbox();
  const [lancs, setLancs] = useState<Lancamento[] | null>(null);
  const [form, setForm] = useState<Rascunho | null>(null);

  const carregar = useCallback(async () => {
    try { setLancs(lerLista(await cliente.lerTexto(ramo, CAMINHO_DADOS))); }
    catch (e) { avisar('erro', e instanceof ErroGitHub ? e.message : 'Não foi possível carregar os registros.'); }
  }, [cliente, ramo, avisar]);
  useEffect(() => { carregar(); }, [carregar]);

  /** Relê o arquivo, aplica a mudança e grava tudo (dados + fotos) em um commit só. */
  async function gravar(mudar: (l: Lancamento[]) => Lancamento[], extras: ArquivoParaGravar[], mensagem: string) {
    const atual = lerLista(await cliente.lerTexto(ramo, CAMINHO_DADOS));
    const nova = mudar(atual);
    await cliente.gravar(ramo, [...extras, { path: CAMINHO_DADOS, texto: serializar(nova) }], mensagem);
    setLancs(nova);
  }

  async function excluir(l: Lancamento) {
    if (!(await confirmar({ titulo: 'Excluir este registro?', texto: `“${l.descricao}” (${dinheiro(l.valor)}) e as fotos dele serão apagados do site.`, rotuloOk: 'Excluir', perigo: true }))) return;
    try {
      await gravar((x) => removerDaLista(x, l.id), l.anexos.map((a) => ({ path: caminhoNoRepositorio(a), excluir: true })), 'Remove registro da prestação de contas');
      avisar('ok', 'Registro excluído. Some do site em cerca de 2 minutos.');
    } catch (e) { avisar('erro', e instanceof ErroGitHub ? e.message : 'Não foi possível excluir agora.'); }
  }

  if (!lancs) return <p className="py-10 text-center text-slate-500">Carregando registros…</p>;
  const lista = ordenarRecentes(lancs);
  const r = resumo(lancs);
  return (
    <div className="space-y-6">
      <Aviso tom="atencao" titulo="Tudo o que for lançado aqui é público">Entradas, gastos e fotos aparecem para qualquer pessoa no site, porque ele não tem banco de dados. Cubra CPF, telefone, chave PIX, conta bancária e nomes de crianças com a tarja preta antes de salvar. Doadores só aparecem se você marcar.</Aviso>
      <div className="flex flex-wrap gap-3">
        <button data-teste="nova-entrada" onClick={() => setForm(vazio('entrada'))} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"><ArrowDownRight className="h-5 w-5" />Entrou dinheiro</button>
        <button data-teste="nova-saida" onClick={() => setForm(vazio('saida'))} className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700"><ArrowUpRight className="h-5 w-5" />Saiu dinheiro</button>
      </div>
      {lista.length > 0 && <CartoesResumo r={r} rotuloPeriodo="todo o período registrado" />}
      {lista.length === 0 ? <p className="rounded-2xl bg-slate-50 p-8 text-center text-slate-600">Nenhum registro ainda. Toque em <strong>Entrou dinheiro</strong> ou <strong>Saiu dinheiro</strong> para começar.</p> : (
        <ul className="space-y-3">
          {lista.map((l) => (
            <li key={l.id} data-teste="registro" className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${l.tipo === 'entrada' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{l.tipo === 'entrada' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{l.descricao}</p><p className="text-sm text-slate-500">{fmtData(l.data)} · {l.categoria}{l.contraparte ? ` · ${l.contraparte}` : ''}</p></div>
              {l.anexos.map((a, i) => <Miniatura key={a.path} item={{ url: urlDaFoto(a), nome: a.nome ?? 'Comprovante', pdf: a.path.endsWith('.pdf') }} onClick={() => lightbox.abrir(l.anexos.map((x) => ({ url: urlDaFoto(x), nome: x.nome ?? 'Comprovante', pdf: x.path.endsWith('.pdf') })), i)} />)}
              <p className={`font-bold tabular-nums ${l.tipo === 'entrada' ? 'text-blue-700' : 'text-orange-700'}`}>{l.tipo === 'saida' ? '− ' : '+ '}{dinheiro(l.valor)}</p>
              <button aria-label="Editar" onClick={() => setForm(deLanc(l))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
              <button aria-label="Excluir" onClick={() => excluir(l)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {form && <FormArquivo inicial={form} onFechar={() => setForm(null)} aoSalvar={async (l, extras, msg) => { await gravar((x) => salvarNaLista(x, l), extras, msg); setForm(null); avisar('ok', 'Registro salvo! Aparece no site em cerca de 2 minutos.'); }} />}
      {confirmacao}{lightbox.elemento}
    </div>
  );
}

function FormArquivo({ inicial, onFechar, aoSalvar }: { inicial: Rascunho; onFechar: () => void; aoSalvar: (l: Lancamento, extras: ArquivoParaGravar[], mensagem: string) => Promise<void> }) {
  const avisar = useAviso();
  const [r, setR] = useState(inicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Novo | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const entrada = r.tipo === 'entrada';
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setR((x) => ({ ...x, [k]: v }));
  const total = r.existentes.length + r.novos.length;
  useEffect(() => () => r.novos.forEach((n) => URL.revokeObjectURL(n.previa)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function escolher(lista: FileList | null) {
    const arquivos = [...(lista ?? [])];
    for (const [i, f] of arquivos.entries()) {
      if (total + i >= 6) { avisar('erro', 'Cada registro aceita até 6 comprovantes.'); break; }
      try {
        const pronto = await prepararArquivo(f);
        setR((x) => ({ ...x, coberto: false, novos: [...x.novos, { chave: crypto.randomUUID(), file: pronto, previa: pronto.type.startsWith('image/') ? URL.createObjectURL(pronto) : '' }] }));
      } catch (e) { avisar('erro', e instanceof ErroArquivo ? e.message : 'Não foi possível usar este arquivo.'); }
    }
    if (input.current) input.current.value = '';
  }

  async function salvar() {
    const valor = lerDinheiro(r.valor);
    const categoria = r.categoria === CATEGORIA_OUTRAS[r.tipo] && r.categoriaOutra.trim() ? r.categoriaOutra.trim() : r.categoria;
    const f: string[] = [];
    if (!valor || Number(valor) <= 0) f.push('o valor');
    if (!r.data) f.push('a data');
    if (r.descricao.trim().length < 3) f.push('a descrição (o que foi?)');
    if (!categoria) f.push('o tipo/categoria');
    if (r.novos.length > 0 && !r.coberto) f.push('a confirmação de que os dados pessoais das fotos foram cobertos');
    setErros(f);
    if (f.length) return;
    setSalvando(true);
    try {
      const id = r.id ?? crypto.randomUUID();
      const extras: ArquivoParaGravar[] = [];
      const anexos: Anexo[] = [...r.existentes];
      for (const n of r.novos) {
        const path = novoCaminhoFoto(r.data, crypto.randomUUID(), n.file.type);
        extras.push({ path: `public/${path}`, bytes: new Uint8Array(await n.file.arrayBuffer()) });
        anexos.push({ path, nome: n.file.name, tipo: n.file.type, publico: true });
      }
      for (const a of r.removidos) extras.push({ path: caminhoNoRepositorio(a), excluir: true });
      const l: Lancamento = { id, tipo: r.tipo, data: r.data, valor: Number(valor), categoria, descricao: r.descricao.trim(), contraparte: r.contraparte.trim() && r.mostrar ? r.contraparte.trim() : null, anexos, atualizado_em: new Date().toISOString() };
      await aoSalvar(l, extras, r.id ? 'Altera registro da prestação de contas' : 'Novo registro da prestação de contas');
    } catch (e) {
      avisar('erro', e instanceof ErroGitHub ? e.message : 'Não foi possível salvar agora. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal aberto titulo={r.id ? 'Editar registro' : entrada ? '💰 Entrou dinheiro' : '🧾 Saiu dinheiro'} onFechar={onFechar} largura="max-w-2xl"
        rodape={<>
          <button className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50" onClick={onFechar}>Cancelar</button>
          <button data-teste="salvar-lancamento" onClick={salvar} disabled={salvando} className="rounded-full bg-slate-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>}>
        <div className="space-y-5">
          {erros.length > 0 && <Aviso tom="erro">Falta: {erros.join(', ')}.</Aviso>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Rotulo texto="Valor" obrigatorio><CampoDinheiro valor={r.valor} onChange={(v) => set('valor', v)} aria-label="Valor" data-teste="campo-valor" autoFocus /></Rotulo>
            <Rotulo texto="Data" obrigatorio><Texto type="date" value={r.data} max={hojeISO()} onChange={(e) => set('data', e.target.value)} aria-label="Data" data-teste="campo-data" /></Rotulo>
          </div>
          <Rotulo texto="O que foi?" obrigatorio ajuda="Escreva de um jeito que qualquer pessoa entenda."><Texto value={r.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder={EXEMPLOS_DESCRICAO[r.tipo]} maxLength={300} aria-label="O que foi?" data-teste="campo-descricao" /></Rotulo>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-600">{entrada ? 'De onde veio?' : 'Com o que foi gasto?'} <span className="text-red-600">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS[r.tipo].map((c) => <button key={c} type="button" aria-pressed={r.categoria === c} onClick={() => set('categoria', c)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${r.categoria === c ? (entrada ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white') : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-sol-50'}`}>{c}</button>)}
            </div>
            {r.categoria === CATEGORIA_OUTRAS[r.tipo] && <div className="mt-2"><Texto value={r.categoriaOutra} onChange={(e) => set('categoriaOutra', e.target.value)} placeholder="Se quiser, descreva o tipo (opcional)" maxLength={60} aria-label="Outro tipo" /></div>}
          </fieldset>
          <div className="rounded-2xl bg-slate-50 p-4">
            <Rotulo texto={entrada ? 'Quem doou? (opcional)' : 'Quem recebeu / onde comprou? (opcional)'}><Texto value={r.contraparte} onChange={(e) => set('contraparte', e.target.value)} maxLength={120} aria-label="Nome" /></Rotulo>
            {r.contraparte.trim() && <div className="mt-2"><Caixa rotulo="Mostrar este nome no site" ajuda="Só marque se a pessoa ou empresa autorizou. Sem marcar, o nome não é guardado." checked={r.mostrar} onChange={(v) => set('mostrar', v)} /></div>}
          </div>
          <section className="space-y-3 rounded-2xl border-2 border-dashed border-slate-200 p-4" aria-label="Comprovantes">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">Comprovantes <span className="text-sm font-normal text-slate-500">({total}/6)</span></p>
              <button type="button" data-teste="adicionar-foto" onClick={() => input.current?.click()} disabled={total >= 6} className="inline-flex items-center gap-2 rounded-full bg-sol-500 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-sol-400 disabled:opacity-50"><Camera className="h-4 w-4" />Tirar foto ou escolher arquivo</button>
              <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" data-teste="entrada-arquivo" onChange={(e) => escolher(e.target.files)} />
            </div>
            <p className="text-xs text-slate-500">Notas, recibos e comprovantes de PIX (foto ou PDF). As fotos são reduzidas automaticamente e <strong>ficam públicas</strong>.</p>
            <ul className="space-y-2">
              {r.existentes.map((a) => (
                <li key={a.path} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-100">
                  {a.path.endsWith('.pdf') ? <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-slate-100 text-red-600"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold">PDF</span></div> : <img src={urlDaFoto(a)} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{a.nome ?? 'Comprovante'}</p>
                  <button type="button" aria-label="Remover comprovante" onClick={() => setR((x) => ({ ...x, existentes: x.existentes.filter((e) => e !== a), removidos: [...x.removidos, a] }))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
              {r.novos.map((n) => (
                <li key={n.chave} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-100" data-teste="comprovante-novo">
                  {n.previa ? <img src={n.previa} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-slate-100 text-red-600"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold">PDF</span></div>}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{n.file.name}</p>
                  {n.previa && <button type="button" data-teste="cobrir-dados" onClick={() => setEditando(n)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-50"><EyeOff className="h-3.5 w-3.5" />Cobrir dados</button>}
                  <button type="button" aria-label="Remover comprovante" onClick={() => { URL.revokeObjectURL(n.previa); setR((x) => ({ ...x, novos: x.novos.filter((e) => e.chave !== n.chave) })); }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            {r.novos.length > 0 && <Caixa rotulo="Conferi as fotos e cobri CPF, telefone, chave PIX, conta bancária e nomes de crianças." checked={r.coberto} onChange={(v) => set('coberto', v)} />}
          </section>
        </div>
      </Modal>
      {editando && <EditorTarja arquivo={editando.file} onCancelar={() => setEditando(null)} onConcluir={(f) => {
        const previa = URL.createObjectURL(f);
        setR((x) => ({ ...x, novos: x.novos.map((n) => (n.chave === editando.chave ? (URL.revokeObjectURL(n.previa), { ...n, file: f, previa }) : n)) }));
        setEditando(null);
      }} />}
    </>
  );
}
