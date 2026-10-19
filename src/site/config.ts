import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { obterCliente, temBackend, type ConfigPrestacao } from '../prestacao/config';
import { mesclarConfig } from '../prestacao/siteConfig';
import { useEdicao } from './contextoEdicao';

export interface ConfigSite extends ConfigPrestacao {
  necessidades?: { titulo: string; descricao?: string; prioridade?: string }[];
  pix_chave?: string | null; pix_tipo?: string | null; pix_nome?: string | null; pix_cidade?: string | null; banco_texto?: string | null;
  whatsapp?: string | null; instagram?: string | null; email?: string | null; endereco?: string | null; texto_sobre?: string | null;
  textos?: Record<string, string> | null; imagens?: Record<string, string> | null; github_repo?: string | null;
  mostrar_transparencia?: boolean; campanha_titulo?: string | null; campanha_meta?: string | null; campanha_arrecadado?: string | null;
}

let cacheConfig: Promise<ConfigSite> | null = null;

/** Base: site.json (publicado com o site). Por cima: o que a equipe salvou no painel (tabela pc_site). */
async function carregarConfig(): Promise<ConfigSite> {
  if (supabaseConfigurado) {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'site').maybeSingle();
    return (data?.valor as ConfigSite) ?? {};
  }
  const estatica: ConfigSite = await fetch('/site.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({}));
  if (!temBackend(estatica)) return estatica;
  try {
    const { data, error } = await obterCliente(estatica).from('pc_site').select('valor').eq('id', 1).maybeSingle();
    if (error) throw error;
    return mesclarConfig(estatica, data?.valor);
  } catch {
    return estatica; // banco fora do ar: o site continua com o que está no site.json
  }
}

/** Depois que a equipe salva, o painel pede para reler. */
export function recarregarConfigSite() { cacheConfig = null; }

export function useConfigSite() {
  const [c, setC] = useState<ConfigSite | null>(null);
  const ed = useEdicao();
  useEffect(() => {
    cacheConfig ??= carregarConfig();
    cacheConfig.then(setC);
  }, []);
  // no modo edição, mostra o que está sendo editado (ainda não salvo) em tempo real
  return useMemo(() => (c && ed?.ativo ? ed.aplicar(c) : c), [c, ed]);
}

