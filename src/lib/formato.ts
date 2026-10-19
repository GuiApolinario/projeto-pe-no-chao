// Formatação no padrão brasileiro e aritmética monetária segura (em centavos).

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR');
const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export type Valor = number | string | null | undefined;

/** Converte um valor (número ou texto numérico do banco) para centavos inteiros. */
export function centavos(v: Valor): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Soma valores monetários sem erro de ponto flutuante. */
export function somar(valores: Valor[]): number {
  return valores.reduce<number>((acc, v) => acc + centavos(v), 0) / 100;
}

export function dinheiro(v: Valor): string {
  if (v === null || v === undefined || v === '') return '—';
  return moeda.format(centavos(v) / 100);
}

export function num(v: Valor): string {
  if (v === null || v === undefined || v === '') return '—';
  return numero.format(Number(v));
}

export function pct(v: Valor): string {
  if (v === null || v === undefined || v === '') return '—';
  return percentual.format(Number(v)) + '%';
}

/**
 * Interpreta um valor digitado em formato brasileiro ("1.234,56", "R$ 10", "10,5")
 * ou internacional ("1234.56"). Retorna texto com 2 casas ("1234.56") ou null.
 */
export function lerDinheiro(texto: string): string | null {
  if (texto === null || texto === undefined) return null;
  let t = String(texto).trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (!t) return null;
  let negativo = false;
  if (t.startsWith('(') && t.endsWith(')')) { negativo = true; t = t.slice(1, -1); }
  if (t.startsWith('-')) { negativo = true; t = t.slice(1); }
  if (t.endsWith('-')) { negativo = true; t = t.slice(0, -1); }
  const temVirgula = t.includes(',');
  const temPonto = t.includes('.');
  if (temVirgula && temPonto) {
    // o último separador é o decimal
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (temVirgula) {
    t = t.replace(',', '.');
  } else if (temPonto) {
    // "1.234" (milhar) x "12.34" (decimal): mais de 2 dígitos após o ponto = milhar
    const partes = t.split('.');
    if (partes.length > 2 || partes[partes.length - 1].length === 3) t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100) * (negativo ? -1 : 1);
  return (c / 100).toFixed(2);
}

/** Data ISO (yyyy-mm-dd) → dd/mm/aaaa, sem efeito de fuso horário. */
export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd ou aaaammdd → aaaa-mm-dd */
export function lerData(texto: string): string | null {
  const t = (texto || '').trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? '20' + m[3] : m[3];
    return validarData(`${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validarData(`${m[1]}-${m[2]}-${m[3]}`);
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return validarData(`${m[1]}-${m[2]}-${m[3]}`);
  return null;
}

function validarData(iso: string): string | null {
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function hojeISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function mesAno(iso: string): string {
  const [a, m] = iso.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(m) - 1]}/${a.slice(2)}`;
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

export function inicioFimMes(iso: string): [string, string] {
  const [a, m] = iso.split('-').map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${a}-${String(m).padStart(2, '0')}-01`, `${a}-${String(m).padStart(2, '0')}-${String(fim).padStart(2, '0')}`];
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function cpfCnpjValido(doc: string): boolean {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
}
