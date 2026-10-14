// Importação de extratos bancários (CSV e OFX) e sugestão de correspondências.
import { centavos, diasEntre, lerData, lerDinheiro } from './formato';

export interface LinhaExtrato {
  data: string;        // aaaa-mm-dd
  descricao: string;
  documento?: string;
  valor: string;       // "+123.45" crédito / "-123.45" débito, 2 casas
  fitid?: string;
}

export interface ExtratoLido {
  linhas: LinhaExtrato[];
  saldoFinal?: string;
  dataInicio?: string;
  dataFim?: string;
  avisos: string[];
}

// ------------------------------------------------------------------ CSV
export function detectarSeparador(cabecalho: string): string {
  const cont = (c: string) => cabecalho.split(c).length - 1;
  return [';', ',', '\t'].sort((a, b) => cont(b) - cont(a))[0];
}

export function dividirCSV(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let atual: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { atual.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      atual.push(campo); campo = '';
      if (atual.some((x) => x.trim() !== '')) linhas.push(atual);
      atual = [];
    } else campo += c;
  }
  atual.push(campo);
  if (atual.some((x) => x.trim() !== '')) linhas.push(atual);
  return linhas;
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface MapeamentoCSV {
  data: number;
  descricao: number;
  valor?: number;
  credito?: number;
  debito?: number;
  documento?: number;
}

/** Tenta descobrir as colunas pelo cabeçalho (Banco do Brasil, Caixa, Itaú, Bradesco, Nubank, Inter…). */
export function sugerirMapeamento(cabecalho: string[]): Partial<MapeamentoCSV> {
  const h = cabecalho.map(sem);
  const achar = (...nomes: string[]) => {
    const i = h.findIndex((c) => nomes.some((n) => c === n || c.includes(n)));
    return i >= 0 ? i : undefined;
  };
  return {
    data: achar('data lancamento', 'data movimento', 'data'),
    descricao: achar('historico', 'descricao', 'lancamento', 'memo', 'titulo', 'detalhe'),
    valor: achar('valor (r$)', 'valor'),
    credito: achar('credito', 'entrada'),
    debito: achar('debito', 'saida'),
    documento: achar('documento', 'n doc', 'num doc', 'identificador', 'id'),
  };
}

export function lerCSV(texto: string, mapa?: MapeamentoCSV): ExtratoLido & { cabecalho: string[] } {
  const limpo = texto.replace(/^﻿/, '');
  const sep = detectarSeparador(limpo.split(/\r?\n/)[0] || '');
  const tabela = dividirCSV(limpo, sep);
  const avisos: string[] = [];
  if (tabela.length < 2) return { linhas: [], avisos: ['Arquivo sem linhas de movimentação.'], cabecalho: tabela[0] || [] };
  const cabecalho = tabela[0];
  const m = { ...sugerirMapeamento(cabecalho), ...mapa } as MapeamentoCSV;
  if (m.data === undefined || m.descricao === undefined || (m.valor === undefined && m.credito === undefined && m.debito === undefined)) {
    return { linhas: [], avisos: ['Não foi possível identificar as colunas de data, descrição e valor. Ajuste o mapeamento.'], cabecalho };
  }
  const linhas: LinhaExtrato[] = [];
  tabela.slice(1).forEach((cols, i) => {
    const d = lerData(cols[m.data] ?? '');
    const desc = (cols[m.descricao] ?? '').trim();
    let v: string | null = null;
    if (m.valor !== undefined && (cols[m.valor] ?? '').trim()) {
      // alguns bancos marcam crédito/débito com "C"/"D" ao final ("150,00 D")
      const bruto = cols[m.valor].trim();
      const debito = /[\d\s]D$/i.test(bruto);
      v = lerDinheiro(bruto.replace(/\s*[CD]$/i, ''));
      if (v && debito && !v.startsWith('-')) v = '-' + v;
    } else {
      const cr = m.credito !== undefined ? lerDinheiro(cols[m.credito] ?? '') : null;
      const db = m.debito !== undefined ? lerDinheiro(cols[m.debito] ?? '') : null;
      if (cr && Number(cr) !== 0) v = Math.abs(Number(cr)).toFixed(2);
      else if (db && Number(db) !== 0) v = (-Math.abs(Number(db))).toFixed(2);
    }
    if (!d) {
      if (/saldo/i.test(desc)) return;
      avisos.push(`Linha ${i + 2}: data inválida ("${cols[m.data] ?? ''}") — ignorada.`);
      return;
    }
    if (/^saldo/i.test(sem(desc))) return; // linhas de saldo do dia não são movimentos
    if (!v || Number(v) === 0) {
      avisos.push(`Linha ${i + 2}: valor ausente ou zero — ignorada.`);
      return;
    }
    linhas.push({ data: d, descricao: desc || '(sem descrição)', valor: v,
      documento: m.documento !== undefined ? (cols[m.documento] || '').trim() || undefined : undefined });
  });
  return { linhas, avisos, cabecalho, ...periodo(linhas) };
}

// ------------------------------------------------------------------ OFX
function tag(bloco: string, nome: string): string | undefined {
  const r = new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i').exec(bloco);
  return r ? r[1].trim() : undefined;
}

export function lerOFX(texto: string): ExtratoLido {
  const avisos: string[] = [];
  const linhas: LinhaExtrato[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const d = lerData(tag(bloco, 'DTPOSTED') || '');
    const v = lerDinheiro((tag(bloco, 'TRNAMT') || '').replace(',', '.'));
    if (!d || !v || Number(v) === 0) { avisos.push('Transação OFX sem data ou valor ignorada.'); continue; }
    linhas.push({
      data: d,
      valor: v,
      descricao: tag(bloco, 'MEMO') || tag(bloco, 'NAME') || '(sem descrição)',
      documento: tag(bloco, 'CHECKNUM') || tag(bloco, 'REFNUM'),
      fitid: tag(bloco, 'FITID'),
    });
  }
  const ledger = texto.split(/<LEDGERBAL>/i)[1];
  const saldoFinal = ledger ? lerDinheiro((tag(ledger, 'BALAMT') || '').replace(',', '.')) ?? undefined : undefined;
  const ini = lerData(tag(texto, 'DTSTART') || '') ?? undefined;
  const fim = lerData(tag(texto, 'DTEND') || '') ?? undefined;
  const p = periodo(linhas);
  return { linhas, avisos, saldoFinal, dataInicio: ini ?? p.dataInicio, dataFim: fim ?? p.dataFim };
}

function periodo(linhas: LinhaExtrato[]) {
  if (!linhas.length) return {};
  const datas = linhas.map((l) => l.data).sort();
  return { dataInicio: datas[0], dataFim: datas[datas.length - 1] };
}

/** saldo final esperado = saldo inicial + soma dos movimentos */
export function diferencaExtrato(saldoInicial: string, saldoFinal: string, linhas: { valor: string | number }[]): number {
  const soma = linhas.reduce((a, l) => a + centavos(l.valor), 0);
  return (centavos(saldoFinal) - centavos(saldoInicial) - soma) / 100;
}

// ------------------------------------------------------------------ sugestões de conciliação
export interface Candidato {
  id: string;
  tipo: 'pagamento' | 'receita';
  data: string;
  valor: number;     // assinado como no extrato: pagamento negativo, receita positiva
  descricao: string;
}

export interface Sugestao { linhaIndice: number; candidato: Candidato; diasDiferenca: number; }

/**
 * Sugere correspondências pelo valor exato e data próxima (até `tolerancia` dias).
 * As sugestões NUNCA são gravadas automaticamente: o usuário confirma cada uma.
 * Cada candidato é sugerido para no máximo uma linha (a de data mais próxima).
 */
export function sugerirCorrespondencias(
  linhas: { data: string; valor: string | number }[],
  candidatos: Candidato[],
  tolerancia = 5,
): Sugestao[] {
  const pares: Sugestao[] = [];
  linhas.forEach((l, i) => {
    for (const c of candidatos) {
      if (centavos(l.valor) !== centavos(c.valor)) continue;
      const dias = Math.abs(diasEntre(l.data, c.data));
      if (dias <= tolerancia) pares.push({ linhaIndice: i, candidato: c, diasDiferenca: dias });
    }
  });
  pares.sort((a, b) => a.diasDiferenca - b.diasDiferenca);
  const usadosL = new Set<number>();
  const usadosC = new Set<string>();
  const res: Sugestao[] = [];
  for (const p of pares) {
    if (usadosL.has(p.linhaIndice) || usadosC.has(p.candidato.id)) continue;
    usadosL.add(p.linhaIndice);
    usadosC.add(p.candidato.id);
    res.push(p);
  }
  return res.sort((a, b) => a.linhaIndice - b.linhaIndice);
}
