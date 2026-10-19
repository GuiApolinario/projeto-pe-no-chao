// Preparação das fotos de comprovantes: reduz o tamanho (fotos de celular têm vários MB),
// remove dados ocultos (EXIF/localização) e permite cobrir trechos com tarja preta.
export const LIMITE_BYTES = 5 * 1024 * 1024;
const LADO_MAXIMO = 1800;

export interface Tarja { x: number; y: number; w: number; h: number } // frações de 0 a 1

export class ErroArquivo extends Error {}

async function abrirImagem(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ErroArquivo('Não consegui abrir esta imagem. Tente tirar a foto de novo ou use um arquivo JPG ou PNG.');
  }
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new ErroArquivo('Não foi possível preparar a imagem.'))), 'image/jpeg', 0.82));
}

function nomeJpg(nome: string) {
  return nome.replace(/\.[^.]+$/, '') + '.jpg';
}

async function renderizar(bmp: ImageBitmap, tarjas: Tarja[]): Promise<Blob> {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  ctx.fillStyle = '#000';
  for (const t of tarjas) ctx.fillRect(Math.floor(t.x * w), Math.floor(t.y * h), Math.ceil(t.w * w), Math.ceil(t.h * h));
  return paraBlob(canvas);
}

/** Valida e prepara um arquivo escolhido pelo usuário (imagem ou PDF). */
export async function prepararArquivo(file: File): Promise<File> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > LIMITE_BYTES) throw new ErroArquivo(`"${file.name}" é um PDF maior que 5 MB.`);
    const cab = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...cab) !== '%PDF-') throw new ErroArquivo(`"${file.name}" não parece ser um PDF válido.`);
    return new File([file], file.name, { type: 'application/pdf' });
  }
  if (!file.type.startsWith('image/')) throw new ErroArquivo(`"${file.name}": use foto (JPG, PNG) ou PDF.`);
  const bmp = await abrirImagem(file);
  const blob = await renderizar(bmp, []);
  bmp.close();
  if (blob.size > LIMITE_BYTES) throw new ErroArquivo(`"${file.name}" continua grande demais depois de reduzida.`);
  return new File([blob], nomeJpg(file.name), { type: 'image/jpeg' });
}

/** Aplica tarjas pretas sobre a imagem (irreversível no arquivo gerado). */
export async function aplicarTarjas(file: File, tarjas: Tarja[]): Promise<File> {
  const bmp = await abrirImagem(file);
  const blob = await renderizar(bmp, tarjas);
  bmp.close();
  return new File([blob], file.name.endsWith('.jpg') ? file.name : nomeJpg(file.name), { type: 'image/jpeg' });
}

export async function carregarBitmap(file: Blob): Promise<ImageBitmap> {
  return abrirImagem(file);
}

/** Normaliza um retângulo arrastado (qualquer direção) em fração da imagem; null se for pequeno demais. */
export function tarjaDeArraste(x1: number, y1: number, x2: number, y2: number, largura: number, altura: number): Tarja | null {
  const x = Math.max(0, Math.min(x1, x2)), y = Math.max(0, Math.min(y1, y2));
  const w = Math.min(largura, Math.max(x1, x2)) - x, h = Math.min(altura, Math.max(y1, y2)) - y;
  if (w < 6 || h < 6) return null;
  return { x: x / largura, y: y / altura, w: w / largura, h: h / altura };
}

/** Imagem do site (logotipo, QR Code): reduz o tamanho; PNG mantém nitidez de QR Code e logotipos. */
export async function prepararImagemSite(file: File, ladoMax: number, png: boolean): Promise<{ bytes: Uint8Array; ext: 'png' | 'jpg'; tipo: string }> {
  if (!file.type.startsWith('image/')) throw new ErroArquivo('Escolha uma imagem (JPG ou PNG).');
  const bmp = await abrirImagem(file);
  const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala); canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext('2d')!;
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const tipo = png ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, 0.85));
  if (!blob) throw new ErroArquivo('Não foi possível preparar a imagem.');
  if (blob.size > 2 * 1024 * 1024) throw new ErroArquivo('A imagem continua grande demais (mais de 2 MB). Use uma menor.');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: png ? 'png' : 'jpg', tipo };
}
