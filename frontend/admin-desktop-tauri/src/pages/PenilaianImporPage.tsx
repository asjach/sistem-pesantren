import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ImportBertahapUmumDialog, { type KonfigurasiImportBertahap } from '@/components/ImportBertahapUmumDialog';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  batalPotongPenilaian, daftarKomponen, daftarPeristiwa, potongImportPenilaian,
  unduhGalatPenilaian, unduhTemplatePenilaian,
  type KomponenNilai, type PeristiwaNilai, type TipeImpor,
} from '@/api/penilaian';

interface KartuImpor {
  tipe: TipeImpor;
  judul: string;
  deskripsi: string;
  kolom: string[];
  wajib: string[];
  /** Template nilai & ekskul menerima kolom dinamis (mapel / ekskul{n}). */
  kolomDinamis?: boolean;
  /** Perlu peristiwa penilaian (hanya template nilai). */
  butuhPeristiwa?: boolean;
}

const KARTU: KartuImpor[] = [
  {
    tipe: 'nilai',
    judul: 'Nilai / Leger',
    deskripsi: 'Satu baris per santri; kolom tetap + kolom mata pelajaran. Pilih PERISTIWA (ASAS/ASAT/UJIAN/UAP) dan komponen bila mengisi skor komponen, atau biarkan "Nilai akhir peristiwa" untuk mengisi langsung nilai akhir (menimpa hasil hitungan).',
    kolom: ['nis_lokal', 'nama', 'jenjang', 'kelas', 'tahun_ajaran', 'semester'],
    wajib: ['nis_lokal', 'kelas'],
    kolomDinamis: true,
    butuhPeristiwa: true,
  },
  {
    tipe: 'catatan_wali',
    judul: 'Catatan Wali',
    deskripsi: 'Ketidakhadiran (sakit/izin/alpa), catatan wali, dan status kenaikan per santri. Sekaligus sumber halaman 2 rapor.',
    kolom: ['nis_lokal', 'nama', 'kelas', 'sakit', 'izin', 'alpa', 'catatan', 'status_kenaikan'],
    wajib: ['nis_lokal', 'kelas'],
  },
  {
    tipe: 'prestasi',
    judul: 'Prestasi',
    deskripsi: 'Hanya santri berprestasi; satu baris per prestasi (santri boleh beberapa baris).',
    kolom: ['nis_lokal', 'nama', 'kelas', 'prestasi', 'level', 'keterangan'],
    wajib: ['nis_lokal', 'prestasi'],
  },
  {
    tipe: 'ekskul',
    judul: 'Ekstrakurikuler',
    deskripsi: 'Hanya peserta; pasangan kolom ekskul1/predikat1, ekskul2/predikat2, … Pembimbing diambil dari master ekstrakurikuler.',
    kolom: ['nis_lokal', 'nama', 'kelas'],
    wajib: ['nis_lokal'],
    kolomDinamis: true,
  },
];

/** Halaman Impor Nilai: empat template terpisah, nilai terikat PERISTIWA. */
export default function PenilaianImporPage() {
  const { jenjangs, tahunAjaranNames, semesters, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'penilaian.tambah');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && ta !== null && semester !== null;

  const [peristiwa, setPeristiwa] = useState<PeristiwaNilai[]>([]);
  const [peristiwaId, setPeristiwaId] = useState<number | ''>('');
  const [komponen, setKomponen] = useState<KomponenNilai[]>([]);
  const [komponenId, setKomponenId] = useState<number | ''>('');
  const [dialog, setDialog] = useState<TipeImpor | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (jenjang === null || ta === null) { setPeristiwa([]); setPeristiwaId(''); return; }
    let hidup = true;
    daftarPeristiwa({ jenjang, tahun_ajaran: ta })
      .then((r) => {
        if (!hidup) return;
        setPeristiwa(r.peristiwa);
        setPeristiwaId((v) => (r.peristiwa.some((p) => p.id === v) ? v : (r.peristiwa[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) { setPeristiwa([]); setPeristiwaId(''); setErr(errorMessage(e)); } });
    return () => { hidup = false; };
  }, [jenjang, ta]);

  useEffect(() => {
    if (peristiwaId === '') { setKomponen([]); setKomponenId(''); return; }
    let hidup = true;
    daftarKomponen(peristiwaId)
      .then((r) => { if (hidup) setKomponen(r.komponen.filter((k) => k.is_active)); })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [peristiwaId]);

  const konfig = useCallback((kartu: KartuImpor): KonfigurasiImportBertahap => ({
    judul: `Impor ${kartu.judul}`,
    deskripsi: kartu.deskripsi,
    idPrefix: `penilaian_${kartu.tipe}`,
    kolom: kartu.kolom,
    kolomDariFile: kartu.kolomDinamis ? (kepala) => kepala.filter((k) => k !== '') : undefined,
    wajib: kartu.wajib,
    labelTemplate: 'Unduh template Excel',
    unduhTemplate: () => unduhTemplatePenilaian(kartu.tipe, {
      jenjang: jenjang!, tahun_ajaran: ta!,
      ...(kartu.butuhPeristiwa && peristiwaId !== '' ? { peristiwa_id: Number(peristiwaId) } : {}),
    }),
    kirim: ({ sesi_id, mode, total, baris, terakhir }) => potongImportPenilaian({
      ...(sesi_id !== undefined ? { sesi_id } : {}),
      mode, total, baris,
      tipe: kartu.tipe,
      tahun_ajaran: ta!,
      semester: semester!,
      jenjang: [jenjang!],
      peristiwa_id: kartu.butuhPeristiwa && peristiwaId !== '' ? Number(peristiwaId) : null,
      komponen_id: kartu.tipe === 'nilai' ? (komponenId === '' ? null : Number(komponenId)) : null,
      ...(terakhir ? { terakhir } : {}),
    }),
    batal: (sesiId) => batalPotongPenilaian(sesiId),
    unduhGalat: (sesiId) => unduhGalatPenilaian(sesiId),
    konteksSiap: siap && (!kartu.butuhPeristiwa || peristiwaId !== ''),
    onSelesai: () => toast.success('Impor selesai. Muat ulang leger untuk melihat hasilnya.'),
  }), [jenjang, ta, semester, peristiwaId, komponenId, siap]);

  const kartuAktif = useMemo(() => KARTU.find((k) => k.tipe === dialog) ?? null, [dialog]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
          {siap ? (
            <>
              Lingkup impor: <strong>{jenjang}</strong> · TA <strong>{ta}</strong> · semester <strong>{semester}</strong>.
              Ubah lewat filter di atas.
            </>
          ) : (
            <>Pilih satu jenjang, satu tahun ajaran, dan satu semester pada filter di atas untuk mengaktifkan impor.</>
          )}
          <label className="ml-auto flex items-center gap-2" htmlFor="select_peristiwa_impor">
            <span>Peristiwa</span>
            <select
              id="select_peristiwa_impor"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={peristiwaId === '' ? '' : String(peristiwaId)}
              onChange={(e) => { setPeristiwaId(e.target.value === '' ? '' : Number(e.target.value)); setKomponenId(''); }}
            >
              <option value="">— pilih peristiwa —</option>
              {peristiwa.map((p) => <option key={p.id} value={p.id}>{p.kode} — {p.nama}</option>)}
            </select>
          </label>
          {!filterLoading && !canTambah && (
            <span className="w-full text-destructive">Anda tidak punya izin menambah data penilaian.</span>
          )}
          {siap && peristiwa.length === 0 && (
            <span className="w-full text-destructive">Belum ada peristiwa — muat bawaan di halaman Master Penilaian.</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {KARTU.map((k) => (
            <Card key={k.tipe} className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-sm">{k.judul}</CardTitle>
                <CardDescription className="text-xs">{k.deskripsi}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {k.tipe === 'nilai' && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Komponen (kosong = nilai akhir peristiwa)</span>
                    <select
                      id="penilaian_impor_komponen"
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
                      value={komponenId === '' ? '' : String(komponenId)}
                      onChange={(e) => setKomponenId(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">Nilai akhir peristiwa (impor langsung)</option>
                      {komponen.map((km) => (
                        <option key={km.id} value={km.id}>
                          {km.nama} (bobot {km.bobot}{km.sumber === 'rapor_otomatis' ? ', otomatis rapor' : ''})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  type="button"
                  variant="outline"
                  id={`btn_buka_impor_${k.tipe}`}
                  disabled={!siap || !canTambah || (k.butuhPeristiwa === true && peristiwaId === '')}
                  onClick={() => setDialog(k.tipe)}
                >
                  Buka impor {k.judul}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {kartuAktif !== null && (
        <ImportBertahapUmumDialog
          open={dialog !== null}
          onOpenChange={(o) => { if (!o) setDialog(null); }}
          config={konfig(kartuAktif)}
        />
      )}
    </div>
  );
}
