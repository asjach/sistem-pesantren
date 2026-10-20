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
  daftarStrukturKurikulum, simpanStrukturKurikulum,
  type StrukturKurikulumData, type StrukturMapel,
} from '@/api/kurikulum';

/**
 * Struktur Kurikulum (REFERENSI): baris = mapel aktif jenjang, kolom = tingkat,
 * isi = JP per minggu. JP per tahun = JP/minggu × minggu efektif.
 *
 * Tabel memakai komponen bersama `ExcelTable` (mode Ubah + auto-save sel).
 * Tidak mengunci atau memvalidasi jadwal pelajaran.
 */
export default function KurikulumStrukturPage() {
  const { jenjangs, tahunAjaranNames } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'kurikulum.ubah');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [data, setData] = useState<StrukturKurikulumData | null>(null);
  const [minggu, setMinggu] = useState(36);
  const [sel, setSel] = useState<Map<string, number>>(new Map());
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState('');

  /** Cermin nilai terbaru: antrean auto-save bisa berjalan sebelum render ulang. */
  const selRef = useRef<Map<string, number>>(new Map());
  const mingguRef = useRef(36);

  const kunci = (mapelId: number, tingkat: string): string => `${mapelId}|${tingkat}`;

  const terapkan = useCallback((r: StrukturKurikulumData) => {
    setData(r);
    setMinggu(r.minggu_efektif);
    mingguRef.current = r.minggu_efektif;
    const peta = new Map(r.sel.map((s) => [`${s.mata_pelajaran_id}|${s.tingkat}`, s.jp_per_minggu] as const));
    selRef.current = peta;
    setSel(peta);
  }, []);

  const muat = useCallback(async () => {
    if (jenjang === null || ta === null) {
      setData(null);
      setMemuat(false);
      return;
    }
    setMemuat(true);
    try {
      terapkan(await daftarStrukturKurikulum(jenjang, ta));
      setErr('');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setMemuat(false);
    }
  }, [jenjang, ta, terapkan]);

  useEffect(() => { void muat(); }, [muat]);

  /** Simpan seluruh matriks (dipakai auto-save sel dan tombol Simpan). */
  const simpanSel = useCallback(async (peta: Map<string, number>, mingguEfektif: number) => {
    if (data === null) return;
    const r = await simpanStrukturKurikulum({
      jenjang: data.jenjang,
      tahun_ajaran: data.tahun_ajaran,
      minggu_efektif: mingguEfektif,
      sel: [...peta.entries()].map(([k, v]) => {
        const [mid, tk] = k.split('|');
        return { mata_pelajaran_id: Number(mid), tingkat: tk, jp_per_minggu: v };
      }),
    });
    terapkan(r);
  }, [data, terapkan]);

  /** Auto-save satu sel dari ExcelTable: gabungkan dengan nilai lain lalu simpan. */
  const onCommit = useCallback(async (id: number, values: Record<string, string | null>) => {
    const next = new Map(selRef.current);
    for (const [key, raw] of Object.entries(values)) {
      if (!key.startsWith('jp_')) continue;
      const tk = key.slice(3);
      const n = Math.max(0, Math.min(60, Number(raw) || 0));
      const k = kunci(id, tk);
      if (n === 0) next.delete(k);
      else next.set(k, n);
    }
    selRef.current = next;
    setSel(next);
    await simpanSel(next, mingguRef.current);
  }, [simpanSel]);

  async function simpanMinggu() {
    setSibuk(true);
    try {
      await simpanSel(selRef.current, minggu);
      toast.success('Struktur kurikulum disimpan.');
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
        kind: 'text' as const,
        width: 120,
        format: 'angka' as const,
        validate: (v: string | null): string | null => {
          if (v === null || v.trim() === '') return null;
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0 || n > 60) return 'JP harus berupa angka 0–60.';
          return null;
        },
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

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-[11px] sm:px-6">
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
        <ExcelTable<StrukturMapel>
          tableKey="kurikulum_struktur"
          header={`Struktur Kurikulum · ${jenjang}`}
          fields={fields}
          rows={data?.mapel ?? []}
          getValues={getValues}
          loading={memuat}
          emptyText="Belum ada mapel aktif untuk jenjang ini."
          canEdit={canUbah}
          onCommit={onCommit}
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
                  disabled={!canUbah || sibuk}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                    setMinggu(n);
                    mingguRef.current = n;
                  }}
                  className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-xs"
                />
              </label>
              {canUbah ? (
                <Button
                  id="btn_simpan_struktur"
                  type="button"
                  size="sm"
                  disabled={sibuk || memuat}
                  onClick={() => void simpanMinggu()}
                >
                  Simpan
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
