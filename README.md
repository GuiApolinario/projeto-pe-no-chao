<p align="center"><img src="public/logo-640.jpg" alt="Projeto Pé no Chão" width="360"></p>

# Projeto Pé no Chão — site e sistema de prestação de contas

Site institucional com área de doações e sistema completo de gestão financeira e prestação de contas do **Projeto Pé no Chão** (Votorantim/SP — Jardim Dandara e Jardim Cerrado).

Endereço: **https://projetopenochao.ggsistemas.dev.br**

## O que tem

**Site público**
- **Prestação de contas** (aba): entrou × saiu, gráficos, onde o dinheiro foi aplicado e comprovantes em fotos — alimentada por uma área simples da equipe (veja docs/PRESTACAO.md).
- Página inicial com a identidade visual do projeto, quem somos, atividades recentes e campanha com meta.
- **Doe**: PIX com QR Code e "copia e cola" (com valores sugeridos), lista do que o projeto precisa, doação de alimentos/materiais, voluntariado e parcerias.
- **Transparência**: totais recebidos e pagos por período publicado e onde o dinheiro foi aplicado — sem nomes de doadores, fornecedores ou crianças.
- Contato com consentimento LGPD e página de privacidade.

**Editar o site** (`/editar-site`, sem banco de dados): a equipe muda **todos os textos e imagens**, o PIX (com envio da imagem do QR Code) e os contatos; tudo começa em branco/original e é gravado no GitHub.

**Área da equipe da prestação de contas** (`/prestacao-de-contas/gerenciar`): lançar entradas, gastos e comprovantes; mudar PIX, contatos, textos, campanha e necessidades **sem mexer no GitHub**; gerenciar acessos e ver a saúde do banco. Um robô diário (GitHub Actions) mantém o banco ativo.

**Sistema administrativo completo** (`/admin`, somente equipe convidada)
- Painel financeiro com 12+ indicadores, alertas e 6 gráficos clicáveis.
- Receitas, despesas (pagamentos parciais, estornos, cancelamentos justificados), doações em bens separadas do caixa.
- Central de comprovantes (fotos e PDFs em armazenamento privado), checklist documental configurável e conferência.
- Orçamento aprovado x executado, remanejamentos com autorização, fontes vinculadas.
- Conciliação bancária com importação OFX/CSV e confirmação humana.
- Atividades, participantes (acesso restrito), painel de resultados sociais (participantes únicos x atendimentos).
- Relatórios em PDF, Excel e pacote ZIP de documentos; prazos de prestação de contas.
- Perfis de acesso, auditoria imutável, fechamento de períodos, backup e restauração.

## Tecnologia
React + TypeScript + Vite + Tailwind · Supabase (PostgreSQL, Auth, Storage) com regras e permissões no banco (RLS) · Recharts · jsPDF · ExcelJS.

## Documentação
| Documento | Conteúdo |
|---|---|
| [docs/EDITAR-O-SITE.md](docs/EDITAR-O-SITE.md) | **Editar o site sem programar**: textos, imagens, QR Code do PIX e contatos (sem banco de dados) |
| [docs/PRESTACAO.md](docs/PRESTACAO.md) | **Aba “Prestação de contas”** (gráficos + área da equipe com fotos): como ver, ativar e usar |
| [docs/INSTALACAO.md](docs/INSTALACAO.md) | **Passo a passo**: Supabase, GitHub, publicação na GGsistemas e DNS no Registro.br |
| [docs/USO.md](docs/USO.md) | Manual de uso e rotina de fechamento mensal |
| [docs/REGRAS-FINANCEIRAS.md](docs/REGRAS-FINANCEIRAS.md) | Regras de integridade e fórmulas de cada indicador |
| [docs/BACKUP.md](docs/BACKUP.md) | Plano de backup e recuperação |
| [docs/IMPORTACAO.md](docs/IMPORTACAO.md) | Como importar dados existentes |
| [docs/ESTRUTURA-PASTAS.md](docs/ESTRUTURA-PASTAS.md) | Modelo de arquivamento dos documentos |
| [docs/TESTES.md](docs/TESTES.md) | Testes realizados e limitações |

## Começo rápido (desenvolvimento)
```bash
npm install
cp .env.example .env    # URL e chave anon do Supabase
npm run dev
```

## Estrutura
```
supabase/prestacao/    SQL único da aba Prestação de contas (simples)
supabase/migrations/   esquema, regras, segurança (RLS) e cálculos — aplicar em ordem
supabase/tests/        testes do banco (cenários do escopo)
supabase/demo/         dados FICTÍCIOS para um projeto de demonstração separado
src/site/              site público
src/admin/             telas do sistema administrativo
src/components/        tabela, formulários, anexos, interface
src/lib/               dinheiro/datas, PIX, extratos, PDF, exportação, sessão
scripts/               backup, restauração, importação e testes
deploy/                configuração de servidor (Nginx); public/.htaccess para Apache
```
