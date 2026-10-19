import { describe, expect, it } from 'vitest';
import { formVazio, mesclarConfig, paraBanco, paraFormulario, validarSite } from './siteConfig';

const ok = () => ({ ...formVazio(), pix_tipo: 'CNPJ', pix_chave: '11.222.333/0001-81', pix_nome: 'Projeto Pe no Chao' });

describe('validação do site', () => {
  it('formulário vazio é válido (nada é obrigatório)', () => expect(validarSite(formVazio())).toEqual([]));
  it('chave PIX completa é válida', () => expect(validarSite(ok())).toEqual([]));
  it('confere os dígitos de CNPJ e CPF da chave PIX', () => {
    expect(validarSite({ ...ok(), pix_chave: '11.222.333/0001-80' })[0]).toMatch(/CNPJ/);
    expect(validarSite({ ...ok(), pix_tipo: 'CPF', pix_chave: '529.982.247-25' })).toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'CPF', pix_chave: '111.111.111-11' })[0]).toMatch(/CPF/);
  });
  it('exige tipo e nome quando há chave', () => {
    const e = validarSite({ ...formVazio(), pix_chave: 'a@b.co' });
    expect(e.join(' ')).toMatch(/tipo/);
    expect(e.join(' ')).toMatch(/nome do recebedor/);
  });
  it('outros tipos de chave', () => {
    expect(validarSite({ ...ok(), pix_tipo: 'E-mail', pix_chave: 'contato@exemplo.org' })).toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'E-mail', pix_chave: 'contato' })).not.toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'Telefone', pix_chave: '(15) 99999-1234' })).toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'Telefone', pix_chave: '999' })).not.toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'Chave aleatória', pix_chave: '123e4567-e89b-12d3-a456-426614174000' })).toEqual([]);
    expect(validarSite({ ...ok(), pix_tipo: 'Chave aleatória', pix_chave: 'xyz' })).not.toEqual([]);
  });
  it('contatos', () => {
    expect(validarSite({ ...formVazio(), whatsapp: '(15) 99999-1234', instagram: '@projetopenochao', email: 'a@b.org' })).toEqual([]);
    expect(validarSite({ ...formVazio(), whatsapp: '123' })).not.toEqual([]);
    expect(validarSite({ ...formVazio(), instagram: 'https://instagram.com/x' })).not.toEqual([]);
    expect(validarSite({ ...formVazio(), email: 'semarroba' })).not.toEqual([]);
  });
  it('campanha precisa de meta; valores numéricos', () => {
    expect(validarSite({ ...formVazio(), campanha_titulo: 'Natal' })[0]).toMatch(/meta/);
    expect(validarSite({ ...formVazio(), campanha_titulo: 'Natal', campanha_meta: '5.000,00', campanha_arrecadado: '1.800,50' })).toEqual([]);
    expect(validarSite({ ...formVazio(), campanha_meta: 'abc' })).not.toEqual([]);
  });
  it('itens da lista de necessidades', () => {
    const f = formVazio();
    f.necessidades = [{ titulo: '', descricao: '', prioridade: 'media' }, { titulo: 'x', descricao: '', prioridade: 'alta' }];
    expect(validarSite(f)).toHaveLength(1); // a linha em branco é ignorada; "x" é curto demais
  });
});

describe('conversões', () => {
  it('vazio vira null, instagram perde o @, meta vira número com 2 casas', () => {
    const f = { ...formVazio(), instagram: '@proj', campanha_meta: '5.000,5', email: '  ', pix_cidade: 'Votorantim ' };
    f.necessidades = [{ titulo: ' Leite ', descricao: '', prioridade: 'alta' }, { titulo: '', descricao: 'x', prioridade: 'media' }];
    const b = paraBanco(f);
    expect(b.instagram).toBe('proj');
    expect(b.campanha_meta).toBe('5000.50');
    expect(b.campanha_arrecadado).toBeNull();
    expect(b.email).toBeNull();
    expect(b.pix_cidade).toBe('Votorantim');
    expect(b.necessidades).toEqual([{ titulo: 'Leite', descricao: null, prioridade: 'alta' }]);
  });
  it('ida e volta preserva os dados', () => {
    const f = { ...ok(), campanha_titulo: 'Natal', campanha_meta: '5000.00', campanha_arrecadado: '1800.50' };
    f.necessidades = [{ titulo: 'Bolas', descricao: 'Para o treino', prioridade: 'media' }];
    expect(paraFormulario(paraBanco(f))).toEqual(f);
  });
  it('lê valores numéricos e nulos vindos do banco', () => {
    const f = paraFormulario({ campanha_meta: 5000, campanha_arrecadado: null, pix_chave: null, necessidades: [{ titulo: 'A', prioridade: 'estranha' }] });
    expect(f.campanha_meta).toBe('5000.00');
    expect(f.campanha_arrecadado).toBe('');
    expect(f.pix_chave).toBe('');
    expect(f.necessidades[0].prioridade).toBe('media');
  });
});

describe('mesclar site.json com o que a equipe salvou', () => {
  const estatica = { pix_chave: 'antiga', whatsapp: null as string | null, supabase_url: 'https://x.supabase.co', supabase_anon_key: 'k', prestacao_demo: true, necessidades: [{ titulo: 'Velha' }] };
  it('o salvo vence, inclusive para limpar um campo', () => {
    const r = mesclarConfig(estatica, { pix_chave: 'nova', whatsapp: '15999991234' });
    expect(r.pix_chave).toBe('nova');
    expect(r.whatsapp).toBe('15999991234');
    expect(mesclarConfig(estatica, { pix_chave: null }).pix_chave).toBeNull();
  });
  it('nunca altera a ligação com o banco, nem campos desconhecidos', () => {
    const r = mesclarConfig(estatica, { supabase_url: 'https://invasor.com', supabase_anon_key: 'z', prestacao_demo: false, qualquer: 1 }) as Record<string, unknown>;
    expect(r.supabase_url).toBe('https://x.supabase.co');
    expect(r.supabase_anon_key).toBe('k');
    expect(r.prestacao_demo).toBe(true);
    expect(r.qualquer).toBeUndefined();
  });
  it('banco vazio mantém o site.json; lista inválida é ignorada', () => {
    expect(mesclarConfig(estatica, {})).toEqual(estatica);
    expect(mesclarConfig(estatica, null)).toBe(estatica);
    expect(mesclarConfig(estatica, { necessidades: 'oi' }).necessidades).toEqual([{ titulo: 'Velha' }]);
    expect(mesclarConfig(estatica, { necessidades: [] }).necessidades).toEqual([]);
  });
});
