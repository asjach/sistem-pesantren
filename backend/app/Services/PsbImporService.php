<?php

namespace App\Services;

use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbLogStatus;
use App\Support\Tanggal;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Logika import PSB per baris — dipakai dua jalur: file Excel
 * (Maatwebsite, App\Imports\PsbImport sebagai pembungkus tipis) dan
 * potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * Konteks `gelombang_id` + `jenjang` (lembaga tujuan) bersifat tetap
 * per sesi — bukan per baris — dan tidak ditulis ulang tiap baris.
 * NIK wajib → `create()` langsung (hindari jebakan updateOrCreate
 * dengan NIK null), nomor pendaftaran auto dibuat bila kosong dan
 * diregenerasi bila bentrok unique (maks 3x, sama seperti PsbService).
 *
 * Mode kering (`$kering = true`) menjalankan validasi + cek duplikat NIK
 * TANPA menulis apa pun — periksa bertahap tidak boleh membuat
 * pendaftar, log status, maupun nomor pendaftaran.
 */
class PsbImporService extends ImporPotongan
{
    public function __construct(
        protected int $gelombangId,
        protected string $jenjang,
        protected PsbService $psb,
    ) {}

    /** @return array<string, array<int, string>> */
    public function customValidationMessages(): array
    {
        return [
            'no_pendaftaran.unique' => 'Nomor pendaftaran sudah dipakai di lembaga ini.',
        ];
    }

    /**
     * Normalisasi SEBELUM cek: objek DateTime → Y-m-d; angka Excel → string
     * (NIK 16 digit dan nomor telepon bisa terbaca sebagai angka).
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTanggal($baris);

        return $this->castTeks($baris, ['nik', 'telp_ortu', 'no_pendaftaran']);
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nik = trim((string) ($baris['nik'] ?? ''));
        $this->kunciAktif = $nik === '' ? null : $nik;
        $baris['nik'] = $nik;

        if ($nik === '') {
            $this->fail($no, 'nik', 'NIK wajib diisi (16 digit).');

            return;
        }

        $validator = Validator::make($baris, $this->rules(), $this->customValidationMessages());
        if ($validator->fails()) {
            foreach ($validator->errors()->toArray() as $kolom => $pesan) {
                $this->fail($no, (string) $kolom, (string) ($pesan[0] ?? 'Nilai tidak valid.'));

                return;
            }
        }

        $noPendaftaran = trim((string) ($baris['no_pendaftaran'] ?? ''));
        if ($noPendaftaran === '' && ! $kering) {
            $noPendaftaran = $this->psb->nomorPendaftaranBerikutnya($this->gelombangId, $this->jenjang);
        }

        $this->dibuat++;
        $this->valid++;

        if ($kering) {
            return;
        }

        $tahunAjaran = PsbGelombang::with('kegiatan:id,tahun_ajaran')->findOrFail($this->gelombangId)->kegiatan?->tahun_ajaran;
        $usaha = 0;
        while (true) {
            try {
                $calon = PsbCalonSantri::create([
                    'jenjang' => $this->jenjang,
                    'gelombang_id' => $this->gelombangId,
                    'tahun_ajaran' => $tahunAjaran,
                    'tipe_santri' => $baris['tipe_santri'] ?? 'non_asrama',
                    'nik' => $nik,
                    'nama_lengkap' => $baris['nama_lengkap'],
                    'jk' => $baris['jk'] ?? null,
                    'tgl_lahir' => Tanggal::parse($baris['tgl_lahir'] ?? null),
                    'email_ortu' => $baris['email_ortu'] ?? null,
                    'telp_ortu' => isset($baris['telp_ortu']) ? (string) $baris['telp_ortu'] : null,
                    'ayah_nama' => $baris['nama_ayah'] ?? null,
                    'ibu_nama' => $baris['nama_ibu'] ?? null,
                    'no_pendaftaran' => $noPendaftaran,
                    'status_pendaftaran' => 'baru',
                    'tanggal_daftar' => now()->toDateString(),
                ]);
                break;
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                    // NIK/no_pendaftaran bentrok Unique: baris gagal, bukan fatal.
                    $this->dibuat--;
                    $this->valid--;
                    $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->kunciAktif, 'kolom' => 'nik', 'pesan' => 'Calon sudah terdaftar (NIK atau nomor pendaftaran bentrok).'];

                    return;
                }
                $noPendaftaran = $this->psb->nomorPendaftaranBerikutnya($this->gelombangId, $this->jenjang);
            }
        }

        PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => 'baru']);
        $calon->lembagaDetail()->create(['jenjang' => $this->jenjang, 'peran' => 'primer']);
    }

    /** @return array<string, array<int, mixed>> */
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
}
