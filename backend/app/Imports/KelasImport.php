<?php

namespace App\Imports;

use App\Services\KelasImporService;
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
 * Import file kelas multi-lembaga + multi-tahun ajaran — pembungkus tipis
 * Maatwebsite di atas KelasImporService (logika per baris), yang juga
 * dipakai jalur import bertahap (potongan JSON dari browser).
 *
 * Multi-sheet: hanya sheet pertama. Galat dikembalikan sebagai
 * `Failure[]` agar format galat file sama seperti impor lain.
 */
class KelasImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    protected KelasImporService $layanan;

    public function __construct(?KelasImporService $layanan = null)
    {
        $this->layanan = $layanan ?? new KelasImporService;
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
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'nama_kelas' => ['nullable', 'string', 'max:50'],
            'nama_alias' => ['nullable', 'string', 'max:50'],
            'walas' => ['nullable', 'string', 'max:100'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'urutan' => ['nullable', 'integer', 'min:0'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
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
