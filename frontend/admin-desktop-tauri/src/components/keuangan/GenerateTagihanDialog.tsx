import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  generateTagihan, kandidatTagihan, daftarDispensasi,
  type JenisTagihan, type KandidatTagihanRow, type KelompokKandidat, type Tarif, type Dispensasi,
} from '../../api/keuangan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionIcon } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { ArrowRight, Trash2, X } from '@/icons';
import { type PerPage } from '@/prefs';

const OPSI_KELOMPOK: { value: KelompokKandidat; label: string }[] = [
  { value: 'aktif', label: 'Semua (kecuali pindah keluar)' },
  { value: 'mi', label: 'MI (MI + MI-MD)' },
  { value: 'md', label: 'MD (MD + MI-MD)' },
  { value: 'mi_saja', label: 'MI Saja (tanpa MD)' },
  { value: 'md_saja', label: 'MD Saja (tanpa MI)' },
  { value: 'mi_md', label: 'MI-MD' },
  { value: 'kelas_akhir', label: 'Kelas Akhir' },
  { value: 'selain_kelas_akhir', label: 'Selain Kelas Akhir' },
  { value: 'custom', label: 'Custom' },
];

const FIELDS_KANDIDAT: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'jk', label: 'JK', kind: 'static', width: 40 },
  { key: 'nis', label: 'NIS/NISN', kind: 'static', width: 110 },
  { key: 'tingkat', label: 'Tkt', kind: 'static', width: 50 },
  { key: 'kelas', label: 'Kelas', kind: 'static', width: 90 },
  { key: 'status_akhir', label: 'Status', kind: 'static', width: 90 },
];

const FIELDS_TERPILIH: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'kelas', label: 'Tkt / Kelas', kind: 'static', width: 120 },
  { key: 'nominal', label: 'Nominal', kind: 'text', width: 110 },
  { key: 'dispensasi', label: 'Dispensasi', kind: 'static', width: 170 },
];

type KandidatRow = KandidatTagihanRow & { id: number };
type BarisTerpilih = KandidatTagihanRow & {
  nominal: string; nominalManual: boolean;
  potongan: number; dispensasiIds: number[] | null; dispensasiLabel: string | null;
};

/** Aturan satu dispensasi untuk jenis terpilih (spesifik menang atas semua-jenis). */
function aturanUntukJenis(d: Dispensasi, jenisId: number) {
  let umum = null;
  for (const a of d.aturan ?? []) {
    if (a.jenis_id === null) umum ??= a;
    else if (a.jenis_id === jenisId) return a;
  }
  return umum;
}

/** Dispensasi yang cocok untuk satu baris santri (terdaftar sebagai penerima). */
function saringDispensasi(daftar: Dispensasi[], r: KandidatTagihanRow): Dispensasi[] {
  return daftar.filter((d) => (d.santri_ids ?? []).includes(r.santri_id));
}

/** Akumulatif urut id — sama dengan DispensasiService di backend. */
function hitungDispensasi(nominalAwal: number, cocok: Dispensasi[], jenisId: number) {
  const urut = [...cocok].sort((a, b) => a.id - b.id);
  let nominal = nominalAwal;
  const pakai: Dispensasi[] = [];
  for (const d of urut) {
    const a = aturanUntukJenis(d, jenisId);
    if (!a) continue;
    nominal = a.tipe === 'persen'
      ? Math.floor(nominal * (100 - Math.min(100, Math.max(0, a.nilai))) / 100)
      : a.tipe === 'bebas'
        ? 0
        : Math.max(0, nominal - Math.max(0, a.nilai));
    pakai.push(d);
  }
  return {
    nominal,
    potongan: Math.max(0, nominalAwal - nominal),
    ids: pakai.map((d) => d.id),
    label: pakai.map((d) => d.nama).join(', '),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jenis: JenisTagihan[];
  tarif: Tarif[];
  tahunAjaran: string | null;
  onSelesai: () => void | Promise<void>;
}

/** Dialog generate tagihan: kandidat per kelompok santri (tabel kiri, bisa
 *  dicari & dipilih) dipindahkan ke daftar final (tabel kanan) yang akan
 *  dibuatkan tagihan; nominal default dari tarif/manual, bisa dioverride. */
export default function GenerateTagihanDialog({ open, onOpenChange, jenis, tarif, tahunAjaran, onSelesai }: Props) {
  const [kelompok, setKelompok] = useState<KelompokKandidat>('aktif');
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [tarifId, setTarifId] = useState<number | ''>('');
  const [nominalDefault, setNominalDefault] = useState('');
  const [periodeDari, setPeriodeDari] = useState('');
  const [periodeSampai, setPeriodeSampai] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');

  const [cari, setCari] = useState('');
  const [kandidat, setKandidat] = useState<KandidatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(50);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  /** Urut header tabel kandidat (perubahan memicu muat ulang via effect). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);

  /** Klik header: simpan urut baru + kembali ke halaman 1 (effect memuat ulang). */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    setUrut(nilai);
    setArahUrut(arah);
    setArahKolom(nilai.length > 0 ? peta : undefined);
    setPage(1);
  }

  const [terpilih, setTerpilih] = useState<BarisTerpilih[]>([]);
  const [busy, setBusy] = useState(false);
  const [daftarDispen, setDaftarDispen] = useState<Dispensasi[]>([]);

  const jenisTerpilih = useMemo(() => jenis.find((j) => j.id === jenisId) ?? null, [jenis, jenisId]);
  const bulanan = jenisTerpilih?.tipe === 'bulanan';

  // Buka dialog: bersihkan pilihan; isi default periode setahun dari TA.
  useEffect(() => {
    if (!open) return;
    setTerpilih([]); setCari(''); setKelompok('aktif'); setJenisId(''); setTarifId('');
    setNominalDefault(''); setJatuhTempo(''); setErr(''); setDaftarDispen([]);
    const m = (tahunAjaran ?? '').match(/^(\d{4})\/(\d{4})$/);
    if (m) { setPeriodeDari(`${m[1]}-07`); setPeriodeSampai(`${m[2]}-06`); }
    else { setPeriodeDari(''); setPeriodeSampai(''); }
  }, [open, tahunAjaran]);

  const muatKandidat = useCallback(async (halaman: number, jumlah: PerPage) => {
    if (!open || tahunAjaran === null) return;
    setErr(''); setLoading(true);
    try {
      const res = await kandidatTagihan({
        tahun_ajaran: tahunAjaran,
        kelompok,
        jenis_id: jenisId,
        periode: bulanan ? (periodeDari || undefined) : undefined,
        periode_sampai: bulanan ? (periodeSampai || undefined) : undefined,
        q: cari.trim() || undefined,
        page: halaman,
        per_page: jumlah === 0 ? 'all' : String(jumlah),
        sort: urut.length ? tokenUrut(urut, arahKolom) : undefined,
        arah: urut.length ? arahUrut : undefined,
      });
      setKandidat(res.data.map((r) => ({ ...r, id: r.santri_id })));
      setPage(res.current_page); setLastPage(res.last_page); setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [open, tahunAjaran, kelompok, jenisId, bulanan, periodeDari, periodeSampai, cari, urut, arahUrut, arahKolom]);

  // Ketikan ditahan sebentar agar tidak memanggil API tiap karakter.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void muatKandidat(1, perPage); }, 250);
    return () => clearTimeout(t);
  }, [open, muatKandidat, perPage]);

  /** Baris kandidat yang sudah pindah ke tabel kanan disembunyikan. */
  const idTerpilih = useMemo(() => new Set(terpilih.map((r) => r.santri_id)), [terpilih]);
  const kandidatTampil = useMemo(() => kandidat.filter((r) => !idTerpilih.has(r.santri_id)), [kandidat, idTerpilih]);

  // Dispensasi aktif untuk TA+jenis terpilih (dipakai pratinjau nominal).
  useEffect(() => {
    if (!open || tahunAjaran === null || jenisId === '') { setDaftarDispen([]); return; }
    let hidup = true;
    void (async () => {
      try {
        const d = await daftarDispensasi({ tahun_ajaran: tahunAjaran, jenis_id: jenisId, is_active: true });
        if (hidup) setDaftarDispen(d);
      } catch { if (hidup) setDaftarDispen([]); }
    })();
    return () => { hidup = false; };
  }, [open, tahunAjaran, jenisId]);

  /** Susun baris otomatis: nominal default + dispensasi (manual tidak diubah). */
  const susunBaris = useCallback((r: KandidatTagihanRow, nominalStr: string): BarisTerpilih => {
    const awal = Number(nominalStr);
    if (jenisId === '' || !Number.isInteger(awal) || awal < 0) {
      return { ...r, nominal: nominalStr, nominalManual: false, potongan: 0, dispensasiIds: null, dispensasiLabel: null };
    }
    const h = hitungDispensasi(awal, saringDispensasi(daftarDispen, r), Number(jenisId));
    return {
      ...r, nominal: String(h.nominal), nominalManual: false,
      potongan: h.potongan, dispensasiIds: h.ids.length > 0 ? h.ids : null,
      dispensasiLabel: h.label === '' ? null : h.label,
    };
  }, [daftarDispen, jenisId]);

  // Nominal default / dispensasi berubah → baris otomatis dihitung ulang.
  useEffect(() => {
    if (!open) return;
    setTerpilih((rows) => rows.map((r) => (r.nominalManual ? r : susunBaris(r, nominalDefault))));
  }, [open, nominalDefault, susunBaris]);

  const ubahNominalDefault = (v: string) => {
    setNominalDefault(v);
  };

  const pindahkan = useCallback((rows: KandidatRow[]) => {
    if (rows.length === 0) return;
    setTerpilih((lama) => {
      const ada = new Set(lama.map((r) => r.santri_id));
      const baru = rows
        .filter((r) => !ada.has(r.santri_id))
        .map((r) => susunBaris(r, nominalDefault));
      return [...lama, ...baru];
    });
  }, [nominalDefault, susunBaris]);

  const pilihTarif = (id: number | '') => {
    setTarifId(id);
    if (id !== '') {
      const t = tarif.find((x) => x.id === id);
      if (t) ubahNominalDefault(String(t.nominal));
      if (t && jenisId === '') setJenisId(t.jenis_id);
    }
  };

  const ubahJenis = (id: number | '') => {
    setJenisId(id);
    if (id !== '' && tarifId !== '') {
      const t = tarif.find((x) => x.id === tarifId);
      if (t && t.jenis_id !== id) setTarifId('');
    }
  };

  const simpan = async () => {
    if (tahunAjaran === null) { toast.error('Pilih satu tahun ajaran pada filter di atas.'); return; }
    if (jenisId === '') { toast.error('Pilih jenis tagihan.'); return; }
    if (terpilih.length === 0) { toast.error('Pindahkan minimal satu santri ke daftar generate.'); return; }
    if (bulanan && periodeDari === '') { toast.error('Isi Dari Bulan untuk jenis bulanan.'); return; }
    const nominal = Number(nominalDefault);
    if (!Number.isInteger(nominal) || nominal < 0) { toast.error('Nominal default tidak valid.'); return; }

    const santri: { santri_id: number; nominal?: number }[] = [];
    for (const r of terpilih) {
      // Baris otomatis: nominal dihitung backend (termasuk dispensasi);
      // baris hasil edit manual dikirim apa adanya (dispensasi tidak diterapkan).
      if (!r.nominalManual) { santri.push({ santri_id: r.santri_id }); continue; }
      const n = Number(r.nominal);
      if (!Number.isInteger(n) || n < 0) { toast.error(`Nominal ${r.nama_lengkap} tidak valid.`); return; }
      santri.push({ santri_id: r.santri_id, nominal: n });
    }

    setBusy(true);
    try {
      const r = await generateTagihan({
        tahun_ajaran: tahunAjaran, jenis_id: Number(jenisId),
        periode: bulanan ? periodeDari : null,
        periode_sampai: bulanan ? (periodeSampai || null) : null,
        jatuh_tempo: jatuhTempo || null, nominal, santri,
      });
      toast.success(`Dibuat ${r.dibuat}, dilewati ${r.dilewati}.`);
      await onSelesai();
      onOpenChange(false);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const totalNominal = terpilih.reduce((s, r) => s + (Number(r.nominal) || 0), 0);
  const tarifTampil = jenisId === '' ? tarif : tarif.filter((t) => t.jenis_id === jenisId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <DialogTitle>Buat Tagihan</DialogTitle>
          <DialogDescription className="sr-only">Pilih kandidat santri per kelompok, lalu generate tagihan untuk daftar terpilih.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_gen_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 border-b px-2 py-2">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sel_gen_kelompok">Kelompok Santri</FieldLabel>
            <select id="sel_gen_kelompok" className="h-8 rounded border px-2 text-sm" value={kelompok} onChange={(e) => setKelompok(e.target.value as KelompokKandidat)}>
              {OPSI_KELOMPOK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sel_gen_jenis">Jenis Tagihan</FieldLabel>
            <select id="sel_gen_jenis" className="h-8 rounded border px-2 text-sm" value={jenisId} onChange={(e) => ubahJenis(e.target.value === '' ? '' : Number(e.target.value))} required>
              <option value="">Jenis…</option>
              {jenis.map((j) => <option key={j.id} value={j.id}>{j.nama}{j.jenjang ? ` (${j.jenjang})` : ''}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sel_gen_tarif">Tarif (opsional)</FieldLabel>
            <select id="sel_gen_tarif" className="h-8 max-w-64 rounded border px-2 text-sm" value={tarifId} onChange={(e) => pilihTarif(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Manual…</option>
              {tarifTampil.map((t) => <option key={t.id} value={t.id}>{t.jenjang} · {t.jenis?.nama ?? t.jenis_id} · Rp {t.nominal.toLocaleString('id')}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="inp_gen_nominal">Nominal Default</FieldLabel>
            <Input id="inp_gen_nominal" type="number" min={0} className="h-8 w-32" value={nominalDefault} onChange={(e) => ubahNominalDefault(e.target.value)} required />
          </div>
          {bulanan ? (
            <>
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="inp_gen_dari">Dari Bulan</FieldLabel>
                <Input id="inp_gen_dari" type="month" className="h-8" value={periodeDari} onChange={(e) => setPeriodeDari(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="inp_gen_sampai">Sampai Bulan</FieldLabel>
                <Input id="inp_gen_sampai" type="month" className="h-8" value={periodeSampai} onChange={(e) => setPeriodeSampai(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="info_gen_periode">Periode</FieldLabel>
              <p id="info_gen_periode" className="flex h-8 items-center text-xs text-muted-foreground">
                Otomatis {tahunAjaran ?? '—'} (satu tagihan per TA)
              </p>
            </div>
          )}
          {bulanan ? (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="info_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
              <p id="info_gen_jatuh_tempo" className="flex h-8 items-center text-xs text-muted-foreground">
                Otomatis tanggal 10 bulan berjalan
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="inp_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
              <Input id="inp_gen_jatuh_tempo" type="date" className="h-8" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-describedby="ket_gen_jatuh_tempo" />
              <p id="ket_gen_jatuh_tempo" className="text-[11px] text-muted-foreground">
                Kosong = tanpa tenggat, langsung dihitung tunggakan.
              </p>
            </div>
          )}
          <p className="pb-1 text-xs text-muted-foreground">
            {tahunAjaran === null
              ? <span className="text-destructive">Pilih satu tahun ajaran pada filter di atas.</span>
              : bulanan
                ? <>TA {tahunAjaran}. Isi Dari Bulan; Sampai Bulan opsional (kosong = satu bulan, maks 24 bulan). Tunggakan dihitung setelah tanggal 10 bulan berjalan lewat.</>
                : <>TA {tahunAjaran}. Jenis non-bulanan: periode otomatis kode TA — bisa digenerate lagi di tahun ajaran berikutnya. Isi Jatuh Tempo bila tagihan ini punya tenggat; kosong = langsung dihitung tunggakan.</>}
          </p>
        </div>

        {err !== '' && <div className="px-2 pt-2"><ErrorNotice>{err}</ErrorNotice></div>}

        <ResizablePanelGroup orientation="horizontal" id="grup_gen_tagihan" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel defaultSize="50%" minSize="25%" id="panel_gen_kandidat" className="min-h-0 min-w-0">
            <div className="flex h-full min-h-0 flex-col gap-1 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Kandidat</p>
                <div className="relative max-w-56">
                  <Input id="inp_gen_cari" placeholder="Cari nama / NIS…" className="h-8 w-full pr-7" value={cari} onChange={(e) => setCari(e.target.value)} />
                  {cari !== '' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          id="btn_hapus_cari_gen"
                          aria-label="Bersihkan pencarian"
                          onClick={() => setCari('')}
                          className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bersihkan pencarian</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <ExcelTable<KandidatRow>
                  tableKey="keuangan_gen_kandidat"
                  fields={FIELDS_KANDIDAT}
                  rows={kandidatTampil}
                  urutAktif={urut}
                  arahUrut={arahUrut}
                  onUrut={terapkanUrut}
                  getValues={(r) => ({
                    nama: r.nama_lengkap, jk: r.jk, nis: r.nis_lokal ?? r.nisn,
                    tingkat: r.tingkat, kelas: r.kelas, status_akhir: r.status_akhir,
                  })}
                  loading={loading}
                  emptyText={jenisId === '' ? 'Pilih jenis tagihan untuk menghitung tagihan yang sudah ada.' : 'Tidak ada kandidat untuk kriteria ini.'}
                  canEdit={false}
                  onCommit={async () => {}}
                  onSaved={() => {}}
                  aksiLangsung
                  renderActions={(r) => (
                    <ActionIcon id={`btn_gen_pindah_${r.santri_id}`} title="Pindahkan ke daftar generate" onClick={() => pindahkan([r])}>
                      <ArrowRight size={16} />
                    </ActionIcon>
                  )}
                  renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                    <Button id="btn_gen_pindah" size="sm" disabled={busy} onClick={() => { pindahkan(checked); clear(); }}>
                      <ArrowRight data-icon="inline-start" size={14} /> Pindahkan ({checked.length})
                    </Button>
                  )}
                />
              </div>
              <Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage)} onPerPage={(pp) => setPerPage(pp)} />
            </div>
          </ResizablePanel>
          <ResizableHandle orientation="horizontal" withHandle id="gagang_gen_tagihan" aria-label="Atur lebar kandidat dan daftar generate" />
<ResizablePanel defaultSize="50%" minSize="25%" id="panel_gen_terpilih" className="min-h-0 min-w-0">
              <div className="flex h-full min-h-0 flex-col gap-1 p-2">
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExcelTable<BarisTerpilih & { id: number }>
                    tableKey="keuangan_gen_terpilih"
                    fields={FIELDS_TERPILIH}
                    rows={terpilih.map((r) => ({ ...r, id: r.santri_id }))}
                    getValues={(r) => ({
                      nama: r.nama_lengkap,
                      kelas: [r.tingkat, r.kelas].filter(Boolean).join(' / ') || '—',
                      nominal: r.nominal,
                      dispensasi: r.dispensasiLabel === null
                        ? null
                        : `−Rp ${r.potongan.toLocaleString('id')} · ${r.dispensasiLabel}`,
                    })}
                    emptyText="Pindahkan santri dari daftar kandidat (centang lalu Pindahkan, atau ikon →)."
                    canEdit
                    onCommit={async (id, fields) => {
                      setTerpilih((rows) => rows.map((x) => x.santri_id === id
                        ? { ...x, nominal: fields.nominal ?? x.nominal, nominalManual: true, potongan: 0, dispensasiIds: null, dispensasiLabel: null }
                        : x));
                    }}
                    onSaved={() => {}}
                    aksiLangsung
                    hideCheckbox
                    renderActions={(r) => (
                      <ActionIcon id={`btn_gen_hapus_${r.santri_id}`} title="Keluarkan dari daftar" onClick={() => setTerpilih((rows) => rows.filter((x) => x.santri_id !== r.santri_id))}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    )}
                  />
                </div>
              </div>
            </ResizablePanel>
        </ResizablePanelGroup>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-2 py-2 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {terpilih.length} santri · total Rp {totalNominal.toLocaleString('id')}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_gen_generate" type="button" disabled={busy} onClick={() => void simpan()}>Generate</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
