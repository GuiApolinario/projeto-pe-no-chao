import { describe, expect, it } from 'vitest';
import { blocosDeTexto, CAMPOS_CONTEUDO, GRUPOS, imagemDe, PADROES, partesDestaque, sobrescritas, textosParaFormulario, tx } from './conteudo';

describe('conteúdo editável', () => {
  it('chaves únicas, todas em um grupo existente, e todo texto tem padrão', () => {
    const chaves = CAMPOS_CONTEUDO.map((c) => c.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    const grupos = new Set(GRUPOS.map((g) => g.id));
    expect(CAMPOS_CONTEUDO.every((c) => grupos.has(c.grupo) && /^[a-z0-9_.]{1,60}$/.test(c.chave) && c.padrao.length > 0 && c.padrao.length <= 4000)).toBe(true);
  });
  it('tx usa o padrão, o texto salvo ou fica em branco', () => {
    expect(tx(undefined, 'nav.doar')).toBe('Doe agora');
    expect(tx(null, 'nav.doar')).toBe('Doe agora');
    expect(tx({ 'nav.doar': 'Ajude' }, 'nav.doar')).toBe('Ajude');
    expect(tx({ 'nav.doar': '' }, 'nav.doar')).toBe('');
    expect(tx({}, 'chave.inexistente')).toBe('');
  });
  it('só guarda o que mudou, ignora chaves desconhecidas e normaliza quebras de linha', () => {
    const f = textosParaFormulario({});
    expect(f).toEqual(PADROES);
    expect(sobrescritas(f)).toEqual({});
    expect(sobrescritas({ ...f, 'nav.doar': 'Ajude', 'home.sobre_texto': '', inventada: 'x' })).toEqual({ 'nav.doar': 'Ajude', 'home.sobre_texto': '' });
    expect(sobrescritas({ 'privacidade.texto': PADROES['privacidade.texto'].replace(/\n/g, '\r\n') })).toEqual({});
  });
  it('formulário parte do padrão e aplica o que foi salvo', () => {
    const f = textosParaFormulario({ 'nav.doar': 'Ajude', inventada: 'x' });
    expect(f['nav.doar']).toBe('Ajude');
    expect(f['nav.inicio']).toBe('Início');
    expect(f.inventada).toBeUndefined();
  });
  it('destaque com *asteriscos*', () => {
    expect(partesDestaque(PADROES['home.titulo'])).toEqual([
      { texto: 'Infância com ', destaque: false }, { texto: 'pé no chão', destaque: true }, { texto: ', ', destaque: false },
      { texto: 'sol', destaque: true }, { texto: ' e ', destaque: false }, { texto: 'alegria', destaque: true }, { texto: '.', destaque: false },
    ]);
    expect(partesDestaque('sem destaque')).toEqual([{ texto: 'sem destaque', destaque: false }]);
    expect(partesDestaque('um * solto')).toEqual([{ texto: 'um * solto', destaque: false }]);
    expect(partesDestaque('')).toEqual([]);
  });
  it('texto longo vira parágrafos e subtítulos', () => {
    const b = blocosDeTexto('Intro.\n\n## Título\n\nCorpo um.\n\n\n\nCorpo dois.');
    expect(b).toEqual([{ tipo: 'p', texto: 'Intro.' }, { tipo: 'h', texto: 'Título' }, { tipo: 'p', texto: 'Corpo um.' }, { tipo: 'p', texto: 'Corpo dois.' }]);
    expect(blocosDeTexto(PADROES['privacidade.texto']).filter((x) => x.tipo === 'h')).toHaveLength(4);
    expect(blocosDeTexto('   ')).toEqual([]);
  });
  it('imagens: padrão quando vazio', () => {
    expect(imagemDe(undefined, 'logo')).toBe('/logo-640.jpg');
    expect(imagemDe({ logo: '/imagens/x.png' }, 'logo')).toBe('/imagens/x.png');
    expect(imagemDe({ logo: '' }, 'hero')).toBe('/logo.jpg');
    expect(imagemDe({}, 'qr_pix')).toBe('');
  });
});
