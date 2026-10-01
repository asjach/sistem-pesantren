<?php

namespace Tests\Feature\Concerns;

use Illuminate\Support\Facades\Schema;

/**
 * Penjaga drift antara `docs/SCHEMA.md` dan skema nyata:
 *  - arah maju: tabel/kolom/index/FK yang didokumentasikan harus ada di DB;
 *  - arah balik: setiap tabel/kolom di DB harus terdokumentasikan, agar tabel
 *    atau kolom baru tidak luput dari dokumentasi.
 *
 * Dipakai bersama oleh `SchemaDocTest` (SQLite in-memory) dan
 * `SchemaMysqlSmokeTest` (MySQL `migrate:fresh`), sehingga perbedaan driver
 * tertangkap tanpa menggandakan aturan. Guard memakai koneksi DB **default**,
 * jadi pemanggil yang bertanggung jawab mengarahkannya.
 *
 * Parser sengaja konservatif: hanya baris berbentuk definisi kolom yang dibaca
 * untuk daftar kolom, dan hanya `NAMA(...)` pada baris batasan yang dibaca
 * untuk index/unique/PK, sehingga baris catatan tidak salah ditafsirkan.
 */
trait VerifikasiSkemaDokumen
{
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
        $dokumen = $this->uraiDokumen();
        $this->pastikanParserMembaca($dokumen['kolom']);

        $masalah = [];
        foreach ($dokumen['kolom'] as $tabel => $kolom) {
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
        $dokumen = $this->uraiDokumen();
        $this->pastikanParserMembaca($dokumen['kolom']);

        $masalah = [];
        foreach ($this->tabelDiDb() as $tabel) {
            if ($this->diLuarDokumen($tabel)) {
                continue;
            }

            if (! array_key_exists($tabel, $dokumen['kolom'])) {
                $masalah[] = "tabel `{$tabel}` ada di DB tetapi belum didokumentasikan";

                continue;
            }

            foreach (Schema::getColumnListing($tabel) as $kolom) {
                if (! in_array($kolom, $dokumen['kolom'][$tabel], true)) {
                    $masalah[] = "`{$tabel}.{$kolom}` ada di DB tetapi belum didokumentasikan";
                }
            }
        }

        $this->assertSame([], $masalah, "Ada tabel/kolom DB yang belum masuk SCHEMA.md:\n".implode("\n", $masalah));
    }

    public function test_index_unik_dan_pk_dokumentasi_ada_di_db(): void
    {
        $masalah = [];
        $daftarBatas = $this->uraiDokumen()['batas'];
        // Penjaga parser: format SCHEMA.md berubah -> gagal keras, bukan lolos senyap.
        $this->assertGreaterThanOrEqual(50, array_sum(array_map('count', $daftarBatas)), 'Terlalu sedikit index/unique terbaca dari SCHEMA.md — parser meleset?');
        foreach ($daftarBatas as $tabel => $daftar) {
            if (! Schema::hasTable($tabel) || in_array($tabel, self::TABEL_PRA_PRODUCTION, true)) {
                continue;
            }

            $indeks = Schema::getIndexes($tabel);
            foreach ($daftar as $batas) {
                // Token boleh berupa kolom atau nama index eksplisit (mis.
                // `uq_riwayat_belajar_stls`); selain itu dianggap salah ketik.
                [$kolom, $ganjil] = $this->pisahTokenBatas($tabel, $batas['kolom']);
                if ($ganjil !== []) {
                    $masalah[] = "{$batas['jenis']}(".implode(', ', $batas['kolom']).") pada `{$tabel}` memuat token tak dikenal: ".implode(', ', $ganjil);

                    continue;
                }
                if ($kolom === []) {
                    continue;
                }

                $ada = collect($indeks)->contains(function (array $i) use ($batas, $kolom): bool {
                    if (! $this->himpunanSama($i['columns'], $kolom)) {
                        return false;
                    }

                    return match ($batas['jenis']) {
                        'primary' => (bool) $i['primary'],
                        'unique' => (bool) $i['unique'] && ! (bool) $i['primary'],
                        default => ! (bool) $i['unique'] && ! (bool) $i['primary'],
                    };
                });

                if (! $ada) {
                    $masalah[] = "{$batas['jenis']}(".implode(', ', $kolom).") pada `{$tabel}` didokumentasikan tetapi tidak ada di DB";
                }
            }
        }

        $this->assertSame([], $masalah, "Index/unique yang didokumentasikan tidak cocok dengan DB:\n".implode("\n", $masalah));
    }

    public function test_foreign_key_dokumentasi_ada_di_db(): void
    {
        $masalah = [];
        $daftarFk = $this->uraiDokumen()['fk'];
        $this->assertGreaterThanOrEqual(90, array_sum(array_map('count', $daftarFk)), 'Terlalu sedikit foreign key terbaca dari SCHEMA.md — parser meleset?');
        foreach ($daftarFk as $tabel => $daftar) {
            if (! Schema::hasTable($tabel) || in_array($tabel, self::TABEL_PRA_PRODUCTION, true)) {
                continue;
            }

            $fk = Schema::getForeignKeys($tabel);
            foreach ($daftar as $relasi) {
                if (! Schema::hasColumn($tabel, $relasi['kolom'])) {
                    continue; // kesalahan kolom sudah dilaporkan test arah maju.
                }

                $ada = collect($fk)->contains(
                    fn (array $f): bool => array_values($f['columns']) === [$relasi['kolom']]
                        && (string) $f['foreign_table'] === $relasi['tabel'],
                );

                if (! $ada) {
                    $masalah[] = "`{$tabel}.{$relasi['kolom']}` didokumentasikan FK → {$relasi['tabel']} tetapi tidak ada di DB";
                }
            }
        }

        $this->assertSame([], $masalah, "Foreign key yang didokumentasikan tidak cocok dengan DB:\n".implode("\n", $masalah));
    }

    /** @return list<string> */
    private function tabelDiDb(): array
    {
        // MySQL: getTables() tanpa argumen sengaja mengembalikan tabel dari
        // SEMUA schema yang bisa diakses (bukan hanya database koneksi), jadi
        // harus dibatasi ke database koneksi ini agar database lain di server
        // yang sama tidak dianggap milik aplikasi. SQLite hanya punya satu
        // schema sehingga tidak perlu difilter.
        $koneksi = Schema::getConnection();
        $tabel = in_array($koneksi->getDriverName(), ['mysql', 'mariadb'], true)
            ? Schema::getTables($koneksi->getDatabaseName())
            : Schema::getTables();

        return collect($tabel)
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

    /**
     * Pisahkan token batasan menjadi kolom nyata dan token tak dikenal
     * (bukan kolom, bukan pula nama index yang ada di DB).
     *
     * @param  list<string>  $token
     * @return array{0: list<string>, 1: list<string>}
     */
    private function pisahTokenBatas(string $tabel, array $token): array
    {
        $nyata = Schema::getColumnListing($tabel);
        $namaIndeks = collect(Schema::getIndexes($tabel))
            ->map(fn (array $i): string => strtolower((string) $i['name']))
            ->all();

        $kolom = [];
        $ganjil = [];
        foreach ($token as $t) {
            if (in_array($t, $nyata, true)) {
                $kolom[] = $t;
            } elseif (! in_array(strtolower($t), $namaIndeks, true)) {
                $ganjil[] = $t;
            }
        }

        return [$kolom, $ganjil];
    }

    /**
     * Bandingkan dua daftar kolom tanpa peduli urutan/huruf besar-kecil.
     *
     * @param  list<string>  $a
     * @param  list<string>  $b
     */
    private function himpunanSama(array $a, array $b): bool
    {
        $normal = fn (array $x): array => collect($x)->map(fn ($v) => strtolower((string) $v))->sort()->values()->all();

        return $normal($a) === $normal($b);
    }

    /** @param  array<string, list<string>>  $kolom */
    private function pastikanParserMembaca(array $kolom): void
    {
        foreach (['lembaga', 'santri', 'riwayat_belajar', 'alumni', 'dokumen_santri'] as $wajib) {
            $this->assertArrayHasKey($wajib, $kolom, "Parser tidak menemukan tabel `{$wajib}` di SCHEMA.md.");
        }
        $totalKolom = array_sum(array_map('count', $kolom));
        $this->assertGreaterThanOrEqual(50, count($kolom), 'Terlalu sedikit tabel terbaca dari SCHEMA.md — parser meleset?');
        $this->assertGreaterThanOrEqual(400, $totalKolom, 'Terlalu sedikit kolom terbaca dari SCHEMA.md — parser meleset?');
    }

    /**
     * Urai SCHEMA.md menjadi kolom, batasan (index/unique/PK), dan foreign key
     * per tabel.
     *
     * @return array{
     *     kolom: array<string, list<string>>,
     *     batas: array<string, list<array{jenis: string, kolom: list<string>}>>,
     *     fk: array<string, list<array{kolom: string, tabel: string}>>
     * }
     */
    private function uraiDokumen(): array
    {
        $berkas = dirname(base_path()).'/docs/SCHEMA.md';
        $this->assertFileExists($berkas, 'SCHEMA.md tidak ditemukan.');

        $kolom = [];
        $batas = [];
        $fk = [];
        $tabel = null;

        foreach (explode("\n", (string) file_get_contents($berkas)) as $baris) {
            if (preg_match('/^### `([a-z_][a-z0-9_]*)`/', $baris, $judul) === 1) {
                $tabel = $judul[1];
                $kolom[$tabel] ??= [];

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

            $namaKolom = $this->kolomDariBaris($baris);
            if ($namaKolom !== []) {
                $kolom[$tabel] = array_values(array_unique([...$kolom[$tabel], ...$namaKolom]));
            }

            foreach ($this->batasDariBaris($baris) as $satu) {
                $batas[$tabel][] = $satu;
            }

            if (preg_match('/^-\s*`([a-z_][a-z0-9_]*)`[^:]*:\s*[^—]*?\bFK → ([a-z_][a-z0-9_]*)/u', $baris, $cocok) === 1) {
                $fk[$tabel][] = ['kolom' => $cocok[1], 'tabel' => $cocok[2]];
            }
        }

        return ['kolom' => $kolom, 'batas' => $batas, 'fk' => $fk];
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

    /**
     * Batasan `NAMA(...)` pada satu baris (boleh beberapa, dipisah titik tengah).
     *
     * @return list<array{jenis: string, kolom: list<string>}>
     */
    private function batasDariBaris(string $baris): array
    {
        $hasil = [];
        foreach (preg_split('/·/u', $baris) ?: [] as $potong) {
            // Harus MENGAWALI butir — menghindari prosa seperti "index (boleh ...)".
            if (preg_match('/^(?:-\s*)?(PK|PRIMARY|UNIQUE|INDEX)\s*\(([^)]*)\)/iu', trim($potong), $cocok) !== 1) {
                continue;
            }

            preg_match_all('/`([^`]+)`/u', $cocok[2], $nama);
            if ($nama[1] === []) {
                continue;
            }

            $jenis = strtoupper($cocok[1]);
            $hasil[] = [
                'jenis' => $jenis === 'UNIQUE' ? 'unique' : ($jenis === 'INDEX' ? 'index' : 'primary'),
                'kolom' => $nama[1],
            ];
        }

        return $hasil;
    }
}
