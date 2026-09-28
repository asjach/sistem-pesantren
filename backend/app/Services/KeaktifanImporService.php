<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Support\Tanggal;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Import riwayat keaktifan pegawai per baris (`keaktifan_pegawai`) — logika
 * tunggal untuk potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * UPSERT per kunci (pegawai, lembaga, TA): cocok → update hanya kolom terisi
 * (sel kosong tak bisa mengosongkan/mengarsipkan diam-diam); baru → dibuat
 * (status bawaan aktif, tugas warisi penempatan). Pegawai dicocokkan
 * `pegawai_id` eksak → `nipp` eksak → nama unik; baris hanya sah bila
 * penempatan (`lembaga_pegawai`) ada di lembaga baris. Mode kering
 * (`$kering = true`) menjalankan SEMUA cek tanpa menulis.
 */
class KeaktifanImporService extends ImporPotongan
{
    protected const KOLOM_TEKS = ['pegawai_id', 'nipp', 'no_sk'];

    protected const KOLOM_TANGGAL = ['tgl_sk'];

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
        $ta = TahunAjaran::normalisasiNama((string) ($baris['tahun_ajaran'] ?? ''));

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

        $tahun = $ta === '' ? null : TahunAjaran::find($ta);
        if (! $tahun || ! TahunAjaran::efektif($jenjang)->contains('nama', $tahun->nama)) {
            $this->fail($no, 'tahun_ajaran', 'Tahun ajaran tidak berlaku untuk lembaga ini.');

            return;
        }

        $status = $this->normalisasiStatus($baris['status_keaktifan'] ?? null);
        if ($status === false) {
            $this->fail($no, 'status_keaktifan', "Status '{$baris['status_keaktifan']}' tidak dikenal (isi Ya/Tidak).");

            return;
        }

        $tglSk = Tanggal::parse($baris['tgl_sk'] ?? null);
        if (trim((string) ($baris['tgl_sk'] ?? '')) !== '' && $tglSk === null && ! Tanggal::adalahTanggalNol($baris['tgl_sk'] ?? null)) {
            $this->fail($no, 'tgl_sk', 'Tanggal SK tidak valid.');

            return;
        }

        $pegawai = $this->cariPegawai($baris, $no);
        if ($pegawai === null) {
            return;
        }

        // Invarian modul: tulis keaktifan hanya bila penempatan ada.
        $penempatan = LembagaPegawai::untuk((int) $pegawai->id, $jenjang);
        if (! $penempatan) {
            $this->fail($no, 'jenjang', 'Pegawai belum ditempatkan di lembaga ini (tempatkan dulu di halaman Lembaga Pegawai).');

            return;
        }

        // Sel terisi (untuk update: hanya sel terisi yang menimpa).
        $terisi = fn (string $kunci) => array_key_exists($kunci, $baris) && trim((string) $baris[$kunci]) !== '';
        $tugas = $terisi('tugas_utama') ? trim((string) $baris['tugas_utama']) : null;
        $noSk = $terisi('no_sk') ? trim((string) $baris['no_sk']) : null;

        $kunci = ['pegawai_id' => $pegawai->id, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta];
        $lama = KeaktifanPegawai::where($kunci)->first();

        if ($lama === null) {
            $baru = $kunci + [
                'tugas_utama' => $tugas ?? $penempatan->tugas_utama,
                'status_keaktifan' => $status !== '' && $status !== null ? $status : KeaktifanPegawai::AKTIF,
            ];
            if ($noSk !== null) {
                $baru['no_sk'] = $noSk;
            }
            if ($tglSk !== null) {
                $baru['tgl_sk'] = $tglSk;
            }
            if (! $kering) {
                KeaktifanPegawai::create($baru);
            }
            $this->dibuat++;
        } else {
            // Update: hanya sel terisi yang menimpa (sel kosong = pertahankan,
            // tak bisa mengosongkan/mengarsipkan diam-diam via import).
            $ubah = [];
            if ($tugas !== null) {
                $ubah['tugas_utama'] = $tugas;
            }
            if ($status !== '' && $status !== null) {
                $ubah['status_keaktifan'] = $status;
            }
            if ($terisi('no_sk')) {
                $ubah['no_sk'] = $noSk;
            }
            if ($terisi('tgl_sk') && $tglSk !== null) {
                $ubah['tgl_sk'] = $tglSk;
            }
            if ($ubah === []) {
                // Baris cocok tanpa kolom terisi = dilewati (idempoten).
                $this->dilewati++;

                return;
            }
            if (! $kering) {
                $lama->update($ubah);
            }
            $this->diperbarui++;
        }

        $this->valid++;
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

    /** Status: Aktif/Inaktif (apa pun kapitalnya), Ya/Tidak, kode kanonis; selain itu false = tak dikenal. */
    protected function normalisasiStatus(mixed $nilai): string|false
    {
        $teks = mb_strtolower(trim((string) ($nilai ?? '')));
        if ($teks === '') {
            return '';
        }
        if (in_array($teks, ['ya', 'aktif', '1'], true)) {
            return KeaktifanPegawai::AKTIF;
        }
        if (in_array($teks, ['tidak', 'tidak aktif', 'nonaktif', 'inaktif', '0'], true)) {
            return KeaktifanPegawai::INAKTIF;
        }

        return false;
    }
}
