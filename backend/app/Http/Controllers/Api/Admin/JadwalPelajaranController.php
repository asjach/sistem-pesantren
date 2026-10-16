<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\JadwalPelajaran;
use App\Models\Kelas;
use App\Models\PengampuMapel;
use App\Models\SlotJamPelajaran;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Jadwal pelajaran (BLOK 5, Modul 502): slot jam per jenjang + jadwal per kelas.
 *
 *  Penjaga bentrok (di luar unique DB `pengampu × slot × hari`):
 *  - satu KELAS tak boleh punya dua pelajaran pada hari + slot yang sama;
 *  - satu GURU tak boleh mengajar dua kelas pada hari + slot yang sama.
 */
class JadwalPelajaranController extends Controller
{
    use TenantGuard;

    // ========================================================== SLOT JAM

    /** GET /admin/kurikulum/slot?jenjang= */
    public function indexSlot(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);

        return response()->json(
            SlotJamPelajaran::where('jenjang', $jenjang)
                ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
                ->get()
        );
    }

    /** POST /admin/kurikulum/slot */
    public function storeSlot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'nama_slot' => ['nullable', 'string', 'max:50'],
            'jam_mulai' => ['nullable', 'date_format:H:i'],
            'jam_selesai' => ['nullable', 'date_format:H:i', 'after:jam_mulai'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json(SlotJamPelajaran::create($data), 201);
    }

    /** PUT /admin/kurikulum/slot/{slot} */
    public function updateSlot(Request $request, SlotJamPelajaran $slot): JsonResponse
    {
        $data = $request->validate([
            'nama_slot' => ['nullable', 'string', 'max:50'],
            'jam_mulai' => ['nullable', 'date_format:H:i'],
            'jam_selesai' => ['nullable', 'date_format:H:i'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        $this->authorizeLembaga($request->user(), $slot->jenjang);
        $slot->update($data);

        return response()->json($slot->fresh());
    }

    /** DELETE /admin/kurikulum/slot/{slot} */
    public function destroySlot(Request $request, SlotJamPelajaran $slot): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $slot->jenjang);
        if (JadwalPelajaran::where('slot_jam_id', $slot->id)->exists()) {
            abort(422, 'Slot masih dipakai jadwal. Hapus jadwalnya dulu.');
        }
        $slot->delete();

        return response()->json(['pesan' => 'Slot jam dihapus.']);
    }

    // =========================================================== JADWAL

    /** GET /admin/kurikulum/jadwal?kelas_id= */
    public function indexJadwal(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $slot = SlotJamPelajaran::where('jenjang', $kelas->jenjang)
            ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get(['id', 'nama_slot', 'jam_mulai', 'jam_selesai', 'urutan']);

        $baris = JadwalPelajaran::with([
            'pengampuMapel.mataPelajaran:id,nama_mapel',
            'pengampuMapel.keaktifan.pegawai:id,nama_lengkap,gelar_depan,gelar_belakang,jenis_kelamin',
        ])
            ->whereIn('pengampu_mapel_id', PengampuMapel::where('kelas_id', $kelas->id)->pluck('id'))
            ->get()
            ->map(fn (JadwalPelajaran $j) => [
                'id' => $j->id,
                'hari' => $j->hari,
                'slot_jam_id' => $j->slot_jam_id,
                'pengampu_mapel_id' => $j->pengampu_mapel_id,
                'nama_mapel' => $j->pengampuMapel?->mataPelajaran?->nama_mapel,
                'guru' => $j->pengampuMapel?->keaktifan?->pegawai?->nama_lengkap,
                'ruangan' => $j->ruangan,
            ])
            ->values();

        // Pengampu kelas ini yang belum terjadwal — untuk pilihan di sel.
        $terjadwal = $baris->pluck('pengampu_mapel_id')->unique();
        $pengampu = PengampuMapel::with('mataPelajaran:id,nama_mapel')
            ->where('kelas_id', $kelas->id)
            ->whereNotIn('id', $terjadwal)
            ->get()
            ->map(fn (PengampuMapel $p) => [
                'id' => $p->id,
                'nama_mapel' => $p->mataPelajaran?->nama_mapel,
            ])->values();

        return response()->json([
            'kelas' => ['id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas, 'tingkat' => $kelas->tingkat, 'jenjang' => $kelas->jenjang],
            'hari' => JadwalPelajaran::HARI,
            'slot' => $slot,
            'baris' => $baris,
            'belum_terjadwal' => $pengampu,
        ]);
    }

    /** POST /admin/kurikulum/jadwal */
    public function storeJadwal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pengampu_mapel_id' => ['required', 'integer', 'exists:pengampu_mapel,id'],
            'slot_jam_id' => ['required', 'integer', 'exists:slot_jam_pelajaran,id'],
            'hari' => ['required', 'in:'.implode(',', JadwalPelajaran::HARI)],
            'ruangan' => ['nullable', 'string', 'max:50'],
        ]);

        $pengampu = PengampuMapel::with('kelas')->findOrFail($data['pengampu_mapel_id']);
        $kelas = $pengampu->kelas;
        if ($kelas === null) {
            throw ValidationException::withMessages(['pengampu_mapel_id' => 'Pengampu tidak punya kelas.']);
        }
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $slot = SlotJamPelajaran::findOrFail($data['slot_jam_id']);
        if ($slot->jenjang !== $kelas->jenjang) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam harus sejenjang dengan kelas.']);
        }

        // Satu kelas: satu pelajaran per hari + slot.
        $bentrokKelas = JadwalPelajaran::where('slot_jam_id', $slot->id)
            ->where('hari', $data['hari'])
            ->whereIn('pengampu_mapel_id', PengampuMapel::where('kelas_id', $kelas->id)->pluck('id'))
            ->exists();
        if ($bentrokKelas) {
            throw ValidationException::withMessages([
                'slot_jam_id' => "Kelas {$kelas->nama_kelas} sudah punya pelajaran pada {$data['hari']} slot itu.",
            ]);
        }

        // Satu guru: tidak mengajar dua kelas pada hari + slot yang sama.
        if ($pengampu->keaktifan_pegawai_id !== null) {
            $bentrokGuru = JadwalPelajaran::where('slot_jam_id', $slot->id)
                ->where('hari', $data['hari'])
                ->whereIn('pengampu_mapel_id', PengampuMapel::where('keaktifan_pegawai_id', $pengampu->keaktifan_pegawai_id)->pluck('id'))
                ->exists();
            if ($bentrokGuru) {
                throw ValidationException::withMessages([
                    'pengampu_mapel_id' => "Guru ini sudah mengajar pada {$data['hari']} slot itu.",
                ]);
            }
        }

        return response()->json(JadwalPelajaran::create($data), 201);
    }

    /** DELETE /admin/kurikulum/jadwal/{jadwal} */
    public function destroyJadwal(Request $request, JadwalPelajaran $jadwal): JsonResponse
    {
        $jenjang = $jadwal->pengampuMapel?->kelas?->jenjang;
        if ($jenjang === null) {
            abort(404);
        }
        $this->authorizeLembaga($request->user(), $jenjang);
        $jadwal->delete();

        return response()->json(['pesan' => 'Jadwal dihapus.']);
    }

    private function jenjangWajib(Request $request): string
    {
        $jenjang = $this->nilaiFilter($request, 'jenjang');
        if (count($jenjang) !== 1) {
            throw ValidationException::withMessages(['jenjang' => 'Pilih satu jenjang (lembaga).']);
        }
        $this->authorizeLembaga($request->user(), $jenjang[0]);

        return $jenjang[0];
    }
}
