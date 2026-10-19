import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ProvedorFiltro, ProvedorSessao } from './lib/sessao';
import { Carregando, ProvedorAvisos } from './components/ui';
import { Navigate } from 'react-router-dom';
import { Contato, Doe, Inicio, LayoutSite, Privacidade, Transparencia } from './site/Site';
import { Entrar, RedefinirSenha } from './site/Entrar';
import { supabaseConfigurado } from './lib/supabase';

// área administrativa carregada sob demanda (o site público fica leve)
const PrestacaoPublica = lazy(() => import('./prestacao/Publica'));
const PrestacaoGerenciar = lazy(() => import('./prestacao/Gerenciar'));
const LayoutAdmin = lazy(() => import('./admin/Layout'));
const Painel = lazy(() => import('./admin/Painel'));
const Movimentacoes = lazy(() => import('./admin/Movimentacoes'));
const Receitas = lazy(() => import('./admin/Receitas'));
const Despesas = lazy(() => import('./admin/Despesas'));
const Comprovantes = lazy(() => import('./admin/Comprovantes'));
const Orcamento = lazy(() => import('./admin/Orcamento'));
const Conciliacao = lazy(() => import('./admin/Conciliacao'));
const Relatorios = lazy(() => import('./admin/Relatorios'));
const Cadastros = lazy(() => import('./admin/Cadastros'));
const Prazos = lazy(() => import('./admin/Cadastros').then((m) => ({ default: m.Prazos })));
const DoacoesBens = lazy(() => import('./admin/Social').then((m) => ({ default: m.DoacoesBens })));
const Atividades = lazy(() => import('./admin/Social').then((m) => ({ default: m.Atividades })));
const ResultadosSociais = lazy(() => import('./admin/Social').then((m) => ({ default: m.ResultadosSociais })));
const Beneficiarios = lazy(() => import('./admin/Social').then((m) => ({ default: m.Beneficiarios })));
const ConfigSite = lazy(() => import('./admin/Administracao').then((m) => ({ default: m.ConfigSite })));
const Usuarios = lazy(() => import('./admin/Administracao').then((m) => ({ default: m.Usuarios })));
const Auditoria = lazy(() => import('./admin/Administracao').then((m) => ({ default: m.Auditoria })));
const Backup = lazy(() => import('./admin/Administracao').then((m) => ({ default: m.Backup })));
const Alertas = lazy(() => import('./admin/Administracao').then((m) => ({ default: m.Alertas })));

function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-titulo text-5xl font-extrabold text-sol-500">404</p>
      <p className="mt-2 text-slate-600">Página não encontrada.</p>
      <Link to="/" className="mt-4 inline-block font-semibold underline">Voltar ao início</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorAvisos>
        <ProvedorSessao>
          <ProvedorFiltro>
            <Suspense fallback={<Carregando />}>
              <Routes>
                <Route element={<LayoutSite />}>
                  <Route index element={<Inicio />} />
                  <Route path="doe" element={<Doe />} />
                  <Route path="prestacao-de-contas" element={<PrestacaoPublica />} />
                  <Route path="prestacao-de-contas/gerenciar" element={<PrestacaoGerenciar />} />
                  <Route path="transparencia" element={supabaseConfigurado ? <Transparencia /> : <Navigate to="/prestacao-de-contas" replace />} />
                  <Route path="contato" element={<Contato />} />
                  <Route path="privacidade" element={<Privacidade />} />
                  <Route path="*" element={<NaoEncontrada />} />
                </Route>
                {supabaseConfigurado && <Route path="entrar" element={<Entrar />} />}
                {supabaseConfigurado && <Route path="redefinir-senha" element={<RedefinirSenha />} />}
                {supabaseConfigurado && <Route path="admin" element={<LayoutAdmin />}>
                  <Route index element={<Painel />} />
                  <Route path="alertas" element={<Alertas />} />
                  <Route path="movimentacoes" element={<Movimentacoes />} />
                  <Route path="receitas" element={<Receitas />} />
                  <Route path="despesas" element={<Despesas />} />
                  <Route path="comprovantes" element={<Comprovantes />} />
                  <Route path="orcamento" element={<Orcamento />} />
                  <Route path="conciliacao" element={<Conciliacao />} />
                  <Route path="doacoes-bens" element={<DoacoesBens />} />
                  <Route path="atividades" element={<Atividades />} />
                  <Route path="resultados" element={<ResultadosSociais />} />
                  <Route path="beneficiarios" element={<Beneficiarios />} />
                  <Route path="relatorios" element={<Relatorios />} />
                  <Route path="prazos" element={<Prazos />} />
                  <Route path="cadastros" element={<Cadastros />} />
                  <Route path="site" element={<ConfigSite />} />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="auditoria" element={<Auditoria />} />
                  <Route path="backup" element={<Backup />} />
                </Route>}
              </Routes>
            </Suspense>
          </ProvedorFiltro>
        </ProvedorSessao>
      </ProvedorAvisos>
    </BrowserRouter>
  );
}
