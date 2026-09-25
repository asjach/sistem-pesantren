<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use Illuminate\Validation\ValidationException;

/**
 * Logika import kelas per baris — dipakai dua jalur: file Excel
 * (Maatwebsite, kelas App\Imports\KelasImport sebagai pembungkus tipis)
 * dan potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * UPSERT per lingkup (jenjang, tahun ajaran, nama kelas): nama cocok →
 * update hanya kolom terisi (sel kosong = pertahankan, tak bisa
 * mengosongkan); nama baru → dibuat. Baris tanpa nama dianggap
 * kosong/pemisah dan dilewati diam-diam.
 *
 * Izin mengikuti akun per baris (super_admin lolos semua; admin lembaga
 * hanya lembaganya) — baris luar lingkup gagal per baris, bukan 403.
 * Mode kering (`$kering = true`) menjalankan SEMUA cek tanpa menulis,
 * untuk periksa bertahap (pengganti rollback-transaksi di file besar).
 */
class KelasImporService extends ImporPotongan
{
    /** Guard duplikat intra-file: "jenjang|ta|nama" lower. */
    protected array $dilihat = [];

    /**
     * Normalisasi SEBELUM cek: angka Excel → string (sel template
     * bertipe teks, tapi jaga-jaga bila pengguna mengetik angka).
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        return $this->castTeks($baris, ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_alias', 'walas', 'tingkat', 'urutan', 'kapasitas']);
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nama = Kelas::normalisasiNama(trim((string) ($baris['nama_kelas'] ?? '')));
        $this->kunciAktif = $nama === '' ? null : $nama;
        // Baris tanpa nama = kosong/pemisah.
        if ($nama === '') {
            return;
        }

        $jenjang = trim((string) ($baris['jenjang'] ?? ''));
        if ($jenjang === '' || ! Lembaga::whereKey($jenjang)->exists()) {
            $this->fail($no, 'jenjang', 'Lembaga tidak valid (isi jenjang, mis. MI/MD).');

            return;
        }

        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return;
        }

        $ta = trim((string) ($baris['tahun_ajaran'] ?? ''));
        $tahun = TahunAjaran::find($ta);
        if (! $tahun || ! TahunAjaran::efektif($jenjang)->contains('nama', $tahun->nama)) {
            $this->fail($no, 'tahun_ajaran', 'Tahun ajaran tidak berlaku untuk lembaga ini.');

            return;
        }

        $kunci = mb_strtolower($jenjang.'|'.$ta.'|'.$nama);
        // Duplikat intra-file: hanya kemunculan pertama yang diproses.
        if (isset($this->dilihat[$kunci])) {
            $this->dilewati++;
            $this->valid++;

            return;
        }
        $this->dilihat[$kunci] = true;

        $tingkat = trim((string) ($baris['tingkat'] ?? ''));
        $tingkat = $tingkat === '' ? null : $tingkat;
        $kamus = RefService::kodeAktif('tingkat', $jenjang);
        if ($tingkat !== null && $kamus !== [] && ! in_array($tingkat, $kamus, true)) {
            $this->fail($no, 'tingkat', 'Tingkat tidak dikenal.');

            return;
        }

        // Wali: NIP dulu, fallback nama; wajib aktif di lingkup kelas.
        $walasTerisi = trim((string) ($baris['walas'] ?? '')) !== '';
        $walasId = null;
        if ($walasTerisi) {
            try {
                $pegawai = app(KelasService::class)->cariPegawai((string) $baris['walas']);
                app(KelasService::class)->cekKelayakan(
                    new Kelas(['jenjang' => $jenjang, 'tahun_ajaran' => $ta]),
                    $pegawai,
                    'walas'
                );
                $walasId = $pegawai->id;
            } catch (ValidationException $e) {
                $this->fail($no, 'walas', (string) (collect($e->errors())->flatten()->first() ?? 'Wali tidak valid.'));

                return;
            }
        }

        $alias = trim((string) ($baris['nama_alias'] ?? ''));
        $ada = Kelas::where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower($nama)])
            ->first();

        if ($ada === null) {
            $this->dibuat++;
            $this->valid++;
            if (! $kering) {
                Kelas::create([
                    'jenjang' => $jenjang,
                    'tahun_ajaran' => $ta,
                    'nama_kelas' => $nama,
                    'nama_alias' => $alias !== '' ? $alias : null,
                    'walas_id' => $walasId,
                    'tingkat' => $tingkat,
                    'urutan' => $this->bilangan($baris, 'urutan') ?? 0,
                    'kapasitas' => $this->bilangan($baris, 'kapasitas'),
                ]);
            }

            return;
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
        if ($this->bilangan($baris, 'urutan') !== null) {
            $ubah['urutan'] = (int) $this->bilangan($baris, 'urutan');
        }
        if ($this->bilangan($baris, 'kapasitas') !== null) {
            $ubah['kapasitas'] = (int) $this->bilangan($baris, 'kapasitas');
        }
        if ($ubah === []) {
            $this->dilewati++;
        } else {
            $this->diperbarui++;
            if (! $kering) {
                $ada->update($ubah);
            }
        }
        $this->valid++;
    }

    /**
     * Sel angka opsional: null bila kosong (dipakai untuk update hanya
     * kolom terisi). 0 adalah nilai sah (urutan), jadi tidak disamakan
     * dengan kosong.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function bilangan(array $baris, string $kolom): ?int
    {
        $nilai = $baris[$kolom] ?? null;
        if ($nilai === null || $nilai === '' || ! is_numeric($nilai)) {
            return null;
        }

        return (int) $nilai;
    }
}
