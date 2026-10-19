// Rótulos e cores dos estados exibidos na interface.

export type Tom = 'neutro' | 'ok' | 'atencao' | 'erro' | 'info' | 'roxo';

export const PAPEIS: Record<string, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  atividades: 'Responsável por atividades',
  conferente: 'Conferente',
  visualizador: 'Visualizador',
};

export const STATUS: Record<string, [string, Tom]> = {
  // receitas
  prevista: ['Prevista', 'info'],
  recebida: ['Recebida', 'ok'],
  atrasada: ['Atrasada', 'erro'],
  cancelada: ['Cancelada', 'neutro'],
  // despesas
  contratada: ['Contratada', 'info'],
  lancada: ['Lançada', 'atencao'],
  aprovada: ['Aprovada', 'info'],
  paga: ['Paga', 'ok'],
  parcialmente_paga: ['Paga parcialmente', 'atencao'],
  reembolsada: ['Reembolsada', 'roxo'],
  em_aberto: ['Em aberto', 'atencao'],
  parcial: ['Parcial', 'atencao'],
  quitada: ['Quitada', 'ok'],
  // documentação
  sem_documentos: ['Sem documentos', 'erro'],
  incompleta: ['Incompleta', 'atencao'],
  aguardando_conferencia: ['Aguardando conferência', 'info'],
  rejeitada: ['Devolvida p/ correção', 'erro'],
  validada: ['Validada', 'ok'],
  // documentos
  aguardando: ['Aguardando conferência', 'info'],
  validado: ['Validado', 'ok'],
  rejeitado: ['Rejeitado p/ correção', 'erro'],
  // conferência
  pendente: ['Pendente', 'atencao'],
  em_analise: ['Em análise', 'info'],
  aprovado: ['Aprovado', 'ok'],
  // períodos / conciliação
  aberto: ['Aberto', 'ok'],
  fechado: ['Fechado', 'neutro'],
  em_andamento: ['Em andamento', 'atencao'],
  concluida: ['Concluída', 'ok'],
  conciliado: ['Conciliado', 'ok'],
  ignorado: ['Justificado', 'neutro'],
  // remanejamento
  solicitado: ['Solicitado', 'atencao'],
  autorizado: ['Autorizado', 'ok'],
  negado: ['Negado', 'erro'],
  // obrigações
  em_preparacao: ['Em preparação', 'info'],
  em_revisao: ['Em revisão', 'info'],
  aguardando_documentos: ['Aguardando documentos', 'atencao'],
  pronta_para_envio: ['Pronta para envio', 'info'],
  enviada: ['Enviada', 'ok'],
  aprovada_com_ressalvas: ['Aprovada c/ ressalvas', 'atencao'],
  devolvida_para_correcao: ['Devolvida p/ correção', 'erro'],
  // doações em bens
  recebido: ['Recebido', 'ok'],
  distribuido: ['Distribuído', 'info'],
  em_estoque: ['Em estoque', 'neutro'],
  cancelado: ['Cancelado', 'neutro'],
  // contatos
  novo: ['Novo', 'atencao'],
  respondido: ['Respondido', 'ok'],
  arquivado: ['Arquivado', 'neutro'],
  // gravidade
  critico: ['Crítico', 'erro'],
  atencao: ['Atenção', 'atencao'],
};

export function rotuloStatus(s: string | null | undefined): string {
  if (!s) return '—';
  return STATUS[s]?.[0] ?? s.replace(/_/g, ' ');
}

export const TIPOS_DOCUMENTO: Record<string, string> = {
  nota_fiscal: 'Nota fiscal',
  recibo: 'Recibo',
  comprovante_pix: 'Comprovante de PIX',
  comprovante_transferencia: 'Comprovante de transferência',
  boleto: 'Boleto',
  comprovante_quitacao: 'Comprovante de quitação',
  extrato_bancario: 'Extrato bancário',
  contrato: 'Contrato',
  orcamento_cotacao: 'Orçamento / cotação',
  autorizacao_compra: 'Autorização de compra',
  relatorio: 'Relatório',
  lista_materiais: 'Lista de materiais',
  foto_produto: 'Foto de produto/material',
  foto_atividade: 'Foto de atividade',
  lista_presenca: 'Lista de presença',
  autorizacao_imagem: 'Autorização de uso de imagem',
  comprovante_recebimento: 'Comprovante de recebimento',
  plano_trabalho: 'Plano de trabalho',
  protocolo_envio: 'Protocolo de envio',
  outro: 'Outro',
};

export const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Boleto', 'Cartão de débito', 'Cartão de crédito', 'Dinheiro', 'Cheque', 'Débito automático'];

export const STATUS_DESPESA_EDITAVEIS = ['prevista', 'contratada', 'lancada', 'aprovada'];

export const TIPOS_INSTRUMENTO = ['Termo de fomento', 'Termo de colaboração', 'Acordo de cooperação', 'Convênio', 'Contrato de patrocínio', 'Emenda parlamentar', 'Edital / prêmio', 'Outro'];

export function opcoes(mapa: Record<string, string> | string[]): { valor: string; rotulo: string }[] {
  if (Array.isArray(mapa)) return mapa.map((v) => ({ valor: v, rotulo: v }));
  return Object.entries(mapa).map(([valor, rotulo]) => ({ valor, rotulo }));
}

export function opcoesStatus(chaves: string[]): { valor: string; rotulo: string }[] {
  return chaves.map((c) => ({ valor: c, rotulo: rotuloStatus(c) }));
}
