<?php

namespace Tests\Unit;

use App\Support\NamaBerkasDokumen;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class NamaBerkasDokumenTest extends TestCase
{
    #[DataProvider('slugProvider')]
    public function test_slug_aman_untuk_nama_berkas(string $masuk, string $harap): void
    {
        $this->assertSame($harap, NamaBerkasDokumen::slug($masuk));
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function slugProvider(): array
    {
        return [
            'spasi jadi underscore' => ['Ahmad Fauzi', 'ahmad_fauzi'],
            'kapital jadi kecil' => ['KARTU Keluarga', 'kartu_keluarga'],
            'garis miring dibuang' => ['a/b', 'ab'],
            'traversal hilang' => ['../../etc/passwd', 'etcpasswd'],
            'titik saja jadi kosong' => ['...', ''],
            'kosong tetap kosong' => ['', ''],
            'spasi saja jadi kosong' => ['   ', ''],
        ];
    }

    /** Hasil slug TIDAK PERNAH mengandung pemisah jalur apa pun. */
    public function test_slug_tak_pernah_mengandung_pemisah_jalur(): void
    {
        foreach (['a/b', 'a\\b', '../x', 'C:\\Windows', 'a%2Fb', 'a\0b'] as $jahat) {
            $slug = NamaBerkasDokumen::slug($jahat);
            $this->assertStringNotContainsString('/', $slug, "slug({$jahat})");
            $this->assertStringNotContainsString('\\', $slug, "slug({$jahat})");
            $this->assertStringNotContainsString('..', $slug, "slug({$jahat})");
        }
    }

    public function test_slug_dipotong_pada_batas_segmen(): void
    {
        $slug = NamaBerkasDokumen::slug(str_repeat('x', 200));
        $this->assertSame(50, strlen($slug));
    }

    public function test_buat_menyusun_segmen_dan_melewati_yang_kosong(): void
    {
        $waktu = Carbon::parse('2026-01-15 09:30:12');
        $this->assertSame(
            'ahmad_santri_kartu_keluarga_20260115_093012.pdf',
            NamaBerkasDokumen::buat('Ahmad', 'santri', 'Kartu Keluarga', 'pdf', $waktu),
        );

        $this->assertSame(
            'ahmad_santri_20260115_093012.pdf',
            NamaBerkasDokumen::buat('Ahmad', 'santri', '', 'pdf', $waktu),
        );
        $this->assertSame(
            'ahmad_santri_20260115_093012.pdf',
            NamaBerkasDokumen::buat('Ahmad', 'santri', null, 'pdf', $waktu),
        );
    }

    public function test_buat_menormalkan_ekstensi(): void
    {
        $waktu = Carbon::parse('2026-01-15 09:30:12');
        $this->assertStringEndsWith('.pdf', NamaBerkasDokumen::buat('a', 'b', null, '.PDF', $waktu));
        $this->assertStringEndsWith('.pdf', NamaBerkasDokumen::buat('a', 'b', null, '.pdf', $waktu));
        $this->assertStringEndsWith('.pdf', NamaBerkasDokumen::buat('a', 'b', null, 'PDF', $waktu));
        $this->assertStringEndsWith('.jpg', NamaBerkasDokumen::buat('a', 'b', null, 'JPG', $waktu));
    }

    public function test_direktori_kanonis_per_tipe(): void
    {
        $this->assertSame('dokumen/santri', NamaBerkasDokumen::direktori('santri'));
        $this->assertSame('dokumen/pegawai', NamaBerkasDokumen::direktori('pegawai'));
        $this->assertSame('dokumen/lembaga', NamaBerkasDokumen::direktori('lembaga'));

        $this->assertSame(
            NamaBerkasDokumen::direktori('santri'),
            NamaBerkasDokumen::direktori('santri', 'lokal'),
        );
    }

    public function test_jalur_menggabungkan_direktori_dan_nama(): void
    {
        $this->assertSame('dokumen/santri/a.pdf', NamaBerkasDokumen::jalur('santri', 'a.pdf'));
        $this->assertNull(NamaBerkasDokumen::jalur('santri', null));
        $this->assertNull(NamaBerkasDokumen::jalur('santri', ''));
        $this->assertNull(NamaBerkasDokumen::jalur('santri', '   '));
    }

    /**
     * KUNCI KEAMANAN: `jalur()` menyaring sendiri, jadi pemanggil tak perlu
     * ingat memanggil `basename()`. Dulu nilai seperti `../../.env` lolos
     * menjadi `dokumen/santri/../../../.env`; yang menahannya hanya deteksi
     * traversal Flysystem, dan itu melempar exception (500), bukan 404.
     *
     * @see backend/app/Http/Controllers/Api/Admin/DokumenController.php
     */
    public function test_jalur_menahan_path_traversal(): void
    {
        $jalur = NamaBerkasDokumen::jalur('santri', '../../.env');
        $this->assertNotNull($jalur);
        $this->assertSame('dokumen/santri/.env', $jalur, 'traversal harus jadi basename saja');
        $this->assertStringNotContainsString('..', $jalur);
    }

    /** Semua bentuk jalur jahat harus selalu berakhir di dalam direktori tipe. */
    public function test_jalur_selalu_di_dalam_direktori_tipe(): void
    {
        $kasus = [
            '../../../.env',
            '..\\..\\windows\\system32',
            '/etc/passwd',
            'sub/dir/b.pdf',
            "a\0b.pdf",
            'a/b/../../../c.pdf',
            'normal.pdf',
        ];
        foreach ($kasus as $nama) {
            $jalur = NamaBerkasDokumen::jalur('santri', $nama);
            if ($jalur === null) {
                continue;
            }
            $this->assertStringStartsWith('dokumen/santri/', $jalur, $nama);
            $this->assertStringNotContainsString('..', $jalur, $nama);
            $this->assertSame(
                0,
                substr_count(substr($jalur, strlen('dokumen/santri/')), '/'),
                "tak boleh ada sub-direktori: {$nama}",
            );
        }
    }

    public function test_jalur_menolak_nama_relatif_murni(): void
    {
        $this->assertNull(NamaBerkasDokumen::jalur('santri', '.'));
        $this->assertNull(NamaBerkasDokumen::jalur('santri', '..'));
        $this->assertNull(NamaBerkasDokumen::jalur('santri', '/'));
    }

    /** Siapkan disk 'uji' berisi nama-nama tertentu. */
    private function diskDengan(array $isi, string $direktori = 'dokumen/santri'): void
    {
        Storage::fake('uji');
        foreach ($isi as $nama) {
            Storage::disk('uji')->put("{$direktori}/{$nama}", 'x');
        }
    }

    public function test_unik_mengembalikan_nama_sama_bila_belum_ada(): void
    {
        $this->diskDengan([]);
        $this->assertSame(
            'a.pdf',
            NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'a.pdf'),
        );
    }

    public function test_unik_menambah_akhiran_saat_bentrok(): void
    {
        $this->diskDengan(['a.pdf']);
        $this->assertSame('a-2.pdf', NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'a.pdf'));
    }

    public function test_unik_melanjutkan_sampai_nomor_bebas(): void
    {
        $this->diskDengan(['a.pdf', 'a-2.pdf', 'a-3.pdf']);
        $this->assertSame('a-4.pdf', NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'a.pdf'));
    }

    /** `$kecuali` = berkas itu sendiri, agar rapikan ulang tidak menomori diri sendiri. */
    public function test_unik_mengabaikan_berkas_sendiri(): void
    {
        $this->diskDengan(['a.pdf']);
        $this->assertSame(
            'a.pdf',
            NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'a.pdf', 'a.pdf'),
        );
    }

    public function test_unik_menangani_nama_tanpa_ekstensi(): void
    {
        $this->diskDengan(['tanpaext']);
        $this->assertSame(
            'tanpaext-2',
            NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'tanpaext'),
        );
    }

    /** Titik di TENGAH nama bukan pemisah ekstensi; yang dipakai titik TERAKHIR. */
    public function test_unik_memakai_titik_terakhir_sebagai_ekstensi(): void
    {
        $this->diskDengan(['a.b.pdf']);
        $this->assertSame('a.b-2.pdf', NamaBerkasDokumen::unik('uji', 'dokumen/santri', 'a.b.pdf'));
    }

    public function test_unik_memangkas_garis_miring_di_direktori(): void
    {
        $this->diskDengan(['a.pdf']);
        $this->assertSame(
            'a-2.pdf',
            NamaBerkasDokumen::unik('uji', '/dokumen/santri/', 'a.pdf'),
        );
    }
}
