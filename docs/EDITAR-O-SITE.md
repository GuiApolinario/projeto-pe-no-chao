# Editar o site sem programar (e sem banco de dados)

Nada de Supabase, SQL ou servidor: a equipe edita o site numa página própria, e as mudanças são gravadas direto no GitHub, que publica o site sozinho.

**Endereço:** https://projetopenochao.ggsistemas.dev.br/editar-site
(também pelo rodapé do site: **Área da equipe**)

## O que dá para mudar

| Aba | O que tem |
|---|---|
| **Textos do site** | todos os títulos, frases, botões, o menu, o rodapé, a política de privacidade e a página de prestação de contas |
| **PIX, contatos e campanha** | chave PIX (gera o QR Code sozinho), WhatsApp, Instagram, e-mail, endereço, campanha com meta e a lista “o que o projeto precisa” |
| **Imagens e QR Code** | logotipo, imagem grande da página inicial e **a imagem do QR Code do PIX** (para enviar quando você tiver) |

- Cada texto tem o botão **Restaurar texto original**.
- **Apagar um texto deixa o espaço em branco** no site.
- Nos títulos, coloque `*asteriscos*` em volta das palavras que devem ficar coloridas.
- PIX e contatos **começam em branco**: o site mostra “será publicado em breve” até você preencher. Pode enviar só a imagem do QR Code, sem preencher a chave.

## Criar a chave de acesso (uma vez, uns 3 minutos)

A “chave” é uma senha especial do GitHub que só deixa mexer neste projeto.

1. Entre no GitHub com a conta dona do projeto e abra: **https://github.com/settings/personal-access-tokens/new**
2. **Token name:** `Editar site`. **Expiration:** 1 ano (ou o máximo que aparecer).
3. **Repository access → Only select repositories →** escolha **projeto-pe-no-chao**.
4. **Permissions → Repository permissions →** procure **Contents** e troque para **Read and write**. (Não precisa de mais nada.)
5. Clique em **Generate token** e **copie** o texto que começa com `github_pat_…` (ele só aparece uma vez).
6. Abra `/editar-site`, cole a chave e clique em **Entrar**.

Dicas de segurança:
- A chave fica guardada **só no seu aparelho**. Use **Sair** em computadores de outras pessoas.
- Quem tem a chave consegue editar o site. Não envie por e-mail ou WhatsApp. Se vazar: GitHub → Settings → Developer settings → Fine-grained tokens → **Delete**, e crie outra.
- Para dar acesso a outra pessoa, ela cria a própria chave (precisa ser colaboradora do repositório) — não compartilhe a sua.

## Salvar e publicar

1. Altere o que quiser.
2. Clique em **Salvar alterações** (barra de baixo). Tudo é gravado de uma vez só.
3. Em cerca de **2 minutos** o site novo está no ar (acompanhe em GitHub → **Actions**; verde = publicado).

Mensagens comuns:
- *“A chave de acesso não foi aceita”* → chave errada ou vencida: crie outra.
- *“Esta chave só consegue ler”* → refaça a chave com **Contents: Read and write**.
- *“Alguém publicou ao mesmo tempo”* → recarregue a página e refaça a alteração.

## Imagens

- Prefira PNG ou JPG; o painel reduz o tamanho sozinho.
- **QR Code:** salve a imagem do QR Code do app do seu banco e envie em **Imagens e QR Code → QR Code do PIX**. Ela aparece na página **Como ajudar**. Se você também preencher a chave PIX, o site passa a gerar o QR Code com valores sugeridos.
- Para voltar a uma imagem original, use **Voltar à imagem original** e salve.

## Se também usar a Prestação de contas com Supabase

As duas áreas convivem: o que você edita aqui (textos e imagens) vale sempre. Para **PIX, contatos e campanha**, quando o banco do Supabase estiver ligado, vale o que for salvo na área da equipe da prestação de contas (`/prestacao-de-contas/gerenciar`).

## Como funciona por baixo (para manutenção)

- O painel conversa com a API do GitHub (`src/prestacao/github.ts`) e faz **um commit só** com `public/site.json` e as imagens novas (`public/imagens/site/`). Se alguém publicar no meio, nada é gravado.
- O `site.json` guarda só o que **difere do texto original**: `textos` (chave → texto) e `imagens` (logo, hero, qr_pix). Os textos originais ficam em `src/site/conteudo.ts`.
- A chave é do tipo *fine-grained*, limitada a este repositório.
