import { useEffect, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import type { FormPendaftaran } from '../api/psb';
import { Field } from '../components/field';
import { rupiah, tanggalIndonesia } from '../lib/format';

interface Props {
  form: FormPendaftaran;
  ubah: (patch: Partial<FormPendaftaran>) => void;
  errors: Record<string, string>;
  ringkasan: {
    gelombang: string;
    lembaga: string;
    jenis: string;
    tipe: string;
    nominal: number | null;
  };
}

function PratinjauBukti({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objek = URL.createObjectURL(file);
    setUrl(objek);
    return () => URL.revokeObjectURL(objek);
  }, [file]);

  if (!url || !file.type.startsWith('image/')) return null;
  return <img src={url} alt="Pratinjau bukti transfer" className="max-h-52 w-full rounded-xl border border-slate-200 object-contain" />;
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{nilai}</span>
    </div>
  );
}

export default function Langkah3Bukti({ form, ubah, errors, ringkasan }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ringkasan pendaftaran</h2>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
          <Baris label="Gelombang" nilai={ringkasan.gelombang} />
          <Baris label="Lembaga" nilai={ringkasan.lembaga} />
          <Baris label="Jenis" nilai={ringkasan.jenis} />
          <Baris label="Tipe santri" nilai={ringkasan.tipe} />
          <Baris label="Nama calon" nilai={form.nama_lengkap || '-'} />
          <Baris label="NIK" nilai={form.nik || '-'} />
          <Baris label="Tanggal lahir" nilai={tanggalIndonesia(form.tgl_lahir)} />
          <Baris label="Biaya pendaftaran" nilai={rupiah(ringkasan.nominal)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bukti pendaftaran</h2>
        <Field
          id="input_bukti_transfer"
          label="Foto / gambar bukti transfer"
          error={errors.bukti_transfer}
          hint="JPG, PNG, atau PDF — maksimal 2 MB."
        >
          <label
            htmlFor="input_bukti_transfer"
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
              form.bukti_transfer ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-300 bg-white'
            }`}
          >
            {form.bukti_transfer ? (
              <FileText className="size-6 text-emerald-600" />
            ) : (
              <Upload className="size-6 text-slate-400" />
            )}
            <span className="text-sm font-medium text-slate-900">
              {form.bukti_transfer ? form.bukti_transfer.name : 'Ambil foto atau pilih dari galeri'}
            </span>
            <span className="text-xs text-slate-500">Ketuk untuk memilih berkas</span>
            <input
              id="input_bukti_transfer"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => ubah({ bukti_transfer: e.target.files?.[0] ?? null })}
            />
          </label>
        </Field>
        {form.bukti_transfer ? <PratinjauBukti file={form.bukti_transfer} /> : null}
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="cek_setuju" className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3.5">
          <input
            id="cek_setuju"
            type="checkbox"
            className="mt-0.5 size-5 accent-emerald-600"
            checked={form.setuju}
            onChange={(e) => ubah({ setuju: e.target.checked })}
          />
          <span className="text-xs leading-relaxed text-slate-600">
            Saya menyatakan data yang diisi benar dan bersedia mengikuti ketentuan pendaftaran pesantren.
          </span>
        </label>
        {errors.setuju ? <p className="text-xs font-medium text-rose-600">{errors.setuju}</p> : null}
      </section>
    </div>
  );
}
