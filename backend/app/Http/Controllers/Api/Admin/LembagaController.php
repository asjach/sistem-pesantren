<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LembagaStoreRequest;
use App\Http\Requests\Admin\LembagaUpdateRequest;
use App\Models\Lembaga;
use App\Services\RefService;
use App\Services\UrutKatalog;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Master lembaga (single-pesantren, 004).
 * Identitas pesantren = baris root (kode=PESANTREN, parent_id=null).
 * Tenant: index via scopeTenantScope; aksi via canAccessLembaga.
 */
class LembagaController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['lembaga.kode', 'induk.nama'];

    public function index(Request $request)
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('lembaga'));

        $query = Lembaga::tenantScope()->with('parent:id,nama,kode');

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('nama', 'like', "%{$s}%")->orWhere('kode', 'like', "%{$s}%"));
        }

        if ($urut !== null) {
            $query->select('lembaga.*')
                ->leftJoin('lembaga as induk', 'induk.id', '=', 'lembaga.parent_id');
        }
        $this->terapkanUrut($query, $urut, [['lembaga.nama', 'naik']], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(LembagaStoreRequest $request)
    {
        $auth = auth()->user();
        // Tambah lembaga hanya super_admin (Lampiran E v1.9.2).
        if (! $auth->bolehSuperAdmin()) {
            return response()->json(['message' => 'Hanya super_admin yang dapat menambah lembaga.'], 403);
        }

        $data = $request->validated();
        $this->pastikanKelompokSesuaiKode($data['kode'] ?? null, $data['kelompok_psb'] ?? null);

        if (! empty($data['parent_id'])) {
            $this->authorizeLembaga($auth, (int) $data['parent_id']);
        }

        $lembaga = Lembaga::create($data);

        // Lembaga operasional baru: benih kamus dari nilai yang sudah ada
        // (tanpa baris global, kamus lembaga baru kosong tanpa ini).
        if (! is_null($lembaga->parent_id)) {
            RefService::benihUntuk($lembaga->id);
        }

        return response()->json($lembaga->load('parent:id,nama,kode'), 201);
    }

    public function update(LembagaUpdateRequest $request, Lembaga $lembaga)
    {
        $this->authorizeLembaga(auth()->user(), $lembaga->id);

        $data = $request->validated();

        $this->pastikanKelompokSesuaiKode($data['kode'] ?? $lembaga->kode, $data['kelompok_psb'] ?? null);

        if (! empty($data['parent_id'])) {
            $this->authorizeLembaga(auth()->user(), (int) $data['parent_id']);
        }

        $lembaga->update($data);

        return response()->json($lembaga);
    }

    /** Combo MI-MD hanya untuk lembaga berkode MI/MD; selain itu eksklusif. */
    protected function pastikanKelompokSesuaiKode(?string $kode, ?string $kelompok): void
    {
        if ($kelompok !== 'combo_mi_md') {
            return;
        }
        if (! in_array(strtoupper((string) $kode), ['MI', 'MD'], true)) {
            throw ValidationException::withMessages([
                'kelompok_psb' => 'Combo MI-MD hanya untuk lembaga berkode MI atau MD.',
            ]);
        }
    }

    public function destroy(Lembaga $lembaga)
    {
        $auth = auth()->user();
        if (! $auth->can('lembaga.hapus')) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        $this->authorizeLembaga($auth, $lembaga->id);

        $lembaga->delete();

        return response()->json(['message' => 'Lembaga dihapus.']);
    }
}
