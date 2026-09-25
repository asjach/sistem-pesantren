<?php

namespace App\Services;

use DateTimeInterface;
use Illuminate\Support\Facades\DB;

/**
 * Skelet bersama semua layanan import per baris (`*ImporService`): akumulator
 * hitungan + galat, alur potongan bertahap (transaksi per potongan; mode
 * kering `$kering = true` tanpa tulis), dan helper sel/baris yang dipakai
 * lintas layanan. Turunan cukup menyediakan `normalisasiBaris()` dan
 * `prosesBaris()`; SantriImporService dan RiwayatBelajarImporService
 * meng-override `prosesPotongan()` karena punya loop/post-processing khusus
 * (tanda tangan `prosesBaris()`-nya pun berbeda).
 *
 * Kontrak publik yang dipakai trait ImporBertahap (controller) dan pembungkus
 * App\Imports\*: properti `gagal`, `valid`, `dibuat`, `diperbarui`, metode
 * `ringkasan()`, `normalisasiBaris()`, `prosesPotongan()`.
 *
 * Kolom `nis_lokal` di galat CSV menyimpan identitas baris yang sedang
 * diproses (NIS, NIK, nama kelas, atau identifier pengguna — sesuai layanan)
 * via properti `kunciAktif` yang diisi turunan di awal `prosesBaris()`.
 */
abstract class ImporPotongan
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    public int $dibuat = 0;

    public int $diperbarui = 0;

    public int $dilewati = 0;

    /** Identitas baris yang sedang diproses (kolom kunci di galat). */
    protected ?string $kunciAktif = null;

    /** Normalisasi SEBELUM validasi (angka Excel → string, DateTime → Y-m-d, dst). */
    abstract public function normalisasiBaris(array $baris): array;

    /**
     * Proses satu baris; turunan mengelola hitungan valid/dibuat/dilewati
     * di sini. Turunan yang loop-nya khusus (Santri, Riwayat) boleh
     * meng-override `prosesPotongan()` dengan tanda tangan sendiri.
     *
     * @param  array<string, mixed>  $baris
     */
    abstract protected function prosesBaris(array $baris, int $no, bool $kering): void;

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
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` =
     * nomor baris file baris pertama potongan dikurangi 1 (heading = 1),
     * sehingga nomor galat absolut dan selaras antar potongan.
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

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->kunciAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }

    /** Sel teks: string ter-trim, atau null bila kosong. */
    protected function teks(array $baris, string $kolom): ?string
    {
        $nilai = trim((string) ($baris[$kolom] ?? ''));

        return $nilai === '' ? null : $nilai;
    }

    /**
     * Sel pilihan tertutup: nilai ter-normalisasi bila cocok daftar, selain itu null.
     *
     * @param  array<string, mixed>  $baris
     * @param  array<int, string>  $pilihan
     */
    protected function nilai(array $baris, string $kolom, array $pilihan): ?string
    {
        $nilai = strtolower(trim((string) ($baris[$kolom] ?? '')));

        return in_array($nilai, $pilihan, true) ? $nilai : null;
    }

    /** Objek DateTime hasil pembaca Excel → string `Y-m-d`. */
    protected function castTanggal(array $baris): array
    {
        foreach ($baris as $kunci => $nilai) {
            if ($nilai instanceof DateTimeInterface) {
                $baris[$kunci] = $nilai->format('Y-m-d');
            }
        }

        return $baris;
    }

    /**
     * Angka sel numerik → string untuk kolom teks (NIS ber-nol-depan,
     * NIK, dll): `26001.0` → `'26001'`; pecahan tak wajar dibiarkan string.
     *
     * @param  array<string, mixed>  $baris
     * @param  array<int, string>  $kolomKolom
     * @return array<string, mixed>
     */
    protected function castTeks(array $baris, array $kolomKolom): array
    {
        foreach ($kolomKolom as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }
}
