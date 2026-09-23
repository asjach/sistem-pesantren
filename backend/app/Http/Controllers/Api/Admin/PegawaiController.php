<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\KeaktifanPegawai;
use App\Models\Pegawai;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Master pegawai (modul 200, bertahap): daftar opsi aktif per lembaga + TA. */
class PegawaiController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/pegawai/aktif — opsi dropdown wali: pegawai aktif di lembaga + TA. */
    public function aktif(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', Rule::exists('lembaga', 'jenjang')],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $rows = Pegawai::where('pegawai.status_aktif', Pegawai::AKTIF)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('keaktifan_pegawai')
                ->whereColumn('keaktifan_pegawai.pegawai_id', 'pegawai.id')
                ->where('keaktifan_pegawai.jenjang', $data['jenjang'])
                ->where('keaktifan_pegawai.tahun_ajaran', $data['tahun_ajaran'])
                ->where('keaktifan_pegawai.status_keaktifan', KeaktifanPegawai::AKTIF))
            ->orderBy('pegawai.nama_lengkap')
            ->get(['id', 'nip', 'nama_lengkap']);

        return response()->json($rows);
    }
}
