# Aba "Prestação de contas"

Duas páginas novas no site:

| Página | Para quem | O que faz |
|---|---|---|
| `/prestacao-de-contas` | qualquer pessoa | mostra quanto entrou, quanto saiu, gráficos, e a lista de registros com as fotos dos comprovantes |
| `/prestacao-de-contas/gerenciar` | só a equipe (login) | tela simples para lançar **entrou dinheiro** / **saiu dinheiro**, com fotos |

O link da aba **só aparece no menu do site depois de ativada** (passos abaixo). Até lá o site continua exatamente como está.

---

## Passo 1 — Ver como fica (sem configurar nada)

1. No GitHub, abra o arquivo `public/site.json` → lápis (✏️ Edit).
2. Troque `"prestacao_demo": false` por `"prestacao_demo": true` → **Commit changes**.
3. Em ~2 minutos (aba **Actions** verde) abra o site: aparece **Prestação de contas** no menu, com **dados de exemplo** (há uma faixa amarela avisando que não são reais).
4. Terminou de olhar? Volte para `false`.

> O modo exemplo é desligado automaticamente assim que o banco real for configurado (passo 2).

---

## Passo 2 — Ativar de verdade (uns 20 minutos, uma única vez)

Você precisa do projeto Supabase que já criou.

### 2.1 Criar as tabelas
1. Supabase → **SQL Editor** → **New query**.
2. Abra no GitHub o arquivo `supabase/prestacao/01_prestacao_simples.sql`, copie **tudo**, cole e clique **Run**.
3. Deve aparecer *Success*. (Pode rodar de novo sem problema — **faça isso sempre que este arquivo for atualizado**; por exemplo, se você já tinha rodado antes do painel do administrador existir.)

### 2.2 Criar o seu usuário
1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Informe seu e-mail e uma **senha forte (mínimo de 10 caracteres)**. Marque **Auto Confirm User**.

### 2.3 Dar a você o poder de lançar dados
No **SQL Editor**, nova consulta (troque pelo seu e-mail) e **Run**:

```sql
select public.pc_tornar_admin('seu-email@exemplo.com');
```
Deve responder: *“Pronto: … agora é administrador(a) da prestação de contas.”*

### 2.4 Trancar o cadastro público
**Authentication → Sign In / Providers** (ou *Settings*) → desligue **Allow new users to sign up**.
Assim ninguém além de você consegue criar usuários. (Mesmo se alguém criasse, não teria permissão de lançar nada.)

Em **Authentication → URL Configuration**, em **Site URL**, coloque `https://projetopenochao.ggsistemas.dev.br` (necessário só para o e-mail de “esqueci a senha”).

### 2.5 Ligar o site ao banco
1. Supabase → **Project Settings → API** (ou *API Keys*): copie o **Project URL** e a chave **anon / public**.
2. No GitHub, edite `public/site.json` e preencha:
   ```json
   "supabase_url": "https://SEU-PROJETO.supabase.co",
   "supabase_anon_key": "cole-aqui-a-chave-anon"
   ```
3. **Commit changes** e aguarde o **Actions** ficar verde.

> ✅ A chave **anon** é pública por natureza (todo site que usa Supabase a expõe). A proteção dos dados está nas regras do banco.
> ⛔ **Nunca** cole a chave **service_role / secret** em lugar nenhum do site.

Pronto: o menu mostra **Prestação de contas**, e no rodapé aparece **Área da equipe**.

---

## Passo 3 — Usar no dia a dia

1. Rodapé do site → **Área da equipe** (ou `/prestacao-de-contas/gerenciar`) → entre com seu e-mail e senha.
2. Toque em **Entrou dinheiro** ou **Saiu dinheiro**.
3. Preencha:
   - **Valor** e **Data**
   - **O que foi?** — escreva de um jeito que qualquer pessoa entenda
   - **De onde veio / Com o que foi gasto** — escolha uma das opções
   - **Comprovantes** — **Tirar foto ou escolher arquivo** (foto ou PDF, até 6)
4. **Cobrir dados** (em cada foto): arraste o dedo sobre CPF, telefone, chave PIX, número de conta, endereço, nomes de crianças. A tarja é gravada na foto.
5. **Salvar.** Se “Aparece no site” estiver ligado, já está publicado.

Outras ações na lista: **Editar**, **Esconder** (tira do site sem apagar), **Excluir**, buscar, filtrar por mês e baixar **CSV/Excel**.

### Regras de privacidade já embutidas
- **Foto de entrada (doação)** começa **privada** (só a equipe vê), porque comprovante de PIX mostra nome e CPF de quem doou. Foto de **gasto** começa pública. Dá para mudar foto a foto (chavinha *Mostrar no site*).
- **Nome de quem doou/recebeu** só aparece no site se você marcar *Mostrar este nome no site*.
- **Anotação interna** nunca aparece no site.
- Fotos são reduzidas e perdem dados escondidos (como localização do celular).
- **Esconder** um registro o remove da página pública imediatamente.

### Dar acesso a outra pessoa
1. Supabase → Authentication → Users → **Add user** (e-mail + senha, *Auto Confirm User*).
2. Na área da equipe, aba **Equipe e saúde do site** → digite o e-mail → **Dar acesso**. (Para tirar o acesso: **Retirar acesso** na mesma lista. Você não consegue retirar o seu próprio.)

Todo lançamento fica no **histórico** (quem criou, alterou ou excluiu, e quando). O histórico não pode ser editado nem apagado.

---

## Passo 4 — Painel do administrador (mudar o site sem mexer no GitHub)

Na **Área da equipe** há três abas:

| Aba | Para quê |
|---|---|
| **Prestação de contas** | lançar entradas, gastos e comprovantes (passo 3) |
| **Site e doações** | PIX, contatos (WhatsApp, Instagram, e-mail, endereço), texto “Quem somos”, campanha com meta e a lista “o que o projeto precisa” |
| **Equipe e saúde do site** | ver se o banco está ativo, dar/retirar acesso e conferir se o robô diário está funcionando |

**Site e doações:** altere o que quiser e clique **Salvar alterações** — vale **na hora**, sem publicar nada. O que o painel não mexe (ligação com o banco) continua no `site.json`; o `site.json` passa a servir só de base inicial e de reserva se o banco estiver fora do ar.
- A chave PIX é conferida antes de salvar (dígitos de CPF/CNPJ, formato de e-mail/telefone/chave aleatória) e você vê a **prévia do QR Code**.
- Depois de salvar o PIX, **faça um PIX de teste de R$ 1,00** lendo o QR Code da página “Como ajudar” e confira o nome do recebedor no banco.
- Campo em branco = não aparece no site. Toda mudança fica no histórico (quem, quando).

---

## Passo 5 — Manter o banco ativo (automático)

O plano gratuito do Supabase **pausa o projeto depois de cerca de 7 dias sem uso**. Para isso não acontecer, o GitHub consulta o banco **todo dia às 06:23** (fluxo **Manter banco ativo**, arquivo `.github/workflows/manter-banco-ativo.yml`).

- Não precisa configurar nada: ele lê a URL e a chave pública do `site.json` e só passa a agir depois do passo 2.5.
- Cada execução grava um “ping” no banco. Em **Equipe e saúde do site** você vê *“Último acesso automático: …”*; se passar de 3 dias, o painel avisa.
- Para testar agora: GitHub → **Actions → Manter banco ativo → Run workflow**.
- Se o banco não responder (por exemplo, projeto já pausado), o fluxo **falha** e o GitHub manda e-mail para você. Nesse caso: supabase.com/dashboard → seu projeto → **Restore project**.

⚠️ Dois cuidados do próprio GitHub:
1. O agendamento só roda na **branch padrão** do repositório (hoje é a mesma que publica o site; se um dia mudarem a branch padrão, o arquivo precisa estar nela).
2. Em repositório **público**, o GitHub **desliga os agendamentos depois de 60 dias sem nenhuma atividade** (commit, etc.). Como o site recebe atualizações, normalmente não acontece; se vier o aviso por e-mail, abra o fluxo em Actions e clique **Enable workflow**.

---

## Como funciona por baixo (para quem for dar manutenção)

- **Informações do site** ficam na tabela `pc_site` (todos leem, só administrador grava; os campos são validados no banco). O site lê o `site.json` e, por cima, o que a equipe salvou.
- **Robô diário:** `scripts/manter-banco-ativo.mjs` (3 consultas, uma delas grava um ping em `pc_atividade`; tem testes automatizados).
- **Página pública** lê só a visão `pc_publico` (sem anotações internas, nomes ocultos mascarados, só fotos públicas).
- **Tabela `pc_lancamentos`**: somente administradores leem e gravam (regras RLS). Visitante recebe “permissão negada”.
- **Fotos**: dois depósitos — `prestacao-publica` (link direto, nomes de arquivo aleatórios) e `prestacao-privada` (somente equipe, links temporários). Limite de 5 MB e só JPG/PNG/WEBP/PDF, validados também no servidor.
- **Dinheiro** é guardado com 2 casas decimais e somado em centavos (sem erro de arredondamento).
- As informações do site (inclusive a chave PIX) são públicas por natureza: qualquer pessoa pode lê-las, como no site.
- A visão `pc_publico` roda com as permissões do dono do banco (é assim que ela filtra o que é público). O *Security Advisor* do Supabase pode listar isso como aviso; é esperado.

## Limites desta primeira versão
- Backup: use o botão **Excel** da área da equipe todo mês e os backups do painel do Supabase. (O `scripts/backup.mjs` ainda cobre apenas o sistema completo.) As informações do site (aba “Site e doações”) não entram no Excel: guarde uma cópia do texto importante.
- Cada registro aceita até 6 comprovantes; cada arquivo até 5 MB.
- Não há conciliação bancária, orçamento nem relatório em PDF nesta aba — eles existem no sistema completo (`/admin`), que pode ser ativado depois.
- Se esquecer a senha: **Esqueci minha senha** na tela de login (precisa do Site URL do passo 2.4) ou redefina em Authentication → Users.
