import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { errorMessage } from '@/api/client';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type VisibilitasToolbar,
} from '@/api/toolbarPreset';
import { kabariToolbar } from '@/components/kelolaTabel/jenis';
import {
  buangKunciVisibilitas,
  gabungVisibilitas,
} from '@/components/excel/filterTabel';
import {
  bagianTersedia,
  type InfoBagianTabel,
} from '@/components/excel/bagianTabel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

/** Section "Visibilitas bagian tabel" di tab Umum dialog Kelola Tabel:
 *  nyala/mati potongan tabel ini saja (bilah judul, info tengah, header kolom,
 *  rel filter, kaki tabel).
 *
 *  Disimpan di `toolbar_preset.visibilitas` — peta yang SAMA dipakai filter
 *  toolbar, jadi tanpa migrasi dan grid membaca ulang lewat
 *  `EVENT_TOOLBAR_BERUBAH`.
 *
 *  WAJIB merge: `simpanToolbarPreset` menimpa SATU PETA utuh, jadi kunci milik
 *  filter toolbar (atau fitur lain) harus dibaca ulang lalu digabung —
 *  menulis sebagian tanpa merge akan MENGHAPUS yang tidak ikut ditulis.
 *
 *  Id bagian di registri `kotor` bernama `visibilitasBagian`, bukan `umum`:
 *  satu id hanya bisa didaftarkan satu kali, dan tab Umum punya bagian lain
 *  (tampilan perangkat) yang juga terdaftar. Cangkang menampilkan titiknya
 *  pada tab "Umum".
 *
 *  Tanpa teks penjelasan di bawah daftar sakelar: aturan proyek
 *  `.ai/rules/src.md` melarang menambah keterangan/deskripsi UI atas inisiatif
 *  sendiri. Konsekuensinya, mematikan "Bilah judul" + "Kaki tabel" berdua
 *  menghapus pintu "Kelola Tabel" milik tabel itu tanpa peringatan — kalau
 *  peringatan dibutuhkan, itu permintaan eksplisit pengguna. */
export default function TabBagianTabel({
  tableKey,
  info,
}: {
  tableKey: string;
  /** Bagian mana yang benar-benar ada di tabel ini. */
  info: InfoBagianTabel;
}) {
  /** Sakelar per bagian: `true` = tampil (bawaan), `false` = disembunyikan. */
  const [nilai, setNilai] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  /** Ada penanda "sembunyi" milik bagian tabel di DB (acuan tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);

  /** Bagian yang bisa dimatikan pada tabel ini — yang tak ada disembunyikan
   *  dari dialog supaya tak ada sakelar mati. */
  const tampil = useMemo(() => bagianTersedia(info), [info]);
  /** Kunci yang boleh ditulis/dibuang section ini — bukan semua kunci server,
   *  karena `visibilitas` juga menyimpan filter toolbar. */
  const kunciMilik = useMemo(() => tampil.map((b) => b.kunci), [tampil]);

  /** Peta visibilitas persis seperti di server (untuk merge saat menulis). */
  const serverRef = useRef<VisibilitasToolbar>({});
  /** Peta terakhir yang sama dengan server (acuan deteksi kotor). */
  const acuanRef = useRef('{}');

  const muat = useCallback(async () => {
    const semua = kunciMilik;
    try {
      const res = await muatToolbarPreset(tableKey);
      const server = res.data.visibilitas ?? {};
      serverRef.current = { ...server };
      const peta: Record<string, boolean> = {};
      for (const k of semua) peta[k] = server[k] !== false;
      setNilai(peta);
      setAdaSimpanan(semua.some((k) => server[k] === false));
      acuanRef.current = JSON.stringify(peta);
    } catch {
      // Gagal muat = anggap bawaan (semua tampil), sama seperti grid.
      const bawaan: Record<string, boolean> = {};
      for (const k of semua) bawaan[k] = true;
      setNilai(bawaan);
      setAdaSimpanan(false);
      acuanRef.current = JSON.stringify(bawaan);
    }
  }, [tableKey, kunciMilik]);

  useEffect(() => {
    void muat();
  }, [muat]);

  /** Tulis ke server. Dipakai sebagai fungsi simpan bagian di registri `kotor`:
   *  begitu sakelar berubah dan bagian melaporkan "kotor", cangkang memanggil
   *  ini sendiri (pola yang sama dengan `TabFilterToolbar`). */
  const simpan = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const gabung = gabungVisibilitas(serverRef.current, nilai);
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      acuanRef.current = JSON.stringify(nilai);
      setAdaSimpanan(kunciMilik.some((k) => nilai[k] === false));
      toast.success('Visibilitas bagian tabel disimpan.');
      kabariToolbar(tableKey);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [kunciMilik, nilai, tableKey]);

  const laporKotor = useBagian('visibilitasBagian', simpan);

  useEffect(() => {
    laporKotor(JSON.stringify(nilai) !== acuanRef.current);
  }, [nilai, laporKotor]);

  async function kembalikan() {
    setBusy(true);
    try {
      // Buang penanda milik bagian tabel saja; kunci filter toolbar dibiarkan
      // — tabel kembali ke bawaan kode untuk bagian-bagian ini.
      const gabung = buangKunciVisibilitas(serverRef.current, kunciMilik);
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      const bawaan: Record<string, boolean> = {};
      for (const k of kunciMilik) bawaan[k] = true;
      setNilai(bawaan);
      acuanRef.current = JSON.stringify(bawaan);
      setAdaSimpanan(false);
      laporKotor(false);
      toast.success('Visibilitas bagian tabel dikembalikan ke bawaan.');
      kabariToolbar(tableKey);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Visibilitas bagian tabel
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          id={`btn_kembalikan_bagian_${tableKey}`}
          className="ml-auto gap-1.5 text-muted-foreground"
          disabled={busy || !adaSimpanan}
          onClick={() => void kembalikan()}
        >
          Kembalikan ke bawaan
        </Button>
      </div>
      {tampil.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Tabel ini tidak punya bagian yang bisa disembunyikan.
        </p>
      ) : (
        <div className="flex flex-col rounded-md border">
          {tampil.map(({ kunci, label, ket }) => (
            <div
              key={kunci}
              className="flex items-center gap-2 border-b px-2 py-1 last:border-0 hover:bg-accent/40"
            >
              <Checkbox
                id={`chk_bagian_${tableKey}_${kunci}`}
                checked={nilai[kunci] !== false}
                disabled={busy}
                aria-label={`Tampilkan ${label}`}
                title={`Tampilkan ${label} — ${nilai[kunci] === false ? 'tersembunyi' : 'tampil'}`}
                onCheckedChange={(c) => setNilai((v) => ({ ...v, [kunci]: !!c }))}
              />
              <span className="min-w-0 flex-1 truncate text-xs" title={ket}>
                {label}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {nilai[kunci] === false ? 'Mati' : 'Nyala'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}