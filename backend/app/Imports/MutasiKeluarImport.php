<?php

namespace App\Imports;

use App\Services\MutasiKeluarImporService;
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
 * Import arsip mutasi keluar multi-lembaga — pembungkus tipis
 * Maatwebsite di atas MutasiKeluarImporService (logika per baris), yang
 * juga dipakai jalur import bertahap (potongan JSON dari browser).
 *
 * Hanya sheet pertama. Galat dikembalikan sebagai `Failure[]` agar format
 * galat file sama seperti impor lain.
 */
class MutasiKeluarImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    protected MutasiKeluarImporService $layanan;

    public function __construct(?MutasiKeluarImporService $layanan = null)
    {
        $this->layanan = $layanan ?? new MutasiKeluarImporService;
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
            // Sel Excel/CSV bisa terbaca sebagai angka → hindari rule `string` ketat.
            // Tanggal TANPA rule `date` (serial Excel gagal rule itu) — diparse manual.
            'nis_lokal' => ['required'],
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tanggal_mutasi' => ['nullable'],
            'alasan_mutasi' => ['nullable', 'string', 'max:100'],
            'kelas_terakhir' => ['nullable'],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'no_surat' => ['nullable', 'string', 'max:50'],
            'nama_sekolah_tujuan' => ['nullable', 'string', 'max:255'],
            'npsn_sekolah_tujuan' => ['nullable', 'string', 'max:20'],
            'nsm_sekolah_tujuan' => ['nullable', 'string', 'max:30'],
            'alamat_sekolah_tujuan' => ['nullable'],
            'keterangan' => ['nullable'],
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
