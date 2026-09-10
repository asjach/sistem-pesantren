<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;

/**
 * FB-004-01: CRUD kelas. tahun_ajaran wajib se-lembaga dengan kelas.
 */
class KelasController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = $this->scopeLembaga(
            Kelas::with(['lembaga:id,nama', 'tahunAjaran:id,nama']),
            auth()->user(),
            $request
        );

        if ($request->filled('tahun_ajaran_id')) {
            $query->where('tahun_ajaran_id', $request->input('tahun_ajaran_id'));
        }
        if ($request->filled('tingkat')) {
            $query->where('tingkat', $request->input('tingkat'));
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where('nama_kelas', 'like', "%{$s}%");
        }

        return response()->json($query->latest('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'lembaga_id' => ['required', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['required', 'exists:tahun_ajaran,id'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'nama_kelas' => ['required', 'string', 'max:50'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $tahun = TahunAjaran::findOrFail($data['tahun_ajaran_id']);
        if ((int) $tahun->lembaga_id !== (int) $data['lembaga_id']) {
            return response()->json(['message' => 'Tahun ajaran tidak se-lembaga dengan kelas.'], 422);
        }

        // Validasi kamus no.50: tingkat via RefService efektif (null = semua).
        if (! empty($data['tingkat'] ?? null)
            && ! in_array($data['tingkat'], \App\Services\RefService::kodeAktif('tingkat', (int) $data['lembaga_id']), true)
            && ! in_array($data['tingkat'], \App\Services\RefService::kodeAktif('tingkat', null), true)) {
            return response()->json(['message' => 'Tingkat tidak dikenal.'], 422);
        }

        $kelas = Kelas::create($data);

        return response()->json($kelas, 201);
    }

    public function update(Request $request, Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->lembaga_id);

        $data = $request->validate([
            'tingkat' => ['nullable', 'string', 'max:20'],
            'nama_kelas' => ['sometimes', 'string', 'max:50'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
        ]);

        $kela->update($data);

        return response()->json($kela);
    }

    public function destroy(Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->lembaga_id);
        $kela->delete();

        return response()->json(['message' => 'Kelas dihapus.']);
    }
}
