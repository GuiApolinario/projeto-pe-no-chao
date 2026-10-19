import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BUCKET_PUBLICO, type Anexo } from './tipos';

export interface ConfigPrestacao {
  supabase_url?: string | null;
  supabase_anon_key?: string | null;
  /** mostra a página com dados de EXEMPLO (para pré-visualizar o visual) */
  prestacao_demo?: boolean;
  /** mostra a aba com os registros lançados pela equipe no arquivo do site (sem banco) */
  prestacao_ativa?: boolean;
}

export const temBackend = (c?: ConfigPrestacao | null) => !!(c?.supabase_url && c?.supabase_anon_key);
export const temPrestacao = (c?: ConfigPrestacao | null) => temBackend(c) || !!c?.prestacao_demo || !!c?.prestacao_ativa;
export const modoArquivo = (c?: ConfigPrestacao | null) => !temBackend(c) && !c?.prestacao_demo && !!c?.prestacao_ativa;
export const modoDemo = (c?: ConfigPrestacao | null) => !temBackend(c) && !!c?.prestacao_demo;

// A chave "anon" é pública por definição: quem protege os dados são as regras (RLS) do banco.
let cliente: { url: string; sb: SupabaseClient } | null = null;
export function obterCliente(c: ConfigPrestacao): SupabaseClient {
  if (!temBackend(c)) throw new Error('Prestação de contas ainda não configurada.');
  if (!cliente || cliente.url !== c.supabase_url) {
    cliente = {
      url: c.supabase_url!,
      sb: createClient(c.supabase_url!, c.supabase_anon_key!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pnc-prestacao-auth' } }),
    };
  }
  return cliente.sb;
}

function svgExemplo(nome: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420"><rect width="320" height="420" fill="#fffdf6"/><rect x="14" y="14" width="292" height="392" fill="none" stroke="#e5dcc3" stroke-width="2" stroke-dasharray="6 6"/><text x="160" y="70" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#555">COMPROVANTE</text><text x="160" y="98" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">(exemplo)</text>${[150, 180, 210, 240, 270].map((y, i) => `<rect x="40" y="${y}" width="${i % 2 ? 160 : 220}" height="8" rx="4" fill="#ddd"/>`).join('')}<rect x="40" y="320" width="240" height="2" fill="#bbb"/><text x="160" y="360" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#999">${nome}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Endereço de uma foto no depósito PÚBLICO (só existe para fotos marcadas para aparecer no site). */
export function urlFotoPublica(c: ConfigPrestacao, a: Anexo): string {
  if (a.path.startsWith('demo:')) return svgExemplo(a.nome ?? 'exemplo');
  if (a.path.startsWith('comprovantes/')) return `/${a.path}`;
  return `${c.supabase_url}/storage/v1/object/public/${BUCKET_PUBLICO}/${a.path.split('/').map(encodeURIComponent).join('/')}`;
}

export const ehPdf = (a: Anexo) => a.tipo === 'application/pdf' || a.path.toLowerCase().endsWith('.pdf');
