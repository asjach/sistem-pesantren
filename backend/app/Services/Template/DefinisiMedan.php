<?php

namespace App\Services\Template;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Bentuk, normalisasi, dan validasi daftar medan pada template.
 *
 * Satu sumber kebenaran untuk bentuk JSON `definisi.medan`. Dipakai oleh
 * FormRequest (menolak yang tidak valid) sekaligus PdfIsian (mengisi nilai
 * bawaan), sehingga editor dan printer tidak bisa berbeda paham.
 *
 * Semua koordinat dan ukuran memakai millimeter, satuan yang sama dengan
 * yang dipakai TCPDF dan yang dibaca FPDI dari berkas PDF.
 */
class DefinisiMedan
{
    /** Cara medan digambar di atas halaman PDF. */
    public const TIPE = ['teks', 'paragraf', 'gambar', 'centang', 'tanda_tangan', 'baris_berulang', 'halaman_otomatis'];

    /** Tipe yang butuh posisi, ukuran, dan gaya teks. */
    public const TIPE_BERPOSISI = ['teks', 'paragraf', 'centang', 'halaman_otomatis'];

    /** Tipe yang hanya menandai tempat, tidak mencetak apa pun. */
    public const TIPE_TANDA = ['tanda_tangan'];

    public const RATA = ['kiri', 'tengah', 'kanan'];

    public const SIZEMODE = ['sesuaikan', 'potong', 'asli'];

    public const SUMBER_GAMBAR = ['santri', 'pegawai', 'lembaga', 'aset'];

    /**
     * Keluarga font yang tersedia di TCPDF. Helvetica/Times/Courier bawaan
     * PDF (Latin-1, memuat e dengan diaeresis dan u dengan diaeresis),
     * DejaVu Sans untuk karakter di luar itu.
     */
    public const FONT = ['helvetica', 'times', 'courier', 'dejavusans'];

    public const BATAS_MEDAN = 60;

    public const BATAS_BARIS = 200;

    public const BATAS_KOLOM = 12;

    /**
     * Normalisasi seluruh definisi: isi nilai bawaan yang tidak dikirim editor
     * dan buang medan yang tidak dikenal tipenya.
     *
     * @param  array<string, mixed>  $data
     * @return array{versi: int, medan: list<array<string, mixed>>}
     */
    public static function normalisasi(array $data, int $jumlahHalaman): array
    {
        $medan = [];

        foreach (self::daftarMedan($data) as $index => $mentah) {
            if (! is_array($mentah)) {
                continue;
            }

            $tipe = (string) ($mentah['tipe'] ?? 'teks');

            if (! in_array($tipe, self::TIPE, true)) {
                continue;
            }

            $medan[] = self::satu($mentah, $index, $jumlahHalaman);
        }

        return [
            'versi' => 1,
            'medan' => array_slice($medan, 0, self::BATAS_MEDAN),
        ];
    }

    /**
     * Normalisasi satu medan. Mengembalikan bentuk kanonik lengkap dengan
     * nilai bawaan, sehingga renderer tidak perlu menebak.
     *
     * @param  array<string, mixed>  $mentah
     * @return array<string, mixed>
     */
    public static function satu(array $mentah, int $index, int $jumlahHalaman): array
    {
        $tipe = (string) ($mentah['tipe'] ?? 'teks');

        $medan = [
            'id' => (string) ($mentah['id'] ?? 'm'.($index + 1)),
            'label' => trim((string) ($mentah['label'] ?? 'Medan '.($index + 1))),
            'tipe' => $tipe,
            'halaman' => self::batasHalaman($mentah['halaman'] ?? 1, $jumlahHalaman),
            'x' => self::nomor($mentah['x'] ?? 0, 0, 2000),
            'y' => self::nomor($mentah['y'] ?? 0, 0, 2000),
            'w' => self::nomor($mentah['w'] ?? 40, 1, 2000),
            'h' => self::nomor($mentah['h'] ?? 6, 1, 2000),
            'sumber' => self::teks($mentah['sumber'] ?? null, 40),
            'kunci' => self::teks($mentah['kunci'] ?? null, 60),
            'gaya' => self::gaya($mentah['gaya'] ?? []),
        ];

        if ($tipe === 'centang') {
            $medan['bawa'] = self::teks($mentah['bawa'] ?? null, 60);
            $medan['huruf'] = self::teks($mentah['huruf'] ?? null, 8) ?? '✓';
            $medan['huruf_kosong'] = self::teks($mentah['huruf_kosong'] ?? null, 8) ?? '';
        }

        if ($tipe === 'gambar') {
            $medan['sizemode'] = in_array($mentah['sizemode'] ?? '', self::SIZEMODE, true) ? $mentah['sizemode'] : 'sesuaikan';
        }

        if ($tipe === 'halaman_otomatis') {
            $medan['format'] = self::teks($mentah['format'] ?? null, 80) ?? 'Halaman {halaman} dari {jumlah}';
        }

        if ($tipe === 'baris_berulang') {
            $medan['baris_berulang'] = self::bagianBarisBerulang($mentah);
        }

        return $medan;
    }

    /**
     * @param  array<string, mixed>  $mentah
     * @return array{sumber: ?string, jumlah: int, tinggi_baris: float, kolom: list<array<string, mixed>>}
     */
    private static function bagianBarisBerulang(array $mentah): array
    {
        $bagian = is_array($mentah['baris_berulang'] ?? null) ? $mentah['baris_berulang'] : [];
        $jumlah = (int) ($bagian['jumlah'] ?? 10);
        $tinggi = self::nomor($bagian['tinggi_baris'] ?? 8, 2, 200);

        $kolom = [];

        foreach (self::daftar($bagian['kolom'] ?? []) as $i => $kolomMentah) {
            if (! is_array($kolomMentah) || count($kolom) >= self::BATAS_KOLOM) {
                continue;
            }

            $kolom[] = [
                'label' => trim((string) ($kolomMentah['label'] ?? 'Kolom '.($i + 1))),
                'x' => self::nomor($kolomMentah['x'] ?? 0, 0, 2000),
                'w' => self::nomor($kolomMentah['w'] ?? 20, 1, 2000),
                'sumber' => self::teks($kolomMentah['sumber'] ?? null, 40),
                'kunci' => self::teks($kolomMentah['kunci'] ?? null, 60),
                'gaya' => self::gaya($kolomMentah['gaya'] ?? []),
            ];
        }

        return [
            'sumber' => self::teks($bagian['sumber'] ?? null, 40),
            'jumlah' => max(1, min($jumlah, self::BATAS_BARIS)),
            'tinggi_baris' => $tinggi,
            'kolom' => $kolom,
        ];
    }

    /**
     * @param  array<string, mixed>|mixed  $mentah
     * @return array<string, mixed>
     */
    private static function gaya(mixed $mentah): array
    {
        $g = is_array($mentah) ? $mentah : [];

        return [
            'font' => in_array($g['font'] ?? '', self::FONT, true) ? $g['font'] : 'helvetica',
            'tebal' => (bool) ($g['tebal'] ?? false),
            'miring' => (bool) ($g['miring'] ?? false),
            'ukuran' => self::nomor($g['ukuran'] ?? 11, 4, 72),
            'warna' => self::warna($g['warna'] ?? null, '#000000'),
            'rata' => in_array($g['rata'] ?? '', self::RATA, true) ? $g['rata'] : 'kiri',
            'baris' => self::nomor($g['baris'] ?? 1.2, 0.8, 3),
            'spasi' => self::nomor($g['spasi'] ?? 0, -2, 5),
            'huruf_besar' => (bool) ($g['huruf_besar'] ?? false),
            // Skala otomatis mengecilkan huruf bila teks meluber dari kotak.
            'skala_otomatis' => (bool) ($g['skala_otomatis'] ?? true),
            'huruf_min' => self::nomor($g['huruf_min'] ?? 6, 4, 72),
        ];
    }

    /**
     * Validasi bentuk yang dikirim editor. Melempar ValidationException agar
     * pesan sampai ke pengguna dalam bahasa Indonesia.
     *
     * @param  array<string, mixed>  $data
     */
    public static function validasi(array $data, int $jumlahHalaman): void
    {
        // Akar validasi disamakan dengan `definisi` supaya kunci error
        // (`definisi.medan.0.halaman`) sejajar dengan aturan FormRequest.
        $validator = Validator::make(['definisi' => $data], [
            'definisi.medan' => ['array', 'max:'.self::BATAS_MEDAN],
            'definisi.medan.*.tipe' => ['required', 'string', 'in:'.implode(',', self::TIPE)],
            'definisi.medan.*.label' => ['required', 'string', 'max:120'],
            'definisi.medan.*.halaman' => ['required', 'integer', 'min:1', 'max:'.max(1, $jumlahHalaman)],
            'definisi.medan.*.x' => ['required', 'numeric', 'min:0', 'max:2000'],
            'definisi.medan.*.y' => ['required', 'numeric', 'min:0', 'max:2000'],
            'definisi.medan.*.w' => ['required', 'numeric', 'min:1', 'max:2000'],
            'definisi.medan.*.h' => ['required', 'numeric', 'min:1', 'max:2000'],
            'definisi.medan.*.sumber' => ['nullable', 'string', 'max:40'],
            'definisi.medan.*.kunci' => ['nullable', 'string', 'max:60'],
            'definisi.medan.*.gaya.font' => ['nullable', 'string', 'in:'.implode(',', self::FONT)],
            'definisi.medan.*.gaya.ukuran' => ['nullable', 'numeric', 'min:4', 'max:72'],
            'definisi.medan.*.gaya.rata' => ['nullable', 'string', 'in:'.implode(',', self::RATA)],
            'definisi.medan.*.gaya.warna' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'definisi.medan.*.baris_berulang.sumber' => ['nullable', 'string', 'max:40'],
            'definisi.medan.*.baris_berulang.jumlah' => ['nullable', 'integer', 'min:1', 'max:'.self::BATAS_BARIS],
            'definisi.medan.*.baris_berulang.tinggi_baris' => ['nullable', 'numeric', 'min:2', 'max:200'],
            'definisi.medan.*.baris_berulang.kolom' => ['array', 'max:'.self::BATAS_KOLOM],
            'definisi.medan.*.baris_berulang.kolom.*.w' => ['required', 'numeric', 'min:1', 'max:2000'],
        ], [
            'definisi.medan.*.tipe.in' => 'Tipe medan ":attribute" tidak dikenal.',
            'definisi.medan.*.halaman.max' => 'Medan menunjuk halaman :input, padahal berkas hanya punya :max halaman.',
            'definisi.medan.*.gaya.warna.regex' => 'Warna medan harus berupa hex enam digit, contoh #1a2b3c.',
            'definisi.medan.*.gaya.font.in' => 'Font ":input" tidak tersedia untuk pencetakan PDF.',
        ]);

        $validator->validate();

        // Validasi silang: setiap kolom baris_berulang wajib menunjuk sumber.
        foreach ($data['medan'] ?? [] as $i => $medan) {
            if (($medan['tipe'] ?? '') !== 'baris_berulang') {
                continue;
            }

            $baris = $medan['baris_berulang'] ?? [];

            if (empty($baris['sumber']) || ! KatalogNilai::dikenal((string) $baris['sumber'])) {
                throw ValidationException::withMessages([
                    "definisi.medan.{$i}.baris_berulang.sOURCE" => 'Pilih koleksi baris yang dikenal untuk medan baris berulang.',
                ]);
            }

            if (($baris['kolom'] ?? []) === []) {
                throw ValidationException::withMessages([
                    "definisi.medan.{$i}.baris_berulang.kolom" => 'Medan baris berulang minimal punya satu kolom.',
                ]);
            }
        }
    }

    /**
     * Medan yang benar-benar butuh sumber nilai. `tanda_tangan` tidak butuh
     * karena memang tidak mencetak apa pun.
     *
     * @param  array<string, mixed>  $medan
     */
    public static function butuhNilai(array $medan): bool
    {
        return ! in_array($medan['tipe'] ?? '', self::TIPE_TANDA, true);
    }

    /** @return list<mixed> */
    private static function daftarMedan(array $data): array
    {
        $medan = $data['medan'] ?? $data;

        return is_array($medan) ? array_values($medan) : [];
    }

    /** @return list<mixed> */
    private static function daftar(mixed $isi): array
    {
        return is_array($isi) ? array_values($isi) : [];
    }

    private static function batasHalaman(mixed $nilai, int $jumlahHalaman): int
    {
        $halaman = (int) $nilai;

        return max(1, min($halaman, max(1, $jumlahHalaman)));
    }

    private static function nomor(mixed $nilai, float $min, float $max): float
    {
        $angka = is_numeric($nilai) ? (float) $nilai : $min;

        return round(max($min, min($angka, $max)), 2);
    }

    private static function teks(mixed $nilai, int $maks): ?string
    {
        if ($nilai === null) {
            return null;
        }

        $teks = trim((string) $nilai);

        return $teks === '' ? null : mb_substr($teks, 0, $maks);
    }

    private static function warna(mixed $nilai, string $bawaan): string
    {
        $teks = is_string($nilai) ? trim($nilai) : '';

        return preg_match('/^#[0-9a-fA-F]{6}$/', $teks) === 1 ? strtolower($teks) : $bawaan;
    }
}
