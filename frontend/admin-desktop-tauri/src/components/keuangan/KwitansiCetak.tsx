import { useMemo } from 'react';
import type { TransaksiBaris, TransaksiHarianRow } from '@/api/keuangan';

/** Label laci kas — disalin dari halaman Pembayaran agar kwitansi mandiri. */
const LABEL_KAS: Record<string, string> = {
  tunai_tu: 'Tunai TU',
  bank_lembaga: 'Bank Lembaga',
  bank_pesantren: 'Bank Pesantren',
};

const LABEL_METODE: Record<string, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer',
};

/** "Rp 1.234.567" */
function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id')}`;
}

/** "5 Agustus 2025, 14:30" */
function waktuCetak(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' })}, ${
    d.toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })
  }`;
}

export interface KwitansiData {
  no_kwitansi: string | null;
  tanggal?: string | null;
  santri?: string | null;
  metode?: string | null;
  kas?: string | null;
  catatan?: string | null;
  total: number;
  jumlah_baris: number;
  /** Rincian tagihan; kosong pada kwitansi hasil tabel harian (server tak mengirim rincian di sana). */
  baris?: TransaksiBaris[];
}

export interface CetakKwitansi {
  data: KwitansiData;
  /** Nama lembaga penerima pembayaran (opsional). */
  lembaga?: string;
}

/** Bangun data kwitansi dari satu baris tabel transaksi harian. */
export function kwitansiDariHarian(row: TransaksiHarianRow, lembaga?: string): CetakKwitansi {
  return {
    data: {
      no_kwitansi: row.no_kwitansi,
      tanggal: row.tanggal,
      santri: row.santri,
      metode: row.metode,
      kas: row.kas,
      catatan: row.catatan,
      total: row.total,
      jumlah_baris: row.jumlah_baris,
    },
    lembaga,
  };
}

/** Dokumen kwitansi 1 halaman; hanya tampil saat `aktif` (dipakai CSS cetak). */
export default function KwitansiCetak({ cetak, aktif }: { cetak: CetakKwitansi; aktif: boolean }) {
  const { data, lembaga } = cetak;

  const nomor = data.no_kwitansi ?? '—';
  const tanggal = useMemo(() => (data.tanggal ? waktuCetak(data.tanggal) : '—'), [data.tanggal]);
  const rincian = data.baris ?? [];
  const totalBaris = rincian.reduce((s, b) => s + b.jumlah, 0);
  /** Rincian lengkap hanya bila jumlah barisnya cocok dengan total baris transaksi. */
  const rincianUtuh = rincian.length > 0 && Math.abs(totalBaris - data.total) < 0.005;

  return (
    <div
      data-area-cetak="kwitansi"
      data-cetak-aktif={aktif ? 'true' : undefined}
      className="mx-auto max-w-[800px] bg-white p-6 text-black"
    >
      <div className="border-b-2 border-black pb-2 text-center">
        <h1 className="text-lg font-semibold uppercase tracking-wide">Kwitansi Pembayaran</h1>
        {lembaga !== undefined && lembaga.trim() !== '' && (
          <p className="text-sm">{lembaga}</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-600">No. Kwitansi</dt>
        <dd className="font-mono font-semibold">{nomor}</dd>
        <dt className="text-gray-600">Tanggal</dt>
        <dd>{tanggal}</dd>
        <dt className="text-gray-600">Diterima dari</dt>
        <dd>{data.santri ?? '—'}</dd>
        <dt className="text-gray-600">Metode</dt>
        <dd>{data.metode !== null && data.metode !== undefined ? (LABEL_METODE[data.metode] ?? data.metode) : '—'}</dd>
        <dt className="text-gray-600">Kas</dt>
        <dd>{data.kas !== null && data.kas !== undefined ? (LABEL_KAS[data.kas] ?? data.kas) : '—'}</dd>
        {data.catatan !== null && data.catatan !== undefined && data.catatan !== '' && (
          <>
            <dt className="text-gray-600">Catatan</dt>
            <dd>{data.catatan}</dd>
          </>
        )}
      </dl>

      {rincianUtuh ? (
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1 text-left">No</th>
              <th className="border border-black px-2 py-1 text-left">Tagihan</th>
              <th className="border border-black px-2 py-1 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {rincian.map((b, i) => (
              <tr key={b.id}>
                <td className="border border-black px-2 py-1 tabular-nums">{i + 1}</td>
                <td className="border border-black px-2 py-1">Tagihan #{b.tagihan_id}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{rupiah(b.jumlah)}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-black px-2 py-1 font-semibold" colSpan={2}>
                Total
              </td>
              <td className="border border-black px-2 py-1 text-right font-semibold tabular-nums">{rupiah(data.total)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="mt-5 border border-black px-3 py-4 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-gray-700">
              {data.jumlah_baris} tagihan dalam satu kwitansi
            </span>
            <span className="text-base font-semibold tabular-nums">{rupiah(data.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-10 flex justify-between text-sm">
        <div>
          <p className="text-gray-600">Penyetor</p>
          <div className="mt-10 w-48 border-t border-black pt-1 text-center">{data.santri ?? ''}</div>
        </div>
        <div>
          <p className="text-gray-600">Penerima</p>
          <div className="mt-10 w-48 border-t border-black pt-1 text-center">&nbsp;</div>
        </div>
      </div>
    </div>
  );
}
