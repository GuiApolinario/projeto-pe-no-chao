#!/usr/bin/env node
// Mantém o projeto Supabase ativo (projetos gratuitos são pausados após ~7 dias sem uso).
// Lê a URL e a chave PÚBLICA (anon) do site.json e faz 3 consultas ao banco, uma delas gravando
// um "ping" (função pc_ping). Falha com mensagem clara se o banco não responder — o GitHub então
// avisa por e-mail.
//
// Uso: node scripts/manter-banco-ativo.mjs [caminho/do/site.json]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function dica(status) {
  if (status === 404) return 'A tabela ou função não existe: o arquivo supabase/prestacao/01_prestacao_simples.sql já foi executado no Supabase?';
  if (status === 401 || status === 403) return 'Chave recusada: confira supabase_anon_key no site.json (use a chave anon/public, não a secret).';
  if (status === 0 || status >= 500) return 'O banco não respondeu. Se o projeto estiver pausado, abra supabase.com/dashboard e clique em “Restore project”.';
  return '';
}

/**
 * @param {{supabase_url?: string|null, supabase_anon_key?: string|null}} cfg
 * @param {{fetchFn?: typeof fetch, esperaMs?: number, tentativas?: number, permitirHttp?: boolean, log?: (s: string) => void}} [op]
 * @returns {Promise<{ok: boolean, pulado: boolean, mensagem: string, ultimoPing?: string}>}
 */
export async function manterAtivo(cfg, op = {}) {
  const { fetchFn = fetch, esperaMs = 5000, tentativas = 3, permitirHttp = false, log = console.log } = op;
  const url = (cfg?.supabase_url || '').replace(/\/+$/, '');
  const chave = cfg?.supabase_anon_key || '';
  if (!url || !chave) {
    return { ok: true, pulado: true, mensagem: 'Banco ainda não configurado no site.json: nada a fazer.' };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !(permitirHttp && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))) {
    return { ok: false, pulado: false, mensagem: `Endereço do Supabase inesperado: ${url}` };
  }
  const cab = { apikey: chave, 'Content-Type': 'application/json' };
  if (chave.startsWith('eyJ')) cab.Authorization = `Bearer ${chave}`; // chaves novas (sb_publishable_…) só usam "apikey"

  const passos = [
    { nome: 'ping (grava atividade)', metodo: 'POST', caminho: '/rest/v1/rpc/pc_ping', corpo: '{}' },
    { nome: 'registros públicos', metodo: 'GET', caminho: '/rest/v1/pc_publico?select=id&limit=1' },
    { nome: 'configurações do site', metodo: 'GET', caminho: '/rest/v1/pc_site?select=id&limit=1' },
  ];
  let ultimoPing;
  for (const p of passos) {
    let status = 0, texto = '';
    for (let t = 1; t <= tentativas; t++) {
      try {
        const r = await fetchFn(url + p.caminho, { method: p.metodo, headers: cab, body: p.corpo, signal: AbortSignal.timeout(20000) });
        status = r.status; texto = await r.text();
      } catch (e) { status = 0; texto = String(e?.cause?.code ?? e?.message ?? e); }
      if (status >= 200 && status < 300) break;
      if (status >= 400 && status < 500) break; // erro nosso, repetir não adianta
      if (t < tentativas) { log(`  tentativa ${t} falhou (${status || texto}); tentando de novo…`); await espera(esperaMs * t); }
    }
    if (!(status >= 200 && status < 300)) {
      return { ok: false, pulado: false, mensagem: `Falhou em “${p.nome}”: HTTP ${status || 'sem resposta'} ${texto.slice(0, 160)}\n${dica(status)}`.trim() };
    }
    if (p.nome.startsWith('ping')) { try { ultimoPing = JSON.parse(texto); } catch { /* sem importância */ } }
    log(`✔ ${p.nome}: HTTP ${status}`);
  }
  return { ok: true, pulado: false, mensagem: 'Banco ativo.', ultimoPing };
}

// execução pela linha de comando
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arquivo = process.argv[2] || 'public/site.json';
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch (e) { console.error(`::error::Não consegui ler ${arquivo}: ${e.message}`); process.exit(1); }
  const r = await manterAtivo(cfg, { permitirHttp: process.env.MANTER_ATIVO_PERMITIR_HTTP === '1', esperaMs: Number(process.env.MANTER_ATIVO_ESPERA_MS ?? 5000) });
  if (r.pulado) console.log(`::notice::${r.mensagem}`);
  else if (r.ok) console.log(`${r.mensagem}${r.ultimoPing ? ` Último ping registrado no banco: ${r.ultimoPing}.` : ''}`);
  else { console.error(`::error::${r.mensagem.replace(/\n/g, ' ')}`); process.exit(1); }
}
