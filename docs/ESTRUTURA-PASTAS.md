# Modelo de estrutura de pastas para arquivamento

No sistema, os arquivos ficam no Storage privado e são localizados pelos códigos dos lançamentos. Para a **cópia de segurança** e para entregas ao financiador, use a mesma organização do *Pacote de documentos (ZIP)* gerado em Relatórios:

```
Prestacao-de-contas/
└── 2026/
    ├── 00-Instrumentos/                  termo de fomento, plano de trabalho, aditivos
    ├── 2026-01/
    │   ├── 00-relatorio-2026-01.pdf      relatório do período (gerado pelo sistema)
    │   ├── 00-planilhas-2026-01.xlsx
    │   ├── 01-Extratos/                  extratos bancários de cada conta
    │   ├── 02-Receitas/                  REC-000001_DOC-000010_comprovante_pix.pdf
    │   ├── 03-Despesas/
    │   │   ├── Alimentacao e lanches/    DES-000004_DOC-000015_nota_fiscal.pdf
    │   │   └── Materiais esportivos/     DES-000007_DOC-000021_comprovante_pix.jpg
    │   ├── 04-Atividades/                listas de presença, fotos autorizadas, relatórios
    │   └── 05-Protocolos/                comprovante de entrega da prestação de contas
    ├── 2026-02/
    └── …
```

Regras de nomeação: `CÓDIGO-DO-LANÇAMENTO_CÓDIGO-DO-DOCUMENTO_tipo.extensão`. Assim, qualquer arquivo leva ao lançamento no sistema e vice-versa.

Documentos com dados pessoais (listas de presença, autorizações de imagem) devem ficar em pasta com acesso restrito.
