// Geração de PDFs profissionais: cabeçalho com logo, rodapé com paginação.
import type { jsPDF } from 'jspdf';
import { dinheiro, dataHora, mesAno } from './formato';
import { textoCelula, type ColunaExport } from './exportar';

let logoCache: string | null = null;
async function logo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const r = await fetch('/logo-640.jpg');
    const b = await r.blob();
    logoCache = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b); });
    return logoCache;
  } catch { return null; }
}

export interface Documento {
  doc: jsPDF;
  y: number;
  margem: number;
  largura: number;
  altura: number;
  titulo: (t: string) => void;
  subtitulo: (t: string) => void;
  paragrafo: (t: string, tamanho?: number) => void;
  pares: (itens: [string, string][]) => void;
  tabela: <T>(linhas: T[], colunas: ColunaExport<T>[], opcoes?: { totais?: Record<string, string>; tamanho?: number }) => void;
  barras: (titulo: string, itens: { rotulo: string; valores: number[] }[], legendas: string[], cores?: [number, number, number][]) => void;
  espaco: (mm: number) => void;
  quebra: (minimo?: number) => void;
  assinaturas: (nomes: string[]) => void;
  finalizar: () => jsPDF;
}

export async function novoPDF(o: { titulo: string; subtitulo?: string; entidade?: string; paisagem?: boolean }): Promise<Documento> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: o.paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 14;
  const img = await logo();
  const topo = 30;

  const cabecalho = () => {
    if (img) doc.addImage(img, 'JPEG', margem, 7, 34, 17.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30);
    doc.text(o.titulo, largura - margem, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
    if (o.subtitulo) doc.text(o.subtitulo, largura - margem, 18, { align: 'right' });
    if (o.entidade) doc.text(o.entidade, largura - margem, 22.5, { align: 'right' });
    doc.setDrawColor(242, 169, 0); doc.setLineWidth(0.6); doc.line(margem, 26, largura - margem, 26);
  };

  const d: Documento = {
    doc, y: topo, margem, largura, altura,
    espaco(mm) { d.y += mm; },
    quebra(minimo = 30) { if (d.y + minimo > altura - 18) { doc.addPage(); cabecalho(); d.y = topo; } },
    titulo(t) {
      d.quebra(20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
      doc.text(t, margem, d.y + 5); d.y += 9;
    },
    subtitulo(t) {
      d.quebra(15);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(40);
      doc.text(t, margem, d.y + 4); d.y += 7;
    },
    paragrafo(t, tamanho = 9.5) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(tamanho); doc.setTextColor(50);
      const linhas = doc.splitTextToSize(t, largura - margem * 2) as string[];
      for (const l of linhas) { d.quebra(6); doc.text(l, margem, d.y + 4); d.y += tamanho * 0.45; }
      d.y += 2;
    },
    pares(itens) {
      doc.setFontSize(9.5);
      const larguraRotulo = 78;
      for (const [k, v] of itens) {
        doc.setFont('helvetica', 'bold');
        const rot = doc.splitTextToSize(k, larguraRotulo - 4) as string[];
        doc.setFont('helvetica', 'normal');
        const val = doc.splitTextToSize(v || '—', largura - margem * 2 - larguraRotulo) as string[];
        const h = Math.max(rot.length, val.length) * 4.4 + 1.2;
        d.quebra(h + 2);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(70); doc.text(rot, margem, d.y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30); doc.text(val, margem + larguraRotulo, d.y + 4);
        d.y += h;
      }
      d.y += 2;
    },
    tabela(linhas, colunas, opcoes) {
      d.quebra(20);
      const corpo = linhas.map((l) => colunas.map((c) => textoCelula(l, c)));
      const foot = opcoes?.totais ? [colunas.map((c, i) => opcoes.totais![c.chave] ?? (i === 0 ? 'Total' : ''))] : undefined;
      autoTable(doc, {
        startY: d.y,
        head: [colunas.map((c) => c.titulo)],
        body: corpo.length ? corpo : [[{ content: 'Nenhum registro no período.', colSpan: colunas.length, styles: { halign: 'center', textColor: 120 } }]],
        foot,
        margin: { left: margem, right: margem, top: topo, bottom: 18 },
        styles: { fontSize: opcoes?.tamanho ?? 8, cellPadding: 1.6, overflow: 'linebreak', lineColor: 225, lineWidth: 0.1 },
        headStyles: { fillColor: [254, 237, 191], textColor: 30, fontStyle: 'bold' },
        footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: Object.fromEntries(colunas.map((c, i) => [i, c.tipo === 'dinheiro' || c.tipo === 'numero' ? { halign: 'right' } : {}])),
        didDrawPage: () => cabecalho(),
      });
      d.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    },
    barras(titulo, itens, legendas, cores = [[22, 163, 74], [220, 38, 38], [37, 99, 235]]) {
      const altG = 62;
      d.quebra(altG + 18);
      d.subtitulo(titulo);
      const x0 = margem + 22, y0 = d.y + altG, larg = largura - margem * 2 - 26;
      const max = Math.max(1, ...itens.flatMap((i) => i.valores.map(Math.abs)));
      doc.setDrawColor(200); doc.setLineWidth(0.2);
      doc.setFontSize(7); doc.setTextColor(110);
      for (let k = 0; k <= 4; k++) {
        const yy = y0 - (altG * k) / 4;
        doc.line(x0, yy, x0 + larg, yy);
        doc.text(dinheiro((max * k) / 4).replace(/,\d\d$/, ''), x0 - 2, yy + 1, { align: 'right' });
      }
      const grupo = larg / Math.max(1, itens.length);
      const barra = Math.min(10, (grupo * 0.75) / legendas.length);
      itens.forEach((it, gi) => {
        it.valores.forEach((v, vi) => {
          const h = (Math.abs(v) / max) * altG;
          const c = cores[vi % cores.length];
          doc.setFillColor(c[0], c[1], c[2]);
          doc.rect(x0 + gi * grupo + (grupo - barra * legendas.length) / 2 + vi * barra, y0 - h, barra - 0.6, h, 'F');
        });
        doc.setTextColor(80);
        const r = doc.splitTextToSize(it.rotulo, grupo - 1) as string[];
        doc.text(r.slice(0, 2), x0 + gi * grupo + grupo / 2, y0 + 4, { align: 'center' });
      });
      let lx = x0;
      legendas.forEach((l, i) => {
        const c = cores[i % cores.length];
        doc.setFillColor(c[0], c[1], c[2]); doc.rect(lx, y0 + 10, 3, 3, 'F');
        doc.setTextColor(60); doc.text(l, lx + 4.5, y0 + 12.5); lx += doc.getTextWidth(l) + 12;
      });
      d.y = y0 + 18;
    },
    assinaturas(nomes) {
      d.quebra(40);
      d.y += 18;
      const w = (largura - margem * 2) / nomes.length;
      doc.setFontSize(8.5); doc.setTextColor(60); doc.setDrawColor(120);
      nomes.forEach((n, i) => {
        const cx = margem + w * i + w / 2;
        doc.line(cx - w / 2 + 6, d.y, cx + w / 2 - 6, d.y);
        doc.text(doc.splitTextToSize(n, w - 10) as string[], cx, d.y + 4.5, { align: 'center' });
      });
      d.y += 14;
    },
    finalizar() {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5); doc.setTextColor(120); doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em ${dataHora(new Date().toISOString())} pelo sistema de prestação de contas do Projeto Pé no Chão`, margem, altura - 8);
        doc.text(`Página ${i} de ${total}`, largura - margem, altura - 8, { align: 'right' });
      }
      return doc;
    },
  };
  cabecalho();
  return d;
}

export function rotuloMes(iso: string) { return mesAno(iso); }

export function abrirPDF(doc: jsPDF, nome: string, baixarArquivo = false) {
  if (baixarArquivo) { doc.save(nome); return; }
  const url = doc.output('bloburl');
  const w = window.open(String(url), '_blank');
  if (!w) doc.save(nome);
}
