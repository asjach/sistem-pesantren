<?php

namespace App\Services;

use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbLogStatus;
use App\Support\Tanggal;
use DateTimeInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
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
class PsbImporService
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    public int $dibuat = 0;

    public int $diperbarui = 0;

    public int $dilewati = 0;

    /** NIK baris yang sedang diproses (untuk kolom kunci di galat). */
    protected ?string $nikAktif = null;

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
        foreach ($baris as $kunci => $nilai) {
            if ($nilai instanceof DateTimeInterface) {
                $baris[$kunci] = $nilai->format('Y-m-d');
            }
        }
        foreach (['nik', 'telp_ortu', 'no_pendaftaran'] as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }

    /**
     * Proses satu potongan baris untuk satu gelombang + lembaga tujuan.
     * `$nomorAwal` = nomor baris file baris pertama potongan dikurangi 1
     * (heading = 1) agar nomor galat absolut antar potongan.
     *
     * @param  array<int, array<string, mixed>>  $potongan
     */
    public function prosesPotongan(array $potongan, int $nomorAwal, bool $kering): void
    {
        $jalan = function () use ($potongan, $nomorAwal, $kering) {
            foreach (array_values($potongan) as $i => $baris) {
                $this->prosesBaris(is_array($baris) ? $baris : [], $nomorAwal + $i + 1, $kering);
            }
        };

        if ($kering) {
            $jalan();
        } else {
            DB::transaction($jalan);
        }
    }

    /** @param  array<string, mixed>  $baris */
    public function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nik = trim((string) ($baris['nik'] ?? ''));
        $this->nikAktif = $nik === '' ? null : $nik;
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
                    $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nikAktif, 'kolom' => 'nik', 'pesan' => 'Calon sudah terdaftar (NIK atau nomor pendaftaran bentrok).'];

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

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nikAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }
}
