<?php

namespace App\Imports;

use App\Services\PsbImporService;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithValidation;

/**
 * Import PSB dari file Excel — pembungkus tipis Maatwebsite di atas
 * PsbImporService (logika per baris), yang juga dipakai jalur import
 * bertahap (potongan JSON dari browser).
 *
 * Perbedaan dari pembungkus lain: `gelombang_id` + `lembagaId` adalah
 * konteks tetap dari form, bukan kolom baris.
 *
 * Sengaja TIDAK memakai SkipsOnFailure: endpoint file harus melempar
 * ExcelValidationException agar controller membalas 422 + daftar galat
 * (kontrak lama). Per-baris di jalur bertahap ditangani sesi galat
 * (ImportSesi) tanpa melempar.
 */
class PsbImport implements ToCollection, WithHeadingRow, WithMapping, WithValidation
{
    public function __construct(
        protected int $gelombangId,
        protected string $lembagaId,
        protected PsbImporService $layanan,
    ) {}

    /** @return array<string, mixed> */
    public function map($row): array
    {
        return $this->layanan->normalisasiBaris((array) $row);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return $this->layanan->rules();
    }

    /** @return array<string, string> */
    public function customValidationMessages(): array
    {
        return $this->layanan->customValidationMessages();
    }

    public function collection(Collection $rows): void
    {
        $potongan = [];
        foreach ($rows as $row) {
            $potongan[] = $row instanceof Collection ? $row->toArray() : $row;
        }

        $this->layanan->prosesPotongan($potongan, 1, false);
    }
}
