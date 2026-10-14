// Componentes básicos de interface, consistentes e acessíveis.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { STATUS, rotuloStatus, type Tom } from '../lib/rotulos';
import { lerDinheiro } from '../lib/formato';

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }

// ------------------------------------------------------------------ botões
type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sol';
const estilosBotao: Record<Variante, string> = {
  primario: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400',
  sol: 'bg-sol-500 text-slate-900 hover:bg-sol-400 disabled:opacity-50',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  fantasma: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
};

export function Botao({ variante = 'primario', carregando, icone, children, className, pequeno, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode; pequeno?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || carregando}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sol-500 focus-visible:ring-offset-1 whitespace-nowrap',
        pequeno ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm', estilosBotao[variante], className)}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ selos de situação
const tons: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-700 ring-slate-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  atencao: 'bg-amber-50 text-amber-800 ring-amber-200',
  erro: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  roxo: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Selo({ status, tom, children }: { status?: string | null; tom?: Tom; children?: ReactNode }) {
  const t = tom ?? (status ? STATUS[status]?.[1] : undefined) ?? 'neutro';
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', tons[t])}>
      {children ?? rotuloStatus(status)}
    </span>
  );
}

export function Pendente({ children = 'Pendente de configuração' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{children}</span>;
}

// ------------------------------------------------------------------ cartões
export function Cartao({ titulo, acoes, children, className, semPadding }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; semPadding?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {titulo && <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={semPadding ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Indicador({ rotulo, valor, detalhe, tom = 'neutro', icone, onClick }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: Tom; icone?: ReactNode; onClick?: () => void }) {
  const borda: Record<Tom, string> = { neutro: 'border-l-slate-300', ok: 'border-l-emerald-500', atencao: 'border-l-amber-500', erro: 'border-l-red-500', info: 'border-l-blue-500', roxo: 'border-l-violet-500' };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm', borda[tom], onClick && 'hover:bg-slate-50 transition-colors')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
        {icone && <span className="text-slate-400">{icone}</span>}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </Tag>
  );
}

export function TituloPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{texto}</div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Aviso({ tom = 'info', children, titulo }: { tom?: 'info' | 'atencao' | 'erro' | 'ok'; children: ReactNode; titulo?: string }) {
  const est = { info: 'bg-blue-50 border-blue-200 text-blue-800', atencao: 'bg-amber-50 border-amber-200 text-amber-900', erro: 'bg-red-50 border-red-200 text-red-800', ok: 'bg-emerald-50 border-emerald-200 text-emerald-800' }[tom];
  const Ic = { info: Info, atencao: AlertTriangle, erro: XCircle, ok: CheckCircle2 }[tom];
  return (
    <div className={cx('flex gap-2 rounded-lg border px-3 py-2.5 text-sm', est)} role={tom === 'erro' ? 'alert' : undefined}>
      <Ic className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{titulo && <p className="font-semibold">{titulo}</p>}{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ modal
export function Modal({ aberto, titulo, onFechar, children, rodape, largura = 'max-w-2xl' }: { aberto: boolean; titulo: ReactNode; onFechar: () => void; children: ReactNode; rodape?: ReactNode; largura?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', esc);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = anterior; };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className={cx('my-auto w-full rounded-xl bg-white shadow-xl outline-none', largura)}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onFechar} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{rodape}</footer>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ mensagens (toast)
interface Msg { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string; }
const CtxAviso = createContext<(tipo: Msg['tipo'], texto: string) => void>(() => {});

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const avisar = useCallback((tipo: Msg['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, tipo, texto }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), tipo === 'erro' ? 8000 : 4000);
  }, []);
  return (
    <CtxAviso.Provider value={avisar}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={cx('flex items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-lg ring-1',
            m.tipo === 'ok' && 'bg-emerald-600 text-white ring-emerald-700', m.tipo === 'erro' && 'bg-red-600 text-white ring-red-700', m.tipo === 'info' && 'bg-slate-800 text-white ring-slate-900')}>
            {m.tipo === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : m.tipo === 'erro' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{m.texto}</span>
            <button onClick={() => setMsgs((x) => x.filter((y) => y.id !== m.id))} aria-label="Fechar"><X className="h-4 w-4 opacity-70" /></button>
          </div>
        ))}
      </div>
    </CtxAviso.Provider>
  );
}
export const useAviso = () => useContext(CtxAviso);

// ------------------------------------------------------------------ campos de formulário
const classeCampo = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sol-500 focus:outline-none focus:ring-2 focus:ring-sol-200 disabled:bg-slate-50 disabled:text-slate-500';

export function Rotulo({ texto, obrigatorio, ajuda, children, className }: { texto: string; obrigatorio?: boolean; ajuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{texto}{obrigatorio && <span className="text-red-600"> *</span>}</span>
      {children}
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function Texto(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cx(classeCampo, p.className)} />; }
export function AreaTexto(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea rows={3} {...p} className={cx(classeCampo, p.className)} />; }
export function Selecao({ opcoes, vazio = 'Selecione…', ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { opcoes: { valor: string; rotulo: string }[]; vazio?: string | false }) {
  return (
    <select {...p} className={cx(classeCampo, 'pr-8', p.className)}>
      {vazio !== false && <option value="">{vazio}</option>}
      {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}

/** Campo monetário: aceita "1.234,56"; devolve texto "1234.56" (ou "" se vazio). */
export function CampoDinheiro({ valor, onChange, ...p }: { valor: string | number | null | undefined; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const formatar = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2).replace('.', ','));
  const [texto, setTexto] = useState(formatar(valor));
  const [focado, setFocado] = useState(false);
  useEffect(() => { if (!focado) setTexto(formatar(valor)); }, [valor, focado]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">R$</span>
      <input
        inputMode="decimal"
        {...p}
        className={cx(classeCampo, 'pl-9 text-right tabular-nums', p.className)}
        value={texto}
        onFocus={() => setFocado(true)}
        onChange={(e) => { setTexto(e.target.value); const v = lerDinheiro(e.target.value); onChange(v ?? ''); }}
        onBlur={() => { setFocado(false); const v = lerDinheiro(texto); setTexto(v ? formatar(v) : ''); }}
      />
    </div>
  );
}

export function Caixa({ rotulo, checked, onChange, ajuda }: { rotulo: ReactNode; checked: boolean; onChange: (v: boolean) => void; ajuda?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sol-600 focus:ring-sol-500" />
      <label htmlFor={id} className="text-sm text-slate-700">{rotulo}{ajuda && <span className="block text-xs text-slate-500">{ajuda}</span>}</label>
    </div>
  );
}

// ------------------------------------------------------------------ confirmação com justificativa
export function useConfirmacao() {
  const [estado, setEstado] = useState<null | { titulo: string; texto: ReactNode; justificativa?: boolean; minimo?: number; perigo?: boolean; rotuloOk?: string; resolver: (v: string | null) => void }>(null);
  const [just, setJust] = useState('');
  const confirmar = (o: { titulo: string; texto: ReactNode; justificativa?: boolean; minimo?: number; perigo?: boolean; rotuloOk?: string }) =>
    new Promise<string | null>((resolver) => { setJust(''); setEstado({ ...o, resolver }); });
  const minimo = estado?.minimo ?? 10;
  const elemento = estado && (
    <Modal aberto titulo={estado.titulo} onFechar={() => { estado.resolver(null); setEstado(null); }} largura="max-w-lg"
      rodape={<>
        <Botao variante="secundario" onClick={() => { estado.resolver(null); setEstado(null); }}>Voltar</Botao>
        <Botao variante={estado.perigo ? 'perigo' : 'primario'} disabled={estado.justificativa && just.trim().length < minimo}
          onClick={() => { estado.resolver(estado.justificativa ? just.trim() : 'ok'); setEstado(null); }}>{estado.rotuloOk ?? 'Confirmar'}</Botao>
      </>}>
      <div className="space-y-3 text-sm text-slate-700">
        <div>{estado.texto}</div>
        {estado.justificativa && (
          <Rotulo texto="Justificativa" obrigatorio ajuda={`Mínimo de ${minimo} caracteres. Ficará registrada no histórico.`}>
            <AreaTexto autoFocus value={just} onChange={(e) => setJust(e.target.value)} />
          </Rotulo>
        )}
      </div>
    </Modal>
  );
  return { confirmar, elemento };
}
