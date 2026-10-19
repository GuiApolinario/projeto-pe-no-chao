import { describe, expect, it } from 'vitest';
import { anosDisponiveis, buscar, filtrarPeriodo, ordenarRecentes, porCategoria, porMes, resumo, ultimaAtualizacao } from './calculos';
import { categoriaDoGrafico } from './categorias';
import type { Lancamento } from './tipos';

let n = 0;
const L = (tipo: 'entrada' | 'saida', data: string, valor: number, categoria: string, extra: Partial<Lancamento> = {}): Lancamento => ({
  id: String(++n), tipo, data, valor, categoria, descricao: `desc ${n}`, contraparte: null, anexos: [], atualizado_em: `${data}T10:00:00Z`, ...extra,
});

const dados: Lancamento[] = [
  L('entrada', '2025-12-10', 500, 'Doações via PIX'),
  L('entrada', '2026-01-10', 1000.1, 'Doações via PIX'),
  L('entrada', '2026-01-20', 0.2, 'Doações de empresas'),
  L('saida', '2026-01-15', 300.3, 'Alimentação', { anexos: [{ path: 'a.jpg' }] }),
  L('saida', '2026-03-05', 100, 'Categoria inventada'),
  L('saida', '2026-03-06', 50, 'Alimentação'),
];

describe('resumo', () => {
  it('soma sem erro de centavos e calcula saldo e % usado', () => {
    const r = resumo(dados);
    expect(r.entradas).toBe(1500.3);
    expect(r.saidas).toBe(450.3);
    expect(r.saldo).toBe(1050);
    expect(r.qtdEntradas).toBe(3);
    expect(r.qtdSaidas).toBe(3);
    expect(r.pctUsado).toBeCloseTo(30.014, 2);
    expect(r.semComprovante).toBe(5);
  });
  it('sem entradas, % usado é nulo', () => {
    expect(resumo([L('saida', '2026-01-01', 10, 'Alimentação')]).pctUsado).toBeNull();
    expect(resumo([]).saldo).toBe(0);
  });
});

describe('período', () => {
  it('lista anos e filtra por ano e mês', () => {
    expect(anosDisponiveis(dados)).toEqual([2026, 2025]);
    expect(filtrarPeriodo(dados, 2026, 0)).toHaveLength(5);
    expect(filtrarPeriodo(dados, 2026, 3)).toHaveLength(2);
    expect(filtrarPeriodo(dados, null, 0)).toHaveLength(6);
  });
});

describe('mês a mês', () => {
  it('acumula o saldo incluindo anos anteriores e preenche meses vazios', () => {
    const m = porMes(dados, 2026, '2026-03-20');
    expect(m.map((x) => x.mes)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(m[0]).toMatchObject({ entradas: 1000.3, saidas: 300.3, saldo: 1200 }); // 500 de dezembro + 1000,30 − 300,30
    expect(m[1]).toMatchObject({ entradas: 0, saidas: 0, saldo: 1200 });
    expect(m[2]).toMatchObject({ saidas: 150, saldo: 1050 });
  });
  it('todos os anos: do primeiro ao último mês com dados', () => {
    const m = porMes(dados, null, '2026-10-01');
    expect(m[0].mes).toBe('2025-12');
    expect(m[m.length - 1].mes).toBe('2026-03');
    expect(m).toHaveLength(4);
  });
  it('ano passado aparece completo; ano corrente vai até o mês atual', () => {
    expect(porMes(dados, 2025, '2026-03-20')).toHaveLength(12);
    expect(porMes(dados, 2026, '2026-06-02').map((x) => x.mes).pop()).toBe('2026-06');
  });
  it('sem dados, série vazia', () => expect(porMes([], null, '2026-01-01')).toEqual([]));
});

describe('categorias', () => {
  it('agrupa, ordena e calcula percentuais; categoria livre vira Outras', () => {
    const s = porCategoria(dados, 'saida');
    expect(s.map((x) => x.categoria)).toEqual(['Alimentação', 'Outras despesas']);
    expect(s[0]).toMatchObject({ valor: 350.3, qtd: 2 });
    expect(s[1]).toMatchObject({ valor: 100, qtd: 1 });
    expect(s.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100, 6);
    expect(s[0].valor).toBeGreaterThan(s[1].valor);
  });
  it('normalização', () => {
    expect(categoriaDoGrafico('entrada', 'Doações via PIX')).toBe('Doações via PIX');
    expect(categoriaDoGrafico('entrada', 'Rifa')).toBe('Outras entradas');
  });
});

describe('busca e ordem', () => {
  it('busca ignora acentos e maiúsculas', () => {
    expect(buscar([L('saida', '2026-01-01', 1, 'Alimentação', { descricao: 'Lanche do Treino' })], 'LANCHE treino')).toHaveLength(1);
    expect(buscar(dados, 'alimentacao')).toHaveLength(2);
    expect(buscar(dados, '')).toHaveLength(6);
  });
  it('ordena do mais recente e informa a última atualização', () => {
    expect(ordenarRecentes(dados)[0].data).toBe('2026-03-06');
    expect(ultimaAtualizacao(dados)).toBe('2026-03-06T10:00:00Z');
    expect(ultimaAtualizacao([])).toBeNull();
  });
});
