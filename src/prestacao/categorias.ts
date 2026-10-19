import type { TipoLancamento } from './tipos';

export const CATEGORIAS: Record<TipoLancamento, string[]> = {
  entrada: ['Doações via PIX', 'Doações de empresas', 'Eventos e campanhas', 'Parcerias e repasses', 'Saldo anterior', 'Outras entradas'],
  saida: ['Alimentação', 'Material esportivo', 'Material pedagógico', 'Transporte', 'Eventos e atividades', 'Serviços e manutenção', 'Outras despesas'],
};

export const CATEGORIA_OUTRAS: Record<TipoLancamento, string> = { entrada: 'Outras entradas', saida: 'Outras despesas' };

/** Categorias digitadas livremente entram nos gráficos como "Outras", para manter tudo comparável. */
export function categoriaDoGrafico(tipo: TipoLancamento, categoria: string): string {
  return CATEGORIAS[tipo].includes(categoria) ? categoria : CATEGORIA_OUTRAS[tipo];
}

export const EXEMPLOS_DESCRICAO: Record<TipoLancamento, string> = {
  entrada: 'Ex.: Doações recebidas por PIX em março',
  saida: 'Ex.: Lanche para o treino de sábado',
};
