#!/usr/bin/env node
// Converte um backup (dados.json ou o .json/.zip exportado pela tela de Backup) em um
// script SQL de restauração, a ser executado em um projeto Supabase NOVO, já com as migrações aplicadas.
// Uso: node scripts/restaurar.mjs caminho/dados.json > restauracao.sql
//      psql "$CONEXAO_DO_SUPABASE" -v ON_ERROR_STOP=1 -f restauracao.sql
import fs from 'node:fs';
import { TABELAS, SEQUENCIAS } from './tabelas.mjs';

const arq = process.argv[2];
if (!arq) { console.error('Uso: node scripts/restaurar.mjs backup.json > restauracao.sql'); process.exit(1); }
let bruto;
if (arq.endsWith('.zip')) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(fs.readFileSync(arq));
  bruto = await zip.file('dados.json').async('string');
} else bruto = fs.readFileSync(arq, 'utf8');
const { meta, dados } = JSON.parse(bruto);

// literal SQL seguro com "dollar quoting" de marcador aleatório
const marca = '$r' + Math.random().toString(36).slice(2, 8) + '$';
const lit = (s) => { if (s.includes(marca)) throw new Error('marcador colidiu; rode novamente'); return marca + s + marca; };

const saida = [];
saida.push(`-- Restauração do backup gerado em ${meta?.gerado_em ?? '?'} (origem: ${meta?.origem ?? '?'})`);
saida.push('begin;');
saida.push("-- desliga gatilhos e verificações de chave estrangeira: os dados entram exatamente como foram salvos");
saida.push('set local session_replication_role = replica;');
for (const t of [...TABELAS].reverse()) saida.push(`delete from public.${t};`);
for (const t of TABELAS) {
  const linhas = dados[t] ?? [];
  if (!linhas.length) continue;
  for (let i = 0; i < linhas.length; i += 500) {
    saida.push(`insert into public.${t} select * from json_populate_recordset(null::public.${t}, ${lit(JSON.stringify(linhas.slice(i, i + 500)))}::json);`);
  }
}
for (const [seq, [t, prefixo]] of Object.entries(SEQUENCIAS)) {
  saida.push(`select setval('public.${seq}', greatest(1, coalesce((select max(substring(codigo from ${prefixo.length + 1})::bigint) from public.${t}), 0)), (select count(*) > 0 from public.${t}));`);
}
saida.push(`select setval('public.auditoria_id_seq', greatest(1, coalesce((select max(id) from public.auditoria), 0)), (select count(*) > 0 from public.auditoria));`);
saida.push(`select setval('public.periodo_eventos_id_seq', greatest(1, coalesce((select max(id) from public.periodo_eventos), 0)), (select count(*) > 0 from public.periodo_eventos));`);
saida.push('commit;');
saida.push('-- Após restaurar: recrie os usuários (Authentication → Users) e, se os IDs mudarem, atualize public.perfis conforme docs/BACKUP.md.');
process.stdout.write(saida.join('\n') + '\n');
console.error(`SQL gerado: ${Object.values(dados).reduce((a, v) => a + v.length, 0)} registros em ${Object.keys(dados).length} tabelas.`);
