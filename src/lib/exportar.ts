// Exportação de tabelas para CSV, Excel (XLSX) e impressão.
import { data as fmtData, dinheiro } from './formato';

export interface ColunaExport<T = Record<string, unknown>> {
  chave: string;
  titulo: string;
  tipo?: 'texto' | 'dinheiro' | 'data' | 'numero';
  valor?: (linha: T) => unknown;
}

function valorBruto<T>(linha: T, c: ColunaExport<T>): unknown {
  return c.valor ? c.valor(linha) : (linha as Record<string, unknown>)[c.chave];
}

function celulaTexto<T>(linha: T, c: ColunaExport<T>): string {
  const v = valorBruto(linha, c);
  if (v === null || v === undefined) return '';
  if (c.tipo === 'dinheiro') return Number(v).toFixed(2).replace('.', ',');
  if (c.tipo === 'data') return fmtData(String(v));
  if (c.tipo === 'numero') return String(v).replace('.', ',');
  return String(v);
}

/** CSV com BOM e separador ";" (abre corretamente no Excel em português). */
export function paraCSV<T>(linhas: T[], colunas: ColunaExport<T>[]): string {
  const esc = (s: string) => (/[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const cab = colunas.map((c) => esc(c.titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map((c) => esc(celulaTexto(l, c))).join(';'));
  return '﻿' + [cab, ...corpo].join('\r\n');
}

export function baixar(conteudo: BlobPart | Blob, nome: string, tipo = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportarCSV<T>(linhas: T[], colunas: ColunaExport<T>[], nome: string) {
  baixar(paraCSV(linhas, colunas), nome.endsWith('.csv') ? nome : nome + '.csv', 'text/csv;charset=utf-8');
}

export async function planilhaXLSX<T>(abas: { nome: string; linhas: T[]; colunas: ColunaExport<T>[] }[]): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Projeto Pé no Chão';
  wb.created = new Date();
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome.slice(0, 31));
    ws.columns = aba.colunas.map((c) => ({
      header: c.titulo,
      key: c.chave,
      width: Math.min(60, Math.max(12, c.titulo.length + 4)),
      style: c.tipo === 'dinheiro' ? { numFmt: '"R$" #,##0.00;[Red]-"R$" #,##0.00' } : c.tipo === 'data' ? { numFmt: 'dd/mm/yyyy' } : {},
    }));
    for (const l of aba.linhas) {
      const row: Record<string, unknown> = {};
      for (const c of aba.colunas) {
        const v = valorBruto(l, c);
        if (v === null || v === undefined || v === '') row[c.chave] = null;
        else if (c.tipo === 'dinheiro' || c.tipo === 'numero') row[c.chave] = Number(v);
        else if (c.tipo === 'data') row[c.chave] = new Date(String(v).slice(0, 10) + 'T12:00:00');
        else row[c.chave] = String(v);
      }
      ws.addRow(row);
    }
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportarXLSX<T>(linhas: T[], colunas: ColunaExport<T>[], nome: string, aba = 'Dados') {
  const blob = await planilhaXLSX([{ nome: aba, linhas, colunas }]);
  baixar(blob, nome.endsWith('.xlsx') ? nome : nome + '.xlsx');
}

/** Valor formatado para exibição em PDF/impressão. */
export function textoCelula<T>(linha: T, c: ColunaExport<T>): string {
  const v = valorBruto(linha, c);
  if (v === null || v === undefined || v === '') return '—';
  if (c.tipo === 'dinheiro') return dinheiro(v as number);
  if (c.tipo === 'data') return fmtData(String(v));
  return String(v);
}
