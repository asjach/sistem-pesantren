<?php

namespace App\Imports;

use App\Models\Kelas;
use App\Models\TahunAjaran;
use App\Services\KelasService;
use App\Services\RefService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;

/**
 * Import file kelas multi-lembaga + multi-tahun ajaran: tiap baris membawa
 * `jenjang` + `tahun_ajaran` sendiri. UPSERT per lingkup: nama cocok → update
 * kolom yang terisi (sel kosong = pertahankan, tak bisa mengosongkan);
 * nama baru → dibuat. Duplikat intra-file dilewati (`dilewati`).
 * Baris tanpa nama dianggap kosong/pemisah dan dilewati diam-diam.
 *
 * Izin mengikuti akun per baris (super_admin lolos semua; admin lembaga hanya
 * lembaganya; admin multi-lembaga sesuai pivotnya) — baris di luar lingkup
 * gagal per baris, bukan 403.
 */
class KelasImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    /** Nomor baris Excel global untuk atribusi kegagalan (1 = heading). */
    protected int $nomorBaris = 1;

    protected int $barisValid = 0;

    protected int $dibuat = 0;

    protected int $diperbarui = 0;

    protected int $dilewati = 0;

    /** Guard duplikat intra-file: "jenjang|ta|nama" lower. */
    protected array $dilihat = [];

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->barisValid + count($this->failures),
            'baris_valid' => $this->barisValid,
            'baris_gagal' => count($this->failures),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
            'dilewati' => $this->dilewati,
        ];
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

    /**
     * Normalisasi SEBELUM validasi: angka Excel → string (sel template
     * bertipe teks, tapi jaga-jaga bila pengguna mengetik angka).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function map($row): array
    {
        $baris = (array) $row;
        foreach (['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_alias', 'walas', 'tingkat', 'urutan', 'kapasitas'] as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }

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
        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $this->nomorBaris++;
                $baris = $row instanceof Collection ? $row->toArray() : $row;
                $nama = Kelas::normalisasiNama(trim((string) ($baris['nama_kelas'] ?? '')));
                // Baris tanpa nama = kosong/pemisah.
                if ($nama === '') {
                    continue;
                }

                $jenjang = trim((string) ($baris['jenjang'] ?? ''));
                $ta = trim((string) ($baris['tahun_ajaran'] ?? ''));

                $auth = auth()->user();
                if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
                    $this->fail($this->nomorBaris, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

                    continue;
                }

                $tahun = TahunAjaran::find($ta);
                if (! $tahun || ! TahunAjaran::efektif($jenjang)->contains('nama', $tahun->nama)) {
                    $this->fail($this->nomorBaris, 'tahun_ajaran', 'Tahun ajaran tidak berlaku untuk lembaga ini.');

                    continue;
                }

                $kunci = mb_strtolower($jenjang.'|'.$ta.'|'.$nama);
                // Duplikat intra-file: hanya kemunculan pertama yang diproses.
                if (isset($this->dilihat[$kunci])) {
                    $this->dilewati++;
                    $this->barisValid++;

                    continue;
                }
                $this->dilihat[$kunci] = true;

                $tingkat = trim((string) ($baris['tingkat'] ?? ''));
                $tingkat = $tingkat === '' ? null : $tingkat;
                $kamus = RefService::kodeAktif('tingkat', $jenjang);
                if ($tingkat !== null && $kamus !== [] && ! in_array($tingkat, $kamus, true)) {
                    $this->fail($this->nomorBaris, 'tingkat', 'Tingkat tidak dikenal.');

                    continue;
                }

                // Wali: NIP dulu, fallback nama; wajib aktif di lingkup kelas.
                $walasId = null;
                $walasTerisi = trim((string) ($baris['walas'] ?? '')) !== '';
                if ($walasTerisi) {
                    try {
                        $layanan = app(KelasService::class);
                        $pegawai = $layanan->cariPegawai((string) $baris['walas']);
                        $layanan->cekKelayakan(
                            new Kelas(['jenjang' => $jenjang, 'tahun_ajaran' => $ta]),
                            $pegawai,
                            'walas'
                        );
                        $walasId = $pegawai->id;
                    } catch (ValidationException $e) {
                        $pesan = (string) (collect($e->errors())->flatten()->first() ?? 'Wali tidak valid.');
                        $this->fail($this->nomorBaris, 'walas', $pesan);

                        continue;
                    }
                }

                $alias = trim((string) ($baris['nama_alias'] ?? ''));
                $ada = Kelas::where('jenjang', $jenjang)
                    ->where('tahun_ajaran', $ta)
                    ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower($nama)])
                    ->first();

                if ($ada === null) {
                    Kelas::create([
                        'jenjang' => $jenjang,
                        'tahun_ajaran' => $ta,
                        'nama_kelas' => $nama,
                        'nama_alias' => $alias !== '' ? $alias : null,
                        'walas_id' => $walasId,
                        'tingkat' => $tingkat,
                        'urutan' => $baris['urutan'] === null || $baris['urutan'] === '' ? 0 : (int) $baris['urutan'],
                        'kapasitas' => $baris['kapasitas'] === null || $baris['kapasitas'] === '' ? null : (int) $baris['kapasitas'],
                    ]);
                    $this->dibuat++;
                    $this->barisValid++;

                    continue;
                }

                // Update: hanya nilai terisi yang menimpa (sel kosong = pertahankan).
                $ubah = [];
                if ($alias !== '') {
                    $ubah['nama_alias'] = $alias;
                }
                if ($walasTerisi) {
                    $ubah['walas_id'] = $walasId;
                }
                if ($tingkat !== null) {
                    $ubah['tingkat'] = $tingkat;
                }
                if ($baris['urutan'] !== null && $baris['urutan'] !== '') {
                    $ubah['urutan'] = (int) $baris['urutan'];
                }
                if ($baris['kapasitas'] !== null && $baris['kapasitas'] !== '') {
                    $ubah['kapasitas'] = (int) $baris['kapasitas'];
                }
                if ($ubah === []) {
                    $this->dilewati++;
                } else {
                    $ada->update($ubah);
                    $this->diperbarui++;
                }
                $this->barisValid++;
            }
        });
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

    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->failures[] = new Failure($no, $kolom, [$pesan], []);
    }
}
