import { useCallback, useEffect, useRef, useState } from 'react';
import { ambilScreenshot, type DraftScreenshot } from './screenshotAnotasi';
import { bacaStyleElemen } from './styleAnotasi';

function fingerprint(asal: Element, tujuan: Element | null) {
  return JSON.stringify({
    viewport: [window.innerWidth, window.innerHeight, window.scrollX, window.scrollY],
    elemen: [asal, ...(tujuan ? [tujuan] : [])].map((el) => {
      const rect = el.getBoundingClientRect();
      return { terhubung: el.isConnected, rect: [rect.left, rect.top, rect.width, rect.height], style: bacaStyleElemen(el) };
    }),
    scroll: Array.from(document.querySelectorAll('*')).filter((el) => !el.closest('[data-anotasi-abaikan]') && (el.scrollTop || el.scrollLeft)).map((el) => [el.scrollTop, el.scrollLeft]),
  });
}

export function useScreenshotAnotasi(asal: Element | null, tujuan: Element | null, versiPreview: number, previewAktif: boolean) {
  const [gambar, setGambar] = useState<(DraftScreenshot & { url: string; fingerprint: string }) | null>(null);
  const [mengambil, setMengambil] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const token = useRef(0);
  const reset = useCallback(() => {
    token.current++;
    setGambar(null);
    setMengambil(false);
    setGalat(null);
  }, []);

  useEffect(() => { reset(); }, [asal, tujuan, versiPreview, reset]);
  useEffect(() => () => { token.current++; }, []);
  useEffect(() => () => { if (gambar) URL.revokeObjectURL(gambar.url); }, [gambar]);

  const tidakBerlaku = useCallback(() => {
    token.current++;
    setGambar(null);
    setMengambil(false);
    setGalat('Area atau tampilan berubah. Ambil screenshot ulang, atau simpan tanpa screenshot.');
  }, []);

  useEffect(() => {
    if (!gambar && !mengambil) return;
    const berubah = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-anotasi-abaikan]')) return;
      tidakBerlaku();
    };
    window.addEventListener('scroll', berubah, true);
    window.addEventListener('resize', berubah);
    return () => {
      window.removeEventListener('scroll', berubah, true);
      window.removeEventListener('resize', berubah);
    };
  }, [gambar, mengambil, tidakBerlaku]);

  async function ambil() {
    if (!asal || mengambil) return;
    const operasi = ++token.current;
    setMengambil(true);
    setGalat(null);
    try {
      const awal = fingerprint(asal, tujuan);
      const hasil = await ambilScreenshot(asal, tujuan, previewAktif);
      if (operasi !== token.current) return;
      if (awal !== fingerprint(asal, tujuan)) { tidakBerlaku(); return; }
      setGambar({ ...hasil, url: URL.createObjectURL(hasil.blob), fingerprint: awal });
    } catch (error) {
      if (operasi === token.current) setGalat(`${error instanceof Error ? error.message : 'Screenshot gagal.'} Draft tetap tersimpan di editor; coba lagi atau simpan tanpa screenshot.`);
    } finally {
      if (operasi === token.current) setMengambil(false);
    }
  }

  function validasi() {
    if (gambar && (!asal || gambar.fingerprint !== fingerprint(asal, tujuan))) { tidakBerlaku(); return false; }
    return true;
  }
  return { gambar, mengambil, galat, ambil, reset, validasi };
}
