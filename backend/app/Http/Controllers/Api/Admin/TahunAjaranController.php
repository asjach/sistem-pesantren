<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FB-004-01: tahun ajaran sebagai data pesantren (global) — mirip ref_*.
 * - super_admin: tambah/ubah/hapus/menambah TA global & menetapkan TA aktif.
 * - admin lembaga: hanya melihat TA yang berlaku + menyembunyikan/menampilkan
 *   untuk lembaganya sendiri (baris bayangan `is_active = false`).
 */
class TahunAjaranController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $auth = $request->user();
        $lembagaId = $request->filled('lembaga_id') ? (int) $request->input('lembaga_id') : null;
        if ($lembagaId !== null) {
            $this->authorizeLembaga($auth, $lembagaId);
        }

        $termasukNonaktif = $request->boolean('termasuk_nonaktif');

        // Tanpa lembaga_id: daftar TA global (kelola super_admin).
        if ($lembagaId === null) {
            $query = TahunAjaran::global()->with('lembaga:id,nama,kode');
        } else {
            // Tampilan efektif lembaga itu: baris lembaga menang atas baris global
            // yang punya nama sama (itulah mekanisme sembunyikan/tampilkan).
            $query = TahunAjaran::query()
                ->with('lembaga:id,nama,kode')
                ->where(function ($q) use ($lembagaId) {
                    $q->where('lembaga_id', $lembagaId)
                        ->orWhere(function ($qq) use ($lembagaId) {
                            $qq->whereNull('lembaga_id')->whereNotExists(function ($sub) use ($lembagaId) {
                                $sub->select(DB::raw(1))->from('tahun_ajaran as bayangan')
                                    ->whereColumn('bayangan.nama', 'tahun_ajaran.nama')
                                    ->where('bayangan.lembaga_id', $lembagaId);
                            });
                        });
                });
        }

        if ($request->filled('search')) {
            $query->where('nama', 'like', '%'.$request->input('search').'%');
        }

        // `termasuk_nonaktif`: sertakan baris bayangan (tersembunyi) agar halaman
        // bisa menampilkan tombol "Tampilkan kembali".
        if (! $termasukNonaktif) {
            $query->where('is_active', true);
        }

        return response()->json($query->orderByDesc('tanggal_mulai')->orderByDesc('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $auth = $request->user();
        if (! $auth->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran hanya super_admin.');
        }

        $data = $request->validate([
            'nama' => ['required', 'string', 'max:50'],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        if (TahunAjaran::global()->where('nama', $data['nama'])->exists()) {
            throw ValidationException::withMessages(['nama' => 'Nama tahun ajaran sudah ada.']);
        }

        $row = TahunAjaran::create([
            'lembaga_id' => null,
            'nama' => $data['nama'],
            'tanggal_mulai' => $data['tanggal_mulai'] ?? null,
            'tanggal_selesai' => $data['tanggal_selesai'] ?? null,
        ]);

        return response()->json($row, 201);
    }

    public function update(Request $request, TahunAjaran $tahunAjaran)
    {
        $auth = $request->user();
        if ($tahunAjaran->lembaga_id !== null || ! $auth->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran global hanya super_admin.');
        }

        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:50'],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date'],
        ]);

        if (isset($data['nama']) && $data['nama'] !== $tahunAjaran->nama
            && TahunAjaran::global()->where('nama', $data['nama'])->whereKeyNot($tahunAjaran->id)->exists()
        ) {
            throw ValidationException::withMessages(['nama' => 'Nama tahun ajaran sudah ada.']);
        }

        $tahunAjaran->update($data);

        return response()->json($tahunAjaran);
    }

    public function destroy(Request $request, TahunAjaran $tahunAjaran)
    {
        $auth = $request->user();

        // Baris bayangan lembaga: hapus = tampilkan kembali TA global.
        if ($tahunAjaran->lembaga_id !== null) {
            $this->authorizeLembaga($auth, (int) $tahunAjaran->lembaga_id);
            $tahunAjaran->delete();

            return response()->json(['message' => 'Tahun ajaran ditampilkan kembali.']);
        }

        if (! $auth->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran global hanya super_admin.');
        }

        if ($tahunAjaran->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak boleh dihapus.'], 422);
        }

        $tahunAjaran->delete();

        return response()->json(['message' => 'Tahun ajaran dihapus.']);
    }

    public function setAktif(Request $request, TahunAjaran $tahunAjaran)
    {
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Tahun ajaran hanya super_admin.');
        }
        if ($tahunAjaran->lembaga_id !== null) {
            return response()->json(['message' => 'Hanya tahun ajaran global yang bisa diaktifkan.'], 422);
        }

        DB::transaction(function () use ($tahunAjaran) {
            TahunAjaran::query()->update(['is_aktif' => false]);
            $tahunAjaran->update(['is_aktif' => true]);
        });

        return response()->json($tahunAjaran->fresh());
    }

    /** Sembunyikan TA global untuk lembaga actor (baris bayangan). */
    public function sembunyikan(Request $request, TahunAjaran $tahunAjaran)
    {
        $auth = $request->user();
        $lembagaId = $request->filled('lembaga_id')
            ? (int) $request->input('lembaga_id')
            : (int) ($auth->lembagaIds()[0] ?? 0);
        $this->authorizeLembaga($auth, $lembagaId);

        if ($tahunAjaran->lembaga_id !== null) {
            return response()->json(['message' => 'Hanya tahun ajaran global yang bisa disembunyikan.'], 422);
        }
        if ($tahunAjaran->is_aktif) {
            return response()->json(['message' => 'Tahun ajaran aktif tidak bisa disembunyikan.'], 422);
        }

        DB::transaction(function () use ($tahunAjaran, $lembagaId) {
            TahunAjaran::updateOrCreate(
                ['lembaga_id' => $lembagaId, 'nama' => $tahunAjaran->nama],
                ['is_active' => false, 'is_aktif' => false, 'tanggal_mulai' => null, 'tanggal_selesai' => null]
            );
        });

        return response()->json(['message' => 'Tahun ajaran disembunyikan untuk lembaga ini.']);
    }
}
