import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { mensagemErro, supabase, supabaseConfigurado } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { Aviso, Botao, Rotulo, Texto } from '../components/ui';

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sol-50 to-white p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl ring-1 ring-sol-100">
        <Link to="/"><img src="/logo-640.jpg" alt="Projeto Pé no Chão" className="mx-auto mb-5 h-20 w-auto" /></Link>
        {children}
      </div>
    </div>
  );
}

export function Entrar() {
  const { sessao } = useSessao();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  if (sessao) return <Navigate to={(local.state as { de?: string })?.de ?? '/admin'} replace />;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) setErro(mensagemErro(error));
  }
  async function recuperar() {
    if (!email.trim()) return setErro('Informe seu e-mail para receber o link de redefinição.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (error) setErro(mensagemErro(error)); else { setErro(null); setInfo('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.'); }
  }
  return (
    <Moldura>
      <h1 className="mb-1 text-center text-lg font-semibold">Área da equipe</h1>
      <p className="mb-5 text-center text-sm text-slate-500">Gestão financeira e prestação de contas</p>
      {!supabaseConfigurado && <div className="mb-4"><Aviso tom="atencao">Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env e gere o site novamente.</Aviso></div>}
      <form onSubmit={entrar} className="space-y-3">
        <Rotulo texto="E-mail"><Texto type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Rotulo>
        <Rotulo texto="Senha"><Texto type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Rotulo>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {info && <Aviso tom="ok">{info}</Aviso>}
        <Botao type="submit" className="w-full" carregando={carregando}>Entrar</Botao>
        <button type="button" onClick={recuperar} className="w-full text-center text-sm text-slate-500 hover:text-slate-800">Esqueci minha senha</button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-400">Acesso somente por convite do administrador.</p>
    </Moldura>
  );
}

export function RedefinirSenha() {
  const nav = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setPronto(!!data.session)); const { data } = supabase.auth.onAuthStateChange((_e, s) => setPronto(!!s)); return () => data.subscription.unsubscribe(); }, []);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 10) return setErro('Use pelo menos 10 caracteres.');
    if (senha !== confirma) return setErro('As senhas não conferem.');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setErro(mensagemErro(error)); else nav('/admin');
  }
  return (
    <Moldura>
      <h1 className="mb-4 text-center text-lg font-semibold">Definir nova senha</h1>
      {!pronto ? <Aviso tom="info">Abra esta página pelo link recebido por e-mail (convite ou recuperação de senha).</Aviso> : (
        <form onSubmit={salvar} className="space-y-3">
          <Rotulo texto="Nova senha" ajuda="Mínimo de 10 caracteres."><Texto type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Rotulo>
          <Rotulo texto="Confirme a senha"><Texto type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} /></Rotulo>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Botao type="submit" className="w-full">Salvar senha</Botao>
        </form>
      )}
    </Moldura>
  );
}
