<?php

namespace Tests\Feature;

use App\Support\HtmlInfo;
use Tests\TestCase;

/**
 * Allowlist ketat `App\Support\HtmlInfo`.
 *
 * Ini penjaga Last Line untuk HTML yang originated dari editor di browser lalu
 * dirender di bilah judul setiap tabel. Fokus tes: vektor yang kalau lolos
 * berarti eksekusi skrip milik super_admin di sesi setiap pengguna — bukan
 * kerapian markup.
 */
class HtmlInfoBersihkanTest extends TestCase
{
    // ---------------------------------------------------------------- bayangan

    public function test_script_dibuang(): void
    {
        $hasil = HtmlInfo::bersihkan('<p>halo</p><script>alert(1)</script>');

        $this->assertSame('<p>halo</p>', $hasil);
    }

    public function test_atribut_peristiwa_dibuang(): void
    {
        $hasil = HtmlInfo::bersihkan('<img src="https://x.test/a.png" onerror="alert(1)">');

        $this->assertStringNotContainsString('onerror', (string) $hasil);
        $this->assertStringContainsString('src="https://x.test/a.png"', (string) $hasil);
    }

    /** Varian huruf besar & whitespace tersembunyi — `java\nscript:`. */
    public function test_skema_berbahaya_ditolak_variannya(): void
    {
        foreach ([
            '<a href="javascript:alert(1)">x</a>',
            '<a href="JaVaScRiPt:alert(1)">x</a>',
            "<a href=\"java\tscript:alert(1)\">x</a>",
            '<a href="  javascript:alert(1)">x</a>',
            '<a href="data:text/html,<script>alert(1)</script>">x</a>',
            '<a href="vbscript:msgbox(1)">x</a>',
        ] as $html) {
            $hasil = (string) HtmlInfo::bersihkan($html);
            $this->assertStringNotContainsString('href', $hasil, $html);
        }
    }

    public function test_tag_dan_atribut_di_luar_daftar_dibuang(): void
    {
        $hasil = (string) HtmlInfo::bersihkan(
            '<p style="position:fixed" class="x" id="y" onclick="alert(1)">teks</p>'
        );

        $this->assertSame('<p>teks</p>', $hasil);
    }

    /** Elemen berbahaya beserta seluruh subtree-nya hilang. */
    public function test_elemen_berbahaya_beserta_isinya_hilang(): void
    {
        foreach ([
            '<iframe src="https://evil.test"></iframe>',
            '<form action="/hapus"><input name="a"></form>',
            '<object data="x.swf"></object>',
            '<embed src="x.swf">',
            '<svg onload="alert(1)"></svg>',
            '<style>body{display:none}</style>',
            '<base href="https://evil.test/">',
            '<meta http-equiv="refresh" content="0;url=https://evil.test">',
            '<link rel="stylesheet" href="https://evil.test/x.css">',
            '<video><source src="x.mp4"></video>',
            '<details open ontoggle="alert(1)">x</details>',
        ] as $html) {
            $this->assertNull(HtmlInfo::bersihkan($html), $html);
        }
    }

    /** SVG sebagai data URI ditolak: `img` + svg bisa membawa skrip. */
    public function test_gambar_svg_ditolak(): void
    {
        $hasil = (string) HtmlInfo::bersihkan('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">');

        $this->assertStringNotContainsString('src', $hasil);
    }

    /** `data:image/png,<svg onload>` salah tipe → src dibuang. */
    public function test_data_uri_bukan_base64_ditolak(): void
    {
        $hasil = (string) HtmlInfo::bersihkan('<img src="data:image/png,<svg onload=alert(1)>">');

        $this->assertStringNotContainsString('src', $hasil);
    }

    /** Tautan ke tab baru selalu dapat `rel` penutup. */
    public function test_tautan_ke_tab_baru_dilindungi(): void
    {
        $hasil = (string) HtmlInfo::bersihkan('<a href="https://x.test" target="_blank">x</a>');

        $this->assertStringContainsString('rel="noopener noreferrer nofollow"', $hasil);
    }

    // ------------------------------------------------------------------ boleh

    public function test_format_dasar_utuh(): void
    {
        $html = '<h2>Judul</h2><p><strong>Tebal</strong> <em>miring</em> '
            .'<u>garis bawah</u></p><ul><li>satu</li><li>dua</li></ul><blockquote>kutip</blockquote>';
        $hasil = (string) HtmlInfo::bersihkan($html);

        foreach (['<h2>Judul</h2>', '<strong>Tebal</strong>', '<em>miring</em>', '<li>dua</li>', '<blockquote>kutip</blockquote>'] as $potongan) {
            $this->assertStringContainsString($potongan, $hasil);
        }
    }

    public function test_gambar_base64_tetap_utuh(): void
    {
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
        $hasil = (string) HtmlInfo::bersihkan('<img src="'.$png.'" alt="Denah" width="800" height="600">');

        $this->assertStringContainsString('src="'.$png.'"', $hasil);
        $this->assertStringContainsString('alt="Denah"', $hasil);
        $this->assertStringContainsString('width="800"', $hasil);
    }

    /** `&` dan `<` di teks harus bertahan sebagai teks, tak jadi markup. */
    public function test_tanda_baca_di_teks_tetap_teks(): void
    {
        $hasil = (string) HtmlInfo::bersihkan('<p>Usia 5 &lt; 10 tahun, T &amp; S</p>');

        $this->assertSame('<p>Usia 5 &lt; 10 tahun, T &amp; S</p>', $hasil);
    }

    /** Parser libxml membuang teks setelah `<` yang tak memulai tag; ini
     *  meregression-nya, karena hasilnya hilangnya isi paragraf. */
    public function test_lt_tak_mulai_tag_tetap_teks(): void
    {
        $hasil = (string) HtmlInfo::bersihkan('<p>5 < 10 dan 20 < 30</p>');

        $this->assertSame('<p>5 &lt; 10 dan 20 &lt; 30</p>', $hasil);
    }

    // ----------------------------------------------------------------- kosong

    public function test_kosong_jadi_null(): void
    {
        $this->assertNull(HtmlInfo::bersihkan(null));
        $this->assertNull(HtmlInfo::bersihkan(''));
        $this->assertNull(HtmlInfo::bersihkan("  \n "));
        $this->assertNull(HtmlInfo::bersihkan('<p></p>'));
        $this->assertNull(HtmlInfo::bersihkan('<script>alert(1)</script>'));
    }

    public function test_ada_isi_mengenai_null_dan_kosong(): void
    {
        $this->assertFalse(HtmlInfo::adaIsi(null));
        $this->assertFalse(HtmlInfo::adaIsi(''));
        $this->assertTrue(HtmlInfo::adaIsi('<p>x</p>'));
    }

    // ------------------------------------------------------------------ batas

    /** Potong di batas tag, bukan di tengah `data:` — hasil jadi rusak. */
    public function test_potong_di_batas_tag_bukan_di_tengah_atribut(): void
    {
        $gambar = '<img src="data:image/png;base64,'.str_repeat('A', 3000).'">';
        $hasil = HtmlInfo::potongBatas($gambar, 200);

        $this->assertLessThanOrEqual(200, mb_strlen($hasil));
        // `<img` menggantung tanpa `>` = src-nya sudah terpotong = rusak.
        $this->assertStringNotContainsString('<img', $hasil);
    }
}
