import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { TIPOS_DOCUMENTO, TIPOS_INSTRUMENTO, opcoes, opcoesStatus } from '../lib/rotulos';
import { Aviso, Botao, Cartao, Carregando, Pendente, Selo, TituloPagina, cx, useAviso, useConfirmacao } from '../components/ui';
import { CadastroSimples } from '../components/CadastroSimples';
import { Formulario, normalizar, type Campo, type Valores } from '../components/Formulario';
import { Anexos } from '../components/Anexos';

const camposProjeto: Campo[] = [
  { nome: 'nome_oficial', rotulo: 'Nome oficial do projeto', tipo: 'texto', obrigatorio: true, secao: 'Identificação', largura: 2 },
  { nome: 'municipio', rotulo: 'Município', tipo: 'texto', secao: 'Identificação' },
  { nome: 'entidade_responsavel', rotulo: 'Entidade responsável', tipo: 'texto', secao: 'Identificação', largura: 2 },
  { nome: 'cnpj', rotulo: 'CNPJ da entidade (se aplicável)', tipo: 'texto', secao: 'Identificação' },
  { nome: 'endereco', rotulo: 'Endereço', tipo: 'texto', secao: 'Contatos institucionais', largura: 2 },
  { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', secao: 'Contatos institucionais' },
  { nome: 'email', rotulo: 'E-mail', tipo: 'email', secao: 'Contatos institucionais' },
  { nome: 'responsavel_legal', rotulo: 'Responsável legal', tipo: 'texto', secao: 'Responsáveis' },
  { nome: 'responsavel_financeiro', rotulo: 'Responsável financeiro', tipo: 'texto', secao: 'Responsáveis' },
  { nome: 'responsavel_conferencia', rotulo: 'Responsável pela conferência', tipo: 'texto', secao: 'Responsáveis' },
  { nome: 'inicio_execucao', rotulo: 'Início da execução', tipo: 'data', secao: 'Execução' },
  { nome: 'fim_execucao', rotulo: 'Fim da execução', tipo: 'data', secao: 'Execução' },
  { nome: 'periodicidade_relatorios', rotulo: 'Periodicidade dos relatórios', tipo: 'texto', secao: 'Execução', placeholder: 'Mensal, trimestral…' },
  { nome: 'objetivos', rotulo: 'Objetivos', tipo: 'area', secao: 'Execução' },
  { nome: 'publico_atendido', rotulo: 'Público atendido', tipo: 'area', secao: 'Execução' },
  { nome: 'prazo_relatorios', rotulo: 'Prazos dos relatórios', tipo: 'texto', secao: 'Prestação de contas', largura: 3 },
  { nome: 'regras_prestacao_contas', rotulo: 'Regras específicas de prestação de contas', tipo: 'area', secao: 'Prestação de contas' },
  { nome: 'observacoes', rotulo: 'Observações', tipo: 'area', secao: 'Prestação de contas' },
];

function Projeto() {
  const { pode } = useSessao();
  const avisar = useAviso();
  const [v, setV] = useState<Valores | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { supabase.from('projeto').select('*').eq('id', 1).single().then(({ data }) => setV(data)); }, []);
  if (!v) return <Carregando />;
  const pendentes = camposProjeto.filter((c) => !v[c.nome]).map((c) => c.rotulo);
  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.from('projeto').update({ ...normalizar(camposProjeto, v!), atualizado_em: new Date().toISOString() }).eq('id', 1);
    setSalvando(false);
    if (error) avisar('erro', mensagemErro(error)); else avisar('ok', 'Cadastro do projeto salvo.');
  }
  return (
    <Cartao titulo="Dados institucionais" acoes={pode('admin') && <Botao onClick={salvar} carregando={salvando}>Salvar</Botao>}>
      {pendentes.length > 0 && <div className="mb-4"><Aviso tom="atencao" titulo={`${pendentes.length} campo(s) pendente(s) de configuração`}>{pendentes.join(' · ')}. Preencha apenas com informações confirmadas em documentos oficiais.</Aviso></div>}
      <fieldset disabled={!pode('admin')}><Formulario campos={camposProjeto} valores={v} onChange={setV} /></fieldset>
    </Cartao>
  );
}

function Periodos() {
  const { pode } = useSessao();
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const campos: Campo[] = [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: 1º trimestre/2026' },
    { nome: 'data_inicio', rotulo: 'Início', tipo: 'data', obrigatorio: true },
    { nome: 'data_fim', rotulo: 'Fim', tipo: 'data', obrigatorio: true },
    { nome: 'publicar_transparencia', rotulo: 'Publicar totais deste período no Portal da Transparência do site', tipo: 'booleano', largura: 3 },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'area' },
  ];
  async function alternar(l: Valores, recarregar: () => void) {
    if (l.status === 'aberto') {
      const ok = await confirmar({ titulo: `Fechar ${l.nome}`, texto: 'Após o fechamento, receitas, despesas e pagamentos do período não poderão ser alterados. Somente um administrador poderá reabrir, com justificativa registrada.' });
      if (!ok) return;
      const { error } = await supabase.rpc('fechar_periodo', { p_id: l.id, p_obs: null });
      if (error) return avisar('erro', mensagemErro(error));
    } else {
      const j = await confirmar({ titulo: `Reabrir ${l.nome}`, texto: 'A reabertura fica registrada com data, usuário e justificativa.', justificativa: true });
      if (!j) return;
      const { error } = await supabase.rpc('reabrir_periodo', { p_id: l.id, p_justificativa: j });
      if (error) return avisar('erro', mensagemErro(error));
    }
    avisar('ok', 'Período atualizado.'); recarregar();
  }
  return (
    <>
      <CadastroSimples tabela="periodos" titulo="Período" campos={campos} podeEditar={pode('admin', 'financeiro')} ordem={{ coluna: 'data_inicio', asc: false }}
        colunas={[{ chave: 'nome', titulo: 'Período' }, { chave: 'data_inicio', titulo: 'Início', tipo: 'data' }, { chave: 'data_fim', titulo: 'Fim', tipo: 'data' }, { chave: 'status', titulo: 'Situação', tipo: 'status' },
          { chave: 'publicar_transparencia', titulo: 'No site', render: (l) => (l.publicar_transparencia ? <Selo tom="ok">Publicado</Selo> : '—'), exportar: (l) => (l.publicar_transparencia ? 'Sim' : 'Não') }]}
        acoesExtras={(l, rec) => (l.status === 'aberto' ? pode('admin', 'financeiro') : pode('admin'))
          ? <Botao pequeno variante="secundario" icone={l.status === 'aberto' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />} onClick={() => alternar(l, rec)}>{l.status === 'aberto' ? 'Fechar' : 'Reabrir'}</Botao> : null} />
      {elemento}
    </>
  );
}

const ABAS = ['Projeto', 'Períodos', 'Fontes de recurso', 'Instrumentos', 'Contas bancárias', 'Categorias', 'Fornecedores', 'Metas', 'Checklist documental'] as const;

export default function Cadastros() {
  const { pode } = useSessao();
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Projeto');
  const fin = pode('admin', 'financeiro');
  const contas = pode('admin', 'financeiro', 'conferente');
  return (
    <div>
      <TituloPagina titulo="Cadastros do projeto" descricao="Configure períodos, fontes, instrumentos, contas e regras antes de lançar movimentações. Campos não preenchidos aparecem como pendentes — nada é presumido." />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {ABAS.filter((a) => a !== 'Contas bancárias' || contas).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm', aba === a ? 'border-sol-500 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>{a}</button>
        ))}
      </div>
      {aba === 'Projeto' && <Projeto />}
      {aba === 'Períodos' && <Periodos />}
      {aba === 'Fontes de recurso' && (
        <CadastroSimples tabela="fontes_recurso" titulo="Fonte de recurso" podeEditar={fin} padrao={{ tipo: 'privado', vinculado: false, ativo: true }} ordem={{ coluna: 'nome', asc: true }}
          campos={[
            { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, largura: 2 },
            { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'publico', rotulo: 'Público' }, { valor: 'privado', rotulo: 'Privado' }, { valor: 'proprio', rotulo: 'Próprio' }, { valor: 'misto', rotulo: 'Misto' }] },
            { nome: 'vinculado', rotulo: 'Recurso vinculado (não pode ser usado para cobrir outras fontes)', tipo: 'booleano', largura: 2 },
            { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' },
            { nome: 'instrumento_id', rotulo: 'Instrumento de parceria', tipo: 'ref', ref: { tabela: 'instrumentos', rotulo: 'numero' }, largura: 2 },
            { nome: 'descricao', rotulo: 'Descrição', tipo: 'area' },
            { nome: 'regras_elegibilidade', rotulo: 'Regras de elegibilidade das despesas (conforme documentos oficiais)', tipo: 'area' },
          ]}
          colunas={[{ chave: 'nome', titulo: 'Fonte' }, { chave: 'tipo', titulo: 'Tipo' }, { chave: 'vinculado', titulo: 'Vinculado', render: (l) => (l.vinculado ? <Selo tom="roxo">Vinculado</Selo> : 'Não'), exportar: (l) => (l.vinculado ? 'Sim' : 'Não') },
            { chave: 'regras_elegibilidade', titulo: 'Regras', render: (l) => l.regras_elegibilidade ? 'Cadastradas' : <Pendente>Pendente</Pendente>, exportar: (l) => l.regras_elegibilidade }]} />
      )}
      {aba === 'Instrumentos' && (
        <CadastroSimples tabela="instrumentos" titulo="Instrumento de parceria" podeEditar={fin} padrao={{ ativo: true }} ordem={{ coluna: 'data_inicio', asc: false }}
          campos={[
            { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: opcoes(TIPOS_INSTRUMENTO) },
            { nome: 'numero', rotulo: 'Número / identificação', tipo: 'texto', obrigatorio: true },
            { nome: 'concedente', rotulo: 'Concedente / parceiro', tipo: 'texto' },
            { nome: 'data_inicio', rotulo: 'Vigência — início', tipo: 'data' },
            { nome: 'data_fim', rotulo: 'Vigência — fim', tipo: 'data' },
            { nome: 'valor_total', rotulo: 'Valor total', tipo: 'dinheiro' },
            { nome: 'periodicidade', rotulo: 'Periodicidade da prestação de contas', tipo: 'texto' },
            { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
            { nome: 'objeto', rotulo: 'Objeto', tipo: 'area' },
            { nome: 'plano_trabalho', rotulo: 'Plano de trabalho (resumo)', tipo: 'area' },
            { nome: 'regras_prestacao', rotulo: 'Regras de prestação de contas e documentos exigidos', tipo: 'area' },
          ]}
          extraModal={(v) => v.id ? <Anexos entidade="instrumento" registroId={v.id} podeEnviar={fin} tipoPadrao="contrato" titulo="Termo, plano de trabalho e aditivos" /> : null}
          colunas={[{ chave: 'tipo', titulo: 'Tipo' }, { chave: 'numero', titulo: 'Número' }, { chave: 'concedente', titulo: 'Concedente' }, { chave: 'data_inicio', titulo: 'Início', tipo: 'data' }, { chave: 'data_fim', titulo: 'Fim', tipo: 'data' }, { chave: 'valor_total', titulo: 'Valor', tipo: 'dinheiro' }]} />
      )}
      {aba === 'Contas bancárias' && (
        <>
          <div className="mb-3"><Aviso tom="info">Dados bancários são visíveis apenas para administrador, financeiro e conferente. O saldo inicial é o saldo da conta no início do dia indicado em "data do saldo inicial".</Aviso></div>
          <CadastroSimples tabela="contas_bancarias" titulo="Conta bancária" podeEditar={fin} padrao={{ ativo: true, saldo_inicial: '0.00', tipo: 'corrente' }} ordem={{ coluna: 'nome', asc: true }}
            campos={[
              { nome: 'nome', rotulo: 'Nome de identificação', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Conta movimento BB' },
              { nome: 'banco', rotulo: 'Banco', tipo: 'texto' },
              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: opcoes(['corrente', 'poupança', 'aplicação', 'caixa (dinheiro)']) },
              { nome: 'agencia', rotulo: 'Agência', tipo: 'texto' },
              { nome: 'numero_conta', rotulo: 'Número da conta', tipo: 'texto' },
              { nome: 'fonte_id', rotulo: 'Conta exclusiva da fonte', tipo: 'ref', ref: { tabela: 'fontes_recurso', rotulo: 'nome' }, ajuda: 'Deixe em branco se a conta recebe recursos de várias fontes.' },
              { nome: 'saldo_inicial', rotulo: 'Saldo inicial', tipo: 'dinheiro', obrigatorio: true },
              { nome: 'data_saldo_inicial', rotulo: 'Data do saldo inicial', tipo: 'data', obrigatorio: true },
              { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' },
            ]}
            colunas={[{ chave: 'nome', titulo: 'Conta' }, { chave: 'banco', titulo: 'Banco' }, { chave: 'agencia', titulo: 'Agência' }, { chave: 'numero_conta', titulo: 'Conta' }, { chave: 'saldo_inicial', titulo: 'Saldo inicial', tipo: 'dinheiro' }, { chave: 'data_saldo_inicial', titulo: 'Em', tipo: 'data' }]} />
        </>
      )}
      {aba === 'Categorias' && (
        <CadastroSimples tabela="categorias" titulo="Categoria" podeEditar={fin} padrao={{ tipo: 'despesa', ativo: true, ordem: 0 }} ordem={{ coluna: 'ordem', asc: true }}
          select="*, pai:parent_id(nome)"
          campos={[
            { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'receita', rotulo: 'Receita' }, { valor: 'despesa', rotulo: 'Despesa' }] },
            { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
            { nome: 'parent_id', rotulo: 'Subcategoria de', tipo: 'ref', ref: { tabela: 'categorias', rotulo: 'nome', filtro: { parent_id: 'null' } }, ajuda: 'Deixe em branco para categoria principal.' },
            { nome: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
            { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' },
          ]}
          filtros={[{ chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [{ valor: 'receita', rotulo: 'Receita' }, { valor: 'despesa', rotulo: 'Despesa' }], aplicar: (q, v) => q.eq('tipo', v) }]}
          colunas={[{ chave: 'tipo', titulo: 'Tipo' }, { chave: 'nome', titulo: 'Categoria' }, { chave: 'pai', titulo: 'Subcategoria de', render: (l) => l.pai?.nome ?? '—', exportar: (l) => l.pai?.nome, ordenavel: false }, { chave: 'ativo', titulo: 'Ativa', render: (l) => (l.ativo ? 'Sim' : 'Não'), exportar: (l) => (l.ativo ? 'Sim' : 'Não') }]} />
      )}
      {aba === 'Fornecedores' && (
        <CadastroSimples tabela="fornecedores" titulo="Fornecedor / beneficiário" podeEditar={fin} padrao={{ ativo: true }} ordem={{ coluna: 'nome', asc: true }} busca={['nome', 'cpf_cnpj']}
          campos={[{ nome: 'nome', rotulo: 'Nome / razão social', tipo: 'texto', obrigatorio: true, largura: 2 }, { nome: 'cpf_cnpj', rotulo: 'CPF/CNPJ', tipo: 'texto' }, { nome: 'contato', rotulo: 'Contato', tipo: 'texto', largura: 2 }, { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' }, { nome: 'observacoes', rotulo: 'Observações', tipo: 'area' }]}
          colunas={[{ chave: 'nome', titulo: 'Nome' }, { chave: 'cpf_cnpj', titulo: 'CPF/CNPJ', render: (l) => l.cpf_cnpj ?? <Pendente>Não informado</Pendente>, exportar: (l) => l.cpf_cnpj }, { chave: 'contato', titulo: 'Contato' }]} />
      )}
      {aba === 'Metas' && (
        <CadastroSimples tabela="metas" titulo="Meta" podeEditar={pode('admin', 'financeiro', 'atividades')} padrao={{ ativo: true }} ordem={{ coluna: 'codigo', asc: true }}
          campos={[
            { nome: 'codigo', rotulo: 'Código', tipo: 'texto', placeholder: 'M1' }, { nome: 'instrumento_id', rotulo: 'Instrumento', tipo: 'ref', ref: { tabela: 'instrumentos', rotulo: 'numero' }, largura: 2 },
            { nome: 'descricao', rotulo: 'Descrição da meta', tipo: 'area', obrigatorio: true }, { nome: 'indicador', rotulo: 'Indicador', tipo: 'texto', largura: 2 },
            { nome: 'valor_meta', rotulo: 'Valor previsto', tipo: 'numero' }, { nome: 'unidade', rotulo: 'Unidade', tipo: 'texto', placeholder: 'crianças, atendimentos, encontros…' },
            { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' }, { nome: 'metodologia', rotulo: 'Metodologia de contagem', tipo: 'area', ajuda: 'Ex.: conta participantes únicos por semestre a partir das listas de presença.' },
          ]}
          colunas={[{ chave: 'codigo', titulo: 'Código' }, { chave: 'descricao', titulo: 'Meta' }, { chave: 'indicador', titulo: 'Indicador' }, { chave: 'valor_meta', titulo: 'Previsto', tipo: 'numero' }, { chave: 'unidade', titulo: 'Unidade' }]} />
      )}
      {aba === 'Checklist documental' && (
        <>
          <div className="mb-3"><Aviso tom="info">Defina quais documentos cada despesa precisa, por categoria e/ou fonte. O critério "doc:" é atendido ao anexar um documento do tipo indicado; "campo:" é atendido ao preencher o campo. Itens inativos não são exigidos.</Aviso></div>
          <CadastroSimples tabela="checklist_modelos" titulo="Item do checklist" podeEditar={fin} padrao={{ obrigatorio: true, ativo: true, ordem: 10, criterio: 'doc:nota_fiscal|recibo' }} ordem={{ coluna: 'ordem', asc: true }}
            select="*, categorias(nome), fontes_recurso(nome)"
            campos={[
              { nome: 'item', rotulo: 'Item', tipo: 'texto', obrigatorio: true, largura: 2 },
              { nome: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' },
              { nome: 'criterio', rotulo: 'Critério de atendimento', tipo: 'texto', obrigatorio: true, largura: 3,
                ajuda: <>Use <code>doc:tipo1|tipo2</code> (tipos: {Object.keys(TIPOS_DOCUMENTO).join(', ')}), <code>campo:justificativa</code> ou <code>campo:fornecedor</code>.</> },
              { nome: 'categoria_id', rotulo: 'Somente para a categoria', tipo: 'ref', ref: { tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'despesa' } } },
              { nome: 'fonte_id', rotulo: 'Somente para a fonte', tipo: 'ref', ref: { tabela: 'fontes_recurso', rotulo: 'nome' } },
              { nome: 'valor_minimo', rotulo: 'Exigir a partir do valor', tipo: 'dinheiro' },
              { nome: 'obrigatorio', rotulo: 'Obrigatório', tipo: 'booleano' },
              { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
            ]}
            colunas={[{ chave: 'item', titulo: 'Item' }, { chave: 'criterio', titulo: 'Critério' }, { chave: 'categoria', titulo: 'Categoria', render: (l) => l.categorias?.nome ?? 'Todas', exportar: (l) => l.categorias?.nome, ordenavel: false },
              { chave: 'fonte', titulo: 'Fonte', render: (l) => l.fontes_recurso?.nome ?? 'Todas', exportar: (l) => l.fontes_recurso?.nome, ordenavel: false }, { chave: 'valor_minimo', titulo: 'A partir de', tipo: 'dinheiro' },
              { chave: 'obrigatorio', titulo: 'Obrigatório', render: (l) => (l.obrigatorio ? 'Sim' : 'Não'), exportar: (l) => (l.obrigatorio ? 'Sim' : 'Não') },
              { chave: 'ativo', titulo: 'Ativo', render: (l) => (l.ativo ? <Selo tom="ok">Ativo</Selo> : <Selo>Inativo</Selo>), exportar: (l) => (l.ativo ? 'Sim' : 'Não') }]} />
          <p className="mt-2 text-xs text-slate-500">Alterações no checklist valem para despesas novas e para despesas cuja categoria, fonte ou valor forem alterados.</p>
        </>
      )}
    </div>
  );
}

export function Prazos() {
  const { pode } = useSessao();
  const [status, setStatus] = useState<string[]>([]);
  useEffect(() => { supabase.from('configuracoes').select('valor').eq('chave', 'status_obrigacoes').maybeSingle().then(({ data }) => setStatus((data?.valor as string[]) || [])); }, []);
  const campos: Campo[] = [
    { nome: 'titulo', rotulo: 'Obrigação', tipo: 'texto', obrigatorio: true, largura: 2, placeholder: 'Ex.: Prestação de contas parcial — 1º trimestre' },
    { nome: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, opcoes: opcoesStatus(status) },
    { nome: 'instrumento_id', rotulo: 'Instrumento', tipo: 'ref', ref: { tabela: 'instrumentos', rotulo: 'numero' } },
    { nome: 'periodo_id', rotulo: 'Período', tipo: 'ref', ref: { tabela: 'periodos', rotulo: 'nome' } },
    { nome: 'prazo', rotulo: 'Prazo', tipo: 'data', obrigatorio: true },
    { nome: 'referencia_inicio', rotulo: 'Referência — início', tipo: 'data' },
    { nome: 'referencia_fim', rotulo: 'Referência — fim', tipo: 'data' },
    { nome: 'alerta_dias', rotulo: 'Alertar com antecedência (dias)', tipo: 'inteiro', obrigatorio: true },
    { nome: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { nome: 'data_envio', rotulo: 'Data de envio', tipo: 'data' },
    { nome: 'protocolo', rotulo: 'Protocolo', tipo: 'texto' },
    { nome: 'documentos_exigidos', rotulo: 'Documentos exigidos', tipo: 'area' },
    { nome: 'pendencias', rotulo: 'Pendências', tipo: 'area' },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'area' },
  ];
  return (
    <div>
      <TituloPagina titulo="Prazos e obrigações" descricao="Calendário das prestações de contas, com alertas antecipados e acompanhamento até a aprovação. As situações são configuráveis em Site → Configurações avançadas." />
      <CadastroSimples tabela="obrigacoes" titulo="Obrigação" campos={campos} podeEditar={pode('admin', 'financeiro')} padrao={{ status: 'em_preparacao', alerta_dias: 15 }} ordem={{ coluna: 'prazo', asc: true }}
        busca={['titulo', 'protocolo', 'responsavel']} filtros={[{ chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: opcoesStatus(status), aplicar: (q, v) => q.eq('status', v) }]}
        destacar={(l) => !['enviada', 'aprovada', 'aprovada_com_ressalvas'].includes(l.status) && (Date.parse(l.prazo) - Date.now()) / 864e5 <= l.alerta_dias}
        extraModal={(v) => v.id ? <Anexos entidade="obrigacao" registroId={v.id} podeEnviar={pode('admin', 'financeiro')} tipoPadrao="protocolo_envio" titulo="Comprovante de entrega e documentos" /> : null}
        colunas={[{ chave: 'prazo', titulo: 'Prazo', tipo: 'data' }, { chave: 'titulo', titulo: 'Obrigação' }, { chave: 'responsavel', titulo: 'Responsável' }, { chave: 'status', titulo: 'Situação', tipo: 'status' }, { chave: 'data_envio', titulo: 'Enviada em', tipo: 'data' }, { chave: 'protocolo', titulo: 'Protocolo' }]} />
    </div>
  );
}
