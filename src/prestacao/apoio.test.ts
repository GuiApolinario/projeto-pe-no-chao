import { describe, expect, it } from 'vitest';
import { lancamentosDemo } from './demo';
import { tarjaDeArraste } from './imagem';
import { resumo } from './calculos';
import { ehPdf, modoDemo, temBackend, temPrestacao, urlFotoPublica } from './config';

describe('configuração da prestação de contas', () => {
  it('só mostra a aba quando há banco configurado ou modo exemplo', () => {
    expect(temPrestacao({})).toBe(false);
    expect(temPrestacao(null)).toBe(false);
    expect(temPrestacao({ supabase_url: 'https://x.supabase.co' })).toBe(false); // falta a chave
    expect(temPrestacao({ supabase_url: 'https://x.supabase.co', supabase_anon_key: 'k' })).toBe(true);
    expect(temPrestacao({ prestacao_demo: true })).toBe(true);
  });
  it('exemplo nunca vale quando o banco real está configurado', () => {
    expect(modoDemo({ prestacao_demo: true })).toBe(true);
    expect(modoDemo({ prestacao_demo: true, supabase_url: 'u', supabase_anon_key: 'k' })).toBe(false);
    expect(temBackend({ supabase_url: 'u', supabase_anon_key: 'k' })).toBe(true);
  });
  it('monta o endereço da foto pública e reconhece PDF', () => {
    const c = { supabase_url: 'https://x.supabase.co', supabase_anon_key: 'k' };
    expect(urlFotoPublica(c, { path: '2026/10/a b.jpg' })).toBe('https://x.supabase.co/storage/v1/object/public/prestacao-publica/2026/10/a%20b.jpg');
    expect(urlFotoPublica(c, { path: 'demo:3', nome: 'x' }).startsWith('data:image/svg+xml')).toBe(true);
    expect(ehPdf({ path: 'a.PDF' })).toBe(true);
    expect(ehPdf({ path: 'a.jpg', tipo: 'application/pdf' })).toBe(true);
    expect(ehPdf({ path: 'a.jpg', tipo: 'image/jpeg' })).toBe(false);
  });
});

describe('dados de exemplo', () => {
  it('são determinísticos, não passam de hoje e misturam entradas e saídas com e sem comprovante', () => {
    const a = lancamentosDemo('2026-10-19');
    expect(a).toEqual(lancamentosDemo('2026-10-19'));
    expect(a.length).toBeGreaterThan(30);
    expect(a.every((l) => l.data <= '2026-10-19' && l.valor > 0)).toBe(true);
    expect(new Set(a.map((l) => l.data.slice(0, 7))).size).toBe(9);
    const r = resumo(a);
    expect(r.qtdEntradas).toBeGreaterThan(5);
    expect(r.qtdSaidas).toBeGreaterThan(5);
    expect(r.semComprovante).toBeGreaterThan(0);
    expect(r.semComprovante).toBeLessThan(a.length);
    expect(a.every((l) => l.id.startsWith('demo-'))).toBe(true);
  });
});

describe('tarja', () => {
  it('aceita arraste em qualquer direção e converte para fração da imagem', () => {
    expect(tarjaDeArraste(10, 20, 110, 70, 200, 100)).toEqual({ x: 0.05, y: 0.2, w: 0.5, h: 0.5 });
    expect(tarjaDeArraste(110, 70, 10, 20, 200, 100)).toEqual({ x: 0.05, y: 0.2, w: 0.5, h: 0.5 });
  });
  it('ignora toques acidentais e limita à borda da imagem', () => {
    expect(tarjaDeArraste(10, 10, 12, 12, 200, 100)).toBeNull();
    expect(tarjaDeArraste(150, 50, 400, 300, 200, 100)).toEqual({ x: 0.75, y: 0.5, w: 0.25, h: 0.5 });
  });
});

import { valorCurto } from './componentes';
describe('rótulo curto do eixo', () => {
  it('abrevia milhares e milhões', () => {
    expect([0, 800, 1600, 12000, 1250000, 3000000].map(valorCurto)).toEqual(['0', '800', '1,6 mil', '12 mil', '1,3 mi', '3 mi']);
  });
});
