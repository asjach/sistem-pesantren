<?php

namespace App\Imports;

use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbLogStatus;
use App\Services\KeuanganService;
use App\Services\PsbService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;

class PsbImport implements ToModel, WithHeadingRow, WithValidation
{
    public function __construct(
        protected int $gelombangId,
        protected int $lembagaId,
        protected PsbService $psb,
        protected KeuanganService $keuangan,
    ) {}

    /**
     * NIK required -> PsbCalonSantri::create() langsung
     * (hindari pitfall updateOrCreate dengan NIK null).
     */
    public function model(array $row): Model|null
    {
        $gelombang = PsbGelombang::with('kegiatan:id,tahun_ajaran_id')->findOrFail($this->gelombangId);
        $tahunAjaranId = $gelombang->kegiatan?->tahun_ajaran_id;
        $noPendaftaran = trim((string) ($row['no_pendaftaran'] ?? ''));
        if ($noPendaftaran === '') {
            $noPendaftaran = $this->psb->nomorPendaftaranBerikutnya($this->gelombangId, $this->lembagaId);
        }

        $usaha = 0;
        while (true) {
            try {
                $calon = PsbCalonSantri::create([
                    'lembaga_id' => $this->lembagaId,
                    'gelombang_id' => $this->gelombangId,
                    'tahun_ajaran_id' => $tahunAjaranId,
                    'tipe_santri' => $row['tipe_santri'] ?? 'non_asrama',
                    'nik' => (string) $row['nik'],
                    'nama_lengkap' => $row['nama_lengkap'],
                    'jk' => $row['jk'] ?? null,
                    'tgl_lahir' => $row['tgl_lahir'] ?? null,
                    'email_ortu' => $row['email_ortu'] ?? null,
                    'telp_ortu' => isset($row['telp_ortu']) ? (string) $row['telp_ortu'] : null,
                    'ayah_nama' => $row['nama_ayah'] ?? null,
                    'ibu_nama' => $row['nama_ibu'] ?? null,
                    'no_pendaftaran' => $noPendaftaran,
                    'status_pendaftaran' => 'baru',
                    'tanggal_daftar' => now()->toDateString(),
                ]);
                break;
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                    throw $e;
                }
                $noPendaftaran = $this->psb->nomorPendaftaranBerikutnya($this->gelombangId, $this->lembagaId);
            }
        }

        PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => 'baru']);
        $calon->lembagaDetail()->create(['lembaga_id' => $this->lembagaId, 'peran' => 'primer']);
        if ($tahunAjaranId) {
            $this->keuangan->createTagihanPendaftaranPsb(
                $calon,
                $this->psb->nominalPendaftaran($this->gelombangId, $this->lembagaId, $calon->tipe_santri),
                (int) $tahunAjaranId
            );
        }

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
            'no_pendaftaran' => [
                'nullable', 'string', 'max:50',
                Rule::unique('psb_calon_santri', 'no_pendaftaran'),
            ],
        ];
    }

    public function customValidationMessages(): array
    {
        return [
            'no_pendaftaran.unique' => 'Nomor pendaftaran sudah dipakai di lembaga ini.',
        ];
    }
}
