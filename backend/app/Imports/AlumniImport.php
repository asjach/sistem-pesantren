<?php

namespace App\Imports;

use App\Services\AlumniImporService;
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
 * Import arsip alumni multi-lembaga — pembungkus tipis Maatwebsite di
 * atas AlumniImporService (logika per baris), yang juga dipakai jalur
 * import bertahap (potongan JSON dari browser).
 *
 * Hanya sheet pertama. Galat dikembalikan sebagai `Failure[]` agar format
 * galat file sama seperti impor lain.
 */
class AlumniImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    protected AlumniImporService $layanan;

    public function __construct(?AlumniImporService $layanan = null)
    {
        $this->layanan = $layanan ?? new AlumniImporService;
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
        // Sheet tambahan diabaikan.
    }

    /** @return array<string, mixed> */
    public function map($row): array
    {
        return $this->layanan->normalisasiBaris((array) $row);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'nis_lokal' => ['required'],
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran_lulus' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            // Tanggal boleh kosong (arsip historis → NULL); tanpa rule `date`
            // karena serial Excel gagal rule itu — dicek di service.
            'tanggal_lulus' => ['nullable'],
            'kelas_lulus' => ['nullable'],
            'nomor_ijazah' => ['nullable', 'string', 'max:255'],
            'no_surat_ijazah' => ['nullable', 'string', 'max:50'],
            'kegiatan_setelah_lulus' => ['nullable', 'string', 'max:255'],
            'penyerahan_ijazah' => ['nullable', 'string', 'in:sudah,belum'],
            'melanjutkan' => ['nullable', 'string', 'in:ya,tidak'],
            'catatan' => ['nullable'],
        ];
    }

    public function collection(Collection $rows): void
    {
        $potongan = [];
        foreach ($rows as $row) {
            $potongan[] = $row instanceof Collection ? $row->toArray() : $row;
        }

        $this->layanan->prosesPotongan($potongan, 1, false);
        $this->failures = array_merge($this->failures, $this->keFailures());
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

    /** @return Failure[] */
    protected function keFailures(): array
    {
        $gagal = [];
        foreach ($this->layanan->gagal as $item) {
            $gagal[] = new Failure($item['baris'], $item['kolom'], [$item['pesan']], []);
        }

        return $gagal;
    }
}
