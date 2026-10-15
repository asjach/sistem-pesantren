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
  grupTersedia,
  kunciTersedia,
  type InfoKomponenTabel,
} from '@/components/excel/komponenTabel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

/** Section "Visibilitas komponen tabel" di tab Umum dialog Kelola Tabel:
 *  sakelar tampil/sembunyi per komponen tabel, dikelompokkan (Bilah judul ·
 *  Kepala tabel · Kaki tabel).
 *
 *  Disimpan di `toolbar_preset.visibilitas` — peta yang sama dipakai fitur
 *  visibilitas lain, jadi tanpa migrasi dan grid membaca ulang lewat
 *  `EVENT_TOOLBAR_BERUBAH`.
 *
 *  WAJIB merge: `simpanToolbarPreset` menimpa SATU PETA utuh, jadi kunci milik
 *  komponen yang tak tersentuh (dan penanda versi lama) harus dibaca ulang lalu
 *  digabung — menulis sebagian tanpa merge akan MENGHAPUS yang tak ikut ditulis.
 *
 *  Id bagian di registri `kotor` bernama `visibilitas`, satu-satunya di tab
 *  Umum selain bagian "Umum" itu sendiri; cangkang menampilkan titiknya pada
 *  tab "Umum".
 *
 *  Tanpa teks penjelasan di bawah daftar: aturan proyek `.ai/rules/src.md`
 *  melarang menambah keterangan/deskripsi UI atas inisiatif sendiri. */
export default function TabVisibilitasKomponen({
  tableKey,
  info,
}: {
  tableKey: string;
  /** Komponen mana yang benar-benar ada di tabel ini. */
  info: InfoKomponenTabel;
}) {
  /** Sakelar per komponen: `true` = tampil (bawaan), `false` = disembunyikan. */
  const [nilai, setNilai] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  /** Ada penanda "sembunyi" milik komponen tabel di DB (acuan tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);

  /** Grup + komponen yang tersedia di tabel ini — yang tak ada disembunyikan
   *  dari dialog supaya tak ada sakelar mati. */
  const grup = useMemo(() => grupTersedia(info), [info]);
  /** Kunci yang boleh ditulis/dibuang section ini — bukan semua kunci server,
   *  karena `visibilitas` juga menyimpan penanda versi lama. */
  const kunciMilik = useMemo(() => kunciTersedia(info), [info]);

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
   *  ini sendiri (pola yang sama dengan section lain di dialog ini). */
  const simpan = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const gabung = gabungVisibilitas(serverRef.current, nilai);
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      acuanRef.current = JSON.stringify(nilai);
      setAdaSimpanan(kunciMilik.some((k) => nilai[k] === false));
      toast.success('Visibilitas komponen tabel disimpan.');
      kabariToolbar(tableKey);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [kunciMilik, nilai, tableKey]);

  const laporKotor = useBagian('visibilitas', simpan);

  useEffect(() => {
    laporKotor(JSON.stringify(nilai) !== acuanRef.current);
  }, [nilai, laporKotor]);

  async function kembalikan() {
    setBusy(true);
    try {
      // Buang penanda milik komponen tabel saja; kunci lain (versi lama, atau
      // fitur lain yang berbagi peta) dibiarkan — tabel kembali ke bawaan kode.
      const gabung = buangKunciVisibilitas(serverRef.current, kunciMilik);
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      const bawaan: Record<string, boolean> = {};
      for (const k of kunciMilik) bawaan[k] = true;
      setNilai(bawaan);
      acuanRef.current = JSON.stringify(bawaan);
      setAdaSimpanan(false);
      laporKotor(false);
      toast.success('Visibilitas komponen tabel dikembalikan ke bawaan.');
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
          Visibilitas komponen tabel
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          id={`btn_kembalikan_komponen_${tableKey}`}
          className="ml-auto gap-1.5 text-muted-foreground"
          disabled={busy || !adaSimpanan}
          onClick={() => void kembalikan()}
        >
          Kembalikan ke bawaan
        </Button>
      </div>
      {grup.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Tabel ini tidak punya komponen yang bisa diatur.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {grup.map(({ grup: g, items }) => (
            <fieldset key={g.id} id={`grup_komponen_${g.id}_${tableKey}`} className="flex flex-col gap-1">
              <legend className="px-1 text-[11px] font-medium text-muted-foreground">
                {g.label}
              </legend>
              <div className="flex flex-col rounded-md border">
                {items.map(({ kunci, label }) => (
                  <div
                    key={kunci}
                    className="flex items-center gap-2 border-b px-2 py-1 last:border-0 hover:bg-accent/40"
                  >
                    <Checkbox
                      id={`chk_komponen_${tableKey}_${kunci}`}
                      checked={nilai[kunci] !== false}
                      disabled={busy}
                      aria-label={`Tampilkan ${label}`}
                      title={`Tampilkan ${label} — ${nilai[kunci] === false ? 'tersembunyi' : 'tampil'}`}
                      onCheckedChange={(c) => setNilai((v) => ({ ...v, [kunci]: !!c }))}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {nilai[kunci] === false ? 'Mati' : 'Nyala'}
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}