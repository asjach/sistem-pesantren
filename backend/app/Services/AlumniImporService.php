<?php

namespace App\Services;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Support\Tanggal;
use Illuminate\Support\Facades\DB;

/**
 * Logika import arsip alumni per baris — dipakai dua jalur: file Excel
 * (Maatwebsite, App\Imports\AlumniImport sebagai pembungkus tipis) dan
 * potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * Kunci: satu baris alumni per (**santri + lembaga**) — santri boleh punya
 * arsip di beberapa lembaga (mis. lulus MI lalu MD). Baris baru → dibuat;
 * baris yang isinya sama persis → dilewati (file boleh diimport ulang);
 * selain itu diperbarui. Santri aktif di jenjang itu ditutup seperti proses lulus
 * (riwayat + keanggotaan nonaktif, status global dihitung ulang).
 *
 * `tanggal_lulus` boleh kosong → disimpan `NULL` (arsip historis); kolom
 * nullable di DB. Form "Lulus" tetap mewajibkan tanggal. `tahun_ajaran_lulus`
 * tetap wajib karena dipakai untuk resolusi `kelas_lulus`. Keanggotaan
 * (`tgl_selesai`) diisi dari `tanggal_lulus` walau sudah nonaktif.
 *
 * Izin mengikuti akun per baris. Mode kering (`$kering = true`)
 * menjalankan SEMUA cek tanpa menulis (periksa bertahap).
 */
class AlumniImporService extends ImporPotongan
{
    /** Santri yang status globalnya perlu dihitung ulang di akhir potongan. */
    protected array $tersentuh = [];

    /**
     * Sama seperti induk, tetapi status global semua santri tersentuh dihitung
     * sekali di akhir potongan (bukan 2 query per baris).
     *
     * @param  array<int, array<string, mixed>>  $potongan
     */
    public function prosesPotongan(array $potongan, int $nomorAwal, bool $kering): void
    {
        $jalan = function () use ($potongan, $nomorAwal, $kering): void {
            $this->tersentuh = [];
            foreach (array_values($potongan) as $i => $baris) {
                $this->prosesBaris(is_array($baris) ? $baris : [], $nomorAwal + $i + 1, $kering);
            }
            if (! $kering) {
                Santri::hitungUlangStatusGlobalBanyak(array_keys($this->tersentuh));
            }
        };

        if ($kering) {
            $jalan();
        } else {
            DB::transaction($jalan);
        }
    }

    /**
     * Normalisasi SEBELUM cek: angka Excel → string, objek DateTime → Y-m-d.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTanggal($baris);

        return $this->castTeks($baris, ['nis_lokal', 'jenjang', 'tahun_ajaran_lulus', 'tanggal_lulus', 'kelas_lulus', 'nomor_ijazah', 'no_peserta', 'skhun', 'no_surat_ijazah', 'kegiatan_setelah_lulus', 'penyerahan_ijazah', 'melanjutkan', 'catatan']);
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nis = trim((string) ($baris['nis_lokal'] ?? ''));
        $this->kunciAktif = $nis === '' ? null : $nis;
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

        $santri = $this->cariSantri($baris, $jenjang, $no);
        if ($santri === null) {
            return;
        }

        // Arsip historis: tanggal boleh kosong (disimpan NULL). Terisi tapi
        // tak valid → galat.
        $tanggal = null;
        if (trim((string) ($baris['tanggal_lulus'] ?? '')) !== '') {
            $tanggal = Tanggal::parse($baris['tanggal_lulus']);
            if ($tanggal === null) {
                $this->fail($no, 'tanggal_lulus', 'Tanggal lulus tidak valid.');

                return;
            }
        }

        $tahunAjaran = trim((string) ($baris['tahun_ajaran_lulus'] ?? ''));
        $kelasId = $this->resolveKelas($baris, $santri->id, $jenjang, $tahunAjaran, $no);
        if ($kelasId === false) {
            return;
        }

        $data = [
            'santri_id' => $santri->id,
            'lembaga_lulus' => $jenjang,
            'kelas_lulus_id' => $kelasId,
            'tahun_ajaran_lulus' => $tahunAjaran,
            'nomor_ijazah' => $this->teks($baris, 'nomor_ijazah'),
            'no_peserta' => $this->teks($baris, 'no_peserta'),
            'skhun' => $this->teks($baris, 'skhun'),
            'no_surat_ijazah' => $this->teks($baris, 'no_surat_ijazah'),
            'tanggal_lulus' => $tanggal,
            'kegiatan_setelah_lulus' => $this->teks($baris, 'kegiatan_setelah_lulus'),
            'penyerahan_ijazah' => $this->nilai($baris, 'penyerahan_ijazah', ['sudah', 'belum']) ?? 'sudah',
            'melanjutkan' => $this->nilai($baris, 'melanjutkan', ['ya', 'tidak']),
            'catatan' => $this->teks($baris, 'catatan'),
        ];

        // Kunci baris = santri + lembaga (santri bisa lulus di beberapa lembaga).
        $ada = Alumni::where('santri_id', $santri->id)
            ->where('lembaga_lulus', $jenjang)
            ->first();
        $perluDiperbarui = $ada !== null && $this->berbeda($ada, $data);
        if ($ada === null) {
            $this->dibuat++;
        } elseif ($perluDiperbarui) {
            $this->diperbarui++;
        } else {
            $this->dilewati++;
        }
        $this->valid++;

        if ($kering) {
            return;
        }

        $this->tutupRiwayatAktif($santri, $jenjang, $tanggal);

        if ($ada === null) {
            Alumni::create($data);
        } elseif ($perluDiperbarui) {
            $ada->fill($data)->save();
        }
    }

    /** @param  array<string, mixed>  $baris */
    protected function cariSantri(array $baris, string $jenjang, int $no): ?Santri
    {
        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $membership = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($membership !== null) {
                return Santri::find($membership->santri_id);
            }
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /**
     * Kelas lulus: nama (diutamakan) atau id, dalam lingkup jenjang +
     * tahun ajaran lulus. Kosong → beku dari riwayat terakhir.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function resolveKelas(array $baris, int $santriId, string $jenjang, string $tahunAjaran, int $no): int|null|false
    {
        $teks = trim((string) ($baris['kelas_lulus'] ?? ''));
        if ($teks === '') {
            return RiwayatBelajar::where('santri_id', $santriId)
                ->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $tahunAjaran)
                ->latest('id')
                ->value('kelas_id');
        }

        if (ctype_digit($teks)) {
            $kelas = Kelas::whereKey((int) $teks)
                ->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $tahunAjaran)
                ->first();
            if ($kelas === null) {
                $this->fail($no, 'kelas_lulus', "Kelas id \"{$teks}\" tidak ditemukan di lingkup ini.");

                return false;
            }

            return (int) $kelas->id;
        }

        $kelas = Kelas::where('jenjang', $jenjang)
            ->where('tahun_ajaran', $tahunAjaran)
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower(Kelas::normalisasiNama($teks))])
            ->first();
        if ($kelas === null) {
            $this->fail($no, 'kelas_lulus', "Kelas \"{$teks}\" tidak ditemukan di tahun ajaran ini.");

            return false;
        }

        return (int) $kelas->id;
    }

    /**
     * Tutup riwayat aktif (status `lulus`) dan isi `tgl_selesai` keanggotaan.
     *
     * Arsip historis: santri sering sudah nonaktif di riwayat/keanggotaan,
     * jadi `tgl_selesai` diisi dari `tanggal_lulus` untuk SEMUA baris
     * keanggotaan di jenjang itu — bukan hanya yang masih aktif. Baris yang
     * masih aktif ikut dinonaktifkan. `tanggal_lulus` kosong → `tgl_selesai`
     * yang sudah ada tidak diubah (import tak menghapus data lama).
     */
    protected function tutupRiwayatAktif(Santri $santri, string $jenjang, ?string $tanggal): void
    {
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->get(['id']);

        if ($riwayat->isNotEmpty()) {
            RiwayatBelajar::whereKey($riwayat->modelKeys())->update([
                'status_akhir' => 'lulus',
                'is_active_riwayat' => RiwayatBelajar::TIDAK,
            ]);
        }

        $keanggotaan = LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang);
        if ($tanggal !== null) {
            $keanggotaan->update(['tgl_selesai' => $tanggal]);
        }
        $keanggotaan->where('is_active_lembaga', LembagaSantri::YA)
            ->update(['is_active_lembaga' => LembagaSantri::TIDAK]);

        if ($riwayat->isNotEmpty()) {
            $this->tersentuh[(int) $santri->id] = true;
        }
    }

    /** @param  array<string, mixed>  $data */
    protected function berbeda(Alumni $ada, array $data): bool
    {
        // Kedua sisi dinormalkan ke ?string agar NULL vs '' tak dianggap beda
        // (baris kosong tak boleh memicu update berulang saat import ulang).
        $tanggal = $ada->tanggal_lulus?->format('Y-m-d');
        $tanggalBaru = $data['tanggal_lulus'] === null ? null : (string) $data['tanggal_lulus'];

        return (string) $ada->lembaga_lulus !== (string) $data['lembaga_lulus']
            || (string) $ada->kelas_lulus_id !== (string) ($data['kelas_lulus_id'] ?? '')
            || (string) $ada->tahun_ajaran_lulus !== (string) $data['tahun_ajaran_lulus']
            || $tanggal !== $tanggalBaru
            || (string) $ada->nomor_ijazah !== (string) ($data['nomor_ijazah'] ?? '')
            || (string) $ada->no_peserta !== (string) ($data['no_peserta'] ?? '')
            || (string) $ada->skhun !== (string) ($data['skhun'] ?? '')
            || (string) $ada->no_surat_ijazah !== (string) ($data['no_surat_ijazah'] ?? '')
            || (string) $ada->kegiatan_setelah_lulus !== (string) ($data['kegiatan_setelah_lulus'] ?? '')
            || (string) $ada->penyerahan_ijazah !== (string) $data['penyerahan_ijazah']
            || (string) $ada->melanjutkan !== (string) ($data['melanjutkan'] ?? '')
            || (string) $ada->catatan !== (string) ($data['catatan'] ?? '');
    }
}
