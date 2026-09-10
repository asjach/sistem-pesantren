<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\PosKeuangan;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD pos keuangan (single-pesantren: kode_pos unique global).
 */
class PosKeuanganController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = PosKeuangan::query();

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('nama_pos', 'like', "%{$s}%")->orWhere('kode_pos', 'like', "%{$s}%"));
        }

        return response()->json($query->latest('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $auth = auth()->user();
        if (! $auth->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $data = $request->validate([
            'kode_pos' => ['required', 'string', 'max:20', Rule::unique('pos_keuangan', 'kode_pos')],
            'nama_pos' => ['required', 'string', 'max:100'],
            'tipe' => ['required', 'in:bulanan,sekali_bayar,semesteran,tahunan'],
            'keterangan' => ['nullable', 'string'],
        ]);

        return response()->json(PosKeuangan::create($data), 201);
    }

    public function update(Request $request, PosKeuangan $posKeuangan)
    {
        $auth = auth()->user();
        if (! $auth->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $posKeuangan->update($request->validate([
            'nama_pos' => ['sometimes', 'string', 'max:100'],
            'tipe' => ['sometimes', 'in:bulanan,sekali_bayar,semesteran,tahunan'],
            'keterangan' => ['nullable', 'string'],
        ]));

        return response()->json($posKeuangan);
    }

    public function destroy(PosKeuangan $posKeuangan)
    {
        $auth = auth()->user();
        if (! $auth->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $posKeuangan->delete();

        return response()->json(['message' => 'Pos keuangan dihapus.']);
    }
}
