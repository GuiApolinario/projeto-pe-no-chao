import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldAlert, UserPlus, X } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro, useSessao } from '../lib/sessao';
import { opcoes, opcoesStatus } from '../lib/rotulos';
import { data as fmtData, mesAno, num, pct } from '../lib/formato';
import { Aviso, Botao, Cartao, Carregando, Indicador, Selecao, Selo, TituloPagina, Vazio, useAviso } from '../components/ui';
import { CadastroSimples } from '../components/CadastroSimples';
import { Anexos } from '../components/Anexos';
import type { Campo, Valores } from '../components/Formulario';
import { SERIE, eixo, grade } from './graficos';

/* eslint-disable @typescript-eslint/no-explicit-any */
function useConfigLista(chave: string) {
  const [lista, setLista] = useState<string[]>([]);
  useEffect(() => { supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle().then(({ data }) => setLista((data?.valor as string[]) || [])); }, [chave]);
  return lista;
}

// ------------------------------------------------------------------ doações em bens
export function DoacoesBens() {
  const { pode } = useSessao();
  const { filtro } = useFiltro();
  const campos: Campo[] = [
    { nome: 'data_recebimento', rotulo: 'Data de recebimento', tipo: 'data', obrigatorio: true },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'bem', rotulo: 'Bem / material' }, { valor: 'servico', rotulo: 'Serviço voluntário/doado' }] },
    { nome: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, opcoes: opcoesStatus(['recebido', 'em_estoque', 'distribuido', 'cancelado']) },
    { nome: 'descricao', rotulo: 'Descrição dos bens ou serviços', tipo: 'area', obrigatorio: true },
    { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'numero' },
    { nome: 'unidade', rotulo: 'Unidade', tipo: 'texto', placeholder: 'kg, unidades, cestas…' },
    { nome: 'valor_estimado', rotulo: 'Valor estimado', tipo: 'dinheiro', ajuda: 'Apenas informativo: não entra no caixa.' },
    { nome: 'criterio_valor', rotulo: 'Critério da estimativa', tipo: 'texto', placeholder: 'Nota do doador, pesquisa de preço…' },
    { nome: 'doador_nome', rotulo: 'Doador', tipo: 'texto' },
    { nome: 'doador_documento', rotulo: 'CPF/CNPJ do doador', tipo: 'texto' },
    { nome: 'destino', rotulo: 'Destino / utilização', tipo: 'texto', largura: 2 },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'area' },
    { nome: 'cancel_justificativa', rotulo: 'Justificativa do cancelamento', tipo: 'area', visivel: (v) => v.status === 'cancelado', obrigatorio: true },
  ];
  return (
    <div>
      <TituloPagina titulo="Doações em bens e serviços" descricao="Controle patrimonial separado do caixa: alimentos, materiais e serviços doados não são somados aos saldos financeiros." />
      <CadastroSimples tabela="doacoes_bens" titulo="Doação em bens/serviços" campos={campos} podeEditar={pode('admin', 'financeiro')} padrao={{ tipo: 'bem', status: 'recebido' }}
        fixos={(q) => q.gte('data_recebimento', filtro.inicio).lte('data_recebimento', filtro.fim)} ordem={{ coluna: 'data_recebimento', asc: false }}
        busca={['descricao', 'doador_nome', 'codigo']} totais={['valor_estimado']}
        extraModal={(v) => v.id ? <Anexos entidade="doacao_bem" registroId={v.id} podeEnviar={pode('admin', 'financeiro')} tipoPadrao="comprovante_recebimento" /> : <p className="text-xs text-slate-500">Salve para anexar termos de doação e fotos.</p>}
        colunas={[
          { chave: 'codigo', titulo: 'Código' }, { chave: 'data_recebimento', titulo: 'Data', tipo: 'data' },
          { chave: 'descricao', titulo: 'Descrição' }, { chave: 'quantidade', titulo: 'Qtd.', tipo: 'numero' }, { chave: 'unidade', titulo: 'Unid.' },
          { chave: 'doador_nome', titulo: 'Doador' }, { chave: 'valor_estimado', titulo: 'Valor estimado', tipo: 'dinheiro' },
          { chave: 'destino', titulo: 'Destino' }, { chave: 'status', titulo: 'Situação', tipo: 'status' },
        ]} />
    </div>
  );
}

// ------------------------------------------------------------------ participantes de uma atividade
function Participantes({ atividadeId }: { atividadeId: string }) {
  const avisar = useAviso();
  const [lista, setLista] = useState<{ beneficiario_id: string; beneficiarios: { nome: string; codigo: string; autorizacao_imagem: boolean } }[]>([]);
  const [todos, setTodos] = useState<{ valor: string; rotulo: string }[]>([]);
  const [sel, setSel] = useState('');
  const carregar = () => supabase.from('participacoes').select('beneficiario_id, beneficiarios(nome, codigo, autorizacao_imagem)').eq('atividade_id', atividadeId).then(({ data }) => setLista((data as any) || []));
  useEffect(() => {
    carregar();
    supabase.from('beneficiarios').select('id, nome, codigo').eq('ativo', true).order('nome').then(({ data }) => setTodos((data || []).map((b) => ({ valor: b.id, rotulo: `${b.nome} (${b.codigo})` }))));
  }, [atividadeId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function add() {
    const { error } = await supabase.from('participacoes').insert({ atividade_id: atividadeId, beneficiario_id: sel });
    if (error) return avisar('erro', mensagemErro(error));
    setSel(''); carregar();
  }
  async function rem(id: string) {
    const { error } = await supabase.from('participacoes').delete().eq('atividade_id', atividadeId).eq('beneficiario_id', id);
    if (error) return avisar('erro', mensagemErro(error));
    carregar();
  }
  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><ShieldAlert className="h-4 w-4 text-violet-600" />Lista nominal de participantes ({lista.length}) — acesso restrito</p>
      <p className="text-xs text-slate-600">Usada para contar participantes únicos sem duplicidade. Visível apenas para administrador e responsável por atividades.</p>
      <div className="flex gap-2"><Selecao opcoes={todos.filter((t) => !lista.some((l) => l.beneficiario_id === t.valor))} value={sel} onChange={(e) => setSel(e.target.value)} /><Botao pequeno icone={<UserPlus className="h-3.5 w-3.5" />} disabled={!sel} onClick={add}>Incluir</Botao></div>
      <ul className="flex flex-wrap gap-1.5">
        {lista.map((l) => (
          <li key={l.beneficiario_id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">
            {l.beneficiarios.nome}{!l.beneficiarios.autorizacao_imagem && <span title="Sem autorização de imagem" className="text-red-600">⊘</span>}
            <button onClick={() => rem(l.beneficiario_id)} aria-label="Remover"><X className="h-3 w-3 text-slate-400" /></button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">⊘ = sem autorização de uso de imagem: não publique fotos em que esta pessoa possa ser identificada.</p>
    </div>
  );
}

function DespesasDaAtividade({ atividadeId, podeEditar }: { atividadeId: string; podeEditar: boolean }) {
  const avisar = useAviso();
  const [lista, setLista] = useState<any[]>([]);
  const [codigo, setCodigo] = useState('');
  const carregar = () => supabase.from('atividade_despesas').select('despesa_id, despesas(codigo, descricao, valor_total)').eq('atividade_id', atividadeId).then(({ data }) => setLista(data || []));
  useEffect(() => { carregar(); }, [atividadeId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function add() {
    const { data } = await supabase.from('despesas').select('id').eq('codigo', codigo.trim().toUpperCase()).maybeSingle();
    if (!data) return avisar('erro', 'Despesa não encontrada.');
    const { error } = await supabase.from('atividade_despesas').insert({ atividade_id: atividadeId, despesa_id: data.id });
    if (error) return avisar('erro', mensagemErro(error));
    setCodigo(''); carregar();
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-800">Despesas relacionadas</p>
      {lista.map((l) => <p key={l.despesa_id} className="text-sm text-slate-700">{l.despesas?.codigo} — {l.despesas?.descricao}</p>)}
      {podeEditar && <div className="flex gap-2"><input className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm" placeholder="DES-000001" value={codigo} onChange={(e) => setCodigo(e.target.value)} /><Botao pequeno variante="secundario" disabled={!codigo} onClick={add}>Vincular</Botao></div>}
    </div>
  );
}

// ------------------------------------------------------------------ atividades
export function Atividades() {
  const { pode } = useSessao();
  const { filtro } = useFiltro();
  const tipos = useConfigLista('tipos_atividade');
  const bairros = useConfigLista('bairros');
  const campos: Campo[] = [
    { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, secao: 'Atividade' },
    { nome: 'tipo', rotulo: 'Tipo de atividade', tipo: 'select', obrigatorio: true, opcoes: opcoes(tipos), secao: 'Atividade' },
    { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, secao: 'Atividade' },
    { nome: 'bairro', rotulo: 'Bairro', tipo: 'select', opcoes: opcoes(bairros), secao: 'Atividade' },
    { nome: 'local', rotulo: 'Local', tipo: 'texto', secao: 'Atividade' },
    { nome: 'responsavel', rotulo: 'Responsável', tipo: 'texto', secao: 'Atividade' },
    { nome: 'meta_id', rotulo: 'Meta do projeto', tipo: 'ref', ref: { tabela: 'metas', rotulo: 'descricao', filtro: { ativo: true } }, secao: 'Atividade', largura: 2 },
    { nome: 'participantes_qtd', rotulo: 'Quantidade de participações', tipo: 'inteiro', obrigatorio: true, secao: 'Atividade', ajuda: 'Número de atendimentos nesta atividade (não é o número de crianças únicas).' },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'area', secao: 'Detalhes' },
    { nome: 'objetivo', rotulo: 'Objetivo', tipo: 'area', secao: 'Detalhes' },
    { nome: 'publico_atendido', rotulo: 'Público atendido', tipo: 'texto', secao: 'Detalhes', largura: 3 },
    { nome: 'materiais', rotulo: 'Materiais utilizados', tipo: 'area', secao: 'Detalhes' },
    { nome: 'resultados', rotulo: 'Resultados observados', tipo: 'area', secao: 'Resultados' },
    { nome: 'dificuldades', rotulo: 'Dificuldades encontradas', tipo: 'area', secao: 'Resultados' },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'area', secao: 'Resultados' },
    { nome: 'publicar', rotulo: 'Publicar no site (somente título, data, bairro, descrição e número de participações — sem nomes)', tipo: 'booleano', secao: 'Resultados', largura: 3 },
  ];
  return (
    <div>
      <TituloPagina titulo="Atividades" descricao="Registro das ações realizadas, com evidências, participantes e despesas relacionadas." />
      <CadastroSimples tabela="atividades" titulo="Atividade" campos={campos} podeEditar={pode('admin', 'atividades')} padrao={{ participantes_qtd: 0, publicar: false }}
        fixos={(q) => q.gte('data', filtro.inicio).lte('data', filtro.fim)} ordem={{ coluna: 'data', asc: false }} busca={['titulo', 'descricao', 'local', 'codigo']}
        filtros={[
          { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: opcoes(tipos), aplicar: (q, v) => q.eq('tipo', v) },
          { chave: 'bairro', rotulo: 'Bairro', tipo: 'select', opcoes: opcoes(bairros), aplicar: (q, v) => q.eq('bairro', v) },
        ]}
        extraModal={(v: Valores) => v.id ? (
          <div className="grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Anexos entidade="atividade" registroId={v.id} podeEnviar={pode('admin', 'atividades')} tipoPadrao="foto_atividade" titulo="Fotos, listas de presença e evidências" />
              <DespesasDaAtividade atividadeId={v.id} podeEditar={pode('admin', 'atividades', 'financeiro')} />
            </div>
            {pode('admin', 'atividades') && <Participantes atividadeId={v.id} />}
          </div>
        ) : <p className="text-xs text-slate-500">Salve a atividade para anexar fotos e registrar participantes.</p>}
        colunas={[
          { chave: 'codigo', titulo: 'Código' }, { chave: 'data', titulo: 'Data', tipo: 'data' }, { chave: 'titulo', titulo: 'Atividade' },
          { chave: 'tipo', titulo: 'Tipo' }, { chave: 'bairro', titulo: 'Bairro' }, { chave: 'responsavel', titulo: 'Responsável' },
          { chave: 'participantes_qtd', titulo: 'Participações', tipo: 'numero' },
          { chave: 'publicar', titulo: 'No site', render: (l) => l.publicar ? <Selo tom="ok">Sim</Selo> : <Selo>Não</Selo>, exportar: (l) => (l.publicar ? 'Sim' : 'Não') },
          { chave: 'resultados', titulo: 'Resultados', oculta: true },
        ]} />
    </div>
  );
}

// ------------------------------------------------------------------ resultados sociais
export function ResultadosSociais() {
  const { filtro } = useFiltro();
  const [r, setR] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setR(null); supabase.rpc('resumo_social', { p_inicio: filtro.inicio, p_fim: filtro.fim }).then(({ data, error }) => error ? setErro(mensagemErro(error)) : setR(data)); }, [filtro]);
  if (erro) return <Aviso tom="erro">{erro}</Aviso>;
  if (!r) return <Carregando />;
  return (
    <div className="space-y-6">
      <TituloPagina titulo="Resultados sociais" descricao={`Painel separado do financeiro · ${fmtData(filtro.inicio)} a ${fmtData(filtro.fim)}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Atividades realizadas" valor={num(r.atividades)} />
        <Indicador rotulo="Atendimentos (participações)" valor={num(r.atendimentos)} detalhe="Soma das participações em cada atividade" tom="info" />
        <Indicador rotulo="Participantes únicos" valor={num(r.participantes_unicos)} detalhe="Pessoas distintas nas listas nominais" tom="ok" />
        <Indicador rotulo="Participações nominais registradas" valor={num(r.participacoes_nominais)} detalhe={r.atendimentos ? `${pct((r.participacoes_nominais / r.atendimentos) * 100)} dos atendimentos têm lista nominal` : undefined} />
      </div>
      <Aviso tom="info">"Participantes únicos" conta cada criança uma só vez no período; "atendimentos" conta cada participação. Não confunda os dois indicadores na prestação de contas.</Aviso>
      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Atendimentos por mês">
          {!r.por_mes.length ? <Vazio>Sem atividades no período.</Vazio> : (
            <div className="h-60"><ResponsiveContainer>
              <BarChart data={r.por_mes}>
                <CartesianGrid vertical={false} {...grade} />
                <XAxis dataKey="mes" tickFormatter={mesAno} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => mesAno(String(l))} formatter={(v: number, n: string) => [num(v), n]} />
                <Bar dataKey="atendimentos" name="Atendimentos" fill={SERIE.receitas} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Cartao>
        <Cartao titulo="Por bairro e por tipo">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            {[['Bairro', r.por_bairro, 'bairro'], ['Tipo', r.por_tipo, 'tipo']].map(([t, lista, k]: any) => (
              <table key={t} className="w-full"><thead className="text-left text-xs uppercase text-slate-500"><tr><th>{t}</th><th className="text-right">Ativ.</th><th className="text-right">Atend.</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{lista.map((x: any) => <tr key={x[k]}><td className="py-1">{x[k]}</td><td className="text-right tabular-nums">{x.atividades}</td><td className="text-right tabular-nums">{x.atendimentos}</td></tr>)}</tbody></table>
            ))}
          </div>
        </Cartao>
      </div>
      <Cartao titulo="Metas e indicadores">
        {!r.metas.length ? <Vazio>Nenhuma meta cadastrada. Cadastre em Cadastros → Metas.</Vazio> : (
          <table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Meta</th><th>Indicador</th><th className="text-right">Previsto</th><th className="text-right">Atividades</th><th className="text-right">Atendimentos</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{r.metas.map((m: any, i: number) => <tr key={i}><td className="py-1.5">{m.meta}</td><td>{m.indicador ?? '—'}</td><td className="text-right">{m.valor_meta ? `${num(m.valor_meta)} ${m.unidade ?? ''}` : '—'}</td><td className="text-right tabular-nums">{m.atividades}</td><td className="text-right tabular-nums">{m.atendimentos}</td></tr>)}</tbody></table>
        )}
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ beneficiários (LGPD)
export function Beneficiarios() {
  const { pode } = useSessao();
  const bairros = useConfigLista('bairros');
  if (!pode('admin', 'atividades')) return <Aviso tom="erro">Acesso restrito.</Aviso>;
  const campos: Campo[] = [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, largura: 2 },
    { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data' },
    { nome: 'responsavel_nome', rotulo: 'Responsável legal', tipo: 'texto', largura: 2 },
    { nome: 'responsavel_contato', rotulo: 'Contato do responsável', tipo: 'texto' },
    { nome: 'bairro', rotulo: 'Bairro', tipo: 'select', opcoes: opcoes(bairros) },
    { nome: 'autorizacao_imagem', rotulo: 'Possui autorização de uso de imagem assinada pelo responsável', tipo: 'booleano', largura: 2 },
    { nome: 'autorizacao_data', rotulo: 'Data da autorização', tipo: 'data', visivel: (v) => v.autorizacao_imagem, obrigatorio: true },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
    { nome: 'observacoes', rotulo: 'Observações (evite dados sensíveis desnecessários)', tipo: 'area' },
  ];
  return (
    <div>
      <TituloPagina titulo="Participantes" descricao="Cadastro mínimo de crianças e adolescentes para contagem de participantes únicos e controle de autorizações de imagem." />
      <div className="mb-4"><Aviso tom="atencao" titulo="Dados pessoais de crianças e adolescentes (LGPD art. 14 e ECA)">Colete somente o necessário, com consentimento do responsável. Estes dados nunca aparecem no site, nos relatórios financeiros nem para outros perfis de usuário. Fotos só podem ser publicadas com autorização registrada.</Aviso></div>
      <CadastroSimples tabela="beneficiarios" titulo="Participante" campos={campos} podeEditar padrao={{ ativo: true, autorizacao_imagem: false }} busca={['nome', 'codigo', 'responsavel_nome']} ordem={{ coluna: 'nome', asc: true }}
        extraModal={(v) => v.id ? <Anexos entidade="beneficiario" registroId={v.id} podeEnviar tipoPadrao="autorizacao_imagem" titulo="Autorizações e documentos" /> : null}
        colunas={[
          { chave: 'codigo', titulo: 'Código' }, { chave: 'nome', titulo: 'Nome' }, { chave: 'bairro', titulo: 'Bairro' },
          { chave: 'responsavel_nome', titulo: 'Responsável' },
          { chave: 'autorizacao_imagem', titulo: 'Autoriza imagem', render: (l) => l.autorizacao_imagem ? <Selo tom="ok">Sim</Selo> : <Selo tom="erro">Não</Selo>, exportar: (l) => (l.autorizacao_imagem ? 'Sim' : 'Não') },
          { chave: 'ativo', titulo: 'Ativo', render: (l) => (l.ativo ? 'Sim' : 'Não'), exportar: (l) => (l.ativo ? 'Sim' : 'Não') },
        ]} />
    </div>
  );
}
