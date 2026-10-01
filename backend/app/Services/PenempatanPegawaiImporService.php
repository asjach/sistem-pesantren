<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Support\Tanggal;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Import penempatan pegawai per baris (`lembaga_pegawai`) — logika tunggal
 * untuk potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * UPSERT per kunci (pegawai, lembaga): cocok → update hanya kolom terisi
 * (sel kosong = pertahankan, tak bisa mengosongkan diam-diam); baru →
 * dibuat (aktif bawaan). Pegawai dicocokkan `pegawai_id` eksak → `nipp`
 * eksak → nama unik. Tulis lewat `PegawaiService::pastikanPenempatan` agar
 * invarian modul terjaga (aktifkan-ulang, selaras akses akun). Mode kering
 * (`$kering = true`) menjalankan SEMUA cek tanpa menulis.
 */
class PenempatanPegawaiImporService extends ImporPotongan
{
    protected const KOLOM_TEKS = ['pegawai_id', 'nipp', 'no_sk_awal_ptk'];

    protected const KOLOM_TANGGAL = ['tgl_masuk', 'tgl_selesai', 'tgl_sk_awal_ptk'];

    public function __construct(private PegawaiService $penempatan) {}

    /** @param  array<string, mixed>  $baris */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTeks($baris, self::KOLOM_TEKS);
        $baris = $this->castTanggal($baris);
        foreach (self::KOLOM_TANGGAL as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                try {
                    $baris[$kolom] = ExcelDate::excelToDateTimeObject($baris[$kolom])->format('Y-m-d');
                } catch (\Throwable $e) {
                }
            }
        }

        return $baris;
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nipp = trim((string) ($baris['nipp'] ?? ''));
        $this->kunciAktif = $nipp !== '' ? $nipp : (trim((string) ($baris['nama_lengkap'] ?? '')) ?: null);

        // Baris kosong/pemisah: tanpa identitas pegawai.
        if (empty($baris['pegawai_id']) && $nipp === '' && empty($baris['nama_lengkap'])) {
            return;
        }

        $jenjang = mb_strtoupper(trim((string) ($baris['jenjang'] ?? '')));

        if ($jenjang === '' || ! Lembaga::whereKey($jenjang)->exists()) {
            $this->fail($no, 'jenjang', 'Lembaga tidak valid (isi jenjang, mis. MI/MD).');

            return;
        }

        // Izin mengikuti akun per baris (super_admin lolos semua; admin
        // lembaga hanya lembaganya) — baris luar lingkup gagal per baris.
        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return;
        }

        $aktif = $this->normalisasiAktif($baris['is_active_lembaga'] ?? null);
        if ($aktif === false) {
            $this->fail($no, 'is_active_lembaga', "Status '{$baris['is_active_lembaga']}' tidak dikenal (isi Ya/Tidak).");

            return;
        }

        $tglMasuk = $this->tanggalSel($baris, 'tgl_masuk', $no, 'Tanggal masuk tidak valid.');
        if ($tglMasuk === false) {
            return;
        }
        $tglSelesai = $this->tanggalSel($baris, 'tgl_selesai', $no, 'Tanggal selesai tidak valid.');
        if ($tglSelesai === false) {
            return;
        }
        $tglSkAwal = $this->tanggalSel($baris, 'tgl_sk_awal_ptk', $no, 'Tanggal SK awal PTK tidak valid.');
        if ($tglSkAwal === false) {
            return;
        }

        // Sel terisi (untuk update: hanya sel terisi yang menimpa).
        $terisi = fn (string $kunci) => array_key_exists($kunci, $baris) && trim((string) $baris[$kunci]) !== '';
        $tugas = $terisi('tugas_utama') ? trim((string) $baris['tugas_utama']) : null;
        $tahaj = $terisi('tahaj_masuk') ? trim((string) $baris['tahaj_masuk']) : null;
        $noSk = $terisi('no_sk_awal_ptk') ? trim((string) $baris['no_sk_awal_ptk']) : null;

        foreach (['tugas_utama' => [$tugas, 100], 'tahaj_masuk' => [$tahaj, 50], 'no_sk_awal_ptk' => [$noSk, 100]] as $kolom => [$nilai, $maks]) {
            if ($nilai !== null && mb_strlen($nilai) > $maks) {
                $this->fail($no, $kolom, "Maksimal {$maks} karakter.");

                return;
            }
        }

        $pegawai = $this->cariPegawai($baris, $no);
        if ($pegawai === null) {
            return;
        }

        $lama = LembagaPegawai::untuk((int) $pegawai->id, $jenjang);

        // `pastikanPenempatan` selalu menulis tgl_masuk/tahaj_masuk — isi
        // nilai lama bila sel kosong agar update tak menghapus diam-diam.
        $atribut = [
            'tgl_masuk' => $tglMasuk ?? $lama?->tgl_masuk?->format('Y-m-d'),
            'tahaj_masuk' => $tahaj ?? $lama?->tahaj_masuk,
        ];
        if ($tugas !== null) {
            $atribut['tugas_utama'] = $tugas;
        }
        if ($aktif !== null) {
            $atribut['is_active_lembaga'] = $aktif;
        }
        if ($terisi('tgl_selesai')) {
            $atribut['tgl_selesai'] = $tglSelesai;
        }
        if ($terisi('no_sk_awal_ptk')) {
            $atribut['no_sk_awal_ptk'] = $noSk;
        }
        if ($terisi('tgl_sk_awal_ptk')) {
            $atribut['tgl_sk_awal_ptk'] = $tglSkAwal;
        }

        $diubah = $tugas !== null || $aktif !== null || $tglMasuk !== null
            || $terisi('tgl_selesai') || $tahaj !== null
            || $terisi('no_sk_awal_ptk') || $terisi('tgl_sk_awal_ptk');

        if ($lama !== null && ! $diubah) {
            // Baris cocok tanpa kolom terisi = dilewati (idempoten).
            $this->dilewati++;

            return;
        }

        if (! $kering) {
            $this->penempatan->pastikanPenempatan($pegawai, $jenjang, $atribut);
        }
        $lama !== null ? $this->diperbarui++ : $this->dibuat++;

        $this->valid++;
    }

    /**
     * Sel tanggal: string Y-m-d bila terisi valid, null bila sel kosong
     * (tanggal-nol dianggap kosong), false + galat bila tak valid.
     *
     * @param  array<string, mixed>  $baris
     */
    private function tanggalSel(array $baris, string $kolom, int $no, string $pesan): string|false|null
    {
        $mentah = $baris[$kolom] ?? null;
        if (trim((string) $mentah) === '' || Tanggal::adalahTanggalNol($mentah)) {
            return null;
        }
        $hasil = Tanggal::parse($mentah);
        if ($hasil === null) {
            $this->fail($no, $kolom, $pesan);

            return false;
        }

        return $hasil;
    }

    /**
     * Status aktif: Ya/Aktif/1 → 'Ya', Tidak/.../0 → 'Tidak', kosong → null
     * (tak dikirim); selain itu false = tak dikenal.
     */
    private function normalisasiAktif(mixed $nilai): string|false|null
    {
        $teks = mb_strtolower(trim((string) ($nilai ?? '')));
        if ($teks === '') {
            return null;
        }
        if (in_array($teks, ['ya', 'aktif', '1'], true)) {
            return LembagaPegawai::YA;
        }
        if (in_array($teks, ['tidak', 'tidak aktif', 'nonaktif', 'inaktif', '0'], true)) {
            return LembagaPegawai::TIDAK;
        }

        return false;
    }

    /**
     * Cari pegawai: `pegawai_id` eksak → `nipp` eksak → nama unik.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function cariPegawai(array $baris, int $no): ?Pegawai
    {
        if (! empty($baris['pegawai_id'])) {
            $p = Pegawai::find((int) $baris['pegawai_id']);
            if ($p) {
                return $p;
            }
        }

        $nipp = trim((string) ($baris['nipp'] ?? ''));
        if ($nipp !== '') {
            $p = Pegawai::where('nipp', $nipp)->first();
            if ($p) {
                return $p;
            }
        }

        $nama = trim((string) ($baris['nama_lengkap'] ?? ''));
        if ($nama !== '') {
            $kandidat = Pegawai::where('nama_lengkap', $nama)->get();
            if ($kandidat->count() === 1) {
                return $kandidat->first();
            }
            if ($kandidat->count() > 1) {
                $this->fail($no, 'nama_lengkap', 'Nama pegawai tidak unik — isi pegawai_id atau NIPP.');

                return null;
            }
        }

        $this->fail($no, 'nipp', 'Pegawai tidak ditemukan (cocokkan pegawai_id / NIPP / nama).');

        return null;
    }
}
