import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import type { StatusPapan } from '@/api/papan';
import { JUDUL_KOLOM, KOLOM_PAPAN } from '@/api/papan';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, X } from '@/icons';
import type { KartuPapan } from '@/lib/papan';
import { TeksButir } from './PapanKolom';

/** Warna lencana per status - samakan dengan kolom papan. */
/** Aksi yang bisa sedang berjalan di panel; '' = tidak ada. */
type Sibuk = '' | 'simpan' | 'naik' | 'turun';

const WARNA_STATUS: Record<StatusPapan, string> = {
  sudah: 'var(--success)',
  sedang: 'var(--warning)',
  akan: 'var(--info)',
  ditunda: 'var(--muted-foreground)',
};

/**
 * Panel rincian satu poin, dipakai di dalam popover kartu.
 *
 * Punya dua wajah: mode BACA dan mode UBAH. Saat boleh mengubah, ada tombol
 * sunting; setelah masuk mode ubah, teks dan statusnya bisa diganti sekaligus
 * lalu disimpan atau dibatalkan.
 *
 * Semua penyimpanan diserahkan ke pemanggil lewat callback, supaya komponen
 * ini tidak perlu tahu soal API, pemuatan ulang, atau penanganan galat.
 */
export function IsiButir({
  kartu,
  bolehUbah,
  onSimpanTeks,
  onSimpanStatus,
  onNaik,
  onTurun,
  onHapus,
  onTutup,
}: {
  kartu: KartuPapan;
  /** Bila false, panel hanya menampilkan rincian tanpa satu pun kontrol. */
  bolehUbah: boolean;
  onSimpanTeks: (deskripsi: string) => Promise<void>;
  onSimpanStatus: (status: StatusPapan) => Promise<void>;
  onNaik: () => Promise<void>;
  onTurun: () => Promise<void>;
  onHapus: () => Promise<void>;
  onTutup: () => void;
}) {
  const [mode, setMode] = useState<'baca' | 'ubah'>('baca');
  const [draf, setDraf] = useState(kartu.deskripsi);
  // Melacak aksi MANA yang sedang berjalan, bukan sekadar 'ada yang
  // berjalan'. Dengan begitu menekan Naik tidak ikut mematikan tombol
  // Turun - keduanya aksi berbeda pada poin yang sama, dan memblokir
  // yang satu karena yang lain sibuk hanya membuat klik pengguna hilang.
  const [sibuk, setSibuk] = useState<Sibuk>('');
  const [galat, setGalat] = useState('');
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  // autoFocus dilarang aturan a11y (menyerobot fokus tanpa diminta).
  // Fokus dipindah ke kotak teks HANYA setelah pengguna sendiri menekan
  // Ubah - momen itu memang meminta fokus, jadi aman dan tidak mengejutkan.
  const kotakTeks = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (mode === 'ubah') {
      kotakTeks.current?.focus();
    }
  }, [mode]);

  /** Jalankan aksi yang menyentuh server; seragamkan status sibuk & galat. */
  async function jalan(label: 'simpan' | 'naik' | 'turun', aksi: () => Promise<void>) {
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

  async function simpanTeks() {
    const teks = draf.trim();

    if (teks === '' || teks === kartu.deskripsi) {
      setMode('baca');

      return;
    }

    await jalan('simpan', async () => {
      await onSimpanTeks(teks);
      setMode('baca');
    });
  }

  return (
    <div className="flex max-h-[min(70vh,640px)] flex-col gap-3 overflow-y-auto p-4">
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

      {mode === 'baca' ? (
        <BacaButir
          kartu={kartu}
          sibuk={sibuk}
          bolehUbah={bolehUbah}
          konfirmasiHapus={konfirmasiHapus}
          onMulaiUbah={() => {
            setDraf(kartu.deskripsi);
            setMode('ubah');
          }}
          onGantiStatus={(s) => void jalan('simpan', () => onSimpanStatus(s))}
          onNaik={() => void jalan('naik', onNaik)}
          onTurun={() => void jalan('turun', onTurun)}
          onMintaKonfirmasiHapus={() => setKonfirmasiHapus(true)}
          onBatalHapus={() => setKonfirmasiHapus(false)}
          onHapus={() => void jalan('simpan', async () => { await onHapus(); onTutup(); })}
        />
      ) : (
        <UbahButir
          draf={draf}
          setDraf={setDraf}
          sibuk={sibuk}
          kotak={kotakTeks}
          onSimpan={() => void simpanTeks()}
          onBatal={() => setMode('baca')}
        />
      )}
    </div>
  );
}

/** Mode baca: rincian poin + kontrol bila pengguna berizin mengubah. */
function BacaButir({
  kartu,
  sibuk,
  bolehUbah,
  konfirmasiHapus,
  onMulaiUbah,
  onGantiStatus,
  onNaik,
  onTurun,
  onMintaKonfirmasiHapus,
  onBatalHapus,
  onHapus,
}: {
  kartu: KartuPapan;
  sibuk: Sibuk;
  bolehUbah: boolean;
  konfirmasiHapus: boolean;
  onMulaiUbah: () => void;
  onGantiStatus: (s: StatusPapan) => void;
  onNaik: () => void;
  onTurun: () => void;
  onMintaKonfirmasiHapus: () => void;
  onBatalHapus: () => void;
  onHapus: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <LencanaStatus status={kartu.status} />
        {bolehUbah ? (
          <Button
            id="btn_ubah_butir_papan"
            type="button"
            variant="ghost"
            size="xs"
            onClick={onMulaiUbah}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <Pencil size={12} style={{ color: 'inherit' }} />
            Ubah
          </Button>
        ) : null}
      </div>

      <p className="text-[13px] leading-relaxed">
        <TeksButir deskripsi={kartu.deskripsi} />
      </p>

      {bolehUbah ? (
        <div className="flex flex-col gap-2">
          <GantiStatus status={kartu.status} sibuk={sibuk} onGanti={onGantiStatus} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">Urutan</span>
            <Button
              id="btn_naik_butir_papan"
              type="button"
              variant="outline"
              size="sm"
              disabled={sibuk === 'naik'}
              onClick={onNaik}
            >
              Naik
            </Button>
            <Button
              id="btn_turun_butir_papan"
              type="button"
              variant="outline"
              size="sm"
              disabled={sibuk === 'turun'}
              onClick={onTurun}
            >
              Turun
            </Button>
            {konfirmasiHapus ? (
              <div className="ml-auto flex flex-wrap items-center gap-2 border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                <span className="text-xs">Hapus poin ini?</span>
                <button
                  id="btn_yakin_hapus_butir"
                  type="button"
                  disabled={sibuk !== ''}
                  onClick={onHapus}
                  className="cursor-pointer text-xs font-medium text-destructive disabled:opacity-40"
                >
                  Ya, hapus
                </button>
                <button
                  id="btn_batal_hapus_butir"
                  type="button"
                  onClick={onBatalHapus}
                  className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                id="btn_hapus_butir_papan"
                type="button"
                disabled={sibuk !== ''}
                onClick={onMintaKonfirmasiHapus}
                className="ml-auto flex cursor-pointer items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="size-3" style={{ color: 'inherit' }} />
                Hapus
              </button>
            )}
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
    </>
  );
}

/** Mode ubah: sunting teks poin. */
function UbahButir({
  draf,
  setDraf,
  kotak,
  sibuk,
  onSimpan,
  onBatal,
}: {
  draf: string;
  setDraf: (s: string) => void;
  sibuk: Sibuk;
  onSimpan: () => void;
  onBatal: () => void;
  /** Kotak teksnya, dipakai induk untuk memfokuskan tanpa autoFocus. */
  kotak: MutableRefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="input_ubah_butir" className="text-xs text-muted-foreground">
        Isi poin
      </label>
      <textarea
        id="input_ubah_butir"
        value={draf}
        rows={3}
        ref={kotak}
        onChange={(e) => setDraf(e.target.value)}
        className="w-full resize-y border bg-transparent p-2 text-[13px] leading-snug outline-none focus:border-[var(--accent)]"
        style={{ borderColor: 'var(--divider)' }}
      />
      <div className="flex items-center gap-2">
        <Button
          id="btn_simpan_butir_papan"
          type="button"
          size="sm"
          disabled={sibuk !== '' || draf.trim() === ''}
          onClick={onSimpan}
        >
          Simpan
        </Button>
        <Button
          id="btn_batal_ubah_butir"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBatal}
          className="text-muted-foreground hover:text-foreground"
        >
          Batal
        </Button>
      </div>
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
