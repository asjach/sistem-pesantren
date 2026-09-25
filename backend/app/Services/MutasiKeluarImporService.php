<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Support\Tanggal;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

/**
 * Logika import arsip mutasi keluar per baris — dipakai dua jalur: file
 * Excel (Maatwebsite, App\Imports\MutasiKeluarImport sebagai pembungkus
 * tipis) dan potongan JSON bertahap dari browser (endpoint
 * import-potong).
 *
 * Efek per baris valid MENIRU tombol "Proses mutasi": arsip ditulis; bila
 * santri masih punya riwayat aktif di jenjang itu, riwayat ditutup
 * (`pindah_keluar`, nonaktif) + keanggotaan ditutup + status global
 * dihitung ulang. Idempoten: baris dengan (santri + jenjang + tanggal)
 * sama dilewati agar file boleh diimport ulang.
 *
 * `tanggal_mutasi` dan `alasan_mutasi` boleh kosong → disimpan `null`
 * (arsip historis). Tanggal kosong tetap ikut jadi kunci idempotensi.
 * `alasan_mutasi` arsip = bebas teks (maks 100 karakter), tak harus cocok
 * dengan kamus `ref_alasan_mutasi`; hanya form "Proses mutasi" yang mewajibkan
 * nilai kamus.
 *
 * `kelas_terakhir` diisi nama rombel lebih dulu (angka pun sah sebagai nama),
 * id numerik jadi fallback, dalam lingkup jenjang; `tahun_ajaran` opsional
 * mempersempit pencarian nama — wajib diisi bila nama yang sama ada di
 * beberapa tahun ajaran. Kosong → beku otomatis dari riwayat terakhir.
 *
 * Izin mengikuti akun per baris (pola import kelas). Mode kering
 * (`$kering = true`) menjalankan SEMUA cek tanpa menulis.
 */
class MutasiKeluarImporService
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
     * Normalisasi SEBELUM cek: angka Excel → string (NIS ber-nol-depan
     * dan tanggal serial tetap terbaca), objek DateTime → Y-m-d.
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
        foreach (['nis_lokal', 'jenjang', 'tanggal_mutasi', 'alasan_mutasi', 'kelas_terakhir', 'tahun_ajaran', 'no_surat', 'nama_sekolah_tujuan', 'npsn_sekolah_tujuan', 'nsm_sekolah_tujuan', 'alamat_sekolah_tujuan', 'keterangan'] as $kolom) {
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

        // Tanggal & alasan boleh kosong pada arsip historis (null).
        $tanggal = null;
        if (trim((string) ($baris['tanggal_mutasi'] ?? '')) !== '') {
            $tanggal = Tanggal::parse($baris['tanggal_mutasi']);
            if ($tanggal === null) {
                $this->fail($no, 'tanggal_mutasi', 'Tanggal mutasi tidak valid.');

                return;
            }
        }

        // Arsip historis: alasan bebas teks (tak harus ada di kamus); form
        // "Proses mutasi" tetap memilih dari kamus aktif.
        $alasan = trim((string) ($baris['alasan_mutasi'] ?? ''));
        if ($alasan === '') {
            $alasan = null;
        } elseif (mb_strlen($alasan) > 100) {
            $this->fail($no, 'alasan_mutasi', 'Alasan mutasi maksimal 100 karakter.');

            return;
        }
        if (! in_array('pindah_keluar', RefService::kodeAktif('status_akhir', $jenjang), true)) {
            $this->fail($no, 'jenjang', 'Status pindah_keluar nonaktif di lembaga ini.');

            return;
        }

        $kelasId = $this->resolveKelas($baris, $santri->id, $jenjang, $no);
        if ($kelasId === false) {
            return;
        }

        // Idempoten: baris yang sama (santri + jenjang + tanggal) dilewati.
        $ada = MutasiKeluar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->when(
                $tanggal === null,
                fn ($q) => $q->whereNull('tanggal_mutasi'),
                fn ($q) => $q->whereDate('tanggal_mutasi', $tanggal)
            )
            ->exists();
        if ($ada) {
            $this->dilewati++;
            $this->valid++;

            return;
        }

        $this->dibuat++;
        $this->valid++;

        if ($kering) {
            return;
        }

        MutasiKeluar::create([
            'santri_id' => $santri->id,
            'jenjang' => $jenjang,
            'kelas_terakhir_id' => $kelasId,
            'tanggal_mutasi' => $tanggal,
            'alasan_mutasi' => $alasan,
            'no_surat' => $this->teks($baris, 'no_surat'),
            'nama_sekolah_tujuan' => $this->teks($baris, 'nama_sekolah_tujuan'),
            'npsn_sekolah_tujuan' => $this->teks($baris, 'npsn_sekolah_tujuan'),
            'nsm_sekolah_tujuan' => $this->teks($baris, 'nsm_sekolah_tujuan'),
            'alamat_sekolah_tujuan' => $this->teks($baris, 'alamat_sekolah_tujuan'),
            'keterangan' => $this->teks($baris, 'keterangan'),
        ]);

        // Tiru "Proses mutasi": tutup riwayat + keanggotaan aktif bila ada.
        $ditutup = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->update(['status_akhir' => 'pindah_keluar', 'is_active_riwayat' => RiwayatBelajar::TIDAK]);
        if ($ditutup > 0) {
            LembagaSantri::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('is_active_lembaga', LembagaSantri::YA)
                ->update(['is_active_lembaga' => LembagaSantri::TIDAK, 'tgl_selesai' => $tanggal]);
            $santri->hitungUlangStatusGlobal();
        }
    }

    /** Cari santri via `nis_lokal` + lembaga (kunci tunggal). */
    protected function cariSantri(array $baris, string $jenjang, int $no): ?Santri
    {
        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                return Santri::find($ls->santri_id);
            }
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /**
     * Kelas terakhir: nama dulu (angka pun bisa jadi nama rombel, mis. "1"),
     * baru id numerik sebagai fallback, dalam lingkup jenjang (+ tahun ajaran
     * bila diisi). Kosong → beku dari riwayat terakhir.
     * false = gagal (galat sudah dicatat).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function resolveKelas(array $baris, int $santriId, string $jenjang, int $no): int|null|false
    {
        $teks = trim((string) ($baris['kelas_terakhir'] ?? ''));
        if ($teks === '') {
            return RiwayatBelajar::where('santri_id', $santriId)
                ->where('jenjang', $jenjang)
                ->latest('id')->value('kelas_id');
        }

        $ta = trim((string) ($baris['tahun_ajaran'] ?? ''));

        $cocok = Kelas::where('jenjang', $jenjang)
            ->when($ta !== '', fn ($q) => $q->where('tahun_ajaran', $ta))
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower(Kelas::normalisasiNama($teks))])
            ->get();
        if (! $cocok->isEmpty()) {
            if ($ta === '' && $cocok->pluck('tahun_ajaran')->unique()->count() > 1) {
                $this->fail($no, 'kelas_terakhir', "Nama kelas \"{$teks}\" ada di beberapa tahun ajaran — isi kolom tahun_ajaran.");

                return false;
            }

            return (int) $cocok->first()->id;
        }

        // Nama tak cocok: angka baru dicoba sebagai id kelas.
        if (ctype_digit($teks)) {
            $kelas = Kelas::whereKey((int) $teks)->where('jenjang', $jenjang)
                ->when($ta !== '', fn ($q) => $q->where('tahun_ajaran', $ta))
                ->first();
            if ($kelas !== null) {
                return $kelas->id;
            }
        }

        $this->fail($no, 'kelas_terakhir', "Kelas \"{$teks}\" tidak ditemukan di lembaga ini.");

        return false;
    }

    /** @param  array<string, mixed>  $baris */
    protected function teks(array $baris, string $kolom): ?string
    {
        $nilai = trim((string) ($baris[$kolom] ?? ''));

        return $nilai === '' ? null : $nilai;
    }

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->nisAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }
}
