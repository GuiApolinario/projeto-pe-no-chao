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
3. Deve aparecer *Success*. (Pode rodar de novo sem problema, se precisar.)

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
2. SQL Editor: `select public.pc_tornar_admin('outra-pessoa@exemplo.com');`
3. Para retirar o acesso: `select public.pc_remover_admin('outra-pessoa@exemplo.com');`

Todo lançamento fica no **histórico** (quem criou, alterou ou excluiu, e quando). O histórico não pode ser editado nem apagado.

---

## Como funciona por baixo (para quem for dar manutenção)

- **Página pública** lê só a visão `pc_publico` (sem anotações internas, nomes ocultos mascarados, só fotos públicas).
- **Tabela `pc_lancamentos`**: somente administradores leem e gravam (regras RLS). Visitante recebe “permissão negada”.
- **Fotos**: dois depósitos — `prestacao-publica` (link direto, nomes de arquivo aleatórios) e `prestacao-privada` (somente equipe, links temporários). Limite de 5 MB e só JPG/PNG/WEBP/PDF, validados também no servidor.
- **Dinheiro** é guardado com 2 casas decimais e somado em centavos (sem erro de arredondamento).
- A visão `pc_publico` roda com as permissões do dono do banco (é assim que ela filtra o que é público). O *Security Advisor* do Supabase pode listar isso como aviso; é esperado.

## Limites desta primeira versão
- Backup: use o botão **Excel** da área da equipe todo mês e os backups do painel do Supabase. (O `scripts/backup.mjs` ainda cobre apenas o sistema completo.)
- Cada registro aceita até 6 comprovantes; cada arquivo até 5 MB.
- Não há conciliação bancária, orçamento nem relatório em PDF nesta aba — eles existem no sistema completo (`/admin`), que pode ser ativado depois.
- Se esquecer a senha: **Esqueci minha senha** na tela de login (precisa do Site URL do passo 2.4) ou redefina em Authentication → Users.
