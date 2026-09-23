<?php

namespace App\Imports;

use App\Services\RiwayatBelajarImporService;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;

/**
 * Import file riwayat belajar (`riwayat_belajar`) — pembungkus tipis
 * Maatwebsite di atas RiwayatBelajarImporService (sumber logika tunggal,
 * dipakai juga endpoint potongan JSON bertahap). Nama kolom mengikuti tabel,
 * kecuali kelas memakai `nama_kelas` (nama rombel; heading lama `kelas_id`
 * tetap diterima).
 */
class RiwayatBelajarImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    protected RiwayatBelajarImporService $layanan;

    /** @var Failure[] galat validasi baris (dikumpulkan Maatwebsite). */
    protected array $failures = [];

    public function __construct(?RiwayatBelajarImporService $layanan = null)
    {
        $this->layanan = $layanan ?? new RiwayatBelajarImporService;
    }

    public function ringkasan(): array
    {
        return $this->layanan->ringkasan();
    }

    /** Hanya sheet pertama yang diimport. */
    public function sheets(): array
    {
        return [0 => $this];
    }

    public function onUnknownSheet(string|int $sheetName): void
    {
        // Sheet tambahan (mis. "Referensi") diabaikan.
    }

    /**
     * Normalisasi SEBELUM validasi (delegasi service).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function map($row): array
    {
        return $this->layanan->normalisasiBaris((array) $row);
    }

    public function collection(Collection $rows): void
    {
        $data = $rows
            ->map(fn ($row) => $row instanceof Collection ? $row->toArray() : (array) $row)
            ->all();
        // Nomor 1 = heading (galat absolut selaras validasi Maatwebsite).
        $this->layanan->prosesPotongan($data, 1, false);
        foreach ($this->layanan->gagal as $gagal) {
            $this->failures[] = new Failure($gagal['baris'], $gagal['kolom'], [$gagal['pesan']], []);
        }
    }

    /** Tanggal Excel: serial number atau string tanggal (dicek di service). */
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
            'tgl_masuk' => ['nullable'],
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

    /** @return Failure[] */
    public function failures(): array
    {
        return $this->failures;
    }
}
