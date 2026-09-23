<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Support\Tanggal;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Logika import riwayat belajar per baris — dipakai dua jalur:
 * file Excel (Maatwebsite, kelas RiwayatBelajarImport sebagai pembungkus
 * tipis) dan potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * UPSERT per kunci (santri, tahun ajaran, jenjang, semester): kunci baru →
 * dibuat; kunci cocok → update hanya kolom yang terisi. Pencocokan santri:
 * `nis_lokal` + `jenjang`, fallback NIS sama di pasangan MI↔MD. Mode kering
 * (`$kering = true`) menjalankan SEMUA cek tanpa menulis — untuk periksa
 * bertahap (pengganti rollback-transaksi yang berat di file besar).
 */
class RiwayatBelajarImporService
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    public int $dibuat = 0;

    public int $diperbarui = 0;

    /** NIS baris yang sedang diproses (untuk kolom kunci di galat). */
    protected ?string $nisAktif = null;

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
     * Normalisasi SEBELUM cek: heading lama `kelas_id` disamakan dari
     * `nama_kelas`; angka Excel dinormalisasi; sel tanggal (objek DateTime
     * atau serial General) disamakan ke string Y-m-d.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        foreach ($baris as $kunci => $nilai) {
            if ($nilai instanceof DateTimeInterface) {
                $baris[$kunci] = $nilai->format('Y-m-d');
            }
        }
        if (isset($baris['tgl_masuk']) && (is_int($baris['tgl_masuk']) || is_float($baris['tgl_masuk']))) {
            try {
                $baris['tgl_masuk'] = ExcelDate::excelToDateTimeObject($baris['tgl_masuk'])->format('Y-m-d');
            } catch (\Throwable $e) {
                $baris['tgl_masuk'] = (string) $baris['tgl_masuk'];
            }
        }
        if (trim((string) ($baris['kelas_id'] ?? '')) === '' && trim((string) ($baris['nama_kelas'] ?? '')) !== '') {
            $baris['kelas_id'] = $baris['nama_kelas'];
        }
        foreach (['kelas_id', 'nama_kelas'] as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }

    /**
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` = nomor
     * baris Excel baris pertama potongan dikurangi 1 (heading = 1), sehingga
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
                // Baris tanpa NIS lokal dianggap baris kosong/pemisah.
                if (empty($baris['nis_lokal'])) {
                    continue;
                }

                $jenjang = trim((string) ($baris['jenjang'] ?? ''));
                $ta = TahunAjaran::normalisasiNama((string) ($baris['tahun_ajaran'] ?? ''));

                if (! $this->prosesBaris($baris, $no, $jenjang, $ta, $tersentuh, $kering)) {
                    continue;
                }

                $this->valid++;
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

    /** @param  array<int, int>  $tersentuh */
    protected function prosesBaris(array $row, int $no, string $jenjang, string $ta, array &$tersentuh, bool $kering): bool
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

        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        $nisLokal = $nisLokal === '' ? null : $nisLokal;

        // Status diparse di depan: keanggotaan hanya diaktifkan ulang bila
        // barisnya aktif (baris arsip tak membangunkan arsip keanggotaan).
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

        $keanggotaan = $this->pastikanKeanggotaan($santri, $jenjang, $nisLokal, $statusAkhir === 'aktif', $kering, $no);
        if ($keanggotaan === false) {
            return false;
        }

        $semester = (string) ($row['semester'] ?? '1');
        if (! in_array($semester, ['1', '2'], true)) {
            $this->fail($no, 'semester', 'Semester harus 1 atau 2.');

            return false;
        }

        $kelasId = $this->resolveKelasId($row['kelas_id'] ?? null, $jenjang, $ta, $no);
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
            if ($terisi('kelas_id')) {
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
            } elseif ($terisi('kelas_id') && $tingkat !== null) {
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

        $tersentuh[] = (int) $santri->id;

        return true;
    }

    /** Cari santri via `nis_lokal` + lembaga (unik per lembaga di DB).
     *  Fallback pasangan MI↔MD: NIS yang sama di lembaga pasangan menandai
     *  santri yang sama (keanggotaan target lalu dibuat otomatis).
     *
     *  @param  array<string, mixed>  $row */
    protected function cariSantri(array $row, string $jenjang, int $no): ?Santri
    {
        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                return Santri::find($ls->santri_id);
            }

            $pasangan = Lembaga::pasanganJenjang($jenjang);
            if ($pasangan !== null) {
                $kandidat = LembagaSantri::where('jenjang', $pasangan)->where('nis_lokal', $nisLokal)->first();
                if ($kandidat) {
                    return Santri::find($kandidat->santri_id);
                }
            }
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /** Buat/buka keanggotaan; false = gagal (failure sudah dicatat).
     *  Arsip milik sendiri diaktifkan ulang HANYA bila barisnya aktif
     *  (pola PenerimaanService; baris arsip tak membangunkan keanggotaan).
     *  Cek bentrok NIS selalu mengecualikan baris sendiri. Mode kering:
     *  cek saja tanpa menulis (kembalikan model transient). */
    protected function pastikanKeanggotaan(Santri $santri, string $jenjang, ?string $nisLokal, bool $aktifkan, bool $kering, int $no): LembagaSantri|false
    {
        $aktif = LembagaSantri::aktif($santri->id, $jenjang);

        if ($aktif !== null) {
            if ($nisLokal !== null && $aktif->nis_lokal !== $nisLokal) {
                if (LembagaSantri::nisLokalDipakai($jenjang, $nisLokal, $aktif->id)) {
                    $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                    return false;
                }
                if (! $kering) {
                    $aktif->update(['nis_lokal' => $nisLokal]);
                }
            }

            return $aktif;
        }

        $milik = LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->orderByDesc('id')
            ->first();
        if ($milik !== null) {
            if ($nisLokal !== null && ($milik->nis_lokal ?? null) !== $nisLokal) {
                if (LembagaSantri::nisLokalDipakai($jenjang, $nisLokal, $milik->id)) {
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

        $this->fail($no, 'kelas_id', "Kelas \"{$teks}\" tidak ditemukan di lembaga + tahun ajaran ini.");

        return false;
    }

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nisAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }
}
