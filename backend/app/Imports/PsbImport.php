<?php

namespace App\Imports;

use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbLogStatus;
use Illuminate\Database\Eloquent\Model;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;

class PsbImport implements ToModel, WithHeadingRow, WithValidation
{
    public function __construct(
        protected int $gelombangId,
        protected int $lembagaId,
    ) {}

    /**
     * NIK required -> PsbCalonSantri::create() langsung
     * (hindari pitfall updateOrCreate dengan NIK null).
     */
    public function model(array $row): Model|null
    {
        $gelombang = PsbGelombang::findOrFail($this->gelombangId);

        $calon = PsbCalonSantri::create([
            'lembaga_id' => $this->lembagaId,
            'gelombang_id' => $this->gelombangId,
            'tahun_ajaran_id' => $gelombang->tahun_ajaran_id,
            'tipe_santri' => $row['tipe_santri'] ?? 'non_asrama',
            'nik' => (string) $row['nik'],
            'nama_lengkap' => $row['nama_lengkap'],
            'jk' => $row['jk'] ?? null,
            'tgl_lahir' => $row['tgl_lahir'] ?? null,
            'email_ortu' => $row['email_ortu'] ?? null,
            'telp_ortu' => isset($row['telp_ortu']) ? (string) $row['telp_ortu'] : null,
            'ayah_nama' => $row['nama_ayah'] ?? null,
            'ibu_nama' => $row['nama_ibu'] ?? null,
            'no_pendaftaran' => $row['no_pendaftaran'] ?? null,
            'status_pendaftaran' => 'baru',
            'tanggal_daftar' => now()->toDateString(),
        ]);

        PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => 'baru']);

        return $calon;
    }

    /** Key flat (tanpa '*.') — ToModel + WithValidation validasi per baris. */
    public function rules(): array
    {
        return [
            'nik' => ['required', 'digits:16'],
            'nama_lengkap' => ['required', 'string', 'max:100'],
            'jk' => ['nullable', 'in:L,P'],
            'tgl_lahir' => ['nullable', 'date'],
            'tipe_santri' => ['nullable', 'in:asrama,non_asrama'],
            'email_ortu' => ['nullable', 'email', 'max:100'],
            'telp_ortu' => ['nullable', 'string', 'max:20'],
            'nama_ayah' => ['nullable', 'string', 'max:100'],
            'nama_ibu' => ['nullable', 'string', 'max:100'],
            'no_pendaftaran' => ['nullable', 'string', 'max:50'],
        ];
    }
}
