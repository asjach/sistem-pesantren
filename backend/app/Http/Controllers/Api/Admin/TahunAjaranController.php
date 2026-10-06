<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TahunAjaranStoreRequest;
use App\Http\Requests\Admin\TahunAjaranUpdateRequest;
use App\Http\Requests\Admin\TahunAjaranVisibilitasRequest;
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
        $lembagaIds = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($auth, $lembagaIds);

        $termasukNonaktif = $request->boolean('termasuk_nonaktif');
        $pivot = collect();
        $hiddenPerLembaga = [];
        if (count($lembagaIds) === 1) {
            $pivot = LembagaTahunAjaran::where('jenjang', $lembagaIds[0])->pluck('is_active', 'tahun_ajaran');
            $hiddenPerLembaga[$lembagaIds[0]] = $pivot->filter(fn ($aktif) => ! $aktif)->keys()->all();
        } elseif ($lembagaIds !== []) {
            foreach ($lembagaIds as $lembagaId) {
                $hiddenPerLembaga[$lembagaId] = LembagaTahunAjaran::where('jenjang', $lembagaId)
                    ->where('is_active', false)
                    ->pluck('tahun_ajaran')
                    ->all();
            }
        }

        $query = TahunAjaran::query();
        $this->applyFilter($query, $request, 'tahun_ajaran', 'nama');

        // `termasuk_nonaktif`: sertakan TA tersembunyi agar halaman bisa
        // menampilkan tombol "Tampilkan kembali".
        if ($lembagaIds !== [] && ! $termasukNonaktif) {
            $query->where(function ($q) use ($hiddenPerLembaga) {
                foreach ($hiddenPerLembaga as $names) {
                    if ($names === []) {
                        $q->orWhereRaw('1 = 1');
                    } else {
                        $q->orWhereNotIn('nama', $names);
                    }
                }
            });
        }

        if ($request->filled('search')) {
            $query->where('nama', 'like', '%'.$request->input('search').'%');
        }

        $this->terapkanUrut($query, $urut, [
            ['tahun_ajaran.is_aktif', 'turun'], ['tahun_ajaran.tanggal_mulai', 'turun'], ['tahun_ajaran.nama', 'turun'],
        ], self::SORT_NULLABLE);

        $hasil = $query->paginate($this->perPage($request));

        if ($lembagaIds !== []) {
            $hasil->getCollection()->transform(function (TahunAjaran $t) use ($hiddenPerLembaga, $lembagaIds) {
                $tampil = false;
                foreach ($lembagaIds as $lembagaId) {
                    if (! in_array($t->nama, $hiddenPerLembaga[$lembagaId] ?? [], true)) {
                        $tampil = true;
                        break;
                    }
                }
                $t->setAttribute('tampil', $tampil);

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
    public function sembunyikan(TahunAjaranVisibilitasRequest $request)
    {
        $auth = $request->user();
        $data = $request->validated();
        $lembagaId = $data['jenjang'] ?? ($auth->lembagaIds()[0] ?? null);
        if ($lembagaId === null) {
            abort(422, 'jenjang wajib.');
        }
        $this->authorizeLembaga($auth, $lembagaId);

        $row = TahunAjaran::findOrFail($data['nama']);
        if ($row->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak bisa disembunyikan.'], 422);
        }

        LembagaTahunAjaran::updateOrCreate(
            ['jenjang' => $lembagaId, 'tahun_ajaran' => $row->nama],
            ['is_active' => false]
        );

        return response()->json(['message' => 'Tahun ajaran disembunyikan untuk lembaga ini.']);
    }

    /** Tampilkan kembali TA untuk satu lembaga (hapus baris pivot). */
    public function tampilkan(TahunAjaranVisibilitasRequest $request)
    {
        $auth = $request->user();
        $data = $request->validated();
        $lembagaId = $data['jenjang'] ?? ($auth->lembagaIds()[0] ?? null);
        if ($lembagaId === null) {
            abort(422, 'jenjang wajib.');
        }
        $this->authorizeLembaga($auth, $lembagaId);

        LembagaTahunAjaran::where('jenjang', $lembagaId)
            ->where('tahun_ajaran', $data['nama'])
            ->delete();

        return response()->json(['message' => 'Tahun ajaran ditampilkan kembali.']);
    }
}
