<?php

namespace App\Imports;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\RefService;
use App\Support\NikFlag;
use App\Support\Tanggal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;

/**
 * Import riwayat belajar (`riwayat_belajar`) — terpisah dari import identitas.
 * Nama kolom mengikuti tabel: nik, nis_lokal, jenjang, tahun_ajaran,
 * kelas_id, semester, tgl_masuk, no_absen, tingkat, status_awal, status_akhir.
 *
 * Pencocokan santri: `nik` diutamakan → fallback `nis_lokal` + `jenjang`.
 * `lembaga_santri` dibuat otomatis bila belum ada (membawa nis_lokal dari file).
 */
class RiwayatBelajarImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    protected int $barisValid = 0;

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->barisValid + count($this->failures),
            'baris_valid' => $this->barisValid,
            'baris_gagal' => count($this->failures),
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

    public function collection(Collection $rows): void
    {
        DB::transaction(function () use ($rows) {
            $no = 0;
            $tersentuh = [];
            foreach ($rows as $row) {
                $no++;
                // Baris tanpa kunci identitas dianggap baris kosong/pemisah.
                if (empty($row['nik']) && empty($row['nis_lokal'])) {
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

        $keanggotaan = $this->pastikanKeanggotaan($santri, $jenjang, $nisLokal, $no);
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

        $statusAwal = trim((string) ($row['status_awal'] ?? '')) ?: 'santri_baru';
        $statusAkhir = trim((string) ($row['status_akhir'] ?? '')) ?: 'aktif';
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

        $noAbsen = isset($row['no_absen']) && $row['no_absen'] !== '' ? (int) $row['no_absen'] : null;
        $tglMasuk = Tanggal::parse($row['tgl_masuk'] ?? null);
        // Tingkat kosong mewarisi kelas (bila kelas terisi).
        $tingkat = trim((string) ($row['tingkat'] ?? '')) ?: null;
        if ($tingkat === null && $kelasId !== null) {
            $tingkat = Kelas::whereKey($kelasId)->value('tingkat') ?: null;
        }

        $kunci = [
            'santri_id' => $santri->id,
            'tahun_ajaran' => $ta,
            'jenjang' => $jenjang,
            'semester' => $semester,
        ];
        $lama = RiwayatBelajar::where($kunci)->first();

        if ($noAbsen !== null && $kelasId !== null) {
            $bentrok = RiwayatBelajar::where('kelas_id', $kelasId)
                ->where('tahun_ajaran', $ta)
                ->where('semester', $semester)
                ->where('no_absen', $noAbsen)
                ->when($lama, fn ($q) => $q->whereKeyNot($lama->id))
                ->exists();
            if ($bentrok) {
                $this->fail($no, 'no_absen', 'No. absen sudah dipakai di rombel semester ini.');

                return false;
            }
        }

        RiwayatBelajar::updateOrCreate($kunci, [
            'kelas_id' => $kelasId,
            'tgl_masuk' => $tglMasuk,
            'no_absen' => $noAbsen,
            'tingkat' => $tingkat,
            'status_awal' => $statusAwal,
            'status_akhir' => $statusAkhir,
            'is_active_riwayat' => $statusAkhir === 'aktif' ? RiwayatBelajar::YA : RiwayatBelajar::TIDAK,
        ]);

        $tersentuh[] = (int) $santri->id;

        return true;
    }

    /** Cari santri: `nik` diutamakan → fallback `nis_lokal` + lembaga.
     *  @param  array<string, mixed>  $row */
    protected function cariSantri(array $row, string $jenjang, int $no): ?Santri
    {
        $nik = trim((string) ($row['nik'] ?? ''));
        if ($nik !== '') {
            // NIK tak valid tersimpan berawalan `X-`: cari bentuk tersimpannya.
            $santri = Santri::where('nik', NikFlag::tandai($nik))->first();
            if ($santri) {
                return $santri;
            }
        }

        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                return Santri::find($ls->santri_id);
            }
        }

        $this->fail($no, 'nik', 'Santri tidak ditemukan (cocokkan NIK atau NIS lokal + lembaga).');

        return null;
    }

    /** Buat/buka keanggotaan; false = gagal (failure sudah dicatat). */
    protected function pastikanKeanggotaan(Santri $santri, string $jenjang, ?string $nisLokal, int $no): LembagaSantri|false
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

        if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
            $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

            return false;
        }

        return LembagaSantri::create([
            'santri_id' => $santri->id,
            'jenjang' => $jenjang,
            'nis_lokal' => $nisLokal,
            'is_active_lembaga' => LembagaSantri::YA,
        ]);
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
            'nik' => ['required_without:nis_lokal', 'nullable', 'digits:16'],
            'nis_lokal' => ['required_without:nik', 'nullable'],
            'jenjang' => ['required', 'string'],
            'tahun_ajaran' => ['required', 'string'],
            'kelas_id' => ['nullable'],
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
