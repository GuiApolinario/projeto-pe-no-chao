import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeISO } from '../lib/formato';
import { urlFotoPublica, type ConfigPrestacao } from './config';
import { BUCKET_PRIVADO, BUCKET_PUBLICO, type Anexo } from './tipos';

const bucketDe = (publico: boolean) => (publico ? BUCKET_PUBLICO : BUCKET_PRIVADO);
const extensao = (f: { type: string; name: string }) => (f.type === 'application/pdf' ? 'pdf' : f.type === 'image/png' ? 'png' : 'jpg');

export async function enviarAnexo(sb: SupabaseClient, file: File, publico: boolean): Promise<Anexo> {
  const h = hojeISO();
  const path = `${h.slice(0, 4)}/${h.slice(5, 7)}/${crypto.randomUUID()}.${extensao(file)}`;
  const { error } = await sb.storage.from(bucketDe(publico)).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return { path, nome: file.name, tipo: file.type, publico };
}

export async function apagarAnexos(sb: SupabaseClient, anexos: Anexo[]): Promise<void> {
  for (const publico of [true, false]) {
    const caminhos = anexos.filter((a) => !!a.publico === publico).map((a) => a.path);
    if (caminhos.length) await sb.storage.from(bucketDe(publico)).remove(caminhos); // melhor esforço: arquivo órfão não afeta os dados
  }
}

export async function baixarAnexo(sb: SupabaseClient, a: Anexo): Promise<File> {
  const { data, error } = await sb.storage.from(bucketDe(!!a.publico)).download(a.path);
  if (error || !data) throw error ?? new Error('Arquivo não encontrado.');
  return new File([data], a.nome ?? 'comprovante', { type: a.tipo ?? data.type });
}

/** Troca um comprovante de depósito (público ⇄ privado): copia para o novo e apaga o antigo. */
export async function mudarVisibilidade(sb: SupabaseClient, a: Anexo, publico: boolean): Promise<Anexo> {
  const arquivo = await baixarAnexo(sb, a);
  const novo = await enviarAnexo(sb, arquivo, publico);
  await apagarAnexos(sb, [a]);
  return { ...novo, nome: a.nome, tipo: a.tipo };
}

/** Endereço para a equipe ver um comprovante (público direto; privado com link temporário). */
export async function urlParaEquipe(sb: SupabaseClient, c: ConfigPrestacao, a: Anexo): Promise<string> {
  if (a.publico) return urlFotoPublica(c, a);
  const { data, error } = await sb.storage.from(BUCKET_PRIVADO).createSignedUrl(a.path, 3600);
  if (error || !data) throw error ?? new Error('Sem acesso ao arquivo.');
  return data.signedUrl;
}
