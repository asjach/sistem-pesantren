import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { listAset, type AsetDokumen } from '@/api/asetDokumen';
import { listSantri, type Santri } from '@/api/santri';
import { listPegawai, type Pegawai } from '@/api/pegawai';
import { ambilKatalogNilai, ambilTemplate, isiTemplate } from '@/api/templateDokumen';
import { listKelas, type Kelas } from '@/api/master';
import { ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboCari from '@/components/ComboCari';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';
import { useSemesterAktif } from '@/semesterAktif';
import { normalisasiDefinisi } from '@/lib/template/medan';
import type { KatalogNilai, TemplateLengkap } from '@/lib/template/tipe';
import { ChevronLeft, Download, FileCheck2 } from '@/icons';

const SEMUA = '__semua__';

export default function TemplateIsiPage() {
  const { id } = useParams();
  const templateId = Number(id);
  const navigate = useNavigate();

  const { jenjang } = useLembagaAktif();
  const { tahunAjaranNama, pilihan: pilihanTa } = useTahunAjaranAktif();
  const { semester } = useSemesterAktif();

  const [template, setTemplate] = useState<TemplateLengkap | null>(null);
  const [katalog, setKatalog] = useState<KatalogNilai | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const [idSantri, setIdSantri] = useState<number | null>(null);
  const [idPegawai, setIdPegawai] = useState<number | null>(null);
  const [kelasId, setKelasId] = useState<number | null>(null);
  const [tahunAjaran, setTahunAjaran] = useState<string>('');
  const [kodeSemester, setKodeSemester] = useState<string>('1');
  const [tetap, setTetap] = useState<{ teks: string; tanggal: string }>({ teks: '', tanggal: '' });
  const [tanggalAbsen, setTanggalAbsen] = useState(() => new Date().toISOString().slice(0, 10));

  const [sibuk, setSibuk] = useState(false);
  const [pratinjau, setPratinjau] = useState<{ url: string; nama: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [aset, setAset] = useState<AsetDokumen[]>([]);

  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const [t, k] = await Promise.all([ambilTemplate(templateId), ambilKatalogNilai()]);
        if (batal) return;
        setTemplate(t);
        setKatalog(k);
      } catch (e) {
        if (!batal) setGalat(errorMessage(e));
      }
    })();

    return () => {
      batal = true;
    };
  }, [templateId]);

  // Siklus academic mengikuti pilihan global, dapat ditimpa di halaman ini.
  useEffect(() => {
    if (tahunAjaranNama) {
      setTahunAjaran(tahunAjaranNama);
    }
  }, [tahunAjaranNama]);

  useEffect(() => {
    if (semester) {
      setKodeSemester(semester);
    }
  }, [semester]);

  /** Muat pilihan data sesuai sumber yang benar-benar dipakai template. */
  const dipakai = useMemo(() => {
    const hasil = new Set<string>();
    for (const m of template?.definisi?.medan ?? []) {
      if (m.sumber) hasil.add(m.sumber);
      if (m.baris_berulang?.sumber) hasil.add(m.baris_berulang.sumber);
      for (const k of m.baris_berulang?.kolom ?? []) {
        if (k.sumber) hasil.add(k.sumber);
      }
    }
    return hasil;
  }, [template]);

  const perlu = useCallback(
    (sumber: string) => dipakai.has(sumber),
    [dipakai],
  );

  /**
   * Hanya template PDF eksternal yang butuh berkas diunggah lebih dulu.
   * Template HTML digambar sendiri di desainer, jadi tidak punya berkas sama
   * sekali. Menyambutnya sebagai belum siap akan membuat tombol cetak tidak
   * bisa dipakai.
   */
  const perluBerkas = template?.jenis === 'pdf' && !template?.punya_berkas;

  useEffect(() => {
    let batal = false;
    const cakupan = { jenjang: jenjang ?? undefined };

    (async () => {
      try {
        const pekerjaan: Promise<unknown>[] = [];

        if (perlu('santri') || perlu('keluarga_santri') || perlu('penempatan_santri')) {
          pekerjaan.push(
            listSantri({ ...cakupan, is_active_pst: true, per_page: 100 }).then((r) => {
              if (!batal) setSantriList(r.data);
            }),
          );
        }

        if (perlu('pegawai') || perlu('penempatan_pegawai')) {
          pekerjaan.push(
            listPegawai({ ...cakupan, per_page: 100 }).then((r) => {
              if (!batal) setPegawaiList(r.data);
            }),
          );
        }

        if (perlu('daftar_santri_kelas')) {
          pekerjaan.push(
            listKelas({ ...cakupan, tahun_ajaran: tahunAjaran || undefined, per_page: 100 }).then((r) => {
              if (!batal) setKelasList(r.data);
            }),
          );
        }

        await Promise.all(pekerjaan);

        if (!batal) {
          setAset((await listAset({ per_page: 50 })).data);
        }
      } catch (e) {
        if (!batal) setGalat(errorMessage(e));
      }
    })();

    return () => {
      batal = true;
    };
  }, [jenjang, perlu, tahunAjaran]);

  /** Lepaskan objek URL pratinjau lama supaya tidak bocor di memori. */
  const gantiPratinjau = useCallback((berikut: { url: string; nama: string } | null) => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = berikut?.url ?? null;
    setPratinjau(berikut);
  }, []);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const buat = useCallback(async () => {
    setSibuk(true);
    try {
      gantiPratinjau(
        await isiTemplate(templateId, {
          id_santri: idSantri,
          id_pegawai: idPegawai,
          kelas_id: kelasId,
          tahun_ajaran: tahunAjaran || null,
          semester: kodeSemester === '2' ? '2' : '1',
          tanggal_absen: tanggalAbsen || null,
          tetap: { teks: tetap.teks, tanggal: tetap.tanggal || undefined },
        }),
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }, [gantiPratinjau, idPegawai, idSantri, kelasId, kodeSemester, tanggalAbsen, tahunAjaran, templateId, tetap]);

  const unduh = useCallback(() => {
    if (!pratinjau) {
      return;
    }
    const a = document.createElement('a');
    a.href = pratinjau.url;
    a.download = pratinjau.nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [pratinjau]);

  const dipakaiTetap = perlu('tetap');
  const dipakaiSistem = perlu('sistem');
  const dipakaiTanggalAbsen = dipakai.has('daftar_santri_kelas');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {galat && <ErrorNotice>{galat}</ErrorNotice>}

      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button id="btn_kembali_dari_isi" variant="ghost" onClick={() => navigate(`/template-dokumen/${templateId}/medan`)}>
          <ChevronLeft size={16} /> Susun medan
        </Button>
        <p className="text-sm font-medium">{template?.nama ?? 'Memuat template...'}</p>
        <p className="text-xs text-muted-foreground">
          {template ? `${template.jumlah_halaman} halaman, ${normalisasiDefinisi(template.definisi).medan.length} medan` : ''}
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 space-y-3 overflow-y-auto border-r border-border p-3">
          {perlu('santri') || perlu('keluarga_santri') || perlu('penempatan_santri') ? (
            <div>
              <FieldLabel htmlFor="select_santri_isi">Santri</FieldLabel>
              <Select value={idSantri === null ? '' : String(idSantri)} onValueChange={(v) => setIdSantri(Number(v))}>
                <SelectTrigger id="select_santri_isi" aria-label="Pilih Santri" className="w-full">
                  <SelectValue placeholder="Pilih Santri" />
                </SelectTrigger>
                <SelectContent>
                  {santriList.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {perlu('pegawai') || perlu('penempatan_pegawai') ? (
            <div>
              <FieldLabel htmlFor="select_pegawai_isi">Pegawai</FieldLabel>
              <Select value={idPegawai === null ? '' : String(idPegawai)} onValueChange={(v) => setIdPegawai(Number(v))}>
                <SelectTrigger id="select_pegawai_isi" aria-label="Pilih pegawai" className="w-full">
                  <SelectValue placeholder="Pilih pegawai" />
                </SelectTrigger>
                <SelectContent>
                  {pegawaiList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {perlu('daftar_santri_kelas') && (
            <div>
              <FieldLabel htmlFor="select_kelas_isi">Kelas</FieldLabel>
              <Select value={kelasId === null ? '' : String(kelasId)} onValueChange={(v) => setKelasId(Number(v))}>
                <SelectTrigger id="select_kelas_isi" aria-label="Pilih kelas" className="w-full">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {dipakaiTanggalAbsen && (
            <div>
              <FieldLabel htmlFor="input_tanggal_absen_isi">Tanggal kehadiran</FieldLabel>
              <Input
                id="input_tanggal_absen_isi"
                type="date"
                value={tanggalAbsen}
                onChange={(e) => setTanggalAbsen(e.target.value)}
              />
              <FieldDescription>Kolom Hadir pada daftar mengikuti catatan presensi tanggal ini.</FieldDescription>
            </div>
          )}

          <Separator />

          <div>
            <FieldLabel htmlFor="select_tahun_ajaran_isi">Tahun ajaran</FieldLabel>
            <Select value={tahunAjaran} onValueChange={setTahunAjaran}>
              <SelectTrigger id="select_tahun_ajaran_isi" aria-label="Tahun ajaran" className="w-full">
                <SelectValue placeholder="Pilih tahun ajaran" />
              </SelectTrigger>
              <SelectContent>
                {pilihanTa.map((t) => (
                  <SelectItem key={t.nama} value={t.nama}>
                    {t.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel htmlFor="select_semester_isi">Semester</FieldLabel>
            <Select value={kodeSemester} onValueChange={setKodeSemester}>
              <SelectTrigger id="select_semester_isi" aria-label="Semester" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Ganjil</SelectItem>
                <SelectItem value="2">Genap</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dipakaiTetap && (
            <>
              <Separator />
              <div>
                <FieldLabel htmlFor="input_tetap_teks_isi">Nilai tetap (teks)</FieldLabel>
                <Input
                  id="input_tetap_teks_isi"
                  value={tetap.teks}
                  onChange={(e) => setTetap((t) => ({ ...t, teks: e.target.value }))}
                  placeholder="Nomor: 123/MTS/2026"
                />
              </div>
              <div>
                <FieldLabel htmlFor="input_tetap_tanggal_isi">Nilai tetap (tanggal)</FieldLabel>
                <Input
                  id="input_tetap_tanggal_isi"
                  type="date"
                  value={tetap.tanggal}
                  onChange={(e) => setTetap((t) => ({ ...t, tanggal: e.target.value }))}
                />
              </div>
            </>
          )}

          {dipakaiSistem && (
            <FieldDescription>
              Medan dari sumber Sistem memakai tanggal hari ini dan nama pengguna yang sedang masuk.
            </FieldDescription>
          )}

          {aset.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {aset.length} aset tersedia di pustaka untuk medan gambar.
            </p>
          )}

          <Separator />

          <Button id="btn_buat_pdf_isi" className="w-full" onClick={buat} disabled={sibuk || perluBerkas}>
            <FileCheck2 size={16} /> {sibuk ? 'Menyusun...' : 'Buat PDF'}
          </Button>

          {perluBerkas && (
            <FieldDescription>Template ini belum memiliki berkas PDF. Unggah berkas pada halaman susun medan.</FieldDescription>
          )}

          {pratinjau && (
            <Button id="btn_unduh_pdf_isi" variant="outline" className="w-full" onClick={unduh}>
              <Download size={16} /> Unduh {pratinjau.nama}
            </Button>
          )}
        </aside>

        <main className="min-w-0 flex-1 bg-muted/30">
          {pratinjau ? (
            <object
              data={pratinjau.url}
              type="application/pdf"
              className="h-full w-full"
              aria-label="Pratinjau dokumen"
            >
              <p className="p-4 text-sm text-muted-foreground">
                Peramban ini tidak dapat menampilkan PDF. Gunakan tombol Unduh.
              </p>
            </object>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Pilih data di kiri lalu tekan Buat PDF untuk melihat hasilnya di sini.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
