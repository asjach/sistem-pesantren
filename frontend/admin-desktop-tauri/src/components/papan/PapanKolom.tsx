import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from '@/icons';
import { muatRiwayatPapan, pindahStatusPapan, type RiwayatPapan, type StatusPapan } from '@/api/papan';
import { kelompokkanKolom, type KartuPapan } from '@/lib/papan';
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

/** Kartu papan: satu sub-modul, dengan ringkasan butir per status. */
export function KartuPapan({
  kartu,
  diseret,
  kolomKini,
  tujuan,
  tampilkanModul,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindah,
  onBuka,
}: {
  kartu: KartuPapan;
  diseret: boolean;
  kolomKini: StatusPapan;
  tujuan: { id: StatusPapan; judul: string }[];
  /** Tampilkan nama modul di kartu. Di halaman per-modul ini berulang, jadi bisa dimatikan. */
  tampilkanModul: boolean;
  onMulaiSeret: (e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  onPindah: (ke: StatusPapan) => void;
  onBuka: () => void;
}) {
  const total = kartu.butir.length;
  const idKartu = kartu.kode.replace('.', '_');

  return (
    <article
      id={`kartu_papan_${idKartu}`}
      draggable="true"
      onDragStart={onMulaiSeret}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      aria-label={`${kartu.kode} ${kartu.nama}. Seret untuk memindahkan.`}
      className={cn(
        'flex cursor-grab flex-col gap-2 p-[10px_12px] transition-shadow active:cursor-grabbing',
        diseret && 'opacity-40',
      )}
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-px font-mono text-[11px] font-semibold text-muted-foreground">{kartu.kode}</span>
        <button
          id={`btn_buka_papan_${idKartu}`}
          type="button"
          onClick={onBuka}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="min-w-0 flex-1 cursor-pointer text-left text-[13px] leading-snug font-medium hover:text-[var(--accent)]"
        >
          {kartu.nama}
        </button>
      </div>

      {tampilkanModul ? (
        <div className="flex flex-wrap gap-1">
          <Lencana label={kartu.modulNama} warna="var(--accent)" />
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <select
          id={`select_pindah_papan_${idKartu}`}
          aria-label={`Pindahkan ${kartu.kode} ${kartu.nama} ke kolom`}
          value=""
          onChange={(e) => {
            if (e.target.value !== '') onPindah(e.target.value as StatusPapan);
          }}
          onDragStart={(e) => e.preventDefault()}
          className="h-5 max-w-[6.5rem] cursor-pointer truncate border bg-transparent pr-0 text-[11px] outline-none hover:text-foreground focus:border-[var(--accent)]"
          style={{ borderColor: 'var(--divider)' }}
        >
          <option value="">Pindah...</option>
          {tujuan
            .filter((t) => t.id !== kolomKini)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.judul}
              </option>
            ))}
        </select>
        <span className="tabular-nums">{total} butir</span>
        <span
          className="ml-auto tabular-nums"
          aria-label={`${kartu.jumlahButir.sudah} dari ${total} butir selesai`}
        >
          {kartu.jumlahButir.sudah}/{total}
        </span>
      </div>

      {/* Butir ditampilkan langsung di kartu (tidak perlu klik). Dikelompokkan
          per status dengan urutan tetap, dan tiap butir diberi penanda warna
          statusnya sendiri supaya butir yang belum selesai tetap kelihatan
          walau kartunya ada di kolom "sudah". */}
      {total > 0 ? (
        <ul className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
          {KOLOM_KARTU.flatMap((s) =>
            kartu.butir
              .filter((b) => b.status === s)
              .map((b) => (
                <li key={b.id} className="flex items-start gap-1.5 text-[12px] leading-snug">
                  <span
                    aria-hidden="true"
                    className="mt-[5px] size-1.5 shrink-0"
                    style={{ background: WARNA_STATUS[b.status] }}
                  />
                  <span className="min-w-0 flex-1">
                    <TeksButir deskripsi={b.deskripsi} />
                  </span>
                </li>
              )),
          )}
        </ul>
      ) : null}
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
  onPindah: (kode: string, ke: StatusPapan) => Promise<void>;
  onBuka: (kartu: KartuPapan) => void;
  /** Riwayat ringkas yang ditampilkan di bawah judul (kosong = tidak tampil). */
  riwayat?: RiwayatPapan[];
  /** Awalan id elemen supaya beberapa papan di satu halaman tidak bertabrakan. */
  idAwalan?: string;
}) {
  const [seret, setSeret] = useState<string | null>(null);
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

  function mulaiSeret(e: DragEvent, kode: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', kode);
    setSeret(kode);
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
    if (!seret) return;
    const kode = seret;
    const asal = kartu.find((k) => k.kode === kode);
    bersihkanSeret();

    if (!asal || asal.status === kolomId) return;

    setPengumuman(`${kode} ${asal.nama} dipindahkan ke ${kolomId}.`);
    await onPindah(kode, kolomId);
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
                      <div key={k.kode} className="flex flex-col gap-1.5">
                        {sasaran && sasaran.kolom === item.id && sasaran.indeks === idx ? (
                          <GarisSisip id={`garis_${awalan}_${item.id}_${idx}`} />
                        ) : null}
                        <KartuPapan
                          kartu={k}
                          diseret={seret === k.kode}
                          kolomKini={item.id}
                          tujuan={kolom.map((c) => ({ id: c.id, judul: c.judul }))}
                          tampilkanModul={tampilkanModul}
                          onMulaiSeret={(e) => mulaiSeret(e, k.kode)}
                          onLepasSeret={bersihkanSeret}
                          onDiAtas={(e) => diAtasKartu(e, item.id, idx)}
                          onPindah={(ke) => void onPindah(k.kode, ke)}
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

/** Dialog daftar butir satu sub-modul. */
export function DialogButir({ kartu, onTutup }: { kartu: KartuPapan; onTutup: () => void }) {
  return (
    <div
      id="dialog_butir_papan"
      role="dialog"
      aria-label={`Butir ${kartu.kode}`}
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
          <span className="font-mono text-xs font-semibold text-muted-foreground">{kartu.kode}</span>
          <h3 className="text-sm font-semibold">{kartu.nama}</h3>
          <button
            id="btn_tutup_butir_papan"
            type="button"
            onClick={onTutup}
            className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            Tutup
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {kartu.butir.map((b) => (
            <li key={b.id} className="flex items-start gap-2 text-[13px] leading-snug">
              <Lencana label={b.status} warna={WARNA_STATUS[b.status]} />
              <span className="min-w-0 flex-1">
                <TeksButir deskripsi={b.deskripsi} />
              </span>
            </li>
          ))}
          {kartu.butir.length === 0 ? (
            <li className="text-xs text-muted-foreground">Belum ada butir.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
