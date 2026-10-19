import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CheckCircle2, TriangleAlert, UserMinus, UserPlus } from 'lucide-react';
import { dataHora, num } from '../lib/formato';
import { Aviso, Rotulo, Texto, useAviso, useConfirmacao } from '../components/ui';
import { Cartao } from './componentes';

interface Saude { agora: string; lancamentos: number; publicados: number; sem_comprovante: number; ultima_alteracao: string | null; ultimo_ping: string | null; total_pings: number; administradores: number }
interface Admin { user_id: string; email: string | null; criado_em: string }

const DIA = 86400000;

export function AdminEquipe({ sb, meuId }: { sb: SupabaseClient; meuId: string }) {
  const avisar = useAviso();
  const { confirmar, elemento } = useConfirmacao();
  const [saude, setSaude] = useState<Saude | null>(null);
  const [erroSaude, setErroSaude] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [s, a] = await Promise.all([sb.rpc('pc_saude'), sb.from('pc_admins').select('*').order('criado_em')]);
    if (s.error) setErroSaude(s.error.message); else { setSaude(s.data as Saude); setErroSaude(null); }
    setAdmins((a.data as Admin[]) ?? []);
  }, [sb]);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const { data, error } = await sb.rpc('pc_adicionar_admin', { p_email: email });
    setOcupado(false);
    if (error) return avisar('erro', error.message);
    avisar('ok', String(data)); setEmail(''); carregar();
  }

  async function retirar(a: Admin) {
    const ok = await confirmar({ titulo: 'Retirar acesso?', texto: <>{a.email} não poderá mais lançar nem alterar nada. Os registros que ela criou continuam no histórico.</>, perigo: true, rotuloOk: 'Retirar acesso' });
    if (!ok) return;
    const { data, error } = await sb.rpc('pc_retirar_admin', { p_email: a.email });
    if (error) return avisar('erro', error.message);
    avisar('ok', String(data)); carregar();
  }

  const pingAntigo = saude?.ultimo_ping ? new Date(saude.agora).getTime() - new Date(saude.ultimo_ping).getTime() > 3 * DIA : true;

  return (
    <div className="space-y-6">
      <Cartao titulo="Saúde do site" subtitulo="Confirma que o banco de dados está respondendo agora.">
        {erroSaude ? <Aviso tom="erro">Não foi possível consultar: {erroSaude}</Aviso> : !saude ? <p className="text-slate-500">Consultando…</p> : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700" data-teste="banco-ativo"><CheckCircle2 className="h-6 w-6" />Banco de dados ativo <span className="text-sm font-normal text-slate-500">(respondeu às {dataHora(saude.agora)})</span></p>
            <dl className="grid gap-3 sm:grid-cols-4">
              {[['Registros', saude.lancamentos], ['No site', saude.publicados], ['Sem comprovante', saude.sem_comprovante], ['Administradores', saude.administradores]].map(([t, v]) => (
                <div key={String(t)} className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs uppercase tracking-wide text-slate-500">{t}</dt><dd className="font-titulo text-2xl font-bold">{num(Number(v))}</dd></div>
              ))}
            </dl>
            <div className={`rounded-2xl p-4 text-sm ring-1 ${pingAntigo ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-100'}`} data-teste="robo">
              <p className="flex items-center gap-2 font-semibold">{pingAntigo ? <TriangleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}Robô que mantém o banco ativo</p>
              {saude.ultimo_ping
                ? <p className="mt-1">Último acesso automático: <strong>{dataHora(saude.ultimo_ping)}</strong> ({num(saude.total_pings)} no total).{pingAntigo && ' Faz mais de 3 dias: confira a aba Actions do GitHub (fluxo “Manter banco ativo”).'}</p>
                : <p className="mt-1">Ainda não houve nenhum acesso automático. Ative o fluxo “Manter banco ativo” na aba Actions do GitHub (veja docs/PRESTACAO.md).</p>}
            </div>
            {saude.ultima_alteracao && <p className="text-sm text-slate-500">Última alteração em um registro: {dataHora(saude.ultima_alteracao)}.</p>}
          </div>
        )}
      </Cartao>

      <Cartao titulo="Quem pode lançar e alterar" subtitulo="Administradores têm acesso a esta área. A pessoa precisa ter um usuário criado antes (veja abaixo).">
        <ul className="divide-y divide-slate-100" data-teste="lista-admins">
          {admins.map((a) => (
            <li key={a.user_id} className="flex items-center justify-between gap-3 py-3">
              <span><span className="font-medium text-slate-800">{a.email}</span>{a.user_id === meuId && <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-semibold">você</span>}</span>
              {a.user_id !== meuId && <button onClick={() => retirar(a)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"><UserMinus className="h-3.5 w-3.5" />Retirar acesso</button>}
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar} className="mt-4 flex flex-wrap items-end gap-3">
          <Rotulo texto="Dar acesso a outra pessoa (e-mail)" className="min-w-[260px] flex-1"><Texto type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.org" data-teste="novo-admin-email" /></Rotulo>
          <button type="submit" disabled={ocupado} data-teste="novo-admin" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><UserPlus className="h-4 w-4" />Dar acesso</button>
        </form>
        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-semibold">Como criar o usuário da pessoa</summary>
          <p className="mt-2">No Supabase: <strong>Authentication → Users → Add user → Create new user</strong>, informe o e-mail e uma senha forte (mínimo de 10 caracteres) e marque <em>Auto Confirm User</em>. Depois volte aqui e clique em “Dar acesso”.</p>
        </details>
      </Cartao>

      <Cartao titulo="Boas práticas de segurança">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Use senhas fortes e diferentes (mínimo de 10 caracteres) e não compartilhe o login: dê acesso individual a cada pessoa.</li>
          <li>Mantenha desligado o cadastro público no Supabase (<em>Allow new users to sign up</em>).</li>
          <li>Retire o acesso de quem sair da equipe. Tudo que cada pessoa fez fica registrado no histórico.</li>
          <li>Cubra CPF, contas, telefones e nomes de crianças antes de mostrar uma foto no site.</li>
        </ul>
      </Cartao>
      {elemento}
    </div>
  );
}
