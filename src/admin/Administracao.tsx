import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Save } from 'lucide-react';
import QRCode from 'qrcode';
import { buscarTodos, mensagemErro, supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { PAPEIS, opcoes, opcoesStatus, rotuloStatus } from '../lib/rotulos';
import { data as fmtData, dataHora } from '../lib/formato';
import { gerarPixCopiaECola } from '../lib/pix';
import { baixar } from '../lib/exportar';
import { Aviso, AreaTexto, Botao, Caixa, Cartao, Carregando, CampoDinheiro, Rotulo, Selecao, Selo, Texto, TituloPagina, Vazio, cx, useAviso } from '../components/ui';
import { CadastroSimples } from '../components/CadastroSimples';
import { Tabela, type Coluna } from '../components/Tabela';
import { diferencas } from './comum';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ------------------------------------------------------------------ site e doações
export function ConfigSite() {
  const avisar = useAviso();
  const [s, setS] = useState<any>(null);
  const [avancado, setAvancado] = useState<Record<string, string>>({});
  const [qr, setQr] = useState('');
  useEffect(() => {
    supabase.from('configuracoes').select('*').then(({ data }) => {
      const m = Object.fromEntries((data || []).map((c) => [c.chave, c.valor]));
      setS(m.site ?? {});
      setAvancado(Object.fromEntries(['status_obrigacoes', 'tipos_atividade', 'bairros', 'upload'].map((k) => [k, JSON.stringify(m[k] ?? null, null, 2)])));
    });
  }, []);
  const payload = useMemo(() => s?.pix_chave && s?.pix_nome ? gerarPixCopiaECola({ chave: s.pix_chave, nome: s.pix_nome, cidade: s.pix_cidade || 'VOTORANTIM' }) : '', [s]);
  useEffect(() => { if (payload) QRCode.toDataURL(payload, { margin: 1, width: 220 }).then(setQr); else setQr(''); }, [payload]);
  if (!s) return <Carregando />;
  const set = (k: string, v: unknown) => setS({ ...s, [k]: v === '' ? null : v });

  async function salvar() {
    const { error } = await supabase.from('configuracoes').update({ valor: s, atualizado_em: new Date().toISOString() }).eq('chave', 'site');
    if (error) avisar('erro', mensagemErro(error)); else avisar('ok', 'Configurações do site salvas.');
  }
  async function salvarAvancado(chave: string) {
    try {
      const valor = JSON.parse(avancado[chave]);
      const { error } = await supabase.from('configuracoes').update({ valor }).eq('chave', chave);
      if (error) throw error;
      avisar('ok', 'Configuração salva.');
    } catch (e) { avisar('erro', e instanceof SyntaxError ? 'JSON inválido.' : mensagemErro(e)); }
  }

  return (
    <div className="space-y-6">
      <TituloPagina titulo="Site e doações" descricao="Informações exibidas no site público. Tudo o que estiver em branco simplesmente não aparece no site." acoes={<><Link to="/" target="_blank"><Botao variante="secundario">Ver site</Botao></Link><Botao onClick={salvar} icone={<Save className="h-4 w-4" />}>Salvar</Botao></>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Cartao titulo="Doações via PIX">
          <div className="grid gap-3 sm:grid-cols-2">
            <Rotulo texto="Chave PIX" ajuda="CNPJ, CPF, e-mail, telefone ou chave aleatória da conta do projeto."><Texto value={s.pix_chave ?? ''} onChange={(e) => set('pix_chave', e.target.value)} /></Rotulo>
            <Rotulo texto="Tipo da chave"><Selecao opcoes={opcoes(['CNPJ', 'CPF', 'E-mail', 'Telefone', 'Chave aleatória'])} value={s.pix_tipo ?? ''} onChange={(e) => set('pix_tipo', e.target.value)} /></Rotulo>
            <Rotulo texto="Nome do recebedor (como aparece no banco)"><Texto value={s.pix_nome ?? ''} onChange={(e) => set('pix_nome', e.target.value)} /></Rotulo>
            <Rotulo texto="Cidade do recebedor"><Texto value={s.pix_cidade ?? ''} onChange={(e) => set('pix_cidade', e.target.value)} /></Rotulo>
            <Rotulo texto="Dados para transferência/depósito (opcional)" className="sm:col-span-2"><AreaTexto value={s.banco_texto ?? ''} onChange={(e) => set('banco_texto', e.target.value)} placeholder="Banco, agência, conta, titular" /></Rotulo>
          </div>
          <div className="mt-3"><Aviso tom="atencao">Confira a chave com o banco antes de publicar e faça um PIX de teste de R$ 1,00 lendo o QR Code abaixo. Toda doação recebida deve ser lançada em Receitas.</Aviso></div>
        </Cartao>
        <Cartao titulo="Pré-visualização do QR Code">
          {qr ? <div className="space-y-2 text-center"><img src={qr} alt="QR Code PIX" className="mx-auto" /><p className="break-all font-mono text-[10px] text-slate-500">{payload}</p></div> : <Vazio>Informe a chave e o nome do recebedor.</Vazio>}
        </Cartao>
      </div>
      <Cartao titulo="Contatos e textos">
        <div className="grid gap-3 sm:grid-cols-3">
          <Rotulo texto="WhatsApp (com DDD)"><Texto value={s.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="15999999999" /></Rotulo>
          <Rotulo texto="Instagram (sem @)"><Texto value={s.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} /></Rotulo>
          <Rotulo texto="E-mail"><Texto value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Rotulo>
          <Rotulo texto="Endereço / ponto de entrega de doações" className="sm:col-span-3"><Texto value={s.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} /></Rotulo>
          <Rotulo texto="Texto 'Quem somos'" className="sm:col-span-3" ajuda="Se vazio, o site usa um texto genérico sem dados não confirmados."><AreaTexto rows={5} value={s.texto_sobre ?? ''} onChange={(e) => set('texto_sobre', e.target.value)} /></Rotulo>
        </div>
      </Cartao>
      <Cartao titulo="Campanha em destaque (opcional)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Rotulo texto="Título da campanha"><Texto value={s.campanha_titulo ?? ''} onChange={(e) => set('campanha_titulo', e.target.value)} placeholder="Natal Pé no Chão 2026" /></Rotulo>
          <Rotulo texto="Meta (R$)"><CampoDinheiro valor={s.campanha_meta} onChange={(v) => set('campanha_meta', v)} /></Rotulo>
          <Rotulo texto="Arrecadado até agora (R$)" ajuda="Atualize conforme as receitas lançadas."><CampoDinheiro valor={s.campanha_arrecadado} onChange={(v) => set('campanha_arrecadado', v)} /></Rotulo>
        </div>
      </Cartao>
      <Cartao titulo="Portal da transparência">
        <Caixa rotulo="Exibir a página de transparência no site" checked={!!s.mostrar_transparencia} onChange={(v) => set('mostrar_transparencia', v)}
          ajuda="Mostra apenas totais agregados dos períodos marcados como 'publicar' em Cadastros → Períodos, e atividades marcadas para publicação. Nunca exibe nomes de doadores, fornecedores ou crianças." />
      </Cartao>
      <Cartao titulo="Lista de necessidades (o que doar)" semPadding>
        <CadastroSimples tabela="necessidades" titulo="Necessidade" podeEditar podeExcluir padrao={{ prioridade: 'media', ativo: true, ordem: 0 }} ordem={{ coluna: 'ordem', asc: true }}
          campos={[{ nome: 'titulo', rotulo: 'Item', tipo: 'texto', obrigatorio: true, largura: 2 }, { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'alta', rotulo: 'Alta' }, { valor: 'media', rotulo: 'Média' }, { valor: 'baixa', rotulo: 'Baixa' }] },
            { nome: 'descricao', rotulo: 'Descrição', tipo: 'area' }, { nome: 'ordem', rotulo: 'Ordem', tipo: 'inteiro' }, { nome: 'ativo', rotulo: 'Exibir no site', tipo: 'booleano' }]}
          colunas={[{ chave: 'titulo', titulo: 'Item' }, { chave: 'prioridade', titulo: 'Prioridade' }, { chave: 'ativo', titulo: 'No site', render: (l) => (l.ativo ? 'Sim' : 'Não'), exportar: (l) => (l.ativo ? 'Sim' : 'Não') }]} />
      </Cartao>
      <Cartao titulo="Mensagens recebidas pelo site" semPadding>
        <CadastroSimples tabela="contatos" titulo="Mensagem" podeEditar ordem={{ coluna: 'criado_em', asc: false }} busca={['nome', 'email', 'mensagem']}
          campos={[{ nome: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, opcoes: opcoesStatus(['novo', 'respondido', 'arquivado']) }]}
          filtros={[{ chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: opcoesStatus(['novo', 'respondido', 'arquivado']), aplicar: (q, v) => q.eq('status', v) }]}
          colunas={[{ chave: 'criado_em', titulo: 'Recebida', tipo: 'data' }, { chave: 'tipo', titulo: 'Assunto' }, { chave: 'nome', titulo: 'Nome' }, { chave: 'email', titulo: 'E-mail' }, { chave: 'telefone', titulo: 'Telefone' }, { chave: 'mensagem', titulo: 'Mensagem', classe: 'min-w-[240px]' }, { chave: 'status', titulo: 'Situação', tipo: 'status' }]} />
      </Cartao>
      <Cartao titulo="Configurações avançadas (listas do sistema)">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries({ status_obrigacoes: 'Situações das prestações de contas', tipos_atividade: 'Tipos de atividade', bairros: 'Bairros', upload: 'Limite de upload' }).map(([k, t]) => (
            <div key={k} className="space-y-1">
              <Rotulo texto={t}><AreaTexto rows={6} className="font-mono text-xs" value={avancado[k] ?? ''} onChange={(e) => setAvancado({ ...avancado, [k]: e.target.value })} /></Rotulo>
              <Botao pequeno variante="secundario" onClick={() => salvarAvancado(k)}>Salvar {t.toLowerCase()}</Botao>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Formato JSON. Ex.: ["Jardim Dandara", "Jardim Cerrado"]. O limite de upload também é aplicado no armazenamento (máximo absoluto de 15 MB).</p>
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ usuários
export function Usuarios() {
  const avisar = useAviso();
  const { perfil: eu } = useSessao();
  const [lista, setLista] = useState<any[] | null>(null);
  const carregar = () => supabase.from('perfis').select('*').order('criado_em').then(({ data }) => setLista(data || []));
  useEffect(() => { carregar(); }, []);
  async function alterar(id: string, dados: Record<string, unknown>) {
    const { error } = await supabase.from('perfis').update(dados).eq('id', id);
    if (error) avisar('erro', mensagemErro(error)); else { avisar('ok', 'Usuário atualizado.'); carregar(); }
  }
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Usuários e permissões" descricao="O administrador define o perfil de cada pessoa. As permissões são aplicadas no banco de dados, não apenas na tela." />
      <Aviso tom="info" titulo="Como convidar alguém">No painel do Supabase, abra Authentication → Users → "Invite user" e informe o e-mail. A pessoa recebe o convite, define a senha e aparece aqui como Visualizador; então ajuste o perfil. (Veja docs/INSTALACAO.md.)</Aviso>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries({ admin: 'Configura tudo, usuários e reaberturas.', financeiro: 'Cadastra receitas, despesas, pagamentos, orçamento e conciliação.', atividades: 'Registra atividades, participantes e evidências.', conferente: 'Revisa documentos e lançamentos; consulta a auditoria.', visualizador: 'Consulta dados não sensíveis.' })
          .map(([k, d]) => <div key={k} className="rounded-lg border border-slate-200 bg-white p-3"><p className="font-semibold">{PAPEIS[k]}</p><p className="text-xs text-slate-500">{d}</p></div>)}
      </div>
      {!lista ? <Carregando /> : (
        <Cartao semPadding>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Perfil</th><th className="px-3 py-2">Ativo</th><th className="px-3 py-2">Desde</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2"><input className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-300" defaultValue={u.nome} onBlur={(e) => e.target.value !== u.nome && alterar(u.id, { nome: e.target.value })} /></td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2"><Selecao vazio={false} opcoes={opcoes(PAPEIS)} value={u.papel} onChange={(e) => alterar(u.id, { papel: e.target.value })} className="py-1" /></td>
                  <td className="px-3 py-2"><input type="checkbox" checked={u.ativo} disabled={u.id === eu?.id} onChange={(e) => alterar(u.id, { ativo: e.target.checked })} /></td>
                  <td className="px-3 py-2 text-slate-500">{fmtData(u.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ auditoria
export function Auditoria() {
  const colunas: Coluna[] = [
    { chave: 'em', titulo: 'Data/hora', render: (l) => dataHora(l.em), exportar: (l) => dataHora(l.em) },
    { chave: 'usuario_email', titulo: 'Usuário', render: (l) => l.usuario_email ?? 'sistema' },
    { chave: 'tabela', titulo: 'Tabela' },
    { chave: 'acao', titulo: 'Ação', render: (l) => <Selo tom={l.acao === 'criacao' ? 'ok' : l.acao === 'exclusao' ? 'erro' : 'info'}>{l.acao}</Selo>, exportar: (l) => l.acao },
    { chave: 'codigo', titulo: 'Registro', render: (l) => (l.dados_novos ?? l.dados_antigos)?.codigo ?? (l.registro_id ?? '').slice(0, 8), exportar: (l) => (l.dados_novos ?? l.dados_antigos)?.codigo ?? l.registro_id, ordenavel: false },
    { chave: 'mudancas', titulo: 'Alterações', classe: 'max-w-[480px] text-xs', ordenavel: false,
      render: (l) => l.acao === 'alteracao' ? diferencas(l.dados_antigos, l.dados_novos).slice(0, 6).map((d) => <p key={d} className="truncate">{d}</p>) : '—',
      exportar: (l) => diferencas(l.dados_antigos, l.dados_novos).join(' | ') },
  ];
  return (
    <div>
      <TituloPagina titulo="Trilha de auditoria" descricao="Registro automático e imutável de criações, alterações e exclusões: ninguém, nem o administrador, pode editar ou apagar este histórico." />
      <Tabela tabela="auditoria" colunas={colunas} ordem={{ coluna: 'em', asc: false }} porPagina={50} busca={['tabela', 'usuario_email', 'registro_id']}
        filtros={[
          { chave: 'tabela', rotulo: 'Tabela', tipo: 'select', opcoes: opcoes(['receitas', 'despesas', 'pagamentos', 'documentos', 'documento_vinculos', 'periodos', 'orcamento_itens', 'remanejamentos', 'extrato_linhas', 'perfis', 'atividades']), aplicar: (q, v) => q.eq('tabela', v) },
          { chave: 'acao', rotulo: 'Ação', tipo: 'select', opcoes: opcoes(['criacao', 'alteracao', 'exclusao']), aplicar: (q, v) => q.eq('acao', v) },
          { chave: 'de', rotulo: 'De', tipo: 'data', aplicar: (q, v) => q.gte('em', v) },
          { chave: 'ate', rotulo: 'Até', tipo: 'data', aplicar: (q, v) => q.lte('em', v + 'T23:59:59') },
        ]} nomeExportacao="auditoria" tituloImpressao="Trilha de auditoria" />
    </div>
  );
}

// ------------------------------------------------------------------ backup
export const TABELAS_BACKUP = [
  'projeto', 'perfis', 'periodos', 'periodo_eventos', 'instrumentos', 'fontes_recurso', 'contas_bancarias', 'categorias', 'metas', 'fornecedores',
  'documentos', 'documento_vinculos', 'receitas', 'despesas', 'pagamentos', 'duplicidades_revisadas', 'checklist_modelos', 'despesa_checklist',
  'doacoes_bens', 'orcamento_itens', 'remanejamentos', 'extratos', 'extrato_linhas', 'atividades', 'atividade_despesas', 'beneficiarios',
  'participacoes', 'obrigacoes', 'configuracoes', 'necessidades', 'contatos', 'auditoria',
];

export function Backup() {
  const avisar = useAviso();
  const [progresso, setProgresso] = useState<string | null>(null);
  const [incluirArquivos, setIncluirArquivos] = useState(false);
  async function exportar() {
    try {
      const dados: Record<string, unknown[]> = {};
      for (const t of TABELAS_BACKUP) {
        setProgresso(`Exportando ${t}…`);
        dados[t] = await buscarTodos((de, ate) => supabase.from(t).select('*').range(de, ate), 500000);
      }
      const meta = { gerado_em: new Date().toISOString(), versao: 1, origem: 'Projeto Pé no Chão', tabelas: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v.length])) };
      const nome = `backup-pe-no-chao-${new Date().toISOString().slice(0, 10)}`;
      if (!incluirArquivos) {
        baixar(JSON.stringify({ meta, dados }), `${nome}.json`, 'application/json');
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        zip.file('dados.json', JSON.stringify({ meta, dados }));
        const docs = dados.documentos as { storage_path: string }[];
        for (let i = 0; i < docs.length; i++) {
          setProgresso(`Baixando arquivo ${i + 1} de ${docs.length}…`);
          const { data } = await supabase.storage.from('documentos').download(docs[i].storage_path);
          if (data) zip.file(`arquivos/${docs[i].storage_path}`, data);
        }
        setProgresso('Compactando…');
        baixar(await zip.generateAsync({ type: 'blob' }), `${nome}.zip`);
      }
      avisar('ok', 'Backup gerado. Guarde-o em local seguro (contém dados pessoais e financeiros).');
    } catch (e) { avisar('erro', mensagemErro(e)); } finally { setProgresso(null); }
  }
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Backup e recuperação" />
      <Cartao titulo="Exportar backup completo">
        <div className="space-y-3 text-sm text-slate-700">
          <p>Gera um arquivo com todas as tabelas do sistema (inclusive auditoria). Opcionalmente inclui os arquivos de comprovantes.</p>
          <Caixa rotulo="Incluir arquivos dos comprovantes (ZIP, pode demorar)" checked={incluirArquivos} onChange={setIncluirArquivos} />
          <Botao icone={<Download className="h-4 w-4" />} onClick={exportar} carregando={!!progresso}>{progresso ?? 'Gerar backup'}</Botao>
          <Aviso tom="atencao">O arquivo contém dados pessoais (LGPD) e financeiros. Armazene criptografado, com acesso restrito, e mantenha cópias em dois locais diferentes.</Aviso>
        </div>
      </Cartao>
      <Cartao titulo="Rotina recomendada e restauração">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Diário (automático):</strong> backups do Supabase (plano Pro inclui 7 dias com recuperação; no plano gratuito, use o script abaixo).</li>
          <li><strong>Semanal:</strong> <code>npm run backup</code> (scripts/backup.mjs) — exporta banco e arquivos com a chave de serviço, fora do navegador.</li>
          <li><strong>Mensal, após o fechamento do período:</strong> backup completo com arquivos por esta tela + PDF consolidado do período.</li>
          <li><strong>Restauração:</strong> <code>npm run restaurar -- backup.json</code> gera um SQL que é aplicado em um projeto Supabase novo (passo a passo em docs/BACKUP.md). Teste a restauração a cada 6 meses.</li>
        </ul>
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ alertas
export function Alertas() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [tipo, setTipo] = useState('');
  useEffect(() => { supabase.from('v_alertas').select('*').order('data', { ascending: false }).limit(1000).then(({ data }) => setLista(data || [])); }, []);
  const tipos: Record<string, string> = { comprovante_ausente: 'Comprovante ausente', documento_rejeitado: 'Documento rejeitado', sem_categoria: 'Sem categoria', sem_beneficiario: 'Sem beneficiário', orcamento: 'Orçamento', duplicidade: 'Possível duplicidade', conciliacao: 'Conciliação', prazo: 'Prazos', receita_atrasada: 'Receita atrasada', regra_orcamento: 'Fora do orçamento da fonte', regra_vigencia: 'Fora da vigência' };
  const destino = (a: any) => a.entidade === 'despesa' ? `/admin/despesas?abrir=${a.registro_id}` : a.entidade === 'receita' ? `/admin/receitas?abrir=${a.registro_id}` : a.entidade === 'extrato' ? '/admin/conciliacao' : a.entidade === 'obrigacao' ? '/admin/prazos' : '/admin/orcamento';
  if (!lista) return <Carregando />;
  const filtrada = lista.filter((a) => !tipo || a.tipo === tipo);
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Alertas e pendências" descricao="Pontos que precisam de revisão humana. Um alerta não significa irregularidade." />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTipo('')} className={cx('rounded-full px-3 py-1 text-xs ring-1', !tipo ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}>Todos ({lista.length})</button>
        {Object.entries(tipos).map(([k, v]) => { const n = lista.filter((a) => a.tipo === k).length; return n ? <button key={k} onClick={() => setTipo(k)} className={cx('rounded-full px-3 py-1 text-xs ring-1', tipo === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}>{v} ({n})</button> : null; })}
      </div>
      {!filtrada.length ? <Vazio>Nenhum alerta. 🎉</Vazio> : (
        <Cartao semPadding>
          <ul className="divide-y divide-slate-100 text-sm">
            {filtrada.map((a, i) => (
              <li key={i}><Link to={destino(a)} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
                <Selo status={a.gravidade} /><span className="text-xs text-slate-500">{tipos[a.tipo] ?? rotuloStatus(a.tipo)}</span>
                <span className="flex-1 text-slate-800">{a.mensagem}</span><span className="text-xs text-slate-500">{a.codigo} {fmtData(a.data)}</span>
              </Link></li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
