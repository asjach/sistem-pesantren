<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\TahunAjaran;
use App\Services\RefService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            // Mode tunggal (kompatibel lama) atau bulk via items (sub-form dialog).
            'nama_kelas' => ['required_without:items', 'string', 'max:50'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.nama_kelas' => ['required', 'string', 'max:50'],
            'items.*.tingkat' => ['nullable', 'string', 'max:20'],
            'items.*.kapasitas' => ['nullable', 'integer', 'min:1'],
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $tahun = TahunAjaran::findOrFail($data['tahun_ajaran_id']);
        if ((int) $tahun->lembaga_id !== (int) $data['lembaga_id']) {
            return response()->json(['message' => 'Tahun ajaran tidak se-lembaga dengan kelas.'], 422);
        }

        $items = isset($data['items'])
            ? array_values($data['items'])
            : [[
                'nama_kelas' => $data['nama_kelas'],
                'tingkat' => $data['tingkat'] ?? null,
                'kapasitas' => $data['kapasitas'] ?? null,
            ]];

        $dibuat = DB::transaction(function () use ($data, $items) {
            $rows = [];
            foreach ($items as $item) {
                $this->cekTingkat((int) $data['lembaga_id'], $item['tingkat'] ?? null);
                $rows[] = Kelas::create([
                    'lembaga_id' => (int) $data['lembaga_id'],
                    'tahun_ajaran_id' => (int) $data['tahun_ajaran_id'],
                    'nama_kelas' => $item['nama_kelas'],
                    'tingkat' => $item['tingkat'] ?? null,
                    'kapasitas' => $item['kapasitas'] ?? null,
                ]);
            }

            return $rows;
        });

        if (! isset($data['items'])) {
            return response()->json($dibuat[0], 201);
        }

        return response()->json(['pesan' => count($dibuat).' kelas dibuat.', 'data' => $dibuat], 201);
    }

    /** Validasi kamus no.50: tingkat via RefService efektif (null = semua). */
    protected function cekTingkat(int $lembagaId, ?string $tingkat): void
    {
        if (! empty($tingkat)
            && ! in_array($tingkat, RefService::kodeAktif('tingkat', $lembagaId), true)
            && ! in_array($tingkat, RefService::kodeAktif('tingkat', null), true)) {
            abort(response()->json(['message' => 'Tingkat tidak dikenal.'], 422));
        }
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
