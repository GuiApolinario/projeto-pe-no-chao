// Chave de acesso do GitHub guardada só neste aparelho.
const CHAVE = 'pnc-github-token';
const MODO = 'pnc-editando';
export const lerToken = () => { try { return localStorage.getItem(CHAVE) ?? sessionStorage.getItem(CHAVE) ?? ''; } catch { return ''; } };
export const guardarToken = (t: string, lembrar: boolean) => { try { sessionStorage.setItem(CHAVE, t); if (lembrar) localStorage.setItem(CHAVE, t); } catch { /* sem armazenamento */ } };
export const esquecerToken = () => { try { localStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE); sessionStorage.removeItem(MODO); } catch { /* sem armazenamento */ } };
export const modoEdicaoLigado = () => { try { return sessionStorage.getItem(MODO) === '1'; } catch { return false; } };
export const ligarModoEdicao = (v: boolean) => { try { if (v) sessionStorage.setItem(MODO, '1'); else sessionStorage.removeItem(MODO); } catch { /* sem armazenamento */ } };
