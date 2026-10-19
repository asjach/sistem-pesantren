import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from '@/icons';
import {
  muatRiwayatPapan,
  pindahStatusPapan,
  type RiwayatPapan,
  type StatusPapan,
} from '@/api/papan';
import { kelompokkanKolom, kolomSebelah, type KartuPapan } from '@/lib/papan';
import { pecahButir, type PotonganButir } from '@/lib/butirTeks';

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
const KOLOM_KARTU: readonly StatusPapan[] = ['akan', 'sedang', 'ditunda', 'sudah'];

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

/** Kartu papan: satu POIN (butir) beserta sub-modul induknya. */
export function KartuPapan({
  kartu,
  diseret,
  tampilkanModul,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindahArah,
  onBuka,
}: {
  kartu: KartuPapan;
  diseret: boolean;
  /** Tampilkan nama modul di kartu. Di halaman per-modul ini berulang, jadi bisa dimatikan. */
  tampilkanModul: boolean;
  onMulaiSeret: (e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  /** Pindah lewat keyboard (tanpa seret); arah -1 = kolom sebelumnya. */
  onPindahArah: (arah: -1 | 1) => void;
  onBuka: () => void;
}) {
  const idKartu = `butir_${kartu.id}`;

  return (
    <article
      id={`kartu_papan_${idKartu}`}
      draggable="true"
      tabIndex={0}
      onDragStart={onMulaiSeret}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      onKeyDown={(e) => {
        // Seret tidak bisa dipakai keyboard, jadi panah kiri/kanan
        // disediakan sebagai jalur setara - bukan combobox lagi.
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        onPindahArah(e.key === 'ArrowLeft' ? -1 : 1);
      }}
      aria-label={`${kartu.subKode} ${kartu.deskripsi}. Seret, atau pakai panah kiri dan kanan, untuk memindahkan poin ini.`}
      className={cn(
        'flex cursor-grab flex-col gap-2 p-[10px_12px] transition-shadow active:cursor-grabbing',
        diseret && 'opacity-40',
      )}
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Judul kartu = sub-modul induk. Diulang di tiap poin dengan sengaja:
          satu sub-modul kini bisa muncul di beberapa kolom sekaligus, jadi
          tiap kartu harus bisa menjelaskan dirinya sendiri. */}
      <div className="flex items-start gap-2">
        <span className="mt-px font-mono text-[11px] font-semibold text-muted-foreground">
          {kartu.subKode}
        </span>
        <button
          id={`btn_buka_papan_${idKartu}`}
          type="button"
          onClick={onBuka}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="min-w-0 flex-1 cursor-pointer text-left text-[13px] leading-snug font-medium hover:text-[var(--accent)]"
        >
          {kartu.subNama}
        </button>
      </div>

      {tampilkanModul ? (
        <div className="flex flex-wrap gap-1">
          <Lencana label={kartu.modulNama} warna="var(--accent)" />
        </div>
      ) : null}

      {/* Isi kartu = poinnya. Inilah yang berpindah antar kolom. */}
      <p className="border-t pt-2 text-[12px] leading-snug" style={{ borderColor: 'var(--divider)' }}>
        <TeksButir deskripsi={kartu.deskripsi} />
      </p>

      {/* Perpindahan status HANYA lewat seret (plus panah kiri/kanan untuk
          keyboard), jadi kartu tidak punya kontrol apa pun di footer - tidak
          combobox, tidak teks petunjuk, tidak nomor id. Kursor grab sudah
          memberi isyarat dan tidak ada lagi yang perlu dibaca di sana.
          Kartu tetap wajib draggable - lihat atribut di <article>. */}
    </article>
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
  onBuka,
  riwayat,
  idAwalan,
}: {
  kartu: KartuPapan[];
  tampilkanModul: boolean;
  onPindah: (butirId: number, ke: StatusPapan) => Promise<void>;
  onBuka: (kartu: KartuPapan) => void;
  /** Riwayat ringkas yang ditampilkan di bawah judul (kosong = tidak tampil). */
  riwayat?: RiwayatPapan[];
  /** Awalan id elemen supaya beberapa papan di satu halaman tidak bertabrakan. */
  idAwalan?: string;
}) {
  const [seret, setSeret] = useState<number | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set());
  const [pengumuman, setPengumuman] = useState('');

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

  function mulaiSeret(e: DragEvent, id: number) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    setSeret(id);
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

    setPengumuman(`Poin ${kartu.subKode} \"${kartu.deskripsi}\" dipindahkan ke ${tujuan}.`);
    await onPindah(kartu.id, tujuan);
  }

  return (
    <>
      <div id={`status_${awalan}`} role="status" aria-live="polite" className="sr-only">
        {pengumuman}
      </div>

      {riwayat && riwayat.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-2 text-xs text-muted-foreground">
          {riwayat.slice(0, 6).map((r, i) => (
            <li key={`${r.kode}-${r.waktu}-${i}`} className="tabular-nums">
              <span className="font-mono">{r.kode}</span> {r.dari ?? '-'} {'→'} {r.ke}
              <span className="ml-1 opacity-70">{r.waktu}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
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
                // sama rata (basis 0 + grow), jadi empat kolom selalu mengisi
                // penuh tanpa menyisakan ruang kosong di kanan.
                terlipatKolom ? 'w-11 cursor-pointer items-center pt-2' : 'min-w-0 flex-1 basis-0',
              )}
              style={{
                background: disorot ? 'color-mix(in srgb, var(--accent) 6%, var(--sunken))' : 'var(--sunken)',
                borderColor: disorot ? 'var(--accent-line)' : 'var(--divider)',
              }}
            >
              {terlipatKolom ? (
                <button
                  type="button"
                  onClick={() => jungkitLipat(item.id)}
                  className="cursor-pointer text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]"
                >
                  {item.judul} . {item.kartu.length}
                </button>
              ) : (
                <>
                  <header className="flex items-center gap-[7px] pt-[10px] pr-2 pb-1.5 pl-3 text-[12.5px] font-semibold">
                    {item.judul}
                    <span className="font-medium text-muted-foreground tabular-nums">{item.kartu.length}</span>
                    <button
                      id={`btn_lipat_${awalan}_${item.id}`}
                      type="button"
                      aria-label={`Lipat kolom ${item.judul}`}
                      onClick={() => jungkitLipat(item.id)}
                      className="ml-auto grid size-[26px] place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </header>

                  <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {item.kartu.map((k, idx) => (
                      <div key={k.id} className="flex flex-col gap-1.5">
                        {sasaran && sasaran.kolom === item.id && sasaran.indeks === idx ? (
                          <GarisSisip id={`garis_${awalan}_${item.id}_${idx}`} />
                        ) : null}
                        <KartuPapan
                          kartu={k}
                          diseret={seret === k.id}
                          tampilkanModul={tampilkanModul}
                          onMulaiSeret={(e) => mulaiSeret(e, k.id)}
                          onLepasSeret={bersihkanSeret}
                          onDiAtas={(e) => diAtasKartu(e, item.id, idx)}
                          onPindahArah={(arah) => void pindahArah(k, arah)}
                          onBuka={() => onBuka(k)}
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
 * Dialog rincian satu POIN.
 *
 * Sejak kartu papan adalah poin itu sendiri, dialog ini tidak lagi memuat
 * daftar butir: yang ditampilkan adalah poin lengkap beserta konteks
 * sub-modul dan modul induknya.
 */
export function DialogButir({ kartu, onTutup }: { kartu: KartuPapan; onTutup: () => void }) {
  return (
    <div
      id="dialog_butir_papan"
      role="dialog"
      aria-label={`Poin ${kartu.subKode}`}
      className="absolute inset-0 z-20 grid place-items-center"
      style={{ background: 'color-mix(in srgb, var(--foreground) 24%, transparent)' }}
      onClick={onTutup}
    >
      <div
        className="max-h-[70vh] w-[min(560px,90vw)] overflow-y-auto border p-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--divider)', boxShadow: 'var(--shadow-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">{kartu.subKode}</span>
          <h3 className="text-sm font-semibold">{kartu.subNama}</h3>
          <button
            id="btn_tutup_butir_papan"
            type="button"
            onClick={onTutup}
            className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            Tutup
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Lencana label={kartu.status} warna={WARNA_STATUS[kartu.status]} />
        </div>

        <p className="mt-2 text-[13px] leading-snug">
          <TeksButir deskripsi={kartu.deskripsi} />
        </p>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-xs" style={{ borderColor: 'var(--divider)' }}>
          <dt className="text-muted-foreground">Modul</dt>
          <dd>
            {kartu.modulKode}. {kartu.modulNama}
          </dd>
          <dt className="text-muted-foreground">Sub-modul</dt>
          <dd>
            {kartu.subKode} {kartu.subNama}
          </dd>
          <dt className="text-muted-foreground">Status sub-modul</dt>
          <dd>
            {kartu.statusSub} <span className="text-muted-foreground">(turunan dari poin)</span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
