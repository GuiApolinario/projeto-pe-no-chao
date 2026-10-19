// Entrada da equipe: cola a chave de acesso do GitHub e passa a editar o próprio site, clicando nos textos e imagens.
import { useState } from 'react';
import { Rotulo, Texto } from '../components/ui';
import { esquecerToken, guardarToken, lerToken, ligarModoEdicao } from './token';

export default function EditarSite() {
  const [t, setT] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [temChave, setTemChave] = useState(() => !!lerToken());
  const entrar = () => { ligarModoEdicao(true); window.location.assign('/'); };
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <meta name="robots" content="noindex" />
      <h1 className="font-titulo text-3xl font-extrabold text-slate-900">Editar o site</h1>
      {temChave ? (
        <div className="mt-4 space-y-4">
          <p className="text-slate-600">Este aparelho já tem a chave de acesso guardada.</p>
          <button data-teste="entrar" onClick={entrar} className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800">Entrar no modo edição</button>
          <div><button onClick={() => { esquecerToken(); setTemChave(false); }} className="text-sm text-slate-500 underline">Esquecer a chave e usar outra</button></div>
        </div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { guardarToken(t.trim(), lembrar); entrar(); } }}>
          <p className="text-slate-600">Depois de entrar, você navega pelo site e <strong>clica direto nos textos e nas imagens</strong> para mudar. Cole abaixo a <strong>chave de acesso</strong> do GitHub (passo a passo em <code>docs/EDITAR-O-SITE.md</code>).</p>
          <Rotulo texto="Chave de acesso"><Texto type="password" autoComplete="off" value={t} onChange={(e) => setT(e.target.value)} placeholder="github_pat_…" data-teste="token" /></Rotulo>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />Lembrar neste aparelho (use só no seu computador ou celular)</label>
          <button data-teste="entrar" className="rounded-full bg-slate-900 px-7 py-3 font-bold text-white hover:bg-slate-800">Entrar</button>
        </form>
      )}
    </section>
  );
}
