# Lançar só o site (versão simples)

Sem Supabase e sem sistema administrativo. As informações do site ficam em `site.json`
(pasta `public/` no código; na raiz do site publicado) e podem ser editadas em qualquer editor de texto,
sem refazer o site.

1. **Preencher `site.json`** (WhatsApp, e-mail, Instagram, endereço, chave PIX, nome do favorecido, lista de necessidades).
   Campo `null` = não aparece no site.
2. **Gerar**: `npm install` e `npm run build` (ou usar o arquivo `site-pe-no-chao.zip` já pronto).
3. **Enviar** todo o conteúdo de `dist/` (inclusive o arquivo oculto `.htaccess`) para a pasta do subdomínio na GGsistemas.
4. **DNS (Registro.br)**: CNAME `projetopenochao` → `renato.ggsistemas.dev.br.`
5. **SSL** ativado na hospedagem.

Para atualizar o conteúdo depois, basta editar o `site.json` direto no servidor.
