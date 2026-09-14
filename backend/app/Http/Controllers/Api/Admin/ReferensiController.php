<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\RefService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CRUD kamus berlapis per-lembaga (004, single-pesantren).
 * Global (lembaga null): tambah/ubah hanya super_admin.
 * Baris lembaga: admin kelola lembaganya (tambah/ubah/shadow on-off).
 * Guardrail: baris global HANYA boleh on/off per lembaga (via destroy).
 */
class ReferensiController extends Controller
{
    protected function mustLembaga($actor, array $data): int
    {
        if (! empty($data['lembaga_id'])) {
            $this->canLembaga($actor, (int) $data['lembaga_id']) || abort(403, 'Di luar lembaga Anda.');
            return (int) $data['lembaga_id'];
        }
        $ids = $actor->lembagaIds();
        if (count($ids) === 1) return (int) $ids[0];
        abort(422, 'lembaga_id wajib untuk admin non-global (nol/lebih dari satu akses).');
    }

    protected function canLembaga($actor, int $lembagaId): bool
    {
        return $actor->canAccessLembaga($lembagaId);
    }

    public function index(Request $request, string $tipe)
    {
        $actor = $request->user();
        $lembagaId = $request->integer('lembaga_id') ?: ($actor->lembagaIds()[0] ?? null);
        if (! is_null($lembagaId) && ! $this->canLembaga($actor, (int) $lembagaId)) abort(403);
        return response()->json(RefService::effective($tipe, $lembagaId));
    }

    public function store(Request $request, string $tipe)
    {
        $actor = $request->user();
        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);
        $key = RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');

        $data = $request->validate([
            'lembaga_id' => 'nullable|exists:lembaga,id',
            'nama' => 'required_without:kode|string',
            'kode' => 'required_without:nama|string',
            'urutan' => 'nullable|integer',
        ]);

        if ($isStatus && $request->hasAny(['is_aktif_bawaan', 'terminal_ke']) && ! $actor->hasRole('super_admin')) {
            abort(403, 'Sifat status hanya super_admin global.');
        }

        // super_admin tanpa lembaga_id = baris global; lainnya wajib lembaganya.
        $targetLembaga = $data['lembaga_id'] ?? null;
        if (is_null($targetLembaga)) {
            if (! $actor->hasRole('super_admin')) {
                $targetLembaga = $this->mustLembaga($actor, $data);
            }
        } elseif (! $this->canLembaga($actor, (int) $targetLembaga)) {
            abort(403);
        }

        $table = RefService::table($tipe);
        if ($isStatus) {
            // whereNull bila global: where('lembaga_id', null) tak pernah cocok di SQL.
            $q = DB::table($table)->where('kode', $data['kode']);
            is_null($targetLembaga)
                ? $q->whereNull('lembaga_id')
                : $q->where('lembaga_id', $targetLembaga);
            if ($q->first()) abort(422, 'Kode sudah ada.');
            // Custom lembaga: sifat netral (non-aktif, non-terminal); nama/urutan ikut input.
            $id = DB::table($table)->insertGetId([
                'lembaga_id' => $targetLembaga, 'kode' => $data['kode'],
                'nama' => $data['nama'] ?? $data['kode'],
                'is_aktif_bawaan' => false, 'terminal_ke' => null,
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ]);
        } else {
            // Cegah duplikat global (MySQL unique lolos NULL).
            if (is_null($targetLembaga) && DB::table($table)->whereNull('lembaga_id')->where('nama', $data['nama'])->exists()) {
                abort(422, 'Nilai global sudah ada.');
            }
            $id = DB::table($table)->insertGetId([
                'lembaga_id' => $targetLembaga, 'nama' => $data['nama'],
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ]);
        }

        RefService::forget($targetLembaga);
        RefService::forgetAlamat($targetLembaga);
        return response()->json(DB::table($table)->find($id), 201);
    }

    public function update(Request $request, string $tipe, int $id)
    {
        $actor = $request->user();
        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);
        RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $table = RefService::table($tipe);
        $row = DB::table($table)->find($id) ?? abort(404);

        if (is_null($row->lembaga_id)) {
            // Ubah baris global hanya super_admin; lembaga hanya boleh shadow on/off.
            if (! $actor->hasRole('super_admin')) abort(403, 'Baris global hanya super_admin.');
        } elseif (! $this->canLembaga($actor, (int) $row->lembaga_id)) {
            abort(403, 'Di luar lembaga Anda.');
        }

        // Kode (status) TIDAK diubah: kunci yang dipakai data pemakai.
        // Nama (status & kamus) boleh diubah walau konsumen string bebas tanpa FK.
        $data = $request->validate(['nama' => 'required|string', 'urutan' => 'nullable|integer']);

        $upd = ['urutan' => $data['urutan'] ?? $row->urutan];
        if (! $isStatus) {
            // Cegah bentrok nama di scope yang sama (global + lembaga sendiri).
            $q = DB::table($table)->where('nama', $data['nama'])->where('id', '!=', $id)
                ->where(function ($q) use ($row) {
                    $q->whereNull('lembaga_id');
                    if (! is_null($row->lembaga_id)) $q->orWhere('lembaga_id', $row->lembaga_id);
                });
            if ($q->exists()) abort(422, 'Nilai sudah ada.');
        }
        $upd['nama'] = $data['nama'];

        DB::table($table)->where('id', $id)->update($upd);
        RefService::forget($row->lembaga_id);
        RefService::forgetAlamat($row->lembaga_id);

        return response()->json(DB::table($table)->find($id));
    }

    public function destroy(Request $request, string $tipe, int $id)
    {
        $actor = $request->user();
        $table = RefService::table($tipe);
        $key = RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $row = DB::table($table)->find($id) ?? abort(404);

        if (is_null($row->lembaga_id)) {
            // Baris global: shadow off di lembaga actor (nama/urutan ikut global).
            // Semua tabel ref kini punya kolom `nama`; status memakai `kode` sebagai nilai.
            $targetLembaga = $this->mustLembaga($actor, $request->all());
            $shadow = ['nama' => $row->nama ?? null, 'urutan' => $row->urutan ?? 0, 'is_active' => false];
            if ($tipe === 'status_akhir') {
                $shadow += ['is_aktif_bawaan' => false, 'terminal_ke' => null];
            }
            DB::table($table)->updateOrInsert(
                ['lembaga_id' => $targetLembaga, $key => $row->{$key}],
                $shadow
            );
            RefService::forget($targetLembaga);
            RefService::forgetAlamat($targetLembaga);
            return response()->json(['pesan' => 'Data referensi berhasil dinonaktifkan']);
        }

        if (! $this->canLembaga($actor, (int) $row->lembaga_id)) abort(403);
        DB::table($table)->where('id', $id)->update(['is_active' => false]);
        RefService::forget($row->lembaga_id);
        RefService::forgetAlamat($row->lembaga_id);
        return response()->json(['pesan' => 'Data referensi berhasil dinonaktifkan']);
    }

    /** Daftar tipe untuk dropdown FE. */
    public function types()
    {
        return response()->json(array_keys(RefService::KEY));
    }
}
