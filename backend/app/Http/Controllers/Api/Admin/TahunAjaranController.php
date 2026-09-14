<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * FB-004-01: CRUD tahun ajaran per lembaga + set aktif.
 */
class TahunAjaranController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = $this->scopeLembaga(TahunAjaran::with('lembaga:id,nama,kode'), auth()->user(), $request);

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where('nama', 'like', "%{$s}%");
        }

        return response()->json($query->latest('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // TA selalu milik lembaga operasional (parent_id NOT NULL); root PESANTREN bukan lembaga KBM.
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nama' => [
                'required', 'string', 'max:50',
                Rule::unique('tahun_ajaran')->where(fn ($q) => $q->where('lembaga_id', $request->input('lembaga_id'))),
            ],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $tahun = TahunAjaran::create($data);

        return response()->json($tahun, 201);
    }

    public function update(Request $request, TahunAjaran $tahunAjaran)
    {
        $auth = auth()->user();
        $this->authorizeLembaga($auth, $tahunAjaran->lembaga_id);

        $data = $request->validate([
            'nama' => [
                'sometimes', 'string', 'max:50',
                Rule::unique('tahun_ajaran')->where(fn ($q) => $q->where('lembaga_id', $tahunAjaran->lembaga_id))->ignore($tahunAjaran->id),
            ],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date'],
        ]);

        $tahunAjaran->update($data);

        return response()->json($tahunAjaran);
    }

    public function destroy(TahunAjaran $tahunAjaran)
    {
        $this->authorizeLembaga(auth()->user(), $tahunAjaran->lembaga_id);

        if ($tahunAjaran->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak boleh dihapus.'], 422);
        }

        $tahunAjaran->delete();

        return response()->json(['message' => 'Tahun ajaran dihapus.']);
    }

    public function setAktif(TahunAjaran $tahunAjaran)
    {
        $this->authorizeLembaga(auth()->user(), $tahunAjaran->lembaga_id);

        DB::transaction(function () use ($tahunAjaran) {
            TahunAjaran::where('lembaga_id', $tahunAjaran->lembaga_id)
                ->where('id', '!=', $tahunAjaran->id)
                ->update(['is_aktif' => false]);
            $tahunAjaran->update(['is_aktif' => true]);
        });

        return response()->json($tahunAjaran->fresh());
    }
}
