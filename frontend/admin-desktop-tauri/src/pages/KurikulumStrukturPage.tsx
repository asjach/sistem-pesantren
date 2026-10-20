import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Button } from '@/components/ui/button';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  daftarStrukturKurikulum, daftarVarianJadwal, simpanStrukturKurikulum,
  type StrukturKurikulumData, type StrukturMapel, type StrukturVarianOpsi,
} from '@/api/kurikulum';

/**
 * Struktur Kurikulum (REFERENSI) PER VARIAN jadwal: baris = mapel aktif
 * jenjang, kolom = tingkat, isi = JP per minggu HASIL HITUNG dari snapshot
 * varian terpilih. Varian dipilih lewat combobox — termasuk yang tidak aktif.
 * JP per tahun = JP/minggu × minggu efektif (minggu efektif per jenjang + TA).
 *
 * Tabel baca-saja; tidak mengunci atau memvalidasi jadwal pelajaran.
 */
export default function KurikulumStrukturPage() {
  const { jenjangs, tahunAjaranNames } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'kurikulum.ubah');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [opsi, setOpsi] = useState<StrukturVarianOpsi[] | null>(null);
  const [varianId, setVarianId] = useState<number | null>(null);
  const [data, setData] = useState<StrukturKurikulumData | null>(null);
  const [minggu, setMinggu] = useState(36);
  const [sel, setSel] = useState<Map<string, number>>(new Map());
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState('');

  /** Varian yang sedang dimuat — mencegah hasil varian lama menimpa varian baru. */
  const varianRef = useRef<number | null>(null);

  const kunci = (mapelId: number, tingkat: string): string => `${mapelId}|${tingkat}`;

  const terapkan = useCallback((r: StrukturKurikulumData) => {
    setData(r);
    setMinggu(r.minggu_efektif);
    setOpsi(r.varian_opsi);

    const peta = new Map(r.sel.map((s) => [`${s.mata_pelajaran_id}|${s.tingkat}`, s.jp_per_minggu] as const));

    setSel(peta);
  }, []);

  /** Muat daftar varian (semua status) untuk combobox, lalu pilih yang aktif. */
  useEffect(() => {
    let hidup = true;

    setData(null);
    setVarianId(null);
    varianRef.current = null;
    setErr('');

    if (jenjang === null || ta === null) {
      setOpsi([]);
      return () => { hidup = false; };
    }

    setOpsi(null);
    daftarVarianJadwal(jenjang, ta)
      .then((r) => {
        if (!hidup) return;

        setOpsi(r.varian.map((v) => ({
          id: v.id, nama: v.nama, is_active: v.is_active, dibuat_pada: v.dibuat_pada,
        })));

        const aktif = r.varian.find((v) => v.is_active) ?? r.varian[0];
        setVarianId(aktif?.id ?? null);
      })
      .catch((e) => {
        if (!hidup) return;
        setOpsi([]);
        setErr(errorMessage(e));
      });

    return () => { hidup = false; };
  }, [jenjang, ta]);

  /** Muat struktur varian terpilih (nilai JP dihitung server dari snapshot). */
  useEffect(() => {
    let hidup = true;

    if (varianId === null) {
      setData(null);
      return () => { hidup = false; };
    }

    varianRef.current = varianId;
    setData(null);
    setMemuat(true);

    daftarStrukturKurikulum(varianId)
      .then((r) => {
        if (!hidup || varianRef.current !== varianId) return;
        terapkan(r);
        setErr('');
      })
      .catch((e) => {
        if (!hidup || varianRef.current !== varianId) return;
        setErr(errorMessage(e));
      })
      .finally(() => {
        if (hidup && varianRef.current === varianId) setMemuat(false);
      });

    return () => { hidup = false; };
  }, [varianId, terapkan]);

  async function simpanMinggu() {
    if (data === null) return;

    setSibuk(true);

    try {
      terapkan(await simpanStrukturKurikulum({
        varian_id: data.varian.id,
        minggu_efektif: minggu,
      }));
      toast.success('Minggu efektif disimpan.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  const fields = useMemo<ExcelField[]>(() => {
    if (data === null) return [];

    return [
      { key: 'nama_mapel', label: 'Mata Pelajaran', kind: 'static', width: 250 },
      ...data.tingkat.map((t) => ({
        key: `jp_${t}`,
        label: `Tingkat ${t} (JP/minggu)`,
        kind: 'static' as const,
        width: 120,
        format: 'angka' as const,
      })),
    ];
  }, [data]);

  const getValues = useCallback((row: StrukturMapel): Record<string, string | null> => {
    const hasil: Record<string, string | null> = { nama_mapel: row.nama_mapel };

    for (const t of data?.tingkat ?? []) {
      const n = sel.get(kunci(row.id, t)) ?? 0;
      hasil[`jp_${t}`] = n === 0 ? '' : String(n);
    }

    return hasil;
  }, [data, sel]);

  const totalPerTingkat = useMemo(() => {
    const peta = new Map<string, number>();

    for (const t of data?.tingkat ?? []) {
      let n = 0;
      for (const m of data?.mapel ?? []) n += sel.get(`${m.id}|${t}`) ?? 0;
      peta.set(t, n);
    }

    return peta;
  }, [data, sel]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">
          Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.
        </p>
      </div>
    );
  }

  const kosong = opsi !== null && opsi.length === 0;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <div className="flex flex-wrap items-center gap-3 px-3 pb-2 text-[11px] sm:px-6">
        <label className="flex items-center gap-1.5" htmlFor="select_varian_struktur">
          <span className="text-muted-foreground">Varian jadwal</span>
          <select
            id="select_varian_struktur"
            value={varianId ?? ''}
            disabled={opsi === null || opsi.length === 0}
            onChange={(e) => setVarianId(Number(e.target.value) || null)}
            className="h-8 min-w-44 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {opsi === null ? <option value="">Memuat…</option> : null}
            {(opsi ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nama}{v.is_active ? ' (Aktif)' : ''}
              </option>
            ))}
          </select>
        </label>

        {data !== null ? (
          <span
            className="border px-2 py-0.5"
            style={{ borderColor: 'var(--divider)' }}
            title="Struktur mengikuti varian, bukan status aktif varian"
          >
            {data.varian.is_active ? 'Varian aktif' : 'Varian tidak aktif'}
          </span>
        ) : null}

        <p className="text-muted-foreground">
          {jenjang} · {ta} · JP per minggu per mapel × tingkat (referensi, tidak mengunci jadwal).
        </p>

        {data !== null
          ? data.tingkat.map((t) => {
            const total = totalPerTingkat.get(t) ?? 0;

            return (
              <span
                key={t}
                className="border px-2 py-0.5"
                style={{ borderColor: 'var(--divider)' }}
              >
                Tingkat {t}: <b>{total}</b> JP/minggu · <b>{total * minggu}</b> JP/tahun
              </span>
            );
          })
          : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-6">
        {kosong ? (
          <p className="border border-dashed p-4 text-xs text-muted-foreground" style={{ borderColor: 'var(--divider)' }}>
            Belum ada varian jadwal untuk {jenjang} · {ta}. Struktur kurikulum mengikuti varian —
            buat varian dulu di halaman <b>Jadwal Pelajaran → Varian</b>.
          </p>
        ) : (
          <ExcelTable<StrukturMapel>
            tableKey="kurikulum_struktur"
            header={data === null ? 'Struktur Kurikulum' : `Struktur Kurikulum · ${data.varian.nama}`}
            fields={fields}
            rows={data?.mapel ?? []}
            getValues={getValues}
            loading={memuat}
            emptyText="Belum ada mapel aktif untuk jenjang ini."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
            hideActions
            akhirToolbar={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs" htmlFor="input_minggu_efektif">
                  Minggu efektif
                  <input
                    id="input_minggu_efektif"
                    type="number"
                    min={1}
                    max={60}
                    value={minggu}
                    disabled={!canUbah || sibuk || data === null}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                      setMinggu(n);
                    }}
                    className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                </label>
                {canUbah ? (
                  <Button
                    id="btn_simpan_struktur"
                    type="button"
                    size="sm"
                    disabled={sibuk || memuat || data === null}
                    onClick={() => void simpanMinggu()}
                  >
                    Simpan
                  </Button>
                ) : null}
              </div>
            }
          />
        )}

        {data?.catatan !== undefined ? (
          <p className="pt-2 text-[11px] text-muted-foreground">{data.catatan}</p>
        ) : null}
      </div>
    </div>
  );
}
