import type { FormPendaftaran, GelombangAktif, LembagaOpsi } from '../api/psb';
import { Banner, Field, kelasInput } from '../components/field';
import { KartuInfo, PilihanKartu } from '../components/pilihan_kartu';
import { rupiah, tanggalIndonesia } from '../lib/format';
import { biayaUntuk, infoPaket, tipeTersedia } from '../lib/psb';

interface Props {
  daftarLembaga: LembagaOpsi[];
  gelombangAktif: GelombangAktif | null;
  form: FormPendaftaran;
  ubah: (patch: Partial<FormPendaftaran>) => void;
  errors: Record<string, string>;
}

export default function Langkah1Pilihan({ daftarLembaga, gelombangAktif, form, ubah, errors }: Props) {
  const paket = infoPaket(daftarLembaga);
  const paketAktif = form.paket && paket !== null;
  const lembaga =
    paketAktif && paket
      ? paket.lembagaPrimer
      : (daftarLembaga.find((l) => l.id === form.lembaga_id) ?? null);
  const tipeList = tipeTersedia(lembaga);
  const biaya = biayaUntuk(lembaga, paketAktif ? 'non_asrama' : form.tipe_santri);
  const sisaKuota =
    paketAktif && paket
      ? [
          biayaUntuk(paket.lembagaPrimer, 'non_asrama')?.sisa_kuota ?? null,
          biayaUntuk(paket.lembagaSekunder, 'non_asrama')?.sisa_kuota ?? null,
        ]
      : [biaya?.sisa_kuota ?? null];
  const kuotaHabis = sisaKuota.some((s) => s === 0);
  const nominalTampil = paketAktif && paket ? paket.biaya.nominal_paket : (biaya?.nominal_pendaftaran ?? null);

  function pilihLembaga(id: number) {
    const l = daftarLembaga.find((x) => x.id === id) ?? null;
    ubah({ lembaga_id: id, tipe_santri: tipeTersedia(l)[0] ?? form.tipe_santri, masuk_tingkat: '' });
  }

  function togglePaket(aktif: boolean) {
    if (aktif && paket) {
      ubah({
        paket: true,
        is_pindahan: false,
        masuk_tingkat: '',
        tipe_santri: 'non_asrama',
        lembaga_id: paket.lembagaPrimer.id,
      });
      return;
    }
    ubah({ paket: false, lembaga_id: daftarLembaga[0]?.id ?? null });
  }

  function pilihJenis(pindahan: boolean) {
    ubah({ is_pindahan: pindahan, masuk_tingkat: '', paket: pindahan ? false : form.paket });
  }

  if (!gelombangAktif) {
    return (
      <Banner jenis="info" pesan="Pendaftaran sedang ditutup. Belum ada gelombang pendaftaran yang dibuka." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pilihan pendaftaran</h2>

        <KartuInfo>
          <p className="font-semibold">
            {gelombangAktif.nama}
            {gelombangAktif.kegiatan ? ` — ${gelombangAktif.kegiatan.nama}` : ''}
          </p>
          <p className="mt-0.5 text-xs">
            {gelombangAktif.tgl_buka ? `Dibuka ${tanggalIndonesia(gelombangAktif.tgl_buka)}` : 'Dibuka'}
            {gelombangAktif.tgl_tutup ? ` s.d. ${tanggalIndonesia(gelombangAktif.tgl_tutup)}` : ''} — gelombang diisi otomatis oleh sistem.
          </p>
        </KartuInfo>

        <Field id="pilih_jenis_pendaftaran" label="Jenis pendaftaran" error={errors.is_pindahan}>
          <div className="flex gap-3">
            <PilihanKartu
              id="pilih_santri_baru"
              aktif={!form.is_pindahan}
              judul="Santri Baru"
              deskripsi="Mulai dari tingkat awal jenjang"
              onClick={() => pilihJenis(false)}
            />
            <PilihanKartu
              id="pilih_pindahan"
              aktif={form.is_pindahan}
              judul="Pindahan"
              deskripsi="Lanjut di tingkat tertentu"
              disabled={paketAktif}
              onClick={() => pilihJenis(true)}
            />
          </div>
        </Field>

        {paket && !form.is_pindahan ? (
          <label
            htmlFor="cek_paket_mi_md"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
          >
            <input
              id="cek_paket_mi_md"
              type="checkbox"
              className="mt-0.5 size-5 accent-emerald-600"
              checked={form.paket}
              onChange={(e) => togglePaket(e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-900">Paket MI + MD</span>
              <span className="text-xs leading-snug text-slate-500">
                Daftar sekaligus {paket.lembagaPrimer.nama} dan {paket.lembagaSekunder.nama} —{' '}
                {rupiah(paket.biaya.nominal_paket)}
              </span>
            </span>
          </label>
        ) : null}

        {paketAktif && paket ? (
          <KartuInfo>
            <p className="font-semibold">Paket MI + MD</p>
            <p className="mt-0.5 text-xs">
              {paket.lembagaPrimer.nama} + {paket.lembagaSekunder.nama} (non asrama, tingkat 1)
            </p>
          </KartuInfo>
        ) : (
          <Field id="select_lembaga" label="Lembaga tujuan" error={errors.lembaga_id}>
            <select
              id="select_lembaga"
              className={kelasInput}
              value={form.lembaga_id ?? ''}
              onChange={(e) => pilihLembaga(Number(e.target.value))}
            >
              <option value="" disabled>
                Pilih lembaga
              </option>
              {daftarLembaga.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nama} ({l.kode})
                </option>
              ))}
            </select>
          </Field>
        )}

        {!paketAktif && lembaga && tipeList.length === 0 ? (
          <Banner jenis="info" pesan="Tipe santri belum dibuka untuk lembaga ini." />
        ) : null}

        {!paketAktif && tipeList.length > 0 ? (
          <Field id="pilih_tipe_santri" label="Tipe santri" error={errors.tipe_santri}>
            <div className="flex gap-3">
              {tipeList.map((t) => (
                <PilihanKartu
                  key={t}
                  id={`pilih_tipe_${t}`}
                  aktif={form.tipe_santri === t}
                  judul={t === 'asrama' ? 'Asrama' : 'Non Asrama'}
                  deskripsi={t === 'asrama' ? 'Mondok di pesantren' : 'Pulang setiap hari'}
                  onClick={() => ubah({ tipe_santri: t })}
                />
              ))}
            </div>
          </Field>
        ) : null}

        {form.is_pindahan && lembaga ? (
          <Field
            id="select_masuk_tingkat"
            label="Tingkat masuk"
            hint="Tingkat yang tersedia untuk santri pindahan di lembaga ini."
            error={errors.masuk_tingkat}
          >
            <select
              id="select_masuk_tingkat"
              className={kelasInput}
              value={form.masuk_tingkat}
              onChange={(e) => ubah({ masuk_tingkat: e.target.value })}
            >
              <option value="" disabled>
                Pilih tingkat
              </option>
              {lembaga.tingkat_pindahan.map((t) => (
                <option key={t} value={t}>
                  Tingkat {t}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {lembaga && nominalTampil !== null ? (
          <KartuInfo>
            <div className="flex items-center justify-between gap-3">
              <span>Biaya pendaftaran</span>
              <span className="text-base font-bold">{rupiah(nominalTampil)}</span>
            </div>
            {kuotaHabis ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Kuota penuh — pendaftaran akan masuk daftar tunggu (waiting list).
              </p>
            ) : sisaKuota[0] !== null ? (
              <p className="mt-2 text-xs text-emerald-800">Sisa kuota: {sisaKuota[0]}</p>
            ) : null}
            {(lembaga.biaya_masuk > 0 || (form.tipe_santri === 'asrama' && lembaga.biaya_asrama > 0)) ? (
              <p className="mt-2 text-xs text-emerald-900/80">
                Biaya masuk: {rupiah(lembaga.biaya_masuk)}
                {form.tipe_santri === 'asrama' && lembaga.biaya_asrama > 0
                  ? ` + biaya asrama ${rupiah(lembaga.biaya_asrama)}`
                  : ''}{' '}
                (dibayar saat daftar ulang).
              </p>
            ) : null}
          </KartuInfo>
        ) : null}
      </section>
    </div>
  );
}
