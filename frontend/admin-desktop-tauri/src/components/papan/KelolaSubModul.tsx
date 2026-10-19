import { useState } from 'react';

import { JUDUL_KOLOM, KOLOM_PAPAN } from '@/api/papan';
import type { StatusPapan, SubPapan } from '@/api/papan';
import { hapusSubPapan, tambahSubPapan, ubahSubPapan } from '@/api/papan';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2 } from '@/icons';

/**
 * Panel kelola sub-modul sebuah modul: ubah nama & kode, tambah, hapus,
 * dan tambah poin baru ke sub-modul mana pun.
 *
 * Semua perubahan langsung menulis ke papan lalu memanggil onBerubah, yang
 * memuat ulang papan dari server. Panel ini sengaja TIDAK menyimpan salinan
 * datanya sendiri supaya tidak ada dua kebenaran yang bisa berbeda.
 */
export function KelolaSubModul({
  modulKode,
  modulNama,
  sub,
  onTutup,
  onBerubah,
  onTambahPoin,
}: {
  modulKode: string;
  modulNama: string;
  sub: SubPapan[];
  onTutup: () => void;
  onBerubah: () => Promise<void>;
  onTambahPoin: (subKode: string, status: StatusPapan, deskripsi: string) => Promise<void>;
}) {
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function jalan(aksi: () => Promise<void>) {
    setSibuk(true);
    setGalat('');

    try {
      await aksi();
      await onBerubah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog open onOpenChange={(b) => (b ? undefined : onTutup())}>
      <DialogContent
        id="dialog_kelola_papan"
        className="max-h-[85dvh] overflow-x-hidden overflow-y-auto"
        style={{ width: 'calc(100vw - 1rem)', maxWidth: 'calc(100vw - 1rem)' }}
      >
        <DialogHeader>
          <DialogTitle id="judul_kelola_papan">
            Kelola {modulKode}. {modulNama}
          </DialogTitle>
        </DialogHeader>

        {galat !== '' ? (
          <p role="alert" className="text-xs" style={{ color: 'var(--destructive)' }}>
            {galat}
          </p>
        ) : null}

        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--divider)' }}>
          {sub.map((s) => (
            <BarisSub
              key={s.kode}
              sub={s}
              sibuk={sibuk}
              onSimpan={(nama, kodeBaru) =>
                void jalan(() => ubahSubPapan(s.kode, { nama, kode_baru: kodeBaru }).then(() => undefined))
              }
              onHapus={() => void jalan(() => hapusSubPapan(s.kode).then(() => undefined))}
              onTambahPoin={(status, deskripsi) =>
                void jalan(() => onTambahPoin(s.kode, status, deskripsi))
              }
            />
          ))}
        </div>

        <FormSubBaru
          sibuk={sibuk}
          onTambah={(kode, nama) =>
            void jalan(() => tambahSubPapan(modulKode, kode, nama).then(() => undefined))
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Satu baris sub-modul: nama, kode, tambah poin, dan hapus. */
function BarisSub({
  sub,
  sibuk,
  onSimpan,
  onHapus,
  onTambahPoin,
}: {
  sub: SubPapan;
  sibuk: boolean;
  onSimpan: (nama: string, kodeBaru: string) => void;
  onHapus: () => void;
  onTambahPoin: (status: StatusPapan, deskripsi: string) => void;
}) {
  const [nama, setNama] = useState(sub.nama);
  const [kodeBaru, setKodeBaru] = useState(sub.kode);
  const [poinBaru, setPoinBaru] = useState('');
  const [statusBaru, setStatusBaru] = useState<StatusPapan>('akan');
  const [yakinHapus, setYakinHapus] = useState(false);

  const berubah = nama !== sub.nama || kodeBaru !== sub.kode;

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`input_kode_${sub.kode.replace('.', '_')}`}
          value={kodeBaru}
          onChange={(e) => setKodeBaru(e.target.value)}
          aria-label={`Kode sub-modul ${sub.kode}`}
          className="w-16 shrink-0 border bg-transparent px-2 py-1 font-mono text-xs sm:w-20"
          style={{ borderColor: 'var(--divider)' }}
        />
        <input
          id={`input_nama_${sub.kode.replace('.', '_')}`}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          aria-label={`Nama sub-modul ${sub.kode}`}
          className="min-w-[150px] flex-1 border bg-transparent px-2 py-1 text-[13px]"
          style={{ borderColor: 'var(--divider)' }}
        />
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {sub.butir.length} poin
        </span>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            id={`btn_simpan_sub_${sub.kode.replace('.', '_')}`}
            type="button"
            disabled={sibuk || !berubah || nama.trim() === '' || kodeBaru.trim() === ''}
            onClick={() => onSimpan(nama.trim(), kodeBaru.trim())}
            className="cursor-pointer px-2 py-1 text-xs font-medium disabled:opacity-30"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Simpan
          </button>
          {yakinHapus ? (
            <span className="flex flex-wrap items-center gap-1">
              <button
                id={`btn_yakin_hapus_sub_${sub.kode.replace('.', '_')}`}
                type="button"
                disabled={sibuk}
                onClick={onHapus}
                className="cursor-pointer text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--destructive)' }}
              >
                Ya, hapus {sub.butir.length} poin
              </button>
              <button
                type="button"
                onClick={() => setYakinHapus(false)}
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
            </span>
          ) : (
            <button
              id={`btn_hapus_sub_${sub.kode.replace('.', '_')}`}
              type="button"
              disabled={sibuk}
              onClick={() => setYakinHapus(true)}
              aria-label={`Hapus sub-modul ${sub.kode}`}
              className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:pl-[88px]">
        <input
          id={`input_poin_${sub.kode.replace('.', '_')}`}
          value={poinBaru}
          onChange={(e) => setPoinBaru(e.target.value)}
          placeholder="Poin baru..."
          aria-label={`Poin baru untuk ${sub.kode}`}
          className="min-w-[120px] flex-1 border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: 'var(--divider)' }}
        />
        <select
          id={`select_status_${sub.kode.replace('.', '_')}`}
          value={statusBaru}
          onChange={(e) => setStatusBaru(e.target.value as StatusPapan)}
          aria-label={`Status poin baru ${sub.kode}`}
          className="w-24 shrink-0 border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: 'var(--divider)' }}
        >
          {KOLOM_PAPAN.map((s) => (
            <option key={s} value={s}>
              {JUDUL_KOLOM[s]}
            </option>
          ))}
        </select>
        <button
          id={`btn_tambah_poin_${sub.kode.replace('.', '_')}`}
          type="button"
          disabled={sibuk || poinBaru.trim() === ''}
          onClick={() => {
            onTambahPoin(statusBaru, poinBaru.trim());
            setPoinBaru('');
          }}
          className="shrink-0 cursor-pointer border px-2 py-1 text-xs disabled:opacity-30"
          style={{ borderColor: 'var(--divider)' }}
        >
          Tambah poin
        </button>
      </div>
    </div>
  );
}

/** Form tambah sub-modul baru di akhir daftar. */
function FormSubBaru({
  sibuk,
  onTambah,
}: {
  sibuk: boolean;
  onTambah: (kode: string, nama: string) => void;
}) {
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');

  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: 'var(--divider)' }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="input_kode_sub_baru" className="text-xs text-muted-foreground">
          Kode
        </label>
        <input
          id="input_kode_sub_baru"
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          className="w-16 border bg-transparent px-2 py-1 font-mono text-xs sm:w-20"
          style={{ borderColor: 'var(--divider)' }}
        />
      </div>
      <div className="flex min-w-[140px] flex-1 flex-col gap-1">
        <label htmlFor="input_nama_sub_baru" className="text-xs text-muted-foreground">
          Nama sub-modul baru
        </label>
        <input
          id="input_nama_sub_baru"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="border bg-transparent px-2 py-1 text-[13px]"
          style={{ borderColor: 'var(--divider)' }}
        />
      </div>
      <button
        id="btn_tambah_sub_baru"
        type="button"
        disabled={sibuk || kode.trim() === '' || nama.trim() === ''}
        onClick={() => {
          onTambah(kode.trim(), nama.trim());
          setKode('');
          setNama('');
        }}
        className="shrink-0 cursor-pointer px-3 py-1 text-xs font-medium disabled:opacity-30"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        Tambah sub-modul
      </button>
    </div>
  );
}
