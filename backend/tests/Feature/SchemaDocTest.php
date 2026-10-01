<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Penjaga drift dua arah antara `docs/SCHEMA.md` dan skema nyata:
 *  - arah maju: setiap tabel/kolom yang didokumentasikan harus ada di DB;
 *  - arah balik: setiap tabel/kolom di DB harus terdokumentasikan, agar tabel
 *    baru tidak luput dari dokumentasi.
 *
 * Parser sengaja konservatif: hanya baris berbentuk definisi kolom yang dibaca,
 * sehingga baris catatan (INVARIAN/ATURAN/Alur/UNIQUE/INDEX) tidak salah dibaca.
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

    /**
     * Tabel yang sengaja TIDAK punya seksi sendiri di SCHEMA.md:
     * tabel bawaan framework/utility, dan `ref_*` yang diwakili satu pola.
     *
     * @var list<string>
     */
    private const TABEL_DI_LUAR_DOKUMEN = [
        'migrations',
        'users',
        'sessions',
        'password_reset_tokens',
        'personal_access_tokens',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'notifications',
        'permissions',
        'roles',
        'model_has_permissions',
        'model_has_roles',
        'role_has_permissions',
    ];

    public function test_kolom_dokumentasi_schema_md_ada_di_db(): void
    {
        $dokumen = $this->uraiSchema();
        $this->pastikanParserMembaca($dokumen);

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

    public function test_tabel_dan_kolom_db_ikut_terdokumentasi(): void
    {
        $dokumen = $this->uraiSchema();
        $this->pastikanParserMembaca($dokumen);

        $masalah = [];
        foreach ($this->tabelDiDb() as $tabel) {
            if ($this->diLuarDokumen($tabel)) {
                continue;
            }

            if (! array_key_exists($tabel, $dokumen)) {
                $masalah[] = "tabel `{$tabel}` ada di DB tetapi belum didokumentasikan";

                continue;
            }

            foreach (Schema::getColumnListing($tabel) as $kolom) {
                if (! in_array($kolom, $dokumen[$tabel], true)) {
                    $masalah[] = "`{$tabel}.{$kolom}` ada di DB tetapi belum didokumentasikan";
                }
            }
        }

        $this->assertSame([], $masalah, "Ada tabel/kolom DB yang belum masuk SCHEMA.md:\n".implode("\n", $masalah));
    }

    /** @return list<string> */
    private function tabelDiDb(): array
    {
        return collect(Schema::getTables())
            ->map(fn ($t) => is_array($t) ? (string) ($t['name'] ?? '') : (string) $t)
            ->filter()
            ->sort()
            ->values()
            ->all();
    }

    private function diLuarDokumen(string $tabel): bool
    {
        return str_starts_with($tabel, 'ref_')
            || in_array($tabel, self::TABEL_DI_LUAR_DOKUMEN, true);
    }

    /** @param  array<string, list<string>>  $dokumen */
    private function pastikanParserMembaca(array $dokumen): void
    {
        foreach (['lembaga', 'santri', 'riwayat_belajar', 'alumni', 'dokumen_santri'] as $wajib) {
            $this->assertArrayHasKey($wajib, $dokumen, "Parser tidak menemukan tabel `{$wajib}` di SCHEMA.md.");
        }
        $totalKolom = array_sum(array_map('count', $dokumen));
        $this->assertGreaterThanOrEqual(50, count($dokumen), 'Terlalu sedikit tabel terbaca dari SCHEMA.md — parser meleset?');
        $this->assertGreaterThanOrEqual(400, $totalKolom, 'Terlalu sedikit kolom terbaca dari SCHEMA.md — parser meleset?');
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
        $isi = trim(substr($baris, 2)); // buang penanda "- "
        // Definisi kolom berhenti di titik dua atau em dash (awal keterangan).
        $batas = [];
        foreach ([':', '—'] as $penanda) {
            $pos = mb_strpos($isi, $penanda);
            if ($pos !== false) {
                $batas[] = $pos;
            }
        }
        $kepala = trim($batas === [] ? $isi : mb_substr($isi, 0, min($batas)));

        // Bentuk kanonik: daftar `kolom` (, `kolom`)+ dengan tipe opsional di tanda kurung.
        if (preg_match('/^(?:`[^`]+`(?:\s*\([^)]*\))?)(?:\s*[,\x{00b7}]\s*`[^`]+`(?:\s*\([^)]*\))?)*$/u', $kepala) === 1) {
            preg_match_all('/`([^`]+)`/u', $kepala, $nama);

            return $nama[1];
        }

        // Bentuk turunan: satu kolom dengan penanda tipe di luar titik dua (`id` PK).
        if (preg_match('/^`([^`]+)`\s+(PK|string|int|integer|date|enum|bool|boolean|json|text|char|varchar|unsigned|bigint)\b/iu', $kepala, $cocok) === 1) {
            return [$cocok[1]];
        }

        return [];
    }
}
