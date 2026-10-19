import { useEffect, useRef, useState } from 'react';
import { EyeOff, Undo2 } from 'lucide-react';
import { aplicarTarjas, carregarBitmap, tarjaDeArraste, type Tarja } from './imagem';
import { Modal } from '../components/ui';

/** Editor simples: arraste sobre o que deve ficar escondido (CPF, conta, telefone, nomes). */
export function EditorTarja({ arquivo, onConcluir, onCancelar }: { arquivo: File; onConcluir: (f: File) => void; onCancelar: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tarjas, setTarjas] = useState<Tarja[]>([]);
  const [arrasto, setArrasto] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [tam, setTam] = useState({ w: 600, h: 400 });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarBitmap(arquivo).then((b) => {
      if (!vivo) return;
      const maxW = Math.min(window.innerWidth - 72, 860), maxH = Math.round(window.innerHeight * 0.58);
      const esc = Math.min(maxW / b.width, maxH / b.height, 1);
      setTam({ w: Math.round(b.width * esc), h: Math.round(b.height * esc) });
      setBmp(b);
    }).catch((e) => setErro(e.message));
    return () => { vivo = false; };
  }, [arquivo]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !bmp) return;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, tam.w, tam.h);
    ctx.fillStyle = '#000';
    for (const t of tarjas) ctx.fillRect(t.x * tam.w, t.y * tam.h, t.w * tam.w, t.h * tam.h);
    if (arrasto) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.strokeStyle = '#e83e8c'; ctx.lineWidth = 2;
      const x = Math.min(arrasto.x1, arrasto.x2), y = Math.min(arrasto.y1, arrasto.y2);
      ctx.fillRect(x, y, Math.abs(arrasto.x2 - arrasto.x1), Math.abs(arrasto.y2 - arrasto.y1));
      ctx.strokeRect(x, y, Math.abs(arrasto.x2 - arrasto.x1), Math.abs(arrasto.y2 - arrasto.y1));
    }
  }, [bmp, tam, tarjas, arrasto]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(tam.w, e.clientX - r.left)), Math.max(0, Math.min(tam.h, e.clientY - r.top))] as const;
  };

  async function aplicar() {
    setSalvando(true);
    try { onConcluir(await aplicarTarjas(arquivo, tarjas)); } catch (e) { setErro((e as Error).message); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Cobrir dados pessoais" onFechar={onCancelar} largura="max-w-4xl"
      rodape={<>
        <button className="rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50" onClick={onCancelar}>Cancelar</button>
        <button data-teste="aplicar-tarjas" disabled={!tarjas.length || salvando} onClick={aplicar}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><EyeOff className="h-4 w-4" />{salvando ? 'Aplicando…' : 'Aplicar tarjas'}</button>
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Arraste o dedo (ou o mouse) sobre o que <strong>não pode aparecer</strong>: CPF, telefone, chave PIX, número de conta, endereço, nome de crianças. A tarja é gravada na foto e <strong>não pode ser desfeita depois de salvar</strong>.</p>
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-center rounded-xl bg-slate-100 p-2">
          {bmp ? (
            <canvas ref={canvas} width={tam.w} height={tam.h} data-teste="tela-tarja" style={{ width: tam.w, height: tam.h, touchAction: 'none', cursor: 'crosshair' }} className="rounded bg-white shadow"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = pos(e); setArrasto({ x1: x, y1: y, x2: x, y2: y }); }}
              onPointerMove={(e) => { if (arrasto) { const [x, y] = pos(e); setArrasto({ ...arrasto, x2: x, y2: y }); } }}
              onPointerUp={() => { if (arrasto) { const t = tarjaDeArraste(arrasto.x1, arrasto.y1, arrasto.x2, arrasto.y2, tam.w, tam.h); if (t) setTarjas([...tarjas, t]); setArrasto(null); } }}
              onPointerCancel={() => setArrasto(null)} />
          ) : !erro && <p className="py-10 text-slate-500">Abrindo imagem…</p>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40" disabled={!tarjas.length} onClick={() => setTarjas(tarjas.slice(0, -1))}><Undo2 className="h-4 w-4" />Desfazer última</button>
          <span className="text-slate-500">{tarjas.length} {tarjas.length === 1 ? 'tarja' : 'tarjas'}</span>
        </div>
      </div>
    </Modal>
  );
}
