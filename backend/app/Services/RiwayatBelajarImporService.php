<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Support\Tanggal;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Logika import riwayat belajar per baris — dipakai dua jalur:
 * file Excel (Maatwebsite, kelas RiwayatBelajarImport sebagai pembungkus
 * tipis) dan potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * UPSERT per kunci (santri, tahun ajaran, jenjang, semester): kunci baru →
 * dibuat; kunci cocok → update hanya kolom yang terisi. Pencocokan santri:
 * `nis_lokal` + `jenjang`, fallback NIS sama di pasangan MI↔MD — kecuali
 * mode gabungan (`setBuatKeanggotaan(true)`) yang, bila NIS tak terdaftar di
 * mana pun, mencocokkan `santri_id` eksak → `nama_lengkap` unik lalu
 * membuatkan keanggotaan (`lembaga_santri`) dulu. Mode kering
 * (`$kering = true`) menjalankan SEMUA cek tanpa menulis — untuk periksa
 * bertahap (pengganti rollback-transaksi yang berat di file besar).
 */ class RiwayatBelajarImporService extends ImporPotongan
{
    /** (santri, jenjang) tersentuh potongan berjalan; disinkronkan di akhir potongan. */
    protected array $tersentuh = [];

    /** Mode gabungan: buatkan keanggotaan bila santri belum punya. */
    private bool $buatKeanggotaan = false;

    public function setBuatKeanggotaan(bool $nilai): static
    {
        $this->buatKeanggotaan = $nilai;

        return $this;
    }

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->valid + count($this->gagal),
            'baris_valid' => $this->valid,
            'baris_gagal' => count($this->gagal),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
        ];
    }

    /**
     * Normalisasi SEBELUM cek: heading lama `kelas_id` disamakan ke
     * `nama_kelas` (nilai yang diharapkan = nama rombel); angka Excel
     * dinormalisasi; sel tanggal (objek DateTime atau serial General)
     * disamakan ke string Y-m-d.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTanggal($baris);
        if (isset($baris['tgl_masuk']) && (is_int($baris['tgl_masuk']) || is_float($baris['tgl_masuk']))) {
            try {
                $baris['tgl_masuk'] = ExcelDate::excelToDateTimeObject($baris['tgl_masuk'])->format('Y-m-d');
            } catch (\Throwable $e) {
                $baris['tgl_masuk'] = (string) $baris['tgl_masuk'];
            }
        }
        if (trim((string) ($baris['nama_kelas'] ?? '')) === '' && trim((string) ($baris['kelas_id'] ?? '')) !== '') {
            $baris['nama_kelas'] = $baris['kelas_id'];
        }
        if (isset($baris['nama_kelas']) && (is_int($baris['nama_kelas']) || is_float($baris['nama_kelas']))) {
            $baris['nama_kelas'] = fmod((float) $baris['nama_kelas'], 1.0) === 0.0
                ? (string) (int) $baris['nama_kelas']
                : (string) $baris['nama_kelas'];
        }

        return $baris;
    }

    /**
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` = nomor
     * baris Excel baris pertama potongan dikurangi 1 (heading = 1), sehingga
     * nomor galat absolut dan selaras antar potongan.
     * Override: baris kosong/pemisah (tanpa NIS lokal) dilewati, dan pasangan
     * (santri, jenjang) yang tersentuh disinkronkan + dihitung ulang di akhir
     * potongan — loop potongan service ini khusus.
     *
     * @param  array<int, array<string, mixed>>  $potongan
     */
    public function prosesPotongan(array $potongan, int $nomorAwal, bool $kering): void
    {
        $jalan = function () use ($potongan, $nomorAwal, $kering) {
            $this->tersentuh = [];
            foreach (array_values($potongan) as $i => $baris) {
                $no = $nomorAwal + $i + 1;
                $baris = is_array($baris) ? $baris : [];
                $nis = trim((string) ($baris['nis_lokal'] ?? ''));
                $this->kunciAktif = $nis === '' ? null : $nis;
                // Baris tanpa NIS lokal dianggap baris kosong/pemisah.
                if (empty($baris['nis_lokal'])) {
                    continue;
                }

                $this->prosesBaris($baris, $no, $kering);
            }

            if (! $kering) {
                // Periode terakhir per (santri, jenjang) yang aktif; sisanya arsip.
                $siklus = app(SiklusSantriService::class);
                foreach ($this->tersentuh as [$santriId, $jenjang]) {
                    $siklus->sinkronkanAktifRiwayat($santriId, $jenjang);
                }
                Santri::hitungUlangStatusGlobalBanyak(array_unique(array_column($this->tersentuh, 0)));
            }
        };

        if ($kering) {
            $jalan();
        } else {
            DB::transaction($jalan);
        }
    }

    /**
     * Implementasi UPSERT riwayat per kunci (santri, tahun ajaran, jenjang,
     * semester). Hitungan `valid` dihitung di sini; pasangan tersentuh
     * dikumpulkan ke `$this->tersentuh` untuk disinkronkan di akhir potongan.
     *
     * @param  array<string, mixed>  $row
     */
    protected function prosesBaris(array $row, int $no, bool $kering): void
    {
        $jenjang = trim((string) ($row['jenjang'] ?? ''));
        $ta = TahunAjaran::normalisasiNama((string) ($row['tahun_ajaran'] ?? ''));

        if (! $this->prosesBarisRiwayat($row, $no, $jenjang, $ta, $kering)) {
            return;
        }

        $this->valid++;
    }

    /**
     * Inti pemrosesan satu baris riwayat (validasi + UPSERT). Dipecah dari
     * `prosesBaris()` karena butuh `jenjang` + `ta` hasil normalisasi baris.
     *
     * @param  array<string, mixed>  $row
     */
    protected function prosesBarisRiwayat(array $row, int $no, string $jenjang, string $ta, bool $kering): bool
    {
        if ($jenjang === '' || ! Lembaga::whereKey($jenjang)->exists()) {
            $this->fail($no, 'jenjang', 'Lembaga tidak valid (isi jenjang, mis. MI/MD).');

            return false;
        }

        // Izin mengikuti akun per baris (super_admin lolos semua; admin
        // lembaga hanya lembaganya) — baris luar lingkup gagal per baris.
        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return false;
        }

        $tahun = TahunAjaran::find($ta);
        if (! $tahun || ! TahunAjaran::efektif($jenjang)->contains('nama', $tahun->nama)) {
            $this->fail($no, 'tahun_ajaran', 'Tahun ajaran tidak berlaku untuk lembaga ini.');

            return false;
        }

        $santri = $this->cariSantri($row, $jenjang, $no);
        if ($santri === null) {
            return false;
        }
        [$santri, $langsung] = $santri;

        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        $nisLokal = $nisLokal === '' ? null : $nisLokal;

        // Status diparse di depan: keanggotaan hanya diaktifkan ulang bila
        // barisnya aktif/lanjut (baris arsip tak membangunkan arsip keanggotaan).
        $statusAwal = $this->normalisasiStatus('status_awal', $row['status_awal'] ?? null, $jenjang) ?: 'santri_baru';
        $statusAkhir = $this->normalisasiStatus('status_akhir', $row['status_akhir'] ?? null, $jenjang) ?: 'aktif';
        $kamusAwal = RefService::kodeAktif('status_awal', $jenjang);
        if ($kamusAwal !== [] && ! in_array($statusAwal, $kamusAwal, true)) {
            $this->fail($no, 'status_awal', "Status awal {$statusAwal} tidak aktif di lembaga ini.");

            return false;
        }
        $kamusAkhir = RefService::kodeAktif('status_akhir', $jenjang);
        if ($kamusAkhir !== [] && ! in_array($statusAkhir, $kamusAkhir, true)) {
            $this->fail($no, 'status_akhir', "Status akhir {$statusAkhir} tidak aktif di lembaga ini.");

            return false;
        }

        $keanggotaan = $this->pastikanKeanggotaan($santri, $jenjang, $nisLokal, in_array($statusAkhir, ['aktif', 'lanjut'], true), $langsung, $kering, $no);
        if ($keanggotaan === false) {
            return false;
        }

        $semester = (string) ($row['semester'] ?? '1');
        if (! in_array($semester, ['1', '2'], true)) {
            $this->fail($no, 'semester', 'Semester harus 1 atau 2.');

            return false;
        }

        $kelasId = $this->resolveKelasId($row['nama_kelas'] ?? null, $jenjang, $ta, $no);
        if ($kelasId === false) {
            return false;
        }

        $mentahAbsen = trim((string) ($row['no_absen'] ?? ''));
        if ($mentahAbsen !== '' && (! ctype_digit($mentahAbsen) || (int) $mentahAbsen < 1)) {
            $this->fail($no, 'no_absen', 'No. absen harus angka minimal 1.');

            return false;
        }
        $noAbsen = $mentahAbsen === '' ? null : (int) $mentahAbsen;

        $mentahTgl = trim((string) ($row['tgl_masuk'] ?? ''));
        $tglMasuk = Tanggal::parse($row['tgl_masuk'] ?? null);
        if ($mentahTgl !== '' && $tglMasuk === null && ! Tanggal::adalahTanggalNol($row['tgl_masuk'] ?? null)) {
            $this->fail($no, 'tgl_masuk', 'Tanggal masuk tidak valid.');

            return false;
        }
        // Tingkat kosong mewarisi kelas (bila kelas terisi).
        $tingkat = trim((string) ($row['tingkat'] ?? '')) ?: null;
        if ($tingkat === null && $kelasId !== null) {
            $tingkat = Kelas::whereKey($kelasId)->value('tingkat') ?: null;
        }

        // Sel terisi (untuk update: hanya sel terisi yang menimpa).
        $terisi = fn (string $kunci) => array_key_exists($kunci, $row) && trim((string) $row[$kunci]) !== '';

        $kunci = [
            'santri_id' => $santri->id,
            'tahun_ajaran' => $ta,
            'jenjang' => $jenjang,
            'semester' => $semester,
        ];
        $lama = RiwayatBelajar::where($kunci)->first();

        if ($kering) {
            // Periksa: semua cek lolos → hitung niat tulisnya saja.
            if ($lama === null) {
                $this->dibuat++;
            } else {
                $this->diperbarui++;
            }

            return true;
        }

        if ($lama === null) {
            // Insert: default berlaku (status aktif, tingkat warisi kelas).
            RiwayatBelajar::create($kunci + [
                'kelas_id' => $kelasId,
                'tgl_masuk' => $tglMasuk,
                'no_absen' => $noAbsen,
                'tingkat' => $tingkat,
                'status_awal' => $statusAwal,
                'status_akhir' => $statusAkhir,
                'is_active_riwayat' => $statusAkhir === 'aktif' ? RiwayatBelajar::YA : RiwayatBelajar::TIDAK,
            ]);
            $this->dibuat++;
        } else {
            // Update: hanya sel terisi yang menimpa (sel kosong = pertahankan,
            // tak bisa mengosongkan/mengarsipkan diam-diam via import).
            $ubah = [];
            if ($terisi('nama_kelas')) {
                $ubah['kelas_id'] = $kelasId;
            }
            if ($terisi('tgl_masuk')) {
                $ubah['tgl_masuk'] = $tglMasuk;
            }
            if ($terisi('no_absen')) {
                $ubah['no_absen'] = $noAbsen;
            }
            if ($terisi('tingkat')) {
                $ubah['tingkat'] = $tingkat;
            } elseif ($terisi('nama_kelas') && $tingkat !== null) {
                $ubah['tingkat'] = $tingkat; // ganti kelas tanpa tingkat → warisi
            }
            if ($terisi('status_awal')) {
                $ubah['status_awal'] = $statusAwal;
            }
            if ($terisi('status_akhir')) {
                $ubah['status_akhir'] = $statusAkhir;
                $ubah['is_active_riwayat'] = $statusAkhir === 'aktif' ? RiwayatBelajar::YA : RiwayatBelajar::TIDAK;
            }
            if ($ubah !== []) {
                $lama->update($ubah);
            }
            $this->diperbarui++;
        }

        $this->tersentuh[$santri->id.'|'.$jenjang] = [(int) $santri->id, $jenjang];

        return true;
    }

    /** Cari santri via `nis_lokal` + lembaga (unik per lembaga di DB).
     *  Fallback pasangan MI↔MD: NIS yang sama di lembaga pasangan menandai
     *  santri yang sama (keanggotaan target lalu dibuat otomatis).
     *  Kembali [santri, langsung]: langsung=false bila cocok via pasangan
     *  (NIS target miliknya dipertahankan, tak ditimpa NIS baris).
     *
     *  @param  array<string, mixed>  $row
     *  @return array{0: Santri, 1: bool}|null */
    protected function cariSantri(array $row, string $jenjang, int $no): ?array
    {
        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                $santri = Santri::find($ls->santri_id);
                if ($santri) {
                    return [$santri, true];
                }
            }

            $pasangan = Lembaga::pasanganJenjang($jenjang);
            if ($pasangan !== null) {
                $kandidat = LembagaSantri::where('jenjang', $pasangan)->where('nis_lokal', $nisLokal)->first();
                if ($kandidat) {
                    $santri = Santri::find($kandidat->santri_id);
                    if ($santri) {
                        return [$santri, false];
                    }
                }
            }
        }

        // Mode gabungan: NIS tak terdaftar di mana pun → cocokkan identitas
        // cadangan (keanggotaan dibuatkan di bawah via pastikanKeanggotaan).
        if ($this->buatKeanggotaan
            && (! empty($row['santri_id']) || trim((string) ($row['nama_lengkap'] ?? '')) !== '')
        ) {
            $alternatif = $this->cariSantriAlternatif($row, $no);
            if ($alternatif !== null) {
                return [$alternatif, true];
            }

            return null;
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /**
     * Identitas cadangan mode gabungan: `santri_id` eksak → `nama_lengkap`
     * unik. Gagal dicatat di sini (kembalikan null).
     *
     * @param  array<string, mixed>  $row
     */
    protected function cariSantriAlternatif(array $row, int $no): ?Santri
    {
        if (! empty($row['santri_id'])) {
            $santri = Santri::find((int) $row['santri_id']);
            if ($santri) {
                return $santri;
            }
        }

        $nama = trim((string) ($row['nama_lengkap'] ?? ''));
        if ($nama !== '') {
            $kandidat = Santri::where('nama_lengkap', $nama)->get();
            if ($kandidat->count() === 1) {
                return $kandidat->first();
            }
            if ($kandidat->count() > 1) {
                $this->fail($no, 'nama_lengkap', 'Nama santri tidak unik — isi santri_id.');

                return null;
            }
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga, atau santri_id / nama unik).');

        return null;
    }

    /** Buat/buka keanggotaan; false = gagal (failure sudah dicatat).
     *  Arsip milik sendiri diaktifkan ulang HANYA bila barisnya aktif
     *  (pola PenerimaanService; baris arsip tak membangunkan keanggotaan).
     *  Cek bentrok NIS mengecualikan SEMUA baris milik santri ini (boleh
     *  >1 baris per lembaga). Bila cocok via pasangan ($langsung=false),
     *  NIS target dipertahankan (NIS bisa beda antar-lembaga/tahun pada
     *  data historis). Mode kering: cek saja tanpa menulis (kembalikan
     *  model transient). */
    protected function pastikanKeanggotaan(Santri $santri, string $jenjang, ?string $nisLokal, bool $aktifkan, bool $langsung, bool $kering, int $no): LembagaSantri|false
    {
        $aktif = LembagaSantri::aktif($santri->id, $jenjang);

        if ($aktif !== null) {
            if ($langsung && $nisLokal !== null && $aktif->nis_lokal !== $nisLokal) {
                if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                    $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                    return false;
                }
                if (! $kering) {
                    $aktif->update(['nis_lokal' => $nisLokal]);
                }
            }

            return $aktif;
        }

        // Baris sendiri ber-NIS sama diutamakan (arsip periode yang tepat).
        $milik = null;
        if ($nisLokal !== null) {
            $milik = LembagaSantri::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('nis_lokal', $nisLokal)
                ->orderByDesc('id')
                ->first();
        }
        $milik ??= LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->orderByDesc('id')
            ->first();
        if ($milik !== null) {
            // Cocok via pasangan: NIS target bisa beda antar-lembaga/tahun
            // (historis) — pertahankan miliknya, jangan timpa dengan NIS baris.
            if ($langsung && $nisLokal !== null && ($milik->nis_lokal ?? null) !== $nisLokal) {
                if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                    $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                    return false;
                }
                if (! $kering) {
                    $milik->nis_lokal = $nisLokal;
                }
            }
            if (! $kering) {
                if ($aktifkan) {
                    $milik->is_active_lembaga = LembagaSantri::YA;
                    $milik->tgl_selesai = null;
                }
                $milik->save();
            }

            return $milik;
        }

        if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
            $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

            return false;
        }

        if ($kering) {
            return new LembagaSantri([
                'santri_id' => $santri->id,
                'jenjang' => $jenjang,
                'nis_lokal' => $nisLokal,
                'is_active_lembaga' => $aktifkan ? LembagaSantri::YA : LembagaSantri::TIDAK,
            ]);
        }

        return LembagaSantri::create([
            'santri_id' => $santri->id,
            'jenjang' => $jenjang,
            'nis_lokal' => $nisLokal,
            'is_active_lembaga' => $aktifkan ? LembagaSantri::YA : LembagaSantri::TIDAK,
        ]);
    }

    /** Singkatan label dari ekspor historis → kode (dibandingkan lower-case).
     *  Kamus resmi tetap sumber kebenaran; ini hanya jembatan data lama. */
    protected const ALIAS_STATUS = [
        'naik kelas' => 'naik',
        'keluar' => 'pindah_keluar',
    ];

    /** Status: label Proper Case ('Santri Baru') dipetakan ke kode; kode
     *  lama tetap diterima apa adanya. Tak dikenal → kembalikan mentah agar
     *  gagal di cek kamus dengan pesan yang jelas. */
    protected function normalisasiStatus(string $tipe, mixed $nilai, string $jenjang): string
    {
        $teks = trim((string) ($nilai ?? ''));
        if ($teks === '') {
            return '';
        }
        if (isset(self::ALIAS_STATUS[mb_strtolower($teks)])) {
            return self::ALIAS_STATUS[mb_strtolower($teks)];
        }
        $kunci = RefService::KEY[$tipe];
        foreach (RefService::effective($tipe, $jenjang) as $baris) {
            if (strcasecmp($teks, (string) $baris->{$kunci}) === 0) {
                return (string) $baris->{$kunci};
            }
            if (isset($baris->nama) && strcasecmp($teks, trim((string) $baris->nama)) === 0) {
                return (string) $baris->{$kunci};
            }
        }

        return $teks;
    }

    /** Kelas: nama (diutamakan) atau id, dalam lingkup lembaga + TA. false = gagal. */
    protected function resolveKelasId(mixed $nilai, string $jenjang, string $ta, int $no): int|null|false
    {
        $teks = trim((string) $nilai);
        if ($teks === '') {
            return null;
        }

        $nama = Kelas::where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower(preg_replace('/\s+/u', ' ', $teks) ?? $teks)])
            ->value('id');
        if ($nama !== null) {
            return (int) $nama;
        }

        if (ctype_digit($teks)) {
            $kelas = Kelas::find((int) $teks);
            if ($kelas && $kelas->jenjang === $jenjang && $kelas->tahun_ajaran === $ta) {
                return (int) $kelas->id;
            }
        }

        $this->fail($no, 'nama_kelas', "Kelas \"{$teks}\" tidak ditemukan di lembaga + tahun ajaran ini.");

        return false;
    }
}
