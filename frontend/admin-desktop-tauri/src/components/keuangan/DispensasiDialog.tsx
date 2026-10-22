import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatDispensasi, ubahDispensasi,
  type Dispensasi, type DispensasiInput, type JenisTagihan, type TipeDispensasi,
} from '../../api/keuangan';
import { type TahunAjaran } from '../../api/master';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import LabeledInput from '@/components/LabeledInput';
import LabeledCombobox from '@/components/LabeledCombobox';
import { jenisCocokJenjang, saringAturanJenjang } from '@/lib/dispensasi';
import type { PilihanLembaga } from '@/lembagaAktif';
import type { ExcelField } from '@/components/excel/types';
import ExcelTabelV2 from '@/components/excelV2/ExcelTabelV2';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, Info, Loader2, Save, X } from '@/icons';

export interface BarisAturan {
  jenisId: number;
  tipe: TipeDispensasi;
  nilai: string;
}

/** Tabel KIRI: daftar tagihan (jenis) yang bisa dijadikan aturan. Tiap baris
 *  punya aksi `→` untuk memindahkannya ke tabel aturan di kanan. */
const FIELDS_TAGIHAN: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'sifat', label: 'Tipe', kind: 'static', width: 90 },
];

/** Tipe & nilai bawaan aturan baru: **Persen 0%** — keringanan "kosong" yang
 *  aman; angkanya diisi belakangan di tabel aturan. */
export const ATURAN_BAWAAN: Pick<BarisAturan, 'tipe' | 'nilai'> = { tipe: 'persen', nilai: '0' };

/** Tambah satu jenis tagihan ke daftar aturan (aksi `→` tabel Tagihan).
 *  Jenis yang sudah punya aturan diabaikan — barisnya memang sudah tak muncul
 *  di tabel kiri, jadi ini jaring pengaman terakhir. */
export function tambahAturan(lama: BarisAturan[], jenisId: number): BarisAturan[] {
  if (lama.some((b) => b.jenisId === jenisId)) return lama;
  return [...lama, { jenisId, ...ATURAN_BAWAAN }];
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

/**
 * Daftar penerima yang dikirim saat simpan.
 *
 * Dialog ini TIDAK lagi mengelola penerima (dipindah ke halaman Dispensasi,
 * kolom Daftar Penerima), jadi dua hal wajib dijaga:
 * - mode UBAH: pakai daftar yang sudah ada apa adanya. Mengirim `null` berarti
 *   backend `sync([])` → SELURUH penerima paket terhapus;
 * - mode TAMBAH dari profil santri (`santriAwal`): santri itu jadi penerima
 *   pertama, karena dialah alasan dialog dibuka.
 */
export function santriIdsUntuk(
  editing: Dispensasi | null,
  santriAwal: { id: number } | null,
): number[] | null {
  if (editing) return editing.santri_ids ?? null;
  return santriAwal === null ? null : [santriAwal.id];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Dispensasi | null;
  jenis: JenisTagihan[];
  daftarTA: TahunAjaran[];
  /** Lingkup jenjang yang boleh dipilih pengguna (dari peran/lingkupnya). */
  pilihanLembaga: PilihanLembaga[];
  /** Prefill santri penerima saat membuka dari profil santri (mode tambah). */
  santriAwal?: { id: number; nama_lengkap: string } | null;
  /** Prefill TA saat membuka dari halaman Keuangan (mengikuti filter topbar). */
  taBawaan?: string | null;
  onSaved: () => void | Promise<void>;
}

/** Form tambah/ubah dispensasi: identitas paket (termasuk lingkup **jenjang**)
 *  + N aturan potongan per jenis tagihan. Daftar penerima TIDAK diatur di sini —
 *  dikelola di halaman Dispensasi (kolom Daftar Penerima), jadi paket lama
 *  tidak kehilangan penerimanya saat diubah dari dialog. */
export default function DispensasiDialog({ open, onOpenChange, editing, jenis, daftarTA, pilihanLembaga, santriAwal = null, taBawaan = null, onSaved }: Props) {
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [ta, setTa] = useState('');
  /** Lingkup lembaga paket; null = berlaku semua lembaga. */
  const [jenjang, setJenjang] = useState<string | null>(null);
  const [kuota, setKuota] = useState('');
  const [grup, setGrup] = useState('');
  const [aktif, setAktif] = useState(true);

  const [baris, setBaris] = useState<BarisAturan[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNama(editing.nama); setKeterangan(editing.keterangan ?? ''); setTa(editing.tahun_ajaran);
      setJenjang(editing.jenjang ?? null);
      setKuota(editing.kuota_bulan === null ? '' : String(editing.kuota_bulan));
      setGrup(editing.grup ?? '');
      setAktif(editing.is_active);
      const aturan = editing.aturan ?? [];
      setBaris(aturan.filter((a) => a.jenis_id !== null).map((a) => ({ jenisId: a.jenis_id as number, tipe: a.tipe, nilai: String(a.nilai) })));
    } else {
      const bawaan = taBawaan !== null && daftarTA.some((x) => x.nama === taBawaan)
        ? taBawaan
        : (daftarTA.find((x) => x.is_aktif)?.nama ?? daftarTA[0]?.nama ?? '');
      setNama(''); setKeterangan(''); setTa(bawaan); setJenjang(null); setKuota(''); setGrup(''); setAktif(true);
      setBaris([]);
    }
  }, [open, editing, daftarTA, santriAwal, taBawaan]);

  const labelJenis = (j: JenisTagihan) => `${j.nama}${j.jenjang ? ` (${j.jenjang})` : ''}`;
  const namaJenis = (id: number) => {
    const j = jenis.find((x) => x.id === id);
    return j ? labelJenis(j) : `Jenis #${id}`;
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
    if (kuota.trim() !== '') {
      const k = Number(kuota);
      if (!Number.isInteger(k) || k < 1 || k > 120) { toast.error('Kuota bulan diisi 1–120 atau dikosongkan.'); return; }
    }
    if (grup.trim().length > 50) { toast.error('Grup maksimal 50 karakter.'); return; }

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
      jenjang,
      kuota_bulan: kuota.trim() === '' ? null : Number(kuota),
      grup: grup.trim() === '' ? null : grup.trim(),
      aturan,
      santri_ids: santriIdsUntuk(editing, santriAwal),
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

  /** Opsi lingkup jenjang: "Semua lembaga" (null) + lembaga yang boleh diakses.
   *  Paket berlingkup di luar lingkup pengguna tetap ditampilkan apa adanya —
   *  kalau tidak, kotaknya jatuh ke pilihan pertama dan tampak seperti paket
   *  semua lembaga (menyimpannya tetap ditolak izin lembaga). */
  const opsiJenjang: { nilai: string | null; label: string }[] = [
    { nilai: null, label: 'Semua lembaga' },
    ...pilihanLembaga.map((l) => ({ nilai: l.jenjang, label: `${l.jenjang} — ${l.nama}` })),
  ];
  if (jenjang !== null && !opsiJenjang.some((o) => o.nilai === jenjang)) {
    opsiJenjang.push({ nilai: jenjang, label: `${jenjang} — di luar lingkup Anda` });
  }

  /** Ganti lingkup jenjang: aturan yang jenisnya tak lagi cocok DILEPAS
   *  (tak bisa disimpan) dengan pemberitahuan, bukan gagal saat menyimpan. */
  const ubahJenjang = (baru: string | null) => {
    setJenjang(baru);
    const sisa = saringAturanJenjang(baris, jenis, baru);
    if (sisa.length !== baris.length) {
      toast.info(`${baris.length - sisa.length} aturan jenis dilepas — bukan milik lembaga ${baru}.`);
      setBaris(sisa);
    }
  };

  /** Jenis tagihan yang BELUM punya aturan → isi tabel kiri. Yang sudah
   *  diatur hanya tampil di tabel kanan supaya satu jenis tak muncul dua kali
   *  (dan aksi `→`-nya selalu bisa ditekan). Jenis di luar lingkup jenjang
   *  paket disembunyikan supaya tak pernah masuk sebagai aturan. */
  const belumDiatur = jenis.filter((j) => jenisCocokJenjang(j, jenjang) && !baris.some((b) => b.jenisId === j.id));
  /** Teks opsi tahun ajaran (dipakai combobox identitas). */
  const labelTA = (x: TahunAjaran) => `${x.nama}${x.is_aktif ? ' (aktif)' : ''}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[min(74dvh,36rem)] w-[min(94vw,68rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >

        <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <DialogTitle className="shrink-0">{editing ? 'Ubah Dispensasi' : 'Tambah Dispensasi'}</DialogTitle>
            <DialogDescription className="min-w-0 truncate">
              Keringanan tagihan per jenis — penerima diatur di halaman Dispensasi.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_dispensasi_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2.5 py-2">
          <LabeledInput
            label="Nama" htmlFor="inp_dispensasi_nama" tinggi={26} lebarKotak={190}
            value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Anak Pegawai"
          />
          <LabeledCombobox label="TA" htmlFor="sel_dispensasi_ta" tinggi={26} lebarKotak={165}>
            <ComboboxRoot
              items={daftarTA}
              itemToStringLabel={labelTA}
              isItemEqualToValue={(a, b) => a.nama === b.nama}
              value={daftarTA.find((x) => x.nama === ta) ?? null}
              onValueChange={(x) => { if (x !== null) setTa(x.nama); }}
            >
              <ComboboxInput id="sel_dispensasi_ta" aria-label="Tahun ajaran" placeholder="Pilih TA…" />
              <ComboboxTrigger aria-label="Buka daftar tahun ajaran" />
              <ComboboxContent>
                <ComboboxEmpty>Tidak ada tahun ajaran.</ComboboxEmpty>
                <ComboboxList>
                  {(x) => <ComboboxItem key={x.nama} value={x}>{labelTA(x)}</ComboboxItem>}
                </ComboboxList>
              </ComboboxContent>
            </ComboboxRoot>
          </LabeledCombobox>
          <LabeledCombobox label="Jenjang" htmlFor="sel_dispensasi_jenjang" tinggi={26} lebarKotak={185}>
            <ComboboxRoot
              items={opsiJenjang}
              itemToStringLabel={(o) => o.label}
              isItemEqualToValue={(a, b) => a.nilai === b.nilai}
              value={opsiJenjang.find((o) => o.nilai === jenjang) ?? opsiJenjang[0]}
              onValueChange={(o) => { if (o !== null) ubahJenjang(o.nilai); }}
            >
              <ComboboxInput id="sel_dispensasi_jenjang" aria-label="Lingkup jenjang" placeholder="Semua lembaga" />
              <ComboboxTrigger aria-label="Buka daftar jenjang" />
              <ComboboxContent>
                <ComboboxEmpty>Tidak ada jenjang.</ComboboxEmpty>
                <ComboboxList>
                  {(o) => <ComboboxItem key={o.label} value={o}>{o.label}</ComboboxItem>}
                </ComboboxList>
              </ComboboxContent>
            </ComboboxRoot>
          </LabeledCombobox>
          <LabeledInput
            label="Kuota" htmlFor="inp_dispensasi_kuota" tinggi={26} lebarKotak={125}
            tipeKontrol="angka" tipeTerkunci min={1} max={120} title="Opsional (1–120 bulan)"
            value={kuota} onChange={(e) => setKuota(e.target.value)} placeholder="mis. 6"
          />
          <LabeledInput
            label="Grup" htmlFor="inp_dispensasi_grup" tinggi={26} lebarKotak={135}
            title="Opsional" value={grup} onChange={(e) => setGrup(e.target.value)} placeholder="mis. prestasi"
          />
          <LabeledInput
            label="Keterangan" htmlFor="inp_dispensasi_keterangan" tinggi={26}
            className="min-w-40 flex-1"
            title="Opsional" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Catatan tambahan…"
          />
          <span className="flex h-[26px] shrink-0 items-center gap-2 rounded-md border border-foreground/30 px-2.5">
            <Switch id="chk_dispensasi_aktif" size="sm" checked={aktif} onCheckedChange={setAktif} aria-label="Status aktif dispensasi" />
            <label htmlFor="chk_dispensasi_aktif" className="cursor-pointer text-xs select-none">Aktif</label>
          </span>
        </div>

        <div className="flex min-h-0 flex-1 gap-2 p-2.5">
          <div className="flex min-h-0 w-[36%] min-w-56 flex-col">
            <ExcelTabelV2<JenisTagihan>
              tableKey="dispensasi_tagihan"
              header={`Tagihan (${belumDiatur.length})`}
              fields={FIELDS_TAGIHAN}
              rows={belumDiatur}
              getValues={(j) => ({ jenis: labelJenis(j), sifat: j.tipe === 'bulanan' ? 'Bulanan' : 'Non-bulanan' })}
              emptyText={jenjang === null
                ? 'Semua jenis tagihan sudah punya aturan.'
                : `Tidak ada jenis tagihan lembaga ${jenjang} (atau jenis global) yang bisa diatur.`}
              canEdit={false}
              onApplyPreset={() => {}}
              hideCheckbox
              renderActions={(j) => (
                <ActionIcon
                  id={`btn_dispensasi_tambah_${j.id}`}
                  title={`Tambahkan ${labelJenis(j)} ke aturan dispensasi`}
                  onClick={() => setBaris((lama) => tambahAturan(lama, j.id))}
                >
                  <ArrowRight size={16} />
                </ActionIcon>
              )}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ExcelTabelV2<BarisAturan & { id: number }>
              tableKey="dispensasi_aturan"
              header={`Aturan Dispensasi (${baris.length})`}
              fields={FIELDS_ATURAN}
              rows={baris.map((b) => ({ ...b, id: b.jenisId }))}
              getValues={(r) => ({ jenis: namaJenis(r.jenisId), tipe: r.tipe, nilai: r.nilai })}
              emptyText="Belum ada aturan — tekan → pada tabel Tagihan."
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
              onApplyPreset={() => {}}
              hideCheckbox
              renderActions={(r) => (
                <ActionIcon id={`btn_dispensasi_hapus_aturan_${r.jenisId}`} title={`Hapus ${namaJenis(r.jenisId)}`} onClick={() => setBaris((lama) => lama.filter((x) => x.jenisId !== r.jenisId))}>
                  <X size={16} />
                </ActionIcon>
              )}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-3 py-2 sm:justify-between">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Info size={13} className="shrink-0" />
            <span className="truncate">
              {baris.length > 0 ? `${baris.length} aturan jenis` : 'Belum ada aturan jenis'}
              {' · '}
              {editing
                ? `${(editing.santri_ids ?? []).length} penerima`
                : santriAwal === null
                  ? 'penerima diatur di halaman Dispensasi'
                  : `penerima awal ${santriAwal.nama_lengkap}`}
              {' · bebas penuh → tagihan Rp 0.'}
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_dispensasi_simpan" type="button" className="gap-1.5" disabled={busy} onClick={() => void simpan()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
