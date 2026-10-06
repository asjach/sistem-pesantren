import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { errorMessage } from '../../api/client';
import { pasangWorkerPdf, type SumberBerkas } from './penampilBerkasUtil';

/**
 * Dokumen PDF + render halaman aktif ke kanvas.
 *
 * Dipisah dari PenampilBerkas supaya siklus muat/ Destroy dokumen dan render
 * ulang (zoom/wadah berubah) tidak bercampur dengan logika edisi gambar.
 */
export function usePdfDokumen({ aktif, sumber, zoom, ukuranWadah }: {
  /** true bila `sumber` ber-mime PDF. */
  aktif: boolean;
  sumber: SumberBerkas | null;
  zoom: number;
  ukuranWadah: { w: number; h: number };
}) {
  const [dokPdf, setDokPdf] = useState<PDFDocumentProxy | null>(null);
  const [halPdf, setHalPdf] = useState(1);
  const [totalHal, setTotalHal] = useState(0);
  const [galatPdf, setGalatPdf] = useState('');
  const kanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sumber || !aktif) {
      setDokPdf(null);
      setTotalHal(0);
      setHalPdf(1);
      setGalatPdf('');
      return;
    }
    let hidup = true;
    let dok: PDFDocumentProxy | null = null;
    setGalatPdf('');
    pasangWorkerPdf()
      .then((pdfjs) => pdfjs.getDocument({ data: sumber.bytes.slice() }).promise)
      .then((d) => {
        if (!hidup) {
          void d.destroy();
          return;
        }
        dok = d;
        setDokPdf(d);
        setTotalHal(d.numPages);
        setHalPdf(1);
      })
      .catch((e) => {
        if (hidup) {
          setGalatPdf(errorMessage(e));
          toast.error(errorMessage(e));
        }
      });
    return () => {
      hidup = false;
      if (dok) void dok.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, aktif]);

  useEffect(() => {
    const kanvas = kanvasRef.current;
    if (!dokPdf || !kanvas || halPdf < 1) return;
    let batal = false;
    let tugas: RenderTask | null = null;
    (async () => {
      try {
        const hal = await dokPdf.getPage(Math.min(halPdf, dokPdf.numPages));
        if (batal) return;
        const dasar = hal.getViewport({ scale: 1 });
        const skala = Math.max(0.2, ((ukuranWadah.w || dasar.width) / dasar.width) * zoom);
        const pandang = hal.getViewport({ scale: skala });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        kanvas.width = Math.round(pandang.width * dpr);
        kanvas.height = Math.round(pandang.height * dpr);
        kanvas.style.width = `${Math.round(pandang.width)}px`;
        kanvas.style.height = `${Math.round(pandang.height)}px`;
        const ctx = kanvas.getContext('2d');
        if (!ctx || batal) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        tugas = hal.render({ canvas: kanvas, canvasContext: ctx, viewport: pandang });
        await tugas.promise;
      } catch (e) {
        if (!batal && (e as Error)?.name !== 'RenderingCancelledException') {
          setGalatPdf(errorMessage(e));
        }
      }
    })();
    return () => {
      batal = true;
      tugas?.cancel();
    };
  }, [dokPdf, halPdf, zoom, ukuranWadah]);

  return { dokPdf, halPdf, setHalPdf, totalHal, galatPdf, kanvasRef };
}
