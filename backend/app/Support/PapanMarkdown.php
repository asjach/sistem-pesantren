<?php

namespace App\Support;

use App\Services\PapanService;

/**
 * Penghasil markdown papan perkembangan proyek.
 *
 * Modul dihasilkan dari isi papan (modul -> sub-modul -> butir, lengkap
 * dengan status). Bagian "SEDANG DIKERJAKAN" dan "RINCIAN TEKNIS LAINNYA"
 * **bukan** data papan, jadi dipertahankan dari berkas lama.
 *
 * Dengan begitu `PETA-MODUL.md` selalu turunan yang setia: sekali
 * `papan:markdown` dijalankan, markdown tidak mungkin lagi basi.
 */
class PapanMarkdown
{
    /** Penanda awal bagian yang dihasilkan dari Board (per aplikasi). */
    public const PENANDA_AWAL = '# Aplikasi: ';

    /** Judul bagian pertama yang bukan data papan; sisanya dipertahankan. */
    public const PENANDA_EKOR = '# SEDANG DIKERJAKAN';

    /** Awal bagian rincian teknis yang dipertahankan dari berkas lama. */
    public const PENANDA_RINCIAN = '# RINCIAN TEKNIS LAINNYA';

    public function __construct(private readonly PapanService $papan) {}

    /**
     * Hasilkan markdown lengkap: kepala + modul dari papan + ekor lama.
     *
     * @param  string  $kepala  bagian sebelum "# A. " (header, cara baca, dst.)
     * @param  string  $ekor  bagian mulai "# SEDANG DIKERJAKAN" ke bawah
     */
    public function hasilkan(string $kepala, string $ekor): string
    {
        $potongan = [rtrim($kepala), '', $this->bagianModul(), $this->bagianSedang()];

        return implode("\n", $potongan).$this->ekorTanpaBagianSedang($ekor)."\n";
    }

    /**
     * Bagian "SEDANG DIKERJAKAN" dihasilkan dari sub-modul berstatus SEDANG,
     * supaya tidak bisa lagi bilang "Kosong" padahal ada pekerjaan berjalan.
     */
    public function bagianSedang(): string
    {
        $sedang = [];

        foreach ($this->papan->semua() as $modul) {
            foreach ($modul['sub'] as $sub) {
                if ($sub['status'] === 'sedang') {
                    $sedang[] = "- **{$sub['kode']} {$sub['nama']}** ({$modul['nama']})";
                }
            }
        }

        $isi = $sedang === []
            ? ['**Kosong.** Tidak ada sub-modul yang disetujui sebagai pekerjaan berjalan.']
            : ['Sub-modul yang sedang dikerjakan:', '', ...$sedang];

        return implode("\n", [self::PENANDA_EKOR, '', ...$isi, '', '---', '', '']);
    }

    /**
     * Buang bagian "SEDANG DIKERJAKAN" dari ekor lama, sisakan rincian teknis.
     *
     * @throws \RuntimeException bila penanda rincian tidak ada — lebih baik
     *                           gagal terang-terangan daripada membuang isinya
     *                           tanpa suara saat menulis ulang.
     */
    private function ekorTanpaBagianSedang(string $ekor): string
    {
        $awal = strpos($ekor, self::PENANDA_RINCIAN);

        if ($awal === false) {
            throw new \RuntimeException(
                'Bagian `'.self::PENANDA_RINCIAN.'` tidak ditemukan di ekor berkas peta; menulis ulang akan membuang isinya.'
            );
        }

        return rtrim(substr($ekor, $awal));
    }

    /** Markdown untuk seluruh aplikasi beserta modul, sub-modul, dan butirnya. */
    public function bagianModul(): string
    {
        $blok = [];

        foreach ($this->papan->semuaAplikasi() as $aplikasi) {
            if ($blok !== []) {
                $blok[] = '---';
                $blok[] = '';
            }

            $blok[] = self::PENANDA_AWAL.$aplikasi['nama'];

            if ($aplikasi['modul'] === []) {
                $blok[] = '';
                $blok[] = '- (kosong)';

                continue;
            }

            foreach ($aplikasi['modul'] as $modul) {
                $blok[] = '';
                $blok[] = '## '.$modul['kode'].'. '.$modul['nama'];

                if (is_string($modul['catatan'] ?? null) && trim($modul['catatan']) !== '') {
                    $blok[] = '';
                    $blok[] = trim($modul['catatan']);
                }

                foreach ($modul['sub'] as $sub) {
                    $blok[] = '';
                    $blok[] = $this->subModul($sub);
                }
            }
        }

        return implode("\n", $blok)."\n";
    }

    /**
     * Satu sub-modul: judul, lalu blok status berisi butirnya.
     *
     * @param  array<string, mixed>  $sub
     */
    private function subModul(array $sub): string
    {
        // Status sub-modul adalah TURUNAN dari poin-poinnya (lihat
        // PapanService::statusTurunan). Ditulis di judul supaya pembaca
        // markdown langsung tahu sampai mana sub-modul ini, tanpa harus
        // menghitung sendiri sebaran poin di bawahnya.
        $statusJudul = mb_strtoupper($sub['status']);
        $petik = chr(96);
        $baris = ["### {$sub['kode']} {$sub['nama']} {$petik}{$statusJudul}{$petik}"];

        foreach (PapanService::STATUS as $status) {
            $butir = $this->butirBerstatus($sub, $status);

            $baris[] = '**'.mb_strtoupper($status).'**';

            if ($butir === []) {
                $baris[] = '- (kosong)';

                continue;
            }

            foreach ($butir as $b) {
                $baris[] = '- '.$b['deskripsi'];
                foreach ($b['subpoin'] ?? [] as $subpoin) {
                    $teks = is_array($subpoin) ? (string) ($subpoin['teks'] ?? '') : (string) $subpoin;
                    $selesai = is_array($subpoin) && (bool) ($subpoin['selesai'] ?? false);

                    if ($teks === '') {
                        continue;
                    }

                    $baris[] = '  - ['.($selesai ? 'x' : ' ').'] '.$teks;
                }
            }
        }

        return implode("\n", $baris);
    }

    /**
     * Butir milik sebuah sub-modul dengan status tertentu.
     *
     * @param  array<string, mixed>  $sub
     * @return array<int, array<string, mixed>>
     */
    private function butirBerstatus(array $sub, string $status): array
    {
        return array_values(array_filter(
            $sub['butir'],
            fn (array $b) => $b['status'] === $status,
        ));
    }

    /**
     * Potong berkas markdown lama jadi kepala dan ekor.
     *
     * @return array{0: string, 1: string} [kepala sebelum "# A. ", ekor dari "# H. "]
     */
    public static function potong(string $isi): array
    {
        $awalModul = strpos($isi, self::PENANDA_AWAL);
        $awalEkor = strpos($isi, self::PENANDA_EKOR);

        if ($awalModul === false || $awalEkor === false || $awalEkor < $awalModul) {
            throw new \RuntimeException(
                'Berkas peta tidak memuat penanda \`'.self::PENANDA_AWAL.'\` dan \`'.self::PENANDA_EKOR.'\`; tidak bisa dipotong.'
            );
        }

        return [substr($isi, 0, $awalModul), substr($isi, $awalEkor)];
    }
}
