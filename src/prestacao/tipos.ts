export type TipoLancamento = 'entrada' | 'saida';

export interface Anexo {
  path: string;
  nome?: string;
  tipo?: string;
  /** só existe na área da equipe: true = foto aparece no site */
  publico?: boolean;
}

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  data: string; // aaaa-mm-dd
  valor: number;
  categoria: string;
  descricao: string;
  contraparte: string | null;
  anexos: Anexo[];
  atualizado_em: string;
  // somente na área da equipe
  mostrar_contraparte?: boolean;
  publicar?: boolean;
  observacao_interna?: string | null;
}

export const BUCKET_PUBLICO = 'prestacao-publica';
export const BUCKET_PRIVADO = 'prestacao-privada';
