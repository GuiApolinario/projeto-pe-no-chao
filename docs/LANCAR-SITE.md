# Lançar só o site (versão simples)

Sem Supabase e sem sistema administrativo. As informações do site ficam em `site.json`
(pasta `public/` no código; na raiz do site publicado) e podem ser editadas em qualquer editor de texto,
sem refazer o site.

1. **Preencher `site.json`** (WhatsApp, e-mail, Instagram, endereço, chave PIX, nome do favorecido, lista de necessidades).
   Campo `null` = não aparece no site.
2. **Gerar**: `npm install` e `npm run build` (ou usar o arquivo `site-pe-no-chao.zip` já pronto).
3. **Publicar**: GitHub Pages (veja abaixo).
4. **DNS**: já está pronto (CNAME projetopenochao → guiapolinario.github.io).
5. **SSL** ativado na hospedagem.

Para atualizar o conteúdo depois, basta editar o `site.json` direto no servidor.

## Publicação (GitHub Pages — é onde a GGsistemas está hospedada)
1. GitHub → repositório `projeto-pe-no-chao` → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Em **Custom domain** informe `projetopenochao.ggsistemas.dev.br` e salve; depois marque **Enforce HTTPS**.
3. Aba **Actions → Publicar site (GitHub Pages) → Run workflow** (ou qualquer envio de código à branch).

## Aba "Prestação de contas"
Já vem no código, escondida. Para ver (com dados de exemplo) e depois ativar de verdade, siga `docs/PRESTACAO.md`.
Campos do `site.json` ligados a ela: `prestacao_demo` (pré-visualização), `supabase_url` e `supabase_anon_key` (ativação real).

Depois de ativada (docs/PRESTACAO.md), PIX, contatos, textos e campanha passam a ser editados no painel da equipe (aba **Site e doações**), sem tocar no `site.json`.
