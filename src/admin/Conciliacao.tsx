import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, FileUp, Lock, Plus, Unlock, X } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { data as fmtData, dataHora, diasEntre, dinheiro, somar } from '../lib/formato';
import { diferencaExtrato, lerCSV, lerOFX, sugerirCorrespondencias, type Candidato, type LinhaExtrato } from '../lib/extrato';
import { Aviso, Botao, Cartao, Carregando, CampoDinheiro, Indicador, Modal, Rotulo, Selecao, Selo, Texto, TituloPagina, Vazio, cx, useAviso, useConfirmacao } from '../components/ui';
import { Tabela, type Coluna } from '../components/Tabela';
import { useOpcoes } from '../components/Formulario';

/* eslint-disable @typescript-eslint/no-explicit-any */

function Importar({ aberto, onFechar, onImportado }: { aberto: boolean; onFechar: () => void; onImportado: (id: string) => void }) {
  const avisar = useAviso();
  const contas = useOpcoes({ tabela: 'contas_resumo', rotulo: 'nome', filtro: { ativo: true } });
  const [conta, setConta] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [linhas, setLinhas] = useState<LinhaExtrato[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [ini, setIni] = useState(''); const [fim, setFim] = useState('');
  const [saldoIni, setSaldoIni] = useState(''); const [saldoFim, setSaldoFim] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) { setLinhas([]); setAvisos([]); setArquivo(''); setSaldoIni(''); setSaldoFim(''); } }, [aberto]);

  async function ler(f: File | undefined) {
    if (!f) return;
    const texto = await f.text();
    const r = /<OFX>|OFXHEADER/i.test(texto) ? lerOFX(texto) : lerCSV(texto);
    setArquivo(f.name); setLinhas(r.linhas); setAvisos(r.avisos);
    setIni(r.dataInicio ?? ''); setFim(r.dataFim ?? '');
    if (r.saldoFinal) setSaldoFim(r.saldoFinal);
  }
  const dif = saldoIni && saldoFim ? diferencaExtrato(saldoIni, saldoFim, linhas) : null;

  async function salvar() {
    setSalvando(true);
    try {
      const { data: ex, error } = await supabase.from('extratos').insert({ conta_id: conta, data_inicio: ini, data_fim: fim, saldo_inicial: saldoIni, saldo_final: saldoFim, arquivo_nome: arquivo }).select('id').single();
      if (error) throw error;
      for (let i = 0; i < linhas.length; i += 500) {
        const { error: e2 } = await supabase.from('extrato_linhas').insert(linhas.slice(i, i + 500).map((l) => ({ ...l, extrato_id: ex.id })));
        if (e2) throw e2;
      }
      avisar('ok', `Extrato importado com ${linhas.length} movimentação(ões).`);
      onImportado(ex.id); onFechar();
    } catch (e) { avisar('erro', mensagemErro(e)); } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo="Importar extrato bancário" onFechar={onFechar} largura="max-w-3xl"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar} carregando={salvando} disabled={!conta || !linhas.length || !ini || !fim || saldoIni === '' || saldoFim === ''}>Importar</Botao></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo texto="Conta bancária" obrigatorio><Selecao opcoes={contas} value={conta} onChange={(e) => setConta(e.target.value)} /></Rotulo>
          <Rotulo texto="Arquivo do extrato (CSV ou OFX)" obrigatorio ajuda="Exporte pelo internet banking. OFX é o formato mais confiável.">
            <input type="file" accept=".csv,.ofx,.txt" onChange={(e) => ler(e.target.files?.[0])} className="block w-full text-sm" />
          </Rotulo>
          <Rotulo texto="Data inicial do extrato" obrigatorio><Texto type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></Rotulo>
          <Rotulo texto="Data final do extrato" obrigatorio><Texto type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Rotulo>
          <Rotulo texto="Saldo inicial (conforme extrato)" obrigatorio><CampoDinheiro valor={saldoIni} onChange={setSaldoIni} /></Rotulo>
          <Rotulo texto="Saldo final (conforme extrato)" obrigatorio><CampoDinheiro valor={saldoFim} onChange={setSaldoFim} /></Rotulo>
        </div>
        {avisos.length > 0 && <Aviso tom="atencao" titulo="Avisos da leitura">{avisos.slice(0, 8).map((a) => <p key={a}>{a}</p>)}{avisos.length > 8 && <p>… e mais {avisos.length - 8}.</p>}</Aviso>}
        {linhas.length > 0 && (
          <>
            <p className="text-sm text-slate-600">{linhas.length} movimentações lidas · créditos {dinheiro(somar(linhas.filter((l) => Number(l.valor) > 0).map((l) => l.valor)))} · débitos {dinheiro(somar(linhas.filter((l) => Number(l.valor) < 0).map((l) => l.valor)))}</p>
            {dif !== null && (dif === 0
              ? <Aviso tom="ok">Saldo inicial + movimentações = saldo final. O arquivo está consistente.</Aviso>
              : <Aviso tom="erro" titulo="O extrato não fecha">Diferença de {dinheiro(dif)} entre o saldo final informado e a soma das movimentações. Confira os saldos ou se faltam linhas no arquivo. A importação é permitida, mas a diferença ficará sinalizada.</Aviso>)}
            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 text-xs">
              <table className="w-full"><tbody className="divide-y divide-slate-100">
                {linhas.slice(0, 100).map((l, i) => <tr key={i}><td className="px-2 py-1">{fmtData(l.data)}</td><td className="px-2 py-1">{l.descricao}</td><td className={cx('px-2 py-1 text-right tabular-nums', Number(l.valor) < 0 ? 'text-red-700' : 'text-emerald-700')}>{dinheiro(l.valor)}</td></tr>)}
              </tbody></table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Ajuste({ linha, extrato, onFechar, onFeito }: { linha: any; extrato: any; onFechar: () => void; onFeito: () => void }) {
  const avisar = useAviso();
  const fontes = useOpcoes({ tabela: 'fontes_recurso', rotulo: 'nome', filtro: { ativo: true } });
  const [tipo, setTipo] = useState<string>(Number(linha?.valor) > 0 ? 'rendimento' : 'tarifa');
  const [obs, setObs] = useState('');
  const [fonte, setFonte] = useState('');
  const [criar, setCriar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (linha) { setTipo(Number(linha.valor) > 0 ? 'rendimento' : 'tarifa'); setObs(''); setCriar(true); } }, [linha]);
  if (!linha) return null;
  const podeCriar = (tipo === 'rendimento' && Number(linha.valor) > 0) || (tipo === 'tarifa' && Number(linha.valor) < 0);

  async function salvar() {
    setSalvando(true);
    try {
      if (criar && podeCriar) {
        const nomeCat = tipo === 'rendimento' ? 'Rendimentos financeiros' : 'Taxas bancárias';
        const { data: cat } = await supabase.from('categorias').select('id').eq('nome', nomeCat).maybeSingle();
        if (!cat) throw new Error(`Categoria "${nomeCat}" não encontrada. Cadastre-a em Cadastros.`);
        if (tipo === 'rendimento') {
          const { data: r, error } = await supabase.from('receitas').insert({ status: 'recebida', data_recebimento: linha.data, categoria_id: cat.id, descricao: `Rendimento financeiro — ${linha.descricao}`, valor_recebido: linha.valor, conta_id: extrato.conta_id, fonte_id: fonte, forma_recebimento: 'Crédito em conta', referencia_bancaria: linha.documento || linha.fitid, origem: 'Extrato bancário' }).select('id').single();
          if (error) throw error;
          const { error: e2 } = await supabase.from('extrato_linhas').update({ status: 'conciliado', receita_id: r.id, tipo_ajuste: 'rendimento', observacao: obs || null }).eq('id', linha.id);
          if (e2) throw e2;
        } else {
          let { data: forn } = await supabase.from('fornecedores').select('id').eq('nome', `${extrato.contas_resumo?.nome ?? 'Banco'} (tarifas bancárias)`).maybeSingle();
          if (!forn) {
            const n = await supabase.from('fornecedores').insert({ nome: `${extrato.contas_resumo?.nome ?? 'Banco'} (tarifas bancárias)`, observacoes: 'Criado automaticamente pela conciliação' }).select('id').single();
            if (n.error) throw n.error;
            forn = n.data;
          }
          const valor = Math.abs(Number(linha.valor)).toFixed(2);
          const { data: d, error } = await supabase.from('despesas').insert({ status: 'aprovada', data_compra: linha.data, fornecedor_id: forn!.id, descricao: `Tarifa bancária — ${linha.descricao}`, categoria_id: cat.id, valor_total: valor, fonte_id: fonte, conta_id: extrato.conta_id, forma_pagamento: 'Débito automático', justificativa: 'Tarifa debitada pelo banco conforme extrato.', referencia_transacao: linha.documento || linha.fitid }).select('id').single();
          if (error) throw error;
          const { data: p, error: e2 } = await supabase.from('pagamentos').insert({ despesa_id: d.id, data_pagamento: linha.data, valor, forma_pagamento: 'Débito automático', conta_id: extrato.conta_id, referencia: linha.documento || linha.fitid }).select('id').single();
          if (e2) throw e2;
          const { error: e3 } = await supabase.from('extrato_linhas').update({ status: 'conciliado', pagamento_id: p.id, tipo_ajuste: 'tarifa', observacao: obs || null }).eq('id', linha.id);
          if (e3) throw e3;
        }
      } else {
        const { error } = await supabase.from('extrato_linhas').update({ status: 'ignorado', tipo_ajuste: tipo, observacao: obs }).eq('id', linha.id);
        if (error) throw error;
      }
      avisar('ok', 'Linha tratada.'); onFeito(); onFechar();
    } catch (e) { avisar('erro', mensagemErro(e)); } finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Registrar ajuste da linha do extrato" onFechar={onFechar} largura="max-w-lg"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar} carregando={salvando} disabled={(criar && podeCriar) ? !fonte : obs.trim().length < 5}>Salvar</Botao></>}>
      <div className="space-y-3 text-sm">
        <p className="rounded bg-slate-50 p-2">{fmtData(linha.data)} · {linha.descricao} · <strong>{dinheiro(linha.valor)}</strong></p>
        <Rotulo texto="Tipo de ajuste"><Selecao vazio={false} opcoes={[{ valor: 'tarifa', rotulo: 'Tarifa bancária' }, { valor: 'rendimento', rotulo: 'Rendimento' }, { valor: 'estorno', rotulo: 'Estorno' }, { valor: 'ajuste', rotulo: 'Outro ajuste' }]} value={tipo} onChange={(e) => setTipo(e.target.value)} /></Rotulo>
        {podeCriar && (
          <label className="flex items-start gap-2"><input type="checkbox" checked={criar} onChange={(e) => setCriar(e.target.checked)} className="mt-1" />
            <span>Criar o lançamento correspondente ({tipo === 'rendimento' ? 'receita de rendimento' : 'despesa de tarifa com pagamento'}) e conciliar automaticamente esta linha</span></label>
        )}
        {criar && podeCriar && <Rotulo texto="Fonte de recurso" obrigatorio><Selecao opcoes={fontes} value={fonte} onChange={(e) => setFonte(e.target.value)} /></Rotulo>}
        <Rotulo texto={criar && podeCriar ? 'Observação' : 'Justificativa (sem lançamento correspondente)'} obrigatorio={!(criar && podeCriar)}>
          <Texto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: tarifa será contestada junto ao banco" />
        </Rotulo>
      </div>
    </Modal>
  );
}

function Detalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [ex, setEx] = useState<any>(null);
  const [linhas, setLinhas] = useState<any[]>([]);
  const [cands, setCands] = useState<Candidato[]>([]);
  const [semExtrato, setSemExtrato] = useState<Candidato[]>([]);
  const [saldoSistema, setSaldoSistema] = useState<number | null>(null);
  const [ajustando, setAjustando] = useState<any>(null);
  const [manual, setManual] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const { data: e } = await supabase.from('extratos').select('*, contas_resumo(nome), realizado:perfis!extratos_realizado_por_fkey(nome), conferido:perfis!extratos_conferido_por_fkey(nome)').eq('id', id).single();
    if (!e) return;
    setEx(e);
    const { data: ls } = await supabase.from('extrato_linhas').select('*').eq('extrato_id', id).order('data').order('valor');
    setLinhas(ls || []);
    const de = new Date(Date.parse(e.data_inicio) - 7 * 864e5).toISOString().slice(0, 10);
    const ate = new Date(Date.parse(e.data_fim) + 7 * 864e5).toISOString().slice(0, 10);
    const [pg, rc, usadosP, usadosR, saldos] = await Promise.all([
      supabase.from('pagamentos').select('id, codigo, data_pagamento, valor, despesas(descricao)').eq('conta_id', e.conta_id).eq('estornado', false).gte('data_pagamento', de).lte('data_pagamento', ate),
      supabase.from('receitas').select('id, codigo, data_recebimento, valor_recebido, descricao').eq('conta_id', e.conta_id).eq('status', 'recebida').gte('data_recebimento', de).lte('data_recebimento', ate),
      supabase.from('extrato_linhas').select('pagamento_id').not('pagamento_id', 'is', null),
      supabase.from('extrato_linhas').select('receita_id').not('receita_id', 'is', null),
      supabase.rpc('saldos_contas', { p_data: e.data_fim }),
    ]);
    const up = new Set((usadosP.data || []).map((x: any) => x.pagamento_id));
    const ur = new Set((usadosR.data || []).map((x: any) => x.receita_id));
    const todos: (Candidato & { usado: boolean })[] = [
      ...(pg.data || []).map((p: any) => ({ id: p.id, tipo: 'pagamento' as const, data: p.data_pagamento, valor: -Number(p.valor), descricao: `${p.codigo} · ${p.despesas?.descricao ?? ''}`, usado: up.has(p.id) })),
      ...(rc.data || []).map((r: any) => ({ id: r.id, tipo: 'receita' as const, data: r.data_recebimento, valor: Number(r.valor_recebido), descricao: `${r.codigo} · ${r.descricao}`, usado: ur.has(r.id) })),
    ];
    setCands(todos.filter((c) => !c.usado));
    setSemExtrato(todos.filter((c) => !c.usado && c.data >= e.data_inicio && c.data <= e.data_fim));
    const s = (saldos.data || []).find((x: any) => x.conta_id === e.conta_id);
    setSaldoSistema(s ? Number(s.saldo_contabil) : null);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = linhas.filter((l) => l.status === 'pendente');
  const sugestoes = useMemo(() => {
    const s = sugerirCorrespondencias(pendentes, cands);
    return Object.fromEntries(s.map((x) => [pendentes[x.linhaIndice].id, x]));
  }, [pendentes, cands]);

  async function conciliar(linha: any, c: Candidato) {
    const { error } = await supabase.from('extrato_linhas').update({ status: 'conciliado', [c.tipo === 'pagamento' ? 'pagamento_id' : 'receita_id']: c.id }).eq('id', linha.id);
    if (error) return avisar('erro', mensagemErro(error));
    carregar();
  }
  async function desfazer(linha: any) {
    const { error } = await supabase.from('extrato_linhas').update({ status: 'pendente', observacao: null, tipo_ajuste: null }).eq('id', linha.id);
    if (error) return avisar('erro', mensagemErro(error));
    carregar();
  }
  async function concluir() {
    const ok = await confirmar({ titulo: 'Concluir conciliação', texto: 'Após concluída, a conciliação fica bloqueada para alterações (somente o administrador pode reabrir). Quem concluir, se diferente de quem importou, fica registrado como conferente.' });
    if (!ok) return;
    const { error } = await supabase.rpc('concluir_conciliacao', { p_extrato: id });
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Conciliação concluída.'); carregar();
  }
  async function reabrir() {
    const { error } = await supabase.rpc('reabrir_conciliacao', { p_extrato: id });
    if (error) return avisar('erro', mensagemErro(error));
    carregar();
  }

  if (!ex) return <Carregando />;
  const difArquivo = diferencaExtrato(ex.saldo_inicial, ex.saldo_final, linhas);
  const difSistema = saldoSistema === null ? null : Math.round((Number(ex.saldo_final) - saldoSistema) * 100) / 100;
  const editavel = ex.status === 'em_andamento' && pode('admin', 'financeiro');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="fantasma" icone={<ArrowLeft className="h-4 w-4" />} onClick={onVoltar}>Voltar</Botao>
        <h1 className="text-lg font-semibold">{ex.contas_resumo?.nome} · {fmtData(ex.data_inicio)} a {fmtData(ex.data_fim)}</h1>
        <Selo status={ex.status} />
        <div className="ml-auto flex gap-2">
          {ex.status === 'em_andamento' && pode('admin', 'financeiro', 'conferente') && <Botao icone={<Lock className="h-4 w-4" />} onClick={concluir} disabled={pendentes.length > 0}>Concluir conciliação</Botao>}
          {ex.status === 'concluida' && pode('admin') && <Botao variante="secundario" icone={<Unlock className="h-4 w-4" />} onClick={reabrir}>Reabrir</Botao>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Saldo final do extrato" valor={dinheiro(ex.saldo_final)} detalhe={`Inicial: ${dinheiro(ex.saldo_inicial)}`} />
        <Indicador rotulo="Saldo no sistema na mesma data" valor={saldoSistema === null ? '—' : dinheiro(saldoSistema)} tom="info" />
        <Indicador rotulo="Diferença extrato x sistema" valor={difSistema === null ? '—' : dinheiro(difSistema)} tom={difSistema === 0 ? 'ok' : 'erro'} detalhe={difSistema ? 'Ainda não explicada: verifique linhas pendentes e lançamentos sem extrato' : 'Saldos coincidem'} />
        <Indicador rotulo="Linhas pendentes" valor={pendentes.length} tom={pendentes.length ? 'atencao' : 'ok'} detalhe={`${linhas.length} linhas no extrato`} />
      </div>
      {difArquivo !== 0 && <Aviso tom="erro" titulo="O arquivo do extrato não fecha">Saldo inicial + movimentos difere do saldo final em {dinheiro(difArquivo)}.</Aviso>}
      <p className="text-xs text-slate-500">Importado por {ex.realizado?.nome ?? '—'} em {dataHora(ex.criado_em)}{ex.conferido ? ` · Conferido por ${ex.conferido.nome} em ${dataHora(ex.conferido_em)}` : ''}</p>

      <Cartao titulo="Movimentações do extrato" semPadding>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Correspondência</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l) => {
                const s = sugestoes[l.id];
                const opcoesManuais = cands.filter((c) => Math.round(c.valor * 100) === Math.round(Number(l.valor) * 100));
                return (
                  <tr key={l.id} className={l.status === 'pendente' ? 'bg-amber-50/50' : ''}>
                    <td className="whitespace-nowrap px-3 py-2">{fmtData(l.data)}</td>
                    <td className="px-3 py-2">{l.descricao}{l.documento && <span className="block text-xs text-slate-500">Doc. {l.documento}</span>}</td>
                    <td className={cx('whitespace-nowrap px-3 py-2 text-right tabular-nums', Number(l.valor) < 0 ? 'text-red-700' : 'text-emerald-700')}>{dinheiro(l.valor)}</td>
                    <td className="px-3 py-2"><Selo status={l.status} />{l.tipo_ajuste && <span className="ml-1 text-xs text-slate-500">{l.tipo_ajuste}</span>}</td>
                    <td className="px-3 py-2">
                      {l.status !== 'pendente' ? (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span>{l.observacao ?? (l.pagamento_id ? 'Pagamento vinculado' : 'Receita vinculada')}</span>
                          {editavel && <button onClick={() => desfazer(l)} className="text-slate-400 hover:text-red-600" title="Desfazer"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                      ) : editavel ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {s && <Botao pequeno icone={<Check className="h-3.5 w-3.5" />} onClick={() => conciliar(l, s.candidato)} title={`Diferença de ${s.diasDiferenca} dia(s)`}>Confirmar {s.candidato.descricao.split(' · ')[0]}</Botao>}
                          {opcoesManuais.length > 0 && (
                            <select className="max-w-[220px] rounded border border-slate-300 py-1 text-xs" value={manual[l.id] ?? ''} onChange={(e) => {
                              setManual({ ...manual, [l.id]: e.target.value });
                              const c = cands.find((x) => x.id === e.target.value); if (c) conciliar(l, c);
                            }}>
                              <option value="">Escolher lançamento…</option>
                              {opcoesManuais.map((c) => <option key={c.id} value={c.id}>{fmtData(c.data)} · {c.descricao.slice(0, 50)} ({Math.abs(diasEntre(l.data, c.data))}d)</option>)}
                            </select>
                          )}
                          <Botao pequeno variante="secundario" icone={<Plus className="h-3.5 w-3.5" />} onClick={() => setAjustando(l)}>Ajuste / justificar</Botao>
                        </div>
                      ) : <span className="text-xs text-slate-500">Pendente</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">As sugestões consideram valor idêntico e data próxima (até 5 dias) e só são gravadas após a sua confirmação.</p>
      </Cartao>

      <Cartao titulo={`Lançamentos do sistema sem movimentação no extrato (${semExtrato.length})`}>
        {!semExtrato.length ? <Vazio>Todos os lançamentos da conta no período foram encontrados no extrato.</Vazio> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {semExtrato.map((c) => <li key={c.id} className="flex justify-between gap-2 py-1.5"><span>{fmtData(c.data)} · {c.descricao}</span><span className="tabular-nums">{dinheiro(c.valor)}</span></li>)}
          </ul>
        )}
      </Cartao>
      <Ajuste linha={ajustando} extrato={ex} onFechar={() => setAjustando(null)} onFeito={carregar} />
      {elemento}
    </div>
  );
}

export default function Conciliacao() {
  const { pode } = useSessao();
  const [importar, setImportar] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [saldos, setSaldos] = useState<any[]>([]);
  useEffect(() => { supabase.rpc('saldos_contas', {}).then(({ data }) => setSaldos(data || [])); }, [versao, aberto]);

  if (aberto) return <Detalhe id={aberto} onVoltar={() => { setAberto(null); setVersao((v) => v + 1); }} />;

  const colunas: Coluna[] = [
    { chave: 'conta', titulo: 'Conta', render: (l) => l.contas_resumo?.nome, exportar: (l) => l.contas_resumo?.nome, ordenavel: false },
    { chave: 'data_inicio', titulo: 'De', tipo: 'data' },
    { chave: 'data_fim', titulo: 'Até', tipo: 'data' },
    { chave: 'saldo_inicial', titulo: 'Saldo inicial', tipo: 'dinheiro' },
    { chave: 'saldo_final', titulo: 'Saldo final', tipo: 'dinheiro' },
    { chave: 'arquivo_nome', titulo: 'Arquivo' },
    { chave: 'status', titulo: 'Situação', tipo: 'status' },
  ];
  return (
    <div className="space-y-5">
      <TituloPagina titulo="Conciliação bancária" descricao="Compare os lançamentos do sistema com os extratos, por conta e período. Nenhuma correspondência é gravada sem confirmação."
        acoes={pode('admin', 'financeiro') && <Botao variante="sol" icone={<FileUp className="h-4 w-4" />} onClick={() => setImportar(true)}>Importar extrato</Botao>} />
      <Cartao titulo="Saldos por conta (hoje)" semPadding>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Conta</th><th className="px-3 py-2">Fonte exclusiva</th><th className="px-3 py-2 text-right">Saldo inicial</th><th className="px-3 py-2 text-right">Entradas</th><th className="px-3 py-2 text-right">Saídas</th><th className="px-3 py-2 text-right">Saldo contábil</th><th className="px-3 py-2 text-right">Último extrato conciliado</th><th className="px-3 py-2 text-right">Diferença na data do extrato</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {saldos.map((s) => (
                <tr key={s.conta_id}>
                  <td className="px-3 py-2 font-medium">{s.conta}</td><td className="px-3 py-2">{s.fonte ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dinheiro(s.saldo_inicial)}</td><td className="px-3 py-2 text-right tabular-nums">{dinheiro(s.entradas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dinheiro(s.saidas)}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{dinheiro(s.saldo_contabil)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.saldo_extrato === null ? '—' : `${dinheiro(s.saldo_extrato)} (${fmtData(s.data_extrato)})`}</td>
                  <td className={cx('px-3 py-2 text-right tabular-nums', s.diferenca && Number(s.diferenca) !== 0 && 'font-semibold text-red-700')}>{s.diferenca === null ? '—' : dinheiro(s.diferenca)}</td>
                </tr>
              ))}
              {!saldos.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nenhuma conta cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>
      <Tabela tabela="extratos" select="*, contas_resumo(nome)" colunas={colunas} ordem={{ coluna: 'data_fim', asc: false }} onLinha={(l) => setAberto(l.id)} recarregar={versao}
        nomeExportacao="extratos" tituloImpressao="Extratos e conciliações" vazio="Nenhum extrato importado." />
      <Importar aberto={importar} onFechar={() => setImportar(false)} onImportado={(id) => { setVersao((v) => v + 1); setAberto(id); }} />
    </div>
  );
}
