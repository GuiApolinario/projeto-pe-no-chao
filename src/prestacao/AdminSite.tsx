import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dataHora } from '../lib/formato';
import { gerarPixCopiaECola } from '../lib/pix';
import { Aviso, AreaTexto, CampoDinheiro, Rotulo, Selecao, Texto, useAviso } from '../components/ui';
import { recarregarConfigSite } from '../site/Site';
import { Cartao } from './componentes';
import { paraBanco, paraFormulario, TIPOS_PIX, validarSite, type FormSite, type Necessidade } from './siteConfig';

export function AdminSite({ sb, base }: { sb: SupabaseClient; base: Record<string, unknown> }) {
  const avisar = useAviso();
  const [f, setF] = useState<FormSite | null>(null);
  const [original, setOriginal] = useState('');
  const [quando, setQuando] = useState<string | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    sb.from('pc_site').select('valor, atualizado_em').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) { avisar('erro', `Não foi possível carregar: ${error.message}`); return; }
      // o que a equipe já salvou vale; no primeiro uso, parte do que está no site.json
      const salvo = data?.valor && Object.keys(data.valor).length ? data.valor : base;
      const form = paraFormulario(salvo as Record<string, unknown>);
      setF(form); setOriginal(JSON.stringify(form)); setQuando(data?.atualizado_em ?? null);
    });
  }, [sb, base, avisar]);

  if (!f) return <p className="py-10 text-center text-slate-500">Carregando…</p>;
  const sujo = JSON.stringify(f) !== original;
  async function salvar() {
    const problemas = validarSite(f!);
    setErros(problemas);
    if (problemas.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSalvando(true);
    const { data, error } = await sb.from('pc_site').update({ valor: paraBanco(f!) }).eq('id', 1).select('valor, atualizado_em').maybeSingle();
    setSalvando(false);
    if (error || !data) return avisar('erro', `Não foi possível salvar: ${error?.message ?? 'sem permissão'}`);
    const form = paraFormulario(data.valor as Record<string, unknown>);
    setF(form); setOriginal(JSON.stringify(form)); setQuando(data.atualizado_em);
    recarregarConfigSite();
    avisar('ok', 'Site atualizado! As mudanças já estão no ar.');
  }

  return (
    <div className="space-y-6 pb-24">
      <p className="text-slate-600">O que você mudar aqui aparece no site <strong>na hora</strong>, sem precisar publicar nada. {quando && <span className="text-sm text-slate-500">Última alteração: {dataHora(quando)}.</span>}</p>
      {erros.length > 0 && <Aviso tom="erro" titulo="Revise antes de salvar">{<ul className="list-disc pl-5">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}</Aviso>}

      <CamposSite f={f} setF={setF} />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{sujo ? <span className="font-semibold text-amber-700">Há alterações não salvas</span> : 'Tudo salvo.'} <Link to="/doe" target="_blank" className="ml-2 underline">Ver a página “Como ajudar”</Link></p>
          <div className="flex gap-2">
            <button disabled={!sujo || salvando} onClick={() => { setF(JSON.parse(original)); setErros([]); }} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40">Descartar</button>
            <button data-teste="salvar-site" disabled={!sujo || salvando} onClick={salvar} className="rounded-full bg-slate-900 px-7 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Os blocos de campos (PIX, contatos, quem somos, campanha, necessidades), usados pelos dois painéis. */
export function CamposSite({ f, setF, slotPix, ocultarSobre }: { f: FormSite; setF: (f: FormSite) => void; slotPix?: ReactNode; ocultarSobre?: boolean }) {
  const [qr, setQr] = useState('');
  const payload = useMemo(() => (f.pix_chave.trim() && f.pix_nome.trim() ? gerarPixCopiaECola({ chave: f.pix_chave, nome: f.pix_nome, cidade: f.pix_cidade || 'VOTORANTIM' }) : ''), [f.pix_chave, f.pix_nome, f.pix_cidade]);
  useEffect(() => { if (payload) QRCode.toDataURL(payload, { margin: 1, width: 200 }).then(setQr); else setQr(''); }, [payload]);
  const set = (k: keyof Omit<FormSite, 'necessidades'>, v: string) => setF({ ...f, [k]: v });
  const setNec = (i: number, n: Partial<Necessidade>) => setF({ ...f, necessidades: f.necessidades.map((x, j) => (j === i ? { ...x, ...n } : x)) });
  const mover = (i: number, d: number) => { const l = [...f.necessidades]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setF({ ...f, necessidades: l }); };
  return (
    <>
      <Cartao titulo="Doações por PIX" subtitulo="Aparece na página “Como ajudar”, com QR Code e “copia e cola”.">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Rotulo texto="Tipo da chave"><Selecao opcoes={TIPOS_PIX.map((t) => ({ valor: t, rotulo: t }))} value={f.pix_tipo} onChange={(e) => set('pix_tipo', e.target.value)} data-teste="pix-tipo" /></Rotulo>
            <Rotulo texto="Chave PIX" ajuda="A chave da conta do projeto (CNPJ, e-mail, telefone ou aleatória)."><Texto value={f.pix_chave} onChange={(e) => set('pix_chave', e.target.value)} data-teste="pix-chave" /></Rotulo>
            <Rotulo texto="Nome de quem recebe" ajuda="Exatamente como aparece no banco."><Texto value={f.pix_nome} onChange={(e) => set('pix_nome', e.target.value)} data-teste="pix-nome" /></Rotulo>
            <Rotulo texto="Cidade"><Texto value={f.pix_cidade} onChange={(e) => set('pix_cidade', e.target.value)} /></Rotulo>
            <Rotulo texto="Transferência ou depósito (opcional)" className="sm:col-span-2"><AreaTexto rows={2} value={f.banco_texto} onChange={(e) => set('banco_texto', e.target.value)} placeholder="Banco, agência, conta e titular" /></Rotulo>
          </div>
          <div className="text-center">
            {qr ? <img src={qr} alt="Prévia do QR Code PIX" className="mx-auto rounded-xl ring-4 ring-sol-300" data-teste="pix-previa" /> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Preencha a chave e o nome para ver a prévia do QR Code.</p>}
          </div>
        </div>
        {slotPix}
        <div className="mt-3"><Aviso tom="atencao">Depois de salvar, faça um PIX de teste de R$ 1,00 lendo o QR Code na página “Como ajudar” e confira o nome que aparece no banco.</Aviso></div>
      </Cartao>

      <Cartao titulo="Contatos" subtitulo="Aparecem no rodapé, na página de contato e nos botões de WhatsApp. Deixe em branco o que não quiser mostrar.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Rotulo texto="WhatsApp (com DDD)"><Texto value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="15 99999-1234" data-teste="whatsapp" /></Rotulo>
          <Rotulo texto="Instagram (só o usuário)"><Texto value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="projetopenochao" /></Rotulo>
          <Rotulo texto="E-mail"><Texto value={f.email} onChange={(e) => set('email', e.target.value)} /></Rotulo>
          <Rotulo texto="Endereço / ponto de entrega de doações" className="sm:col-span-3"><Texto value={f.endereco} onChange={(e) => set('endereco', e.target.value)} /></Rotulo>
        </div>
      </Cartao>

      {!ocultarSobre && (
      <Cartao titulo="Quem somos" subtitulo="Texto da página inicial. Se ficar vazio, o site usa um texto simples e genérico.">
        <AreaTexto rows={6} value={f.texto_sobre} onChange={(e) => set('texto_sobre', e.target.value)} maxLength={4000} aria-label="Quem somos" />
        <p className="mt-1 text-right text-xs text-slate-400">{f.texto_sobre.length}/4000</p>
      </Cartao>

      )}
      <Cartao titulo="Campanha em destaque (opcional)" subtitulo="Mostra uma barra de progresso na página inicial. Atualize o valor arrecadado quando quiser.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Rotulo texto="Nome da campanha"><Texto value={f.campanha_titulo} onChange={(e) => set('campanha_titulo', e.target.value)} placeholder="Natal Pé no Chão" /></Rotulo>
          <Rotulo texto="Meta"><CampoDinheiro valor={f.campanha_meta} onChange={(v) => set('campanha_meta', v)} /></Rotulo>
          <Rotulo texto="Arrecadado até agora"><CampoDinheiro valor={f.campanha_arrecadado} onChange={(v) => set('campanha_arrecadado', v)} /></Rotulo>
        </div>
      </Cartao>

      <Cartao titulo="O que o projeto precisa agora" subtitulo="Lista exibida na página inicial e em “Como ajudar”. Use “urgente” só para o que falta de verdade.">
        {f.necessidades.length === 0 && <p className="mb-3 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Nenhum item. Clique em “Adicionar item”.</p>}
        <ul className="space-y-3">
          {f.necessidades.map((n, i) => (
            <li key={i} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1.2fr_1.6fr_130px_auto]" data-teste="necessidade">
              <Texto value={n.titulo} onChange={(e) => setNec(i, { titulo: e.target.value })} placeholder="Ex.: Leite em pó" aria-label="Item" maxLength={120} />
              <Texto value={n.descricao} onChange={(e) => setNec(i, { descricao: e.target.value })} placeholder="Detalhe (opcional)" aria-label="Detalhe" maxLength={300} />
              <Selecao vazio={false} opcoes={[{ valor: 'alta', rotulo: 'Urgente' }, { valor: 'media', rotulo: 'Normal' }, { valor: 'baixa', rotulo: 'Quando der' }]} value={n.prioridade} onChange={(e) => setNec(i, { prioridade: e.target.value as Necessidade['prioridade'] })} aria-label="Prioridade" />
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === f.necessidades.length - 1} aria-label="Descer" className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setF({ ...f, necessidades: f.necessidades.filter((_, j) => j !== i) })} aria-label="Remover item" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" data-teste="nova-necessidade" disabled={f.necessidades.length >= 30} onClick={() => setF({ ...f, necessidades: [...f.necessidades, { titulo: '', descricao: '', prioridade: 'media' }] })}
          className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white"><Plus className="h-4 w-4" />Adicionar item</button>
      </Cartao>

    </>
  );
}
