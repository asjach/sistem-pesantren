import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset } from '@/api/toolbarPreset';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import InfoEditor from '@/components/info/InfoEditor';
import { PANJANG_HTML_MAKS } from '@/components/info/sanitasiHtml';
import { Loader2 } from '@/icons';
import { kabariToolbar } from './jenis';

/** Jeda sebelum menulis ke server. Editor memicu perubahan tiap ketukan,
 *  sedangkan payload-nya bisa melewati 1 MB (gambar base64) — menulis tiap
 *  ketukan berarti mengunggah ulang seluruh gambar terus-menerus. Beberapa
 *  ketukan dalam jeda ini digabung jadi SATU penyimpanan. */
const JEDA_SIMPAN = 500;

/**
 * Tab Info dialog Kelola Tabel: satu HTML info per `table_key`, tampil sebagai
 * popover (dibuka lewat klik) di ujung judul tabel.
 *
 * Disimpan dengan pola yang sama seperti bagian lain dialog: perubahan
 * dilaporkan "kotor" ke cangkang, dan cangkang memanggil fungsi simpan bagian
 * ini. Bedanya, fungsi simpan di sini MENUNDA sebentar lalu menunggu hasilnya,
 * supaya footer tetap berkata "Menyimpan…" sampai server benar-benar selesai
 * dan isi yang diketik tak pernah ditulis per huruf.
 *
 * Isi HTML mentah milik pengguna; backend menyaringnya dengan allowlist
 * `App\Support\HtmlInfo` sebelum menyimpan. Klien tetap menyaring saat
 * dirender (lihat `InfoTampil`), bukan saat mengetik — memotong markup di
 * tengah jalan membuat kursor melompat.
 */
export default function TabInfo({ tableKey }: { tableKey: string }) {
  /** HTML di editor (mentah, belum tentu sama dengan yang tersimpan). */
  const [html, setHtml] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);

  /** Cermin `html` untuk keputusan sinkron (state baru terlihat render berikut). */
  const htmlRef = useRef('');
  /** Nilai terakhir yang SUDAH tersimpan di server (acuan deteksi kotor). */
  const acuanRef = useRef('');
  const timerRef = useRef<number | null>(null);
  /** Pemanggil yang menunggu penyimpanan tertunda selesai (dari cangkang). */
  const tungguRef = useRef<Array<(ok: boolean) => void>>([]);

  const laporKotorRef = useRef<(kotor: boolean) => void>(() => {});

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await muatToolbarPreset(tableKey);
      const server = res.data.info_html ?? '';
      acuanRef.current = server;
      htmlRef.current = server;
      setHtml(server);
      setGagalMuat(false);
    } catch {
      // Jangan biarkan editor kosong bisa disimpan: itu akan MENGHAPUS info
      // yang sudah ada hanya karena muat gagal sesaat.
      setGagalMuat(true);
    } finally {
      setMemuat(false);
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      // Lepaskan penunggu agar janji `simpanTertunda` tak menggantung.
      for (const selesai of tungguRef.current.splice(0)) selesai(false);
    };
  }, [muat]);

  const simpan = useCallback(async (): Promise<boolean> => {
    const dikirim = htmlRef.current;
    if (dikirim.length > PANJANG_HTML_MAKS) {
      toast.error('Info tabel melebihi batas ukuran. Kurangi teks atau gambar.');
      return false;
    }
    try {
      // `''` = hapus info (backend menyimpannya NULL → tombol Info hilang).
      await simpanToolbarPreset(tableKey, undefined, undefined, undefined, undefined, undefined, dikirim);
      acuanRef.current = dikirim;
      kabariToolbar(tableKey);
      // Ketikan yang masuk saat permintaan berjalan belum ikut tersimpan:
      // biarkan tetap "kotor" supaya cangkang menjadwalkan penyimpanan lagi.
      laporKotorRef.current(htmlRef.current !== dikirim);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }, [tableKey]);

  /** Simpan tertunda: setiap panggilan menjadwalkan ulang, dan SEMUA penunggu
   *  diselesaikan bersama setelah penyimpanan benar-benar terjadi. */
  const simpanTertunda = useCallback((): Promise<boolean> => new Promise((resolve) => {
    tungguRef.current.push(resolve);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const tunggu = tungguRef.current.splice(0);
      void simpan().then((ok) => {
        for (const selesai of tunggu) selesai(ok);
      });
    }, JEDA_SIMPAN);
  }), [simpan]);

  const laporKotor = useBagian('info', simpanTertunda);
  laporKotorRef.current = laporKotor;

  useEffect(() => {
    htmlRef.current = html;
    laporKotor(html !== acuanRef.current);
  }, [html, laporKotor]);

  if (memuat) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground" role="status">
        <Loader2 size={13} className="animate-spin" /> Memuat info tabel…
      </p>
    );
  }
  if (gagalMuat) {
    return (
      <p className="px-1 text-xs text-destructive" role="status">
        Info tabel gagal dimuat. Tutup panel lalu buka lagi.
      </p>
    );
  }

  return (
    /* `flex-1 min-h-0`: wadah editor ikut mengisi sisa tinggi tab. */
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <InfoEditor nilai={html} onUbah={setHtml} />
    </div>
  );
}
