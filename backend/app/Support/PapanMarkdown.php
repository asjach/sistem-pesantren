<?php

namespace App\Support;

use App\Services\PapanService;

/**
 * Penghasil markdown papan perkembangan proyek.
 *
 * Bagian A–G dihasilkan dari isi papan (modul -> sub-modul -> butir, lengkap
 * dengan status). Bagian H ke bawah **bukan** data papan, jadi dipertahankan
 * apa adanya dari berkas lama: semuanya setelah penanda `# H. ` pertama.
 *
 * Dengan begitu `PETA-MODUL.md` selalu turunan yang setia: sekali
 * `papan:markdown` dijalankan, markdown tidak mungkin lagi basi.
 */
class PapanMarkdown
{
    /** Judul bagian pertama yang bukan data papan; sisanya dipertahankan. */
    public const PENANDA_EKOR = '# H. SEDANG DIKERJAKAN';

    public function __construct(private readonly PapanService $papan) {}

    /**
     * Hasilkan markdown lengkap: kepala + bagian A–G dari papan + ekor lama.
     *
     * @param  string  $kepala  bagian sebelum "# A. " (header, cara baca, dst.)
     * @param  string  $ekor  bagian mulai "# H. " ke bawah
     */
    public function hasilkan(string $kepala, string $ekor): string
    {
        $potongan = [rtrim($kepala), '', $this->bagianModul(), $this->bagianSedang()];

        return implode("\n", $potongan).$this->ekorTanpaBagianSedang($ekor)."\n";
    }

    /**
     * Bagian "H. SEDANG DIKERJAKAN" dihasilkan dari sub-modul berstatus SEDANG,
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

        return implode("\n", ['# H. SEDANG DIKERJAKAN', '', ...$isi, '', '---', '', '']);
    }

    /**
     * Buang bagian "H. SEDANG DIKERJAKAN" dari ekor lama (isi sebelumnya),
     * sisakan dari "# I. " ke bawah.
     *
     * @throws \RuntimeException bila penanda bagian I tidak ada — lebih baik
     *                           gagal terang-terangan daripada membuang seluruh
     *                           isi bagian I–K tanpa suara saat menulis ulang.
     */
    private function ekorTanpaBagianSedang(string $ekor): string
    {
        $awalI = strpos($ekor, '# I. ');

        if ($awalI === false) {
            throw new \RuntimeException(
                'Bagian \`# I. \` tidak ditemukan di ekor berkas peta; menulis ulang akan membuang isinya.'
            );
        }

        return rtrim(substr($ekor, $awalI));
    }

    /** Markdown untuk seluruh modul A–G beserta sub-modul dan butirnya. */
    public function bagianModul(): string
    {
        $blok = [];

        foreach ($this->papan->semua() as $modul) {
            if ($blok !== []) {
                $blok[] = '---';
                $blok[] = '';
            }

            $blok[] = "# {$modul['kode']}. {$modul['nama']}";

            if (is_string($modul['catatan'] ?? null) && trim($modul['catatan']) !== '') {
                $blok[] = '';
                $blok[] = trim($modul['catatan']);
            }

            foreach ($modul['sub'] as $sub) {
                $blok[] = '';
                $blok[] = $this->subModul($sub);
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
        $baris = ["## {$sub['kode']} {$sub['nama']} {$petik}{$statusJudul}{$petik}"];

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
        $awalModul = strpos($isi, '# A. ');
        $awalEkor = strpos($isi, self::PENANDA_EKOR);

        if ($awalModul === false || $awalEkor === false || $awalEkor < $awalModul) {
            throw new \RuntimeException(
                'Berkas peta tidak memuat penanda \`# A. \` dan \`'.self::PENANDA_EKOR.'\`; tidak bisa dipotong.'
            );
        }

        return [substr($isi, 0, $awalModul), substr($isi, $awalEkor)];
    }
}
