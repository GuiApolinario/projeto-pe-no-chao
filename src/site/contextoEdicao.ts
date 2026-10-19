// Contexto do "modo edição": a equipe edita o site vendo a própria página.
import { createContext, useContext } from 'react';

export interface Edicao {
  /** true quando a pessoa está logada e com o modo edição ligado */
  ativo: boolean;
  setTexto: (chave: string, valor: string) => void;
  /** chave muda a cada edição para recriar o campo editável */
  versao: (chave: string) => number;
  escolherImagem: (chave: 'logo' | 'hero' | 'qr_pix', arquivo: File | undefined) => Promise<void>;
  abrirDados: () => void;
  abrirContas: () => void;
  /** aplica o que está sendo editado (ainda não salvo) sobre a configuração publicada */
  aplicar: <T extends object>(c: T) => T;
}

export const EdicaoCtx = createContext<Edicao | null>(null);
export const useEdicao = () => useContext(EdicaoCtx);
export const editando = () => !!useContext(EdicaoCtx)?.ativo;
