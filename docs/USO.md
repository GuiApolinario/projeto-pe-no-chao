# Manual de uso

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **Administrador** | tudo: cadastros, usuários, site, reabrir períodos, autorizar remanejamentos, backup |
| **Financeiro** | receitas, despesas, pagamentos, comprovantes, orçamento, conciliação, fechar períodos, prazos |
| **Responsável por atividades** | atividades, participantes (lista nominal), fotos e evidências |
| **Conferente** | consulta tudo (exceto listas nominais), confere lançamentos e documentos, dispensa itens do checklist, vê a auditoria |
| **Visualizador** | consulta dados não sensíveis (sem dados bancários, documentos sensíveis ou dados de crianças) |

As permissões são aplicadas pelo banco de dados: esconder um botão não é a única proteção.

## Rotina do dia a dia (financeiro)

### Entrou dinheiro
1. **Receitas → Nova receita** → situação *Recebida*, data, valor, conta, categoria e fonte.
2. Salve e **anexe o comprovante** (PIX, extrato ou recibo).
3. Doação em alimentos/materiais? Use **Doações em bens** (não entra no caixa).

### Comprou algo
1. **Despesas → Nova despesa**: descrição completa, fornecedor (cadastre na hora se for novo, com CPF/CNPJ), categoria, fonte, valores, datas, número da nota e justificativa.
2. Salve → **Anexar** a nota fiscal ou recibo (pode fotografar com o celular).
3. **Registrar pagamento** com a data e o valor efetivamente pagos e a conta usada. Pagou parcelado? Registre cada parcela quando for paga.
4. Anexe o comprovante do PIX/transferência.
5. Confira o **checklist documental** na própria tela: o que falta aparece com a explicação.

### Errou?
- Ainda não conferido e período aberto: edite normalmente (fica no histórico).
- Pagamento errado: **Estornar** (com justificativa) e registrar de novo.
- Lançamento indevido: **Cancelar** com justificativa. Nada é apagado.

## Conferência (conferente)
1. **Alertas e pendências** ou **Movimentações** com filtro *Conferência = Pendente*.
2. Abra o lançamento, abra cada documento (visualizador de imagem/PDF) e clique **Validar** ou **Rejeitar p/ correção** (motivo obrigatório).
3. Registre a conferência do lançamento (**Aprovar / Em análise / Rejeitar**).

## Fechamento mensal (sugestão)
1. **Conciliação bancária → Importar extrato** (OFX ou CSV do banco) de cada conta.
2. Confirme as correspondências sugeridas; trate tarifas e rendimentos; justifique o que não tiver lançamento; **Concluir conciliação**.
3. Resolva os **Alertas** (documentos faltando, sem categoria, duplicidades).
4. Conferente revisa os lançamentos do mês.
5. **Relatórios → Relatório financeiro do período** → PDF, Excel e **Pacote de documentos (ZIP)**.
6. **Cadastros → Períodos → Fechar**.
7. **Backup** completo.
8. Se for o caso, marque o período para **publicar no site** (Portal da transparência).

## Atividades e resultados
1. **Atividades → Novo**: data, tipo, bairro, número de participações, descrição, resultados e dificuldades.
2. Anexe fotos (marque se há autorização de imagem), listas de presença e relatórios.
3. (Opcional) Em **Participantes (restrito)**, cadastre as crianças com o mínimo necessário e inclua-as na atividade para contar **participantes únicos**.
4. Marque **Publicar no site** apenas para atividades sem exposição indevida: o site mostra somente título, data, bairro, descrição e número de participações.

## Site e doações (administrador)
- **Site e doações**: chave PIX (com pré-visualização do QR Code), contatos, texto "Quem somos", campanha com meta, lista de necessidades, portal da transparência e mensagens recebidas pelos formulários.
- Toda doação recebida pelo PIX deve ser lançada em **Receitas** (o banco não comunica automaticamente o sistema).

## Filtros, tabelas e exportação
- O seletor no topo define o **período** (mês, ano, período de prestação de contas ou intervalo) e a **fonte de recurso** para todas as telas.
- Tabelas: busca, filtros combinados, ordenação por coluna (clique no título), totais que respeitam os filtros, exportação **CSV**, **Excel** e **Imprimir (PDF)**.
- Gráficos do painel são clicáveis: levam à lista dos lançamentos que compõem o valor.

## Estrutura de pastas para arquivamento físico/digital
Veja `docs/ESTRUTURA-PASTAS.md`.
