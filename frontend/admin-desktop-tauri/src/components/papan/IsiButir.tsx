import { useState } from 'react';

import type { StatusPapan } from '@/api/papan';
import { JUDUL_KOLOM, KOLOM_PAPAN } from '@/api/papan';
import { Button } from '@/components/ui/button';
import { X } from '@/icons';
import type { KartuPapan } from '@/lib/papan';
import { TeksButir } from './PapanKolom';

/** Aksi yang bisa sedang berjalan di panel; '' = tidak ada. */
type Sibuk = '' | 'status' | 'naik' | 'turun';

const WARNA_STATUS: Record<StatusPapan, string> = {
  sudah: 'var(--success)',
  sedang: 'var(--warning)',
  akan: 'var(--info)',
  ditunda: 'var(--muted-foreground)',
};

/**
 * Panel rincian satu poin, terbuka langsung di dalam kartu sub-modul.
 *
 * Penyuntingan teks dan subpoin ada di baris poin itu sendiri; panel ini
 * menangani perpindahan status dan urutan, plus konteks modul/sub-modul.
 */
export function IsiButir({
  kartu,
  bolehUbah,
  onSimpanStatus,
  onNaik,
  onTurun,
  onTutup,
}: {
  kartu: KartuPapan;
  /** Bila false, panel hanya menampilkan rincian tanpa satu pun kontrol. */
  bolehUbah: boolean;
  onSimpanStatus: (status: StatusPapan) => Promise<void>;
  onNaik: () => Promise<void>;
  onTurun: () => Promise<void>;
  onTutup: () => void;
}) {
  // Melacak aksi MANA yang sedang berjalan, bukan sekadar 'ada yang
  // berjalan'. Dengan begitu menekan Naik tidak ikut mematikan tombol
  // Turun - keduanya aksi berbeda pada poin yang sama, dan memblokir
  // yang satu karena yang lain sibuk hanya membuat klik pengguna hilang.
  const [sibuk, setSibuk] = useState<Sibuk>('');
  const [galat, setGalat] = useState('');

  /** Jalankan aksi yang menyentuh server; seragamkan status sibuk & galat. */
  async function jalan(label: Sibuk, aksi: () => Promise<void>) {
    setSibuk(label);
    setGalat('');

    try {
      await aksi();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSibuk('');
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        className="flex items-start gap-2 border-b pb-3"
        style={{ borderColor: 'var(--divider)' }}
      >
        <span className="mt-px shrink-0 bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          {kartu.subKode}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--accent-readable)]">
          {kartu.subNama}
        </h3>
        <Button
          id="btn_tutup_butir_papan"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Tutup rincian"
          title="Tutup"
          onClick={onTutup}
          className="-mt-1 -mr-1 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X size={14} style={{ color: 'inherit' }} />
        </Button>
      </div>

      {galat !== '' ? (
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
        >
          {galat}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <LencanaStatus status={kartu.status} />
      </div>

      <p className="text-[13px] leading-relaxed">
        <TeksButir deskripsi={kartu.deskripsi} />
      </p>

      {bolehUbah ? (
        <div className="flex flex-col gap-2">
          <GantiStatus
            status={kartu.status}
            sibuk={sibuk}
            onGanti={(s) => void jalan('status', () => onSimpanStatus(s))}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Urutan</span>
            <Button
              id="btn_naik_butir_papan"
              type="button"
              variant="outline"
              size="sm"
              disabled={sibuk === 'naik'}
              onClick={() => void jalan('naik', onNaik)}
            >
              Naik
            </Button>
            <Button
              id="btn_turun_butir_papan"
              type="button"
              variant="outline"
              size="sm"
              disabled={sibuk === 'turun'}
              onClick={() => void jalan('turun', onTurun)}
            >
              Turun
            </Button>
          </div>
        </div>
      ) : null}

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

/** Pilih status baru untuk poin (pengganti drag saat mengedit rincian). */
function GantiStatus({
  status,
  sibuk,
  onGanti,
}: {
  status: StatusPapan;
  sibuk: Sibuk;
  onGanti: (s: StatusPapan) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Pindah ke</span>
      {KOLOM_PAPAN.filter((s) => s !== status).map((s) => (
        <Button
          key={s}
          id={`btn_status_${s}`}
          type="button"
          variant="outline"
          size="sm"
          disabled={sibuk !== ''}
          onClick={() => onGanti(s)}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0"
            style={{ background: WARNA_STATUS[s] }}
          />
          {JUDUL_KOLOM[s]}
        </Button>
      ))}
    </div>
  );
}

/** Lencana status poin, dipakai di mode baca. */
function LencanaStatus({ status }: { status: StatusPapan }) {
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1.5 px-2 text-[11px] font-medium"
      style={{
        color: WARNA_STATUS[status],
        background: `color-mix(in srgb, ${WARNA_STATUS[status]} 10%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0"
        style={{ background: WARNA_STATUS[status] }}
      />
      {JUDUL_KOLOM[status]}
    </span>
  );
}
