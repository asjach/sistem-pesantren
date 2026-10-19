import { useCallback, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { History, Minus, MoreVertical, Plus } from '@/icons';
import type { RiwayatPapan, StatusPapan } from '@/api/papan';
import { kelompokkanKolom, kolomSebelah, type KartuPapan, type KartuSub } from '@/lib/papan';
import { pecahButir, type PotonganButir } from '@/lib/butirTeks';
import { IsiButir } from './IsiButir';

/**
 * Aksi yang bisa dilakukan dari panel rincian poin.
 *
 * Dikumpulkan jadi satu objek supaya tidak ada sepuluh prop terpisah yang
 * harus diteruskan berlapis dari halaman sampai ke panelnya.
 */
export interface AksiButir {
  onSimpanTeks: (deskripsi: string) => Promise<void>;
  onSimpanStatus: (status: StatusPapan) => Promise<void>;
  onNaik: () => Promise<void>;
  onTurun: () => Promise<void>;
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
 * punya popover rinciannya sendiri. Itu disengaja - satu sub-modul bisa
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
  buka,
  onBukaUbah,
  bolehUbah,
  aksiKartu,
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
  /** Id poin yang rinciannya sedang terbuka. */
  buka: number | null;
  onBukaUbah: (poinId: number | null) => void;
  bolehUbah: boolean;
  /** Aksi yang berlaku untuk sebuah poin di kartu ini. */
  aksiKartu: (poin: KartuPapan) => AksiButir;
}) {
  const idKartu = `sub_${kartu.subKode.replace('.', '_')}`;

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
        <span className="mt-px shrink-0 bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          {kartu.subKode}
        </span>
        <h3 className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-[var(--accent-readable)]">
          {kartu.subNama}
        </h3>
        {/* Jumlah poin di kolom ini; berguna saat poinnya panjang-panjang. */}
        <span
          className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center border px-1 font-mono text-[10px] text-muted-foreground tabular-nums"
          style={{ borderColor: 'var(--divider)' }}
          title={`${kartu.poin.length} poin di kolom ini`}
        >
          {kartu.poin.length}
        </span>
      </div>

      {tampilkanModul ? (
        <div className="flex flex-wrap gap-1">
          <Lencana label={kartu.modulNama} warna="var(--accent)" />
        </div>
      ) : null}

      {/* Daftar poin. Tiap baris sendiri-sendiri: diseret, fokusable lewat
          Tab, dan punya popover rincian. */}
      <div className="flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
        {kartu.poin.map((poin) => (
          <BarisPoin
            key={poin.id}
            poin={poin}
            diseret={diseret === poin.id}
            terbuka={buka === poin.id}
            onMulaiSeret={onMulaiSeret}
            onLepasSeret={onLepasSeret}
            onDiAtas={onDiAtas}
            onPindahArah={onPindahArah}
            onBukaUbah={onBukaUbah}
            bolehUbah={bolehUbah}
            aksi={aksiKartu(poin)}
          />
        ))}
      </div>
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
  terbuka,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindahArah,
  onBukaUbah,
  bolehUbah,
  aksi,
}: {
  poin: KartuPapan;
  diseret: boolean;
  terbuka: boolean;
  onMulaiSeret: (poin: KartuPapan, e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  onPindahArah: (poin: KartuPapan, arah: -1 | 1) => void;
  onBukaUbah: (poinId: number | null) => void;
  bolehUbah: boolean;
  aksi: AksiButir;
}) {
  const idPoin = `butir_${poin.id}`;

  return (
    // Baris ini SENGAJA fokusable: seret tidak bisa dipakai keyboard, jadi
    // panah kiri/kanan disediakan sebagai jalur setara (lihat onKeyDown).
    // Tanpa tabIndex + handler itu, memindah poin jadi mustahil tanpa mouse.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <div
      id={`kartu_papan_${idPoin}`}
      role="group"
      draggable={bolehUbah}
      tabIndex={0}
      onDragStart={(e) => onMulaiSeret(poin, e)}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      onClick={(e) => {
        // Tombol "..." sudah membuka popover sendiri; jangan buka dua kali.
        if ((e.target as HTMLElement).closest('button')) return;
        onBukaUbah(poin.id);
      }}
      onKeyDown={(e) => {
        // Enter/Space = jalur setara untuk membuka rincian, termasuk saat
        // pengguna hanya boleh membaca. Di layar sentuh ini alur utamanya,
        // karena drag HTML5 tidak berjalan dengan jari.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onBukaUbah(poin.id);
          return;
        }
        if (!bolehUbah) return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        onPindahArah(poin, e.key === 'ArrowLeft' ? -1 : 1);
      }}
      aria-label={`${poin.deskripsi}. Ketuk atau tekan Enter untuk rincian; seret atau pakai panah kiri/kanan untuk memindahkan di desktop.`}
      className={cn(
        'flex touch-manipulation items-start gap-1.5 border-l-2 py-1 pr-0.5 pl-2 transition-colors',
        'border-[color:var(--divider)]',
        'hover:border-[color:var(--accent-line)] hover:bg-[var(--surface-2)]',
        'active:bg-[var(--surface-3)]',
        bolehUbah ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        'focus-visible:border-[color:var(--accent)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none',
        diseret && 'cursor-grabbing opacity-40',
      )}
    >
      <span className="min-w-0 flex-1 text-[12px] leading-snug [overflow-wrap:anywhere]">
        <TeksButir deskripsi={poin.deskripsi} />
      </span>
      {/* Rincian poin dibuka sebagai POPOVER yang menempel di tombolnya,
          bukan dialog penuh layar: yang dibaca cuma satu poin, dan popover
          membiarkan poin itu tetap terlihat di papan. */}
      <PopoverButir
        kartu={poin}
        terbuka={terbuka}
        onBukaUbah={(b) => onBukaUbah(b ? poin.id : null)}
        idTombol={`btn_buka_papan_${idPoin}`}
        bolehUbah={bolehUbah}
        aksi={aksi}
      />
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}
/**
 * Papan empat kolom untuk SEKELOMPOK kartu.
 *
 * Dipakai halaman /papan (satu modul per tab). Perpindahan ditangani pemanggil
 * lewat onPindah supaya penyimpanan & pemulihan galat tinggal di satu tempat.
 */
export function PapanKolom({
  kartu,
  tampilkanModul,
  onPindah,
  bolehUbah = false,
  aksiButir,
  riwayat,
  idAwalan,
  lipatAwal,
  alat,
}: {
  kartu: KartuPapan[];
  tampilkanModul: boolean;
  onPindah: (butirId: number, ke: StatusPapan) => Promise<void>;
  /** Bila false (default), kartu tidak bisa digeser dan panel read-only. */
  bolehUbah?: boolean;
  /** Aksi sunting untuk poin tertentu; wajib bila bolehUbah true. */
  aksiButir?: (poin: KartuPapan) => AksiButir;
  /** Riwayat ringkas yang ditampilkan di toolbar (kosong = tidak tampil). */
  riwayat?: RiwayatPapan[];
  /** Awalan id elemen supaya beberapa papan di satu halaman tidak bertabrakan. */
  idAwalan?: string;
  /** Status kolom yang mulai terlipat; bawaan kosong (semua terbuka). */
  lipatAwal?: StatusPapan[];
  /** Aksi tambahan di ujung kanan toolbar (mis. tombol Kelola). */
  alat?: ReactNode;
}) {
  const [seret, setSeret] = useState<number | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set(lipatAwal));
  const [pengumuman, setPengumuman] = useState('');
  /** Id poin yang popover rinciannya sedang terbuka (null = tertutup). */
  const [rincian, setRincian] = useState<number | null>(null);

  const awalan = idAwalan ?? 'papan';
  const kolom = useMemo(() => kelompokkanKolom(kartu), [kartu]);

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

      {(riwayat && riwayat.length > 0) || alat ? (
        <div className="flex items-center gap-3 px-3 pb-2 sm:px-6">
          {riwayat && riwayat.length > 0 ? (
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
          ) : null}
          {alat ? <div className="ml-auto shrink-0">{alat}</div> : null}
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
                          buka={rincian}
                          onBukaUbah={setRincian}
                          bolehUbah={bolehUbah}
                          aksiKartu={
                            aksiButir
                              ? (poin) => aksiButir(poin)
                              : () => ({
                                  onSimpanTeks: async () => {},
                                  onSimpanStatus: async () => {},
                                  onNaik: async () => {},
                                  onTurun: async () => {},
                                  onHapus: async () => {},
                                })
                          }
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

/**
 * Popover rincian satu poin, dibuka dari tombol di baris poin.
 *
 * Dulu ini dialog yang menutupi seluruh papan dengan lapisan gelap.
 * Rincian satu poin tidak sepadan dengan gangguan sebesar itu - dan
 * popover membuat poin yang sedang dibaca tetap terlihat di papan.
 * Ditempelkan ke tombol rincian, jadi posisinya mengikuti baris poinnya,
 * bukan di tengah layar.
 */
export function PopoverButir({
  kartu,
  terbuka,
  onBukaUbah,
  idTombol,
  bolehUbah,
  aksi,
}: {
  kartu: KartuPapan;
  terbuka: boolean;
  onBukaUbah: (buka: boolean) => void;
  idTombol: string;
  /** Bila false, panel rincian tidak menampilkan kontrol sunting apa pun. */
  bolehUbah: boolean;
  aksi: AksiButir;
}) {
  return (
    <Popover open={terbuka} onOpenChange={onBukaUbah}>
      {/* PopoverTrigger (bukan PopoverAnchor): Anchor hanya menandai
          posisi dan TIDAK membuka popover saat diklik - kliknya diam
          saja. Trigger merender <button> sendiri, jadi tombol rincian
          cukup satu dan tidak perlu dibuat terpisah. */}
      <PopoverTrigger
        id={idTombol}
        type="button"
        title="Rincian poin"
        aria-label={`Buka rincian poin: ${kartu.deskripsi}`}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="grid size-6 shrink-0 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--accent-readable)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <MoreVertical size={13} style={{ color: 'inherit' }} />
      </PopoverTrigger>
      {/* p-0 dipakai supaya IsiButir yang mengatur paddingnya sendiri;
          border dan bayangan datang dari PopoverContent bawaan (rounded-md
          tidak berpengaruh di proyek ini karena --radius-semua: 0px). */}
      <PopoverContent
        id="pop_butir_papan"
        aria-label="Rincian poin"
        side="bottom"
        align="start"
        collisionPadding={8}
        className="w-[min(400px,calc(100vw_-_24px))] p-0"
      >
        <IsiButir kartu={kartu} bolehUbah={bolehUbah} onTutup={() => onBukaUbah(false)} {...aksi} />
      </PopoverContent>
    </Popover>
  );
}
