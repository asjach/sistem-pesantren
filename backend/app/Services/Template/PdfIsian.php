<?php

namespace App\Services\Template;

use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\PdfParser\CrossReference\CrossReferenceException;
use setasign\Fpdi\PdfParser\PdfParserException;
use setasign\Fpdi\PdfParser\Type\PdfTypeException;

/**
 * Menggabungkan berkas template PDF dengan nilai dari database menjadi satu
 * dokumen final.
 *
 * Alur per halaman: FPDI mengimpor halaman template sebagai latar, lalu setiap
 * medan digambar di atasnya pada koordinat milimeter yang sama. Karena tidak
 * ada HTML yang digenerate, seluruh keterbatasan CSS dompdf tidak relevan di
 * sini.
 */
class PdfIsian extends PencetakMedan
{
    /**
     * Hasil PDF dalam bentuk byte.
     *
     * @throws TemplatePdfTidakValidException bila berkas template tidak bisa dibaca
     */
    public function hasil(): string
    {
        $jalur = $this->jalurTemplate();

        $pdf = new DokumenPdf;
        $pdf->matikanTautanPustaka();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->SetAutoPageBreak(false);
        $pdf->SetMargins(0, 0, 0);
        $pdf->setCompression(true);
        $pdf->setCreator((string) config('app.name', 'SIMPES'));
        $pdf->setAuthor((string) config('app.name', 'SIMPES'));
        $pdf->setTitle($this->template->nama);
        $pdf->setSubject('Dicetak dari SIMPES');

        try {
            $halamanTemplate = $pdf->setSourceFile($jalur);
        } catch (CrossReferenceException|PdfParserException|PdfTypeException $e) {
            throw TemplatePdfTidakValidException::dariPustaka($e);
        }

        $medan = DefinisiMedan::normalisasi($this->template->definisi ?? [], $halamanTemplate);
        $jumlahHalaman = $halamanTemplate;

        for ($nomor = 1; $nomor <= $jumlahHalaman; $nomor++) {
            $indeks = $pdf->importPage($nomor);
            $ukuran = $pdf->getTemplateSize($indeks);

            $pdf->AddPage(
                $ukuran['orientation'],
                [round((float) $ukuran['width'], 2), round((float) $ukuran['height'], 2)],
                false,
            );
            $pdf->useTemplate($indeks);

            foreach ($medan['medan'] as $medanSatu) {
                if (($medanSatu['halaman'] ?? 1) !== $nomor) {
                    continue;
                }

                $this->gambarMedan($pdf, $medanSatu, $nomor, $jumlahHalaman);
            }
        }

        return $pdf->Output('isi.pdf', 'S');
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    private function gambarMedan(DokumenPdf $pdf, array $medan, int $nomor, int $jumlahHalaman): void
    {
        match ($medan['tipe']) {
            'tanda_tangan' => null,
            'halaman_otomatis' => $this->gambarHalamanOtomatis($pdf, $medan, $nomor, $jumlahHalaman),
            'garis' => $this->gambarGaris($pdf, $medan),
            'kotak' => $this->gambarKotak($pdf, $medan),
            'gambar' => $this->gambarGambar($pdf, $medan),
            'centang' => $this->gambarCentang($pdf, $medan),
            'paragraf' => $this->gambarTeks($pdf, $medan, $this->teks($medan), bungkus: true),
            'baris_berulang' => $this->gambarBarisBerulang($pdf, $medan),
            default => $this->gambarTeks($pdf, $medan, $this->teks($medan)),
        };
    }

    /**
     * Skor 0 berarti muat tanpaSUSUTAN, 1 berarti harus memotong. Nilainya
     * dipakai laporan agar editor bisa memperingatkan sebelum dokumen dicetak.
     */
    private function gambarTeks(DokumenPdf $pdf, array $medan, string $teks, bool $bungkus = false): void
    {
        if ($teks === '') {
            return;
        }

        $gaya = $medan['gaya'];
        $lebar = (float) $medan['w'];
        $tinggi = (float) $medan['h'];
        $ukuran = (float) $gaya['ukuran'];

        $this->siapkanFont($pdf, $gaya, $ukuran);

        $skor = 1.0;

        if ($gaya['skala_otomatis']) {
            $ukuran = $this->cariUkuranMuat($pdf, $teks, $lebar, $tinggi, $ukuran, (float) $gaya['huruf_min'], $bungkus, $gaya);
            $skor = $ukuran / max(0.01, (float) $gaya['ukuran']);
            $this->siapkanFont($pdf, $gaya, $ukuran);
        }

        $pdf->catatSkala($skor);

        $baris = $ukuran * (float) $gaya['baris'];

        if ($bungkus) {
            $pdf->MultiCell(
                w: $lebar,
                h: $baris,
                txt: $teks,
                border: 0,
                align: $gaya['rata'],
                fill: false,
                ln: 1,
                x: (float) $medan['x'],
                y: (float) $medan['y'],
                reseth: true,
                valign: 'T',
            );

            return;
        }

        $pdf->SetXY((float) $medan['x'], (float) $medan['y']);
        // Urutan argumen Cell: lebar, tinggi, teks, border, tebal garis,
        // perataan, isi, tautan, regangkan, abaikan tinggi minimum, kolom, baris.
        $pdf->Cell($lebar, $tinggi, $teks, 0, 0, $gaya['rata'], false, '', 0, false, 'L', 'M');
    }

    /**
     * Garis horizontal. Panjang memakai lebar kotak dan tebal memakai
     * tingginya, jadi keduanya(mm) punya arti yang sama seperti di desainer.
     *
     * @param  array<string, mixed>  $medan
     */
    private function gambarGaris(DokumenPdf $pdf, array $medan): void
    {
        $tebal = max(0.1, (float) $medan['gaya']['tebal_mm']);
        $pdf->SetLineWidth($tebal);
        $pdf->SetDrawColorArray($this->warnaKeArray((string) $medan['gaya']['warna']));
        $pdf->Line(
            (float) $medan['x'],
            (float) $medan['y'] + $tebal,
            (float) $medan['x'] + (float) $medan['w'],
            (float) $medan['y'] + $tebal,
        );
    }

    /**
     * Kotak berborder, boleh berlatar.
     *
     * @param  array<string, mixed>  $medan
     */
    private function gambarKotak(DokumenPdf $pdf, array $medan): void
    {
        $gaya = $medan['gaya'];
        $tebal = max(0.1, (float) $gaya['tebal_mm']);
        $isi = $gaya['isi'] ?? null;

        $pdf->SetLineWidth($tebal);
        $pdf->SetDrawColorArray($this->warnaKeArray((string) $gaya['warna']));

        if ($isi !== null) {
            [$r, $g, $b] = $this->warnaKeArray((string) $isi);
            $pdf->SetFillColor($r, $g, $b);
        }

        // 'DF' menggambar garis dan isian sekaligus, 'D' hanya garis.
        $pdf->Rect(
            (float) $medan['x'],
            (float) $medan['y'],
            (float) $medan['w'],
            (float) $medan['h'],
            $isi !== null ? 'DF' : 'D',
        );
    }

    private function gambarHalamanOtomatis(DokumenPdf $pdf, array $medan, int $nomor, int $jumlahHalaman): void
    {
        $teks = str_replace(
            ['{halaman}', '{jumlah}'],
            [(string) $nomor, (string) $jumlahHalaman],
            (string) $medan['format'],
        );

        $this->gambarTeks($pdf, $medan, $teks);
    }

    private function gambarCentang(DokumenPdf $pdf, array $medan): void
    {
        $nilai = $this->nilaiMedan($medan);
        $sama = $nilai !== null && (string) $nilai === (string) ($medan['bawa'] ?? '');

        $huruf = $sama ? (string) $medan['huruf'] : (string) $medan['huruf_kosong'];

        if ($huruf === '') {
            return;
        }

        $gaya = $medan['gaya'];
        $this->siapkanFont($pdf, $gaya, (float) $gaya['ukuran']);
        $pdf->SetXY((float) $medan['x'], (float) $medan['y']);
        $pdf->Cell((float) $medan['w'], (float) $medan['h'], $huruf, 0, 0, $gaya['rata'], false, '', 0, false, 'L', 'M');
    }

    private function gambarGambar(DokumenPdf $pdf, array $medan): void
    {
        $jalur = $this->jalurGambarMedan($medan);

        if ($jalur === null) {
            return;
        }

        $x = (float) $medan['x'];
        $y = (float) $medan['y'];
        $lebar = (float) $medan['w'];
        $tinggi = (float) $medan['h'];
        $mode = (string) ($medan['sizemode'] ?? 'sesuaikan');

        if ($mode === 'asli') {
            $pdf->Image($jalur, $x, $y);

            return;
        }

        if ($mode === 'potong') {
            $pdf->potongMulai($x, $y, $lebar, $tinggi);
            $pdf->Image($jalur, $x, $y, $lebar, $tinggi, '', '', '', false, 300, '', false, false, 0, [$x, $y, $x + $lebar, $y + $tinggi], true);
            $pdf->potongSelesai();

            return;
        }

        $pdf->Image($jalur, $x, $y, $lebar, $tinggi, '', '', 'C', true, 300, '', false, false, 0, false, true);
    }

    /**
     * Satu medan baris berulang: N baris ke bawah, tiap baris punya M kolom
     * yang masing-masing punya posisi dan lebar sendiri di dalam kotak.
     *
     * @param  array<string, mixed>  $medan
     */
    private function gambarBarisBerulang(DokumenPdf $pdf, array $medan): void
    {
        $bagian = $medan['baris_berulang'];
        $koleksiKunci = (string) ($bagian['sumber'] ?? '');

        if ($koleksiKunci === '') {
            return;
        }

        $baris = $this->pengisi->koleksi($koleksiKunci, $this->idUntukKoleksi($koleksiKunci));
        $jumlahSlot = min((int) $bagian['jumlah'], count($baris));
        $tinggiBaris = (float) $bagian['tinggi_baris'];
        $xAwal = (float) $medan['x'];
        $yAwal = (float) $medan['y'];

        for ($i = 0; $i < $jumlahSlot; $i++) {
            foreach ($bagian['kolom'] as $kolom) {
                $teks = $this->teksKolom($kolom, $baris[$i], $i + 1);

                if ($teks === '') {
                    continue;
                }

                $gaya = $kolom['gaya'];
                $ukuran = (float) $gaya['ukuran'];

                if ($gaya['skala_otomatis']) {
                    $ukuran = $this->cariUkuranMuat(
                        $pdf,
                        $teks,
                        (float) $kolom['w'],
                        $tinggiBaris,
                        $ukuran,
                        (float) $gaya['huruf_min'],
                        false,
                        $gaya,
                    );
                }

                $this->siapkanFont($pdf, $gaya, $ukuran);
                $pdf->SetXY($xAwal + (float) $kolom['x'], $yAwal + $i * $tinggiBaris);
                $pdf->Cell((float) $kolom['w'], $tinggiBaris, $teks, 0, 0, $gaya['rata'], false, '', 0, false, 'L', 'M');
            }
        }
    }

    private function jalurTemplate(): string
    {
        $path = (string) ($this->template->path_pdf ?? '');

        if ($path === '') {
            throw TemplatePdfTidakValidException::berkasKosong();
        }

        $penuh = Storage::disk('local')->path($path);

        if (! is_file($penuh)) {
            throw TemplatePdfTidakValidException::berkasHilang($path);
        }

        return $penuh;
    }

    /**
     * Cari ukuran font terbesar yang masih muat di dalam kotak. Turun selangkah
     * demi selangkah (0.5pt) sampai cocok atau mencapai huruf minimum.
     *
     * @param  array<string, mixed>  $gaya
     */
    private function cariUkuranMuat(
        DokumenPdf $pdf,
        string $teks,
        float $lebar,
        float $tinggi,
        float $ukuran,
        float $hurufMin,
        bool $bungkus,
        array $gaya,
    ): float {
        $ukuran = max($hurufMin, $ukuran);

        while ($ukuran > $hurufMin) {
            $this->siapkanFont($pdf, $gaya, $ukuran);

            $muat = $bungkus
                ? $pdf->getStringHeight($lebar, $teks, true, false, 0, 0) <= $tinggi
                : $pdf->getStringWidth($teks) <= $lebar;

            if ($muat) {
                return round($ukuran, 2);
            }

            $ukuran = round($ukuran - 0.5, 2);
        }

        return round($hurufMin, 2);
    }

    /** @param array<string, mixed> $gaya */
    private function siapkanFont(DokumenPdf $pdf, array $gaya, float $ukuran): void
    {
        $tebal = $gaya['tebal'] ? 'B' : '';
        $miring = $gaya['miring'] ? 'I' : '';

        $pdf->SetFont($gaya['font'], $tebal.$miring, $ukuran);
        $pdf->setFontSpacing((float) $gaya['spasi']);
        $pdf->SetTextColorArray($this->warnaKeArray((string) $gaya['warna']));
    }

    /** @return array{0: int, 1: int, 2: int} */
    private function warnaKeArray(string $warna): array
    {
        $hex = ltrim($warna, '#');

        return [
            (int) hexdec(substr($hex, 0, 2)),
            (int) hexdec(substr($hex, 2, 2)),
            (int) hexdec(substr($hex, 4, 2)),
        ];
    }

    /** Koleksi memakai id record sesuai penentu data yang deklarasikan. */
    private function idUntukKoleksi(string $koleksi): ?int
    {
        return $this->konteks->idUntuk(KatalogNilai::koleksi()[$koleksi]['pilih_data'] ?? null);
    }
}
