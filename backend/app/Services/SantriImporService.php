<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Support\Tanggal;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Logika import GABUNGAN siswa per baris: identitas (`santri`) +
 * keanggotaan (`lembaga_santri`) dalam satu baris, plus riwayat belajar
 * perdana opsional dari `tahaj_masuk` + `tingkat_masuk`.
 * Dipakai endpoint import-potong bertahap (potongan JSON dari browser).
 *
 * Pencocokan santri 2 lapis per baris:
 *  (a) `santri_id` eksak (bila diisi),
 *  (b) `nis_lokal + lembaga` (kunci utama; NIK sengaja bukan kunci karena
 *      boleh ganda),
 *  lalu create baru (wajib ada `nama_lengkap`).
 *
 * Keanggotaan WAJIB: tiap baris harus punya `jenjang` (minimal 1 lembaga).
 * Belum ada → create (`is_active_lembaga` bawaan true); sudah ada baris untuk
 * pasangan santri+lembaga → update (hanya nilai non-kosong yang menimpa).
 * Baris di luar lingkup tenant pengimport → gagal per baris (bukan 403).
 * Mode kering (`$kering = true`) menjalankan SEMUA cek tanpa menulis.
 */
class SantriImporService
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    /** Santri baru yang dibuat. */
    public int $dibuat = 0;

    /** Baris yang menimpa santri/keanggotaan lama. */
    public int $diperbarui = 0;

    /** Riwayat belajar perdana yang dibuat dari `tahaj_masuk` + `tingkat_masuk`. */
    public int $barisRiwayat = 0;

    /** NIS baris yang sedang diproses (untuk kolom kunci di galat). */
    protected ?string $nisAktif = null;

    /** Guard duplikat intra-potongan: kunci lembaga|nis_lokal. */
    protected array $dilihatNis = [];

    /**
     * Kolom teks yang rawan terbaca sebagai angka dari sel numerik
     * (NISN `1234567890` tiba sebagai int → gagal rule `string`).
     */
    protected const KOLOM_TEKS = [
        'nik', 'nisn', 'no_kk', 'ayah_nik', 'ibu_nik', 'wali_nik',
        'rt', 'rw', 'kode_pos', 'no_hp_santri', 'ayah_telp', 'ibu_telp', 'wali_telp',
        'nomor_kip', 'nis_lokal', 'nis_kemenag', 'tahaj_masuk', 'no_urut',
        'tingkat_masuk', 'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal',
        'alamat_sekolah_asal',
    ];

    /** Kolom tanggal: serial number → `Y-m-d` (string teks lolos apa adanya). */
    protected const KOLOM_TANGGAL = [
        'tgl_lahir', 'tanggal_masuk', 'ayah_tgl_lahir', 'ibu_tgl_lahir',
        'wali_tgl_lahir', 'tgl_masuk', 'tgl_selesai',
    ];

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->valid + count($this->gagal),
            'baris_valid' => $this->valid,
            'baris_gagal' => count($this->gagal),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
            'baris_riwayat_dibuat' => $this->barisRiwayat,
        ];
    }

    /**
     * Normalisasi SEBELUM validasi: angka sel numerik → string kolom teks;
     * serial tanggal → `Y-m-d`; tanggal nol → null; `tahaj_masuk`
     * `1998-1999` (strip) → kanonis `1998/1999` (slash).
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        foreach (static::KOLOM_TEKS as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                // 26001.0 → '26001' (bukan '26001.0'); pecahan tak wajar dibiarkan string.
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        foreach (static::KOLOM_TANGGAL as $kolom) {
            if (! isset($baris[$kolom])) {
                continue;
            }
            // Tanggal nol (`1900-01-00`) = sel kosong di sistem sumber.
            if (Tanggal::adalahTanggalNol($baris[$kolom])) {
                $baris[$kolom] = null;

                continue;
            }
            if (is_int($baris[$kolom]) || is_float($baris[$kolom])) {
                try {
                    $baris[$kolom] = ExcelDate::excelToDateTimeObject($baris[$kolom])->format('Y-m-d');
                } catch (\Throwable $e) {
                    // Biarkan apa adanya agar validasi `date` menolak dengan pesan jelas.
                }
            }
        }

        if (isset($baris['tahaj_masuk'])) {
            $baris['tahaj_masuk'] = static::normalisasiTahunAjaran($baris['tahaj_masuk']);
        }

        return $baris;
    }

    /**
     * Normalisasi tahun ajaran ke format kanonis `YYYY/YYYY` (kunci `tahun_ajaran.nama`).
     * Menerima pemisah strip/en-dash/slash dan tahun akhir 2 digit (`1998-99`).
     */
    protected static function normalisasiTahunAjaran(mixed $nilai): mixed
    {
        if (is_int($nilai) || is_float($nilai)) {
            $nilai = fmod((float) $nilai, 1.0) === 0.0 ? (string) (int) $nilai : (string) $nilai;
        }
        if (! is_string($nilai)) {
            return $nilai;
        }
        $teks = trim($nilai);
        if (preg_match('/^(\d{4})\s*[-–—\/]\s*(\d{2}|\d{4})$/u', $teks, $m)) {
            $akhir = $m[2];
            if (strlen($akhir) === 2) {
                $akhir = substr($m[1], 0, 2).$akhir;
            }

            return $m[1].'/'.$akhir;
        }

        return $nilai;
    }

    /**
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` = nomor
     * baris file baris pertama potongan dikurangi 1 (heading = 1), sehingga
     * nomor galat absolut dan selaras antar potongan.
     *
     * @param  array<int, array<string, mixed>>  $potongan
     */
    public function prosesPotongan(array $potongan, int $nomorAwal, bool $kering): void
    {
        $jalan = function () use ($potongan, $nomorAwal, $kering) {
            $tersentuh = [];
            foreach (array_values($potongan) as $i => $baris) {
                $no = $nomorAwal + $i + 1;
                $baris = is_array($baris) ? $baris : [];
                $nis = trim((string) ($baris['nis_lokal'] ?? ''));
                $this->nisAktif = $nis === '' ? null : $nis;
                // Baris tanpa kunci identitas apa pun dianggap kosong/pemisah.
                if (empty($baris['nama_lengkap']) && empty($baris['santri_id']) && empty($baris['nik']) && empty($baris['nis_lokal'])) {
                    continue;
                }

                if ($this->prosesBaris($baris, $no, $tersentuh, $kering)) {
                    $this->valid++;
                }
            }

            if (! $kering) {
                foreach (array_unique($tersentuh) as $santriId) {
                    Santri::find($santriId)?->hitungUlangStatusGlobal();
                }
            }
        };

        if ($kering) {
            $jalan();
        } else {
            DB::transaction($jalan);
        }
    }

    /** @param  array<string, mixed>  $baris
     *  @param  array<int, int>  $tersentuh */
    protected function prosesBaris(array $baris, int $no, array &$tersentuh, bool $kering): bool
    {
        $validator = Validator::make($baris, static::rules());
        if ($validator->fails()) {
            $kolom = (string) $validator->errors()->keys()[0];
            $this->fail($no, $kolom, (string) $validator->errors()->first($kolom));

            return false;
        }

        // Keanggotaan wajib: baris tanpa `jenjang` ditolak.
        $jenjang = $this->resolveLembagaId($baris, $no);
        if ($jenjang === null) {
            return false;
        }

        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return false;
        }

        // Riwayat perdana (opsional): `tahaj_masuk` harus tahun ajaran yang ada.
        $tahunAjaranMasuk = trim((string) ($baris['tahaj_masuk'] ?? ''));
        if ($tahunAjaranMasuk !== '' && ! TahunAjaran::whereKey($tahunAjaranMasuk)->exists()) {
            $this->fail($no, 'tahaj_masuk', "Tahun ajaran \"{$tahunAjaranMasuk}\" tidak ditemukan.");

            return false;
        }

        $dataSantri = $this->buatDataSantri($baris);
        // Jaring pengaman: kegagalan tulis DB (mis. bentrok unik) dicatat per
        // baris, bukan 500 yang membatalkan seluruh file.
        try {
            $santri = $this->cocokkanSantri($baris, $dataSantri, $no, $jenjang, $sudahAda, $kering);
            if ($santri === null) {
                return false;
            }

            if (! $this->simpanKeanggotaan($santri, $jenjang, $baris, $no, $keanggotaanBaru, $kering)) {
                return false;
            }
        } catch (QueryException $e) {
            $this->fail($no, 'basis_data', 'Gagal menyimpan baris ini ke database.');

            return false;
        }

        if ($tahunAjaranMasuk !== '') {
            $this->catatRiwayatPerdana($santri, $jenjang, $tahunAjaranMasuk, $baris, $no, $kering);
        }

        if (! $sudahAda && $keanggotaanBaru) {
            $this->dibuat++;
        } else {
            $this->diperbarui++;
        }
        if (! $kering && $santri->exists) {
            $tersentuh[] = (int) $santri->id;
        }

        return true;
    }

    /**
     * Buat riwayat belajar perdana (semester 1) dari `tahaj_masuk` +
     * `tingkat_masuk` untuk SEMUA baris import yang valid — bukan hanya yang
     * keanggotaannya sudah aktif (`terima()` mengaktifkan keanggotaan bila
     * perlu). Dilewati bila baris eksplisit ditandai nonaktif, santri sudah
     * punya riwayat aktif di lembaga ini, ATAU sudah punya baris (santri,
     * tahun ajaran, jenjang, semester 1).
     * Mode kering: cek saja (santri baru pasti belum punya riwayat).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function catatRiwayatPerdana(Santri $santri, string $jenjang, string $tahunAjaran, array $baris, int $no, bool $kering): void
    {
        // Baris yang eksplisit ditandai nonaktif tidak dibuatkan riwayat
        // berjalan — `terima()` di bawah justru akan mengaktifkan ulang
        // keanggotaannya bila dipaksakan.
        if (in_array(mb_strtolower(trim((string) ($baris['is_active_lembaga'] ?? ''))), ['0', 'false', 'nonaktif', 'tidak', 't'], true)) {
            return;
        }

        // Lewati bila sudah ada riwayat aktif di jenjang ini (santri sedang berjalan)
        // atau baris perdana identik sudah ada (termasuk yang sudah diarsipkan).
        // Santri baru (belum tersimpan) pasti belum punya riwayat.
        $sudahAda = $santri->exists && RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where(fn ($q) => $q
                ->where('is_active_riwayat', RiwayatBelajar::YA)
                ->orWhere(fn ($q2) => $q2
                    ->where('tahun_ajaran', $tahunAjaran)
                    ->where('semester', '1')))
            ->exists();
        if ($sudahAda) {
            return;
        }

        if ($kering) {
            $this->barisRiwayat++;

            return;
        }

        $tingkat = trim((string) ($baris['tingkat_masuk'] ?? ''));

        try {
            app(PenerimaanService::class)->terima($santri, $jenjang, $tahunAjaran, [
                'tingkat' => $tingkat === '' ? null : $tingkat,
                'tgl_masuk' => Tanggal::parse($baris['tgl_masuk'] ?? null),
            ]);
            $this->barisRiwayat++;
        } catch (ValidationException $e) {
            $pesan = (string) (collect($e->errors())->flatten()->first() ?? 'Riwayat belajar gagal dibuat.');
            $this->fail($no, 'riwayat_belajar', $pesan);
        } catch (QueryException $e) {
            // Bentrok unique (mis. balapan) → catat per baris, jangan batalkan import.
            $this->fail($no, 'riwayat_belajar', 'Riwayat belajar bentrok dengan data yang ada.');
        }
    }

    /**
     * Lembaga dari `jenjang` (case-insensitive).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function resolveLembagaId(array $baris, int $no): ?string
    {
        $kode = trim((string) ($baris['jenjang'] ?? ''));
        if ($kode === '') {
            $this->fail($no, 'jenjang', 'Isi jenjang lembaga (mis. MI/MD).');

            return null;
        }

        $lembaga = Lembaga::whereRaw('UPPER(jenjang) = ?', [mb_strtoupper($kode)])->first();
        if (! $lembaga) {
            $this->fail($no, 'jenjang', "Lembaga \"{$kode}\" tidak ditemukan.");

            return null;
        }

        return $lembaga->jenjang;
    }

    /**
     * Cocokkan santri 2 lapis; $sudahAda true bila baris menimpa santri lama.
     * Mode kering: tanpa menulis (santri baru = model transient).
     *
     * @param  array<string, mixed>  $baris
     * @param  array<string, mixed>  $dataSantri
     */
    protected function cocokkanSantri(array $baris, array $dataSantri, int $no, string $jenjang, ?bool &$sudahAda, bool $kering): ?Santri
    {
        $sudahAda = false;

        // (a) Kunci eksak santri_id.
        $santriId = trim((string) ($baris['santri_id'] ?? ''));
        if ($santriId !== '') {
            $santri = Santri::find((int) $santriId);
            if (! $santri) {
                $this->fail($no, 'santri_id', "Santri id {$santriId} tidak ditemukan.");

                return null;
            }
            if (empty($dataSantri['nama_lengkap'])) {
                $dataSantri['nama_lengkap'] = $santri->nama_lengkap;
            }
            // Baris parsial (hanya kunci + keanggotaan): sel kosong = pertahankan.
            if (! $kering) {
                $santri->update($this->tanpaKosong($dataSantri));
            }
            $sudahAda = true;

            return $santri;
        }

        $nikTerisi = trim((string) ($baris['nik'] ?? '')) !== '';
        $nisTerisi = trim((string) ($baris['nis_lokal'] ?? '')) !== '';

        // (b) NIS lokal + lembaga (NIK bukan kunci karena boleh ganda).
        if ($nisTerisi) {
            $nis = trim((string) $baris['nis_lokal']);
            $kunci = $jenjang.'|'.mb_strtolower($nis);
            if (isset($this->dilihatNis[$kunci])) {
                $dilihat = $this->dilihatNis[$kunci];
                if (! $kering) {
                    $dilihat->update($this->tanpaKosong($dataSantri));
                }
                $sudahAda = true;

                return $dilihat;
            }
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nis)->first();
            if ($ls && ($santri = Santri::find($ls->santri_id))) {
                if (! $kering) {
                    $santri->update($this->tanpaKosong($dataSantri));
                }
                $this->dilihatNis[$kunci] = $santri;
                $sudahAda = true;

                return $santri;
            }
            // NIS belum terdaftar → create baru di bawah (membawa nis_lokal).
        }

        // (c) Create baru — wajib ada nama.
        if (empty($dataSantri['nama_lengkap'])) {
            $this->fail($no, 'nama_lengkap', 'Nama wajib diisi untuk santri baru.');

            return null;
        }

        $baru = new Santri(array_merge($dataSantri, ['nik' => $nikTerisi ? trim((string) $baris['nik']) : null]));
        if ($kering) {
            return $baru;
        }
        $baru->save();

        return $baru->fresh();
    }

    /**
     * Buat/update keanggotaan pasangan santri+lembaga; $baru false bila menimpa.
     * Mode kering: cek bentrok saja tanpa menulis (santri transient = pasti baru).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function simpanKeanggotaan(Santri $santri, string $jenjang, array $baris, int $no, ?bool &$baru, bool $kering): bool
    {
        $baru = false;

        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        $nisLokal = $nisLokal === '' ? null : $nisLokal;
        $nisKemenag = trim((string) ($baris['nis_kemenag'] ?? ''));
        $nisKemenag = $nisKemenag === '' ? null : $nisKemenag;
        $aktif = $this->parseAktif($baris['is_active_lembaga'] ?? null, $no);
        if ($aktif === null && array_key_exists('is_active_lembaga', $baris) && trim((string) $baris['is_active_lembaga']) !== '') {
            return false; // failure sudah dicatat parseAktif
        }
        $tglMasuk = Tanggal::parse($baris['tgl_masuk'] ?? null);
        $tglSelesai = Tanggal::parse($baris['tgl_selesai'] ?? null);
        $teksKolom = function (string $kunci) use ($baris): ?string {
            $nilai = trim((string) ($baris[$kunci] ?? ''));

            return $nilai === '' ? null : $nilai;
        };
        $noUrut = $teksKolom('no_urut');
        $konteks = [
            'tahaj_masuk' => $teksKolom('tahaj_masuk'),
            'tingkat_masuk' => $teksKolom('tingkat_masuk'),
            // String bebas (mis. `706x` untuk data ganda historis).
            'no_urut' => $noUrut,
            'nama_sekolah_asal' => $teksKolom('nama_sekolah_asal'),
            'npsn_sekolah_asal' => $teksKolom('npsn_sekolah_asal'),
            'nss_sekolah_asal' => $teksKolom('nss_sekolah_asal'),
            'alamat_sekolah_asal' => $teksKolom('alamat_sekolah_asal'),
        ];

        $ada = $santri->exists
            ? LembagaSantri::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->orderByDesc('id')
                ->first()
            : null;

        if ($ada === null) {
            if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }
            // NIS Kemenag bebas duplikat (hasil generate; bisa digenerate ulang).

            if (! $kering) {
                LembagaSantri::create([
                    'santri_id' => $santri->id,
                    'jenjang' => $jenjang,
                    'nis_lokal' => $nisLokal,
                    'nis_kemenag' => $nisKemenag,
                    'is_active_lembaga' => $aktif ?? LembagaSantri::YA,
                    'tgl_masuk' => $tglMasuk,
                    'tgl_selesai' => $tglSelesai,
                ] + array_filter($konteks, fn ($v) => $v !== null));
            }
            $baru = true;

            return true;
        }

        // Baris sendiri ber-NIS sama diutamakan (idempoten saat import ulang;
        // santri boleh punya >1 baris per lembaga).
        if ($nisLokal !== null) {
            $seNis = LembagaSantri::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('nis_lokal', $nisLokal)
                ->orderByDesc('id')
                ->first();
            if ($seNis !== null) {
                $ada = $seNis;
            }
        }

        // Masuk lagi setelah keluar = periode BARU (NIS baru): arsip lama
        // dipertahankan, buat baris baru. Koreksi NIS hanya untuk baris aktif.
        if ($ada->is_active_lembaga === LembagaSantri::TIDAK
            && $nisLokal !== null && $nisLokal !== $ada->nis_lokal
        ) {
            if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }

            if (! $kering) {
                LembagaSantri::create([
                    'santri_id' => $santri->id,
                    'jenjang' => $jenjang,
                    'nis_lokal' => $nisLokal,
                    'nis_kemenag' => $nisKemenag,
                    'is_active_lembaga' => $aktif ?? LembagaSantri::YA,
                    'tgl_masuk' => $tglMasuk,
                    'tgl_selesai' => $tglSelesai,
                ] + array_filter($konteks, fn ($v) => $v !== null));
            }
            $baru = true;

            return true;
        }

        // Update: hanya nilai non-kosong yang menimpa (sel kosong = pertahankan).
        // NIS lokal wajib unik; NIS Kemenag bebas duplikat.
        if ($nisLokal !== null && $nisLokal !== $ada->nis_lokal) {
            if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }
        }

        if ($kering) {
            return true;
        }

        $ubah = [];
        if ($nisLokal !== null) {
            $ubah['nis_lokal'] = $nisLokal;
        }
        if ($nisKemenag !== null) {
            $ubah['nis_kemenag'] = $nisKemenag;
        }
        if ($aktif !== null) {
            $ubah['is_active_lembaga'] = $aktif;
        }
        if ($tglMasuk !== null) {
            $ubah['tgl_masuk'] = $tglMasuk;
        }
        if ($tglSelesai !== null) {
            $ubah['tgl_selesai'] = $tglSelesai;
        }
        foreach ($konteks as $kolom => $nilai) {
            if ($nilai !== null) {
                $ubah[$kolom] = $nilai;
            }
        }
        if ($ubah !== []) {
            $ada->update($ubah);
        }

        return true;
    }

    /**
     * Bangun array kolom `santri` dari satu baris (salinan SantriLengkapImport
     * agar service mandiri dari Maatwebsite).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    protected function buatDataSantri(array $row): array
    {
        return [
            'nama_lengkap' => $row['nama_lengkap'] ?? null,
            'nama_singkat' => $row['nama_singkat'] ?? null,
            'nisn' => $row['nisn'] ?? null,
            'tmp_lahir' => $row['tmp_lahir'] ?? null,
            'tgl_lahir' => Tanggal::parse($row['tgl_lahir'] ?? null),
            'jk' => $row['jk'] ?? null,
            'anak_ke' => $row['anak_ke'] ?? null,
            'j_saudara' => $row['j_saudara'] ?? null,
            'tipe_santri' => in_array($row['tipe_santri'] ?? null, ['asrama', 'non_asrama'], true) ? $row['tipe_santri'] : 'non_asrama',
            'no_hp_santri' => $row['no_hp_santri'] ?? null,
            'email_santri' => $row['email_santri'] ?? null,
            'agama' => $row['agama'] ?? 'Islam',
            'cita_cita' => $row['cita_cita'] ?? null,
            'hobi' => $row['hobi'] ?? null,
            'kebutuhan_khusus' => $row['kebutuhan_khusus'] ?? null,
            'kebutuhan_disabilitas' => $row['kebutuhan_disabilitas'] ?? null,
            'nomor_kip' => $row['nomor_kip'] ?? null,
            'no_kk' => $row['no_kk'] ?? null,
            'kepala_keluarga' => $row['kepala_keluarga'] ?? null,
            'kewarganegaraan' => ($row['kewarganegaraan'] ?? null) ?: 'WNI',
            'bahasa_sehari' => $row['bahasa_sehari'] ?? null,
            'status_tempat_tinggal' => $row['status_tempat_tinggal'] ?? null,
            'jarak_ke_pesantren' => $row['jarak_ke_pesantren'] ?? null,
            'waktu_tempuh' => $row['waktu_tempuh'] ?? null,
            'transportasi' => $row['transportasi'] ?? null,
            'tanggal_masuk' => Tanggal::parse($row['tanggal_masuk'] ?? null),

            // Data Orang Tua & Wali
            'ayah_nama' => $row['ayah_nama'] ?? null,
            'ayah_nik' => $row['ayah_nik'] ?? null,
            'ayah_tmp_lahir' => $row['ayah_tmp_lahir'] ?? null,
            'ayah_tgl_lahir' => Tanggal::parse($row['ayah_tgl_lahir'] ?? null),
            'ayah_status' => $row['ayah_status'] ?? null,
            'ayah_pendidikan' => $row['ayah_pendidikan'] ?? null,
            'ayah_pekerjaan' => $row['ayah_pekerjaan'] ?? null,
            'ayah_penghasilan' => $row['ayah_penghasilan'] ?? null,
            'ayah_telp' => $row['ayah_telp'] ?? null,
            'ayah_alamat' => $row['ayah_alamat'] ?? null,
            'ayah_status_tempat_tinggal' => $row['ayah_status_tempat_tinggal'] ?? null,
            'ibu_nama' => $row['ibu_nama'] ?? null,
            'ibu_nik' => $row['ibu_nik'] ?? null,
            'ibu_tmp_lahir' => $row['ibu_tmp_lahir'] ?? null,
            'ibu_tgl_lahir' => Tanggal::parse($row['ibu_tgl_lahir'] ?? null),
            'ibu_status' => $row['ibu_status'] ?? null,
            'ibu_pendidikan' => $row['ibu_pendidikan'] ?? null,
            'ibu_pekerjaan' => $row['ibu_pekerjaan'] ?? null,
            'ibu_penghasilan' => $row['ibu_penghasilan'] ?? null,
            'ibu_telp' => $row['ibu_telp'] ?? null,
            'ibu_alamat' => $row['ibu_alamat'] ?? null,
            'ibu_status_tempat_tinggal' => $row['ibu_status_tempat_tinggal'] ?? null,
            'wali_nama' => $row['wali_nama'] ?? null,
            'wali_nik' => $row['wali_nik'] ?? null,
            'wali_tmp_lahir' => $row['wali_tmp_lahir'] ?? null,
            'wali_tgl_lahir' => Tanggal::parse($row['wali_tgl_lahir'] ?? null),
            'wali_status' => $row['wali_status'] ?? null,
            'wali_pendidikan' => $row['wali_pendidikan'] ?? null,
            'wali_pekerjaan' => $row['wali_pekerjaan'] ?? null,
            'wali_penghasilan' => $row['wali_penghasilan'] ?? null,
            'wali_telp' => $row['wali_telp'] ?? null,
            'wali_alamat' => $row['wali_alamat'] ?? null,
            'wali_status_tempat_tinggal' => $row['wali_status_tempat_tinggal'] ?? null,
            'yang_membiayai' => $row['yang_membiayai'] ?? null,

            // Alamat
            'provinsi' => $row['provinsi'] ?? null,
            'kab_kota' => $row['kab_kota'] ?? null,
            'kecamatan' => $row['kecamatan'] ?? null,
            'desa_kelurahan' => $row['desa_kelurahan'] ?? null,
            'rt' => $row['rt'] ?? null,
            'rw' => $row['rw'] ?? null,
            'alamat' => $row['alamat'] ?? null,
            'kode_pos' => $row['kode_pos'] ?? null,
        ];
    }

    /**
     * Buang nilai kosong (update parsial: sel kosong = pertahankan data lama).
     * Pengosongan sengaja tetap lewat UI.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function tanpaKosong(array $data): array
    {
        return array_filter($data, fn ($v) => $v !== null && $v !== '');
    }

    /**
     * Normalisasi keaktifan → 'Ya'/'Tidak'.
     * null = sel kosong (ikut bawaan); failure dicatat bila tak dikenali.
     */
    protected function parseAktif(mixed $nilai, int $no): ?string
    {
        $teks = trim((string) ($nilai ?? ''));
        if ($teks === '') {
            return null;
        }
        $t = mb_strtolower($teks);
        if (in_array($t, ['1', 'true', 'aktif', 'ya', 'y'], true)) {
            return LembagaSantri::YA;
        }
        if (in_array($t, ['0', 'false', 'nonaktif', 'tidak', 't'], true)) {
            return LembagaSantri::TIDAK;
        }

        $this->fail($no, 'is_active_lembaga', "Status aktif \"{$teks}\" tidak dikenali (isi Ya/Tidak).");

        return null;
    }

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nisAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }

    /**
     * Aturan validasi per baris (basis buku induk + blok keanggotaan wajib).
     * Dipakai validasi manual potongan JSON dan penanda kolom wajib template.
     *
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            // Update via santri_id boleh tanpa identitas (profil tak disentuh bila kosong).
            'nama_lengkap' => ['required_without:santri_id', 'nullable', 'string', 'max:255'],
            'jk' => ['required_without:santri_id', 'nullable', 'in:L,P'],
            // Identitas: minimal satu kunci (NIK tak selalu ada).
            'nik' => ['required_without_all:nis_lokal,santri_id', 'nullable', 'string', 'max:20'],
            // Blok keanggotaan WAJIB: tiap santri minimal terdaftar di 1 jenjang.
            'santri_id' => ['nullable', 'integer'],
            'jenjang' => ['required', 'string'],
            'nis_lokal' => ['required_without_all:nik,santri_id', 'nullable', 'string', 'max:20'],
            'nis_kemenag' => ['nullable', 'string', 'max:20'],
            'tahaj_masuk' => ['nullable', 'string', 'max:50'],
            'tingkat_masuk' => ['nullable', 'string', 'max:20'],
            'no_urut' => ['nullable', 'string', 'max:20'],
            'nama_sekolah_asal' => ['nullable', 'string', 'max:255'],
            'npsn_sekolah_asal' => ['nullable', 'string', 'max:20'],
            'nss_sekolah_asal' => ['nullable', 'string', 'max:30'],
            'alamat_sekolah_asal' => ['nullable', 'string'],
            'is_active_lembaga' => ['nullable'],
            'tgl_masuk' => ['nullable', 'date'],
            'tgl_selesai' => ['nullable', 'date'],
            // Basis buku induk.
            'nisn' => ['nullable', 'digits:10'],
            'ayah_nik' => ['nullable', 'string', 'max:20'],
            'ibu_nik' => ['nullable', 'string', 'max:20'],
            'wali_nik' => ['nullable', 'string', 'max:20'],
            'tipe_santri' => ['nullable', 'in:asrama,non_asrama'],
            'agama' => ['nullable', 'string', 'max:50'],
            'hobi' => ['nullable', 'string', 'max:50'],
            'cita_cita' => ['nullable', 'string', 'max:50'],
            'kebutuhan_khusus' => ['nullable', 'string', 'max:50'],
            'kebutuhan_disabilitas' => ['nullable', 'string', 'max:50'],
            'ayah_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ayah_pendidikan' => ['nullable', 'string', 'max:50'],
            'ibu_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ibu_pendidikan' => ['nullable', 'string', 'max:50'],
            'wali_pekerjaan' => ['nullable', 'string', 'max:50'],
            'wali_pendidikan' => ['nullable', 'string', 'max:50'],
            'wali_penghasilan' => ['nullable', 'string', 'max:50'],
            'wali_status' => ['nullable', 'string', 'max:50'],
            'wali_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'wali_tgl_lahir' => ['nullable', 'date'],
            'wali_alamat' => ['nullable', 'string'],
            'wali_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'ayah_penghasilan' => ['nullable', 'string', 'max:50'],
            'ibu_penghasilan' => ['nullable', 'string', 'max:50'],
            'ayah_status' => ['nullable', 'string', 'max:50'],
            'ibu_status' => ['nullable', 'string', 'max:50'],
            'ayah_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ibu_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ayah_tgl_lahir' => ['nullable', 'date'],
            'ibu_tgl_lahir' => ['nullable', 'date'],
            'ayah_alamat' => ['nullable', 'string'],
            'ibu_alamat' => ['nullable', 'string'],
            'ayah_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'ibu_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'tmp_lahir' => ['nullable', 'string', 'max:50'],
            'no_hp_santri' => ['nullable', 'string', 'max:20'],
            'email_santri' => ['nullable', 'email', 'max:255'],
            'no_kk' => ['nullable', 'digits:16'],
            'kewarganegaraan' => ['nullable', 'string', 'max:10'],
            'bahasa_sehari' => ['nullable', 'string', 'max:50'],
            'status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'jarak_ke_pesantren' => ['nullable', 'string', 'max:50'],
            'waktu_tempuh' => ['nullable', 'string', 'max:50'],
            'transportasi' => ['nullable', 'string', 'max:50'],
            'yang_membiayai' => ['nullable', 'string', 'max:50'],
            'tanggal_masuk' => ['nullable', 'date'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'provinsi' => ['nullable', 'string', 'max:50'],
            'kecamatan' => ['nullable', 'string', 'max:50'],
            'desa_kelurahan' => ['nullable', 'string', 'max:50'],
        ];
    }
}
