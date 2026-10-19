// Listagem + formulário em modal para cadastros auxiliares.
import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { mensagemErro, supabase } from '../lib/supabase';
import { Botao, Modal, useAviso, useConfirmacao } from './ui';
import { Formulario, limparCacheOpcoes, normalizar, validar, type Campo, type Valores } from './Formulario';
import { Tabela, type Coluna, type FiltroTabela, type Linha } from './Tabela';

interface Props {
  tabela: string;
  titulo: string;
  campos: Campo[];
  colunas: Coluna[];
  busca?: string[];
  filtros?: FiltroTabela[];
  ordem?: { coluna: string; asc?: boolean };
  padrao?: Valores;
  podeEditar: boolean;
  podeExcluir?: boolean;
  select?: string;
  fixos?: (q: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  totais?: string[];
  colunasForm?: 2 | 3;
  depoisDeSalvar?: (registro: Linha) => void;
  extraModal?: (registro: Valores) => ReactNode;
  ferramentas?: ReactNode;
  destacar?: (l: Linha) => boolean;
  acoesExtras?: (l: Linha, recarregar: () => void) => ReactNode;
}

export function CadastroSimples(p: Props) {
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [editando, setEditando] = useState<Valores | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erros, setErros] = useState<string[]>([]);

  async function salvar() {
    if (!editando) return;
    const faltando = validar(p.campos, editando);
    setErros(faltando);
    if (faltando.length) return;
    setSalvando(true);
    try {
      const dados = normalizar(p.campos, editando);
      const q = editando.id
        ? supabase.from(p.tabela).update(dados).eq('id', editando.id).select().single()
        : supabase.from(p.tabela).insert(dados).select().single();
      const { data, error } = await q;
      if (error) throw error;
      if (!data) throw new Error('Registro não foi salvo (verifique suas permissões).');
      avisar('ok', 'Registro salvo com sucesso.');
      limparCacheOpcoes(p.tabela);
      setEditando(null);
      setVersao((v) => v + 1);
      p.depoisDeSalvar?.(data as Linha);
    } catch (e) {
      avisar('erro', mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(l: Linha) {
    const ok = await confirmar({ titulo: 'Excluir registro', texto: 'Esta ação será registrada na auditoria. Deseja continuar?', perigo: true, rotuloOk: 'Excluir' });
    if (!ok) return;
    const { error, count } = await supabase.from(p.tabela).delete({ count: 'exact' }).eq('id', l.id);
    if (error) avisar('erro', mensagemErro(error));
    else if (!count) avisar('erro', 'O registro não pôde ser excluído (em uso ou sem permissão).');
    else { avisar('ok', 'Registro excluído.'); limparCacheOpcoes(p.tabela); setVersao((v) => v + 1); }
  }

  return (
    <>
      <Tabela
        tabela={p.tabela}
        select={p.select}
        colunas={p.colunas}
        busca={p.busca}
        filtros={p.filtros}
        ordem={p.ordem}
        fixos={p.fixos}
        totais={p.totais}
        recarregar={versao}
        nomeExportacao={p.tabela}
        tituloImpressao={p.titulo}
        onLinha={p.podeEditar ? (l) => { setErros([]); setEditando({ ...l }); } : undefined}
        destacar={p.destacar}
        ferramentas={<>
          {p.podeEditar && <Botao variante="sol" icone={<Plus className="h-4 w-4" />} onClick={() => { setErros([]); setEditando({ ...(p.padrao ?? {}) }); }}>Novo</Botao>}
          {p.ferramentas}
        </>}
        acoes={(p.podeEditar || p.acoesExtras) ? (l) => (
          <div className="flex justify-end gap-1">
            {p.acoesExtras?.(l, () => setVersao((v) => v + 1))}
            {p.podeEditar && <Botao variante="fantasma" pequeno onClick={() => { setErros([]); setEditando({ ...l }); }} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Botao>}
            {p.podeExcluir && <Botao variante="fantasma" pequeno onClick={() => excluir(l)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5 text-red-600" /></Botao>}
          </div>
        ) : undefined}
      />
      <Modal aberto={!!editando} titulo={`${editando?.id ? 'Editar' : 'Novo'} — ${p.titulo}`} onFechar={() => setEditando(null)} largura="max-w-3xl"
        rodape={<>
          <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={salvando}>Salvar</Botao>
        </>}>
        {editando && (
          <div className="space-y-4">
            {erros.length > 0 && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Preencha: {erros.join(', ')}.</p>}
            <Formulario campos={p.campos} valores={editando} onChange={setEditando} colunas={p.colunasForm} />
            {p.extraModal?.(editando)}
          </div>
        )}
      </Modal>
      {elemento}
    </>
  );
}
