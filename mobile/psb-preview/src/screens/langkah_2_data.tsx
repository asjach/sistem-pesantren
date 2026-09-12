import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { cekNik } from '../api/psb';
import type { FormPendaftaran } from '../api/psb';
import { Banner, Field, kelasInput } from '../components/field';
import { PilihanKartu } from '../components/pilihan_kartu';

type StatusCek = 'idle' | 'memuat' | 'aktif' | 'aman' | 'gagal';

interface Props {
  form: FormPendaftaran;
  ubah: (patch: Partial<FormPendaftaran>) => void;
  errors: Record<string, string>;
}

export default function Langkah2Data({ form, ubah, errors }: Props) {
  const [statusCek, setStatusCek] = useState<StatusCek>('idle');
  const [pesanCek, setPesanCek] = useState('');
  const hariIni = new Date().toISOString().slice(0, 10);

  async function periksaNik() {
    if (!/^\d{16}$/.test(form.nik)) {
      setStatusCek('gagal');
      setPesanCek('NIK harus 16 digit angka.');
      return;
    }
    setStatusCek('memuat');
    setPesanCek('');
    try {
      const terdaftar = await cekNik(form.nik);
      setStatusCek(terdaftar ? 'aktif' : 'aman');
    } catch {
      setStatusCek('gagal');
      setPesanCek('Gagal memeriksa NIK. Periksa koneksi lalu coba lagi.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Data calon santri</h2>

        <Field id="input_nik" label="NIK" error={errors.nik} hint="16 digit sesuai kartu keluarga.">
          <div className="flex gap-2">
            <input
              id="input_nik"
              className={kelasInput}
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              placeholder="16 digit"
              value={form.nik}
              onChange={(e) => {
                ubah({ nik: e.target.value.replace(/\D/g, '').slice(0, 16) });
                setStatusCek('idle');
              }}
            />
            <button
              type="button"
              id="tombol_cek_nik"
              onClick={periksaNik}
              disabled={statusCek === 'memuat'}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 transition active:bg-emerald-50 disabled:opacity-60"
            >
              {statusCek === 'memuat' ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Cek
            </button>
          </div>
        </Field>

        {statusCek === 'aktif' ? (
          <Banner
            jenis="error"
            pesan="NIK ini terdaftar sebagai santri aktif. Gunakan Pendaftaran Lanjutan melalui portal orang tua atau hubungi TU pesantren."
          />
        ) : null}
        {statusCek === 'aman' ? (
          <Banner jenis="sukses" pesan="NIK belum terdaftar sebagai santri aktif. Lanjutkan pengisian." />
        ) : null}
        {statusCek === 'gagal' ? <Banner jenis="error" pesan={pesanCek} /> : null}

        <Field id="input_nama_lengkap" label="Nama lengkap" error={errors.nama_lengkap}>
          <input
            id="input_nama_lengkap"
            className={kelasInput}
            placeholder="Sesuai akta / kartu keluarga"
            value={form.nama_lengkap}
            onChange={(e) => ubah({ nama_lengkap: e.target.value })}
          />
        </Field>

        <Field id="pilih_jk" label="Jenis kelamin" error={errors.jk}>
          <div className="flex gap-3">
            <PilihanKartu id="pilih_jk_l" aktif={form.jk === 'L'} judul="Laki-laki" onClick={() => ubah({ jk: 'L' })} />
            <PilihanKartu id="pilih_jk_p" aktif={form.jk === 'P'} judul="Perempuan" onClick={() => ubah({ jk: 'P' })} />
          </div>
        </Field>

        <Field id="input_tgl_lahir" label="Tanggal lahir" error={errors.tgl_lahir}>
          <input
            id="input_tgl_lahir"
            type="date"
            className={kelasInput}
            max={hariIni}
            value={form.tgl_lahir}
            onChange={(e) => ubah({ tgl_lahir: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kontak orang tua / wali</h2>

        <Field id="input_nama_ayah" label="Nama ayah" error={errors.nama_ayah}>
          <input
            id="input_nama_ayah"
            className={kelasInput}
            value={form.nama_ayah}
            onChange={(e) => ubah({ nama_ayah: e.target.value })}
          />
        </Field>

        <Field id="input_nama_ibu" label="Nama ibu" error={errors.nama_ibu}>
          <input
            id="input_nama_ibu"
            className={kelasInput}
            value={form.nama_ibu}
            onChange={(e) => ubah({ nama_ibu: e.target.value })}
          />
        </Field>

        <Field
          id="input_telp_ortu"
          label="No. HP / WhatsApp"
          error={errors.telp_ortu}
          hint="Nomor aktif untuk informasi hasil pendaftaran."
        >
          <input
            id="input_telp_ortu"
            className={kelasInput}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            value={form.telp_ortu}
            onChange={(e) => ubah({ telp_ortu: e.target.value })}
          />
        </Field>

        <Field id="input_email_ortu" label="Email (opsional)" error={errors.email_ortu}>
          <input
            id="input_email_ortu"
            type="email"
            className={kelasInput}
            placeholder="nama@email.com"
            value={form.email_ortu}
            onChange={(e) => ubah({ email_ortu: e.target.value })}
          />
        </Field>
      </section>
    </div>
  );
}
