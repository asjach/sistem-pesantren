import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatDispensasi, ubahDispensasi,
  type Dispensasi, type DispensasiInput, type JenisTagihan, type TipeDispensasi,
} from '../../api/keuangan';
import { type TahunAjaran } from '../../api/master';
import { listSantri, type Santri } from '../../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ActionIcon } from '@/components/RowActions';
import Pager from '@/components/Pager';
import { ArrowRight, X } from '@/icons';
import { type PerPage } from '@/prefs';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';

interface BarisAturan {
  jenisId: number;
  tipe: TipeDispensasi;
  nilai: string;
}

const FIELDS_ATURAN: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static' },
  {
    key: 'tipe', label: 'Tipe', kind: 'select', width: 130,
    choices: [
      { value: 'nominal', label: 'Nominal (Rp)' },
      { value: 'persen', label: 'Persen (%)' },
      { value: 'bebas', label: 'Bebas penuh' },
    ],
  },
  {
    key: 'nilai', label: 'Nilai', kind: 'text', width: 110,
    validate: (v) => v !== null && /^\d+$/.test(v) ? null : 'Isi angka ≥ 0.',
  },
];

const FIELDS_SANTRI_AKTIF: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'nis_lokal', label: 'NIS Lokal', kind: 'static', width: 110 },
  { key: 'ayah', label: 'Ayah', kind: 'static', width: 140 },
  { key: 'ibu', label: 'Ibu', kind: 'static', width: 140 },
];

const FIELDS_SANTRI_PENERIMA: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'nis_lokal', label: 'NIS Lokal', kind: 'static', width: 110 },
  { key: 'ayah', label: 'Ayah', kind: 'static', width: 140 },
  { key: 'ibu', label: 'Ibu', kind: 'static', width: 140 },
];

interface Penerima {
  id: number;
  nama: string;
  nisLokal: string | null;
  ayah: string | null;
  ibu: string | null;
}

/** NIS lokal tampil: gabungan unik keanggotaan aktif (tanpa duplikat). */
function nisLokalTampil(s: Santri): string | null {
  const daftar = [...new Set((s.lembaga_aktif ?? []).map((l) => l.nis_lokal).filter((n): n is string => n !== null && n !== ''))];
  return daftar.length > 0 ? daftar.join(', ') : null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Dispensasi | null;
  jenis: JenisTagihan[];
  daftarTA: TahunAjaran[];
  /** Prefill santri penerima saat membuka dari profil santri (mode tambah). */
  santriAwal?: { id: number; nama_lengkap: string } | null;
  /** Prefill TA saat membuka dari halaman Keuangan (mengikuti filter topbar). */
  taBawaan?: string | null;
  onSaved: () => void | Promise<void>;
}

/** Form tambah/ubah dispensasi (layar penuh): satu paket berisi N aturan per
 *  jenis tagihan + dua tabel santri (aktif → penerima via panah/centang). */
export default function DispensasiDialog({ open, onOpenChange, editing, jenis, daftarTA, santriAwal = null, taBawaan = null, onSaved }: Props) {
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [ta, setTa] = useState('');
  const [aktif, setAktif] = useState(true);

  const [baris, setBaris] = useState<BarisAturan[]>([]);
  const [tambahJenisId, setTambahJenisId] = useState<number | ''>('');

  const [santriPilih, setSantriPilih] = useState<Penerima[]>([]);
  const [cari, setCari] = useState('');
  const [kandidat, setKandidat] = useState<Santri[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(50);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'jenis' | 'santri'>('jenis');
  /** Urut header tabel santri aktif (perubahan memicu muat ulang via effect). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);

  /** Klik header: kolom NIS lokal hanya tampilan (tanpa urut server) → abaikan. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    const bersih = nilai.filter((k) => k !== 'nis_lokal');
    if (bersih.length === 0) return;
    const petaBersih = peta === undefined ? undefined : Object.fromEntries(Object.entries(peta).filter(([k]) => k !== 'nis_lokal'));
    setUrut(bersih);
    setArahUrut(arah);
    setArahKolom(bersih.length > 0 ? petaBersih : undefined);
    setPage(1);
  }

  // Buka dialog: isi dari data ubah atau kosongkan.
  useEffect(() => {
    if (!open) return;
    setCari(''); setPage(1); setTambahJenisId(''); setTab('jenis');
    if (editing) {
      setNama(editing.nama); setKeterangan(editing.keterangan ?? ''); setTa(editing.tahun_ajaran);
      setAktif(editing.is_active);
      const aturan = editing.aturan ?? [];
      setBaris(aturan.filter((a) => a.jenis_id !== null).map((a) => ({ jenisId: a.jenis_id as number, tipe: a.tipe, nilai: String(a.nilai) })));
      setSantriPilih((editing.santri_ids ?? []).map((id) => ({ id, nama: `Santri #${id}`, nisLokal: null, ayah: null, ibu: null })));
    } else {
      const bawaan = taBawaan !== null && daftarTA.some((x) => x.nama === taBawaan)
        ? taBawaan
        : (daftarTA.find((x) => x.is_aktif)?.nama ?? daftarTA[0]?.nama ?? '');
      setNama(''); setKeterangan(''); setTa(bawaan); setAktif(true);
      setBaris([]);
      setSantriPilih(santriAwal ? [{ id: santriAwal.id, nama: santriAwal.nama_lengkap, nisLokal: null, ayah: null, ibu: null }] : []);
    }
  }, [open, editing, daftarTA, santriAwal, taBawaan]);

  const muatKandidat = useCallback(async (p: number, pp: PerPage, q: string) => {
    setLoading(true);
    try {
      const res = await listSantri({
        is_active_pst: true, q: q.trim() === '' ? undefined : q.trim(), page: p, per_page: pp,
        sort: urut.length ? tokenUrut(urut, arahKolom) : undefined,
        arah: urut.length ? arahUrut : undefined,
      });
      setKandidat(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
      setPage(res.current_page);
    } catch {
      setKandidat([]); setLastPage(1); setTotal(0);
    } finally { setLoading(false); }
  }, [urut, arahUrut, arahKolom]);

  // Buka dialog / cari / urut berubah (debounce) → muat ulang dari halaman 1.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void muatKandidat(1, perPage, cari); }, cari.trim() === '' ? 0 : 300);
    return () => clearTimeout(t);
  }, [open, cari, perPage, urut, arahUrut, arahKolom, muatKandidat]);

  const tambahPenerima = useCallback((rows: Santri[]) => {
    setSantriPilih((lama) => {
      const ada = new Set(lama.map((x) => x.id));
      const baru: Penerima[] = rows.filter((r) => !ada.has(r.id)).map((r) => ({
        id: r.id, nama: r.nama_lengkap, nisLokal: nisLokalTampil(r), ayah: r.ayah_nama ?? null, ibu: r.ibu_nama ?? null,
      }));
      return baru.length === 0 ? lama : [...lama, ...baru];
    });
  }, []);

  const idPilih = new Set(santriPilih.map((x) => x.id));
  const kandidatTampil = kandidat.filter((s) => !idPilih.has(s.id));

  const namaJenis = (id: number) => {
    const j = jenis.find((x) => x.id === id);
    return j ? `${j.nama}${j.jenjang ? ` (${j.jenjang})` : ''}` : `Jenis #${id}`;
  };

  const tambahBaris = () => {
    if (tambahJenisId === '' || baris.some((b) => b.jenisId === tambahJenisId)) return;
    setBaris((lama) => [...lama, { jenisId: tambahJenisId, tipe: 'nominal', nilai: '' }]);
    setTambahJenisId('');
  };

  const validasiNilai = (tipe: TipeDispensasi, teks: string): number | null => {
    const angka = Number(teks);
    if (!Number.isInteger(angka) || angka < 0) return null;
    if (tipe === 'persen' && angka > 100) return null;
    return angka;
  };

  const simpan = async () => {
    if (nama.trim() === '') { toast.error('Isi nama dispensasi.'); return; }
    if (ta === '') { toast.error('Pilih tahun ajaran.'); return; }

    if (baris.length === 0) { toast.error('Pilih minimal satu jenis tagihan.'); return; }
    const aturan: { jenis_id: number | null; tipe: TipeDispensasi; nilai: number }[] = [];
    for (const b of baris) {
      const angka = validasiNilai(b.tipe, b.tipe === 'bebas' ? '0' : b.nilai);
      if (angka === null) { toast.error(`Nilai potongan ${namaJenis(b.jenisId)} tidak valid (persen maks 100).`); return; }
      aturan.push({ jenis_id: b.jenisId, tipe: b.tipe, nilai: angka });
    }

    const payload: DispensasiInput = {
      nama: nama.trim(),
      keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
      tahun_ajaran: ta,
      aturan,
      santri_ids: santriPilih.length > 0 ? santriPilih.map((s) => s.id) : null,
      is_active: aktif,
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

  const sisaJenis = jenis.filter((j) => !baris.some((b) => b.jenisId === j.id));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <DialogTitle>{editing ? 'Ubah Dispensasi' : 'Tambah Dispensasi'}</DialogTitle>
          <DialogDescription className="sr-only">Formulir dispensasi (keringanan) tagihan.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_dispensasi_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        <div className="grid shrink-0 grid-cols-[max-content_1fr_max-content_1fr] items-center gap-x-3 gap-y-2 border-b px-2 py-2">
            <FieldLabel htmlFor="inp_dispensasi_nama">Nama</FieldLabel>
            <Input id="inp_dispensasi_nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Anak Pegawai" />
            <FieldLabel htmlFor="sel_dispensasi_ta">Tahun Ajaran</FieldLabel>
            <select id="sel_dispensasi_ta" className="h-8 rounded border px-2 text-xs" value={ta} onChange={(e) => setTa(e.target.value)}>
              {daftarTA.map((x) => <option key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
            </select>

            <FieldLabel htmlFor="inp_dispensasi_keterangan">Keterangan</FieldLabel>
            <Input id="inp_dispensasi_keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Opsional" />
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">{baris.length} aturan · {santriPilih.length} penerima</span>
              <label htmlFor="chk_dispensasi_aktif" className="ml-auto flex items-center gap-1 text-xs">
                <input id="chk_dispensasi_aktif" type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} /> Aktif
              </label>
            </div>
          </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'jenis' | 'santri')} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="shrink-0 justify-start rounded-none border-b px-2">
            <TabsTrigger value="jenis" id="tab_dispensasi_jenis">Jenis Tagihan</TabsTrigger>
            <TabsTrigger value="santri" id="tab_dispensasi_santri">Daftar Santri ({santriPilih.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="jenis" className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-2">
            <div className="flex min-h-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <FieldLabel htmlFor="sel_dispensasi_tambah_jenis">Jenis Tagihan</FieldLabel>
                    <select id="sel_dispensasi_tambah_jenis" className="h-8 rounded border px-2 text-xs" value={tambahJenisId} onChange={(e) => setTambahJenisId(e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">— Pilih jenis —</option>
                      {sisaJenis.map((j) => <option key={j.id} value={j.id}>{j.nama}{j.jenjang ? ` (${j.jenjang})` : ''}</option>)}
                    </select>
                    <Button type="button" size="sm" variant="outline" id="btn_dispensasi_tambah_aturan" onClick={tambahBaris} disabled={tambahJenisId === ''}>Tambah</Button>
                  </div>
                  <ExcelTable<BarisAturan & { id: number }>
                    tableKey="dispensasi_aturan"
                    fields={FIELDS_ATURAN}
                    rows={baris.map((b) => ({ ...b, id: b.jenisId }))}
                    getValues={(r) => ({ jenis: namaJenis(r.jenisId), tipe: r.tipe, nilai: r.nilai })}
                    emptyText="Belum ada aturan jenis."
                    canEdit
                    onCommit={async (id, fields) => {
                      setBaris((lama) => lama.map((x) => x.jenisId === id
                        ? {
                          ...x,
                          tipe: (fields.tipe as TipeDispensasi | null) ?? x.tipe,
                          nilai: fields.nilai ?? x.nilai,
                        }
                        : x));
                    }}
                    onSaved={() => {}}
                    aksiLangsung
                    hideCheckbox
                    renderActions={(r) => (
                      <ActionIcon id={`btn_dispensasi_hapus_aturan_${r.jenisId}`} title={`Hapus ${namaJenis(r.jenisId)}`} onClick={() => setBaris((lama) => lama.filter((x) => x.jenisId !== r.jenisId))}>
                        <X size={16} />
                      </ActionIcon>
                    )}
                  />
            </div>
          </TabsContent>

          <TabsContent value="santri" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" id="grup_dispensasi_santri" className="h-full min-h-0 overflow-hidden">
            <ResizablePanel defaultSize="50%" minSize="25%" id="panel_dispensasi_aktif" className="min-h-0 min-w-0">
              <div className="flex h-full min-h-0 flex-col gap-1 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Santri Aktif</p>
                  <Input id="inp_dispensasi_cari" placeholder="Cari nama / ayah / ibu / NISN…" className="h-8 max-w-64" value={cari} onChange={(e) => setCari(e.target.value)} />
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExcelTable<Santri>
                    tableKey="dispensasi_santri_aktif"
                    fields={FIELDS_SANTRI_AKTIF}
                    rows={kandidatTampil}
                    urutAktif={urut}
                    arahUrut={arahUrut}
                    onUrut={terapkanUrut}
                    getValues={(r) => ({ nama: r.nama_lengkap, nis_lokal: nisLokalTampil(r), ayah: r.ayah_nama ?? null, ibu: r.ibu_nama ?? null })}
                    loading={loading}
                    emptyText="Tidak ada santri aktif."
                    canEdit={false}
                    onCommit={async () => {}}
                    onSaved={() => {}}
                    aksiLangsung
                    renderActions={(r) => (
                      <ActionIcon id={`btn_dispensasi_pindah_${r.id}`} title="Masukkan ke penerima" onClick={() => tambahPenerima([r])}>
                        <ArrowRight size={16} />
                      </ActionIcon>
                    )}
                    renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                      <Button id="btn_dispensasi_pindah" size="sm" disabled={busy} onClick={() => { tambahPenerima(checked); clear(); }}>
                        <ArrowRight data-icon="inline-start" size={14} /> Masukkan ({checked.length})
                      </Button>
                    )}
                  />
                </div>
                <Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage, cari)} onPerPage={(pp) => setPerPage(pp)} />
              </div>
            </ResizablePanel>
            <ResizableHandle orientation="horizontal" withHandle id="gagang_dispensasi_santri" aria-label="Atur lebar daftar santri aktif dan penerima" />
            <ResizablePanel defaultSize="50%" minSize="25%" id="panel_dispensasi_penerima" className="min-h-0 min-w-0">
              <div className="flex h-full min-h-0 flex-col gap-1 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Penerima ({santriPilih.length})</p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExcelTable<Penerima>
                    tableKey="dispensasi_santri_penerima"
                    fields={FIELDS_SANTRI_PENERIMA}
                    rows={santriPilih}
                    getValues={(r) => ({ nama: r.nama, nis_lokal: r.nisLokal, ayah: r.ayah, ibu: r.ibu })}
                    emptyText="Masukkan santri dari daftar kiri (centang lalu Masukkan, atau ikon →)."
                    canEdit={false}
                    onCommit={async () => {}}
                    onSaved={() => {}}
                    aksiLangsung
                    renderActions={(r) => (
                      <ActionIcon id={`btn_dispensasi_hapus_santri_${r.id}`} title={`Keluarkan ${r.nama}`} onClick={() => setSantriPilih((lama) => lama.filter((x) => x.id !== r.id))}>
                        <X size={16} />
                      </ActionIcon>
                    )}
                    renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                      <Button id="btn_dispensasi_keluarkan" size="sm" disabled={busy} onClick={() => { const keluar = new Set(checked.map((r) => r.id)); setSantriPilih((lama) => lama.filter((x) => !keluar.has(x.id))); clear(); }}>
                        <X data-icon="inline-start" size={14} /> Keluarkan ({checked.length})
                      </Button>
                    )}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
          </TabsContent>
        </Tabs>

          <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-2 py-2 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {baris.length > 0 ? `${baris.length} aturan jenis` : 'Belum ada aturan jenis'} · {santriPilih.length} penerima · bebas penuh → tagihan tetap dibuat bernominal 0.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
              <Button id="btn_dispensasi_simpan" type="button" disabled={busy} onClick={() => void simpan()}>Simpan</Button>
            </div>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
