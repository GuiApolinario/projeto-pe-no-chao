import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Info, Paperclip, Search } from 'lucide-react';
import { useConfigSite, FaixaPes } from '../site/Site';
import { tx } from '../site/conteudo';
import { dataHora, data as fmtData, dinheiro, hojeISO } from '../lib/formato';
import { anosDisponiveis, buscar, filtrarPeriodo, ordenarRecentes, porCategoria, porMes, resumo, ultimaAtualizacao } from './calculos';
import { modoDemo, urlFotoPublica } from './config';
import { usePrestacaoPublica } from './dados';
import { BarrasCategoria, Cartao, CartoesResumo, COR_ENTRADA, COR_SAIDA, GraficoMeses, GraficoSaldo, Miniatura, useLightbox, type ItemVisual } from './componentes';
import { ehPdf } from './config';
import type { Lancamento } from './tipos';

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const POR_PAGINA = 15;

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={ativo}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${ativo ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-sol-50'}`}>{children}</button>
  );
}

export default function Publica() {
  const config = useConfigSite();
  const t = (k: string) => tx(config?.textos, k);
  const { estado, lancs, erro } = usePrestacaoPublica(config);
  const lightbox = useLightbox();
  const hoje = hojeISO();

  const [ano, setAno] = useState<number | null | undefined>(undefined); // undefined = ainda não escolhido (usa o ano mais recente)
  const [mes, setMes] = useState(0);
  const [tipo, setTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [busca, setBusca] = useState('');
  const [soComFoto, setSoComFoto] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const anos = useMemo(() => anosDisponiveis(lancs), [lancs]);
  const anoAtivo = ano === undefined ? (anos[0] ?? null) : ano;
  const doPeriodo = useMemo(() => filtrarPeriodo(lancs, anoAtivo, mes), [lancs, anoAtivo, mes]);
  const r = useMemo(() => resumo(doPeriodo), [doPeriodo]);
  // a série mensal considera todos os registros para acumular o saldo, mas mostra só o ano escolhido
  const meses = useMemo(() => porMes(lancs, anoAtivo, hoje), [lancs, anoAtivo, hoje]);
  const origem = useMemo(() => porCategoria(doPeriodo, 'entrada'), [doPeriodo]);
  const destino = useMemo(() => porCategoria(doPeriodo, 'saida'), [doPeriodo]);

  const lista = useMemo(() => {
    let l = doPeriodo;
    if (tipo !== 'todos') l = l.filter((x) => x.tipo === tipo);
    if (soComFoto) l = l.filter((x) => x.anexos.length > 0);
    return ordenarRecentes(buscar(l, busca));
  }, [doPeriodo, tipo, soComFoto, busca]);

  const rotuloPeriodo = mes && anoAtivo ? `${NOMES_MES[mes - 1]} de ${anoAtivo}` : anoAtivo ? String(anoAtivo) : 'todo o período';
  const atualizado = ultimaAtualizacao(lancs);
  const mesSelecionado = mes && anoAtivo ? `${anoAtivo}-${String(mes).padStart(2, '0')}` : undefined;

  function itens(l: Lancamento): ItemVisual[] {
    return l.anexos.map((a) => ({ url: urlFotoPublica(config!, a), nome: a.nome ?? 'Comprovante', pdf: ehPdf(a) }));
  }

  return (
    <>
      <section className="bg-gradient-to-b from-sol-50 via-white to-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-12">
          <p className="mb-1 text-sm font-bold uppercase tracking-widest text-sol-600">{t('pc.etiqueta')}</p>
          <h1 className="font-titulo text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">{t('pc.titulo')}</h1>
          {t('pc.intro') && <p className="mt-3 max-w-2xl text-lg text-slate-600">{t('pc.intro')}</p>}
          {config && modoDemo(config) && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-sol-100 p-4 text-sm text-slate-800 ring-1 ring-sol-300" role="note">
              <Info className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Dados de exemplo.</strong> Esta é uma pré-visualização de como a página vai ficar. Nenhum valor abaixo é real.</p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16">
        {estado === 'carregando' && <p className="py-16 text-center text-slate-500">Carregando…</p>}
        {estado === 'sem-configuracao' && <p className="rounded-3xl bg-sol-50 p-8 text-center text-slate-700 ring-1 ring-sol-200">A prestação de contas será publicada aqui em breve.</p>}
        {estado === 'erro' && <p className="rounded-3xl bg-red-50 p-8 text-center text-red-800 ring-1 ring-red-200">Não foi possível carregar os dados agora. Tente novamente em instantes. <span className="block text-xs opacity-70">{erro}</span></p>}

        {estado === 'ok' && lancs.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-slate-100">
            <FaixaPes />
            <p className="font-titulo text-2xl font-bold text-slate-900">{t('pc.vazio_titulo')}</p>
            <p className="mt-2 text-slate-600">{t('pc.vazio_texto')}</p>
          </div>
        )}

        {estado === 'ok' && lancs.length > 0 && (
          <>
            <div className="space-y-3" aria-label="Escolha o período">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-semibold text-slate-600">Período:</span>
                <Pilula ativo={anoAtivo === null} onClick={() => { setAno(null); setMes(0); setMostrar(POR_PAGINA); }}>Tudo</Pilula>
                {anos.map((a) => <Pilula key={a} ativo={anoAtivo === a} onClick={() => { setAno(a); setMes(0); setMostrar(POR_PAGINA); }}>{a}</Pilula>)}
                {anoAtivo !== null && (
                  <select value={mes} onChange={(e) => { setMes(Number(e.target.value)); setMostrar(POR_PAGINA); }} aria-label="Mês"
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
                    <option value={0}>Todos os meses</option>
                    {NOMES_MES.map((n, i) => <option key={n} value={i + 1}>{n[0].toUpperCase() + n.slice(1)}</option>)}
                  </select>
                )}
              </div>
            </div>

            <CartoesResumo r={r} rotuloPeriodo={rotuloPeriodo} />

            <div className="grid gap-6 lg:grid-cols-2">
              <Cartao titulo="Mês a mês" subtitulo="O que entrou e o que saiu em cada mês"><GraficoMeses pontos={meses} mesSelecionado={mesSelecionado}
                onMes={(m) => { const a = Number(m.slice(0, 4)); setAno(a); setMes(Number(m.slice(5, 7))); setMostrar(POR_PAGINA); }} /></Cartao>
              <Cartao titulo="Saldo ao longo do tempo" subtitulo="Quanto dinheiro sobrava no fim de cada mês"><GraficoSaldo pontos={meses} /></Cartao>
              <Cartao titulo="Para onde foi o dinheiro" subtitulo={`Gastos por tipo — ${rotuloPeriodo}`}><BarrasCategoria fatias={destino} cor={COR_SAIDA} vazio="Nenhum gasto registrado neste período." /></Cartao>
              <Cartao titulo="De onde veio o dinheiro" subtitulo={`Entradas por origem — ${rotuloPeriodo}`}><BarrasCategoria fatias={origem} cor={COR_ENTRADA} vazio="Nenhuma entrada registrada neste período." /></Cartao>
            </div>

            <section aria-labelledby="comprovantes">
              <h2 id="comprovantes" className="font-titulo text-3xl font-extrabold text-slate-900">{t('pc.lista_titulo')}</h2>
              <p className="mb-4 mt-1 text-slate-600">{t('pc.lista_intro')}</p>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Pilula ativo={tipo === 'todos'} onClick={() => { setTipo('todos'); setMostrar(POR_PAGINA); }}>Tudo</Pilula>
                <Pilula ativo={tipo === 'entrada'} onClick={() => { setTipo('entrada'); setMostrar(POR_PAGINA); }}>Entradas</Pilula>
                <Pilula ativo={tipo === 'saida'} onClick={() => { setTipo('saida'); setMostrar(POR_PAGINA); }}>Gastos</Pilula>
                <label className="ml-auto flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={soComFoto} onChange={(e) => { setSoComFoto(e.target.checked); setMostrar(POR_PAGINA); }} />Só com comprovante</label>
              </div>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(POR_PAGINA); }} placeholder="Buscar (ex.: lanche, bolas, PIX)…" aria-label="Buscar"
                  className="w-full rounded-full border-2 border-slate-200 bg-white py-3 pl-12 pr-4 focus:border-sol-400 focus:outline-none" />
              </div>

              {!lista.length ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">Nenhum registro encontrado com estes filtros.</p> : (
                <ul className="space-y-3">
                  {lista.slice(0, mostrar).map((l) => {
                    const its = itens(l);
                    return (
                      <li key={l.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100" data-teste="lancamento">
                        <span className="w-1.5 shrink-0 rounded-full" style={{ background: l.tipo === 'entrada' ? COR_ENTRADA : COR_SAIDA }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span>{fmtData(l.data)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{l.categoria}</span>
                            <span className="font-semibold" style={{ color: l.tipo === 'entrada' ? '#1d4ed8' : '#c2410c' }}>{l.tipo === 'entrada' ? 'Entrada' : 'Gasto'}</span>
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{l.descricao}</p>
                          {l.contraparte && <p className="text-sm text-slate-500">{l.tipo === 'entrada' ? 'De' : 'Para'}: {l.contraparte}</p>}
                          {its.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">{its.map((it, i) => <Miniatura key={i} item={it} onClick={() => lightbox.abrir(its, i)} />)}</div>
                          ) : <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Paperclip className="h-3 w-3" />Sem comprovante público</p>}
                        </div>
                        <p className="shrink-0 whitespace-nowrap text-right font-titulo text-lg font-bold tabular-nums" style={{ color: l.tipo === 'entrada' ? '#1d4ed8' : '#c2410c' }}>
                          {l.tipo === 'entrada' ? '+' : '−'} {dinheiro(l.valor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {lista.length > mostrar && (
                <div className="mt-5 text-center"><button onClick={() => setMostrar(mostrar + POR_PAGINA)} className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800">Mostrar mais ({lista.length - mostrar} restantes)</button></div>
              )}
            </section>

            <aside className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 ring-1 ring-slate-100">
              {t('pc.nota') && <p>{t('pc.nota')}</p>}
              {atualizado && <p className="mt-2">Última atualização: {dataHora(atualizado)}.</p>}
              <p className="mt-2">Ficou com alguma dúvida? <Link to="/contato" className="font-semibold underline">Fale com a gente</Link>.</p>
            </aside>

            <div className="text-center">
              <Link to="/doe" className="inline-flex items-center gap-2 rounded-full bg-marca-rosa px-8 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 hover:brightness-110"><Heart className="h-5 w-5 fill-white" />{t('pc.botao_ajudar')}</Link>
            </div>
          </>
        )}
      </div>
      {lightbox.elemento}
    </>
  );
}
