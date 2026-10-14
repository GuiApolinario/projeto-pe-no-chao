# Passo a passo de instalação e publicação

Endereço final: **https://projetopenochao.ggsistemas.dev.br**

```
 Visitante / equipe ──► projetopenochao.ggsistemas.dev.br  (site estático na GGsistemas)
                                   │  (navegador chama a API com a chave pública "anon")
                                   ▼
                        Supabase (banco PostgreSQL + login + arquivos privados)
                        └─ as permissões ficam no banco (RLS): a tela não decide nada sozinha
```

O site é só um conjunto de arquivos (HTML/JS/CSS). Todo o processamento seguro (permissões, cálculos, auditoria, bloqueio de períodos) acontece no Supabase.

Tempo estimado: 1h30 a 2h na primeira vez.

---

## Etapa 1 — Supabase (banco de dados, login e arquivos)

Você já criou o projeto. Confira:

1. **Região**: de preferência *South America (São Paulo)* — menor latência. (Se o projeto foi criado em outra região, funciona do mesmo jeito.)
2. **Guarde a senha do banco** (Project Settings → Database) em um gerenciador de senhas.

### 1.1 Criar as tabelas (migrações)

Opção A — pelo navegador (mais simples):

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Abra, **nesta ordem**, cada arquivo da pasta `supabase/migrations/` do repositório, copie todo o conteúdo, cole e clique em **Run**:
   1. `20261014000100_esquema.sql`
   2. `20261014000200_regras.sql`
   3. `20261014000300_seguranca.sql`
   4. `20261014000400_calculos.sql`
   5. `20261014000500_documentos_view.sql`
3. Cada execução deve terminar com "Success. No rows returned". Se der erro, **não continue**: anote a mensagem.

Opção B — pela linha de comando (recomendada para atualizações futuras):

```bash
npm install -g supabase            # ou: npx supabase ...
supabase login
supabase link --project-ref SEU_PROJECT_REF   # o "ref" aparece na URL do painel
supabase db push                   # aplica todas as migrações da pasta supabase/migrations
```

Conferência: em **Table Editor** devem aparecer as tabelas `receitas`, `despesas`, `pagamentos`, `documentos`… e em **Storage** o bucket **documentos** marcado como *Private*.

> ⚠️ **Nunca** execute `supabase/demo/dados_demonstracao.sql` no projeto real. Ele serve para um projeto separado de treinamento.

### 1.2 Configurar o login (Authentication)

1. **Authentication → Sign In / Providers → Email**: mantenha o e-mail habilitado.
2. **Desative o cadastro público**: desligue a opção **"Allow new users to sign up"**. Assim só entra quem for convidado.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://projetopenochao.ggsistemas.dev.br`
   - **Redirect URLs** (adicione as duas):
     - `https://projetopenochao.ggsistemas.dev.br/redefinir-senha`
     - `http://localhost:5173/redefinir-senha` (para testes no computador)
4. (Opcional) **Authentication → Emails / Templates**: traduza os e-mails de convite e de recuperação de senha. Mantenha o link `{{ .ConfirmationURL }}` no texto.

> Os nomes exatos dos menus do Supabase mudam de tempos em tempos; se não encontrar, use a busca do painel com as palavras em inglês acima.

### 1.3 Criar o primeiro administrador

1. **Authentication → Users → Add user → Send invitation** (ou *Create new user* com senha).
2. Informe o e-mail de quem vai administrar o sistema.
3. **O primeiro usuário criado vira Administrador automaticamente.** Os próximos entram como *Visualizador* e o administrador ajusta o perfil em **Sistema → Usuários**.

### 1.4 Copiar as chaves públicas

Em **Project Settings → API** (ou *API Keys*), copie:

- **Project URL** → será `VITE_SUPABASE_URL`
- **anon / publishable key** → será `VITE_SUPABASE_ANON_KEY`

A chave **service_role / secret** **nunca** vai para o site nem para o GitHub. Ela só é usada nos scripts de backup/importação, no computador de quem administra.

---

## Etapa 2 — Código no GitHub

O repositório já contém tudo. Para trabalhar no computador:

```bash
git clone https://github.com/GuiApolinario/projeto-pe-no-chao.git
cd projeto-pe-no-chao
npm install
cp .env.example .env        # edite e cole a URL e a chave anon do Supabase
npm run dev                 # abre em http://localhost:5173
```

Comandos úteis:

| Comando | O que faz |
|---|---|
| `npm run dev` | site local para testes |
| `npm run build` | gera a pasta `dist/` para publicar |
| `npm test` | testes de cálculo, PIX e importação de extratos |
| `npm run test:db` | testes do banco (precisa de PostgreSQL local; o GitHub roda sozinho) |

A cada envio ao GitHub, a aba **Actions** roda automaticamente os testes (`.github/workflows/ci.yml`).

---

## Etapa 3 — Publicar na GGsistemas

Pergunte à GGsistemas qual é o tipo de hospedagem do `renato.ggsistemas.dev.br`:

### 3A — Hospedagem com cPanel / Apache (mais comum)

1. No cPanel, em **Domínios** (ou *Subdomínios*), crie `projetopenochao.ggsistemas.dev.br` apontando para uma pasta, por exemplo `public_html/projetopenochao`.
2. Gere o site no seu computador:
   ```bash
   npm run build
   ```
3. Envie **o conteúdo** da pasta `dist/` (não a pasta em si) para `public_html/projetopenochao` pelo **Gerenciador de Arquivos** ou por FTP (FileZilla).
   - Confira que o arquivo oculto **`.htaccess`** foi junto: ele faz as rotas do sistema funcionarem (ex.: `/admin/despesas`) e força HTTPS.
4. Em **SSL/TLS Status** (ou *Let's Encrypt*), emita o certificado para o subdomínio (pode levar alguns minutos após o DNS da Etapa 4 propagar).

**Publicação automática (opcional, recomendada):** a cada atualização no ramo `main`, o GitHub gera e envia o site sozinho (`.github/workflows/deploy.yml`). Configure em **GitHub → Settings → Secrets and variables → Actions**:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `VITE_SUPABASE_URL` | Project URL do Supabase |
| Secret | `VITE_SUPABASE_ANON_KEY` | chave anon |
| Secret | `FTP_SERVIDOR` | ex.: `ftp.ggsistemas.dev.br` (confirme com a GGsistemas) |
| Secret | `FTP_USUARIO` / `FTP_SENHA` | crie uma conta FTP restrita à pasta do projeto |
| Variable | `FTP_PASTA` | ex.: `/public_html/projetopenochao/` |

Depois, em **Actions → Publicar na GGsistemas → Run workflow**.

### 3B — Servidor próprio (VPS) com Nginx

Use o modelo `deploy/nginx-projetopenochao.conf`, copie o conteúdo de `dist/` para `/var/www/projetopenochao` e emita o certificado com `certbot --nginx -d projetopenochao.ggsistemas.dev.br`.

---

## Etapa 4 — DNS no Registro.br

### 4A — Usar o subdomínio `projetopenochao.ggsistemas.dev.br` (o seu caso)

O domínio `ggsistemas.dev.br` está registrado no Registro.br. É preciso criar **um registro CNAME** dizendo que `projetopenochao` aponta para o mesmo servidor de `renato`.

1. Acesse **https://registro.br** → **Acessar conta** e entre com o login do titular/contato técnico do `ggsistemas.dev.br`.
2. Em **Painel**, clique no domínio **ggsistemas.dev.br**.
3. Na seção **DNS**, clique em **Configurar zona DNS** (ou *Editar zona*).
   - Se aparecer a opção **"Modo avançado"**, ative-a para poder criar CNAME.
   - Se o domínio usar **servidores DNS de outra empresa** (ex.: os da própria GGsistemas ou Cloudflare), o Registro.br não deixará editar a zona: o registro abaixo deve ser criado **no painel desse outro provedor**. Você verá isso na seção DNS (campo "Servidores DNS").
4. Clique em **Nova entrada** e preencha:

   | Campo | Valor |
   |---|---|
   | Tipo | `CNAME` |
   | Nome | `projetopenochao` (o painel completa com `.ggsistemas.dev.br`) |
   | Dados / Destino | `renato.ggsistemas.dev.br.` (com ponto final, se o painel pedir) |

5. Clique em **Salvar alterações**. A propagação costuma levar de alguns minutos a algumas horas.
6. Teste no computador:
   ```bash
   nslookup projetopenochao.ggsistemas.dev.br
   ```
   Deve responder com o mesmo endereço IP de `renato.ggsistemas.dev.br`.
7. Volte à Etapa 3 e emita o certificado SSL (HTTPS).

> Observação: o servidor da GGsistemas também precisa "saber" que vai atender esse nome — é o passo 3A.1 (criar o subdomínio no cPanel) ou o `server_name` do Nginx no 3B. Só o DNS não basta.

### 4B — (Opcional, futuro) Domínio próprio, ex.: `projetopenochao.org.br`

Se quiserem um endereço próprio do projeto:

1. Em **registro.br**, pesquise a disponibilidade do nome.
2. Escolha a categoria:
   - `.org.br` — para instituições **sem fins lucrativos com CNPJ** (exige comprovação).
   - `.com.br` — aceita CPF ou CNPJ.
   - `.ong.br` — exige CNPJ de ONG.
   Consulte no site do Registro.br as regras e o valor anual vigentes.
3. Conclua o registro com o CPF/CNPJ do **titular correto** (de preferência a entidade responsável, não uma pessoa física) e pague a cobrança.
4. Em **DNS → Configurar zona DNS**, crie:
   - `CNAME` `www` → `renato.ggsistemas.dev.br.`
   - Registro `A` para o domínio sem "www" → **IP do servidor** da GGsistemas (CNAME não é permitido na raiz do domínio; peça o IP à GGsistemas).
5. Na GGsistemas, adicione o domínio ao site e emita o SSL.
6. No Supabase, acrescente o novo endereço em **Site URL** e **Redirect URLs** (Etapa 1.2).

---

## Etapa 5 — Primeira configuração dentro do sistema

Entre em **https://projetopenochao.ggsistemas.dev.br/entrar** com o administrador e siga esta ordem:

1. **Cadastros → Projeto**: preencha somente dados confirmados em documentos. O que faltar aparece como *Pendente de configuração*.
2. **Cadastros → Períodos**: crie os períodos de prestação de contas (ex.: mensal ou trimestral). Sem período, o sistema não aceita lançamentos.
3. **Cadastros → Instrumentos** (se houver termo de fomento/convênio/contrato) e anexe o termo e o plano de trabalho.
4. **Cadastros → Fontes de recurso**: ex.: "Doações livres", "Termo de Fomento nº…". Marque **vinculado** quando o recurso não puder ser misturado.
5. **Cadastros → Contas bancárias**: saldo inicial e data. Se a conta for exclusiva de um termo, informe a fonte.
6. **Cadastros → Categorias** e **Checklist documental**: revise conforme as regras do financiador (ex.: ative "Cotação" a partir de certo valor).
7. **Orçamento**: cadastre o orçamento aprovado por fonte e categoria.
8. **Site e doações**: chave PIX, nome do favorecido, WhatsApp, Instagram, texto "Quem somos" e lista de necessidades. **Faça um PIX de teste de R$ 1,00 lendo o QR Code** antes de divulgar.
9. **Usuários**: convide a equipe (Etapa 1.3) e defina os perfis.
10. Só então ative o **Portal da transparência** (Site e doações) e marque os períodos a publicar.

---

## Checklist de segurança antes de divulgar

- [ ] Cadastro público desativado no Supabase (Etapa 1.2).
- [ ] Bucket `documentos` aparece como **Private**.
- [ ] Nenhuma chave `service_role` no GitHub ou no `.env` do site.
- [ ] Site abre com cadeado (HTTPS).
- [ ] PIX de teste conferido (nome do favorecido correto).
- [ ] Administrador com senha forte; recomendada a ativação de MFA na conta do Supabase.
- [ ] Rotina de backup definida (docs/BACKUP.md).
