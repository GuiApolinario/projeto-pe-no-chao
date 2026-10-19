import { describe, expect, it } from 'vitest';
import { manterAtivo } from './manter-banco-ativo.mjs';

const cfg = { supabase_url: 'https://abcdefgh.supabase.co', supabase_anon_key: 'eyJkey' };
const quieto = { log: () => {}, esperaMs: 1 };
const resp = (status, corpo = '[]') => ({ status, text: async () => corpo });

describe('manter o banco ativo', () => {
  it('sem banco configurado não faz nada e não falha', async () => {
    const r = await manterAtivo({ supabase_url: null, supabase_anon_key: null }, { ...quieto, fetchFn: () => { throw new Error('não deveria chamar'); } });
    expect(r).toMatchObject({ ok: true, pulado: true });
  });
  it('faz as 3 chamadas, grava o ping e manda as chaves certas', async () => {
    const chamadas = [];
    const r = await manterAtivo(cfg, { ...quieto, fetchFn: async (u, o) => { chamadas.push([o.method, u, o.headers]); return resp(200, u.includes('pc_ping') ? '"2026-10-19T10:00:00Z"' : '[]'); } });
    expect(r).toMatchObject({ ok: true, pulado: false, ultimoPing: '2026-10-19T10:00:00Z' });
    expect(chamadas.map((c) => `${c[0]} ${new URL(c[1]).pathname}`)).toEqual(['POST /rest/v1/rpc/pc_ping', 'GET /rest/v1/pc_publico', 'GET /rest/v1/pc_site']);
    expect(chamadas[0][2]).toMatchObject({ apikey: 'eyJkey', Authorization: 'Bearer eyJkey' });
  });
  it('chaves novas (sb_publishable_…) não vão no cabeçalho Authorization', async () => {
    let cab;
    await manterAtivo({ ...cfg, supabase_anon_key: 'sb_publishable_abc' }, { ...quieto, fetchFn: async (_u, o) => { cab = o.headers; return resp(200); } });
    expect(cab.apikey).toBe('sb_publishable_abc');
    expect(cab.Authorization).toBeUndefined();
  });
  it('tenta de novo em erro de rede ou 5xx e depois consegue', async () => {
    let n = 0;
    const r = await manterAtivo(cfg, { ...quieto, fetchFn: async () => { n++; if (n === 1) throw new Error('boom'); if (n === 2) return resp(503); return resp(200); } });
    expect(r.ok).toBe(true);
    expect(n).toBe(5); // 3 tentativas no 1º passo + 1 + 1
  });
  it('banco fora do ar (projeto pausado): falha depois de 3 tentativas, com instrução de restaurar', async () => {
    let n = 0;
    const r = await manterAtivo(cfg, { ...quieto, fetchFn: async () => { n++; return resp(540, 'paused'); } });
    expect(n).toBe(3);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/Restore project/);
  });
  it('erros 4xx não são repetidos e explicam o problema', async () => {
    let n = 0;
    const naoExiste = await manterAtivo(cfg, { ...quieto, fetchFn: async () => { n++; return resp(404, '{"code":"PGRST202"}'); } });
    expect(n).toBe(1);
    expect(naoExiste.mensagem).toMatch(/01_prestacao_simples\.sql/);
    const chave = await manterAtivo(cfg, { ...quieto, fetchFn: async () => resp(401) });
    expect(chave.mensagem).toMatch(/anon/);
  });
  it('recusa endereços que não sejam do Supabase (e http, salvo em teste local)', async () => {
    const nunca = { ...quieto, fetchFn: () => { throw new Error('não deveria chamar'); } };
    expect((await manterAtivo({ ...cfg, supabase_url: 'https://evil.example.com' }, nunca)).ok).toBe(false);
    expect((await manterAtivo({ ...cfg, supabase_url: 'http://abcdefgh.supabase.co' }, nunca)).ok).toBe(false);
    expect((await manterAtivo({ ...cfg, supabase_url: 'http://localhost:54321' }, nunca)).ok).toBe(false);
    expect((await manterAtivo({ ...cfg, supabase_url: 'http://localhost:54321' }, { ...quieto, permitirHttp: true, fetchFn: async () => resp(200) })).ok).toBe(true);
  });
});
