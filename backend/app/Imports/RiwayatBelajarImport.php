<?php

namespace App\Imports;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\RefService;
use App\Support\Tanggal;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Import riwayat belajar (`riwayat_belajar`) — terpisah dari import identitas.
 * Nama kolom mengikuti tabel, kecuali kelas memakai `nama_kelas` (nama rombel;
 * heading lama `kelas_id` tetap diterima). Nilai kelas: nama diutamakan,
 * fallback id numerik — keduanya dalam lingkup lembaga + tahun ajaran.
 *
 * UPSERT per kunci (santri, tahun ajaran, jenjang, semester): kunci baru →
 * dibuat; kunci cocok → update hanya kolom yang terisi (sel kosong =
 * pertahankan). Pencocokan santri: `nis_lokal` + `jenjang` (unik per lembaga
 * di DB), fallback NIS sama di pasangan MI↔MD. `lembaga_santri` dibuat otomatis bila belum ada (membawa
 * nis_lokal dari file). Izin mengikuti akun per baris.
 */
class RiwayatBelajarImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    protected int $barisValid = 0;

    protected int $dibuat = 0;

    protected int $diperbarui = 0;

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->barisValid + count($this->failures),
            'baris_valid' => $this->barisValid,
            'baris_gagal' => count($this->failures),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
        ];
    }

    public function sheets(): array
    {
        return [0 => $this];
    }

    public function onUnknownSheet(string|int $sheetName): void
    {
        // Sheet tambahan (mis. "Referensi") diabaikan.
    }

    /**
     * Normalisasi SEBELUM validasi: template memakai `nama_kelas`, heading lama
     * `kelas_id` tetap diterima — samakan ke `kelas_id` agar alur bawah seragam.
     * Angka Excel (id numerik) dinormalisasi jadi string.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function map($row): array
    {
        $baris = (array) $row;
        foreach ($baris as $kunci => $nilai) {
            // Sel tanggal Excel terbaca sebagai objek DateTime (gagal rule
            // `date` dan Tanggal::parse) — samakan jadi string Y-m-d.
            if ($nilai instanceof DateTimeInterface) {
                $baris[$kunci] = $nilai->format('Y-m-d');
            }
        }
        // Serial tanggal Excel (sel berformat General) terbaca sebagai angka
        // mentah — konversi ke Y-m-d agar lolos rule `date`.
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

    public function collection(Collection $rows): void
    {
        DB::transaction(function () use ($rows) {
            // Nomor absolut baris Excel (1 = heading) agar selaras dengan
            // nomor galat validasi Maatwebsite.
            $no = 1;
            $tersentuh = [];
            foreach ($rows as $row) {
                $no++;
                // Baris tanpa NIS lokal dianggap baris kosong/pemisah.
                if (empty($row['nis_lokal'])) {
                    continue;
                }

                $jenjang = trim((string) ($row['jenjang'] ?? ''));
                $ta = TahunAjaran::normalisasiNama((string) ($row['tahun_ajaran'] ?? ''));

                if (! $this->prosesBaris($row, $no, $jenjang, $ta, $tersentuh)) {
                    continue;
                }

                $this->barisValid++;
            }

            foreach (array_unique($tersentuh) as $santriId) {
                Santri::find($santriId)?->hitungUlangStatusGlobal();
            }
        });
    }

    /** @param  array<int, int>  $tersentuh */
    protected function prosesBaris(Collection|array $row, int $no, string $jenjang, string $ta, array &$tersentuh): bool
    {
        $row = is_array($row) ? $row : $row->toArray();

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

        $keanggotaan = $this->pastikanKeanggotaan($santri, $jenjang, $nisLokal, $statusAkhir === 'aktif', $no);
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

        $noAbsen = isset($row['no_absen']) && $row['no_absen'] !== '' ? (int) $row['no_absen'] : null;
        $tglMasuk = Tanggal::parse($row['tgl_masuk'] ?? null);
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
     *  Cek bentrok NIS selalu mengecualikan baris sendiri. */
    protected function pastikanKeanggotaan(Santri $santri, string $jenjang, ?string $nisLokal, bool $aktifkan, int $no): LembagaSantri|false
    {
        $aktif = LembagaSantri::aktif($santri->id, $jenjang);

        if ($aktif !== null) {
            if ($nisLokal !== null && $aktif->nis_lokal !== $nisLokal) {
                if (LembagaSantri::nisLokalDipakai($jenjang, $nisLokal, $aktif->id)) {
                    $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                    return false;
                }
                $aktif->update(['nis_lokal' => $nisLokal]);
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
                $milik->nis_lokal = $nisLokal;
            }
            if ($aktifkan) {
                $milik->is_active_lembaga = LembagaSantri::YA;
                $milik->tgl_selesai = null;
            }
            $milik->save();

            return $milik->fresh();
        }

        if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
            $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

            return false;
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

    protected function fail(int $no, string $attribute, string $pesan): void
    {
        $this->failures[] = new Failure($no, $attribute, [$pesan], []);
    }

    /** Tanggal Excel: serial number atau string tanggal. */
    public function rules(): array
    {
        return [
            // Sel Excel/CSV bisa terbaca sebagai angka → hindari rule `string` ketat.
            'nis_lokal' => ['required'],
            'jenjang' => ['required', 'string'],
            'tahun_ajaran' => ['required', 'string'],
            'kelas_id' => ['nullable'],
            'nama_kelas' => ['nullable', 'string', 'max:50'],
            'semester' => ['required'],
            'tgl_masuk' => ['nullable', 'date'],
            'no_absen' => ['nullable', 'integer', 'min:1'],
            'tingkat' => ['nullable'],
            'status_awal' => ['nullable'],
            'status_akhir' => ['nullable'],
        ];
    }

    public function onFailure(Failure ...$failures): void
    {
        $this->failures = array_merge($this->failures, $failures);
    }

    public function failures(): array
    {
        return $this->failures;
    }
}
