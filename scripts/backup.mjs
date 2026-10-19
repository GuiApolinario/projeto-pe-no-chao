#!/usr/bin/env node
// Backup completo fora do navegador: todas as tabelas (JSON) + arquivos do Storage.
// Uso:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.mjs [pasta-destino]
// A service_role key ignora o RLS: guarde-a apenas no computador/servidor que faz o backup,
// nunca no site nem no repositório.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TABELAS } from './tabelas.mjs';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });
const data = new Date().toISOString().slice(0, 10);
const destino = path.resolve(process.argv[2] || `backups/${data}`);
fs.mkdirSync(path.join(destino, 'arquivos'), { recursive: true });

const dados = {};
for (const t of TABELAS) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data: lote, error } = await sb.from(t).select('*').range(de, de + 999);
    if (error) throw new Error(`${t}: ${error.message}`);
    linhas.push(...lote);
    if (lote.length < 1000) break;
  }
  dados[t] = linhas;
  console.log(`✔ ${t}: ${linhas.length}`);
}
const meta = { gerado_em: new Date().toISOString(), versao: 1, origem: url, tabelas: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v.length])) };
fs.writeFileSync(path.join(destino, 'dados.json'), JSON.stringify({ meta, dados }));

let ok = 0, falhas = 0;
for (const d of dados.documentos) {
  const alvo = path.join(destino, 'arquivos', d.storage_path);
  if (fs.existsSync(alvo)) { ok++; continue; }
  const { data: blob, error } = await sb.storage.from('documentos').download(d.storage_path);
  if (error) { falhas++; console.warn(`! ${d.storage_path}: ${error.message}`); continue; }
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.writeFileSync(alvo, Buffer.from(await blob.arrayBuffer()));
  ok++;
}
console.log(`✔ arquivos: ${ok} baixados, ${falhas} falha(s)`);
console.log(`Backup salvo em ${destino}. Copie para um segundo local (ex.: HD externo e nuvem) e mantenha criptografado.`);
