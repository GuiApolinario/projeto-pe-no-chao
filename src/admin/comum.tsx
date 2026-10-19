// Peças compartilhadas pelos módulos de receitas e despesas.
import { useEffect, useState } from 'react';
import { CheckCircle2, History, XCircle } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { dataHora } from '../lib/formato';
import { useSessao } from '../lib/sessao';
import { AreaTexto, Botao, Selo, useAviso } from '../components/ui';

export function PainelConferencia({ tabela, id, situacao, obs, conferidoEm, onAlterado }: { tabela: 'receitas' | 'despesas'; id: string; situacao: string; obs?: string | null; conferidoEm?: string | null; onAlterado: () => void }) {
  const { pode } = useSessao();
  const avisar = useAviso();
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function registrar(s: string) {
    setSalvando(true);
    const { error } = await supabase.rpc('conferir_lancamento', { p_tabela: tabela, p_id: id, p_situacao: s, p_obs: texto || null });
    setSalvando(false);
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', 'Conferência registrada.'); setTexto(''); onAlterado();
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Conferência do lançamento</p>
        <Selo status={situacao} />
      </div>
      {obs && <p className="text-xs text-slate-600">Observação: {obs}{conferidoEm ? ` (${dataHora(conferidoEm)})` : ''}</p>}
      {pode('admin', 'conferente') && (
        <>
          <AreaTexto rows={2} placeholder="Observações da conferência (obrigatório para rejeitar)" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Botao pequeno carregando={salvando} icone={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => registrar('aprovado')}>Aprovar</Botao>
            <Botao pequeno variante="secundario" disabled={salvando} onClick={() => registrar('em_analise')}>Em análise</Botao>
            <Botao pequeno variante="perigo" disabled={salvando || texto.trim().length < 5} icone={<XCircle className="h-3.5 w-3.5" />} onClick={() => registrar('rejeitado')}>Rejeitar</Botao>
          </div>
        </>
      )}
    </div>
  );
}

const ROTULO_ACAO: Record<string, string> = { criacao: 'Criado', alteracao: 'Alterado', exclusao: 'Excluído' };
const IGNORAR = new Set(['atualizado_em', 'atualizado_por']);

export function diferencas(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null): string[] {
  if (!antes || !depois) return [];
  return Object.keys(depois).filter((k) => !IGNORAR.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => `${k}: ${antes[k] ?? '—'} → ${depois[k] ?? '—'}`);
}

export function Historico({ tabela, id }: { tabela: string; id: string }) {
  const { pode } = useSessao();
  const [itens, setItens] = useState<{ id: number; acao: string; em: string; usuario_email: string | null; dados_antigos: Record<string, unknown> | null; dados_novos: Record<string, unknown> | null }[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    supabase.from('auditoria').select('*').eq('tabela', tabela).eq('registro_id', id).order('em', { ascending: false }).limit(50).then(({ data }) => setItens(data || []));
  }, [aberto, tabela, id]);
  if (!pode('admin', 'conferente')) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button className="flex items-center gap-1.5 text-sm font-semibold text-slate-800" onClick={() => setAberto(!aberto)}><History className="h-4 w-4" />Histórico de alterações {aberto ? '▾' : '▸'}</button>
      {aberto && (itens === null ? <p className="mt-2 text-xs text-slate-500">Carregando…</p> : (
        <ul className="mt-2 space-y-2 text-xs">
          {itens.map((i) => (
            <li key={i.id} className="border-l-2 border-sol-300 pl-2">
              <p className="font-medium text-slate-700">{ROTULO_ACAO[i.acao] ?? i.acao} · {dataHora(i.em)} · {i.usuario_email ?? 'sistema'}</p>
              {diferencas(i.dados_antigos, i.dados_novos).map((d) => <p key={d} className="break-all text-slate-500">{d}</p>)}
            </li>
          ))}
          {!itens.length && <li className="text-slate-500">Sem registros.</li>}
        </ul>
      ))}
    </div>
  );
}
