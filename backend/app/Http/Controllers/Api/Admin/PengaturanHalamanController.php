<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanHalamanHapusRequest;
use App\Http\Requests\Admin\PengaturanHalamanIndexRequest;
use App\Http\Requests\Admin\PengaturanHalamanSimpanRequest;
use App\Models\PengaturanHalaman;
use Illuminate\Http\JsonResponse;

/**
 * Urutan + tampil/sembunyi TAB halaman gabungan — satu baris per page_key,
 * global untuk semua pengguna (diatur super_admin, dibaca bebas).
 *
 * Tab yang bisa diatur hanyalah rute yang SUDAH terdaftar di kode
 * (src/lib/halaman.ts tabHalaman). Server sengaja TIDAK memvalidasi rute
 * terhadap daftar kode: halaman bisa mengubah daftar tabnya kapan saja, dan
 * daftar tersimpan yang memuat rute lama tidak boleh jadi error — rute yang
 * tak dikenal cukup diabaikan frontend saat merender.
 */
class PengaturanHalamanController extends Controller
{
    /** GET /api/admin/pengaturan-halaman?keys[]=data_induk — peta page_key → setelan. */
    public function index(PengaturanHalamanIndexRequest $request): JsonResponse
    {
        $keys = $request->validated()['keys'];
        $rows = PengaturanHalaman::whereIn('page_key', $keys)->get()
            ->keyBy('page_key');

        $peta = [];
        foreach ($rows as $key => $row) {
            $peta[$key] = [
                'page_key' => $row->page_key,
                'urutan' => $row->urutan ?? [],
                'sembunyi' => $row->sembunyi ?? [],
            ];
        }

        return response()->json([
            'pesan' => 'Pengaturan halaman dimuat.',
            'data' => ['peta' => $peta],
        ]);
    }

    /**
     * PUT /api/admin/pengaturan-halaman — upsert SATU halaman.
     *
     * urutan dikirim LENGKAP (bukan digabung) supaya susunan yang tak disebut
     * kembali ke bawaan kode; sembunyi juga lengkap.
     */
    public function simpan(PengaturanHalamanSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        $row = PengaturanHalaman::firstOrNew(['page_key' => $data['page_key']]);
        $row->urutan = array_values(array_unique($data['urutan']));
        $row->sembunyi = array_values(array_unique($data['sembunyi']));
        $row->diubah_oleh = $request->user()->id;
        $row->save();

        return response()->json([
            'pesan' => 'Urutan tab disimpan.',
            'data' => [
                'page_key' => $row->page_key,
                'urutan' => $row->urutan ?? [],
                'sembunyi' => $row->sembunyi ?? [],
            ],
        ]);
    }

    /** DELETE /api/admin/pengaturan-halaman?page_key=data_induk → kembali bawaan kode. */
    public function hapus(PengaturanHalamanHapusRequest $request): JsonResponse
    {
        PengaturanHalaman::where('page_key', $request->validated()['page_key'])->delete();

        return response()->json(['pesan' => 'Urutan tab dikembalikan ke bawaan.']);
    }
}
