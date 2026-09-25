<?php

namespace App\Services;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Support\Tanggal;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

/**
 * Logika import arsip alumni per baris — dipakai dua jalur: file Excel
 * (Maatwebsite, App\Imports\AlumniImport sebagai pembungkus tipis) dan
 * potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * Kunci: satu baris alumni per santri. Baris baru → dibuat; baris yang
 * isinya sama persis → dilewati (file boleh diimport ulang); selain itu
 * diperbarui. Santri aktif di jenjang itu ditutup seperti proses lulus
 * (riwayat + keanggotaan nonaktif, status global dihitung ulang).
 *
 * Izin mengikuti akun per baris. Mode kering (`$kering = true`)
 * menjalankan SEMUA cek tanpa menulis (periksa bertahap).
 */
class AlumniImporService
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    public int $dibuat = 0;

    public int $diperbarui = 0;

    public int $dilewati = 0;

    /** NIS lokal baris yang sedang diproses (untuk kolom kunci di galat). */
    protected ?string $nisAktif = null;

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->valid + count($this->gagal),
            'baris_valid' => $this->valid,
            'baris_gagal' => count($this->gagal),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
            'dilewati' => $this->dilewati,
        ];
    }

    /**
     * Normalisasi SEBELUM cek: angka Excel → string, objek DateTime → Y-m-d.
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
        foreach (['nis_lokal', 'jenjang', 'tahun_ajaran_lulus', 'tanggal_lulus', 'kelas_lulus', 'nomor_ijazah', 'no_surat_ijazah', 'kegiatan_setelah_lulus', 'penyerahan_ijazah', 'melanjutkan', 'catatan'] as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }

    /**
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` =
     * nomor baris file baris pertama potongan dikurangi 1 (heading = 1).
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
        $nis = trim((string) ($baris['nis_lokal'] ?? ''));
        $this->nisAktif = $nis === '' ? null : $nis;
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

        $tanggal = Tanggal::parse($baris['tanggal_lulus'] ?? null);
        if ($tanggal === null) {
            $this->fail($no, 'tanggal_lulus', 'Tanggal lulus tidak valid.');

            return;
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
            'no_surat_ijazah' => $this->teks($baris, 'no_surat_ijazah'),
            'tanggal_lulus' => $tanggal,
            'kegiatan_setelah_lulus' => $this->teks($baris, 'kegiatan_setelah_lulus'),
            'penyerahan_ijazah' => $this->nilai($baris, 'penyerahan_ijazah', ['sudah', 'belum']) ?? 'belum',
            'melanjutkan' => $this->nilai($baris, 'melanjutkan', ['ya', 'tidak']),
            'catatan' => $this->teks($baris, 'catatan'),
        ];

        $ada = Alumni::where('santri_id', $santri->id)->first();
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

    protected function tutupRiwayatAktif(Santri $santri, string $jenjang, string $tanggal): void
    {
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->get(['id']);
        if ($riwayat->isEmpty()) {
            return;
        }

        RiwayatBelajar::whereKey($riwayat->modelKeys())->update([
            'status_akhir' => 'lulus',
            'is_active_riwayat' => RiwayatBelajar::TIDAK,
        ]);
        LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->update(['is_active_lembaga' => LembagaSantri::TIDAK, 'tgl_selesai' => $tanggal]);
        $santri->hitungUlangStatusGlobal();
    }

    /** @param  array<string, mixed>  $data */
    protected function berbeda(Alumni $ada, array $data): bool
    {
        $tanggal = $ada->tanggal_lulus?->format('Y-m-d');

        return (string) $ada->lembaga_lulus !== (string) $data['lembaga_lulus']
            || (string) $ada->kelas_lulus_id !== (string) ($data['kelas_lulus_id'] ?? '')
            || (string) $ada->tahun_ajaran_lulus !== (string) $data['tahun_ajaran_lulus']
            || $tanggal !== (string) $data['tanggal_lulus']
            || (string) $ada->nomor_ijazah !== (string) ($data['nomor_ijazah'] ?? '')
            || (string) $ada->no_surat_ijazah !== (string) ($data['no_surat_ijazah'] ?? '')
            || (string) $ada->kegiatan_setelah_lulus !== (string) ($data['kegiatan_setelah_lulus'] ?? '')
            || (string) $ada->penyerahan_ijazah !== (string) $data['penyerahan_ijazah']
            || (string) $ada->melanjutkan !== (string) ($data['melanjutkan'] ?? '')
            || (string) $ada->catatan !== (string) ($data['catatan'] ?? '');
    }

    /** @param  array<string, mixed>  $baris */
    protected function teks(array $baris, string $kolom): ?string
    {
        $nilai = trim((string) ($baris[$kolom] ?? ''));

        return $nilai === '' ? null : $nilai;
    }

    /**
     * @param  array<string, mixed>  $baris
     * @param  array<int, string>  $pilihan
     */
    protected function nilai(array $baris, string $kolom, array $pilihan): ?string
    {
        $nilai = strtolower(trim((string) ($baris[$kolom] ?? '')));

        return in_array($nilai, $pilihan, true) ? $nilai : null;
    }

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nisAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }
}
