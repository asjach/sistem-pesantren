import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, RotateCcw } from 'lucide-react';
import type { HasilPendaftaran } from '../api/psb';
import { Banner } from '../components/field';
import { rupiah } from '../lib/format';
import { labelStatus } from '../lib/psb';

interface Props {
  hasil: HasilPendaftaran;
  nama: string;
  lembaga: string;
  gelombang: string;
  nominal: number | null;
  onUlangi: () => void;
}

export default function Sukses({ hasil, nama, lembaga, gelombang, nominal, onUlangi }: Props) {
  const [tersalin, setTersalin] = useState(false);

  async function salinNomor() {
    try {
      await navigator.clipboard.writeText(hasil.no_pendaftaran);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <CheckCircle2 className="size-14 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">Pendaftaran Berhasil</h2>
        <p className="text-sm text-slate-500">Simpan nomor pendaftaran berikut untuk pengecekan berkala.</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            hasil.status === 'waiting_list' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          Status: {labelStatus(hasil.status)}
        </span>
      </div>

      {hasil.status === 'waiting_list' ? (
        <Banner
          jenis="info"
          pesan="Kuota pendaftaran penuh. Pendaftaran masuk daftar tunggu; Anda akan dihubungi bila kursi tersedia."
        />
      ) : null}

      <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Nomor pendaftaran</p>
        <p className="mt-1 text-xl font-bold tracking-wide text-slate-900">{hasil.no_pendaftaran}</p>
        <button
          type="button"
          onClick={salinNomor}
          className="mx-auto mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"
        >
          <Copy className="size-3.5" />
          {tersalin ? 'Tersalin' : 'Salin nomor'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm">
          <span className="text-slate-500">Nama calon</span>
          <span className="text-right font-medium text-slate-900">{nama}</span>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm">
          <span className="text-slate-500">Gelombang</span>
          <span className="text-right font-medium text-slate-900">{gelombang}</span>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm">
          <span className="text-slate-500">Lembaga</span>
          <span className="text-right font-medium text-slate-900">{lembaga}</span>
        </div>
        <div className="flex items-start justify-between gap-4 py-2 text-sm">
          <span className="text-slate-500">Biaya pendaftaran</span>
          <span className="text-right font-medium text-slate-900">{rupiah(nominal)}</span>
        </div>
      </div>

      <a
        href={hasil.signed_url_bukti}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700 transition active:bg-emerald-50"
      >
        <ExternalLink className="size-4" />
        Buka bukti pendaftaran
      </a>

      <button
        type="button"
        onClick={onUlangi}
        className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition active:bg-slate-200"
      >
        <RotateCcw className="size-4" />
        Daftarkan anak lain
      </button>
    </div>
  );
}
