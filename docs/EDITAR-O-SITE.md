# Editar o site sem programar (e sem banco de dados)

Nada de Supabase, SQL ou servidor: a equipe edita o site numa página própria, e as mudanças são gravadas direto no GitHub, que publica o site sozinho.

**Endereço:** https://projetopenochao.ggsistemas.dev.br/editar-site
(também pelo rodapé do site: **Área da equipe**)

## Como funciona: edite direto na página

1. Entre em `/editar-site` e cole a chave (veja abaixo). Você cai na página inicial **em modo edição**: uma barra azul aparece embaixo e os textos e imagens ficam com um contorno tracejado azul.
2. **Clique em qualquer texto e digite.** A mudança aparece na hora, no próprio lugar. (Enter termina a edição; nos textos grandes, Enter faz nova linha.)
3. **Imagens:** clique em **Trocar imagem** sobre o logotipo, a imagem grande ou o QR Code.
4. **PIX, contatos, campanha e lista “o que precisamos”:** clique nos botões azuis **✏️ Editar…** que aparecem nos lugares onde esses dados são mostrados, ou em **PIX, contatos e campanha** na barra.
5. Use os botões **Início, Como ajudar, Prestação, Contato, Privacidade** da barra para ir de uma página a outra (os links do site ficam desligados enquanto você edita).
6. Quando terminar, clique em **Salvar**. Tudo vai de uma vez só e o site novo fica no ar em cerca de 2 minutos.
7. **Ver como visitante** sai do modo edição para você conferir o resultado.

Dicas:
- **Apagar um texto** deixa o espaço em branco no site (no modo edição aparece “(em branco)”).
- Nos títulos, coloque `*asteriscos*` em volta das palavras que devem ficar coloridas.
- O PIX e os contatos **começam em branco**: o site mostra “será publicado em breve” até você preencher. Você pode enviar só a imagem do QR Code, sem preencher a chave.
- Se sair sem salvar, o navegador avisa.

## Prestação de contas (sem banco de dados)

A aba **Prestação de contas** já está ligada e **zerada**. Para lançar:

1. No modo edição, abra **Prestação** na barra e clique em **✏️ Lançar entradas e gastos** (ou use o botão na barra).
2. **Entrou dinheiro** ou **Saiu dinheiro**: valor, data, “o que foi?”, tipo e, se quiser, fotos dos comprovantes.
3. Em cada foto use **Cobrir dados** para pintar de preto CPF, telefone, chave PIX, conta bancária e nomes de crianças. Marque a confirmação e **Salvar**.
4. Dá para editar ou excluir registros na mesma tela. Cada ação é salva no site em cerca de 2 minutos.

⚠️ Como o site não tem banco de dados, **tudo o que é lançado é público**: valores, descrições e fotos. O nome de doadores só é guardado se você marcar “Mostrar este nome no site”. Para esconder a aba, desmarque **Mostrar a aba “Prestação de contas”** na barra e salve.

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

## Mensagens comuns

- *“A chave de acesso não foi aceita”* → chave errada ou vencida: crie outra.
- *“Esta chave só consegue ler”* → refaça a chave com **Contents: Read and write**.
- *“Alguém publicou ao mesmo tempo”* → recarregue a página e refaça a alteração.

## Se também usar a Prestação de contas com Supabase

As duas áreas convivem: o que você edita aqui (textos e imagens) vale sempre. Para **PIX, contatos e campanha**, quando o banco do Supabase estiver ligado, vale o que for salvo na área da equipe da prestação de contas (`/prestacao-de-contas/gerenciar`).

## Como funciona por baixo (para manutenção)

- `src/site/Edicao.tsx` liga o modo edição; os textos usam o componente `<T k="chave" />` (`src/site/editaveis.tsx`) e as imagens `<ImagemEditavel />`. O que está sendo editado é aplicado sobre a configuração publicada, por isso aparece em tempo real.
- Ao salvar, `src/prestacao/github.ts` faz **um commit só** com `public/site.json` e as imagens novas (`public/imagens/site/`). Se alguém publicar no meio, nada é gravado.
- O `site.json` guarda só o que **difere do texto original**: `textos` (chave → texto) e `imagens` (logo, hero, qr_pix). Os textos originais ficam em `src/site/conteudo.ts`.
- Prestação de contas sem banco: registros em `public/dados/prestacao.json` e fotos em `public/comprovantes/` (`src/prestacao/arquivo.ts`, `ContasArquivo.tsx`). Aba ligada por `prestacao_ativa` no `site.json`.
- A chave é do tipo *fine-grained*, limitada a este repositório.
