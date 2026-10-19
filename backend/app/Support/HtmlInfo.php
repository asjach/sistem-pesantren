<?php

namespace App\Support;

/**
 * Sanitasi HTML "info tabel" (isi HoverCard di akhir judul tabel).
 *
 * Isi info ditulis super_admin lewat editor di tab Info Kelola Tabel, lalu
 * dibaca SEMUA pengguna (termasuk yang tak bisa menulis) dan dirender sebagai
 * HTML di bilah judul tiap tabel. Jadi HTML dari database tak boleh dipercaya
 * apa adanya: tanpa sanitasi di sini, satu teks `<img onerror=…>` yang
 * tersimpan akan dieksekusi di setiap tabel yang dibuka setiap pengguna.
 *
 * Pendekatan: **allowlist ketat**, bukan memblokir daftar yang berbahaya. Tag
 * dan atribut di luar daftar dibuang total (bukan sekadar dinonaktifkan), jadi
 * markup yang belum pernah dikenal pun tetap aman secara bawaan. Keluaran
 * `saveHTML` dipakai apa adanya: teks tetap ter-escape (`&lt;`, `&amp;`),
 * sehingga yang disimpan sah sebagai HTML dan tak bisa berubah jadi markup
 * saat dibaca peramban.
 *
 * Yang dibolehkan sengaja dibuat sempit: paragraf, heading, tebal/miring,
 * daftar, kutipan, kode, tautan, dan gambar. Tanpa `style`, `class`, `id`,
 * tanpa seluruh `on*`, tanpa `<script>`, `<iframe>`, dan `<form>`.
 *
 * Batas lain yang ditegakkan di sini:
 *  - panjang hasil (gambar tersandi base64 adalah penyumbang ukuran terbesar),
 *  - skema URL: `a` hanya http/https/mailto (tak ada `javascript:`/`data:`),
 *  - `img` hanya data:image/* yang dikenali atau http/https — SVG sengaja
 *    ditolak karena bisa membawa skrip.
 */
final class HtmlInfo
{
    /** Panjang maksimum HTML info tersimpan (karakter). */
    public const PANJANG_MAKS = 1500000;

    /** Tag yang boleh lewat. `b`/`i` ikut karena editor bisa menghasilkan
     *  keduanya (tebal/miring bawaan peramban) dan keduanya tak berbahaya. */
    private const TAG_BOLEH = [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'h1', 'h2', 'h3', 'h4',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'a', 'img',
        'div', 'span', 'hr',
    ];

    /** Atribut yang boleh per tag. Atribut lain — termasuk seluruh `on*`,
     *  `style`, `class`, `id` — dibuang. */
    private const ATRIBUT_BOLEH = [
        'a' => ['href', 'target', 'rel'],
        'img' => ['src', 'alt', 'width', 'height'],
    ];

    /** Skema `href` yang boleh (sudah dinormalisasi huruf kecil). */
    private const SKEMA_HREF = ['http', 'https', 'mailto'];

    /** Tipe `data:` yang boleh untuk `img` (huruf kecil). */
    private const TIPE_GAMBAR = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

    /** Karakter yang tak boleh muncul di teks polos (tag tak bisa di-parse dari sana). */
    private const POLA_BUANG_NYAWA = '/[<>&\x00-\x08\x0B\x0C\x0E-\x1F]/';

    /**
     * Bersihkan HTML info. String kosong/berisi spasi saja -> `null` ("belum
     * diisi"), bukan string kosong, supaya kolom tetap `NULL` dan tak
     * berbeda dari default halaman yang memeriksa null.
     */
    public static function bersihkan(?string $html): ?string
    {
        if ($html === null) {
            return null;
        }
        $html = trim($html);
        if ($html === '') {
            return null;
        }

        $hasil = trim(self::susun($html));

        return self::adaIsi($hasil) ? self::potongBatas($hasil, self::PANJANG_MAKS) : null;
    }

    /**
     * True bila HTML punya ISI yang bisa dilihat: teks, atau sekurang-kurangnya
     * satu gambar. `<p></p>` atau `<div><span></span></div>` tidak termasuk —
     * mengembalikannya sebagai "terisi" membuat tombol Info muncul dengan kartu
     * hover yang hampa.
     */
    public static function adaIsi(?string $html): bool
    {
        if ($html === null || trim($html) === '') {
            return false;
        }
        if (stripos($html, '<img') !== false) {
            return true;
        }

        return trim(strip_tags($html)) !== '';
    }

    /**
     * Potong HTML pada batas tag TERAKHIR yang utuh dalam anggaran, bukan di
     * tengah atribut. Memotong `data:` jadi data URI tak lengkap menghasilkan
     * `<img src="data:…">` yang nanti tampil rusak.
     */
    public static function potongBatas(string $html, int $batas): string
    {
        if (mb_strlen($html, 'UTF-8') <= $batas) {
            return $html;
        }
        $potongan = mb_substr($html, 0, $batas, 'UTF-8');
        $akhir = mb_strrpos($potongan, '>', 0, 'UTF-8');
        if ($akhir === false) {
            return '';
        }

        return trim(mb_substr($potongan, 0, $akhir + 1, 'UTF-8'));
    }

    /**
     * `<` yang tak memulai tag (mis. "5 < 10") dibuang parser libxml sampai
     * tag berikutnya, termasuk tag penutupnya — teks pengguna hilang diam-diam
     * (`<p>5 < 10</p>` jadi `<p>5 </p>`). Escaped lebih dulu supaya dibaca
     * sebagai teks biasa.
     */
    private static function lindungiLt(string $html): string
    {
        return preg_replace('/<(?![a-zA-Z]|\/[a-zA-Z]|[!?])/', '&lt;', $html) ?? $html;
    }

    /** Urai lalu susun ulang hanya tag/atribut yang diizinkan. */
    private static function susun(string $html): string
    {
        $doc = new \DOMDocument('1.0', 'UTF-8');
        $diamkan = libxml_use_internal_errors(true);
        $opsi = LIBXML_HTML_NOIMPLIED
            | LIBXML_HTML_NODEFDTD
            | LIBXML_NONET
            | LIBXML_NOERROR
            | LIBXML_NOWARNING;

        $doc->loadHTML('<?xml encoding="UTF-8"?><body>'.self::lindungiLt($html).'</body>', $opsi);
        libxml_clear_errors();
        libxml_use_internal_errors($diamkan);

        $body = $doc->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }

        $daftar = $doc->getElementsByTagName('*');
        $elemen = [];
        foreach ($daftar as $node) {
            if ($node instanceof \DOMElement) {
                $elemen[] = $node;
            }
        }

        foreach ($elemen as $node) {
            if (in_array($node->nodeName, self::TAG_BOLEH, true)) {
                self::bersihkanAtribut($node);
            }
        }

        foreach ($elemen as $node) {
            foreach (iterator_to_array($node->childNodes) as $anak) {
                if ($anak instanceof \DOMElement && ! in_array($anak->nodeName, self::TAG_BOLEH, true)) {
                    $node->removeChild($anak);
                }
            }
        }

        foreach ($elemen as $node) {
            if (! in_array($node->nodeName, self::TAG_BOLEH, true) && $node->parentNode !== null) {
                $node->parentNode->removeChild($node);
            }
        }

        $hasil = '';
        foreach ($body->childNodes as $child) {
            $hasil .= $doc->saveHTML($child);
        }

        return $hasil;
    }

    /** Sisakan hanya atribut yang boleh DAN nilainya aman. */
    private static function bersihkanAtribut(\DOMElement $node): void
    {
        $boleh = self::ATRIBUT_BOLEH[$node->nodeName] ?? [];
        $atribut = $node->attributes;
        if ($atribut === null) {
            return;
        }

        foreach (iterator_to_array($atribut) as $a) {
            if (! in_array($a->nodeName, $boleh, true)) {
                $node->removeAttribute($a->nodeName);

                continue;
            }
            if (! self::nilaiAman($node->nodeName, $a->nodeName, $a->nodeValue ?? '')) {
                $node->removeAttribute($a->nodeName);
            }
        }

        if ($node->nodeName !== 'a') {
            return;
        }

        $node->setAttribute('rel', 'noopener noreferrer nofollow');
        if ($node->getAttribute('target') !== '') {
            $node->setAttribute('target', '_blank');
        }
    }

    /** Skema/tipe URL yang benar-benar boleh lewat. */
    private static function nilaiAman(string $tag, string $atribut, string $nilai): bool
    {
        $nilai = trim($nilai);
        if ($nilai === '') {
            return false;
        }

        $isUrl = ($tag === 'img' && $atribut === 'src') || ($tag === 'a' && $atribut === 'href');
        if ($isUrl && preg_match('/[\x00-\x20\x7F]/', $nilai) === 1) {
            return false;
        }

        if ($tag === 'img' && $atribut === 'src') {
            if (stripos($nilai, 'data:') === 0) {
                return self::dataGambarValid($nilai);
            }

            return in_array(self::skema($nilai), ['http', 'https'], true);
        }

        if ($tag === 'a' && $atribut === 'href') {
            return in_array(self::skema($nilai), self::SKEMA_HREF, true);
        }

        if ($tag === 'img' && in_array($atribut, ['width', 'height'], true)) {
            return preg_match('/^\d{1,4}$/', $nilai) === 1;
        }

        return preg_match(self::POLA_BUANG_NYAWA, $nilai) !== 1;
    }

    /** `data:image/png;base64,…` dengan muatan yang benar-benar base64. */
    private static function dataGambarValid(string $nilai): bool
    {
        if (preg_match('#^data:([a-z0-9.+-]+/[a-z0-9.+-]+)[;,]#i', $nilai, $m) !== 1) {
            return false;
        }
        if (! in_array(strtolower($m[1]), self::TIPE_GAMBAR, true)) {
            return false;
        }

        return preg_match('#^data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$#i', $nilai) === 1;
    }

    /** Skema URL huruf kecil; string kosong bila tak ada (path relatif). */
    private static function skema(string $nilai): string
    {
        $p = strpos($nilai, ':');
        if ($p === false) {
            return '';
        }

        return strtolower(substr($nilai, 0, $p));
    }
}
