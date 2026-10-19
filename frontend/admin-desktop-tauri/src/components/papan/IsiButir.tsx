import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import type { StatusPapan } from '@/api/papan';
import { JUDUL_KOLOM, KOLOM_PAPAN } from '@/api/papan';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from '@/icons';
import type { KartuPapan } from '@/lib/papan';
import { TeksButir } from './PapanKolom';

/** Warna lencana per status - samakan dengan kolom papan. */
/** Aksi yang bisa sedang berjalan di panel; '' = tidak ada. */
type Sibuk = '' | 'simpan' | 'naik' | 'turun';

const WARNA_STATUS: Record<StatusPapan, string> = {
  sudah: 'var(--success, #2c5c38)',
  sedang: 'var(--warning)',
  akan: 'var(--muted-foreground)',
  ditunda: 'var(--destructive)',
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
    <div className="flex flex-col gap-3 p-4">
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

      {galat !== '' ? (
        <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
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
          <button
            id="btn_ubah_butir_papan"
            type="button"
            onClick={onMulaiUbah}
            className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" />
            Ubah
          </button>
        ) : null}
      </div>

      <p className="text-[13px] leading-snug">
        <TeksButir deskripsi={kartu.deskripsi} />
      </p>

      {bolehUbah ? (
        <div className="flex flex-col gap-2">
          <GantiStatus status={kartu.status} sibuk={sibuk} onGanti={onGantiStatus} />
          <div className="flex items-center gap-2">
            <button
              id="btn_naik_butir_papan"
              type="button"
              disabled={sibuk === 'naik'}
              onClick={onNaik}
              className="cursor-pointer border px-2 py-1 text-xs disabled:opacity-40"
              style={{ borderColor: 'var(--divider)' }}
            >
              Naik
            </button>
            <button
              id="btn_turun_butir_papan"
              type="button"
              disabled={sibuk === 'turun'}
              onClick={onTurun}
              className="cursor-pointer border px-2 py-1 text-xs disabled:opacity-40"
              style={{ borderColor: 'var(--divider)' }}
            >
              Turun
            </button>
            {konfirmasiHapus ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs">Hapus poin ini?</span>
                <button
                  id="btn_yakin_hapus_butir"
                  type="button"
                  disabled={sibuk !== ''}
                  onClick={onHapus}
                  className="cursor-pointer text-xs font-medium disabled:opacity-40"
                  style={{ color: 'var(--destructive)' }}
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
              </span>
            ) : (
              <button
                id="btn_hapus_butir_papan"
                type="button"
                disabled={sibuk !== ''}
                onClick={onMintaKonfirmasiHapus}
                className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Trash2 className="size-3" />
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
        <button
          id="btn_simpan_butir_papan"
          type="button"
          disabled={sibuk !== '' || draf.trim() === ''}
          onClick={onSimpan}
          className="cursor-pointer px-3 py-1 text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Simpan
        </button>
        <button
          id="btn_batal_ubah_butir"
          type="button"
          onClick={onBatal}
          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
        >
          Batal
        </button>
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
    <div className="flex flex-wrap items-center gap-1">
      {KOLOM_PAPAN.filter((s) => s !== status).map((s) => (
        <button
          key={s}
          id={`btn_status_${s}`}
          type="button"
          disabled={sibuk !== ''}
          onClick={() => onGanti(s)}
          className="cursor-pointer border px-2 py-1 text-xs disabled:opacity-40"
          style={{ borderColor: 'var(--divider)' }}
        >
          {JUDUL_KOLOM[s]}
        </button>
      ))}
    </div>
  );
}

/** Lencana status poin, dipakai di mode baca. */
function LencanaStatus({ status }: { status: StatusPapan }) {
  return (
    <span
      className={cn('font-mono text-[10px] font-semibold tracking-wide uppercase')}
      style={{ color: WARNA_STATUS[status] }}
    >
      {status}
    </span>
  );
}
