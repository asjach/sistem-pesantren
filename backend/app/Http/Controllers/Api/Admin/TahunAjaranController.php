<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TahunAjaranStoreRequest;
use App\Http\Requests\Admin\TahunAjaranUpdateRequest;
use App\Models\LembagaTahunAjaran;
use App\Models\TahunAjaran;
use App\Services\UrutKatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FB-004-01: tahun ajaran sebagai data pesantren (global, kunci `nama`).
 * - super_admin: tambah/ubah/hapus TA + menetapkan TA aktif.
 * - admin lembaga: hanya melihat TA yang berlaku + menyembunyikan/menampilkan
 *   untuk lembaganya sendiri (pivot `lembaga_tahun_ajaran`).
 *
 * `nama` memuat '/', jadi aksi tulis memakai kunci di body (bukan segmen URL).
 */
class TahunAjaranController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['tahun_ajaran.tanggal_mulai', 'tahun_ajaran.tanggal_selesai'];

    public function index(Request $request)
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('tahun_ajaran'));

        $auth = $request->user();
        $lembagaId = $request->filled('lembaga_id') ? (int) $request->input('lembaga_id') : null;
        if ($lembagaId !== null) {
            $this->authorizeLembaga($auth, $lembagaId);
        }

        $termasukNonaktif = $request->boolean('termasuk_nonaktif');

        $pivot = $lembagaId === null
            ? collect()
            : LembagaTahunAjaran::where('lembaga_id', $lembagaId)->pluck('is_active', 'tahun_ajaran');

        $query = TahunAjaran::query();

        // `termasuk_nonaktif`: sertakan TA tersembunyi agar halaman bisa
        // menampilkan tombol "Tampilkan kembali".
        if ($lembagaId !== null && ! $termasukNonaktif) {
            $query->whereNotIn('nama', $pivot->filter(fn ($aktif) => ! $aktif)->keys());
        }

        if ($request->filled('search')) {
            $query->where('nama', 'like', '%'.$request->input('search').'%');
        }

        $this->terapkanUrut($query, $urut, [
            ['tahun_ajaran.is_aktif', 'turun'], ['tahun_ajaran.tanggal_mulai', 'turun'], ['tahun_ajaran.nama', 'turun'],
        ], self::SORT_NULLABLE);

        $hasil = $query->paginate($this->perPage($request));

        if ($lembagaId !== null) {
            $hasil->getCollection()->transform(function (TahunAjaran $t) use ($pivot) {
                $t->setAttribute('tampil', $pivot->has($t->nama) ? (bool) $pivot[$t->nama] : true);

                return $t;
            });
        }

        return response()->json($hasil);
    }

    public function store(TahunAjaranStoreRequest $request)
    {
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran hanya super_admin.');
        }

        $data = $request->validated();
        $nama = TahunAjaran::normalisasiNama($data['nama']);

        if (TahunAjaran::whereKey($nama)->exists()) {
            throw ValidationException::withMessages(['nama' => 'Nama tahun ajaran sudah ada.']);
        }

        $row = TahunAjaran::create([
            'nama' => $nama,
            'tanggal_mulai' => $data['tanggal_mulai'] ?? null,
            'tanggal_selesai' => $data['tanggal_selesai'] ?? null,
        ]);

        return response()->json($row, 201);
    }

    public function update(TahunAjaranUpdateRequest $request)
    {
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran global hanya super_admin.');
        }

        $data = $request->validated();
        $row = TahunAjaran::findOrFail($data['nama']);

        $perubahan = [];
        if (! empty($data['nama_baru'])) {
            $namaBaru = TahunAjaran::normalisasiNama($data['nama_baru']);
            if ($namaBaru !== $row->nama) {
                if (TahunAjaran::whereKey($namaBaru)->exists()) {
                    throw ValidationException::withMessages(['nama_baru' => 'Nama tahun ajaran sudah ada.']);
                }
                $perubahan['nama'] = $namaBaru;
            }
        }
        foreach (['tanggal_mulai', 'tanggal_selesai'] as $kolom) {
            if (array_key_exists($kolom, $data)) {
                $perubahan[$kolom] = $data[$kolom];
            }
        }

        if ($perubahan !== []) {
            $row->update($perubahan);
        }

        return response()->json($row->fresh());
    }

    public function destroy(Request $request)
    {
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran global hanya super_admin.');
        }

        $data = $request->validate(['nama' => ['required', 'string']]);
        $row = TahunAjaran::findOrFail($data['nama']);

        if ($row->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak boleh dihapus.'], 422);
        }

        $row->delete();

        return response()->json(['message' => 'Tahun ajaran dihapus.']);
    }

    public function setAktif(Request $request)
    {
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran hanya super_admin.');
        }

        $data = $request->validate([
            'nama' => ['required', 'string'],
        ]);
        $row = TahunAjaran::findOrFail($data['nama']);

        DB::transaction(function () use ($row) {
            TahunAjaran::query()->update(['is_aktif' => false]);
            $row->update(['is_aktif' => true]);
        });

        return response()->json($row->fresh());
    }

    /** Sembunyikan TA untuk satu lembaga (pivot is_active = false). */
    public function sembunyikan(Request $request)
    {
        $auth = $request->user();
        $data = $request->validate([
            'nama' => ['required', 'string'],
            'lembaga_id' => ['nullable', 'integer', 'exists:lembaga,id'],
        ]);
        $lembagaId = $data['lembaga_id'] ?? (int) ($auth->lembagaIds()[0] ?? 0);
        $this->authorizeLembaga($auth, $lembagaId);

        $row = TahunAjaran::findOrFail($data['nama']);
        if ($row->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak bisa disembunyikan.'], 422);
        }

        LembagaTahunAjaran::updateOrCreate(
            ['lembaga_id' => $lembagaId, 'tahun_ajaran' => $row->nama],
            ['is_active' => false]
        );

        return response()->json(['message' => 'Tahun ajaran disembunyikan untuk lembaga ini.']);
    }

    /** Tampilkan kembali TA untuk satu lembaga (hapus baris pivot). */
    public function tampilkan(Request $request)
    {
        $auth = $request->user();
        $data = $request->validate([
            'nama' => ['required', 'string'],
            'lembaga_id' => ['nullable', 'integer', 'exists:lembaga,id'],
        ]);
        $lembagaId = $data['lembaga_id'] ?? (int) ($auth->lembagaIds()[0] ?? 0);
        $this->authorizeLembaga($auth, $lembagaId);

        LembagaTahunAjaran::where('lembaga_id', $lembagaId)
            ->where('tahun_ajaran', $data['nama'])
            ->delete();

        return response()->json(['message' => 'Tahun ajaran ditampilkan kembali.']);
    }
}
