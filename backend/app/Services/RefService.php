<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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

    public static function kunci(string $tipe, ?int $lembagaId): string
    {
        return "ref:$tipe:$lembagaId:v".self::versiGlobal();
    }

    // Gabung baris global (lembaga null) + baris lembaga; baris lembaga menang per kunci.
    public static function effective(string $tipe, ?int $lembagaId): array
    {
        $table = self::table($tipe);
        $key = self::KEY[$tipe];

        return Cache::remember(self::kunci($tipe, $lembagaId), 300, function () use ($table, $key, $lembagaId) {
            $rows = DB::table($table)
                ->whereNull('lembaga_id')
                ->when($lembagaId, fn ($q) => $q->orWhere('lembaga_id', $lembagaId))
                // Urut tampil: urutan ASC, tie-break nama ASC (seragam 36 tabel ref).
                ->orderBy('urutan')->orderBy('nama')->get();
            $map = [];
            foreach ($rows as $r) {
                $map[$r->{$key}] = $r;
            }

            return array_values(array_filter($map, fn ($r) => (bool) $r->is_active));
        });
    }

    /** Gabungan global + lembaga TANPA buang baris nonaktif (untuk "Tampilkan kembali"). */
    public static function semua(string $tipe, ?int $lembagaId): array
    {
        $table = self::table($tipe);
        $key = self::KEY[$tipe];

        $global = DB::table($table)->whereNull('lembaga_id')->get();
        $milik = $lembagaId === null ? collect() : DB::table($table)->where('lembaga_id', $lembagaId)->get();

        $map = [];
        foreach ($global as $r) {
            $map[$r->{$key}] = $r;
        }
        foreach ($milik as $r) {
            $map[$r->{$key}] = $r;
        }

        return collect($map)->sortBy([['urutan', 'asc'], ['nama', 'asc']])->values()->all();
    }

    public static function kodeAktif(string $tipe, ?int $lembagaId): array
    {
        $key = self::KEY[$tipe];

        return array_map(fn ($r) => $r->{$key}, self::effective($tipe, $lembagaId));
    }

    public static function sifatStatusAkhir(string $kode, ?int $lembagaId): ?object
    {
        foreach (self::effective('status_akhir', $lembagaId) as $r) {
            if ($r->kode === $kode) {
                return $r;
            }
        }

        return null;
    }

    public static function forget(?int $lembagaId = null): void
    {
        if ($lembagaId === null) {
            self::bumpVersiGlobal();

            return;
        }
        foreach (array_keys(self::KEY) as $tipe) {
            Cache::forget(self::kunci($tipe, $lembagaId));
        }
    }

    public static function effectiveAlamat(?int $lembagaId): array
    {
        return Cache::remember('ref:alamat:'.$lembagaId.':v'.self::versiGlobal(), 300, function () use ($lembagaId) {
            $rows = DB::table('ref_alamat')
                ->whereNull('lembaga_id')
                ->when($lembagaId, fn ($q) => $q->orWhere('lembaga_id', $lembagaId))
                // Urut tampil: urutan ASC, tie-break nama ASC.
                ->orderBy('urutan')->orderBy('nama')->get();
            $map = [];
            foreach ($rows as $r) {
                $map[$r->nama] = $r;
            }

            return array_values(array_filter($map, fn ($r) => (bool) $r->is_active));
        });
    }

    public static function forgetAlamat(?int $lembagaId = null): void
    {
        if ($lembagaId === null) {
            self::bumpVersiGlobal();

            return;
        }
        Cache::forget('ref:alamat:'.$lembagaId.':v'.self::versiGlobal());
    }

    // Alias lama (kompatibilitas sementara): efektif() => effective().
    public static function efektif(string $tipe, ?int $lembagaId): array
    {
        return self::effective($tipe, $lembagaId);
    }
}
