<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RefService;
use Illuminate\Http\Request;

class KamusController extends Controller
{
    // Kamus bebas (saran). status_awal/akhir TIDAK lewat sini — itu ranah admin (004).
    public const WHITELIST = [
        'agama', 'hobi', 'cita_cita', 'pekerjaan',
        'pendidikan', 'kebutuhan_khusus', 'kota',
        'penghasilan', 'transportasi', 'status_tinggal', 'jarak',
        'waktu_tempuh', 'bahasa_sehari_hari', 'disabilitas', 'tmp_lahir',
        'status_ortu', 'yang_membiayai', 'provinsi', 'kecamatan',
        'desa_kelurahan', 'alasan_mutasi', 'jenis_dokumen_santri',
        'jenis_dokumen_pegawai', 'status_pernikahan', 'gol_darah',
        'jenis_ptk', 'jenjang_sertifikasi',
    ];

    public function saran(string $jenis, Request $request)
    {
        abort_unless(in_array($jenis, self::WHITELIST, true), 404, 'Jenis kamus tidak dikenal.');
        $rows = collect(RefService::effective($jenis, $request->integer('lembaga_id') ?: null))
            ->when($request->q, fn ($c) => $c->filter(fn ($r) => stripos($r->nama, $request->q) !== false))
            ->take(50)->values();
        return response()->json(['data' => $rows]);
    }
}
