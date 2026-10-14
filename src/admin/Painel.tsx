import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro } from '../lib/sessao';
import { data as fmtData, dinheiro, inicioFimMes, mesAno, num, pct, somar } from '../lib/formato';
import { rotuloStatus } from '../lib/rotulos';
import { Aviso, Cartao, Carregando, Indicador, Selo, TituloPagina, Vazio } from '../components/ui';
import { CATEGORICAS, Dica, Legenda, SERIE, agruparCategorias, eixo, grade, moedaCurta } from './graficos';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Resumo = Record<string, any>;

export default function Painel() {
  const { filtro } = useFiltro();
  const nav = useNavigate();
  const [r, setR] = useState<Resumo | null>(null);
  const [serie, setSerie] = useState<{ mes: string; receitas: number; despesas: number; saldo_final: number }[]>([]);
  const [anterior, setAnterior] = useState<{ mes: string; despesas: number }[]>([]);
  const [cats, setCats] = useState<{ categoria_id: string | null; categoria: string; valor: number }[]>([]);
  const [orc, setOrc] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const p = { p_inicio: filtro.inicio, p_fim: filtro.fim, p_fonte: filtro.fonteId };
    const desloc = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
    setR(null); setErro(null);
    Promise.all([
      supabase.rpc('dashboard_resumo', p),
      supabase.rpc('serie_mensal', p),
      supabase.rpc('despesas_por_categoria', p),
      (() => { let q = supabase.from('v_execucao_orcamentaria').select('*').lte('validade_inicio', filtro.fim).gte('validade_fim', filtro.inicio); if (filtro.fonteId) q = q.eq('fonte_id', filtro.fonteId); return q; })(),
      supabase.from('v_alertas').select('*').order('gravidade').limit(8),
      supabase.rpc('serie_mensal', { ...p, p_inicio: desloc(filtro.inicio), p_fim: desloc(filtro.fim).replace('-02-29', '-02-28') }),
    ]).then(([a, b, c, d, e, f]) => {
      const err = [a, b, c, d, e, f].find((x) => x.error)?.error;
      if (err) { setErro(mensagemErro(err)); return; }
      setR(a.data); setSerie(b.data || []); setCats(c.data || []); setOrc(d.data || []); setAlertas(e.data || []); setAnterior(f.data || []);
    });
  }, [filtro]);

  if (erro) return <Aviso tom="erro" titulo="Não foi possível carregar o painel">{erro}</Aviso>;
  if (!r) return <Carregando />;

  const irMov = (extra: Record<string, string>) => nav(`/admin/movimentacoes?${new URLSearchParams({ inicio: filtro.inicio, fim: filtro.fim, ...extra })}`);
  const doc = r.documentacao ?? {};
  const situacoes = Object.entries(doc.por_situacao ?? {}).map(([k, v]) => ({ k, rotulo: rotuloStatus(k), n: Number(v) }));
  const corSituacao: Record<string, string> = { validada: '#008300', aguardando_conferencia: '#2a78d6', incompleta: '#eda100', sem_documentos: '#e34948', rejeitada: '#6250d6' };
  const catsCor = agruparCategorias(cats.map((c) => ({ ...c, valor: Number(c.valor) })));
  const totalCats = somar(cats.map((c) => c.valor));
  const comparacao = serie.map((s, i) => ({ mes: s.mes, atual: Number(s.despesas), anterior: Number(anterior[i]?.despesas ?? 0) }));
  const orcPorCat = orc.map((o) => ({ categoria: `${o.categoria}${filtro.fonteId ? '' : ` · ${o.fonte}`}`, aprovado: Number(o.valor_atualizado), executado: Number(o.executado), comprometido: Number(o.comprometido), pct: o.percentual_executado }));

  return (
    <div className="space-y-6">
      <TituloPagina titulo="Painel financeiro" descricao={`${filtro.rotulo}: ${fmtData(filtro.inicio)} a ${fmtData(filtro.fim)} — valores calculados a partir dos lançamentos registrados.`} />

      <section aria-labelledby="saldos">
        <h2 id="saldos" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saldos</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Saldo inicial do período" valor={dinheiro(r.saldo_inicial)} detalhe="Saldo contábil no dia anterior ao início" />
          <Indicador rotulo="Saldo contábil (final)" valor={dinheiro(r.saldo_contabil)} detalhe="Inicial + receitas recebidas − pagamentos" tom="info" />
          <Indicador rotulo="Saldo financeiro disponível" valor={dinheiro(r.saldo_disponivel)} detalhe="Saldo contábil − compromissos não pagos" tom={Number(r.saldo_disponivel) < 0 ? 'erro' : 'ok'} />
          <Indicador rotulo="Saldo bancário conciliado" valor={r.saldo_bancario_conciliado === null ? '—' : dinheiro(r.saldo_bancario_conciliado)}
            detalhe={r.data_conciliacao ? `Último extrato conciliado: ${fmtData(r.data_conciliacao)}` : 'Nenhuma conciliação concluída'} tom={r.saldo_bancario_conciliado === null ? 'atencao' : 'neutro'} onClick={() => nav('/admin/conciliacao')} />
        </div>
      </section>

      <section aria-labelledby="movimento">
        <h2 id="movimento" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Movimento do período</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Receitas recebidas" valor={dinheiro(r.receitas_recebidas)} tom="ok" onClick={() => irMov({ tipo: 'receita', situacao: 'recebida' })} />
          <Indicador rotulo="Despesas pagas" valor={dinheiro(r.despesas_pagas)} detalhe="Soma dos pagamentos não estornados" tom="erro" onClick={() => irMov({ tipo: 'despesa' })} />
          <Indicador rotulo="Despesas lançadas e não pagas" valor={dinheiro(r.despesas_a_pagar)} detalhe="Lançadas/aprovadas com saldo devedor" tom="atencao" onClick={() => nav('/admin/despesas?pagamento=pendente')} />
          <Indicador rotulo="Receitas previstas a receber" valor={dinheiro(r.receitas_a_receber)} detalhe={Number(r.receitas_atrasadas) > 0 ? `${dinheiro(r.receitas_atrasadas)} em atraso` : 'Não somadas ao caixa'} tom={Number(r.receitas_atrasadas) > 0 ? 'erro' : 'info'} onClick={() => nav('/admin/receitas?status=prevista')} />
          <Indicador rotulo="Recursos comprometidos" valor={dinheiro(r.compromissos)} detalhe="Contratados + lançados + aprovados, ainda não pagos" tom="atencao" />
          <Indicador rotulo="Orçamento executado" valor={r.orcamento?.percentual === null ? '—' : pct(r.orcamento?.percentual)} detalhe={`${dinheiro(r.orcamento?.executado)} de ${dinheiro(r.orcamento?.atualizado)} aprovado/atualizado`} tom="info" onClick={() => nav('/admin/orcamento')} />
          <Indicador rotulo="Despesas com comprovantes" valor={dinheiro(doc.com_comprovantes_valor)} detalhe={`${num(doc.com_comprovantes_qtd)} despesa(s) com documentação completa`} tom="ok" onClick={() => nav('/admin/despesas?doc=completa')} />
          <Indicador rotulo="Despesas c/ documentos pendentes" valor={dinheiro(doc.pendentes_valor)} detalhe={`${num(doc.pendentes_qtd)} despesa(s)`} tom={Number(doc.pendentes_qtd) > 0 ? 'erro' : 'ok'} onClick={() => nav('/admin/despesas?doc=pendente')} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Lançamentos pendentes de conferência" valor={num(r.pendentes_conferencia)} tom={Number(r.pendentes_conferencia) > 0 ? 'atencao' : 'ok'} onClick={() => irMov({ conferencia: 'pendente' })} />
          {(r.saldos_vinculados as any[]).map((v) => (
            <Indicador key={v.fonte_id} rotulo={`Saldo vinculado — ${v.fonte}`} valor={dinheiro(v.saldo)} detalhe="Recurso vinculado: não se mistura com outras fontes" tom="roxo" />
          ))}
          {Number(r.doacoes_bens_estimado) > 0 && <Indicador rotulo="Doações em bens (estimado)" valor={dinheiro(r.doacoes_bens_estimado)} detalhe="Controle patrimonial — não entra no caixa" onClick={() => nav('/admin/doacoes-bens')} />}
        </div>
      </section>

      {alertas.length > 0 && (
        <Cartao titulo={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Alertas para revisão</span>} acoes={<Link to="/admin/alertas" className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:underline">Ver todos <ArrowRight className="h-4 w-4" /></Link>}>
          <ul className="divide-y divide-slate-100 text-sm">
            {alertas.map((a, i) => (
              <li key={i} className="flex items-start gap-2 py-2"><Selo status={a.gravidade} /><span className="flex-1 text-slate-700">{a.mensagem}</span>{a.codigo && <span className="text-xs text-slate-500">{a.codigo}</span>}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Alertas indicam pontos para revisão humana; não representam declaração de irregularidade.</p>
        </Cartao>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Cartao titulo="Receitas x despesas por mês">
          <Legenda itens={[{ cor: SERIE.receitas, rotulo: 'Receitas recebidas' }, { cor: SERIE.despesas, rotulo: 'Despesas pagas' }]} />
          {serie.every((s) => !Number(s.receitas) && !Number(s.despesas)) ? <Vazio>Sem movimentação no período.</Vazio> : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={serie.map((s) => ({ ...s, receitas: Number(s.receitas), despesas: Number(s.despesas) }))} barGap={2}
                  onClick={(e: any) => { if (e?.activeLabel) { const [a, b] = inicioFimMes(e.activeLabel); nav(`/admin/movimentacoes?inicio=${a}&fim=${b}`); } }}>
                  <CartesianGrid vertical={false} {...grade} />
                  <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moedaCurta} tick={eixo} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<Dica rotulo={mesAno} />} cursor={{ fill: '#f1f0ec' }} />
                  <Bar dataKey="receitas" name="Receitas" fill={SERIE.receitas} radius={[4, 4, 0, 0]} maxBarSize={28} className="cursor-pointer" />
                  <Bar dataKey="despesas" name="Despesas" fill={SERIE.despesas} radius={[4, 4, 0, 0]} maxBarSize={28} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Clique em um mês para ver os lançamentos.</p>
        </Cartao>

        <Cartao titulo="Despesas pagas por categoria">
          {!catsCor.length ? <Vazio>Nenhum pagamento no período.</Vazio> : (
            <div className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={catsCor} dataKey="valor" nameKey="categoria" innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="#fff" strokeWidth={2}
                      onClick={(d: any) => d?.categoria_id && irMov({ tipo: 'despesa', categoria: d.categoria_id })} className="cursor-pointer">
                      {catsCor.map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                    <Tooltip content={<Dica />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-sm">
                {catsCor.map((c, i) => (
                  <li key={i}>
                    <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-50" onClick={() => c.categoria_id && irMov({ tipo: 'despesa', categoria: c.categoria_id })}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.cor }} />
                      <span className="flex-1 truncate text-slate-700">{c.categoria}</span>
                      <span className="tabular-nums text-slate-900">{dinheiro(c.valor)}</span>
                      <span className="w-12 text-right text-xs tabular-nums text-slate-500">{pct((c.valor / (totalCats || 1)) * 100)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Evolução do saldo contábil">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={serie.map((s) => ({ ...s, saldo_final: Number(s.saldo_final) }))}>
                <CartesianGrid vertical={false} {...grade} />
                <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={moedaCurta} tick={eixo} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={({ active, payload, label }: any) => active && payload?.length ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-semibold">{mesAno(label)}</p>
                    <p>Entradas: {dinheiro(payload[0].payload.receitas)}</p>
                    <p>Saídas: {dinheiro(payload[0].payload.despesas)}</p>
                    <p className="font-semibold">Saldo final: {dinheiro(payload[0].payload.saldo_final)}</p>
                  </div>) : null} />
                <Line type="monotone" dataKey="saldo_final" name="Saldo final" stroke={SERIE.saldo} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-slate-500">Saldo inicial do período: {dinheiro(r.saldo_inicial)} · Saldo final: {dinheiro(r.saldo_contabil)}</p>
        </Cartao>

        <Cartao titulo="Orçamento atualizado x executado" acoes={<Link to="/admin/orcamento" className="text-sm text-slate-600 hover:underline">Detalhar</Link>}>
          {!orcPorCat.length ? <Vazio>Nenhum orçamento cadastrado para o período. <Link to="/admin/orcamento" className="underline">Cadastrar orçamento</Link>.</Vazio> : (
            <>
              <Legenda itens={[{ cor: SERIE.aprovado, rotulo: 'Orçamento atualizado' }, { cor: SERIE.executado, rotulo: 'Executado (pago)' }, { cor: SERIE.comprometido, rotulo: 'Comprometido' }]} />
              <div style={{ height: Math.max(180, orcPorCat.length * 46) }}>
                <ResponsiveContainer>
                  <BarChart data={orcPorCat} layout="vertical" barGap={2} margin={{ left: 10 }}>
                    <CartesianGrid horizontal={false} {...grade} />
                    <XAxis type="number" tickFormatter={moedaCurta} tick={eixo} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="categoria" tick={eixo} width={150} axisLine={false} tickLine={false} />
                    <Tooltip content={<Dica />} cursor={{ fill: '#f1f0ec' }} />
                    <Bar dataKey="aprovado" name="Atualizado" fill={SERIE.aprovado} radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="executado" name="Executado" stackId="e" fill={SERIE.executado} maxBarSize={12} />
                    <Bar dataKey="comprometido" name="Comprometido" stackId="e" fill={SERIE.comprometido} radius={[0, 4, 4, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Cartao>

        <Cartao titulo="Situação dos comprovantes das despesas">
          {!situacoes.length ? <Vazio>Nenhuma despesa lançada no período.</Vazio> : (
            <div className="space-y-2">
              {situacoes.map((s) => {
                const tot = situacoes.reduce((a, x) => a + x.n, 0);
                return (
                  <button key={s.k} onClick={() => nav(`/admin/despesas?doc=${s.k}`)} className="block w-full rounded p-1 text-left hover:bg-slate-50">
                    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-700">{s.rotulo}</span><span className="tabular-nums text-slate-900">{s.n} ({pct((s.n / tot) * 100)})</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(s.n / tot) * 100}%`, background: corSituacao[s.k] ?? CATEGORICAS[0] }} /></div>
                  </button>
                );
              })}
            </div>
          )}
        </Cartao>

        <Cartao titulo="Despesas pagas ao longo do tempo — comparação com o ano anterior">
          <Legenda itens={[{ cor: SERIE.despesas, rotulo: 'Período selecionado' }, { cor: '#9a9890', rotulo: 'Mesmo período do ano anterior' }]} />
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={comparacao}>
                <CartesianGrid vertical={false} {...grade} />
                <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={moedaCurta} tick={eixo} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<Dica rotulo={mesAno} />} />
                <Line type="monotone" dataKey="atual" name="Período selecionado" stroke={SERIE.despesas} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                <Line type="monotone" dataKey="anterior" name="Ano anterior" stroke="#9a9890" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
