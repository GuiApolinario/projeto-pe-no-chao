// Dados de EXEMPLO, só para pré-visualizar o visual da página. Nunca são gravados.
import type { Lancamento } from './tipos';

function aleatorio(semente: number) {
  return () => {
    semente |= 0; semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ENTRADAS: [string, string, number, number][] = [
  ['Doações via PIX', 'Doações recebidas por PIX', 180, 620],
  ['Doações de empresas', 'Doação de empresa parceira (exemplo)', 300, 900],
  ['Eventos e campanhas', 'Arrecadação do evento beneficente (exemplo)', 400, 1100],
  ['Parcerias e repasses', 'Repasse de parceria (exemplo)', 800, 1500],
];
const SAIDAS: [string, string, number, number][] = [
  ['Alimentação', 'Lanche para as atividades', 90, 340],
  ['Material esportivo', 'Bolas, coletes e cones', 120, 520],
  ['Material pedagógico', 'Cadernos, lápis e papéis', 60, 280],
  ['Transporte', 'Transporte para passeio das crianças', 80, 260],
  ['Eventos e atividades', 'Materiais para oficina', 70, 300],
  ['Serviços e manutenção', 'Manutenção do espaço', 100, 380],
];

/** Gera ~9 meses de movimentação terminando no mês de "hoje" (aaaa-mm-dd). */
export function lancamentosDemo(hoje: string): Lancamento[] {
  const r = aleatorio(20261014);
  const [ano, mes] = hoje.slice(0, 7).split('-').map(Number);
  const lista: Lancamento[] = [];
  let n = 0;
  const criar = (tipo: 'entrada' | 'saida', data: string, [categoria, descricao, min, max]: [string, string, number, number]) => {
    n++;
    const valor = Math.round((min + r() * (max - min)) * 100) / 100;
    const temFoto = r() < (tipo === 'saida' ? 0.75 : 0.35);
    lista.push({
      id: `demo-${n}`, tipo, data, valor, categoria, descricao, contraparte: tipo === 'entrada' && categoria === 'Doações de empresas' ? 'Empresa Exemplo Ltda.' : null,
      anexos: temFoto ? [{ path: `demo:${n}`, nome: `${tipo === 'saida' ? 'Nota fiscal' : 'Comprovante'} ${n}`, tipo: 'image/svg+xml' }] : [],
      atualizado_em: `${data}T12:00:00Z`,
    });
  };
  for (let i = 8; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const a = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const ultimo = a === ano && m === mes ? Math.max(1, Number(hoje.slice(8, 10))) : 28;
    const dia = () => String(1 + Math.floor(r() * ultimo)).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    ENTRADAS.forEach((e, k) => { if (k === 0 || r() < 0.55) criar('entrada', `${a}-${mm}-${dia()}`, e); });
    SAIDAS.forEach((s, k) => { if (k < 2 || r() < 0.6) criar('saida', `${a}-${mm}-${dia()}`, s); });
  }
  return lista.filter((l) => l.data <= hoje);
}
