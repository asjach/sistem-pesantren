<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\PosKeuangan;
use App\Models\TarifBiaya;
use Illuminate\Http\Request;

/**
 * FB-103-01: CRUD tarif per (pos, lembaga, tahun ajaran, tipe santri).
 */
class TarifBiayaController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = TarifBiaya::with(['pos:id,kode_pos,nama_pos', 'lembaga:id,nama', 'tahunAjaran:id,nama']);

        if ($request->filled('pos_keuangan_id')) {
            $query->where('pos_keuangan_id', $request->input('pos_keuangan_id'));
        }
        if ($request->filled('tahun_ajaran_id')) {
            $query->where('tahun_ajaran_id', $request->input('tahun_ajaran_id'));
        }

        $query = $this->scopeLembaga($query, auth()->user(), $request);

        return response()->json($query->latest('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'pos_keuangan_id' => ['required', 'exists:pos_keuangan,id'],
            'lembaga_id' => ['required', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['required', 'exists:tahun_ajaran,id'],
            'tipe_santri' => ['sometimes', 'in:semua,asrama,non_asrama'],
            'nominal' => ['required', 'numeric', 'min:0'],
            'nominal_paket' => ['nullable', 'numeric', 'min:0'],
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $tarif = TarifBiaya::create($data);

        return response()->json($tarif, 201);
    }

    public function update(Request $request, TarifBiaya $tarifBiaya)
    {
        $this->authorizeLembaga(auth()->user(), $tarifBiaya->lembaga_id);

        $tarifBiaya->update($request->validate([
            'nominal' => ['sometimes', 'numeric', 'min:0'],
            'nominal_paket' => ['nullable', 'numeric', 'min:0'],
        ]));

        return response()->json($tarifBiaya);
    }

    public function destroy(TarifBiaya $tarifBiaya)
    {
        $this->authorizeLembaga(auth()->user(), $tarifBiaya->lembaga_id);
        $tarifBiaya->delete();

        return response()->json(['message' => 'Tarif dihapus.']);
    }
}
