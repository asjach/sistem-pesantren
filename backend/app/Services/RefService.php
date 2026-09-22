<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RefService
{
    // Kunci nilai untuk kamus bebas (kolom 'nama'), status (kolom 'kode').
    // 31 kamus bebas + 2 status = 33 tipe di KEY; + ref_alamat terpisah = 34 ref total.
    public const KEY = [
        'agama' => 'nama', 'cita_cita' => 'nama', 'hobi' => 'nama',
        'pekerjaan' => 'nama', 'pendidikan' => 'nama',
        'kebutuhan_khusus' => 'nama', 'kota' => 'nama',
        'penghasilan' => 'nama', 'transportasi' => 'nama', 'status_tinggal' => 'nama',
        'jarak' => 'nama', 'waktu_tempuh' => 'nama', 'bahasa_sehari_hari' => 'nama',
        'disabilitas' => 'nama', 'tmp_lahir' => 'nama', 'status_ortu' => 'nama',
        'yang_membiayai' => 'nama', 'provinsi' => 'nama', 'kecamatan' => 'nama',
        'desa_kelurahan' => 'nama', 'alasan_mutasi' => 'nama',
        'jenis_dokumen_santri' => 'nama', 'jenis_dokumen_pegawai' => 'nama',
        'status_pernikahan' => 'nama', 'gol_darah' => 'nama',
        'jenis_ptk' => 'nama', 'jenjang_sertifikasi' => 'nama',
        'tingkat' => 'nama', 'tugas_utama' => 'nama', 'tipe_pelanggaran' => 'nama',
        'jalur_sertifikasi' => 'nama',
        'status_awal' => 'kode', 'status_akhir' => 'kode',
    ];

    public static function table(string $tipe): string
    {
        if (! isset(self::KEY[$tipe])) {
            abort(422, "Tipe referensi tidak valid: $tipe.");
        }

        return 'ref_'.$tipe;
    }

    public const VERSI_KEY = 'ref:versi_global';

    public static function versiGlobal(): int
    {
        return (int) Cache::get(self::VERSI_KEY, 1);
    }

    public static function bumpVersiGlobal(): void
    {
        Cache::put(self::VERSI_KEY, self::versiGlobal() + 1);
    }

    public static function kunci(string $tipe, ?string $jenjang): string
    {
        return "ref:$tipe:$jenjang:v".self::versiGlobal();
    }

    // Nilai referensi murni per lembaga (tanpa baris global): super_admin
    // menulis ke semua lembaga sekaligus (fan-out), tiap lembaga
    // mengaktifkan/menonaktifkan miliknya sendiri.
    public static function effective(string $tipe, ?string $jenjang): array
    {
        $table = self::table($tipe);
        $key = self::KEY[$tipe];
        if ($jenjang === null) {
            return [];
        }

        return Cache::remember(self::kunci($tipe, $jenjang), 300, function () use ($table, $key, $jenjang) {
            $rows = DB::table($table)
                ->where('jenjang', $jenjang)
                // Urut tampil: urutan ASC, tie-break nama ASC (seragam 34 tabel ref).
                ->orderBy('urutan')->orderBy('nama')->get();
            $map = [];
            foreach ($rows as $r) {
                $map[$r->{$key}] = $r;
            }

            return array_values(array_filter($map, fn ($r) => (bool) $r->is_active));
        });
    }

    /** Baris lembaga TANPA buang yang nonaktif (untuk "Tampilkan kembali"). */
    public static function semua(string $tipe, ?string $jenjang): array
    {
        $table = self::table($tipe);
        $key = self::KEY[$tipe];
        if ($jenjang === null) {
            return [];
        }

        $rows = DB::table($table)->where('jenjang', $jenjang)->get();

        $map = [];
        foreach ($rows as $r) {
            $map[$r->{$key}] = $r;
        }

        return collect($map)->sortBy([['urutan', 'asc'], ['nama', 'asc']])->values()->all();
    }

    public static function kodeAktif(string $tipe, ?string $jenjang): array
    {
        $key = self::KEY[$tipe];

        return array_map(fn ($r) => $r->{$key}, self::effective($tipe, $jenjang));
    }

    /**
     * Gabungan nilai aktif SEMUA lembaga operasional (dedup per kunci):
     * untuk saran/templat tanpa konteks lembaga.
     */
    public static function efektifSemuaLembaga(string $tipe): array
    {
        $lembagas = DB::table('lembaga')->pluck('jenjang')->all();
        $map = [];
        foreach ($lembagas as $lid) {
            foreach (self::effective($tipe, $lid) as $r) {
                $map[$r->{self::KEY[$tipe]}] ??= $r;
            }
        }

        return array_values($map);
    }

    public static function sifatStatusAkhir(string $kode, ?string $jenjang): ?object
    {
        foreach (self::effective('status_akhir', $jenjang) as $r) {
            if ($r->kode === $kode) {
                return $r;
            }
        }

        return null;
    }

    public static function forget(?string $jenjang = null): void
    {
        if ($jenjang === null) {
            self::bumpVersiGlobal();

            return;
        }
        foreach (array_keys(self::KEY) as $tipe) {
            Cache::forget(self::kunci($tipe, $jenjang));
        }
    }

    public static function effectiveAlamat(?string $jenjang): array
    {
        if ($jenjang === null) {
            return [];
        }

        return Cache::remember('ref:alamat:'.$jenjang.':v'.self::versiGlobal(), 300, function () use ($jenjang) {
            $rows = DB::table('ref_alamat')
                ->where('jenjang', $jenjang)
                // Urut tampil: urutan ASC, tie-break nama ASC.
                ->orderBy('urutan')->orderBy('nama')->get();
            $map = [];
            foreach ($rows as $r) {
                $map[$r->nama] = $r;
            }

            return array_values(array_filter($map, fn ($r) => (bool) $r->is_active));
        });
    }

    public static function forgetAlamat(?string $jenjang = null): void
    {
        if ($jenjang === null) {
            self::bumpVersiGlobal();

            return;
        }
        Cache::forget('ref:alamat:'.$jenjang.':v'.self::versiGlobal());
    }

    // Alias lama (kompatibilitas sementara): efektif() => effective().
    public static function efektif(string $tipe, ?string $jenjang): array
    {
        return self::effective($tipe, $jenjang);
    }

    /** Daftar [tabel, kolom kunci] seluruh kamus (33 tipe + alamat). */
    public static function daftarSebar(): array
    {
        $daftar = [];
        foreach (self::KEY as $tipe => $kunci) {
            $daftar[] = ['ref_'.$tipe, $kunci];
        }
        $daftar[] = ['ref_alamat', 'nama'];

        return $daftar;
    }

    /**
     * Sebar satu nilai ke banyak lembaga (super_admin menambah nilai):
     * lembaga yang sudah punya kunci yang sama dilewati.
     *
     * @param  array<string,mixed>  $atribut  kolom nilai (tanpa jenjang)
     * @return list<object> baris yang terbentuk
     */
    public static function sebar(string $table, string $key, array $atribut, array $jenjang): array
    {
        $terbentuk = [];
        foreach ($jenjang as $lid) {
            $ada = DB::table($table)
                ->where('jenjang', $lid)
                ->where($key, $atribut[$key])
                ->first();
            if ($ada) {
                continue;
            }
            $id = DB::table($table)->insertGetId($atribut + ['jenjang' => $lid]);
            $terbentuk[] = DB::table($table)->find($id);
            self::forget($lid);
        }
        self::forgetAlamat(null);

        return $terbentuk;
    }

    /**
     * Benih kamus untuk lembaga operasional baru: salin tiap kunci yang
     * sudah ada di lembaga lain (contoh pertama) sebagai aktif.
     */
    public static function benihUntuk(string $jenjang): void
    {
        foreach (self::daftarSebar() as [$table, $key]) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $kuncis = DB::table($table)->distinct()->pluck($key)->all();
            foreach ($kuncis as $nilai) {
                $ada = DB::table($table)
                    ->where('jenjang', $jenjang)
                    ->where($key, $nilai)
                    ->exists();
                if ($ada) {
                    continue;
                }
                $contoh = (array) DB::table($table)->where($key, $nilai)->orderBy('id')->first();
                unset($contoh['id'], $contoh['created_at'], $contoh['updated_at']);
                $contoh['jenjang'] = $jenjang;
                $contoh['is_active'] = true;
                DB::table($table)->insert($contoh);
            }
            self::forget($jenjang);
        }
        self::forgetAlamat(null);
    }
}
