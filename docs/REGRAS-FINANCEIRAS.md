# Regras financeiras e cálculos

Todas as regras abaixo estão implementadas **no banco de dados** (gatilhos, restrições e políticas RLS). Mesmo que alguém use a API diretamente, sem a tela, as regras continuam valendo. Os arquivos citados ficam em `supabase/migrations/`.

## 1. Conceitos de saldo

| Indicador | Fórmula | Observação |
|---|---|---|
| **Saldo inicial do período** | saldo contábil no dia anterior ao início | |
| **Saldo contábil** | Σ saldos iniciais das contas + Σ receitas *recebidas* − Σ *pagamentos* não estornados (até a data) | movimentos anteriores à data do saldo inicial de cada conta são ignorados (já estão no saldo inicial) |
| **Despesas lançadas e não pagas** | Σ (valor total − valor pago) das despesas *lançadas* ou *aprovadas* | |
| **Recursos comprometidos** | Σ (valor total − valor pago) das despesas *contratadas*, *lançadas* ou *aprovadas* | |
| **Saldo disponível** | saldo contábil − recursos comprometidos | |
| **Saldo bancário conciliado** | saldo final do último extrato com conciliação **concluída** de cada conta | só existe após conciliar |
| **Saldo vinculado** | saldo contábil calculado só com a fonte vinculada (e contas exclusivas dela) | um por fonte vinculada |
| **Receitas a receber** | Σ valor previsto das receitas *previstas* no período | **nunca** entram no caixa |

Com filtro de fonte, o saldo inicial só considera contas **exclusivas** daquela fonte (contas compartilhadas não podem ser divididas sem um critério oficial).

## 2. Por que não há desconto duplo

- A **saída de caixa** é sempre a soma dos **pagamentos** (tabela `pagamentos`), nunca o valor da despesa. Uma despesa de R$ 300 paga em duas parcelas aparece como dois pagamentos (R$ 100 + R$ 200); o valor da despesa é usado apenas para saber quanto falta pagar.
- `valor_pago` e `situacao_pagamento` da despesa são recalculados pelo banco a cada pagamento ou estorno; o usuário não consegue editá-los.
- O banco recusa pagamentos que ultrapassem o saldo devedor.

## 3. Situações

**Receita:** `prevista` → `recebida`; ou `cancelada` (com justificativa ≥ 10 caracteres). "Atrasada" = prevista com data passada (calculado, não gravado).

**Despesa:** `prevista`, `contratada`, `lancada`, `aprovada`, `paga` (automática quando quitada), `cancelada`, `reembolsada`.
- Despesa *prevista* não pode receber pagamento.
- Para cancelar uma despesa com pagamentos, é preciso **estornar** os pagamentos antes.
- Cancelada/reembolsada não volta a ficar ativa (registre outro lançamento).

**Pagamento:** não pode ser editado nem excluído. Correção = **estorno** (com justificativa) + novo pagamento. Estorno não pode ser desfeito.

**Conferência** (receitas e despesas): `pendente`, `em_analise`, `aprovado`, `rejeitado`. Só *conferente* ou *administrador* alteram, por meio da função `conferir_lancamento`. Todo lançamento novo nasce *pendente*; se um lançamento já conferido for editado, ele **volta para pendente** automaticamente.

## 4. Documentação (checklist)

Cada despesa recebe automaticamente os itens de `checklist_modelos` aplicáveis à sua categoria, fonte e valor. Critérios:

- `doc:tipo1|tipo2` — atendido quando há documento desses tipos anexado à despesa **ou a um de seus pagamentos**, desde que não esteja rejeitado;
- `campo:justificativa` — justificativa preenchida;
- `campo:fornecedor` — fornecedor com CPF/CNPJ.

Situação documental da despesa:

| Situação | Quando |
|---|---|
| `sem_documentos` | nenhum documento e itens obrigatórios pendentes |
| `incompleta` | algum item obrigatório não atendido nem dispensado |
| `rejeitada` | algum documento foi devolvido para correção pelo conferente |
| `aguardando_conferencia` | itens atendidos, mas há documentos ainda não conferidos |
| `validada` | itens atendidos e todos os documentos validados |

**Anexar não valida.** Só a conferência (função `conferir_documento`) muda o documento para *validado* ou *rejeitado* (rejeição exige motivo). Dispensar um item exige justificativa e perfil de conferente/administrador.

Um mesmo documento só pode ser vinculado a mais de um registro com justificativa.

## 5. Períodos

- Todo lançamento pertence a um período; se não informado, o banco escolhe o período que contém a data. Sem período cadastrado, o lançamento é recusado.
- **Período fechado**: receitas, despesas e pagamentos com data no período não podem ser incluídos, alterados, estornados ou ter documentos desvinculados.
  - Exceção controlada: uma despesa de período fechado pode ser **quitada por um pagamento em período aberto** (o valor pago é atualizado pelo sistema, os dados da despesa não).
  - Anexar documentos novos a lançamentos de período fechado é permitido (completa pendências) e fica auditado.
- Fechar: administrador ou financeiro. **Reabrir: só administrador, com justificativa** (fica em `periodo_eventos` e na auditoria).

## 6. Fontes vinculadas e contas exclusivas

- Uma conta com "fonte exclusiva" só aceita receitas e pagamentos daquela fonte.
- Remanejamentos de orçamento entre fontes diferentes são **bloqueados** quando uma delas é vinculada.
- O saldo de cada fonte vinculada é exibido separadamente no painel.

## 7. Orçamento

- **Executado** = pagamentos (não estornados) das despesas da mesma fonte e categoria, com data dentro da validade do item.
- **Comprometido** = saldo devedor das despesas contratadas/lançadas/aprovadas da mesma fonte e categoria.
- **Saldo** = atualizado − executado − comprometido; **atualizado** = revisado (se houver) ou aprovado.
- Alerta quando (executado + comprometido) ≥ percentual de alerta do item (padrão 80%); crítico acima de 100%.
- Remanejamento: solicitado (financeiro) → **autorizado/negado por administrador** com o documento que o fundamenta. Só a autorização altera os valores.

## 8. Duplicidades

- **Bloqueio:** mesmo fornecedor + mesmo número de documento fiscal em despesas não canceladas (índice único).
- **Alerta:** mesmo fornecedor e mesmo valor com datas até 3 dias de diferença. O usuário pode marcar "não é duplicata" com justificativa (`duplicidades_revisadas`).

## 9. Conciliação bancária

- Extrato importado por conta e período, com saldo inicial e final. Se saldo inicial + movimentos ≠ saldo final, o sistema avisa (arquivo incompleto).
- Sugestões: mesmo valor e data a até 5 dias. **Nada é conciliado sem confirmação.**
- O banco valida cada correspondência: mesma conta, mesmo valor, pagamento não estornado, receita recebida; cada pagamento/receita só pode ser conciliado uma vez.
- Linhas sem lançamento: criar o lançamento (tarifa, rendimento) ou justificar.
- Concluir exige zero linhas pendentes; quem conclui, se diferente de quem importou, fica registrado como conferente. Reabrir: só administrador.
- Diferença extrato × sistema = saldo final do extrato − saldo contábil da conta na data final.

## 10. Alertas

Gerados pela visão `v_alertas`: comprovante ausente/incompleto, documento rejeitado, sem categoria, sem beneficiário, orçamento ≥ alerta, possível duplicidade, extrato com pendências ou que não fecha, prazos próximos/vencidos, receita atrasada, categoria fora do orçamento da fonte, despesa fora da vigência do instrumento. **Alertas pedem revisão humana; nunca declaram irregularidade.**

## 11. Resultados sociais

- **Atendimentos (participações)** = soma de "quantidade de participações" das atividades.
- **Participantes únicos** = pessoas distintas nas listas nominais do período.
- Os dois números nunca são somados ou confundidos. Listas nominais só são visíveis para administrador e responsável por atividades.

## 12. Precisão monetária

- Banco: `numeric(14,2)`. Interface: somas feitas em centavos inteiros (`src/lib/formato.ts`); totais de tela e de relatório usam as mesmas consultas do banco.
- Valor total da despesa = arredondamento de (quantidade × valor unitário) a 2 casas − desconto, calculado no banco.

## 13. Exclusões e auditoria

- Receitas, despesas, pagamentos, documentos e períodos **não podem ser excluídos** (gatilho bloqueia até o dono do banco). Cadastros auxiliares sem histórico (ex.: lista de necessidades) podem.
- Toda inclusão, alteração e exclusão em 29 tabelas é gravada em `auditoria` (antes/depois, usuário, data/hora). A tabela de auditoria não aceita alteração, exclusão nem `TRUNCATE`.
