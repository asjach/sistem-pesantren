<?php

namespace App\Services;

use App\Support\PapanMarkdown;
use RuntimeException;

/**
 * Menulis ulang \`docs/PETA-MODUL.md\` dari isi papan.
 *
 * Dipakai dua jalur: command \`papan:markdown\` (manual) dan controller API
 * (otomatis tiap kartu dipindah). Sengaja dipisah supaya aturan "berkas apa,
 * dan apa yang terjadi kalau gagal" hanya ada di satu tempat.
 *
 * Tulis-ulang **tidak pernah** menggagalkan perubahan papan: papan di database
 * adalah sumbernya, markdown cuma turunan. Bila markdown gagal ditulis (mis.
 * berkas tidak ditemukan), perubahan tetap dianggap berhasil dan kegagalannya
 * dilaporkan supaya bisa ditindaklanjuti.
 */
class PapanTulisUlang
{
    public function __construct(private readonly PapanMarkdown $generator) {}

    /** Lokasi berkas peta di repo (di luar \`backend/\`). */
    public static function berkasBawaan(): string
    {
        return dirname(base_path()).'/docs/PETA-MODUL.md';
    }

    /**
     * Tulis ulang berkas peta bila isinya berbeda.
     *
     * @param  string|null  $berkas  lokasi berkas; null = lokasi bawaan
     * @return array{berubah: bool, berkas: string} keterangan hasil
     *
     * @throws RuntimeException bila berkas peta tidak ada atau tidak bisa dipotong
     */
    public function jalankan(?string $berkas = null): array
    {
        $tujuan = $berkas ?? self::berkasBawaan();

        if (! is_file($tujuan)) {
            throw new RuntimeException("Berkas peta tidak ditemukan: {$tujuan}");
        }

        $lama = (string) file_get_contents($tujuan);

        if (trim($lama) === '') {
            throw new RuntimeException("Berkas peta kosong; menulis ulang akan menghapus isinya: {$tujuan}");
        }

        [$kepala, $ekor] = PapanMarkdown::potong($lama);
        $baru = $this->generator->hasilkan($kepala, $ekor);

        if ($baru === $lama) {
            return ['berubah' => false, 'berkas' => $tujuan];
        }

        // Pengaman: markdown hanya turunan, jadi kehilangan isi besar-besaran
        // hampir selalu berarti papan sedang tidak terbaca (mis. koneksi salah)
        // — bukan berarti isinya memang menyusut. Lebih baik gagal daripada
        // menimpa berkas baik dengan hasil yang timpang.
        if (strlen($baru) < strlen($lama) * 0.5) {
            throw new RuntimeException(sprintf(
                'Hasil papan hanya %d byte sedangkan berkas %d byte; penulisan dibatalkan agar isi tidak hilang.',
                strlen($baru),
                strlen($lama),
            ));
        }

        if (file_put_contents($tujuan, $baru) === false) {
            throw new RuntimeException("Berkas peta tidak bisa ditulis: {$tujuan}");
        }

        return ['berubah' => true, 'berkas' => $tujuan];
    }

    /**
     * Jalankan tanpa melempar: untuk jalur yang tidak boleh gagal.
     *
     * @return string|null pesan galat bila gagal, null bila berhasil
     */
    public function cobaJalankan(?string $berkas = null): ?string
    {
        try {
            $this->jalankan($berkas);

            return null;
        } catch (RuntimeException $e) {
            return $e->getMessage();
        }
    }
}
