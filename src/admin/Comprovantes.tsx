import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, Link2, List, Upload } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { useFiltro, useSessao } from '../lib/sessao';
import { TIPOS_DOCUMENTO, opcoes, opcoesStatus } from '../lib/rotulos';
import { data as fmtData, dinheiro, lerDinheiro } from '../lib/formato';
import { Botao, Carregando, CampoDinheiro, Modal, Rotulo, Selecao, Selo, Texto, TituloPagina, Vazio, useAviso } from '../components/ui';
import { FormEnvio, Miniatura, Visualizador, type DocumentoRow } from '../components/Anexos';
import { Tabela, type Coluna } from '../components/Tabela';
import { useOpcoes } from '../components/Formulario';

type Doc = DocumentoRow & { vinculos: number; despesa_codigo: string | null; despesa_descricao: string | null; categoria: string | null; fornecedor: string | null; receita_codigo: string | null; data_referencia: string };

const POR_PAGINA = 24;

function Vincular({ doc, onFechar, onFeito }: { doc: Doc | null; onFechar: () => void; onFeito: () => void }) {
  const avisar = useAviso();
  const [codigo, setCodigo] = useState('');
  const [just, setJust] = useState('');
  async function vincular() {
    if (!doc) return;
    const c = codigo.trim().toUpperCase();
    const mapa: Record<string, [string, string]> = { REC: ['receitas', 'receita'], DES: ['despesas', 'despesa'], PAG: ['pagamentos', 'pagamento'], ATV: ['atividades', 'atividade'], BEM: ['doacoes_bens', 'doacao_bem'] };
    const alvo = mapa[c.slice(0, 3)];
    if (!alvo) return avisar('erro', 'Informe um código válido (REC-, DES-, PAG-, ATV- ou BEM-).');
    const { data } = await supabase.from(alvo[0]).select('id').eq('codigo', c).maybeSingle();
    if (!data) return avisar('erro', `Registro ${c} não encontrado.`);
    const { error } = await supabase.from('documento_vinculos').insert({ documento_id: doc.id, entidade: alvo[1], registro_id: data.id, justificativa: just || null });
    if (error) return avisar('erro', mensagemErro(error));
    avisar('ok', `Documento vinculado a ${c}.`); setCodigo(''); setJust(''); onFeito(); onFechar();
  }
  return (
    <Modal aberto={!!doc} titulo={`Vincular ${doc?.codigo}`} onFechar={onFechar} largura="max-w-md"
      rodape={<><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={vincular} disabled={!codigo.trim()}>Vincular</Botao></>}>
      <div className="space-y-3">
        <Rotulo texto="Código do lançamento" ajuda="Ex.: DES-000012, REC-000003, PAG-000005, ATV-000002"><Texto value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus /></Rotulo>
        {doc && doc.vinculos > 0 && <Rotulo texto="Justificativa" obrigatorio ajuda="Este documento já comprova outro registro. Explique por que ele também comprova este."><Texto value={just} onChange={(e) => setJust(e.target.value)} /></Rotulo>}
      </div>
    </Modal>
  );
}

export default function Comprovantes() {
  const { filtro } = useFiltro();
  const { pode } = useSessao();
  const avisar = useAviso();
  const [modo, setModo] = useState<'galeria' | 'tabela'>('galeria');
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [f, setF] = useState({ tipo: '', status: '', categoria: '', fornecedor: '', vinculo: '', valorMin: '', valorMax: '' });
  const [vendo, setVendo] = useState<DocumentoRow | null>(null);
  const [vinculando, setVinculando] = useState<Doc | null>(null);
  const [envio, setEnvio] = useState(false);
  const [versao, setVersao] = useState(0);
  const categorias = useOpcoes({ tabela: 'categorias', rotulo: 'nome', filtro: { tipo: 'despesa' } });
  const fornecedores = useOpcoes({ tabela: 'fornecedores', rotulo: 'nome' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aplicar = useCallback((q: any) => {
    q = q.gte('data_referencia', filtro.inicio).lte('data_referencia', filtro.fim);
    if (f.tipo) q = q.eq('tipo_documento', f.tipo);
    if (f.status) q = q.eq('status', f.status);
    if (f.categoria) q = q.eq('categoria_id', f.categoria);
    if (f.fornecedor) q = q.eq('fornecedor_id', f.fornecedor);
    if (f.vinculo === 'sem') q = q.eq('vinculos', 0);
    if (f.vinculo === 'com') q = q.gt('vinculos', 0);
    const min = lerDinheiro(f.valorMin); const max = lerDinheiro(f.valorMax);
    if (min) q = q.gte('valor', min);
    if (max) q = q.lte('valor', max);
    return q;
  }, [filtro, f]);

  useEffect(() => { setPagina(0); }, [f, filtro]);
  useEffect(() => {
    if (modo !== 'galeria') return;
    setDocs(null);
    aplicar(supabase.from('v_documentos').select('*', { count: 'exact' })).order('data_referencia', { ascending: false }).order('id')
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
      .then(({ data, error, count }: { data: Doc[]; error: unknown; count: number }) => {
        if (error) { avisar('erro', mensagemErro(error)); setDocs([]); return; }
        setDocs(data); setTotal(count ?? 0);
      });
  }, [aplicar, pagina, modo, versao, avisar]);

  const colunas: Coluna[] = [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'data_referencia', titulo: 'Data', tipo: 'data' },
    { chave: 'tipo_documento', titulo: 'Tipo', render: (l) => TIPOS_DOCUMENTO[l.tipo_documento], exportar: (l) => TIPOS_DOCUMENTO[l.tipo_documento] },
    { chave: 'nome_arquivo', titulo: 'Arquivo' },
    { chave: 'descricao', titulo: 'Descrição' },
    { chave: 'despesa_codigo', titulo: 'Lançamento', render: (l) => l.despesa_codigo ?? l.receita_codigo ?? (l.vinculos ? 'outro' : <span className="text-amber-700">sem vínculo</span>), exportar: (l) => l.despesa_codigo ?? l.receita_codigo },
    { chave: 'categoria', titulo: 'Categoria' },
    { chave: 'fornecedor', titulo: 'Fornecedor' },
    { chave: 'valor', titulo: 'Valor', tipo: 'dinheiro' },
    { chave: 'status', titulo: 'Conferência', tipo: 'status' },
    { chave: 'obs_conferente', titulo: 'Obs. do conferente', oculta: true },
  ];

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  return (
    <div>
      <TituloPagina titulo="Central de comprovantes" descricao="Biblioteca digital de notas, recibos, comprovantes e demais documentos. Arquivos ficam em armazenamento privado; links de acesso expiram em 5 minutos."
        acoes={<>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            <button className={`rounded-md px-2 py-1 ${modo === 'galeria' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setModo('galeria')} aria-label="Galeria"><Grid3X3 className="h-4 w-4" /></button>
            <button className={`rounded-md px-2 py-1 ${modo === 'tabela' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setModo('tabela')} aria-label="Tabela"><List className="h-4 w-4" /></button>
          </div>
          {pode('admin', 'financeiro', 'atividades') && <Botao variante="sol" icone={<Upload className="h-4 w-4" />} onClick={() => setEnvio(true)}>Enviar documentos</Botao>}
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4 lg:grid-cols-7">
        <Selecao opcoes={opcoes(TIPOS_DOCUMENTO)} vazio="Todos os tipos" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} aria-label="Tipo" />
        <Selecao opcoes={opcoesStatus(['aguardando', 'validado', 'rejeitado'])} vazio="Toda situação" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Situação" />
        <Selecao opcoes={categorias} vazio="Todas as categorias" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} aria-label="Categoria" />
        <Selecao opcoes={fornecedores} vazio="Todos os fornecedores" value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} aria-label="Fornecedor" />
        <Selecao opcoes={[{ valor: 'com', rotulo: 'Vinculados' }, { valor: 'sem', rotulo: 'Sem vínculo' }]} vazio="Com e sem vínculo" value={f.vinculo} onChange={(e) => setF({ ...f, vinculo: e.target.value })} aria-label="Vínculo" />
        <CampoDinheiro valor={f.valorMin} onChange={(v) => setF({ ...f, valorMin: v })} placeholder="mín." aria-label="Valor mínimo" />
        <CampoDinheiro valor={f.valorMax} onChange={(v) => setF({ ...f, valorMax: v })} placeholder="máx." aria-label="Valor máximo" />
      </div>

      {modo === 'tabela' ? (
        <Tabela tabela="v_documentos" colunas={colunas} busca={['nome_arquivo', 'descricao', 'codigo']} fixos={aplicar} ordem={{ coluna: 'data_referencia', asc: false }}
          onLinha={(l) => setVendo(l as DocumentoRow)} recarregar={versao} nomeExportacao="indice-comprovantes" tituloImpressao="Índice de comprovantes" />
      ) : docs === null ? <Carregando /> : !docs.length ? <Vazio>Nenhum documento encontrado com estes filtros.</Vazio> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {docs.map((d) => (
              <div key={d.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Miniatura doc={d} onClick={() => setVendo(d)} tamanho="h-36 w-full rounded-none border-0" />
                <div className="flex flex-1 flex-col gap-1 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-1"><span className="font-mono text-slate-500">{d.codigo}</span><Selo status={d.status} /></div>
                  <p className="line-clamp-1 font-medium text-slate-800">{TIPOS_DOCUMENTO[d.tipo_documento]}</p>
                  <p className="line-clamp-2 text-slate-500">{d.despesa_descricao ?? d.descricao ?? d.nome_arquivo}</p>
                  <div className="mt-auto flex items-center justify-between pt-1 text-slate-600">
                    <span>{fmtData(d.data_referencia)}</span><span className="font-medium tabular-nums">{d.valor ? dinheiro(d.valor) : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={d.vinculos ? 'text-slate-500' : 'text-amber-700'}>{d.despesa_codigo ?? d.receita_codigo ?? (d.vinculos ? `${d.vinculos} vínculo(s)` : 'Sem vínculo')}</span>
                    {pode('admin', 'financeiro') && <button className="text-slate-500 hover:text-slate-900" onClick={() => setVinculando(d)} aria-label="Vincular" title="Vincular a um lançamento"><Link2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-500">
            {total} documento(s)
            <Botao variante="fantasma" pequeno disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Botao>
            {pagina + 1}/{paginas}
            <Botao variante="fantasma" pequeno disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima"><ChevronRight className="h-4 w-4" /></Botao>
          </div>
        </>
      )}
      <Visualizador doc={vendo} onFechar={() => setVendo(null)} onAlterado={() => setVersao((v) => v + 1)} />
      <Vincular doc={vinculando} onFechar={() => setVinculando(null)} onFeito={() => setVersao((v) => v + 1)} />
      <FormEnvio aberto={envio} onFechar={() => setEnvio(false)} onEnviado={() => setVersao((v) => v + 1)} tipoPadrao="extrato_bancario" />
    </div>
  );
}
