// Configurações do site editadas pela equipe (PIX, contatos, textos, campanha, necessidades).
import { cpfCnpjValido, lerDinheiro } from '../lib/formato';

export const TIPOS_PIX = ['CNPJ', 'CPF', 'E-mail', 'Telefone', 'Chave aleatória'] as const;
export type Prioridade = 'alta' | 'media' | 'baixa';
export interface Necessidade { titulo: string; descricao: string; prioridade: Prioridade }

const CAMPOS_TEXTO = ['pix_chave', 'pix_tipo', 'pix_nome', 'pix_cidade', 'banco_texto', 'whatsapp', 'instagram', 'email', 'endereco', 'texto_sobre', 'campanha_titulo'] as const;
const CAMPOS_VALOR = ['campanha_meta', 'campanha_arrecadado'] as const;
const CHAVES_PERMITIDAS: string[] = [...CAMPOS_TEXTO, ...CAMPOS_VALOR, 'necessidades'];

export type FormSite = Record<(typeof CAMPOS_TEXTO)[number] | (typeof CAMPOS_VALOR)[number], string> & { necessidades: Necessidade[] };

export function formVazio(): FormSite {
  const f = { necessidades: [] } as unknown as FormSite;
  for (const c of [...CAMPOS_TEXTO, ...CAMPOS_VALOR]) f[c] = '';
  f.pix_cidade = 'VOTORANTIM';
  return f;
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Dados guardados (ou do site.json) → campos do formulário. */
export function paraFormulario(v: Record<string, unknown> | null | undefined): FormSite {
  const f = formVazio();
  if (!v) return f;
  for (const c of CAMPOS_TEXTO) if (v[c] !== undefined) f[c] = texto(v[c]);
  for (const c of CAMPOS_VALOR) f[c] = v[c] === null || v[c] === undefined || v[c] === '' ? '' : Number(v[c]).toFixed(2);
  if (Array.isArray(v.necessidades)) {
    f.necessidades = (v.necessidades as Record<string, unknown>[]).map((n) => ({
      titulo: texto(n.titulo), descricao: texto(n.descricao), prioridade: (['alta', 'media', 'baixa'].includes(texto(n.prioridade)) ? n.prioridade : 'media') as Prioridade,
    }));
  }
  return f;
}

/** Campos do formulário → o que vai para o banco (vazio vira null). */
export function paraBanco(f: FormSite): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const c of CAMPOS_TEXTO) {
    let t = f[c].trim();
    if (c === 'instagram') t = t.replace(/^@/, '');
    r[c] = t === '' ? null : t;
  }
  for (const c of CAMPOS_VALOR) r[c] = lerDinheiro(f[c]);
  r.necessidades = f.necessidades
    .filter((n) => n.titulo.trim() !== '')
    .map((n) => ({ titulo: n.titulo.trim(), descricao: n.descricao.trim() || null, prioridade: n.prioridade }));
  return r;
}

const reEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const digitos = (s: string) => s.replace(/\D/g, '');

/** Lista de problemas em linguagem simples (vazia = pode salvar). */
export function validarSite(f: FormSite): string[] {
  const e: string[] = [];
  const chave = f.pix_chave.trim();
  if (chave) {
    if (!f.pix_tipo) e.push('Escolha o tipo da chave PIX.');
    if (!f.pix_nome.trim()) e.push('Informe o nome do recebedor do PIX (como aparece no banco).');
    else if (f.pix_nome.trim().length > 60) e.push('O nome do recebedor está muito longo.');
    if (f.pix_tipo === 'CNPJ' && !(digitos(chave).length === 14 && cpfCnpjValido(chave))) e.push('O CNPJ da chave PIX não é válido. Confira os números.');
    if (f.pix_tipo === 'CPF' && !(digitos(chave).length === 11 && cpfCnpjValido(chave))) e.push('O CPF da chave PIX não é válido. Confira os números.');
    if (f.pix_tipo === 'E-mail' && !reEmail.test(chave)) e.push('O e-mail da chave PIX não parece válido.');
    if (f.pix_tipo === 'Telefone' && !/^\d{10,13}$/.test(digitos(chave))) e.push('O telefone da chave PIX deve ter DDD e número.');
    if (f.pix_tipo === 'Chave aleatória' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) e.push('A chave aleatória deve ter o formato 00000000-0000-0000-0000-000000000000.');
  }
  if (f.whatsapp.trim() && !/^\d{10,13}$/.test(digitos(f.whatsapp))) e.push('O WhatsApp deve ter DDD e número (ex.: 15 99999-1234).');
  if (f.whatsapp.trim() && !/^[0-9+() -]{8,20}$/.test(f.whatsapp.trim())) e.push('Use só números, espaços e hífen no WhatsApp.');
  if (f.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(f.instagram.trim())) e.push('O Instagram deve ser só o nome de usuário (ex.: projetopenochao).');
  if (f.email.trim() && !reEmail.test(f.email.trim())) e.push('O e-mail de contato não parece válido.');
  if (f.texto_sobre.length > 4000) e.push('O texto “Quem somos” passou de 4.000 caracteres.');
  for (const c of CAMPOS_VALOR) {
    if (f[c].trim() && lerDinheiro(f[c]) === null) e.push(`Valor inválido em “${c === 'campanha_meta' ? 'meta' : 'arrecadado'}” da campanha.`);
  }
  if (f.campanha_titulo.trim() && !(Number(lerDinheiro(f.campanha_meta)) > 0)) e.push('Para mostrar a campanha, informe também a meta (ou apague o título).');
  if (f.necessidades.length > 30) e.push('A lista aceita até 30 itens.');
  f.necessidades.forEach((n, i) => { if ((n.titulo.trim() || n.descricao.trim()) && n.titulo.trim().length < 2) e.push(`O item ${i + 1} da lista precisa de um nome.`); });
  return e;
}

/** Junta o site.json (base) com o que a equipe salvou. Só campos conhecidos; a equipe nunca altera a ligação com o banco. */
export function mesclarConfig<T extends object>(estatica: T, salvo: Record<string, unknown> | null | undefined): T {
  if (!salvo || typeof salvo !== 'object') return estatica;
  const r: Record<string, unknown> = { ...(estatica as Record<string, unknown>) };
  for (const k of CHAVES_PERMITIDAS) {
    if (salvo[k] === undefined) continue;
    if (k === 'necessidades' && !Array.isArray(salvo[k])) continue;
    r[k] = salvo[k];
  }
  return r as T;
}
