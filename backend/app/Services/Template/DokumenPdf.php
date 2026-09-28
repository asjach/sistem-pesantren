<?php

namespace App\Services\Template;

use setasign\Fpdi\Tcpdf\Fpdi;

/**
 * PDF keluaran template: halaman PDF yang diunggah dipakai sebagai latar,
 * lalu nilai dari database digambar tepat di atasnya.
 *
 * Kelas ini mewarisi adapter FPDI untuk TCPDF. Yang ditambahkan:
 * - mematikan tautan pustaka pada footer, dan
 * - pemotongan gambar untuk mode `potong`.
 */
class DokumenPdf extends Fpdi
{
    /** Berapa mm skor yang boleh bergerak ke atas skala font terkecil. */
    private float $skorSkalaTerpilih = 0.0;

    /**
     * TCPDF 6.11 menyuntikkan footer "Powered by TCPDF (www.tcpdf.org)" ke
     * setiap halaman, di luar jalur setPrintFooter(false). Penyisipannya dijaga
     * properti protected $tcpdflink, jadi cukup dimatikan lewat warisan ini.
     * Dokumen pengguna tidak boleh menampilkan branding pustaka.
     */
    public function matikanTautanPustaka(): void
    {
        $this->tcpdflink = false;
    }

    /**
     * Skala font terkecil yang masih muat di dalam kotak.
     * Dipakai renderer agar teks panjang menyusut, bukan meluber.
     */
    public function catatSkala(float $skor): void
    {
        $this->skorSkalaTerpilih = $skor;
    }

    public function skalaTerpilih(): float
    {
        return $this->skorSkalaTerpilih;
    }

    /**
     * Batasi gambar agar tidak keluar dari kotaknya (mode `potong`).
     * PDF memakai titik dengan titik asal di kiri bawah, sedangkan koordinat
     * template memakai milimeter dari kiri atas, jadi tinggi dikurangi dulu.
     */
    public function potongMulai(float $x, float $y, float $lebar, float $tinggi): void
    {
        $k = $this->k;
        $bawah = ($this->h - $y - $tinggi) * $k;

        $this->_out(sprintf('%.2F %.2F %.2F %.2F re W n', $x * $k, $bawah, $lebar * $k, $tinggi * $k));
    }

    /** Tutup area potong yang dibuka potongMulai(). */
    public function potongSelesai(): void
    {
        $this->_outRestoreGraphicsState();
    }
}
