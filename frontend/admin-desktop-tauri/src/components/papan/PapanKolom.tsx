import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronDown } from '@/icons';
import type { RiwayatPapan, StatusPapan } from '@/api/papan';
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
  buka,
  onBukaUbah,
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
  /** Popover rincian poin sedang terbuka untuk kartu ini. */
  buka: boolean;
  onBukaUbah: (buka: boolean) => void;
}) {
  const idKartu = `butir_${kartu.id}`;

  return (
    // Kartu ini SENGAJA fokusable: seret tidak bisa dipakai keyboard, jadi
    // panah kiri/kanan disediakan sebagai jalur setara (lihat onKeyDown).
    // Tanpa tabIndex + handler itu, memindah poin jadi mustahil tanpa mouse.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <article
      id={`kartu_papan_${idKartu}`}
      role="group"
      draggable="true"
      tabIndex={0}
      onDragStart={onMulaiSeret}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        onPindahArah(e.key === 'ArrowLeft' ? -1 : 1);
      }}
      aria-label={`${kartu.subKode} ${kartu.deskripsi}. Seret, atau pakai panah kiri dan kanan, untuk memindahkan poin ini.`}
      className={cn(
        // Border, latar, dan bayangan datang dari .kartu (index.css) supaya
        // kartu papan tidak menyimpang dari kartu lain di aplikasi.
        // focus-visible ditambahkan di sini: kartu ini fokusable lewat Tab
        // untuk jalur keyboard, dan .kartu hanya mengatur :hover.
        'kartu flex cursor-grab flex-col gap-2 p-[10px_12px]',
        'focus-visible:border-[var(--border-strong)] focus-visible:outline-none',
        diseret && 'opacity-40',
      )}
    >
      {/* Judul kartu = sub-modul induk. Diulang di tiap poin dengan sengaja:
          satu sub-modul kini bisa muncul di beberapa kolom sekaligus, jadi
          tiap kartu harus bisa menjelaskan dirinya sendiri. */}
      <div className="flex items-start gap-2">
        <span className="mt-px font-mono text-[11px] font-semibold text-muted-foreground">
          {kartu.subKode}
        </span>
        {/* Rincian poin dibuka sebagai POPOVER yang menempel di judul,
            bukan dialog penuh layar: yang dibaca cuma satu poin, dan
            popover membiarkan poin itu tetap terlihat di papan.
            PopoverTrigger dipakai sebagai judulnya; ia yang membuka panel
            saat diklik (Anchor tidak membuka apa pun). Warna judul TETAP -
            tidak berubah saat hover, karena efek hover ada di border kartu
            (lihat .kartu:hover di index.css). */}
        <PopoverButir
          kartu={kartu}
          terbuka={buka}
          onBukaUbah={onBukaUbah}
          idTombol={`btn_buka_papan_${idKartu}`}
        />
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
  riwayat,
  idAwalan,
}: {
  kartu: KartuPapan[];
  tampilkanModul: boolean;
  onPindah: (butirId: number, ke: StatusPapan) => Promise<void>;
  /** Riwayat ringkas yang ditampilkan di bawah judul (kosong = tidak tampil). */
  riwayat?: RiwayatPapan[];
  /** Awalan id elemen supaya beberapa papan di satu halaman tidak bertabrakan. */
  idAwalan?: string;
}) {
  const [seret, setSeret] = useState<number | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set());
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

    setPengumuman(`Poin ${kartu.subKode} "${kartu.deskripsi}" dipindahkan ke ${tujuan}.`);
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
                          buka={rincian === k.id}
                          onBukaUbah={(b) => setRincian(b ? k.id : null)}
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

/** Isi panel rincian poin, dipakai di dalam PopoverButir. */
function IsiButir({ kartu }: { kartu: KartuPapan }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold text-muted-foreground">{kartu.subKode}</span>
        <h3 className="text-sm font-semibold">{kartu.subNama}</h3>
      </div>

      <div className="flex items-center gap-2">
        <Lencana label={kartu.status} warna={WARNA_STATUS[kartu.status]} />
      </div>

      <p className="text-[13px] leading-snug">
        <TeksButir deskripsi={kartu.deskripsi} />
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-xs" style={{ borderColor: 'var(--divider)' }}>
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
  );
}

/**
 * Popover rincian satu poin, dibuka dari judul kartu.
 *
 * Dulu ini dialog yang menutupi seluruh papan dengan lapisan gelap.
 * Rincian satu poin tidak sepadan dengan gangguan sebesar itu - dan
 * popover membuat poin yang sedang dibaca tetap terlihat di papan.
 * Ditempelkan ke judul kartu lewat PopoverAnchor, jadi posisinya
 * mengikuti kartunya, bukan di tengah layar.
 */
export function PopoverButir({
  kartu,
  terbuka,
  onBukaUbah,
  idTombol,
}: {
  kartu: KartuPapan;
  terbuka: boolean;
  onBukaUbah: (buka: boolean) => void;
  idTombol: string;
}) {
  return (
    <Popover open={terbuka} onOpenChange={onBukaUbah}>
      {/* PopoverTrigger (bukan PopoverAnchor): Anchor hanya menandai
          posisi dan TIDAK membuka popover saat diklik - kliknya diam
          saja. Trigger merender <button> sendiri, jadi tombol judul
          tidak lagi dibuat terpisah. */}
      <PopoverTrigger
        id={idTombol}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        // Warna judul memakai --accent-readable, bukan --primary mentah:
        // --primary di tema gelap cuma 2.10:1 terhadap lantai kartu (jauh
        // di bawah ambang 4.5:1), sementara accent-readable mencampur
        // accent dengan foreground sehingga ikut menyesuaikan tema.
        className="min-w-0 flex-1 cursor-pointer text-left text-[13px] leading-snug font-medium text-[var(--accent-readable)]"
      >
        {kartu.subNama}
      </PopoverTrigger>
      {/* p-0 dipakai supaya IsiButir yang mengatur paddingnya sendiri;
          border dan bayangan datang dari PopoverContent bawaan (rounded-md
          tidak berpengaruh di proyek ini karena --radius-semua: 0px). */}
      <PopoverContent
        id="pop_butir_papan"
        side="bottom"
        align="start"
        className="w-[min(400px,90vw)] p-0"
      >
        <IsiButir kartu={kartu} />
      </PopoverContent>
    </Popover>
  );
}
