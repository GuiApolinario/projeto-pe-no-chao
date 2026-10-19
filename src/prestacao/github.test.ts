import { describe, expect, it } from 'vitest';
import { ClienteGitHub, ErroGitHub, paraBase64 } from './github';

function simulador(respostas: Record<string, { status?: number; corpo?: unknown }>) {
  const chamadas: { metodo: string; caminho: string; corpo: unknown; auth: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const caminho = url.replace('https://api.github.com', '');
    chamadas.push({ metodo: init.method!, caminho, corpo: init.body ? JSON.parse(init.body as string) : undefined, auth: (init.headers as Record<string, string>).Authorization });
    const chave = `${init.method} ${caminho.split('?')[0]}`;
    const r = respostas[chave] ?? { status: 404, corpo: {} };
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

describe('cliente do GitHub', () => {
  it('rejeita repositório com formato inválido', () => {
    expect(() => new ClienteGitHub('t', '../x')).toThrow(ErroGitHub);
  });
  it('verifica permissão de escrita e devolve o ramo padrão', async () => {
    const ok = simulador({ 'GET /repos/a/b': { corpo: { default_branch: 'main', permissions: { push: true } } } });
    expect(await new ClienteGitHub('tk', 'a/b', ok.f).verificar()).toEqual({ ramo: 'main' });
    expect(ok.chamadas[0].auth).toBe('Bearer tk');
    const so = simulador({ 'GET /repos/a/b': { corpo: { default_branch: 'main', permissions: { push: false } } } });
    await expect(new ClienteGitHub('tk', 'a/b', so.f).verificar()).rejects.toThrow(/só consegue ler/);
  });
  it('traduz erros em mensagens simples', async () => {
    for (const [status, re] of [[401, /não foi aceita/], [403, /Sem permissão/], [404, /Sem permissão/], [500, /erro 500/]] as const) {
      const s = simulador({ 'GET /repos/a/b': { status } });
      await expect(new ClienteGitHub('tk', 'a/b', s.f).verificar()).rejects.toThrow(re);
    }
    const rede = (async () => { throw new TypeError('x'); }) as unknown as typeof fetch;
    await expect(new ClienteGitHub('tk', 'a/b', rede).verificar()).rejects.toThrow(/Sem conexão/);
  });
  it('lê arquivo em UTF-8 e devolve null se não existir', async () => {
    const conteudo = btoa(String.fromCharCode(...new TextEncoder().encode('{"a":"Pé no Chão"}')));
    const s = simulador({ 'GET /repos/a/b/contents/public/site.json': { corpo: { content: conteudo + '\n', encoding: 'base64' } } });
    const c = new ClienteGitHub('tk', 'a/b', s.f);
    expect(await c.lerTexto('main', 'public/site.json')).toBe('{"a":"Pé no Chão"}');
    expect(await c.lerTexto('main', 'public/outro.json')).toBeNull();
  });
  it('grava vários arquivos em um único commit, sem forçar', async () => {
    const s = simulador({
      'GET /repos/a/b/git/ref/heads/main': { corpo: { object: { sha: 'c0' } } },
      'GET /repos/a/b/git/commits/c0': { corpo: { tree: { sha: 't0' } } },
      'POST /repos/a/b/git/blobs': { corpo: { sha: 'blob' } },
      'POST /repos/a/b/git/trees': { corpo: { sha: 't1' } },
      'POST /repos/a/b/git/commits': { corpo: { sha: 'c1' } },
      'PATCH /repos/a/b/git/refs/heads/main': { corpo: {} },
    });
    await new ClienteGitHub('tk', 'a/b', s.f).gravar('main', [{ path: 'public/site.json', texto: 'Pé' }, { path: 'public/imagens/site/x.png', bytes: new Uint8Array([1, 2, 3]) }], 'msg');
    const por = (m: string, p: string) => s.chamadas.filter((c) => c.metodo === m && c.caminho === p);
    expect(por('POST', '/repos/a/b/git/blobs')).toHaveLength(2);
    expect(por('POST', '/repos/a/b/git/blobs')[1].corpo).toEqual({ content: paraBase64(new Uint8Array([1, 2, 3])), encoding: 'base64' });
    expect(por('POST', '/repos/a/b/git/trees')[0].corpo).toMatchObject({ base_tree: 't0' });
    expect(por('POST', '/repos/a/b/git/commits')[0].corpo).toEqual({ message: 'msg', tree: 't1', parents: ['c0'] });
    expect(por('PATCH', '/repos/a/b/git/refs/heads/main')[0].corpo).toEqual({ sha: 'c1', force: false });
  });
  it('recusa caminhos perigosos e avisa conflito', async () => {
    const s = simulador({ 'GET /repos/a/b/git/ref/heads/main': { corpo: { object: { sha: 'c0' } } }, 'GET /repos/a/b/git/commits/c0': { corpo: { tree: { sha: 't0' } } } });
    await expect(new ClienteGitHub('tk', 'a/b', s.f).gravar('main', [{ path: '../x', texto: '' }], 'm')).rejects.toThrow(/inválido/);
    const c = simulador({
      'GET /repos/a/b/git/ref/heads/main': { corpo: { object: { sha: 'c0' } } }, 'GET /repos/a/b/git/commits/c0': { corpo: { tree: { sha: 't0' } } },
      'POST /repos/a/b/git/blobs': { corpo: { sha: 'b' } }, 'POST /repos/a/b/git/trees': { corpo: { sha: 't' } }, 'POST /repos/a/b/git/commits': { corpo: { sha: 'c1' } },
      'PATCH /repos/a/b/git/refs/heads/main': { status: 422 },
    });
    await expect(new ClienteGitHub('tk', 'a/b', c.f).gravar('main', [{ path: 'a.txt', texto: 'x' }], 'm')).rejects.toThrow(/ao mesmo tempo/);
  });
});
