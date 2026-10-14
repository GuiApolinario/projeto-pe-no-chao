#!/usr/bin/env node
// Importa receitas ou despesas de planilhas antigas (CSV separado por ";", modelos em docs/modelos/).
// Categorias, fontes e contas são localizadas pelo NOME (já devem estar cadastradas).
// Fornecedores inexistentes são criados. Despesas com data/valor de pagamento recebem o pagamento.
// Todas as regras do banco continuam valendo (períodos, contas exclusivas, duplicidade de NF…).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar.mjs receitas arquivo.csv          (simulação)
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar.mjs despesas arquivo.csv --gravar
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [tipo, arquivo, flag] = process.argv.slice(2);
const gravar = flag === '--gravar';
if (!['receitas', 'despesas'].includes(tipo) || !arquivo) {
  console.error('Uso: node scripts/importar.mjs receitas|despesas arquivo.csv [--gravar]'); process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const dinheiro = (t) => {
  if (!t || !t.trim()) return null;
  let s = t.trim().replace(/R\$\s?/, '');
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(s); if (!Number.isFinite(n)) throw new Error(`valor inválido "${t}"`);
  return n.toFixed(2);
};
const data = (t) => {
  if (!t || !t.trim()) return null;
  const m = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.trim())) return t.trim();
  throw new Error(`data inválida "${t}" (use dd/mm/aaaa)`);
};
const linhas = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
const cab = linhas[0].split(';').map((c) => c.trim().toLowerCase());
const registros = linhas.slice(1).map((l) => Object.fromEntries(l.split(';').map((v, i) => [cab[i], v.trim()])));

async function mapa(tabela, filtro = {}) {
  let q = sb.from(tabela).select('id, nome');
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  const { data: d, error } = await q; if (error) throw error;
  return new Map(d.map((x) => [x.nome.toLowerCase(), x.id]));
}
const cats = await mapa('categorias', { tipo: tipo === 'receitas' ? 'receita' : 'despesa' });
const fontes = await mapa('fontes_recurso');
const contas = await mapa('contas_bancarias');
const achar = (m, nome, rotulo, obrig = true) => {
  if (!nome) { if (obrig) throw new Error(`${rotulo} não informado(a)`); return null; }
  const id = m.get(nome.toLowerCase()); if (!id) throw new Error(`${rotulo} "${nome}" não cadastrado(a)`); return id;
};

let ok = 0; const erros = [];
for (const [i, r] of registros.entries()) {
  const n = i + 2;
  try {
    if (tipo === 'receitas') {
      const recebida = (r.situacao || 'recebida').toLowerCase() === 'recebida';
      const reg = {
        status: recebida ? 'recebida' : 'prevista', descricao: r.descricao, categoria_id: achar(cats, r.categoria, 'Categoria'),
        fonte_id: achar(fontes, r.fonte, 'Fonte'), origem: r.origem || null, doador_nome: r.doador || null, referencia_bancaria: r.referencia || null,
        observacoes: [r.observacoes, 'Importado de planilha'].filter(Boolean).join(' — '),
        ...(recebida ? { data_recebimento: data(r.data), valor_recebido: dinheiro(r.valor), conta_id: achar(contas, r.conta, 'Conta'), forma_recebimento: r.forma || null }
          : { data_prevista: data(r.data), valor_previsto: dinheiro(r.valor) }),
      };
      if (gravar) { const { error } = await sb.from('receitas').insert(reg); if (error) throw error; }
    } else {
      let fornecedor_id = null;
      if (r.fornecedor) {
        const { data: f } = await sb.from('fornecedores').select('id').ilike('nome', r.fornecedor).maybeSingle();
        fornecedor_id = f?.id ?? null;
        if (!fornecedor_id && gravar) {
          const { data: novo, error } = await sb.from('fornecedores').insert({ nome: r.fornecedor, cpf_cnpj: r.cpf_cnpj || null }).select('id').single();
          if (error) throw error; fornecedor_id = novo.id;
        }
      }
      const pago = dinheiro(r.valor_pago);
      const reg = {
        status: 'lancada', data_compra: data(r.data_compra), descricao: r.descricao, categoria_id: achar(cats, r.categoria, 'Categoria'),
        fonte_id: achar(fontes, r.fonte, 'Fonte'), fornecedor_id, valor_total: dinheiro(r.valor_total), numero_documento_fiscal: r.numero_nf || null,
        justificativa: r.justificativa || null, forma_pagamento: r.forma || null, conta_id: achar(contas, r.conta, 'Conta', !!pago),
        observacoes: 'Importado de planilha',
      };
      if (pago && !r.data_pagamento) throw new Error('valor pago sem data de pagamento');
      if (gravar) {
        const { data: d, error } = await sb.from('despesas').insert(reg).select('id').single(); if (error) throw error;
        if (pago) {
          const { error: e2 } = await sb.from('pagamentos').insert({ despesa_id: d.id, data_pagamento: data(r.data_pagamento), valor: pago, forma_pagamento: r.forma || 'Transferência', conta_id: reg.conta_id });
          if (e2) throw new Error(`despesa criada, mas pagamento recusado: ${e2.message}`);
        }
      }
    }
    ok++;
  } catch (e) { erros.push(`Linha ${n}: ${e.message}`); }
}
console.log(`${gravar ? 'Importados' : 'Válidos (simulação)'}: ${ok} de ${registros.length}`);
if (erros.length) console.log('Problemas:\n' + erros.join('\n'));
if (!gravar) console.log('Nada foi gravado. Corrija os problemas e rode novamente com --gravar.');
process.exit(erros.length ? 2 : 0);
