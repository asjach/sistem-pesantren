<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\RefService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CRUD kamus berlapis per-lembaga (004, single-pesantren).
 * Global (lembaga null): tambah hanya super_admin.
 * Baris lembaga: admin kelola lembaganya (tambah/shadow on-off).
 * Guardrail: baris global HANYA boleh on/off per lembaga.
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
            'label' => 'nullable|string',
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
            // Custom lembaga: sifat netral (non-aktif, non-terminal); label/urutan ikut input.
            $id = DB::table($table)->insertGetId([
                'lembaga_id' => $targetLembaga, 'kode' => $data['kode'],
                'label' => $data['label'] ?? $data['kode'],
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
        return response()->json(DB::table($table)->find($id), 201);
    }

    public function destroy(Request $request, string $tipe, int $id)
    {
        $actor = $request->user();
        $table = RefService::table($tipe);
        $key = RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $row = DB::table($table)->find($id) ?? abort(404);

        if (is_null($row->lembaga_id)) {
            // Baris global: shadow off di lembaga actor (label/urutan ikut global).
            // Kolom label hanya ada di tabel status; generik pakai key saja.
            $targetLembaga = $this->mustLembaga($actor, $request->all());
            $shadow = ['urutan' => $row->urutan ?? 0, 'is_active' => false];
            if (in_array($tipe, ['status_awal', 'status_akhir'], true)) {
                $shadow['label'] = $row->label ?? null;
            }
            if ($tipe === 'status_akhir') {
                $shadow += ['is_aktif_bawaan' => false, 'terminal_ke' => null];
            }
            DB::table($table)->updateOrInsert(
                ['lembaga_id' => $targetLembaga, $key => $row->{$key}],
                $shadow
            );
            RefService::forget($targetLembaga);
            return response()->json(['pesan' => 'Data referensi berhasil dinonaktifkan']);
        }

        if (! $this->canLembaga($actor, (int) $row->lembaga_id)) abort(403);
        DB::table($table)->where('id', $id)->update(['is_active' => false]);
        RefService::forget($row->lembaga_id);
        return response()->json(['pesan' => 'Data referensi berhasil dinonaktifkan']);
    }

    /** Daftar tipe untuk dropdown FE. */
    public function types()
    {
        return response()->json(array_keys(RefService::KEY));
    }
}
