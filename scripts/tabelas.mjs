// Ordem de dependência das tabelas (usada no backup e na restauração).
export const TABELAS = [
  'projeto', 'perfis', 'periodos', 'periodo_eventos', 'instrumentos', 'fontes_recurso', 'contas_bancarias', 'categorias', 'metas', 'fornecedores',
  'documentos', 'documento_vinculos', 'receitas', 'despesas', 'pagamentos', 'duplicidades_revisadas', 'checklist_modelos', 'despesa_checklist',
  'doacoes_bens', 'orcamento_itens', 'remanejamentos', 'extratos', 'extrato_linhas', 'atividades', 'atividade_despesas', 'beneficiarios',
  'participacoes', 'obrigacoes', 'configuracoes', 'necessidades', 'contatos', 'auditoria',
];
// sequência → [tabela, prefixo do código]
export const SEQUENCIAS = {
  seq_documento: ['documentos', 'DOC-'], seq_receita: ['receitas', 'REC-'], seq_despesa: ['despesas', 'DES-'],
  seq_pagamento: ['pagamentos', 'PAG-'], seq_doacao_bem: ['doacoes_bens', 'BEM-'], seq_atividade: ['atividades', 'ATV-'],
  seq_beneficiario: ['beneficiarios', 'BEN-'],
};
