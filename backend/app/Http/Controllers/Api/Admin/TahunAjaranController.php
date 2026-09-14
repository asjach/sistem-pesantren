<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
            // Satu atau banyak lembaga (multi-chip di UI); minimal satu wajib ada.
            'lembaga_id' => ['required_without:lembaga_ids', 'integer', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'lembaga_ids' => ['required_without:lembaga_id', 'array', 'min:1'],
            'lembaga_ids.*' => ['integer', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nama' => ['required', 'string', 'max:50'],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
            'lembaga_ids.*.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);

        $auth = auth()->user();
        $ids = isset($data['lembaga_ids'])
            ? collect($data['lembaga_ids'])->map(fn ($id) => (int) $id)->unique()->values()->all()
            : [(int) $data['lembaga_id']];

        $dibuat = DB::transaction(function () use ($auth, $ids, $data) {
            $rows = [];
            foreach ($ids as $lembagaId) {
                $this->authorizeLembaga($auth, $lembagaId);
                if (TahunAjaran::where('lembaga_id', $lembagaId)->where('nama', $data['nama'])->exists()) {
                    throw ValidationException::withMessages([
                        'nama' => "Nama tahun ajaran sudah dipakai di lembaga {$lembagaId}.",
                    ]);
                }
                $rows[] = TahunAjaran::create([
                    'lembaga_id' => $lembagaId,
                    'nama' => $data['nama'],
                    'tanggal_mulai' => $data['tanggal_mulai'] ?? null,
                    'tanggal_selesai' => $data['tanggal_selesai'] ?? null,
                ]);
            }

            return $rows;
        });

        if (! isset($data['lembaga_ids'])) {
            return response()->json($dibuat[0], 201);
        }

        return response()->json(['pesan' => count($dibuat).' tahun ajaran dibuat.', 'data' => $dibuat], 201);
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
