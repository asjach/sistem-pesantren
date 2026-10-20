import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { Check, History, Minus, Pencil, Plus, Trash2, Undo2 } from '@/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { JUDUL_KOLOM, KOLOM_PAPAN, type RiwayatPapan, type StatusPapan, type SubPapan, type SubpoinPapan } from '@/api/papan';
import { kelompokkanKolom, kolomSebelah, type KartuPapan, type KartuSub } from '@/lib/papan';
import { pecahButir, type PotonganButir } from '@/lib/butirTeks';

/**
 * Aksi yang bisa dilakukan pada satu baris poin.
 *
 * Dikumpulkan jadi satu objek supaya tidak ada sepuluh prop terpisah yang
 * harus diteruskan berlapis dari halaman sampai ke barisnya.
 */
export interface AksiButir {
  onSimpanTeks: (deskripsi: string, status?: StatusPapan) => Promise<void>;
  onSimpanSubpoin: (subpoin: SubpoinPapan[]) => Promise<void>;
  onHapus: () => Promise<void>;
}

export interface AksiSub {
  onSimpan: (kode: string, nama: string) => Promise<void>;
  onHapus: () => Promise<void>;
}

/** Posisi sisip saat menyeret: sebelum kartu ke-indeks di kolom. */
export interface SasaranJatuh {
  kolom: StatusPapan;
  indeks: number;
}

/** Warna lencana per status - memakai token semantik yang sudah ada. */
export const WARNA_STATUS: Record<StatusPapan, string> = {
  akan: 'var(--info)',
  sedang: 'var(--warning)',
  sudah: 'var(--success)',
  ditunda: 'var(--muted-foreground)',
};

/** Urutan kelompok butir di dalam kartu: yang belum selesai lebih dulu supaya
 *  sisa pekerjaan langsung terlihat, baru yang sudah selesai. */

/** Render satu potongan teks butir; markup markdown tidak ditampilkan mentah. */
function Potongan({ potongan }: { potongan: PotonganButir }) {
  if (potongan.jenis === 'kode') {
    return (
      <code className="px-1 font-mono text-[11px]" style={{ background: 'var(--muted)' }}>
        {potongan.isi}
      </code>
    );
  }

  if (potongan.jenis === 'tebal') {
    return <strong className="font-semibold">{potongan.isi}</strong>;
  }

  // Tautan ditampilkan sebagai teks + tujuannya: kartu bisa diseret, jadi
  // tautan yang bisa diklik di dalamnya justru mengganggu.
  if (potongan.jenis === 'tautan' && potongan.tujuan !== potongan.isi) {
    return (
      <span>
        {potongan.isi}
        <span className="text-muted-foreground"> ({potongan.tujuan})</span>
      </span>
    );
  }

  return <>{potongan.isi}</>;
}

/** Teks butir dengan markup ringkasnya dirender. */
export function TeksButir({ deskripsi }: { deskripsi: string }) {
  return (
    <>
      {pecahButir(deskripsi).map((p, i) => (
        <Potongan key={i} potongan={p} />
      ))}
    </>
  );
}

/** Lencana kecil berwarna untuk status atau nama modul. */
export function Lencana({ label, warna }: { label: string; warna: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-[5px] px-[7px] text-xs font-medium whitespace-nowrap"
      style={{ color: warna, background: `color-mix(in srgb, ${warna} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

/** Garis sisip 2px aksen saat menyeret kartu. */
export function GarisSisip({ id }: { id: string }) {
  return <div id={id} aria-hidden="true" className="h-[2px] shrink-0" style={{ background: 'var(--accent)' }} />;
}

/**
 * Satu kartu papan = satu SUB-MODUL di dalam sebuah kolom.
 *
 * Judulnya (kode + nama sub-modul) muncul SEKALI, lalu semua poin berstatus
 * kolom itu didaftar di bawahnya. Sebelumnya satu kartu = satu poin, sehingga
 * sub-modul berpoin delapan tampil sebagai delapan kartu berjudul sama.
 *
 * Yang DISERET tetap poinnya, bukan kartunya: tiap baris poin draggable dan
 * bisa disunting langsung di tempat. Itu disengaja - satu sub-modul bisa
 * separuh selesai, jadi memindahkan seluruh kartu sekaligus justru salah.
 */
export function KartuPapan({
  kartu,
  diseret,
  tampilkanModul,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindahArah,
  bolehUbah,
  aksiKartu,
  aksiSub,
  onTambahPoin,
}: {
  kartu: KartuSub;
  /** Id poin yang sedang diseret (bukan id kartu). */
  diseret: number | null;
  /** Tampilkan nama modul di kartu. Di halaman per-modul ini berulang, jadi bisa dimatikan. */
  tampilkanModul: boolean;
  onMulaiSeret: (poin: KartuPapan, e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  /** Pindah lewat keyboard (tanpa seret); arah -1 = kolom sebelumnya. */
  onPindahArah: (poin: KartuPapan, arah: -1 | 1) => void;
  bolehUbah: boolean;
  /** Aksi yang berlaku untuk sebuah poin di kartu ini. */
  aksiKartu: (poin: KartuPapan) => AksiButir;
  aksiSub?: (kartu: KartuSub) => AksiSub;
  onTambahPoin?: (kode: string, status: StatusPapan, deskripsi: string) => Promise<void>;
}) {
  const idKartu = `sub_${kartu.subKode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${kartu.status}`;
  const [ubahSub, setUbahSub] = useState(false);
  const [kode, setKode] = useState(kartu.subKode);
  const [nama, setNama] = useState(kartu.subNama);
  const [poinBaru, setPoinBaru] = useState('');
  const [statusBaru, setStatusBaru] = useState<StatusPapan>(kartu.status);
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  async function jalankan(aksi: () => Promise<void>, selesai?: () => void) {
    setSibuk(true);
    setGalat('');
    try {
      await aksi();
      selesai?.();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSibuk(false);
    }
  }

  function mulaiUbah() {
    setKode(kartu.subKode);
    setNama(kartu.subNama);
    setKonfirmasiHapus(false);
    setUbahSub(true);
  }

  function batalUbah() {
    setKode(kartu.subKode);
    setNama(kartu.subNama);
    setKonfirmasiHapus(false);
    setUbahSub(false);
  }

  return (
    <article
      id={`kartu_papan_${idKartu}`}
      aria-label={`${kartu.subKode} ${kartu.subNama}, ${kartu.poin.length} poin berstatus ${kartu.status}.`}
      className={cn(
        // Border, latar, dan bayangan datang dari .kartu (index.css) supaya
        // kartu papan tidak menyimpang dari kartu lain di aplikasi.
        'kartu flex flex-col gap-2 p-[10px_12px]',
      )}
    >
      <div className="flex items-start gap-2">
        {ubahSub ? (
          <input
            id={`input_kode_${idKartu}`}
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            maxLength={20}
            aria-label={`Kode sub-modul ${kartu.subKode}`}
            className="mt-px w-[68px] shrink-0 border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
            style={{ borderColor: 'var(--divider)' }}
          />
        ) : (
          <span className="mt-px shrink-0 bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {kartu.subKode}
          </span>
        )}
        {ubahSub ? (
          <input
            id={`input_nama_${idKartu}`}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            aria-label={`Nama sub-modul ${kartu.subKode}`}
            className="min-w-0 flex-1 border bg-transparent px-1 text-[13px] leading-snug font-medium text-[var(--accent-readable)]"
            style={{ borderColor: 'var(--divider)' }}
          />
        ) : (
          <h3 className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-[var(--accent-readable)]">
            {kartu.subNama}
          </h3>
        )}
        {bolehUbah && onTambahPoin && !ubahSub ? (
          <button
            id={`btn_tambah_poin_${idKartu}`}
            type="button"
            onClick={() => setTambahTerbuka((v) => !v)}
            aria-label={`${tambahTerbuka ? 'Tutup' : 'Tambah'} poin di ${kartu.subKode}`}
            aria-expanded={tambahTerbuka}
            title="Tambah poin"
            className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Plus size={12} />
          </button>
        ) : null}
        {bolehUbah && aksiSub ? (
          ubahSub ? (
            <>
              <button
                id={`btn_simpan_${idKartu}`}
                type="button"
                disabled={sibuk || !kode.trim() || !nama.trim()}
                onClick={() => void jalankan(() => aksiSub(kartu).onSimpan(kode.trim(), nama.trim()), batalUbah)}
                aria-label={`Simpan sub-modul ${kartu.subKode}`}
                className="grid size-5 shrink-0 place-items-center text-success enabled:hover:opacity-80 disabled:opacity-40"
              >
                <Check size={12} />
              </button>
              <button
                id={`btn_batal_${idKartu}`}
                type="button"
                onClick={batalUbah}
                aria-label={`Batal ubah sub-modul ${kartu.subKode}`}
                className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
              >
                <Undo2 size={12} />
              </button>
            </>
          ) : (
            <button id={`btn_ubah_sub_${idKartu}`} type="button" aria-label={`Ubah sub-modul ${kartu.subKode}`} onClick={mulaiUbah} className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
              <Pencil size={12} />
            </button>
          )
        ) : null}
        {ubahSub && bolehUbah && aksiSub ? (
          <Popover open={konfirmasiHapus} onOpenChange={setKonfirmasiHapus}>
            <PopoverTrigger asChild>
              <button
                id={`btn_hapus_sub_${idKartu}`}
                type="button"
                aria-label={`Hapus sub-modul ${kartu.subKode}`}
                className="grid size-5 shrink-0 place-items-center text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 border border-foreground/30 p-2">
              <p className="text-xs">Hapus sub-modul dan semua poin?</p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  id={`btn_yakin_hapus_sub_${idKartu}`}
                  type="button"
                  disabled={sibuk}
                  onClick={() => void jalankan(() => aksiSub(kartu).onHapus(), () => setKonfirmasiHapus(false))}
                  className="text-xs font-medium text-destructive disabled:opacity-40"
                >
                  Ya, hapus
                </button>
                <button type="button" onClick={() => setKonfirmasiHapus(false)} className="text-xs text-muted-foreground hover:text-foreground">Batal</button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          /* Jumlah poin di kolom ini; berguna saat poinnya panjang-panjang. */
          <span
            className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center border px-1 font-mono text-[10px] text-muted-foreground tabular-nums"
            style={{ borderColor: 'var(--divider)' }}
            title={`${kartu.poin.length} poin di kolom ini`}
          >
            {kartu.poin.length}
          </span>
        )}
      </div>

      {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}

      {tampilkanModul ? (
        <div className="flex flex-wrap gap-1">
          <Lencana label={kartu.modulNama} warna="var(--accent)" />
        </div>
      ) : null}

      {/* Daftar poin. Tiap baris tetap satuan seret; suntingan terbuka di bawahnya. */}
      <div className="flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
        {kartu.poin.map((poin) => (
          <BarisPoin
            key={poin.id}
            poin={poin}
            diseret={diseret === poin.id}
            onMulaiSeret={onMulaiSeret}
            onLepasSeret={onLepasSeret}
            onDiAtas={onDiAtas}
            onPindahArah={onPindahArah}
            bolehUbah={bolehUbah}
            aksi={aksiKartu(poin)}
          />
        ))}
      </div>
      {bolehUbah && onTambahPoin && tambahTerbuka ? (
        <div className="border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex flex-col gap-2">
            <input id={`input_poin_baru_${idKartu}`} value={poinBaru} onChange={(e) => setPoinBaru(e.target.value)} placeholder="Tulis poin baru..." aria-label={`Poin baru ${kartu.subKode}`} className="w-full border bg-transparent px-2 py-1 text-xs" style={{ borderColor: 'var(--divider)' }} />
            <select id={`status_poin_baru_${idKartu}`} value={statusBaru} onChange={(e) => setStatusBaru(e.target.value as StatusPapan)} aria-label="Status poin baru" className="border bg-transparent px-2 py-1 text-xs" style={{ borderColor: 'var(--divider)' }}>
              {KOLOM_PAPAN.map((status) => <option key={status} value={status}>{JUDUL_KOLOM[status]}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                id={`btn_simpan_poin_${idKartu}`}
                type="button"
                disabled={sibuk || !poinBaru.trim()}
                onClick={() => void jalankan(
                  () => onTambahPoin(kartu.subKode, statusBaru, poinBaru.trim()),
                  () => { setPoinBaru(''); setTambahTerbuka(false); },
                )}
                className="border px-2 py-1 text-xs disabled:opacity-40"
              >
                Simpan poin
              </button>
              <button type="button" onClick={() => setTambahTerbuka(false)} className="text-xs text-muted-foreground">Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Satu baris poin di dalam kartu sub-modul.
 *
 * Inilah satuan yang BERGESER: draggable, fokusable, dan punya panah
 * kiri/kanan sebagai jalur keyboard yang setara dengan seret.
 */
function BarisPoin({
  poin,
  diseret,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindahArah,
  bolehUbah,
  aksi,
}: {
  poin: KartuPapan;
  diseret: boolean;
  onMulaiSeret: (poin: KartuPapan, e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  onPindahArah: (poin: KartuPapan, arah: -1 | 1) => void;
  bolehUbah: boolean;
  aksi: AksiButir;
}) {
  const idPoin = `butir_${poin.id}`;
  const [ubah, setUbah] = useState(false);
  const [draf, setDraf] = useState(poin.deskripsi);
  const [statusDraf, setStatusDraf] = useState<StatusPapan>(poin.status);
  const [subpoin, setSubpoin] = useState<SubpoinPapan[]>(poin.subpoin);
  // Nilai subpoin yang sudah tersimpan di server; dipakai saat menyimpan satu
  // baris agar draf baris lain tidak ikut terkirim.
  const [asli, setAsli] = useState<SubpoinPapan[]>(poin.subpoin);
  const [sibuk, setSibuk] = useState(false);
  const [sibukSub, setSibukSub] = useState<number | null>(null);
  const [galat, setGalat] = useState('');
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);

  function mulaiUbah() {
    setDraf(poin.deskripsi);
    setStatusDraf(poin.status);
    setSubpoin(poin.subpoin);
    setAsli(poin.subpoin);
    setGalat('');
    setKonfirmasiHapus(false);
    setUbah(true);
  }

  function batalUbah() {
    setDraf(poin.deskripsi);
    setStatusDraf(poin.status);
    setSubpoin(poin.subpoin);
    setAsli(poin.subpoin);
    setGalat('');
    setKonfirmasiHapus(false);
    setUbah(false);
  }

  async function simpan() {
    const teks = draf.trim();

    if (teks === '') return;

    setSibuk(true);
    setGalat('');

    try {
      if (statusBerubah) await aksi.onSimpanTeks(teks, statusDraf);
      else await aksi.onSimpanTeks(teks);
      setUbah(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSibuk(false);
    }
  }

  async function simpanSubpoin(indeks: number) {
    const isi = subpoin[indeks]?.teks.trim() ?? '';

    if (isi === '') return;

    setSibukSub(indeks);
    setGalat('');

    try {
      // Baris lain memakai nilai yang sudah tersimpan, bukan drafnya.
      const hasil = subpoin
        .map((item, i) => {
          if (i === indeks) {
            return { teks: isi, selesai: item.selesai };
          }

          return {
            teks: (asli[i]?.teks ?? '').trim(),
            selesai: asli[i]?.selesai ?? false,
          };
        })
        .filter((item) => item.teks !== '');

      await aksi.onSimpanSubpoin(hasil);
      setAsli((prev) => prev.map((item, i) => (i === indeks ? { ...item, teks: isi } : item)));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan subpoin.');
    } finally {
      setSibukSub(null);
    }
  }

  function tambahSubpoin() {
    setSubpoin([...subpoin, { teks: '', selesai: false }]);
    setAsli([...asli, { teks: '', selesai: false }]);
  }

  async function hapusSubpoin(indeks: number) {
    const barisBaru = (asli[indeks]?.teks ?? '').trim() === '';
    const sisaAsli = asli.filter((_, i) => i !== indeks);

    setSubpoin(subpoin.filter((_, i) => i !== indeks));
    setAsli(sisaAsli);

    // Baris yang belum pernah tersimpan cukup dibuang dari draf.
    if (barisBaru) return;

    setSibukSub(indeks);
    setGalat('');

    try {
      await aksi.onSimpanSubpoin(sisaAsli.filter((item) => item.teks.trim() !== ''));
    } catch (e) {
      setSubpoin(subpoin);
      setAsli(asli);
      setGalat(e instanceof Error ? e.message : 'Gagal menghapus subpoin.');
    } finally {
      setSibukSub(null);
    }
  }

  async function toggleSubpoin(indeks: number) {
    if (!bolehUbah || sibukSub !== null) return;

    const hasil = poin.subpoin.map((item, i) => (
      i === indeks ? { ...item, selesai: !item.selesai } : item
    ));

    setSibukSub(indeks);
    setGalat('');

    try {
      await aksi.onSimpanSubpoin(hasil);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan subpoin.');
    } finally {
      setSibukSub(null);
    }
  }

  async function hapus() {
    setSibuk(true);
    setGalat('');

    try {
      await aksi.onHapus();
      setUbah(false);
      setKonfirmasiHapus(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghapus.');
    } finally {
      setSibuk(false);
    }
  }

  const teksBerubah = draf.trim() !== poin.deskripsi.trim();
  const statusBerubah = statusDraf !== poin.status;
  const semuaSubpoinSelesai = poin.subpoin.every((item) => item.selesai);

  return (
    // Baris ini SENGAJA fokusable: seret tidak bisa dipakai keyboard, jadi
    // panah kiri/kanan disediakan sebagai jalur setara (lihat onKeyDown).
    // Tanpa tabIndex + handler itu, memindah poin jadi mustahil tanpa mouse.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <>
      <div
        id={`kartu_papan_${idPoin}`}
        role="group"
        draggable={bolehUbah && !ubah}
        tabIndex={0}
        onDragStart={(e) => onMulaiSeret(poin, e)}
        onDragEnd={onLepasSeret}
        onDragOver={onDiAtas}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (!bolehUbah) return;
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          onPindahArah(poin, e.key === 'ArrowLeft' ? -1 : 1);
        }}
        aria-label={`${poin.deskripsi}. Seret atau pakai panah kiri/kanan untuk memindahkan di desktop.`}
        className={cn(
          'flex touch-manipulation items-start gap-1.5 border-l-2 py-1 pr-0.5 pl-2 transition-colors',
          'border-[color:var(--divider)]',
          'hover:border-[color:var(--accent-line)] hover:bg-[var(--surface-2)]',
          'active:bg-[var(--surface-3)]',
          bolehUbah ? 'cursor-grab active:cursor-grabbing' : '',
          'focus-visible:border-[color:var(--accent)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none',
          diseret && 'cursor-grabbing opacity-40',
        )}
      >
        {ubah ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <textarea
              id={`input_ubah_butir_${poin.id}`}
              value={draf}
              rows={2}
              aria-label={`Isi poin ${poin.deskripsi}`}
              onChange={(e) => setDraf(e.target.value)}
              className="w-full resize-y border bg-transparent p-1.5 text-[12px] leading-snug outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--divider)' }}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                id={`status_butir_${poin.id}`}
                value={statusDraf}
                onChange={(e) => setStatusDraf(e.target.value as StatusPapan)}
                aria-label={`Status poin ${poin.deskripsi}`}
                className="border bg-transparent px-1.5 py-1 text-[11px]"
                style={{ borderColor: 'var(--divider)' }}
              >
                {KOLOM_PAPAN.map((status) => (
                  <option
                    key={status}
                    value={status}
                    disabled={status === 'sudah' && !semuaSubpoinSelesai}
                  >
                    {JUDUL_KOLOM[status]}
                  </option>
                ))}
              </select>
              <button
                id={`btn_tambah_subpoin_${poin.id}`}
                type="button"
                disabled={subpoin.length >= 30}
                onClick={tambahSubpoin}
                className="flex items-center gap-1 text-[11px] text-[var(--accent-readable)] disabled:opacity-40"
              ><Plus size={11} /> subpoin</button>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  id={`btn_simpan_butir_${poin.id}`}
                  type="button"
                  disabled={sibuk || sibukSub !== null || draf.trim() === '' || (!teksBerubah && !statusBerubah)}
                  onClick={() => void simpan()}
                  aria-label={`Simpan poin ${poin.deskripsi}`}
                  className="grid size-6 shrink-0 place-items-center text-success enabled:hover:opacity-80 disabled:opacity-40"
                >
                  <Check size={12} />
                </button>
                <button
                  id={`btn_batal_butir_${poin.id}`}
                  type="button"
                  onClick={batalUbah}
                  aria-label={`Batal ubah poin ${poin.deskripsi}`}
                  className="grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <Undo2 size={12} />
                </button>
                <Popover open={konfirmasiHapus} onOpenChange={setKonfirmasiHapus}>
                  <PopoverTrigger asChild>
                    <button
                      id={`btn_hapus_butir_${poin.id}`}
                      type="button"
                      aria-label={`Hapus poin ${poin.deskripsi}`}
                      className="grid size-6 shrink-0 place-items-center text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 border border-foreground/30 p-2">
                    <p className="text-xs">Hapus poin ini?</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        id={`btn_yakin_hapus_butir_${poin.id}`}
                        type="button"
                        disabled={sibuk || sibukSub !== null}
                        onClick={() => void hapus()}
                        className="text-xs font-medium text-destructive disabled:opacity-40"
                      >
                        Ya, hapus
                      </button>
                      <button id={`btn_batal_hapus_butir_${poin.id}`} type="button" onClick={() => setKonfirmasiHapus(false)} className="text-xs text-muted-foreground hover:text-foreground">Batal</button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {subpoin.map((item, indeks) => (
              <div key={indeks} className="flex items-start gap-1">
                <textarea
                  id={`input_subpoin_${poin.id}_${indeks}`}
                  value={item.teks}
                  rows={1}
                  maxLength={500}
                  aria-label={`Subpoin ${indeks + 1}`}
                  onChange={(e) => setSubpoin(subpoin.map((x, i) => (i === indeks ? { ...x, teks: e.target.value } : x)))}
                  className="min-w-0 flex-1 resize-y border bg-transparent p-1.5 text-[11px]"
                  style={{ borderColor: 'var(--divider)' }}
                />
                <button
                  id={`btn_simpan_subpoin_${poin.id}_${indeks}`}
                  type="button"
                  disabled={sibukSub !== null || item.teks.trim() === '' || item.teks.trim() === (asli[indeks]?.teks ?? '').trim()}
                  onClick={() => void simpanSubpoin(indeks)}
                  aria-label={`Simpan subpoin ${indeks + 1}`}
                  className="grid size-6 shrink-0 place-items-center text-success enabled:hover:opacity-80 disabled:opacity-40"
                >
                  <Check size={12} />
                </button>
                <button
                  id={`btn_hapus_subpoin_${poin.id}_${indeks}`}
                  type="button"
                  disabled={sibukSub !== null}
                  aria-label={`Hapus subpoin ${indeks + 1}`}
                  onClick={() => void hapusSubpoin(indeks)}
                  className="grid size-6 shrink-0 place-items-center p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                ><Trash2 size={11} /></button>
              </div>
            ))}
            {galat ? <p role="alert" className="text-[11px] text-destructive">{galat}</p> : null}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-[12px] leading-snug [overflow-wrap:anywhere]">
            <TeksButir deskripsi={poin.deskripsi} />
            {poin.subpoin.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                {poin.subpoin.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <input
                      id={`cek_subpoin_${poin.id}_${i}`}
                      type="checkbox"
                      checked={item.selesai}
                      disabled={!bolehUbah || sibukSub !== null}
                      onChange={() => void toggleSubpoin(i)}
                      aria-label={`Subpoin ${i + 1}: ${item.teks}`}
                      className="mt-[3px] size-3 shrink-0 accent-[var(--success)] disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1"><TeksButir deskripsi={item.teks} /></span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {!ubah && bolehUbah ? (
          <button
            id={`btn_ubah_papan_${idPoin}`}
            type="button"
            aria-label={`Ubah poin: ${poin.deskripsi}`}
            onClick={mulaiUbah}
            className="grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </div>
      {!ubah && galat ? (
        <p role="alert" className="pl-2 pb-1 text-[11px] text-destructive">{galat}</p>
      ) : null}
    </>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}
/**
 * Papan empat kolom untuk SEKELOMPOK kartu.
 *
 * Dipakai halaman /board (satu modul per tab). Perpindahan ditangani pemanggil
 * lewat onPindah supaya penyimpanan & pemulihan galat tinggal di satu tempat.
 */
export function PapanKolom({
  kartu,
  tampilkanModul,
  onPindah,
  bolehUbah = false,
  aksiButir,
  aksiSub,
  onTambahPoin,
  subKosong = [],
  riwayat,
  idAwalan,
  lipatAwal,
  onTambahSub,
}: {
  kartu: KartuPapan[];
  tampilkanModul: boolean;
  onPindah: (butirId: number, ke: StatusPapan) => Promise<void>;
  /** Bila false (default), kartu tidak bisa digeser dan tidak bisa disunting. */
  bolehUbah?: boolean;
  /** Aksi sunting untuk poin tertentu; wajib bila bolehUbah true. */
  aksiButir?: (poin: KartuPapan) => AksiButir;
  aksiSub?: (kartu: KartuSub) => AksiSub;
  onTambahPoin?: (kode: string, status: StatusPapan, deskripsi: string) => Promise<void>;
  subKosong?: SubPapan[];
  /** Riwayat ringkas yang ditampilkan di toolbar (kosong = tidak tampil). */
  riwayat?: RiwayatPapan[];
  /** Awalan id elemen supaya beberapa papan di satu halaman tidak bertabrakan. */
  idAwalan?: string;
  /** Status kolom yang mulai terlipat; bawaan kosong (semua terbuka). */
  lipatAwal?: StatusPapan[];
  /** Bila diisi, tombol tambah sub-modul muncul di kolom Akan & Sedang. */
  onTambahSub?: () => void;
}) {
  const [seret, setSeret] = useState<number | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set(lipatAwal));
  const [pengumuman, setPengumuman] = useState('');

  const awalan = idAwalan ?? 'papan';
  const kolom = useMemo(() => {
    const hasil = kelompokkanKolom(kartu);
    for (const sub of subKosong) {
      hasil[0].kartu.push({
        subKode: sub.kode,
        subNama: sub.nama,
        modulKode: '',
        modulNama: '',
        status: 'akan',
        poin: [],
        statusSub: 'akan',
      });
    }
    return hasil;
  }, [kartu, subKosong]);

  const jungkitLipat = useCallback((id: StatusPapan) => {
    setLipat((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function bersihkanSeret() {
    setSeret(null);
    setSasaran(null);
  }

  function mulaiSeret(poin: KartuPapan, e: DragEvent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(poin.id));
    setSeret(poin.id);
  }

  function indeksSisip(e: DragEvent, indeks: number): number {
    const kotak = (e.currentTarget as HTMLElement).getBoundingClientRect();

    return e.clientY > kotak.top + kotak.height / 2 ? indeks + 1 : indeks;
  }

  function diAtasKartu(e: DragEvent, kolomId: StatusPapan, indeks: number) {
    if (!seret) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const posisi = indeksSisip(e, indeks);
    setSasaran((prev) =>
      prev && prev.kolom === kolomId && prev.indeks === posisi ? prev : { kolom: kolomId, indeks: posisi },
    );
  }

  function diAtasKolom(e: DragEvent, kolomId: StatusPapan, jumlah: number) {
    if (!seret) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSasaran((prev) =>
      prev && prev.kolom === kolomId && prev.indeks === jumlah ? prev : { kolom: kolomId, indeks: jumlah },
    );
  }

  function tinggalkanKolom(e: DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setSasaran(null);
  }

  async function jatuhkan(e: DragEvent, kolomId: StatusPapan) {
    e.preventDefault();
    if (seret === null) return;
    const id = seret;
    const asal = kartu.find((k) => k.id === id);
    bersihkanSeret();

    if (!asal || asal.status === kolomId) return;

    // Pengumuman menyebut sub-modul DAN isi poinnya, karena kini satu
    // sub-modul bisa muncul di beberapa kolom sekaligus.
    setPengumuman(`Poin ${asal.subKode} "${asal.deskripsi}" dipindahkan ke ${kolomId}.`);
    await onPindah(id, kolomId);
  }

  /**
   * Pindah kartu satu kolom ke kiri/kanan (jalur keyboard).
   *
   * Urutan kolom mengikuti tampilan (lihat KOLOM_PAPAN), bukan urutan
   * kepentingan status, supaya arah panah terasa sama dengan matanya.
   */
  async function pindahArah(kartu: KartuPapan, arah: -1 | 1) {
    const tujuan = kolomSebelah(kartu.status, arah);

    if (tujuan === null) {
      setPengumuman(`Poin ${kartu.subKode} sudah di kolom paling ${arah === -1 ? 'kiri' : 'kanan'}.`);

      return;
    }

    setPengumuman(`Poin ${kartu.subKode} "${kartu.deskripsi}" dipindahkan ke ${tujuan}.`);
    await onPindah(kartu.id, tujuan);
  }

  return (
    <>
      <div id={`status_${awalan}`} role="status" aria-live="polite" className="sr-only">
        {pengumuman}
      </div>

      {riwayat && riwayat.length > 0 ? (
        <div className="flex items-center gap-3 px-3 pb-2 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground"
              title="Aktivitas papan"
            >
              <History size={12} style={{ color: 'inherit' }} />
              <span className="hidden sm:inline">Aktivitas papan</span>
            </span>
            <ul
              aria-label="Aktivitas terakhir di papan"
              className="scroll-tanpa-bar flex min-w-0 items-center gap-3 overflow-x-auto text-[11px] text-muted-foreground"
            >
              {riwayat.slice(0, 6).map((r, i) => (
                <li
                  key={`${r.kode}-${r.waktu}-${i}`}
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums"
                  title={r.waktu}
                >
                  <span className="font-mono text-[10px] font-semibold text-foreground/75">{r.kode}</span>
                  <span>{r.dari ?? '-'}</span>
                  <span aria-hidden="true" className="text-muted-foreground/50">→</span>
                  <span>{r.ke}</span>
                  <span className="hidden text-[10px] opacity-60 sm:inline">{r.waktu}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overscroll-x-contain px-3 pb-4 sm:px-6 sm:pb-6">
        {kolom.map((item) => {
          const terlipatKolom = lipat.has(item.id);
          const disorot = sasaran?.kolom === item.id && seret !== null;

          return (
            <section
              key={item.id}
              id={`kolom_${awalan}_${item.id}`}
              aria-label={`Kolom ${item.judul}, ${item.kartu.length} kartu`}
              onDragOver={(e) => diAtasKolom(e, item.id, item.kartu.length)}
              onDragLeave={tinggalkanKolom}
              onDrop={(e) => void jatuhkan(e, item.id)}
              className={cn(
                'flex max-h-full shrink-0 flex-col border',
                // Terlipat: lebar tetap sempit. Terbuka: berbagi lebar layar
                // sama rata (basis 0 + grow), tapi TIDAK boleh lebih sempit
                // dari 240px — di layar ponsel kolom bergulir horizontal,
                // bukan meremas teks sampai tumpang tindih.
                terlipatKolom ? 'w-11 cursor-pointer items-center' : 'min-w-[240px] flex-1 basis-0',
              )}
              style={{
                background: disorot ? 'color-mix(in srgb, var(--accent) 6%, var(--sunken))' : 'var(--sunken)',
                borderColor: disorot ? 'var(--accent-line)' : 'var(--divider)',
              }}
            >
              <span
                aria-hidden="true"
                className="h-[2px] w-full shrink-0"
                style={{ background: WARNA_STATUS[item.id] }}
              />
              {terlipatKolom ? (
                <button
                  id={`btn_buka_${awalan}_${item.id}`}
                  type="button"
                  aria-label={`Buka kolom ${item.judul}`}
                  aria-expanded={false}
                  onClick={() => jungkitLipat(item.id)}
                  className="flex w-full flex-1 cursor-pointer flex-col items-center gap-2 pt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus size={13} style={{ color: 'inherit' }} />
                  <span className="[writing-mode:vertical-rl]">{item.judul} · {item.kartu.length}</span>
                </button>
              ) : (
                <>
                  <header className="flex items-center gap-2 pt-[10px] pr-2 pb-2 pl-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <h2
                        className="truncate text-[12.5px] leading-snug font-semibold"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {item.judul}
                      </h2>
                      <span
                        className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center border px-1 font-mono text-[10px] font-medium text-muted-foreground tabular-nums"
                        style={{ borderColor: 'var(--divider)' }}
                        title={`${item.kartu.length} kartu`}
                      >
                        {item.kartu.length}
                      </span>
                    </div>
                    {bolehUbah && onTambahSub && (item.id === 'akan' || item.id === 'sedang') ? (
                      <button
                        id={`btn_tambah_sub_${awalan}_${item.id}`}
                        type="button"
                        aria-label={`Tambah sub-modul di kolom ${item.judul}`}
                        title="Tambah sub-modul"
                        onClick={onTambahSub}
                        className="grid size-6 shrink-0 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-[var(--surface-3)] hover:text-foreground"
                      >
                        <Plus size={13} style={{ color: 'inherit' }} />
                      </button>
                    ) : null}
                    <button
                      id={`btn_lipat_${awalan}_${item.id}`}
                      type="button"
                      aria-label={`Lipat kolom ${item.judul}`}
                      aria-expanded={true}
                      onClick={() => jungkitLipat(item.id)}
                      className="grid size-6 shrink-0 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-[var(--surface-3)] hover:text-foreground"
                    >
                      <Minus size={13} style={{ color: 'inherit' }} />
                    </button>
                  </header>

                  <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {item.kartu.length === 0 ? (
                      <div
                        className="pointer-events-none flex flex-1 items-center justify-center border border-dashed px-3 py-6 text-center text-[11px] leading-relaxed text-muted-foreground"
                        style={{ borderColor: 'var(--divider)' }}
                      >
                        {bolehUbah ? 'Tarik poin ke sini' : 'Belum ada poin'}
                      </div>
                    ) : null}
                    {item.kartu.map((k, idx) => (
                      <div key={k.subKode} className="flex flex-col gap-1.5">
                        {sasaran && sasaran.kolom === item.id && sasaran.indeks === idx ? (
                          <GarisSisip id={`garis_${awalan}_${item.id}_${idx}`} />
                        ) : null}
                        <KartuPapan
                          kartu={k}
                          diseret={seret}
                          tampilkanModul={tampilkanModul}
                          onMulaiSeret={mulaiSeret}
                          onLepasSeret={bersihkanSeret}
                          onDiAtas={(e) => diAtasKartu(e, item.id, idx)}
                          onPindahArah={(poin, arah) => void pindahArah(poin, arah)}
                          bolehUbah={bolehUbah}
                          aksiKartu={
                            aksiButir
                              ? (poin) => aksiButir(poin)
                              : () => ({
                                  onSimpanTeks: async () => {},
                                  onSimpanSubpoin: async () => {},
                                  onHapus: async () => {},
                                })
                          }
                          aksiSub={aksiSub}
                          onTambahPoin={onTambahPoin}
                        />
                      </div>
                    ))}
                    {sasaran && sasaran.kolom === item.id && sasaran.indeks >= item.kartu.length ? (
                      <GarisSisip id={`garis_${awalan}_${item.id}_akhir`} />
                    ) : null}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
