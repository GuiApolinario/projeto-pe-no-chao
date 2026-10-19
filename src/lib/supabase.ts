import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

// A chave "anon" é pública por definição: a segurança dos dados vem das
// políticas RLS do banco. Nunca use a service_role key no frontend.
export const supabase = createClient(url || 'http://localhost:54321', chave || 'chave-nao-configurada', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const BUCKET = 'documentos';

/** Traduz mensagens de erro técnicas para o usuário. */
export function mensagemErro(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e);
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para esta operação.';
  if (/duplicate key.*despesas_doc_fiscal_unico/i.test(msg)) return 'Já existe uma despesa com este número de documento fiscal para o mesmo fornecedor.';
  if (/duplicate key/i.test(msg)) return 'Já existe um registro com estes dados.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  if (/receita_recebida_completa/.test(msg)) return 'Receita recebida exige data de recebimento, valor e conta de destino.';
  if (/receita_prevista_completa/.test(msg)) return 'Receita prevista exige data prevista e valor previsto.';
  if (/cancelamento_justificado|estorno_justificado/.test(msg)) return 'Informe uma justificativa com pelo menos 10 caracteres.';
  if (/despesa_categoria_obrigatoria/.test(msg)) return 'Informe a categoria da despesa.';
  if (/despesa_data_referencia/.test(msg)) return 'Informe ao menos uma data (compra, emissão ou vencimento).';
  if (/linha_ignorada_justificada/.test(msg)) return 'Explique por que a linha do extrato não tem lançamento correspondente.';
  if (/dispensa_justificada/.test(msg)) return 'Justifique a dispensa do item do checklist.';
  return msg;
}

/** Busca todas as linhas de uma consulta paginando de 1000 em 1000. */
export async function buscarTodos<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, limite = 20000): Promise<T[]> {
  const res: T[] = [];
  for (let de = 0; de < limite; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw error;
    res.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return res;
}
