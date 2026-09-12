import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { ApiError, ambilOpsi, kirimPendaftaran } from './api/psb';
import type { FormPendaftaran, OpsiPendaftaran, HasilPendaftaran } from './api/psb';
import { Banner } from './components/field';
import { biayaUntuk, infoPaket, labelTipe, tipeTersedia } from './lib/psb';
import Langkah1Pilihan from './screens/langkah_1_pilihan';
import Langkah2Data from './screens/langkah_2_data';
import Langkah3Bukti from './screens/langkah_3_bukti';
import Sukses from './screens/sukses';

const FORM_AWAL: FormPendaftaran = {
  lembaga_id: null,
  paket: false,
  is_pindahan: false,
  masuk_tingkat: '',
  tipe_santri: 'non_asrama',
  nik: '',
  nama_lengkap: '',
  jk: '',
  tgl_lahir: '',
  nama_ayah: '',
  nama_ibu: '',
  email_ortu: '',
  telp_ortu: '',
  bukti_transfer: null,
  setuju: false,
};

const LABEL_LANGKAH = ['Pilihan', 'Data', 'Bukti'];

const FIELD_LANGKAH: Record<string, number> = {
  lembaga_id: 1,
  tipe_santri: 1,
  paket: 1,
  is_pindahan: 1,
  masuk_tingkat: 1,
  nik: 2,
  nama_lengkap: 2,
  jk: 2,
  tgl_lahir: 2,
  email_ortu: 2,
  telp_ortu: 2,
  nama_ayah: 2,
  nama_ibu: 2,
  bukti_transfer: 3,
};

export default function App() {
  const [opsi, setOpsi] = useState<OpsiPendaftaran | null>(null);
  const [memuatOpsi, setMemuatOpsi] = useState(true);
  const [gagalOpsi, setGagalOpsi] = useState<string | null>(null);
  const [langkah, setLangkah] = useState(1);
  const [form, setForm] = useState<FormPendaftaran>(FORM_AWAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<HasilPendaftaran | null>(null);

  const muat = useCallback(async () => {
    setMemuatOpsi(true);
    setGagalOpsi(null);
    try {
      const data = await ambilOpsi();
      setOpsi(data);
      const lembagaPertama = data.lembaga[0] ?? null;
      setForm((f) => ({
        ...f,
        lembaga_id: lembagaPertama?.id ?? null,
        tipe_santri: tipeTersedia(lembagaPertama)[0] ?? 'non_asroma',
      }));
    } catch (err) {
      setGagalOpsi(err instanceof Error ? err.message : 'Gagal memuat opsi pendaftaran.');
    } finally {
      setMemuatOpsi(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const daftarLembaga = opsi?.lembaga ?? [];
  const gelombangAktif = opsi?.gelombang_aktif ?? null;
  const paket = infoPaket(daftarLembaga);
  const paketAktif = form.paket && paket !== null;
  const lembagaEfektif = paketAktif && paket ? paket.lembagaPrimer : (daftarLembaga.find((l) => l.id === form.lembaga_id) ?? null);
  const tipeEfektif = paketAktif ? 'non_asrama' : form.tipe_santri;
  const biaya = biayaUntuk(lembagaEfektif, tipeEfektif);
  const nominal = paketAktif && paket ? paket.biaya.nominal_paket : (biaya?.nominal_pendaftaran ?? null);
  const lembagaNama =
    paketAktif && paket
      ? `${paket.lembagaPrimer.nama} + ${paket.lembagaSekunder.nama} (Paket MI-MD)`
      : (lembagaEfektif?.nama ?? '-');

  function ubah(patch: Partial<FormPendaftaran>) {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setBanner(null);
  }

  function validasiLangkah1(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!gelombangAktif) e.lembaga_id = 'Pendaftaran sedang ditutup.';
    if (!paketAktif && !form.lembaga_id) e.lembaga_id = 'Pilih lembaga tujuan.';
    if (!paketAktif && !form.tipe_santri) e.tipe_santri = 'Pilih tipe santri.';
    if (form.is_pindahan && !form.masuk_tingkat) e.masuk_tingkat = 'Pilih tingkat masuk.';
    return e;
  }

  function validasiLangkah2(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!/^\d{16}$/.test(form.nik)) e.nik = 'NIK harus 16 digit angka.';
    if (!form.nama_lengkap.trim()) e.nama_lengkap = 'Isi nama lengkap calon santri.';
    if (!form.jk) e.jk = 'Pilih jenis kelamin.';
    if (!form.tgl_lahir) e.tgl_lahir = 'Isi tanggal lahir.';
    if (!form.telp_ortu.trim()) e.telp_ortu = 'Isi nomor HP/WA orang tua.';
    if (form.email_ortu.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email_ortu.trim())) {
      e.email_ortu = 'Format email tidak valid.';
    }
    return e;
  }

  function validasiLangkah3(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.bukti_transfer) e.bukti_transfer = 'Lampirkan bukti transfer.';
    if (!form.setuju) e.setuju = 'Centang pernyataan kebenaran data.';
    return e;
  }

  function lanjut() {
    const e = langkah === 1 ? validasiLangkah1() : validasiLangkah2();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      setBanner(null);
      return;
    }
    setErrors({});
    setBanner(null);
    setLangkah((l) => l + 1);
    window.scrollTo({ top: 0 });
  }

  function mundur() {
    setErrors({});
    setBanner(null);
    setLangkah((l) => Math.max(1, l - 1));
    window.scrollTo({ top: 0 });
  }

  async function kirim() {
    const e = validasiLangkah3();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    if (!lembagaEfektif) {
      setBanner('Lembaga tujuan belum dipilih.');
      return;
    }
    setMengirim(true);
    setErrors({});
    setBanner(null);
    try {
      const r = await kirimPendaftaran(form, lembagaEfektif.id);
      setHasil(r);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError) {
        const peta: Record<string, string> = {};
        for (const [kunci, pesan] of Object.entries(err.errors)) {
          peta[kunci] = pesan[0] ?? 'Tidak valid.';
        }
        setErrors(peta);
        setBanner(
          err.status === 429
            ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
            : err.message,
        );
        const kunciPertama = Object.keys(err.errors)[0];
        const tujuan = kunciPertama ? FIELD_LANGKAH[kunciPertama] : undefined;
        if (tujuan) setLangkah(tujuan);
      } else {
        setBanner('Gagal mengirim pendaftaran. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      setMengirim(false);
    }
  }

  function ulangi() {
    setHasil(null);
    setForm(FORM_AWAL);
    setErrors({});
    setBanner(null);
    setLangkah(1);
    void muat();
  }

  const tampilForm = !memuatOpsi && !gagalOpsi && opsi !== null && gelombangAktif !== null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white shadow-sm">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">PSB Online</p>
        <h1 className="text-lg font-bold text-slate-900">Pendaftaran Santri Baru</h1>
        {!hasil && tampilForm ? (
          <ol className="mt-3 flex items-center gap-2 text-xs">
            {LABEL_LANGKAH.map((label, i) => {
              const nomor = i + 1;
              const aktif = langkah === nomor;
              const selesai = langkah > nomor;
              return (
                <li key={label} className="flex flex-1 items-center gap-2">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      aktif ? 'bg-emerald-600 text-white' : selesai ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {nomor}
                  </span>
                  <span className={aktif ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
                  {nomor < LABEL_LANGKAH.length ? <span className="h-px flex-1 bg-slate-200" /> : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </header>

      <main className="flex-1 px-5 py-5">
        {memuatOpsi ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Memuat opsi pendaftaran…</p>
          </div>
        ) : null}

        {!memuatOpsi && gagalOpsi ? (
          <div className="flex flex-col gap-3 py-10">
            <Banner jenis="error" pesan={gagalOpsi} />
            <button
              type="button"
              onClick={() => void muat()}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              <RefreshCw className="size-4" />
              Coba lagi
            </button>
          </div>
        ) : null}

        {!memuatOpsi && !gagalOpsi && opsi !== null && gelombangAktif === null ? (
          <div className="py-10">
            <Banner jenis="info" pesan="Pendaftaran sedang ditutup. Belum ada gelombang pendaftaran yang dibuka — silakan cek kembali nanti." />
          </div>
        ) : null}

        {hasil ? (
          <Sukses
            hasil={hasil}
            nama={form.nama_lengkap}
            lembaga={lembagaNama}
            gelombang={gelombangAktif?.nama ?? '-'}
            nominal={nominal}
            onUlangi={ulangi}
          />
        ) : null}

        {!hasil && tampilForm ? (
          <>
            {banner ? (
              <div className="mb-4">
                <Banner jenis="error" pesan={banner} />
              </div>
            ) : null}
            {langkah === 1 ? (
              <Langkah1Pilihan
                daftarLembaga={daftarLembaga}
                gelombangAktif={gelombangAktif}
                form={form}
                ubah={ubah}
                errors={errors}
              />
            ) : null}
            {langkah === 2 ? <Langkah2Data form={form} ubah={ubah} errors={errors} /> : null}
            {langkah === 3 ? (
              <Langkah3Bukti
                form={form}
                ubah={ubah}
                errors={errors}
                ringkasan={{
                  gelombang: gelombangAktif?.nama ?? '-',
                  lembaga: lembagaNama,
                  jenis: form.is_pindahan ? `Pindahan — tingkat ${form.masuk_tingkat || '-'}` : 'Santri Baru',
                  tipe: paketAktif ? 'Non Asrama (Paket MI-MD)' : labelTipe(form.tipe_santri),
                  nominal,
                }}
              />
            ) : null}
          </>
        ) : null}
      </main>

      {!hasil && tampilForm ? (
        <footer className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <div className="flex gap-3">
            {langkah > 1 ? (
              <button
                type="button"
                id="tombol_kembali"
                onClick={mundur}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition active:bg-slate-50"
              >
                <ChevronLeft className="size-4" />
                Kembali
              </button>
            ) : null}
            {langkah < 3 ? (
              <button
                type="button"
                id="tombol_lanjut"
                onClick={lanjut}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition active:bg-emerald-700"
              >
                Lanjut
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                id="tombol_kirim"
                onClick={() => void kirim()}
                disabled={mengirim}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition active:bg-emerald-700 disabled:opacity-70"
              >
                {mengirim ? <Loader2 className="size-4 animate-spin" /> : null}
                {mengirim ? 'Mengirim…' : 'Kirim Pendaftaran'}
              </button>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
