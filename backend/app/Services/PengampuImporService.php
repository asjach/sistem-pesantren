<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\PengampuMapel;
use App\Models\TahunAjaran;
use Illuminate\Validation\ValidationException;

/**
 * Logika import pengampu (kelas × mapel → guru) per baris — dipakai endpoint
 * import-potong bertahap dari browser (tanpa jalur file Excel sekali-jalan).
 *
 * Identitas serba-nama (bukan ID): kelas dicari per (jenjang, tahun ajaran,
 * nama), mapel per (jenjang kelas, nama), guru per NIP-dulu-fallback-nama
 * lewat `KelasService::cariPegawai` lalu wajib keaktifan aktif di
 * (jenjang, TA) kelas. Sel `guru` kosong = baris tanpa guru (seperti hasil
 * Generate). Mapel nonaktif ditolak (aktifkan dulu di master).
 *
 * UPSERT per (kelas, mapel): ada → update guru (sama = dilewati); baru →
 * dibuat. Impor tak pernah menghapus (hapus tetap via PUT sync yang sudah
 * punya guard sudah-punya-nilai/jadwal).
 *
 * Izin mengikuti akun per baris — baris luar lingkup gagal per baris,
 * bukan 403. Mode kering (`$kering = true`) tanpa menulis.
 */
class PengampuImporService extends ImporPotongan
{
    /** Guard duplikat intra-file: "kelas_id|mapel_id". */
    protected array $dilihat = [];

    /**
     * Normalisasi SEBELUM cek: angka Excel → string.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        return $this->castTeks($baris, ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel', 'guru']);
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $namaKelas = Kelas::normalisasiNama(trim((string) ($baris['nama_kelas'] ?? '')));
        $namaMapel = trim((string) ($baris['nama_mapel'] ?? ''));
        $this->kunciAktif = $namaKelas === '' && $namaMapel === ''
            ? null
            : trim($namaKelas.'|'.$namaMapel, '|');
        // Baris tanpa kelas/mapel = kosong/pemisah.
        if ($namaKelas === '' || $namaMapel === '') {
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

        $kelas = Kelas::where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower($namaKelas)])
            ->first();
        if ($kelas === null) {
            $this->fail($no, 'nama_kelas', "Kelas \"{$namaKelas}\" tidak ditemukan di {$jenjang} {$ta}.");

            return;
        }

        $mapel = MataPelajaran::where('jenjang', $kelas->jenjang)
            ->whereRaw('LOWER(nama_mapel) = ?', [mb_strtolower($namaMapel)])
            ->first();
        if ($mapel === null) {
            $this->fail($no, 'nama_mapel', "Mapel \"{$namaMapel}\" tidak ditemukan di {$kelas->jenjang}.");

            return;
        }
        if (! $mapel->is_active) {
            $this->fail($no, 'nama_mapel', "Mapel \"{$namaMapel}\" nonaktif — aktifkan dulu di master mapel.");

            return;
        }

        // Guru: kosong = tanpa guru; terisi = NIP dulu, fallback nama.
        $guruTerisi = trim((string) ($baris['guru'] ?? '')) !== '';
        $keaktifanId = null;
        if ($guruTerisi) {
            try {
                $pegawai = app(KelasService::class)->cariPegawai((string) $baris['guru']);
                $tugas = KeaktifanPegawai::where('pegawai_id', $pegawai->id)
                    ->where('jenjang', $kelas->jenjang)
                    ->where('tahun_ajaran', $kelas->tahun_ajaran)
                    ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
                    ->first();
                if ($tugas === null) {
                    throw ValidationException::withMessages(['guru' => 'Pegawai tidak aktif di lembaga + tahun ajaran kelas ini.']);
                }
                $keaktifanId = $tugas->id;
            } catch (ValidationException $e) {
                $this->fail($no, 'guru', (string) (collect($e->errors())->flatten()->first() ?? 'Guru tidak valid.'));

                return;
            }
        }

        $kunci = $kelas->id.'|'.$mapel->id;
        // Duplikat intra-file: hanya kemunculan pertama yang diproses.
        if (isset($this->dilihat[$kunci])) {
            $this->dilewati++;
            $this->valid++;

            return;
        }
        $this->dilihat[$kunci] = true;

        $ada = PengampuMapel::where('kelas_id', $kelas->id)
            ->where('mata_pelajaran_id', $mapel->id)
            ->first();

        if ($ada === null) {
            $this->dibuat++;
            $this->valid++;
            if (! $kering) {
                PengampuMapel::create([
                    'kelas_id' => $kelas->id,
                    'mata_pelajaran_id' => $mapel->id,
                    'keaktifan_pegawai_id' => $keaktifanId,
                ]);
            }

            return;
        }

        if ((int) $ada->keaktifan_pegawai_id === (int) $keaktifanId) {
            $this->dilewati++;
        } else {
            $this->diperbarui++;
            if (! $kering) {
                $ada->update(['keaktifan_pegawai_id' => $keaktifanId]);
            }
        }
        $this->valid++;
    }
}
