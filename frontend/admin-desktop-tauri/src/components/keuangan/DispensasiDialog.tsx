import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatDispensasi, ubahDispensasi,
  type Dispensasi, type DispensasiInput, type JenisTagihan, type TipeDispensasi,
} from '../../api/keuangan';
import { listKelas, type TahunAjaran } from '../../api/master';
import { listSantri, type Santri } from '../../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MultiSelect from '@/components/MultiSelect';
import { X } from '@/icons';

const OPSI_PAKET = ['MI', 'MD', 'MI-MD', 'MTS', 'MLN'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Dispensasi | null;
  jenis: JenisTagihan[];
  daftarTA: TahunAjaran[];
  /** Prefill santri tambahan saat membuka dari profil santri (mode tambah). */
  santriAwal?: { id: number; nama_lengkap: string } | null;
  /** Prefill TA saat membuka dari halaman Keuangan (mengikuti filter topbar). */
  taBawaan?: string | null;
  onSaved: () => void | Promise<void>;
}

/** Form tambah/ubah dispensasi: target kriteria akademik (paket/tingkat/kelas)
 *  atau tambahan santri individual; tipe potongan persen/nominal/bebas. */
export default function DispensasiDialog({ open, onOpenChange, editing, jenis, daftarTA, santriAwal = null, taBawaan = null, onSaved }: Props) {
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [ta, setTa] = useState('');
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [paket, setPaket] = useState<string[]>([]);
  const [tingkat, setTingkat] = useState<string[]>([]);
  const [kelasIds, setKelasIds] = useState<string[]>([]);
  const [tipe, setTipe] = useState<TipeDispensasi>('nominal');
  const [nilai, setNilai] = useState('');
  const [prioritas, setPrioritas] = useState('0');
  const [aktif, setAktif] = useState(true);

  const [santriPilih, setSantriPilih] = useState<{ id: number; nama: string }[]>([]);
  const [cariSantri, setCariSantri] = useState('');
  const [hasilSantri, setHasilSantri] = useState<Santri[]>([]);
  const [kelas, setKelas] = useState<{ id: number; jenjang: string; nama_kelas: string; tingkat: string | null }[]>([]);
  const [busy, setBusy] = useState(false);

  // Buka dialog: isi dari data ubah atau kosongkan.
  useEffect(() => {
    if (!open) return;
    setCariSantri(''); setHasilSantri([]);
    if (editing) {
      setNama(editing.nama); setKeterangan(editing.keterangan ?? ''); setTa(editing.tahun_ajaran);
      setJenisId(editing.jenis_id ?? ''); setPaket(editing.paket ?? []); setTingkat(editing.tingkat ?? []);
      setKelasIds((editing.kelas_id ?? []).map(String)); setTipe(editing.tipe); setNilai(String(editing.nilai));
      setPrioritas(String(editing.prioritas)); setAktif(editing.is_active);
      setSantriPilih((editing.santri_ids ?? []).map((id) => ({ id, nama: `Santri #${id}` })));
    } else {
      const bawaan = taBawaan !== null && daftarTA.some((x) => x.nama === taBawaan)
        ? taBawaan
        : (daftarTA.find((x) => x.is_aktif)?.nama ?? daftarTA[0]?.nama ?? '');
      setNama(''); setKeterangan(''); setTa(bawaan);
      setJenisId(''); setPaket([]); setTingkat([]); setKelasIds([]);
      setTipe('nominal'); setNilai(''); setPrioritas('0'); setAktif(true);
      setSantriPilih(santriAwal ? [{ id: santriAwal.id, nama: santriAwal.nama_lengkap }] : []);
    }
  }, [open, editing, daftarTA, santriAwal, taBawaan]);

  // Opsi tingkat/kelas mengikuti TA terpilih.
  useEffect(() => {
    if (!open || ta === '') { setKelas([]); return; }
    let hidup = true;
    void (async () => {
      try {
        const res = await listKelas({ tahun_ajaran: ta, per_page: 500 });
        if (hidup) setKelas(res.data.map((k) => ({ id: k.id, jenjang: k.jenjang, nama_kelas: k.nama_kelas, tingkat: k.tingkat })));
      } catch { if (hidup) setKelas([]); }
    })();
    return () => { hidup = false; };
  }, [open, ta]);

  // Pencarian santri tambahan (debounce).
  useEffect(() => {
    if (!open || cariSantri.trim().length < 2) { setHasilSantri([]); return; }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await listSantri({ q: cariSantri.trim(), per_page: 10 });
          setHasilSantri(res.data);
        } catch { setHasilSantri([]); }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [open, cariSantri]);

  const opsiTingkat = useMemo(() => {
    const unik = [...new Set(kelas.map((k) => k.tingkat).filter((t): t is string => t !== null && t !== ''))];
    return unik.sort().map((t) => ({ value: t, label: `Tingkat ${t}` }));
  }, [kelas]);

  const opsiKelas = useMemo(
    () => kelas.map((k) => ({ value: String(k.id), label: `${k.jenjang} ${k.nama_kelas}` })),
    [kelas],
  );

  const simpan = async () => {
    if (nama.trim() === '') { toast.error('Isi nama dispensasi.'); return; }
    if (ta === '') { toast.error('Pilih tahun ajaran.'); return; }
    const angka = Number(nilai);
    if (!Number.isInteger(angka) || angka < 0) { toast.error('Nilai potongan tidak valid.'); return; }
    if (tipe === 'persen' && angka > 100) { toast.error('Nilai persen maksimal 100.'); return; }

    const payload: DispensasiInput = {
      nama: nama.trim(),
      keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
      tahun_ajaran: ta,
      jenis_id: jenisId === '' ? null : Number(jenisId),
      paket: paket.length > 0 ? paket : null,
      tingkat: tingkat.length > 0 ? tingkat : null,
      kelas_id: kelasIds.length > 0 ? kelasIds.map(Number) : null,
      santri_ids: santriPilih.length > 0 ? santriPilih.map((s) => s.id) : null,
      tipe, nilai: angka, prioritas: Number(prioritas) || 0, is_active: aktif,
    };

    setBusy(true);
    try {
      if (editing) await ubahDispensasi(editing.id, payload);
      else await buatDispensasi(payload);
      toast.success(editing ? 'Dispensasi tersimpan.' : 'Dispensasi dibuat.');
      onOpenChange(false);
      await onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Ubah Dispensasi' : 'Tambah Dispensasi'}</DialogTitle>
          <DialogDescription className="sr-only">Formulir dispensasi (keringanan) tagihan.</DialogDescription>
        </DialogHeader>
        <form id="form_dispensasi" className="grid grid-cols-[max-content_1fr_max-content_1fr] items-center gap-x-3 gap-y-3" onSubmit={(e) => { e.preventDefault(); void simpan(); }}>
          <FieldLabel htmlFor="inp_dispensasi_nama">Nama</FieldLabel>
          <Input id="inp_dispensasi_nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Anak Pegawai" required />
          <FieldLabel htmlFor="sel_dispensasi_ta">Tahun Ajaran</FieldLabel>
          <select id="sel_dispensasi_ta" className="h-8 rounded border px-2 text-xs" value={ta} onChange={(e) => setTa(e.target.value)} required>
            {daftarTA.map((x) => <option key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
          </select>

          <FieldLabel htmlFor="sel_dispensasi_jenis">Jenis Tagihan</FieldLabel>
          <select id="sel_dispensasi_jenis" className="h-8 rounded border px-2 text-xs" value={jenisId} onChange={(e) => setJenisId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Semua jenis</option>
            {jenis.map((j) => <option key={j.id} value={j.id}>{j.nama}{j.jenjang ? ` (${j.jenjang})` : ''}</option>)}
          </select>
          <FieldLabel htmlFor="inp_dispensasi_prioritas">Prioritas</FieldLabel>
          <Input id="inp_dispensasi_prioritas" type="number" value={prioritas} onChange={(e) => setPrioritas(e.target.value)} title="Urutan penerapan akumulatif (kecil dulu)" />

          <FieldLabel htmlFor="ms_dispensasi_paket">Paket</FieldLabel>
          <MultiSelect id="ms_dispensasi_paket" options={OPSI_PAKET.map((p) => ({ value: p, label: p }))} values={paket} onChange={setPaket} placeholder="Semua paket" title="Paket sasaran (kosong = semua paket)" />
          <FieldLabel htmlFor="ms_dispensasi_tingkat">Tingkat</FieldLabel>
          <MultiSelect id="ms_dispensasi_tingkat" options={opsiTingkat} values={tingkat} onChange={setTingkat} placeholder="Semua tingkat" title="Tingkat sasaran (kosong = semua tingkat)" />

          <FieldLabel htmlFor="ms_dispensasi_kelas">Kelas</FieldLabel>
          <MultiSelect id="ms_dispensasi_kelas" options={opsiKelas} values={kelasIds} onChange={setKelasIds} placeholder="Semua kelas" title="Kelas sasaran (kosong = semua kelas)" />
          <FieldLabel htmlFor="sel_dispensasi_tipe">Tipe</FieldLabel>
          <div className="flex items-center gap-2">
            <select id="sel_dispensasi_tipe" className="h-8 rounded border px-2 text-xs" value={tipe} onChange={(e) => setTipe(e.target.value as TipeDispensasi)}>
              <option value="nominal">Nominal (Rp)</option>
              <option value="persen">Persen (%)</option>
              <option value="bebas">Bebas penuh</option>
            </select>
            <Input id="inp_dispensasi_nilai" type="number" min={0} className="w-28" value={nilai} onChange={(e) => setNilai(e.target.value)} disabled={tipe === 'bebas'} required={tipe !== 'bebas'} />
            <label htmlFor="chk_dispensasi_aktif" className="ml-auto flex items-center gap-1 text-xs">
              <input id="chk_dispensasi_aktif" type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} /> Aktif
            </label>
          </div>

          <FieldLabel htmlFor="inp_dispensasi_santri">Santri Tambahan</FieldLabel>
          <div className="col-span-3 flex flex-col gap-1">
            <Input id="inp_dispensasi_santri" placeholder="Cari nama/NIS santri (min. 2 huruf)…" value={cariSantri} onChange={(e) => setCariSantri(e.target.value)} />
            {hasilSantri.length > 0 && (
              <div className="max-h-32 overflow-auto rounded border">
                {hasilSantri.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    id={`btn_dispensasi_tambah_santri_${s.id}`}
                    className="block w-full px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-40"
                    disabled={santriPilih.some((x) => x.id === s.id)}
                    onClick={() => setSantriPilih((lama) => [...lama, { id: s.id, nama: s.nama_lengkap }])}
                  >
                    {s.nama_lengkap}
                  </button>
                ))}
              </div>
            )}
            {santriPilih.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {santriPilih.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                    {s.nama}
                    <button type="button" aria-label={`Hapus ${s.nama}`} id={`btn_dispensasi_hapus_santri_${s.id}`} onClick={() => setSantriPilih((lama) => lama.filter((x) => x.id !== s.id))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <FieldLabel htmlFor="inp_dispensasi_keterangan">Keterangan</FieldLabel>
          <Input id="inp_dispensasi_keterangan" className="col-span-3" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Opsional" />
          <p className="col-span-4 text-xs text-muted-foreground">
            Kriteria yang diisi harus cocok semua; kosongkan semuanya untuk berlaku semua santri (khusus super_admin). Santri tambahan menang langsung tanpa melihat kriteria. Tipe bebas penuh → tagihan tetap dibuat bernominal 0.
          </p>

          <DialogFooter className="col-span-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_dispensasi_simpan" type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
