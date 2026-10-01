<?php

namespace App\Imports;

use App\Services\DokumenImporService;
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
 * Import file daftar dokumen (santri/pegawai/lembaga) — pembungkus tipis
 * Maatwebsite di atas DokumenImporService (sumber logika tunggal, dipakai
 * juga endpoint potongan JSON bertahap). Hanya sheet pertama diimport;
 * sheet "Referensi" diabaikan.
 */
class DokumenImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    protected DokumenImporService $layanan;

    /** @var Failure[] galat validasi baris (dikumpulkan Maatwebsite). */
    protected array $failures = [];

    public function __construct(string $tipe, ?DokumenImporService $layanan = null)
    {
        $this->layanan = ($layanan ?? new DokumenImporService)->setTipe($tipe);
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

    public function rules(): array
    {
        return [
            'nis_lokal' => ['sometimes', 'nullable'],
            'pegawai_id' => ['sometimes', 'nullable'],
            'nipp' => ['sometimes', 'nullable'],
            'nama_lengkap' => ['sometimes', 'nullable'],
            'jenjang' => ['required', 'string'],
            'jenis_dokumen' => ['required', 'string', 'max:100'],
            // Hanya dipakai tipe pegawai/lembaga; tabel santri tanpa kolom status.
            'status_verifikasi' => ['nullable'],
            'catatan' => ['nullable', 'string'],
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
