<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Penjaga drift antara `docs/SCHEMA.md` dan skema nyata: setiap tabel/kolom
 * yang didokumentasikan harus benar-benar ada setelah migrasi. Menggantikan
 * pengecekan manual yang mudah terlewat saat konsolidasi migrasi.
 *
 * Parser sengaja konservatif: hanya baris berbentuk `- `kolom`: ...`,
 * `- `kolom` PK`, atau `- `kolom`` yang dianggap definisi kolom, sehingga
 * baris catatan (INVARIAN/ATURAN/Alur/UNIQUE/INDEX) tidak salah dibaca.
 */
class SchemaDocTest extends TestCase
{
    use RefreshDatabase;

    /** Tabel yang didokumentasikan sebagai gambaran umum (belum dibuat). */
    private const TABEL_PRA_PRODUCTION = [
        'asrama',
        'asrama_kamar',
        'asrama_penghuni',
        'asrama_izin_pulang',
        'asrama_kegiatan',
        'user_asrama',
    ];

    public function test_kolom_dokumentasi_schema_md_ada_di_db(): void
    {
        $dokumen = $this->uraiSchema();
        // Penjaga parser: bila format SCHEMA.md berubah, tes harus gagal keras
        // (bukan lolos senyap karena tak menemukan apa pun untuk diperiksa).
        foreach (['lembaga', 'santri', 'riwayat_belajar', 'alumni', 'dokumen_santri'] as $wajib) {
            $this->assertArrayHasKey($wajib, $dokumen, "Parser tidak menemukan tabel `{$wajib}` di SCHEMA.md.");
        }
        $totalKolom = array_sum(array_map('count', $dokumen));
        $this->assertGreaterThanOrEqual(50, count($dokumen), 'Terlalu sedikit tabel terbaca dari SCHEMA.md — parser meleset?');
        $this->assertGreaterThanOrEqual(400, $totalKolom, 'Terlalu sedikit kolom terbaca dari SCHEMA.md — parser meleset?');

        $masalah = [];
        foreach ($dokumen as $tabel => $kolom) {
            if (! Schema::hasTable($tabel)) {
                if (! in_array($tabel, self::TABEL_PRA_PRODUCTION, true)) {
                    $masalah[] = "tabel `{$tabel}` didokumentasikan tetapi tidak ada di DB";
                }

                continue;
            }

            foreach ($kolom as $k) {
                if (! Schema::hasColumn($tabel, $k)) {
                    $masalah[] = "`{$tabel}.{$k}` didokumentasikan tetapi tidak ada di DB";
                }
            }
        }

        $this->assertSame([], $masalah, "Dokumentasi SCHEMA.md menyimpang dari skema DB:\n".implode("\n", $masalah));
    }

    /**
     * Peta `tabel => daftar kolom` dari SCHEMA.md.
     *
     * @return array<string, list<string>>
     */
    private function uraiSchema(): array
    {
        $berkas = dirname(base_path()).'/docs/SCHEMA.md';
        $this->assertFileExists($berkas, 'SCHEMA.md tidak ditemukan.');

        $hasil = [];
        $tabel = null;
        foreach (explode("\n", (string) file_get_contents($berkas)) as $baris) {
            if (preg_match('/^### `([a-z_][a-z0-9_]*)`/', $baris, $judul) === 1) {
                $tabel = $judul[1];
                $hasil[$tabel] ??= [];

                continue;
            }

            // Heading lain (##, ### tanpa backtick, dsb.) mengakhiri seksi tabel.
            if (preg_match('/^#{1,6} /', $baris) === 1) {
                $tabel = null;

                continue;
            }

            if ($tabel === null || preg_match('/^- /', $baris) !== 1) {
                continue;
            }

            $kolom = $this->kolomDariBaris($baris);
            if ($kolom !== []) {
                $hasil[$tabel] = array_values(array_unique([...$hasil[$tabel], ...$kolom]));
            }
        }

        return $hasil;
    }

    /**
     * Ambil nama kolom bila baris berbentuk definisi kolom.
     *
     * @return list<string>
     */
    private function kolomDariBaris(string $baris): array
    {
        // Awalan `a`, `b`, `c` (dipisah koma atau titik tengah) — tanpa deskripsi.
        if (preg_match('/^- (`[^`]+`(?:\s*[,\x{00b7}]\s*`[^`]+`)*)/u', $baris, $cocok) !== 1) {
            return [];
        }

        $ekor = substr($baris, strlen($cocok[0]));

        // Hanya lanjutan yang lazim pada definisi kolom: `: tipe`, ` PK`, atau akhir baris.
        $definisi = $ekor === ''
            || preg_match('/^\s*:/', $ekor) === 1
            || preg_match('/^\s+PK\b/', $ekor) === 1
            || preg_match('/^\s+(string|int|integer|date|enum|bool|boolean|json|text|char|varchar|unsigned|bigint)\b/i', $ekor) === 1;

        if (! $definisi) {
            return [];
        }

        preg_match_all('/`([^`]+)`/u', $cocok[1], $nama);

        return $nama[1];
    }
}
