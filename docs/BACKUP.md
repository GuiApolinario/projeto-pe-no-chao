# Plano de backup e recuperação

## O que precisa ser protegido

1. **Banco de dados** (lançamentos, cadastros, auditoria, usuários).
2. **Arquivos** do bucket `documentos` (notas, recibos, comprovantes, fotos).
3. **Código** — já está no GitHub.

## Rotina recomendada

| Quando | O quê | Como |
|---|---|---|
| Diário (automático) | Banco | Backups automáticos do Supabase. No plano gratuito eles são limitados; para dados de prestação de contas, considere o plano Pro (backups diários com retenção) |
| Semanal | Banco + arquivos | `npm run backup` (script abaixo) em um computador da administração |
| Mensal, após fechar o período | Pacote completo | **Backup** no sistema (com arquivos) + **Relatórios → Pacote de documentos (ZIP)** do período |
| A cada 6 meses | Teste de restauração | Restaurar em um projeto Supabase de teste (seção "Restaurar") |

Guarde cada backup em **dois lugares diferentes** (ex.: HD externo + nuvem com acesso restrito). Os arquivos contêm dados pessoais (LGPD) e financeiros: mantenha-os criptografados (ex.: ZIP com senha forte ou disco criptografado) e com acesso só para a diretoria.

## Backup pelo script (recomendado)

```bash
# no computador da administração, dentro da pasta do projeto
npm install
SUPABASE_URL=https://SEU-PROJETO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=chave-service-role \
npm run backup                       # cria backups/AAAA-MM-DD/dados.json e backups/AAAA-MM-DD/arquivos/
```

A chave `service_role` ignora as permissões: nunca a coloque no site, no GitHub ou em mensagens. A pasta `backups/` já está no `.gitignore`.

### Cópia completa do banco (inclui usuários de login)

Com a Supabase CLI:

```bash
supabase db dump --linked -f backups/esquema.sql
supabase db dump --linked --data-only -f backups/dados.sql
```

## Backup pela tela

**Sistema → Backup → Gerar backup**: gera um `.json` (ou `.zip` com os arquivos). Útil para cópias rápidas; para cópias grandes use o script.

## Restaurar

1. Crie um **projeto Supabase novo** (não restaure por cima do projeto em uso).
2. Aplique as migrações (docs/INSTALACAO.md, Etapa 1.1).
3. Gere o SQL de restauração:
   ```bash
   node scripts/restaurar.mjs backups/2026-10-14/dados.json > restauracao.sql
   ```
   (também aceita o `.json` ou o `.zip` exportado pela tela)
4. Execute no banco novo (string de conexão em *Project Settings → Database*):
   ```bash
   psql "postgresql://postgres:SENHA@db.NOVO-PROJETO.supabase.co:5432/postgres" -v ON_ERROR_STOP=1 -f restauracao.sql
   ```
   O script restaura todas as tabelas (inclusive auditoria) exatamente como estavam e reposiciona a numeração (REC-, DES-, PAG-…).
5. Envie os arquivos: copie o conteúdo de `backups/AAAA-MM-DD/arquivos/` para o bucket `documentos` mantendo os mesmos caminhos (pelo painel do Storage ou `supabase storage cp -r`).
6. **Usuários de login**: o backup JSON não contém senhas. Recrie os usuários por convite; cada um ganha um perfil novo. Os perfis antigos continuam no banco apenas como registro histórico (a auditoria e as conferências antigas continuam mostrando quem fez o quê). Desative-os e defina o papel dos novos:
   ```sql
   -- 1º promova o novo administrador (o sistema não permite ficar sem nenhum admin ativo)
   update public.perfis set papel = 'admin'
    where email = 'administrador@exemplo.org' and id in (select id from auth.users);
   -- 2º desative os perfis antigos (ficam como histórico)
   update public.perfis set ativo = false
    where id not in (select id from auth.users);
   ```
   (Se usou `supabase db dump`, os usuários já vêm junto e nada disso é necessário.)
7. Atualize `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do site, se o projeto novo for o definitivo.

## Teste automatizado

`scripts/testar-restauracao.sh` exporta um banco, restaura em outro e compara contagens e saldo. Ele roda no GitHub Actions a cada envio.
