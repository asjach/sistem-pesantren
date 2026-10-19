<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\MataPelajaran;

/**
 * Logika import master mapel per baris — dipakai endpoint import-potong
 * bertahap dari browser (tanpa jalur file Excel sekali-jalan).
 *
 * UPSERT per (jenjang, nama_mapel case-insensitive): nama cocok → update
 * hanya kolom terisi (sel kosong = pertahankan, tak bisa mengosongkan kode);
 * nama baru → dibuat. Baris tanpa nama dianggap kosong/pemisah dan dilewati
 * diam-diam. Impor tak pernah menghapus (hapus tetap via DELETE yang sudah
 * punya guard dipakai-kurikulum/pengampu).
 *
 * Izin mengikuti akun per baris (super_admin lolos semua; admin lembaga
 * hanya lembaganya) — baris luar lingkup gagal per baris, bukan 403.
 * Mode kering (`$kering = true`) menjalankan SEMUA cek tanpa menulis.
 */
class MapelImporService extends ImporPotongan
{
    /** Guard duplikat intra-file: "jenjang|nama" lower. */
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
        return $this->castTeks($baris, ['jenjang', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active']);
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nama = trim((string) ($baris['nama_mapel'] ?? ''));
        $this->kunciAktif = $nama === '' ? null : $nama;

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

        $kunci = mb_strtolower($jenjang.'|'.$nama);

        if (isset($this->dilihat[$kunci])) {
            $this->dilewati++;
            $this->valid++;

            return;
        }
        $this->dilihat[$kunci] = true;

        $kelompok = $this->nilai($baris, 'kelompok', [MataPelajaran::FORMAL, MataPelajaran::PESANTREN]);
        if ($kelompok === null) {
            $this->fail($no, 'kelompok', 'Kelompok harus formal/pesantren.');

            return;
        }

        $kode = trim((string) ($baris['kode_mapel'] ?? ''));
        if (mb_strlen($kode) > 20) {
            $this->fail($no, 'kode_mapel', 'Kode mapel maksimal 20 karakter.');

            return;
        }

        $aktifTerisi = trim((string) ($baris['is_active'] ?? '')) !== '';
        $aktif = $this->parseAktif($baris);
        if ($aktifTerisi && $aktif === null) {
            $this->fail($no, 'is_active', 'Is_active tidak dikenal (isi Ya/Tidak, kosong = aktif/pertahankan).');

            return;
        }

        $ada = MataPelajaran::where('jenjang', $jenjang)
            ->whereRaw('LOWER(nama_mapel) = ?', [mb_strtolower($nama)])
            ->first();

        if ($ada === null) {
            $this->dibuat++;
            $this->valid++;
            if (! $kering) {
                MataPelajaran::create([
                    'jenjang' => $jenjang,
                    'nama_mapel' => $nama,
                    'kelompok' => $kelompok,
                    'kode_mapel' => $kode !== '' ? $kode : null,
                    'is_active' => $aktif ?? true,
                ]);
            }

            return;
        }

        $ubah = ['kelompok' => $kelompok];
        if ($kode !== '') {
            $ubah['kode_mapel'] = $kode;
        }
        if ($aktif !== null) {
            $ubah['is_active'] = $aktif;
        }
        $beda = false;
        foreach ($ubah as $kolom => $nilai) {
            if ($ada->getAttribute($kolom) != $nilai) {
                $beda = true;
                break;
            }
        }
        if (! $beda) {
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
     * Sel status aktif: null bila kosong (default/pertahankan), boolean bila
     * terisi nilai yang dikenal, null + terisi = tak dikenal (ditolak
     * pemanggil). Menerima Ya/Tidak, Aktif/Nonaktif, 1/0, true/false.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function parseAktif(array $baris): ?bool
    {
        $nilai = strtolower(trim((string) ($baris['is_active'] ?? '')));
        if ($nilai === '') {
            return null;
        }
        if (in_array($nilai, ['ya', 'y', 'yes', '1', 'true', 'aktif'], true)) {
            return true;
        }
        if (in_array($nilai, ['tidak', 't', 'no', '0', 'false', 'nonaktif', 'tidak aktif'], true)) {
            return false;
        }

        return null;
    }
}
