# Testes realizados e limitações

## Como rodar

```bash
npm test               # testes unitários (formatação, dinheiro, PIX, extratos, exportação)
npm run test:db        # migrações + mais de 60 verificações em PostgreSQL real com RLS
bash scripts/testar-restauracao.sh   # backup → restauração → comparação
```

Os três rodam automaticamente no GitHub Actions (`.github/workflows/ci.yml`) a cada envio.

## Cenários obrigatórios (item 20 do escopo)

| Cenário | Onde é verificado | Resultado |
|---|---|---|
| Receita cadastrada atualiza o saldo | `supabase/tests/10_cenarios.sql` §1 | ✔ saldo 1.000 + 5.000 = 6.000 |
| Despesa com nota fiscal e comprovante | §2 + navegador | ✔ paga, aguardando conferência → validada após conferência |
| Despesa sem comprovante gera alerta | §3 | ✔ |
| Pagamento parcial e quitação posterior | §4 + navegador | ✔ parcial (100/300) → quitada; excesso recusado |
| Cancelamento e estorno | §5 | ✔ estorno reabre saldo devedor; cancelamento exige estorno e justificativa; exclusão bloqueada |
| Lançamento potencialmente duplicado | §6 + navegador | ✔ NF repetida bloqueada; mesmo fornecedor/valor/data próxima alertado; revisão humana remove alerta |
| Orçamento x execução | §7 | ✔ executado, comprometido, saldo; alertas ≥ 80% e > 100%; remanejamento só com autorização |
| Conciliação com diferença identificável | §8 | ✔ valor divergente recusado; tarifa não lançada gera diferença de −5,00 |
| Filtros por mês, categoria e fonte | §9 | ✔ |
| Relatório mensal e anual | navegador | ✔ PDF paginado, Excel com 7 abas, ZIP com comprovantes por mês/categoria e índice |
| Imagens e PDFs | navegador | ✔ upload com validação de tipo/assinatura do arquivo, miniatura, visualizador |
| Permissões entre usuários | §13 | ✔ visualizador não grava nem vê dados bancários; financeiro não vê crianças; conferente não lança |
| Backup e restauração | `testar-restauracao.sh` | ✔ contagens e saldo idênticos; numeração continua |
| Documentos privados | §13 | ✔ anônimo não acessa arquivos; documento sensível oculto para visualizador |
| Totais dos gráficos | §9–10 | ✔ série mensal e despesas por categoria = soma dos pagamentos; indicadores do painel conferidos um a um |
| Período fechado | §11 | ✔ inclusão/edição/pagamento bloqueados; reabertura só por admin com justificativa |
| Auditoria imutável | §14 | ✔ nem admin nem o dono do banco alteram/apagam |
| Transparência sem dados pessoais | §13 | ✔ sem nomes de crianças ou fornecedores |

Além disso, o aplicativo foi executado em navegador (Chromium) contra um PostgREST real sobre o mesmo banco: todas as 19 telas administrativas e 5 páginas públicas abriram sem erros de API, e os fluxos de configurar PIX, lançar despesa, anexar nota, pagar parcialmente, gerar relatórios e enviar contato anônimo funcionaram. Também foi verificada a largura em celular (390 px) sem rolagem horizontal.

## Limitações conhecidas

- **Testes contra o Supabase real**: os testes usam PostgreSQL 16 com uma simulação mínima de `auth` e `storage`. Após aplicar as migrações no projeto real, faça o roteiro rápido de aceitação abaixo.
- **Storage**: os limites de tamanho e tipos de arquivo são definidos no bucket (15 MB máx.) e validados no navegador (limite configurável, padrão 10 MB, e assinatura do arquivo). Arquivos enviados não podem ser apagados pela interface (por segurança); um arquivo enviado sem que o registro tenha sido salvo fica órfão no Storage.
- **Convites de usuários** são feitos no painel do Supabase (o site não guarda a chave de serviço necessária para criar usuários).
- **OFX/CSV**: o leitor reconhece os formatos mais comuns; se o banco usar um layout diferente, ajuste as colunas do CSV para `Data;Histórico;Documento;Valor`.
- **PIX**: o QR Code é estático (sem confirmação automática de pagamento). As doações precisam ser lançadas em Receitas a partir do extrato.
- **Relatórios** não substituem automaticamente o modelo oficial do financiador; use as planilhas exportadas para preenchê-lo.
- **Filtro por fonte no saldo inicial** considera apenas contas exclusivas da fonte.
- Os dados de demonstração (`supabase/demo`) são fictícios e devem ficar em um projeto separado.

## Roteiro rápido de aceitação no Supabase real (15 minutos)

1. Entrar como administrador; criar período, fonte, conta e fornecedor.
2. Lançar uma receita de R$ 10,00 e ver o painel atualizar.
3. Lançar uma despesa de R$ 5,00, anexar uma foto, pagar R$ 2,00 e depois R$ 3,00.
4. Abrir o documento no visualizador; em outra janela anônima, colar a URL do arquivo após 5 minutos: deve expirar.
5. Convidar um usuário visualizador e verificar que ele não vê **Cadastros → Contas bancárias** nem **Participantes**.
6. Gerar o relatório do mês em PDF.
7. Cancelar a receita e a despesa de teste (com justificativa) — ou fazer esse roteiro no projeto de demonstração.
