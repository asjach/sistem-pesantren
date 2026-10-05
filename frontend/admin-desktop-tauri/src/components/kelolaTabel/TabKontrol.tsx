import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  hapusToolbarPreset,
  muatToolbarPreset,
  simpanToolbarPreset,
} from '@/api/toolbarPreset';
import { useLembagaAktif } from '@/lembagaAktif';
import { useBagian, useAksiBagian } from '@/components/kelolaHalaman/kotor';
import { labelKolom } from '@/lib/labelKolom';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { EVENT_TOOLBAR_BERUBAH, KONTROL_TOOLBAR, LEBAR_BAWAHAN_FILTER, LEBAR_BAWAHAN_TOOLBAR, bacaLebarFilter, bacaLebarToolbar, bacaVisToolbar, type KontrolLebar, type VisToolbar, type LebarToolbar } from './jenis';
import { daftarFilter, kunciFilterBawaan } from '@/components/excel/lebarFilter';

/** Peringatan khusus kontrol "Filter halaman" (dipindah ke tooltip agar tidak
 *  memakan satu baris penuh di dialog). */
const PERINGATAN_FILTER_HALAMAN =
  'Menyembunyikan “Filter halaman” dapat mengunci alur yang bergantung padanya '
  + '(mis. pilihan kelas tujuan di Riwayat Belajar).';

/** Section Toolbar dialog Kelola Tabel: tampil/sembunyikan kontrol toolbar
 *  generik per tabel — GLOBAL untuk seluruh lembaga, khusus super_admin.
 *  Bukan dihapus: kontrol yang disembunyikan tetap ada, hanya tak dirender. */
export default function TabKontrol({ tableKey }: { tableKey: string }) {
  /** Visibilitas kontrol = super_admin EFEKTIF (mati saat bertindak). */
  const { efektifSuper: bolehUbah } = useLembagaAktif();

  const [vis, setVis] = useState<VisToolbar>({ info: true, urut: true, kolom: true, filter: true });
  /** Lebar kontrol (px); nilai awal = bawaan meski belum ada preset tersimpan. */
  const [lebar, setLebar] = useState<LebarToolbar>({ ...LEBAR_BAWAHAN_TOOLBAR });
  /** Lebar filter halaman tersimpan (kunci → px), untuk daftar + gabung simpan. */
  const [lebarFilterSimpan, setLebarFilterSimpan] = useState<Record<string, number>>({});
  /** Isian lebar filter (string; kosong = hapus override → bawaan halaman). */
  const [filterW, setFilterW] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  /** Ada baris preset tersimpan (untuk status tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);
  const laporKotor = useBagian('kontrol', () => void simpan());
  useAksiBagian('kontrol', {
    label: 'Kembalikan ke bawaan tabel',
    onClick: () => void kembalikan(),
    disabled: !bolehUbah || busy || !adaSimpanan,
  });
  /** Setelan terakhir yang sama dengan isi server (acuan deteksi kotor).
   *  Diisi nilai bawaan sejak awal supaya tab tidak sempat dianggap kotor
   *  sebelum permintaan muat selesai. */
  const acuanRef = useRef(JSON.stringify({
    vis: { info: true, urut: true, kolom: true, filter: true },
    lebar: { ...LEBAR_BAWAHAN_TOOLBAR },
    filterW: {},
  }));

  const muat = useCallback(async () => {
    try {
      const res = await muatToolbarPreset(tableKey);
      const visBaru = bacaVisToolbar(res.data.visibilitas);
      const lebarBaru = bacaLebarToolbar(res.data.lebar);
      const tersimpan = bacaLebarFilter(res.data.lebar);
      const filterWBaru = Object.fromEntries(Object.entries(tersimpan).map(([k, v]) => [k, String(v)]));
      setVis(visBaru);
      setLebar(lebarBaru);
      setLebarFilterSimpan(tersimpan);
      setFilterW(filterWBaru);
      setAdaSimpanan(
        Object.keys(res.data.visibilitas ?? {}).length > 0
        || Object.keys(res.data.lebar ?? {}).length > 0
        || (res.data.urutan?.length ?? 0) > 0,
      );
      acuanRef.current = JSON.stringify({ vis: visBaru, lebar: lebarBaru, filterW: filterWBaru });
    } catch {
      const visBawaan = { info: true, urut: true, kolom: true, filter: true };
      const lebarBawaan = { ...LEBAR_BAWAHAN_TOOLBAR };
      setVis(visBawaan);
      setLebar(lebarBawaan);
      setLebarFilterSimpan({});
      setFilterW({});
      setAdaSimpanan(false);
      acuanRef.current = JSON.stringify({ vis: visBawaan, lebar: lebarBawaan, filterW: {} });
    }
  }, [tableKey]);

  /** Filter halaman tabel ini: terdaftar dari FilterField + kunci tersimpan.
   *  Kunci bawaan toolbar (Urutkan/Kolom) selalu dilewati — pertahanan lapis
   *  kedua bila ada sisa setelan lama tersimpan. */
  const daftar = useMemo(() => {
    const gabung = new Map(daftarFilter(tableKey).map((f) => [f.kunci, f]));
    for (const kunci of Object.keys(lebarFilterSimpan)) {
      if (kunciFilterBawaan(kunci)) continue;
      if (!gabung.has(kunci)) gabung.set(kunci, { kunci, label: kunci.replace(/_/g, ' ') });
    }
    return [...gabung.values()].filter((f) => !kunciFilterBawaan(f.kunci));
  }, [tableKey, lebarFilterSimpan]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    laporKotor(JSON.stringify({ vis, lebar, filterW }) !== acuanRef.current);
  }, [vis, lebar, filterW, laporKotor]);

  function kabariBerubah() {
    window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
  }

  /** Jepit ke rentang valid backend (40–480 px). */
  function jepit(n: number): number {
    return Math.min(480, Math.max(40, Math.round(n)));
  }

  function ubahLebar(kunci: KontrolLebar, mentah: string) {
    const n = parseInt(mentah, 10);
    if (Number.isNaN(n)) return;
    setLebar((v) => ({ ...v, [kunci]: n }));
  }

  async function simpan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const lebarKirim: Record<string, number> = {
        urut: jepit(lebar.urut),
        kolom: jepit(lebar.kolom),
      };
      const bersihFilter: Record<string, string> = {};
      for (const [k, s] of Object.entries(filterW)) {
        if (s.trim() === '') continue;
        const n = parseInt(s, 10);
        if (Number.isNaN(n)) continue;
        lebarKirim[`filter.${k}`] = jepit(n);
        bersihFilter[k] = String(jepit(n));
      }
      const res = await simpanToolbarPreset(tableKey, { ...vis }, lebarKirim);
      setLebar((v) => ({ urut: jepit(v.urut), kolom: jepit(v.kolom) }));
      setFilterW(bersihFilter);
      await muat();
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const res = await hapusToolbarPreset(tableKey);
      // Muat ulang agar acuan kotor ikut kembali ke bawaan (bukan nilai lama).
      await muat();
      laporKotor(false);
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {!bolehUbah ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Hanya super_admin yang dapat mengubah visibilitas kontrol.
        </p>
      ) : null}
      <div className="flex flex-col gap-1 rounded-md border p-1">
        {KONTROL_TOOLBAR.map(({ kunci, label, ket, lebar: punyaLebar }) => (
          <div
            key={kunci}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
            onClick={() => {
              if (!bolehUbah || busy) return;
              setVis((v) => ({ ...v, [kunci]: !v[kunci] }));
            }}
          >
            <Checkbox
              id={`chk_toolbar_${tableKey}_${kunci}`}
              checked={vis[kunci]}
              disabled={!bolehUbah || busy}
              aria-label={`Tampilkan kontrol ${label}`}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(c) => setVis((v) => ({ ...v, [kunci]: !!c }))}
            />
            <span
              className="min-w-0 flex-1 truncate text-xs"
              title={kunci === 'filter' ? `${label} — ${PERINGATAN_FILTER_HALAMAN}` : ket}
            >
              {label}
            </span>
            {punyaLebar ? (
              <span className="flex shrink-0 items-center gap-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <Input
                  id={`input_lebar_toolbar_${tableKey}_${kunci}`}
                  type="number"
                  min={40}
                  max={480}
                  step={4}
                  value={lebar[kunci as KontrolLebar]}
                  disabled={!bolehUbah || busy}
                  onChange={(e) => ubahLebar(kunci as KontrolLebar, e.target.value)}
                  onBlur={(e) => setLebar((v) => ({ ...v, [kunci]: jepit(Number(e.target.value) || v[kunci as KontrolLebar]) }))}
                  aria-label={`Lebar ${label} (px)`}
                  title={`Lebar ${label} dalam px (40–480)`}
                  className="h-6 w-16 text-right text-xs"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {daftar.length > 0 ? (
        <>
          <p className="text-xs font-semibold">Lebar combobox filter halaman</p>
          <div className="flex flex-col gap-1 rounded-md border p-1">
            {daftar.map(({ kunci, label, bawaanPx }) => (
              <div
                key={kunci}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1 truncate text-xs" title={kunci}>
                  {labelKolom(label) || labelKolom(kunci)}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Input
                    id={`input_lebar_filter_${tableKey}_${kunci}`}
                    type="number"
                    min={40}
                    max={480}
                    step={4}
                    value={filterW[kunci] ?? String(bawaanPx ?? LEBAR_BAWAHAN_FILTER)}
                    placeholder={String(LEBAR_BAWAHAN_FILTER)}
                    disabled={!bolehUbah || busy}
                    onChange={(e) => setFilterW((v) => ({ ...v, [kunci]: e.target.value }))}
                    onBlur={(e) => {
                      const s = e.target.value.trim();
                      if (s === '') {
                        setFilterW((v) => {
                          const next = { ...v };
                          delete next[kunci];
                          return next;
                        });
                        return;
                      }
                      const n = parseInt(s, 10);
                      if (!Number.isNaN(n)) setFilterW((v) => ({ ...v, [kunci]: String(jepit(n)) }));
                    }}
                    aria-label={`Lebar filter ${label} (px)`}
                    title={`Lebar filter ${label} dalam px (40–480); kosongkan untuk bawaan halaman`}
                    className="h-6 w-16 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
