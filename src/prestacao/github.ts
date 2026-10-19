// Cliente mínimo da API do GitHub para a equipe editar o site sem usar o GitHub:
// lê/grava arquivos do repositório com um único commit (tudo ou nada).
export const REPO_PADRAO = 'GuiApolinario/projeto-pe-no-chao';
const API = 'https://api.github.com';

export class ErroGitHub extends Error {
  constructor(msg: string, public status = 0) { super(msg); }
}

export interface ArquivoParaGravar {
  path: string;
  /** texto UTF-8 */
  texto?: string;
  /** conteúdo binário (imagens) */
  bytes?: Uint8Array;
  /** apagar este arquivo */
  excluir?: boolean;
}

type Fetch = typeof fetch;

export function paraBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const textoParaBase64 = (t: string) => paraBase64(new TextEncoder().encode(t));
const base64ParaTexto = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export class ClienteGitHub {
  constructor(private token: string, public repo: string = REPO_PADRAO, private f: Fetch = (...a) => fetch(...a)) {
    if (!/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repo)) throw new ErroGitHub('Repositório inválido.');
  }

  private async chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    let r: Response;
    try {
      r = await this.f(`${API}${caminho}`, {
        method: metodo,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ErroGitHub('Sem conexão com o GitHub. Confira a internet e tente de novo.');
    }
    if (!r.ok) {
      if (r.status === 401) throw new ErroGitHub('A chave de acesso não foi aceita. Ela pode ter sido digitada errada ou ter vencido: crie outra.', 401);
      if (r.status === 403 || r.status === 404) throw new ErroGitHub('Sem permissão para este projeto. Ao criar a chave, escolha só o repositório do projeto e a permissão “Contents: Read and write”.', r.status);
      if (r.status === 409 || r.status === 422) throw new ErroGitHub('Alguém publicou uma mudança ao mesmo tempo. Recarregue a página e refaça a alteração.', r.status);
      throw new ErroGitHub(`O GitHub respondeu com erro ${r.status}. Tente de novo em instantes.`, r.status);
    }
    return (await r.json()) as T;
  }

  /** Confere a chave e devolve o ramo que publica o site. */
  async verificar(): Promise<{ ramo: string }> {
    const info = await this.chamar<{ default_branch: string; permissions?: { push?: boolean } }>('GET', `/repos/${this.repo}`);
    if (!info.permissions?.push) throw new ErroGitHub('Esta chave só consegue ler. Crie outra com a permissão “Contents: Read and write”.', 403);
    return { ramo: info.default_branch };
  }

  async lerTexto(ramo: string, path: string): Promise<string | null> {
    try {
      const r = await this.chamar<{ content: string; encoding: string }>('GET', `/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ramo)}`);
      return base64ParaTexto(r.content);
    } catch (e) {
      if (e instanceof ErroGitHub && e.status === 404) return null;
      throw e;
    }
  }

  /** Um commit só com todos os arquivos. Se alguém mudar o ramo no meio, nada é gravado. */
  async gravar(ramo: string, arquivos: ArquivoParaGravar[], mensagem: string): Promise<void> {
    const repo = `/repos/${this.repo}`;
    const ref = await this.chamar<{ object: { sha: string } }>('GET', `${repo}/git/ref/heads/${ramo}`);
    const commitBase = await this.chamar<{ tree: { sha: string } }>('GET', `${repo}/git/commits/${ref.object.sha}`);
    const itens: { path: string; mode: string; type: string; sha: string | null }[] = [];
    for (const a of arquivos) {
      if (/^\/|\.\.|\\/.test(a.path)) throw new ErroGitHub('Caminho de arquivo inválido.');
      if (a.excluir) { itens.push({ path: a.path, mode: '100644', type: 'blob', sha: null }); continue; }
      const b = await this.chamar<{ sha: string }>('POST', `${repo}/git/blobs`, { content: a.bytes ? paraBase64(a.bytes) : textoParaBase64(a.texto ?? ''), encoding: 'base64' });
      itens.push({ path: a.path, mode: '100644', type: 'blob', sha: b.sha });
    }
    const arvore = await this.chamar<{ sha: string }>('POST', `${repo}/git/trees`, { base_tree: commitBase.tree.sha, tree: itens });
    const commit = await this.chamar<{ sha: string }>('POST', `${repo}/git/commits`, { message: mensagem, tree: arvore.sha, parents: [ref.object.sha] });
    await this.chamar('PATCH', `${repo}/git/refs/heads/${ramo}`, { sha: commit.sha, force: false });
  }
}
