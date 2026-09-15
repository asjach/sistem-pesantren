import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  deletePengaturanTampilan,
  getPengaturanTampilan,
  putPengaturanTampilan,
  type TampilanData,
  type TampilanRespon,
} from '@/api/tampilan';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RibbonSlot } from '@/components/RibbonSlot';
import { RibbonCmd, RibbonGroup } from '@/components/topbar/primitives';
import { useGridPrefs } from '@/components/GridPrefs';
import { useLembagaAktif } from '@/lembagaAktif';
import { useStandarTampilan } from '@/standarTampilan';
import { useTheme } from '@/theme';
import { RotateCcw, Save } from '@/icons';
import { toast } from 'sonner';

/**
 * Pengaturan → Tampilan Standar (super_admin & admin lembaga): jadikan
 * tampilan yang sedang aktif sebagai standar lembaga, lalu sebarkan ke
 * lembaga yang dipilih. Preferensi pribadi user tetap boleh menimpanya.
 */
export default function PengaturanTampilanStandarPage() {
  const { theme, mode, warnaUI, iconSet, density, parts } = useTheme();
  const { rowH, headerH, align } = useGridPrefs();
  const { tampilan: standar, versi, muatUlang } = useStandarTampilan();
  const { pilihan, adaSemua, lembagaId } = useLembagaAktif();

  const [semua, setSemua] = useState(false);
  const [target, setTarget] = useState<number[]>([]);
  const [sertakanGaya, setSertakanGaya] = useState(true);
  const [info, setInfo] = useState<TampilanRespon | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (adaSemua) {
      setTarget(lembagaId != null ? [lembagaId] : []);
    } else {
      setTarget(pilihan.map((p) => p.id));
    }
  }, [adaSemua, lembagaId, pilihan]);

  const muat = useCallback(async () => {
    if (lembagaId == null) {
      setInfo(null);
      return;
    }
    try {
      const res = await getPengaturanTampilan(lembagaId);
      setInfo(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [lembagaId]);

  useEffect(() => { void muat(); }, [muat]);

  const adaStandarAktif = standar !== null;

  const ringkas = useMemo(() => {
    const baris: [string, string][] = [
      ['Tema', theme],
      ['Mode', mode],
      ['Kaya warna', warnaUI],
      ['Set ikon', iconSet],
      ['Kerapatan', density],
      ['Tinggi baris', rowH != null ? `${rowH}px` : 'bawaan'],
      ['Tinggi header', headerH != null ? `${headerH}px` : 'bawaan'],
      ['Perataan kolom', `${Object.keys(align).length} kolom disetel`],
    ];
    return baris;
  }, [theme, mode, warnaUI, iconSet, density, rowH, headerH, align]);

  function togolTarget(id: number, aktif: boolean) {
    setTarget((prev) => (aktif ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  async function kirim() {
    setErr('');
    if (!semua && target.length === 0) {
      setErr('Pilih minimal satu lembaga tujuan.');
      return;
    }
    setBusy(true);
    try {
      const data: TampilanData = {
        tema: { theme, mode, warnaUI, iconSet, density },
        ...(sertakanGaya ? { parts: parts as unknown as TampilanData['parts'] } : {}),
        grid: { rowH, headerH, align },
      };
      const res = await putPengaturanTampilan({
        lembaga_ids: semua ? 'semua' : target,
        sumber_lembaga_id: lembagaId,
        data,
      });
      toast.success(res.pesan);
      muatUlang();
      await muat();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    if (lembagaId == null) {
      setErr('Pilih lembaga aktif dulu untuk mengembalikan ke bawaan.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await deletePengaturanTampilan(lembagaId);
      toast.success(res.pesan);
      muatUlang();
      await muat();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <RibbonSlot label="Tampilan Standar">
        <RibbonGroup label="Standar">
          <RibbonCmd
            id="btn_simpan_standar_tampilan"
            icon={Save}
            label="Jadikan standar"
            onClick={() => void kirim()}
          />
          <RibbonCmd
            id="btn_kembalikan_standar_tampilan"
            icon={RotateCcw}
            label="Kembalikan bawaan"
            onClick={() => void kembalikan()}
          />
        </RibbonGroup>
      </RibbonSlot>

      {err && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Standar aktif</h2>
          {adaStandarAktif ? (
            <Badge variant="secondary">versi {versi}</Badge>
          ) : (
            <Badge variant="outline">belum diatur</Badge>
          )}
        </div>
        <p id="info_standar_tampilan" className="text-sm text-muted-foreground">
          {info?.tampilan
            ? <>Diubah oleh <b className="text-foreground">{info.diubah_oleh ?? '—'}</b>
              {info.diperbarui ? ` · ${new Date(info.diperbarui).toLocaleString('id-ID')}` : ''}</>
            : 'Lembaga aktif belum punya standar tampilan (memakai bawaan aplikasi).'}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Tampilan yang akan dijadikan standar</h2>
        <p className="text-sm text-muted-foreground">
          Nilai diambil dari tampilan Anda saat ini. Atur dulu di halaman <b>Tampilan</b> bila perlu.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
          {ringkas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            id="chk_standar_sertakan_gaya"
            checked={sertakanGaya}
            onCheckedChange={(v) => setSertakanGaya(v === true)}
          />
          Sertakan gaya bagian (font, ukuran, warna, border tiap komponen)
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Terapkan ke lembaga</h2>
        {adaSemua && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id="chk_standar_semua_lembaga"
              checked={semua}
              onCheckedChange={(v) => setSemua(v === true)}
            />
            Semua lembaga
          </label>
        )}
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {pilihan.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`chk_standar_lembaga_${l.id}`}
                checked={semua || target.includes(l.id)}
                disabled={semua}
                onCheckedChange={(v) => togolTarget(l.id, v === true)}
              />
              <span className="truncate">{l.kode ? `${l.kode} — ${l.nama}` : l.nama}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button id="btn_terapkan_standar_tampilan" disabled={busy} onClick={() => void kirim()}>
            {busy ? 'Menyimpan…' : 'Terapkan standar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Catatan: preset kolom aktif, lebar, dan kolom beku per tabel belum ikut disebar dari halaman ini
          (menyusul).
        </p>
      </section>
    </div>
  );
}
