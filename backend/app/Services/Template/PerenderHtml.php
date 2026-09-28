<?php

namespace App\Services\Template;

use Dompdf\Dompdf;

/**
 * Renderer untuk template jenis 'html': tata letak digambar sendiri di kanvas
 * dan dirender oleh dompdf, tanpa berkas PDF eksternal.
 *
 * Batasan dompdf yang menentukan bentuk kode di sini:
 *
 * - flexbox, grid, dan box-sizing tidak didukung, jadi tata letak memakai
 *   posisi absolut dalam milimeter, sama seperti renderer PDF eksternal;
 * - anak di dalam elemen berposisi absolut diabaikan, jadi setiap medan
 *   ditulis sebagai satu div yang memuat sekaligus posisi kotak dan gaya
 *   teksnya;
 * - halaman harus memiliki tinggi tetap agar anak yang diposisikan absolut
 *   punya acuan yang benar;
 * - gambar dimuat sebagai data URI karena akses berkas jarak jauh dimatikan;
 * - tidak ada API pemotongan teks, jadi ukuran huruf dihitung lebih dulu lewat
 *   LebarHuruf yang memakai metrik dompdf sendiri.
 *
 * Kontrak posisi yang dipakai di sini harus sama persis dengan pratinjau di
 * desainer, karena keduanya memakai CSS yang sama dalam milimeter.
 */
class PerenderHtml extends PencetakMedan
{
    private const MM_PER_PT = 25.4 / 72;

    private LebarHuruf $lebar;

    public function hasil(): string
    {
        $jumlahHalaman = max(1, (int) $this->template->jumlah_halaman);
        $ukuran = $this->template->ukuranHalaman(1);
        $medan = DefinisiMedan::normalisasi($this->template->definisi ?? [], $jumlahHalaman);

        $html = $this->dokumen($medan['medan'], $jumlahHalaman, $ukuran);

        $dompdf = new Dompdf($this->opsiDompdf());
        $dompdf->loadHtml($html);
        $dompdf->render();

        return $dompdf->output();
    }

    /** @return array<string, mixed> */
    private function opsiDompdf(): array
    {
        return [
            'isRemoteEnabled' => false,
            'isHtml5ParserEnabled' => true,
            'isPhpEnabled' => false,
            'defaultFont' => "'DejaVu Sans', sans-serif",
            'defaultPaperSize' => 'a4',
            'defaultFontSize' => 10,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $medan
     * @param  array{lebar_mm: float, tinggi_mm: float}  $ukuran
     */
    private function dokumen(array $medan, int $jumlahHalaman, array $ukuran): string
    {
        $lebar = $this->mm($ukuran['lebar_mm']);
        $tinggi = $this->mm($ukuran['tinggi_mm']);

        $gaya = <<<CSS
            @page { size: {$lebar} {$tinggi}; margin: 0; }
            * { margin: 0; padding: 0; }
            body { font-family: "DejaVu Sans", sans-serif; -webkit-print-color-adjust: exact; }
            .halaman { position: relative; width: {$lebar}; height: {$tinggi}; background: #fff; }
            .halaman:last-child { page-break-after: auto; }
            .medan { position: absolute; }
            .medan img { position: absolute; top: 0; left: 0; }
        CSS;

        $isiHalaman = '';

        for ($nomor = 1; $nomor <= $jumlahHalaman; $nomor++) {
            $isi = '';

            foreach ($medan as $satu) {
                if ((int) ($satu['halaman'] ?? 1) === $nomor) {
                    $isi .= $this->medan($satu, $nomor, $jumlahHalaman);
                }
            }

            $isiHalaman .= '<div class="halaman">'.$isi.'</div>';
        }

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'.$gaya.'</style></head><body>'
            .$isiHalaman.'</body></html>';
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    private function medan(array $medan, int $nomor, int $jumlahHalaman): string
    {
        return match ($medan['tipe']) {
            'tanda_tangan' => '',
            'garis' => $this->medanGaris($medan),
            'kotak' => $this->medanKotak($medan),
            'gambar' => $this->medanGambar($medan),
            'centang' => $this->medanCentang($medan),
            'halaman_otomatis' => $this->medanTeks(
                $medan,
                str_replace(['{halaman}', '{jumlah}'], [(string) $nomor, (string) $jumlahHalaman], (string) $medan['format']),
            ),
            'paragraf' => $this->medanTeks($medan, $this->teks($medan), bungkus: true),
            'baris_berulang' => $this->medanBarisBerulang($medan),
            default => $this->medanTeks($medan, $this->teks($medan)),
        };
    }

    /**
     * Garis horizontal. Panjang memakai lebar kotak dan Tebal memakai
     * tingginya, jadi keduanya(mm) punya arti yang sama seperti di desainer.
     *
     * @param  array<string, mixed>  $medan
     */
    private function medanGaris(array $medan): string
    {
        $tebal = max(0.1, (float) $medan['gaya']['tebal_mm']);
        $gaya = 'position:absolute;'
            .'left:'.$this->mm((float) $medan['x']).';'
            .'top:'.$this->mm((float) $medan['y']).';'
            .'width:'.$this->mm((float) $medan['w']).';'
            .'height:0;'
            .'border-top:'.$this->mm($tebal).' solid '.$medan['gaya']['warna'].';';

        return '<div style="'.$gaya.'"></div>';
    }

    /**
     * Kotak berborder, boleh berlatar. Dipakai untuk judul seksi berlatar dan
     * pembatas kolom.
     *
     * @param  array<string, mixed>  $medan
     */
    private function medanKotak(array $medan): string
    {
        $gaya = $medan['gaya'];
        $tebal = max(0.1, (float) $gaya['tebal_mm']);
        $isi = $gaya['isi'] ?? null;

        // dompdf memakai content-box, jadi ukuran yang dideklarasikan ditambah
        // lebar border. Pendekaran dilakukan di sini supaya ukuran luar kotak
        // tetap sama dengan kotak medan di desainer, tanpa bergantung pada
        // box-sizing yang tidak didukung.
        $gayaKotak = 'position:absolute;'
            .'left:'.$this->mm((float) $medan['x']).';'
            .'top:'.$this->mm((float) $medan['y']).';'
            .'width:'.$this->mm((float) $medan['w'] - 2 * $tebal).';'
            .'height:'.$this->mm((float) $medan['h'] - 2 * $tebal).';'
            .'overflow:hidden;';

        return '<div style="'
            .$gayaKotak
            .'border:'.$this->mm($tebal).' solid '.$gaya['warna'].';'
            .($isi !== null ? 'background-color:'.$isi.';' : '')
            .'"></div>';
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    private function medanTeks(array $medan, string $teks, bool $bungkus = false): string
    {
        if (trim($teks) === '') {
            return '';
        }

        $gaya = $medan['gaya'];
        $lebar = (float) $medan['w'];
        $tinggi = (float) $medan['h'];
        $ukuran = (float) $gaya['ukuran'];
        $font = $this->fontCss($gaya);
        $spasi = (float) $gaya['spasi'];

        if ($gaya['skala_otomatis']) {
            $ukuran = $this->lebarHuruf()->ukuranMuat(
                $teks,
                $lebar,
                $tinggi,
                $ukuran,
                (float) $gaya['huruf_min'],
                $font,
                $spasi,
                (float) $gaya['baris'],
                $bungkus,
            );
        }

        $gayaTeks = $this->gayaTeks($gaya, $ukuran, $font, $spasi);

        if ($bungkus) {
            // Paragraf menempel ke atas kotak; tinggi baris dikunci supaya
            // jumlah baris yang sudah dihitung oleh LebarHuruf sama dengan
            // yang benar-benar dirender.
            $gayaTeks['line-height'] = $this->mm($ukuran * (float) $gaya['baris']);
            $gayaTeks['white-space'] = 'normal';
            $gayaTeks['word-wrap'] = 'break-word';
        } else {
            // Satu baris: line-height sama dengan tinggi kotak membuat teks duduk di
            // tengah vertikal, persis seperti sel TCPDF dengan valign tengah.
            $gayaTeks['line-height'] = $this->mm($tinggi);
            $teks = $this->lebarHuruf()->satuBaris($teks, $lebar, $ukuran, $font, $spasi);
        }

        return '<div class="medan" style="'.$this->gayaKotak($medan).$this->gayaInline($gayaTeks).'">'
            .$this->sel($teks).'</div>';
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    private function medanCentang(array $medan): string
    {
        $nilai = $this->nilaiMedan($medan);
        $sama = $nilai !== null && (string) $nilai === (string) ($medan['bawa'] ?? '');
        $huruf = $sama ? (string) $medan['huruf'] : (string) $medan['huruf_kosong'];

        if ($huruf === '') {
            return '';
        }

        $gaya = $medan['gaya'];
        $gayaTeks = $this->gayaTeks($gaya, (float) $gaya['ukuran'], $this->fontCss($gaya), (float) $gaya['spasi']);
        $gayaTeks['line-height'] = $this->mm((float) $medan['h']);

        return '<div class="medan" style="'.$this->gayaKotak($medan).$this->gayaInline($gayaTeks).'">'
            .$this->sel($huruf).'</div>';
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    private function medanGambar(array $medan): string
    {
        $jalur = $this->jalurGambarMedan($medan);

        if ($jalur === null) {
            return '';
        }

        $isi = is_file($jalur) ? @file_get_contents($jalur) : false;

        if ($isi === false) {
            return '';
        }

        $sumber = 'data:'.($this->mime($jalur)).';base64,'.base64_encode($isi);
        $mode = (string) ($medan['sizemode'] ?? 'sesuaikan');

        $gambar = $mode === 'asli'
            ? '<img src="'.$sumber.'">'
            : '<img src="'.$sumber.'" style="width: 100%; height: 100%; object-fit: '.($mode === 'potong' ? 'cover' : 'contain').';">';

        return '<div class="medan" style="'.$this->gayaKotak($medan).'">'.$gambar.'</div>';
    }

    /**
     * Satu medan baris berulang: N baris ke bawah, tiap baris punya M kolom
     * yang masing-masing punya posisi dan lebar sendiri di dalam kotak.
     * Geometrinya sama persis dengan renderer PDF eksternal.
     *
     * @param  array<string, mixed>  $medan
     */
    private function medanBarisBerulang(array $medan): string
    {
        $bagian = $medan['baris_berulang'];
        $koleksiKunci = (string) ($bagian['sumber'] ?? '');

        if ($koleksiKunci === '') {
            return '';
        }

        $baris = $this->pengisi->koleksi($koleksiKunci, $this->konteks->idSantri);
        $jumlahSlot = min((int) $bagian['jumlah'], count($baris));
        $tinggiBaris = (float) $bagian['tinggi_baris'];
        $isi = '';

        for ($i = 0; $i < $jumlahSlot; $i++) {
            foreach ($bagian['kolom'] as $kolom) {
                $teks = $this->teksKolom($kolom, $baris[$i], $i + 1);

                if ($teks === '') {
                    continue;
                }

                $gaya = $kolom['gaya'];
                $ukuran = (float) $gaya['ukuran'];
                $font = $this->fontCss($gaya);
                $spasi = (float) $gaya['spasi'];

                if ($gaya['skala_otomatis']) {
                    $ukuran = $this->lebarHuruf()->ukuranMuat(
                        $teks,
                        (float) $kolom['w'],
                        $tinggiBaris,
                        $ukuran,
                        (float) $gaya['huruf_min'],
                        $font,
                        $spasi,
                        (float) $gaya['baris'],
                    );
                }

                $gayaTeks = $this->gayaTeks($gaya, $ukuran, $font, $spasi);
                $gayaTeks['line-height'] = $this->mm($tinggiBaris);

                // Sel berada langsung di dalam halaman, jadi koordinatnya
                // dihitung absolut dari titik awal medan. Kolom memakai x
                // relatif terhadap kotak medan, bukan terhadap halaman.
                $kotak = 'position:absolute;'
                    .'left:'.$this->mm((float) $medan['x'] + (float) $kolom['x']).';'
                    .'top:'.$this->mm((float) $medan['y'] + $i * $tinggiBaris).';'
                    .'width:'.$this->mm((float) $kolom['w']).';'
                    .'height:'.$this->mm($tinggiBaris).';'
                    .'overflow:hidden;';

                $isi .= '<div class="medan" style="'.$kotak.$this->gayaInline($gayaTeks).'">'
                    .$this->sel($teks).'</div>';
            }
        }

        return $isi;
    }

    /** @param array<string, mixed> $gaya */
    private function gayaTeks(array $gaya, float $ukuran, string $font, float $spasi): array
    {
        return [
            'font-family' => $font,
            'font-size' => rtrim(rtrim(number_format($ukuran, 2, '.', ''), '0'), '.').'pt',
            'color' => (string) $gaya['warna'],
            'text-align' => match ((string) $gaya['rata']) {
                'tengah' => 'center',
                'kanan' => 'right',
                default => 'left',
            },
            'white-space' => 'nowrap',
        ] + ($spasi > 0.0 ? ['letter-spacing' => $this->mm($spasi)] : []);
    }

    /** @param array<string, mixed> $medan */
    private function gayaKotak(array $medan): string
    {
        return 'left:'.$this->mm((float) $medan['x']).';'
            .'top:'.$this->mm((float) $medan['y']).';'
            .'width:'.$this->mm((float) $medan['w']).';'
            .'height:'.$this->mm((float) $medan['h']).';'
            .'overflow:hidden;';
    }

    /** @param array<string, string> $gaya */
    private function gayaInline(array $gaya): string
    {
        $bagian = [];

        foreach ($gaya as $nama => $nilai) {
            $bagian[] = $nama.':'.$nilai;
        }

        return implode(';', $bagian);
    }

    private function sel(string $teks): string
    {
        return htmlspecialchars($teks, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function mm(float $nilai): string
    {
        return rtrim(rtrim(number_format($nilai, 3, '.', ''), '0'), '.').'mm';
    }

    private function mime(string $jalur): string
    {
        return match (strtolower(pathinfo($jalur, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'image/jpeg',
        };
    }

    private function lebarHuruf(): LebarHuruf
    {
        return $this->lebar ??= new LebarHuruf(
            (new Dompdf($this->opsiDompdf()))->getFontMetrics()
        );
    }
}
