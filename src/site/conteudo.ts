// Conteúdo editável do site: cada texto tem um padrão (o que o site mostra hoje) que a equipe pode trocar.
// Só o que for diferente do padrão é guardado; apagar o campo deixa o espaço em branco; "Restaurar padrão" volta ao original.

export interface CampoConteudo {
  chave: string;
  rotulo: string;
  grupo: string;
  padrao: string;
  longo?: boolean;
  ajuda?: string;
}

export const GRUPOS: { id: string; titulo: string; descricao?: string }[] = [
  { id: 'menu', titulo: 'Menu e rodapé', descricao: 'Aparecem em todas as páginas.' },
  { id: 'home', titulo: 'Página inicial' },
  { id: 'doe', titulo: 'Como ajudar (doações e voluntariado)' },
  { id: 'contato', titulo: 'Contato' },
  { id: 'pc', titulo: 'Prestação de contas' },
  { id: 'privacidade', titulo: 'Privacidade' },
];

const SOBRE_PADRAO = [
  'O Projeto Pé no Chão é uma iniciativa social de Votorantim/SP que desenvolve ações voltadas ao atendimento de crianças e ao fortalecimento da comunidade.',
  'Nossa atuação acontece nos bairros Jardim Dandara e Jardim Cerrado, com atividades que unem convivência, esporte, cultura, alimentação e cuidado.',
].join('\n\n');

const PRIVACIDADE_PADRAO = [
  'O Projeto Pé no Chão trata dados pessoais apenas para as finalidades informadas, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Estatuto da Criança e do Adolescente.',
  '## Formulários do site',
  'Nome, e-mail, telefone e mensagem enviados ao projeto são usados somente para responder ao seu contato, com o seu consentimento. Esses dados ficam acessíveis apenas à administração do projeto.',
  '## Crianças e adolescentes',
  'Dados de participantes são coletados com autorização dos responsáveis, no mínimo necessário, e nunca são publicados. Fotografias só são divulgadas com autorização de uso de imagem.',
  '## Doações',
  'Nomes de doadores não são divulgados publicamente.',
  '## Seus direitos',
  'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pela página de contato.',
].join('\n\n');

export const CAMPOS_CONTEUDO: CampoConteudo[] = [
  // ---- menu e rodapé
  { grupo: 'menu', chave: 'nav.inicio', rotulo: 'Menu: Início', padrao: 'Início' },
  { grupo: 'menu', chave: 'nav.ajudar', rotulo: 'Menu: Como ajudar', padrao: 'Como ajudar' },
  { grupo: 'menu', chave: 'nav.prestacao', rotulo: 'Menu: Prestação de contas', padrao: 'Prestação de contas' },
  { grupo: 'menu', chave: 'nav.contato', rotulo: 'Menu: Contato', padrao: 'Contato' },
  { grupo: 'menu', chave: 'nav.doar', rotulo: 'Botão rosa do menu', padrao: 'Doe agora' },
  { grupo: 'menu', chave: 'rodape.nome', rotulo: 'Rodapé: nome do projeto', padrao: 'Projeto Pé no Chão' },
  { grupo: 'menu', chave: 'rodape.descricao', rotulo: 'Rodapé: descrição', padrao: 'Ações com crianças e com a comunidade em Votorantim/SP.', longo: true },
  { grupo: 'menu', chave: 'rodape.titulo_contato', rotulo: 'Rodapé: título da coluna de contato', padrao: 'Fale com a gente' },
  { grupo: 'menu', chave: 'rodape.titulo_transparencia', rotulo: 'Rodapé: título da coluna de transparência', padrao: 'Transparência' },
  { grupo: 'menu', chave: 'rodape.assinatura', rotulo: 'Rodapé: linha final (depois do ©  e do ano)', padrao: 'Projeto Pé no Chão · Votorantim/SP' },

  // ---- página inicial
  { grupo: 'home', chave: 'home.etiqueta', rotulo: 'Etiqueta acima do título', padrao: 'Votorantim · São Paulo' },
  { grupo: 'home', chave: 'home.titulo', rotulo: 'Título principal', padrao: 'Infância com *pé no chão*, *sol* e *alegria*.', ajuda: 'Coloque *asteriscos* em volta das palavras que devem aparecer coloridas.' },
  { grupo: 'home', chave: 'home.subtitulo', rotulo: 'Texto abaixo do título', padrao: 'O Projeto Pé no Chão realiza ações com crianças e com a comunidade nos bairros Jardim Dandara e Jardim Cerrado. Cada doação vira brincadeira, aprendizado e cuidado.', longo: true },
  { grupo: 'home', chave: 'home.botao_doar', rotulo: 'Botão rosa', padrao: 'Quero doar' },
  { grupo: 'home', chave: 'home.botao_voluntario', rotulo: 'Botão branco', padrao: 'Ser voluntário' },
  { grupo: 'home', chave: 'home.sobre_etiqueta', rotulo: 'Quem somos: etiqueta', padrao: 'Quem somos' },
  { grupo: 'home', chave: 'home.sobre_titulo', rotulo: 'Quem somos: título', padrao: 'Um projeto da comunidade, para a comunidade' },
  { grupo: 'home', chave: 'home.sobre_texto', rotulo: 'Quem somos: texto', padrao: SOBRE_PADRAO, longo: true, ajuda: 'Deixe uma linha em branco entre os parágrafos.' },
  { grupo: 'home', chave: 'home.cartao1', rotulo: 'Quadradinho 1', padrao: 'Crianças no centro' },
  { grupo: 'home', chave: 'home.cartao2', rotulo: 'Quadradinho 2', padrao: 'Convivência e brincadeira' },
  { grupo: 'home', chave: 'home.cartao3', rotulo: 'Quadradinho 3', padrao: 'Doações bem cuidadas' },
  { grupo: 'home', chave: 'home.cartao4', rotulo: 'Quadradinho 4', padrao: 'Cuidado com cada doação' },
  { grupo: 'home', chave: 'home.campanha_etiqueta', rotulo: 'Campanha: etiqueta', padrao: 'Campanha' },
  { grupo: 'home', chave: 'home.campanha_botao', rotulo: 'Campanha: botão', padrao: 'Contribuir' },
  { grupo: 'home', chave: 'home.ajudar_etiqueta', rotulo: 'Como ajudar: etiqueta', padrao: 'Como ajudar' },
  { grupo: 'home', chave: 'home.ajudar_titulo', rotulo: 'Como ajudar: título', padrao: 'Toda ajuda faz diferença' },
  { grupo: 'home', chave: 'home.card1_titulo', rotulo: 'Cartão 1: título', padrao: 'Doe pelo PIX' },
  { grupo: 'home', chave: 'home.card1_texto', rotulo: 'Cartão 1: texto', padrao: 'Rápido e seguro: leia o QR Code ou copie a chave PIX do projeto.', longo: true },
  { grupo: 'home', chave: 'home.card2_titulo', rotulo: 'Cartão 2: título', padrao: 'Doe alimentos e materiais' },
  { grupo: 'home', chave: 'home.card2_texto', rotulo: 'Cartão 2: texto', padrao: 'Veja a lista do que mais precisamos agora e combine a entrega.', longo: true },
  { grupo: 'home', chave: 'home.card3_titulo', rotulo: 'Cartão 3: título', padrao: 'Seja voluntário' },
  { grupo: 'home', chave: 'home.card3_texto', rotulo: 'Cartão 3: texto', padrao: 'Tem um tempinho e um talento? Venha somar com a gente nas atividades.', longo: true },
  { grupo: 'home', chave: 'home.card_saiba', rotulo: 'Cartões: texto do link', padrao: 'Saiba mais →' },
  { grupo: 'home', chave: 'home.necessidades_titulo', rotulo: 'Lista “precisamos agora”: título', padrao: 'Precisamos agora' },
  { grupo: 'home', chave: 'home.faixa_titulo', rotulo: 'Faixa azul: título (com prestação de contas)', padrao: 'Transparência é parte do nosso jeito de fazer' },
  { grupo: 'home', chave: 'home.faixa_texto', rotulo: 'Faixa azul: texto (com prestação de contas)', padrao: 'Veja quanto recebemos, no que usamos cada doação e os comprovantes dos gastos.', longo: true },
  { grupo: 'home', chave: 'home.faixa_botao', rotulo: 'Faixa azul: botão (com prestação de contas)', padrao: 'Ver prestação de contas' },
  { grupo: 'home', chave: 'home.faixa2_titulo', rotulo: 'Faixa azul: título (sem prestação de contas)', padrao: 'Vamos conversar?' },
  { grupo: 'home', chave: 'home.faixa2_texto', rotulo: 'Faixa azul: texto (sem prestação de contas)', padrao: 'Quer conhecer o projeto, ajudar ou propor uma parceria? Fale com a gente.', longo: true },
  { grupo: 'home', chave: 'home.faixa2_botao', rotulo: 'Faixa azul: botão (sem prestação de contas)', padrao: 'Fale com a gente' },

  // ---- como ajudar
  { grupo: 'doe', chave: 'doe.etiqueta', rotulo: 'Topo: etiqueta', padrao: 'Doe agora' },
  { grupo: 'doe', chave: 'doe.titulo', rotulo: 'Topo: título', padrao: 'Sua doação vira cuidado com as crianças' },
  { grupo: 'doe', chave: 'doe.sem_pix', rotulo: 'Aviso quando ainda não há PIX cadastrado', padrao: 'A chave PIX do projeto será publicada aqui em breve. Enquanto isso, fale com a gente.', longo: true },
  { grupo: 'doe', chave: 'doe.duvidas', rotulo: 'Frase abaixo do PIX', padrao: 'Dúvidas sobre a doação? Fale com a gente pelo WhatsApp ou e-mail.' },
  { grupo: 'doe', chave: 'doe.aviso_pix', rotulo: 'Aviso de segurança do PIX', padrao: 'Confira sempre o nome do favorecido antes de confirmar. O projeto nunca pede doações por mensagens de números desconhecidos.', longo: true },
  { grupo: 'doe', chave: 'doe.bens_etiqueta', rotulo: 'Alimentos e materiais: etiqueta', padrao: 'Doação de alimentos e materiais' },
  { grupo: 'doe', chave: 'doe.bens_titulo', rotulo: 'Alimentos e materiais: título', padrao: 'Do que precisamos' },
  { grupo: 'doe', chave: 'doe.bens_vazio', rotulo: 'Quando a lista está vazia', padrao: 'Fale com a gente para saber o que está faltando no momento.' },
  { grupo: 'doe', chave: 'doe.entrega_titulo', rotulo: 'Como entregar: título', padrao: 'Como entregar' },
  { grupo: 'doe', chave: 'doe.entrega_texto', rotulo: 'Como entregar: texto (quando não há endereço)', padrao: 'Combine a entrega com a equipe pelos contatos ao lado.', longo: true },
  { grupo: 'doe', chave: 'doe.itens_titulo', rotulo: 'Doar itens: título do bloco de contato', padrao: 'Quero doar itens' },
  { grupo: 'doe', chave: 'doe.vol_etiqueta', rotulo: 'Voluntariado: etiqueta', padrao: 'Voluntariado' },
  { grupo: 'doe', chave: 'doe.vol_titulo', rotulo: 'Voluntariado: título', padrao: 'Venha somar com a gente' },
  { grupo: 'doe', chave: 'doe.vol_texto', rotulo: 'Voluntariado: texto', padrao: 'Recreação, esporte, reforço escolar, cozinha, organização de doações, comunicação… Conte o que você gosta de fazer e quando tem disponibilidade.', longo: true },
  { grupo: 'doe', chave: 'doe.vol_nota', rotulo: 'Voluntariado: nota para empresas', padrao: 'Empresas e parceiros também são bem-vindos: fale com a gente.' },
  { grupo: 'doe', chave: 'doe.vol_bloco', rotulo: 'Voluntariado: título do bloco de contato', padrao: 'Quero ser voluntário(a)' },

  // ---- contato
  { grupo: 'contato', chave: 'contato.etiqueta', rotulo: 'Etiqueta', padrao: 'Contato' },
  { grupo: 'contato', chave: 'contato.titulo', rotulo: 'Título', padrao: 'Fale com o Projeto Pé no Chão' },
  { grupo: 'contato', chave: 'contato.local', rotulo: 'Linha de localização (abaixo dos contatos)', padrao: 'Votorantim · São Paulo' },
  { grupo: 'contato', chave: 'contato.vazio', rotulo: 'Aviso enquanto não há contatos cadastrados', padrao: 'Os canais de contato do projeto serão publicados aqui em breve.', longo: true },

  // ---- prestação de contas
  { grupo: 'pc', chave: 'pc.etiqueta', rotulo: 'Etiqueta', padrao: 'Transparência' },
  { grupo: 'pc', chave: 'pc.titulo', rotulo: 'Título', padrao: 'Prestação de contas' },
  { grupo: 'pc', chave: 'pc.intro', rotulo: 'Texto de abertura', padrao: 'Aqui você vê, de forma simples, quanto recebemos e como usamos cada doação. Os comprovantes estão disponíveis para consulta.', longo: true },
  { grupo: 'pc', chave: 'pc.lista_titulo', rotulo: 'Lista: título', padrao: 'Entradas, gastos e comprovantes' },
  { grupo: 'pc', chave: 'pc.lista_intro', rotulo: 'Lista: explicação', padrao: 'Cada linha é um registro. Toque na miniatura para ver o comprovante.' },
  { grupo: 'pc', chave: 'pc.nota', rotulo: 'Nota ao final da página', padrao: 'Os valores são lançados pela equipe do projeto. Por privacidade, não divulgamos nomes de doadores sem autorização, e as fotos de comprovantes têm dados pessoais (CPF, contas, telefones) cobertos antes de serem publicadas.', longo: true },
  { grupo: 'pc', chave: 'pc.vazio_titulo', rotulo: 'Quando ainda não há registros: título', padrao: 'Ainda não há registros publicados' },
  { grupo: 'pc', chave: 'pc.vazio_texto', rotulo: 'Quando ainda não há registros: texto', padrao: 'Assim que a equipe publicar as primeiras entradas e gastos, eles aparecem aqui.', longo: true },
  { grupo: 'pc', chave: 'pc.botao_ajudar', rotulo: 'Botão final', padrao: 'Quero ajudar também' },

  // ---- privacidade
  { grupo: 'privacidade', chave: 'privacidade.etiqueta', rotulo: 'Etiqueta', padrao: 'LGPD' },
  { grupo: 'privacidade', chave: 'privacidade.titulo', rotulo: 'Título', padrao: 'Privacidade e proteção de dados' },
  { grupo: 'privacidade', chave: 'privacidade.texto', rotulo: 'Texto da política', padrao: PRIVACIDADE_PADRAO, longo: true, ajuda: 'Linhas que começam com “## ” viram subtítulos. Deixe uma linha em branco entre os parágrafos.' },
  { grupo: 'privacidade', chave: 'privacidade.link', rotulo: 'Link para o contato', padrao: 'Ir para a página de contato' },
];

export const PADROES: Record<string, string> = Object.fromEntries(CAMPOS_CONTEUDO.map((c) => [c.chave, c.padrao]));

export type Textos = Record<string, string> | null | undefined;

/** Texto efetivo: o que a equipe salvou ou, se nada foi salvo, o padrão. Vazio ("") fica em branco. */
export function tx(textos: Textos, chave: string): string {
  const v = textos?.[chave];
  return v === undefined || v === null ? (PADROES[chave] ?? '') : v;
}

/** Só o que difere do padrão (e é de uma chave conhecida) precisa ser guardado. */
export function sobrescritas(editados: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(editados)) {
    if (!(k in PADROES)) continue;
    const limpo = v.replace(/\r\n/g, '\n');
    if (limpo !== PADROES[k]) r[k] = limpo;
  }
  return r;
}

/** Valores para o formulário: todos os campos preenchidos (padrão + salvos). */
export function textosParaFormulario(salvos: Textos): Record<string, string> {
  const r: Record<string, string> = { ...PADROES };
  for (const [k, v] of Object.entries(salvos ?? {})) if (k in PADROES && typeof v === 'string') r[k] = v;
  return r;
}

/** Divide “Infância com *pé no chão*, *sol*” em pedaços, marcando os destacados. */
export function partesDestaque(texto: string): { texto: string; destaque: boolean }[] {
  const partes: { texto: string; destaque: boolean }[] = [];
  texto.split(/(\*[^*]+\*)/g).forEach((p) => {
    if (!p) return;
    if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) partes.push({ texto: p.slice(1, -1), destaque: true });
    else partes.push({ texto: p, destaque: false });
  });
  return partes;
}

export interface Bloco { tipo: 'p' | 'h'; texto: string }

/** Texto longo → parágrafos e subtítulos (“## ”). */
export function blocosDeTexto(texto: string): Bloco[] {
  return texto.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
    .map((b) => (b.startsWith('## ') ? { tipo: 'h' as const, texto: b.slice(3).trim() } : { tipo: 'p' as const, texto: b }));
}

// ---------------------------------------------------------------- imagens
export interface CampoImagem { chave: 'logo' | 'hero' | 'qr_pix'; rotulo: string; ajuda: string; padrao: string }
export const CAMPOS_IMAGEM: CampoImagem[] = [
  { chave: 'logo', rotulo: 'Logotipo (topo do site)', ajuda: 'Aparece no menu de todas as páginas. Imagem horizontal funciona melhor.', padrao: '/logo-640.jpg' },
  { chave: 'hero', rotulo: 'Imagem grande da página inicial', ajuda: 'Fica ao lado do título principal.', padrao: '/logo.jpg' },
  { chave: 'qr_pix', rotulo: 'QR Code do PIX (imagem do seu banco)', ajuda: 'Opcional. Se você enviar a imagem do QR Code, ela aparece na página “Como ajudar”. Pode ficar em branco por enquanto.', padrao: '' },
];
export const imagemDe = (imagens: Record<string, string> | null | undefined, chave: CampoImagem['chave']): string =>
  imagens?.[chave] || CAMPOS_IMAGEM.find((c) => c.chave === chave)!.padrao;
