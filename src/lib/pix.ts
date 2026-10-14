// Geração do "PIX Copia e Cola" (BR Code estático, padrão EMV do Banco Central).

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor;
}

/** Remove acentos e caracteres não permitidos; corta no tamanho máximo. */
export function normalizarTexto(t: string, max: number): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,-]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF). */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface DadosPix {
  chave: string;
  nome: string;
  cidade: string;
  valor?: number | null;
  descricao?: string;
  txid?: string;
}

/** Normaliza a chave: telefone recebe +55, CPF/CNPJ só dígitos, e-mail minúsculo. */
export function normalizarChave(chave: string): string {
  const c = chave.trim();
  if (c.includes('@')) return c.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
  if (c.startsWith('+')) return '+' + c.replace(/\D/g, '');
  const digitos = c.replace(/\D/g, '');
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(c) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(c)) return digitos;
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(c)) return '+55' + digitos;
  return c;
}

export function gerarPixCopiaECola(d: DadosPix): string {
  const gui = campo('00', 'br.gov.bcb.pix');
  const chave = campo('01', normalizarChave(d.chave));
  const desc = d.descricao ? campo('02', normalizarTexto(d.descricao, 40)) : '';
  let p = campo('00', '01');
  p += campo('26', gui + chave + desc);
  p += campo('52', '0000');
  p += campo('53', '986');
  if (d.valor && d.valor > 0) p += campo('54', d.valor.toFixed(2));
  p += campo('58', 'BR');
  p += campo('59', normalizarTexto(d.nome, 25) || 'PROJETO PE NO CHAO');
  p += campo('60', normalizarTexto(d.cidade, 15) || 'VOTORANTIM');
  p += campo('62', campo('05', (d.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
  p += '6304';
  return p + crc16(p);
}
