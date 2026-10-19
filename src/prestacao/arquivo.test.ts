import { describe, expect, it } from 'vitest';
import { lerLista, novoCaminhoFoto, removerDaLista, salvarNaLista, serializar, urlDaFoto } from './arquivo';
import type { Lancamento } from './tipos';

const l = (o: Partial<Lancamento> = {}): Lancamento => ({ id: 'a', tipo: 'saida', data: '2026-03-10', valor: 50, categoria: 'Alimentação', descricao: 'Lanche', contraparte: null, anexos: [], atualizado_em: '2026-03-10T12:00:00Z', ...o });

describe('prestação de contas em arquivo', () => {
  it('arquivo vazio, ausente ou quebrado vira lista vazia', () => {
    expect(lerLista(null)).toEqual([]);
    expect(lerLista('')).toEqual([]);
    expect(lerLista('{ não é json')).toEqual([]);
    expect(lerLista('{ "lancamentos": [] }')).toEqual([]);
    expect(lerLista('{"outra":1}')).toEqual([]);
  });
  it('ida e volta mantém os dados e ordena do mais recente ao mais antigo', () => {
    const lista = [l({ id: 'a', data: '2026-01-05' }), l({ id: 'b', data: '2026-03-01', tipo: 'entrada', valor: 120.5, contraparte: 'Empresa X', anexos: [{ path: 'comprovantes/2026/03/x.jpg', nome: 'nota.jpg', tipo: 'image/jpeg' }] })];
    const lido = lerLista(serializar(lista));
    expect(lido.map((x) => x.id)).toEqual(['b', 'a']);
    expect(lido[0]).toMatchObject({ valor: 120.5, contraparte: 'Empresa X' });
    expect(lido[0].anexos[0]).toMatchObject({ path: 'comprovantes/2026/03/x.jpg', publico: true });
  });
  it('descarta itens inválidos e caminhos de foto perigosos', () => {
    const bruto = JSON.stringify({ lancamentos: [
      { id: '1', tipo: 'entrada', data: '2026-02-01', valor: 10, categoria: 'x', descricao: 'ok', anexos: [{ path: '../../etc/passwd' }, { path: 'https://x.com/a.jpg' }, { path: 'comprovantes/ok.jpg' }] },
      { id: '2', tipo: 'outro', data: '2026-02-01', valor: 10 }, { id: '3', tipo: 'saida', data: 'ontem', valor: 10 }, { id: '4', tipo: 'saida', data: '2026-02-01', valor: -5 }, { tipo: 'saida', data: '2026-02-01', valor: 5 }, null,
    ] });
    const r = lerLista(bruto);
    expect(r).toHaveLength(1);
    expect(r[0].anexos.map((a) => a.path)).toEqual(['comprovantes/ok.jpg']);
  });
  it('não guarda anotação interna nem campos extras', () => {
    const t = serializar([{ ...l(), observacao_interna: 'segredo', publicar: false } as Lancamento]);
    expect(t).not.toContain('segredo');
    expect(t).not.toContain('publicar');
  });
  it('salvar substitui pelo id e remover tira da lista', () => {
    const base = [l({ id: 'a' }), l({ id: 'b' })];
    expect(salvarNaLista(base, l({ id: 'b', valor: 99 })).find((x) => x.id === 'b')!.valor).toBe(99);
    expect(salvarNaLista(base, l({ id: 'c' }))).toHaveLength(3);
    expect(removerDaLista(base, 'a').map((x) => x.id)).toEqual(['b']);
  });
  it('caminho e endereço das fotos', () => {
    expect(novoCaminhoFoto('2026-03-10', 'u1', 'image/jpeg')).toBe('comprovantes/2026/03/u1.jpg');
    expect(novoCaminhoFoto('2026-03-10', 'u1', 'application/pdf')).toBe('comprovantes/2026/03/u1.pdf');
    expect(urlDaFoto({ path: 'comprovantes/2026/03/u1.jpg' })).toBe('/comprovantes/2026/03/u1.jpg');
  });
});
