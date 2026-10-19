# Importar dados existentes

## 1. Antes de importar
1. Faça a configuração inicial (docs/INSTALACAO.md, Etapa 5): **períodos**, **fontes**, **contas** (com saldo inicial na data de início do controle) e **categorias**.
2. Decida a data de corte: tudo antes dela entra apenas como **saldo inicial** das contas; depois dela, lançamento a lançamento.

## 2. Receitas e despesas de planilhas antigas
Modelos: `docs/modelos/importar-receitas.csv` e `docs/modelos/importar-despesas.csv` (separador `;`, valores como `1.234,56`, datas `dd/mm/aaaa`). Abra no Excel, apague as linhas de exemplo, preencha e salve como **CSV (separado por ponto e vírgula) UTF-8**.

- Categoria, fonte e conta devem ter **exatamente o nome** cadastrado no sistema.
- Fornecedores que não existirem serão criados.
- Despesas com `data_pagamento` e `valor_pago` recebem o pagamento correspondente.

```bash
export SUPABASE_URL=https://SEU-PROJETO.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=chave-service-role       # só no seu computador
node scripts/importar.mjs despesas minhas-despesas.csv           # simulação: mostra problemas, não grava
node scripts/importar.mjs despesas minhas-despesas.csv --gravar  # grava
```

Todas as regras continuam valendo (período fechado, NF duplicada, conta exclusiva de fonte…). Lançamentos importados recebem a observação "Importado de planilha" e nascem **pendentes de conferência**.

## 3. Comprovantes antigos
Organize os arquivos (ver `docs/ESTRUTURA-PASTAS.md`) e anexe em cada lançamento, ou envie em lote pela **Central de comprovantes → Enviar documentos** e depois use o botão de vínculo (🔗) informando o código do lançamento (DES-…, REC-…).

## 4. Extratos bancários
Use **Conciliação bancária → Importar extrato** (OFX ou CSV) mês a mês.

## 5. Atividades
Cadastre pela tela **Atividades**. Para grandes volumes, peça ao responsável técnico um script no mesmo formato do `scripts/importar.mjs`.
