import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import {
  listKelas,
  listTahunAjaran,
  referensiList,
  type Kelas,
  type ReferensiRow,
  type TahunAjaran,
} from '../../api/master';
import {
  lulusSantri,
  mutasiSantri,
  naikKelasMassal,
  pindahKelas,
  salinGenapMassal,
  setKelas,
  type RiwayatRow,
} from '../../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

const FORM_GRID = 'grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4';
const hariIni = () => new Date().toISOString().slice(0, 10);

interface DasarDialog {
  onClose: () => void;
  onDone: () => void;
}

/** Tingkat berikut (angka + 1); non-angka dikembalikan apa adanya. */
function tingkatBerikut(tingkat: string | null): string {
  const n = Number((tingkat ?? '').trim());
  if ((tingkat ?? '').trim() === '' || !Number.isFinite(n)) return tingkat ?? '';
  return String(n + 1);
}

function DialogBungkus({ judul, deskripsi, onClose, children }: {
  judul: string;
  deskripsi: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription className="sr-only">{deskripsi}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Tetapkan (baris kelas null) / pindah kelas untuk satu atau beberapa baris riwayat aktif. */
export function DialogKelas({ rows, onClose, onDone }: DasarDialog & { rows: RiwayatRow[] }) {
  const kepala = rows[0];
  const modeSet = rows.every((r) => r.kelas_id === null);
  const [kelasId, setKelasId] = useState('');
  const [opsi, setOpsi] = useState<Kelas[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let batal = false;
    listKelas({ lembaga_id: kepala.lembaga_id, tahun_ajaran_id: kepala.tahun_ajaran_id, per_page: 500 })
      .then((p) => { if (!batal) setOpsi(p.data); })
      .catch((e) => { if (!batal) setErr(errorMessage(e)); });
    return () => { batal = true; };
  }, [kepala.lembaga_id, kepala.tahun_ajaran_id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!kelasId) return;
    setBusy(true);
    setErr('');
    const gagal: string[] = [];
    for (const r of rows) {
      try {
        if (modeSet) await setKelas(r.id, Number(kelasId));
        else await pindahKelas(r.id, Number(kelasId));
      } catch (e2) {
        gagal.push(`${r.santri?.nama_lengkap ?? `#${r.santri_id}`}: ${errorMessage(e2)}`);
      }
    }
    setBusy(false);
    if (gagal.length) {
      setErr(gagal.join(' · '));
      return;
    }
    toast.success(modeSet ? `${rows.length} santri ditempatkan ke kelas.` : `${rows.length} santri dipindah kelas.`);
    onDone();
  }

  return (
    <DialogBungkus
      judul={modeSet ? 'Tetapkan kelas' : 'Pindah kelas'}
      deskripsi="Formulir penempatan kelas riwayat belajar."
      onClose={onClose}
    >
      <form className={FORM_GRID} onSubmit={onSubmit}>
        <ErrorNotice>{err}</ErrorNotice>
        <p className="col-span-2 text-sm text-muted-foreground">
          {rows.length === 1
            ? (rows[0].santri?.nama_lengkap ?? `Santri #${rows[0].santri_id}`)
            : `${rows.length} santri terpilih`}
          {' · '}{kepala.lembaga?.kode ?? kepala.lembaga?.nama} · {kepala.tahun_ajaran?.nama ?? ''}
        </p>
        <FieldLabel htmlFor="select_kelas_siklus">Kelas</FieldLabel>
        <Select value={kelasId} onValueChange={setKelasId}>
          <SelectTrigger id="select_kelas_siklus" className="w-full">
            <SelectValue placeholder="Pilih kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {opsi.map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  {k.nama_kelas}{k.tingkat ? ` (tingkat ${k.tingkat})` : ''}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button id="btn_simpan_kelas_siklus" type="submit" disabled={busy || !kelasId}>
            {modeSet ? 'Tetapkan' : 'Pindah'}
          </Button>
        </DialogFooter>
      </form>
    </DialogBungkus>
  );
}

/** Salin ganjil→genap: `rows` null = semua baris ganjil aktif di lembaga. */
export function DialogSalinGenap({ lembagaId, rows, onClose, onDone }: DasarDialog & {
  lembagaId: number;
  rows: RiwayatRow[] | null;
}) {
  const [tanggal, setTanggal] = useState(hariIni());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await salinGenapMassal({
        lembaga_id: lembagaId,
        tanggal_masuk: tanggal,
        siswa: rows ? rows.map((r) => ({ santri_id: r.santri_id })) : undefined,
      });
      if (res.gagal.length) {
        setErr(`Berhasil ${res.berhasil}. Gagal: ` + res.gagal
          .map((g) => `${g.santri_id ? `#${g.santri_id}` : ''} ${g.pesan}`.trim())
          .join(' · '));
        setBusy(false);
        return;
      }
      toast.success(`Salin ke genap selesai: ${res.berhasil} baris.`);
      onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <DialogBungkus
      judul="Salin ganjil → genap"
      deskripsi="Menyalin baris riwayat semester 1 aktif menjadi baris semester 2."
      onClose={onClose}
    >
      <form className={FORM_GRID} onSubmit={onSubmit}>
        <ErrorNotice>{err}</ErrorNotice>
        <p className="col-span-2 text-sm text-muted-foreground">
          {rows ? `${rows.length} santri terpilih disalin.` : 'Semua baris ganjil (semester 1) aktif di lembaga ini disalin.'}
        </p>
        <FieldLabel htmlFor="input_tgl_masuk_genap">Tanggal masuk genap</FieldLabel>
        <Input
          id="input_tgl_masuk_genap"
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          required
        />
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button id="btn_simpan_salin_genap" type="submit" disabled={busy || !tanggal}>Salin</Button>
        </DialogFooter>
      </form>
    </DialogBungkus>
  );
}

/** Kenaikan massal: satu batch = satu lembaga + satu tahun baru + satu tingkat. */
export function DialogNaikKelas({ lembagaId, rows, onClose, onDone }: DasarDialog & {
  lembagaId: number;
  rows: RiwayatRow[];
}) {
  const [status, setStatus] = useState<'naik' | 'tidak_naik'>('naik');
  const [taId, setTaId] = useState('');
  const [tingkat, setTingkat] = useState(() => tingkatBerikut(rows[0]?.tingkat ?? null));
  const [tglMasuk, setTglMasuk] = useState('');
  const [absen, setAbsen] = useState('');
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let batal = false;
    listTahunAjaran({ lembaga_id: lembagaId, per_page: 100 })
      .then((p) => { if (!batal) setTas(p.data); })
      .catch((e) => { if (!batal) setErr(errorMessage(e)); });
    return () => { batal = true; };
  }, [lembagaId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await naikKelasMassal({
        lembaga_id: lembagaId,
        tahun_ajaran_baru_id: Number(taId),
        tingkat,
        siswa: rows.map((r) => ({
          santri_id: r.santri_id,
          status,
          ...(tglMasuk ? { tgl_masuk: tglMasuk } : {}),
          ...(rows.length === 1 && absen ? { no_absen: Number(absen) } : {}),
        })),
      });
      if (res.gagal.length) {
        setErr(`Berhasil ${res.berhasil}. Gagal: ` + res.gagal
          .map((g) => `${g.santri_id ? `#${g.santri_id}` : ''} ${g.pesan}`.trim())
          .join(' · '));
        setBusy(false);
        return;
      }
      toast.success(`Proses kenaikan selesai: ${res.berhasil} santri.`);
      onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <DialogBungkus
      judul="Proses kenaikan kelas"
      deskripsi="Menutup baris genap aktif dan membuka baris ganjil tahun ajaran baru."
      onClose={onClose}
    >
      <form className={FORM_GRID} onSubmit={onSubmit}>
        <ErrorNotice>{err}</ErrorNotice>
        <p className="col-span-2 text-sm text-muted-foreground">{rows.length} santri · kelas tujuan menyusul (penempatan).</p>
        <FieldLabel htmlFor="select_status_naik">Hasil</FieldLabel>
        <Select value={status} onValueChange={(v) => setStatus(v as 'naik' | 'tidak_naik')}>
          <SelectTrigger id="select_status_naik" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="naik">Naik kelas</SelectItem>
              <SelectItem value="tidak_naik">Tidak naik (mengulang)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="select_ta_baru_siklus">Tahun ajaran baru</FieldLabel>
        <Select value={taId} onValueChange={setTaId}>
          <SelectTrigger id="select_ta_baru_siklus" className="w-full">
            <SelectValue placeholder="Pilih tahun ajaran" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="input_tingkat_siklus">Tingkat baru</FieldLabel>
        <Input id="input_tingkat_siklus" value={tingkat} onChange={(e) => setTingkat(e.target.value)} required maxLength={20} />
        <FieldLabel htmlFor="input_tgl_masuk_siklus">Tgl masuk</FieldLabel>
        <Input id="input_tgl_masuk_siklus" type="date" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} />
        {rows.length === 1 && (
          <>
            <FieldLabel htmlFor="input_absen_siklus">No. absen</FieldLabel>
            <Input id="input_absen_siklus" type="number" min={1} value={absen} onChange={(e) => setAbsen(e.target.value)} />
          </>
        )}
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button id="btn_simpan_naik_siklus" type="submit" disabled={busy || !taId || !tingkat.trim()}>Proses</Button>
        </DialogFooter>
      </form>
    </DialogBungkus>
  );
}

/** Mutasi keluar per lembaga. */
export function DialogMutasi({ row, onClose, onDone }: DasarDialog & { row: RiwayatRow }) {
  const [kelasId, setKelasId] = useState(row.kelas_id ? String(row.kelas_id) : '');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [alasan, setAlasan] = useState<ReferensiRow[]>([]);
  const [tanggal, setTanggal] = useState(hariIni());
  const [kodeAlasan, setKodeAlasan] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [npsn, setNpsn] = useState('');
  const [nsm, setNsm] = useState('');
  const [alamat, setAlamat] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let batal = false;
    listKelas({ lembaga_id: row.lembaga_id, per_page: 500 })
      .then((p) => { if (!batal) setKelasOpsi(p.data); })
      .catch((e) => { if (!batal) setErr(errorMessage(e)); });
    referensiList('alasan_mutasi', row.lembaga_id)
      .then((r) => { if (!batal) setAlasan(r); })
      .catch(() => {});
    return () => { batal = true; };
  }, [row.lembaga_id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await mutasiSantri(row.santri_id, {
        lembaga_id: row.lembaga_id,
        kelas_terakhir_id: Number(kelasId),
        tanggal_mutasi: tanggal,
        alasan_mutasi: kodeAlasan,
        ...(noSurat.trim() ? { no_surat: noSurat.trim() } : {}),
        ...(tujuan.trim() ? { nama_sekolah_tujuan: tujuan.trim() } : {}),
        ...(npsn.trim() ? { npsn_sekolah_tujuan: npsn.trim() } : {}),
        ...(nsm.trim() ? { nsm_sekolah_tujuan: nsm.trim() } : {}),
        ...(alamat.trim() ? { alamat_sekolah_tujuan: alamat.trim() } : {}),
        ...(keterangan.trim() ? { keterangan: keterangan.trim() } : {}),
      });
      toast.success('Santri dimutasi keluar.');
      onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <DialogBungkus
      judul="Mutasi keluar"
      deskripsi="Formulir mutasi keluar per lembaga."
      onClose={onClose}
    >
      <form className={FORM_GRID} onSubmit={onSubmit}>
        <ErrorNotice>{err}</ErrorNotice>
        <p className="col-span-2 text-sm text-muted-foreground">
          {row.santri?.nama_lengkap ?? `Santri #${row.santri_id}`} · {row.lembaga?.kode ?? row.lembaga?.nama}
        </p>
        <FieldLabel htmlFor="select_kelas_terakhir_mutasi">Kelas terakhir</FieldLabel>
        <Select value={kelasId} onValueChange={setKelasId}>
          <SelectTrigger id="select_kelas_terakhir_mutasi" className="w-full">
            <SelectValue placeholder="Pilih kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {kelasOpsi.map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  {k.nama_kelas}{(k.tahun_ajaran ?? k.tahunAjaran) ? ` · ${(k.tahun_ajaran ?? k.tahunAjaran)?.nama}` : ''}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="input_tgl_mutasi">Tanggal mutasi</FieldLabel>
        <Input id="input_tgl_mutasi" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        <FieldLabel htmlFor="select_alasan_mutasi">Alasan</FieldLabel>
        <Select value={kodeAlasan} onValueChange={setKodeAlasan}>
          <SelectTrigger id="select_alasan_mutasi" className="w-full">
            <SelectValue placeholder="Pilih alasan" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {alasan.map((a) => <SelectItem key={a.id} value={a.nama ?? a.kode ?? ''}>{a.nama ?? a.kode}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="input_no_surat_mutasi">No. surat</FieldLabel>
        <Input id="input_no_surat_mutasi" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} maxLength={50} />
        <FieldLabel htmlFor="input_tujuan_mutasi">Sekolah tujuan</FieldLabel>
        <Input id="input_tujuan_mutasi" value={tujuan} onChange={(e) => setTujuan(e.target.value)} maxLength={255} />
        <FieldLabel htmlFor="input_npsn_mutasi">NPSN tujuan</FieldLabel>
        <Input id="input_npsn_mutasi" value={npsn} onChange={(e) => setNpsn(e.target.value)} maxLength={20} />
        <FieldLabel htmlFor="input_nsm_mutasi">NSM tujuan</FieldLabel>
        <Input id="input_nsm_mutasi" value={nsm} onChange={(e) => setNsm(e.target.value)} maxLength={30} />
        <FieldLabel htmlFor="input_alamat_mutasi">Alamat tujuan</FieldLabel>
        <Input id="input_alamat_mutasi" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
        <FieldLabel htmlFor="input_keterangan_mutasi">Keterangan</FieldLabel>
        <Input id="input_keterangan_mutasi" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button id="btn_simpan_mutasi_siklus" type="submit" disabled={busy || !kelasId || !tanggal || !kodeAlasan}>
            Mutasi
          </Button>
        </DialogFooter>
      </form>
    </DialogBungkus>
  );
}

/** Lulus / tidak lulus per lembaga. */
export function DialogLulus({ row, onClose, onDone }: DasarDialog & { row: RiwayatRow }) {
  const [hasil, setHasil] = useState<'lulus' | 'tidak_lulus'>('lulus');
  const [taId, setTaId] = useState('');
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [tanggal, setTanggal] = useState(hariIni());
  const [noIjazah, setNoIjazah] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [kegiatan, setKegiatan] = useState('');
  const [penyerahan, setPenyerahan] = useState('belum');
  const [melanjutkan, setMelanjutkan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let batal = false;
    listTahunAjaran({ lembaga_id: row.lembaga_id, per_page: 100 })
      .then((p) => { if (!batal) setTas(p.data); })
      .catch((e) => { if (!batal) setErr(errorMessage(e)); });
    return () => { batal = true; };
  }, [row.lembaga_id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await lulusSantri(row.santri_id, {
        lembaga_id: row.lembaga_id,
        tahun_ajaran_lulus_id: Number(taId),
        tanggal_lulus: tanggal,
        hasil,
        ...(noIjazah.trim() ? { nomor_ijazah: noIjazah.trim() } : {}),
        ...(noSurat.trim() ? { no_surat_ijazah: noSurat.trim() } : {}),
        ...(kegiatan.trim() ? { kegiatan_setelah_lulus: kegiatan.trim() } : {}),
        ...(hasil === 'lulus' ? { penyerahan_ijazah: penyerahan as 'sudah' | 'belum' } : {}),
        ...(melanjutkan ? { melanjutkan: melanjutkan as 'ya' | 'tidak' } : {}),
      });
      toast.success(hasil === 'lulus' ? 'Santri lulus & masuk alumni.' : 'Santri tidak lulus; baris mengulang dibuka.');
      onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <DialogBungkus
      judul="Kelulusan"
      deskripsi="Formulir proses lulus / tidak lulus per lembaga."
      onClose={onClose}
    >
      <form className={FORM_GRID} onSubmit={onSubmit}>
        <ErrorNotice>{err}</ErrorNotice>
        <p className="col-span-2 text-sm text-muted-foreground">
          {row.santri?.nama_lengkap ?? `Santri #${row.santri_id}`} · {row.lembaga?.kode ?? row.lembaga?.nama}
        </p>
        <FieldLabel htmlFor="select_hasil_lulus">Hasil</FieldLabel>
        <Select value={hasil} onValueChange={(v) => setHasil(v as 'lulus' | 'tidak_lulus')}>
          <SelectTrigger id="select_hasil_lulus" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="lulus">Lulus</SelectItem>
              <SelectItem value="tidak_lulus">Tidak lulus (mengulang)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="select_ta_lulus">Tahun lulus</FieldLabel>
        <Select value={taId} onValueChange={setTaId}>
          <SelectTrigger id="select_ta_lulus" className="w-full">
            <SelectValue placeholder="Pilih tahun ajaran" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldLabel htmlFor="input_tgl_lulus">Tanggal lulus</FieldLabel>
        <Input id="input_tgl_lulus" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        {hasil === 'lulus' && (
          <>
            <FieldLabel htmlFor="input_no_ijazah">No. ijazah</FieldLabel>
            <Input id="input_no_ijazah" value={noIjazah} onChange={(e) => setNoIjazah(e.target.value)} required />
            <FieldLabel htmlFor="input_no_surat_ijazah">No. surat ijazah</FieldLabel>
            <Input id="input_no_surat_ijazah" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} maxLength={50} />
            <FieldLabel htmlFor="select_penyerahan_ijazah">Penyerahan ijazah</FieldLabel>
            <Select value={penyerahan} onValueChange={setPenyerahan}>
              <SelectTrigger id="select_penyerahan_ijazah" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="belum">Belum</SelectItem>
                  <SelectItem value="sudah">Sudah</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </>
        )}
        <FieldLabel htmlFor="input_kegiatan_lulus">Kegiatan setelah lulus</FieldLabel>
        <Input id="input_kegiatan_lulus" value={kegiatan} onChange={(e) => setKegiatan(e.target.value)} />
        <FieldLabel htmlFor="select_melanjutkan">Melanjutkan</FieldLabel>
        <Select value={melanjutkan === '' ? '_kosong' : melanjutkan} onValueChange={(v) => setMelanjutkan(v === '_kosong' ? '' : v)}>
          <SelectTrigger id="select_melanjutkan" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="_kosong">—</SelectItem>
              <SelectItem value="ya">Ya</SelectItem>
              <SelectItem value="tidak">Tidak</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button
            id="btn_simpan_lulus_siklus"
            type="submit"
            disabled={busy || !taId || !tanggal || (hasil === 'lulus' && !noIjazah.trim())}
          >
            Proses
          </Button>
        </DialogFooter>
      </form>
    </DialogBungkus>
  );
}
