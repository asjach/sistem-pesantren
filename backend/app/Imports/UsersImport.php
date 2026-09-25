<?php

namespace App\Imports;

use App\Services\PenggunaImporService;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithValidation;

/**
 * Import pengguna dari file Excel — pembungkus tipis Maatwebsite di atas
 * PenggunaImporService (logika per baris), yang juga dipakai jalur import
 * bertahap (potongan JSON dari browser).
 *
 * `lembagaIds` + `allowedRoles` berasal dari akun yang menulis (resolusi
 * tenant + peran yang boleh ditetapkan), bukan dari baris file.
 *
 * Sengaja TIDAK memakai SkipsOnFailure: endpoint file harus melempar
 * ValidationException agar controller membalas 422 + daftar galat
 * (kontrak lama). Per-baris di jalur bertahap ditangani sesi galat
 * (ImportSesi) tanpa melempar.
 */
class UsersImport implements ToCollection, WithHeadingRow, WithMapping, WithValidation
{
    protected PenggunaImporService $layanan;

    /**
     * @param  array<int, string>  $lembagaIds
     * @param  array<int, string>  $allowedRoles
     */
    public function __construct(array $lembagaIds, array $allowedRoles, ?PenggunaImporService $layanan = null)
    {
        $this->layanan = $layanan ?? new PenggunaImporService($lembagaIds, $allowedRoles);
    }

    public function ringkasan(): array
    {
        return $this->layanan->ringkasan();
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'required_without_all:phone,username', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')],
            'username' => ['nullable', 'string', 'max:50', Rule::unique('users', 'username')],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['required', 'string'],
        ];
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
