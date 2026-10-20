<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\JadwalPelajaran;
use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\PengampuMapel;
use App\Models\SlotJamPelajaran;
use App\Models\TemplateJadwal;
use App\Models\TemplateJadwalBaris;
use App\Models\VarianJadwal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
            'jenis' => ['nullable', 'in:'.implode(',', SlotJamPelajaran::JENIS)],
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
            'jenis' => ['nullable', 'in:'.implode(',', SlotJamPelajaran::JENIS)],
            'jam_mulai' => ['nullable', 'date_format:H:i'],
            'jam_selesai' => ['nullable', 'date_format:H:i'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        $this->authorizeLembaga($request->user(), $slot->jenjang);
        if ($slot->kelas_id !== null) {
            $this->pastikanJadwalTerbuka(Kelas::findOrFail($slot->kelas_id));
        }

        $jenisBaru = $data['jenis'] ?? $slot->jenis;
        if ($jenisBaru !== 'pelajaran' && $jenisBaru !== $slot->jenis
            && JadwalPelajaran::where('slot_jam_id', $slot->id)->exists()) {
            throw ValidationException::withMessages([
                'jenis' => 'Slot masih punya jadwal pelajaran — hapus jadwalnya dulu.',
            ]);
        }

        $slot->update($data);

        return response()->json($slot->fresh());
    }

    /** DELETE /admin/kurikulum/slot/{slot} */
    public function destroySlot(Request $request, SlotJamPelajaran $slot): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $slot->jenjang);
        if ($slot->kelas_id !== null) {
            $this->pastikanJadwalTerbuka(Kelas::findOrFail($slot->kelas_id));
        }
        if (JadwalPelajaran::where('slot_jam_id', $slot->id)->exists()) {
            abort(422, 'Slot masih dipakai jadwal. Hapus jadwalnya dulu.');
        }
        $slot->delete();

        return response()->json(['pesan' => 'Slot jam dihapus.']);
    }

    /**
     * Hari aktif (belajar) + hari libur mingguan sebuah lembaga.
     *
     * @return array{aktif: list<string>, libur: list<string>}
     */
    private function hariLembaga(string $jenjang): array
    {
        $libur = Lembaga::where('jenjang', $jenjang)->value('hari_libur');
        if (! is_array($libur)) {
            $libur = [];
        }
        $libur = array_values(array_intersect(
            array_map(fn ($h) => mb_strtolower(trim((string) $h)), $libur),
            JadwalPelajaran::HARI,
        ));

        return ['aktif' => JadwalPelajaran::hariAktif($libur), 'libur' => $libur];
    }

    /** GET /admin/kurikulum/hari-libur?jenjang= — hari aktif + libur lembaga. */
    public function indexHariLibur(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $hari = $this->hariLembaga($jenjang);

        return response()->json([
            'jenjang' => $jenjang,
            'semua_hari' => JadwalPelajaran::HARI,
            'hari_aktif' => $hari['aktif'],
            'hari_libur' => $hari['libur'],
        ]);
    }

    /**
     * PUT /admin/kurikulum/hari-libur — simpan hari libur mingguan lembaga.
     * Menolak bila mengubah hari yang masih punya jadwal terisi (hapus/pindah
     * dulu jadwalnya agar tak ada pelajaran di hari libur).
     */
    public function simpanHariLibur(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'hari_libur' => ['nullable', 'array'],
            'hari_libur.*' => ['string', 'in:'.implode(',', JadwalPelajaran::HARI)],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $baru = array_values(array_unique(array_map(
            fn ($h) => mb_strtolower(trim((string) $h)),
            $data['hari_libur'] ?? [],
        )));

        if (count($baru) >= count(JadwalPelajaran::HARI)) {
            throw ValidationException::withMessages([
                'hari_libur' => 'Minimal satu hari harus tetap aktif (tidak libur).',
            ]);
        }

        $lama = $this->hariLembaga($data['jenjang'])['libur'];
        $tambahan = array_values(array_diff($baru, $lama));

        if ($tambahan !== []) {
            $terisi = JadwalPelajaran::whereHas(
                'kelas',
                fn ($q) => $q->where('jenjang', $data['jenjang']),
            )
                ->whereIn('hari', $tambahan)
                ->distinct()->pluck('hari')->all();
            if ($terisi !== []) {
                throw ValidationException::withMessages([
                    'hari_libur' => 'Hari '.implode(', ', $terisi).' masih punya jadwal terisi — hapus/pindahkan dulu jadwalnya.',
                ]);
            }
        }

        Lembaga::where('jenjang', $data['jenjang'])->update(['hari_libur' => $baru]);
        $hasil = $this->hariLembaga($data['jenjang']);

        return response()->json([
            'pesan' => 'Hari libur disimpan.',
            'jenjang' => $data['jenjang'],
            'hari_aktif' => $hasil['aktif'],
            'hari_libur' => $hasil['libur'],
        ]);
    }

    /** GET /admin/kurikulum/jadwal?kelas_id= */
    public function indexJadwal(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $slotKelas = SlotJamPelajaran::where('kelas_id', $kelas->id)
            ->orderBy('urutan')->orderBy('hari')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get(['id', 'kelas_id', 'hari', 'nama_slot', 'jenis', 'jam_mulai', 'jam_selesai', 'urutan']);
        $slot = $slotKelas->isNotEmpty()
            ? $slotKelas
            : SlotJamPelajaran::whereNull('kelas_id')->where('jenjang', $kelas->jenjang)
                ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
                ->get(['id', 'kelas_id', 'hari', 'nama_slot', 'jenis', 'jam_mulai', 'jam_selesai', 'urutan']);

        $baris = JadwalPelajaran::with([
            'pengampuMapel.mataPelajaran:id,nama_mapel,kode_mapel,singkatan',
            'pengampuMapel.keaktifan.pegawai:id,nama_lengkap,nama_panggilan,nama_singkat,gelar_depan,gelar_belakang,jenis_kelamin',
            'keaktifan.pegawai:id,nama_lengkap,nama_panggilan,nama_singkat,gelar_depan,gelar_belakang,jenis_kelamin',
        ])
            ->where('kelas_id', $kelas->id)
            ->get()
            ->map(fn (JadwalPelajaran $j) => [
                'id' => $j->id,
                'hari' => $j->hari,
                'slot_jam_id' => $j->slot_jam_id,
                'pengampu_mapel_id' => $j->pengampu_mapel_id,
                'mata_pelajaran_id' => $j->pengampuMapel?->mata_pelajaran_id,
                'keaktifan_pegawai_id' => $j->pengampuMapel?->keaktifan_pegawai_id
                    ?? $j->keaktifan_pegawai_id,
                'nama_mapel' => $j->pengampuMapel?->mataPelajaran?->nama_mapel,
                'kode_mapel' => $j->pengampuMapel?->mataPelajaran?->kode_mapel,
                'singkatan' => $j->pengampuMapel?->mataPelajaran?->singkatan,
                'guru' => $j->pengampuMapel?->keaktifan?->pegawai?->nama_lengkap
                    ?? $j->keaktifan?->pegawai?->nama_lengkap,
                'guru_nama_panggilan' => $j->pengampuMapel?->keaktifan?->pegawai?->nama_panggilan
                    ?? $j->keaktifan?->pegawai?->nama_panggilan,
                'guru_nama_singkat' => $j->pengampuMapel?->keaktifan?->pegawai?->nama_singkat
                    ?? $j->keaktifan?->pegawai?->nama_singkat,
                'guru_gelar_depan' => $j->pengampuMapel?->keaktifan?->pegawai?->gelar_depan
                    ?? $j->keaktifan?->pegawai?->gelar_depan,
                'guru_gelar_belakang' => $j->pengampuMapel?->keaktifan?->pegawai?->gelar_belakang
                    ?? $j->keaktifan?->pegawai?->gelar_belakang,
                'guru_jenis_kelamin' => $j->pengampuMapel?->keaktifan?->pegawai?->jenis_kelamin
                    ?? $j->keaktifan?->pegawai?->jenis_kelamin,
                'guru_pegawai_id' => $j->pengampuMapel?->keaktifan?->pegawai_id
                    ?? $j->keaktifan?->pegawai_id,
                'guru_saja' => $j->pengampu_mapel_id === null,
                'ruangan' => $j->ruangan,
            ])
            ->values();

        $terjadwal = $baris->pluck('pengampu_mapel_id')->filter()->unique();
        $pengampu = PengampuMapel::with(['mataPelajaran:id,nama_mapel', 'keaktifan.pegawai:id,nama_lengkap'])
            ->where('kelas_id', $kelas->id)
            ->get()
            ->map(fn (PengampuMapel $p) => [
                'id' => $p->id,
                'nama_mapel' => $p->mataPelajaran?->nama_mapel,
                'guru' => $p->keaktifan?->pegawai?->nama_lengkap,
            ])->values();

        $belum = $pengampu->reject(
            fn (array $p) => $terjadwal->contains($p['id']),
        )->values();

        $hari = $this->hariLembaga($kelas->jenjang);

        return response()->json([
            'kelas' => ['id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas, 'tingkat' => $kelas->tingkat, 'jenjang' => $kelas->jenjang],
            'hari' => $hari['aktif'],
            'hari_libur' => $hari['libur'],
            'slot' => $slot,
            'baris' => $baris,
            'pengampu' => $pengampu,
            'belum_terjadwal' => $belum,
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
        $this->pastikanJadwalTerbuka($kelas);

        $slot = SlotJamPelajaran::findOrFail($data['slot_jam_id']);
        if ($slot->jenjang !== $kelas->jenjang) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam harus sejenjang dengan kelas.']);
        }
        if ($slot->kelas_id !== null && (int) $slot->kelas_id !== $kelas->id) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam ini milik kelas lain.']);
        }
        if ($slot->hari !== null && $slot->hari !== $data['hari']) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam ini hanya untuk hari '.$slot->hari.'.']);
        }
        if ($slot->jenis !== 'pelajaran') {
            throw ValidationException::withMessages([
                'slot_jam_id' => 'Slot ini waktu '.$slot->jenis.' — tidak bisa diisi pelajaran.',
            ]);
        }

        $hari = $this->hariLembaga($kelas->jenjang);
        if (! in_array($data['hari'], $hari['aktif'], true)) {
            throw ValidationException::withMessages([
                'hari' => "Hari {$data['hari']} adalah hari libur mingguan lembaga ini.",
            ]);
        }

        if ($this->slotBentrok($slot, $data['hari'], $kelas->id, null)) {
            throw ValidationException::withMessages([
                'slot_jam_id' => "Kelas {$kelas->nama_kelas} sudah punya pelajaran pada {$data['hari']} jam itu.",
            ]);
        }

        if ($pengampu->keaktifan_pegawai_id !== null
            && $this->slotBentrok($slot, $data['hari'], null, $pengampu->keaktifan_pegawai_id)) {
            throw ValidationException::withMessages([
                'pengampu_mapel_id' => "Guru ini sudah mengajar pada {$data['hari']} jam itu.",
            ]);
        }

        return response()->json(JadwalPelajaran::create($data + ['kelas_id' => $kelas->id]), 201);
    }

    /**
     * PUT /admin/kurikulum/jadwal/sel
     * Isi/kosongkan satu sel dengan mapel + guru. Pengampu kelas (kelas-mapel)
     * dibuat/diperbarui dari pilihan ini; bentrok waktu tetap ditolak.
     */
    public function simpanSelJadwal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas_id' => ['required', 'integer', 'exists:kelas,id'],
            'slot_jam_id' => ['required', 'integer', 'exists:slot_jam_pelajaran,id'],
            'hari' => ['required', 'in:'.implode(',', JadwalPelajaran::HARI)],
            'mata_pelajaran_id' => ['nullable', 'integer', 'exists:mata_pelajaran,id'],
            'keaktifan_pegawai_id' => ['nullable', 'integer', 'exists:keaktifan_pegawai,id'],
        ]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);
        $this->pastikanJadwalTerbuka($kelas);

        $slot = SlotJamPelajaran::findOrFail($data['slot_jam_id']);
        if ($slot->jenjang !== $kelas->jenjang) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam harus sejenjang dengan kelas.']);
        }
        if ($slot->kelas_id !== null && (int) $slot->kelas_id !== $kelas->id) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam ini milik kelas lain.']);
        }
        if ($slot->hari !== null && $slot->hari !== $data['hari']) {
            throw ValidationException::withMessages(['slot_jam_id' => 'Slot jam ini hanya untuk hari '.$slot->hari.'.']);
        }
        if ($slot->jenis !== 'pelajaran') {
            throw ValidationException::withMessages([
                'slot_jam_id' => 'Slot ini waktu '.$slot->jenis.' — tidak bisa diisi pelajaran.',
            ]);
        }
        $hariLembaga = $this->hariLembaga($kelas->jenjang);
        if (! in_array($data['hari'], $hariLembaga['aktif'], true)) {
            throw ValidationException::withMessages([
                'hari' => "Hari {$data['hari']} adalah hari libur mingguan lembaga ini.",
            ]);
        }

        $jadwal = JadwalPelajaran::where('kelas_id', $kelas->id)
            ->where('slot_jam_id', $slot->id)
            ->where('hari', $data['hari'])
            ->first();

        $mapelId = $data['mata_pelajaran_id'] ?? null;
        $guruId = $data['keaktifan_pegawai_id'] ?? null;

        if ($mapelId === null && $guruId === null) {
            if ($jadwal !== null) {
                $jadwal->delete();
            }

            return response()->json(['pesan' => 'Jadwal dikosongkan.', 'jadwal' => null]);
        }

        if ($mapelId !== null) {
            $mapel = MataPelajaran::findOrFail($mapelId);
            if ($mapel->jenjang !== $kelas->jenjang) {
                throw ValidationException::withMessages(['mata_pelajaran_id' => 'Mapel harus sejenjang dengan kelas.']);
            }
        }
        if ($guruId !== null && ! KeaktifanPegawai::whereKey($guruId)
            ->where('jenjang', $kelas->jenjang)
            ->where('tahun_ajaran', $kelas->tahun_ajaran)
            ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
            ->exists()) {
            throw ValidationException::withMessages([
                'keaktifan_pegawai_id' => 'Guru tidak aktif untuk jenjang/tahun ajaran kelas ini.',
            ]);
        }

        if ($this->slotBentrok($slot, $data['hari'], $kelas->id, null, $jadwal?->id)) {
            throw ValidationException::withMessages([
                'slot_jam_id' => 'Kelas ini sudah punya pelajaran pada waktu yang bertumpuk.',
            ]);
        }

        if ($mapelId === null) {
            if ($this->slotBentrok($slot, $data['hari'], null, $guruId, $jadwal?->id)) {
                throw ValidationException::withMessages([
                    'keaktifan_pegawai_id' => "Guru ini sudah mengajar pada {$data['hari']} jam itu.",
                ]);
            }

            DB::transaction(function () use (&$jadwal, $kelas, $slot, $data, $guruId): void {
                $atribut = [
                    'kelas_id' => $kelas->id,
                    'pengampu_mapel_id' => null,
                    'keaktifan_pegawai_id' => $guruId,
                    'slot_jam_id' => $slot->id,
                    'hari' => $data['hari'],
                ];
                if ($jadwal !== null) {
                    $jadwal->update($atribut);
                } else {
                    $jadwal = JadwalPelajaran::create($atribut);
                }
            });

            return response()->json(['pesan' => 'Guru disimpan.', 'jadwal' => $jadwal?->fresh()]);
        }

        $pengampu = PengampuMapel::firstOrNew([
            'kelas_id' => $kelas->id,
            'mata_pelajaran_id' => $mapelId,
        ]);
        $pengampu->kelas_id = $kelas->id;
        $pengampu->mata_pelajaran_id = $mapelId;
        $pengampu->keaktifan_pegawai_id = $guruId;

        if ($guruId !== null) {
            if ($this->slotBentrok($slot, $data['hari'], null, $guruId, $jadwal?->id)) {
                throw ValidationException::withMessages([
                    'keaktifan_pegawai_id' => "Guru ini sudah mengajar pada {$data['hari']} jam itu.",
                ]);
            }
            if ($pengampu->exists) {
                foreach ($pengampu->jadwal()->with('slot')->get() as $lain) {
                    if ($lain->slot === null) {
                        continue;
                    }
                    if ($this->slotBentrok($lain->slot, $lain->hari, null, $guruId, $lain->id)) {
                        throw ValidationException::withMessages([
                            'keaktifan_pegawai_id' => 'Guru ini bentrok dengan jadwal lain yang sudah memakai mapel ini.',
                        ]);
                    }
                }
            }
        }

        DB::transaction(function () use (&$jadwal, $pengampu, $kelas, $slot, $data): void {
            $pengampu->save();
            $atribut = [
                'kelas_id' => $kelas->id,
                'pengampu_mapel_id' => $pengampu->id,
                'keaktifan_pegawai_id' => null,
            ];
            if ($jadwal !== null) {
                $jadwal->update($atribut);
            } else {
                $jadwal = JadwalPelajaran::create($atribut + [
                    'slot_jam_id' => $slot->id,
                    'hari' => $data['hari'],
                ]);
            }
        });

        return response()->json(['pesan' => 'Jadwal disimpan.', 'jadwal' => $jadwal?->fresh()]);
    }

    /** DELETE /admin/kurikulum/jadwal/{jadwal} */
    public function destroyJadwal(Request $request, JadwalPelajaran $jadwal): JsonResponse
    {
        $jenjang = $jadwal->kelas?->jenjang ?? $jadwal->pengampuMapel?->kelas?->jenjang;
        if ($jenjang === null) {
            abort(404);
        }
        $this->authorizeLembaga($request->user(), $jenjang);
        if ($jadwal->kelas !== null) {
            $this->pastikanJadwalTerbuka($jadwal->kelas);
        }
        $jadwal->delete();

        return response()->json(['pesan' => 'Jadwal dihapus.']);
    }

    /** GET /admin/kurikulum/jadwal/status?jenjang=&tahun_ajaran= */
    public function statusJadwal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json($this->ringkasStatusJadwal($data['jenjang'], $data['tahun_ajaran']));
    }

    /** PUT /admin/kurikulum/jadwal/status — ubah status jadwal SATU kelas. */
    public function simpanStatusJadwal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas_id' => ['required', 'integer', 'exists:kelas,id'],
            'status' => ['required', 'in:'.implode(',', Kelas::STATUS_JADWAL)],
        ]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);
        $kelas->update(['status_jadwal' => $data['status']]);

        return response()->json($this->ringkasStatusJadwal($kelas->jenjang, $kelas->tahun_ajaran) + [
            'pesan' => 'Status jadwal disimpan.',
        ]);
    }

    /**
     * Status per kelas + status gabungan lembaga/tahun ajaran (final hanya bila
     * seluruh kelas final).
     *
     * @return array<string, mixed>
     */
    private function ringkasStatusJadwal(string $jenjang, string $ta): array
    {
        $kelas = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->orderBy('nama_kelas')
            ->get(['id', 'nama_kelas', 'tingkat', 'status_jadwal']);

        return [
            'jenjang' => $jenjang,
            'tahun_ajaran' => $ta,
            'status' => Kelas::statusJadwalGabungan($kelas),
            'kelas' => $kelas,
        ];
    }

    /** Tolak perubahan jadwal kelas yang sudah Final. */
    private function pastikanJadwalTerbuka(Kelas $kelas): void
    {
        if ($kelas->jadwalTerkunci()) {
            throw ValidationException::withMessages([
                'kelas_id' => "Jadwal kelas {$kelas->nama_kelas} sudah Final. Ubah statusnya menjadi Draft untuk mengubah jadwal.",
            ]);
        }
    }

    /** GET /admin/kurikulum/jadwal/varian?jenjang=&tahun_ajaran= */
    public function indexVarian(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json($this->daftarVarian($data['jenjang'], $data['tahun_ajaran']));
    }

    /** POST /admin/kurikulum/jadwal/varian — simpan snapshot jadwal saat ini. */
    public function simpanVarian(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'nama' => ['required', 'string', 'max:100'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $snapshot = $this->snapshotJadwal($data['jenjang'], $data['tahun_ajaran']);

        $varian = DB::transaction(function () use ($data, $snapshot, $request): VarianJadwal {
            VarianJadwal::where('jenjang', $data['jenjang'])
                ->where('tahun_ajaran', $data['tahun_ajaran'])
                ->update(['is_active' => false]);

            return VarianJadwal::create([
                'jenjang' => $data['jenjang'],
                'tahun_ajaran' => $data['tahun_ajaran'],
                'nama' => trim($data['nama']),
                'is_active' => true,
                'snapshot' => $snapshot,
                'dibuat_oleh' => $request->user()?->id,
            ]);
        });

        return response()->json($this->daftarVarian($data['jenjang'], $data['tahun_ajaran']) + [
            'pesan' => "Varian \"{$varian->nama}\" disimpan dan diaktifkan.",
        ], 201);
    }

    /** PUT /admin/kurikulum/jadwal/varian/{varian}/aktifkan — pulihkan snapshot. */
    public function aktifkanVarian(Request $request, VarianJadwal $varian): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $varian->jenjang);

        $ringkas = DB::transaction(function () use ($varian): array {
            $hasil = $this->pulihkanSnapshot($varian->snapshot ?? [], $varian->jenjang, $varian->tahun_ajaran);

            VarianJadwal::where('jenjang', $varian->jenjang)
                ->where('tahun_ajaran', $varian->tahun_ajaran)
                ->update(['is_active' => false]);
            $varian->update(['is_active' => true]);

            return $hasil;
        });

        return response()->json($this->daftarVarian($varian->jenjang, $varian->tahun_ajaran) + [
            'pesan' => sprintf(
                'Varian "%s" diaktifkan: %d kelas dipulihkan, %d jadwal, %d kelas dilewati.',
                $varian->nama, $ringkas['kelas'], $ringkas['jadwal'], $ringkas['dilewati'],
            ),
            'ringkas' => $ringkas,
        ]);
    }

    /**
     * Daftar varian (riwayat) satu jenjang + tahun ajaran, aktif lebih dulu.
     *
     * @return array<string, mixed>
     */
    private function daftarVarian(string $jenjang, string $ta): array
    {
        $varian = VarianJadwal::with('pembuat:id,name')
            ->where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->orderByDesc('is_active')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (VarianJadwal $v): array => [
                'id' => $v->id,
                'nama' => $v->nama,
                'is_active' => $v->is_active,
                'dibuat_oleh' => $v->pembuat?->name,
                'dibuat_pada' => $v->created_at?->format('Y-m-d H:i'),
                'ringkasan' => $v->ringkasan(),
            ])
            ->values();

        return ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'varian' => $varian];
    }

    /**
     * Salinan jadwal satu jenjang + TA memakai kunci alami (nama kelas,
     * hari + nama slot, id mapel, id pegawai).
     *
     * @return array{kelas: array<int, array<string, mixed>>}
     */
    private function snapshotJadwal(string $jenjang, string $ta): array
    {
        $kelas = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->orderBy('nama_kelas')->get();

        $hasil = [];

        foreach ($kelas as $k) {
            $slot = $this->slotKelas($k);
            $pengampu = PengampuMapel::with('keaktifan')->where('kelas_id', $k->id)->get();
            $jadwal = JadwalPelajaran::with(['slot', 'pengampuMapel.keaktifan', 'keaktifan'])
                ->where('kelas_id', $k->id)->get();

            $hasil[] = [
                'nama' => $k->nama_kelas,
                'slot' => $slot->map(fn (SlotJamPelajaran $s): array => [
                    'hari' => $s->hari,
                    'nama_slot' => $s->nama_slot,
                    'jenis' => $s->jenis,
                    'jam_mulai' => $s->jam_mulai,
                    'jam_selesai' => $s->jam_selesai,
                    'urutan' => $s->urutan,
                    'per_kelas' => $s->kelas_id !== null,
                ])->values()->all(),
                'pengampu' => $pengampu->map(fn (PengampuMapel $p): array => [
                    'mata_pelajaran_id' => (int) $p->mata_pelajaran_id,
                    'pegawai_id' => $p->keaktifan?->pegawai_id,
                ])->values()->all(),
                'jadwal' => $jadwal->map(fn (JadwalPelajaran $j): array => [
                    'slot_key' => $j->slot !== null ? $this->kunciSlot($j->slot) : null,
                    'hari' => $j->hari,
                    'mata_pelajaran_id' => $j->pengampuMapel?->mata_pelajaran_id,
                    'pegawai_id' => $j->pengampuMapel?->keaktifan?->pegawai_id ?? $j->keaktifan?->pegawai_id,
                    'ruangan' => $j->ruangan,
                ])->values()->all(),
            ];
        }

        return ['kelas' => $hasil];
    }

    /**
     * Pulihkan snapshot ke kelas yang namanya cocok. Kelas Final dilewati.
     *
     * @param  array<string, mixed>  $snapshot
     * @return array{kelas:int, jadwal:int, dilewati:int}
     */
    private function pulihkanSnapshot(array $snapshot, string $jenjang, string $ta): array
    {
        $hasil = ['kelas' => 0, 'jadwal' => 0, 'dilewati' => 0];

        $petaKelas = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)->get()
            ->keyBy(fn (Kelas $k): string => Kelas::normalisasiNama($k->nama_kelas));

        foreach ($snapshot['kelas'] ?? [] as $data) {
            $kelas = $petaKelas->get(Kelas::normalisasiNama($data['nama'] ?? ''));

            if ($kelas === null || $kelas->jadwalTerkunci()) {
                $hasil['dilewati']++;

                continue;
            }

            $kandidatSlot = SlotJamPelajaran::where('jenjang', $jenjang)
                ->where(fn ($q) => $q->whereNull('kelas_id')->orWhere('kelas_id', $kelas->id))
                ->get();
            $petaSlot = [];

            foreach ($data['slot'] ?? [] as $s) {
                $kunci = mb_strtolower(trim((string) ($s['hari'] ?? ''))).'|'.mb_strtolower(trim((string) ($s['nama_slot'] ?? '')));
                $ada = $kandidatSlot->first(fn (SlotJamPelajaran $x): bool => $this->kunciSlot($x) === $kunci);

                if ($ada !== null) {
                    $petaSlot[$kunci] = $ada;

                    continue;
                }

                if (! ($s['per_kelas'] ?? true)) {
                    continue;
                }

                $baru = SlotJamPelajaran::create([
                    'jenjang' => $jenjang,
                    'kelas_id' => $kelas->id,
                    'hari' => $s['hari'] ?? null,
                    'nama_slot' => $s['nama_slot'] ?? null,
                    'jenis' => $s['jenis'] ?? 'pelajaran',
                    'jam_mulai' => $s['jam_mulai'] ?? null,
                    'jam_selesai' => $s['jam_selesai'] ?? null,
                    'urutan' => $s['urutan'] ?? 0,
                ]);
                $kandidatSlot->push($baru);
                $petaSlot[$kunci] = $baru;
            }

            $pengampu = PengampuMapel::where('kelas_id', $kelas->id)->get()->keyBy('mata_pelajaran_id');
            $petaPengampu = [];

            foreach ($data['pengampu'] ?? [] as $p) {
                $mapelId = (int) ($p['mata_pelajaran_id'] ?? 0);

                if ($mapelId === 0) {
                    continue;
                }

                $ada = $pengampu->get($mapelId);

                if ($ada !== null) {
                    $petaPengampu[$mapelId] = $ada;

                    continue;
                }

                $baru = PengampuMapel::create([
                    'kelas_id' => $kelas->id,
                    'mata_pelajaran_id' => $mapelId,
                    'keaktifan_pegawai_id' => $this->guruDariPegawai(
                        isset($p['pegawai_id']) ? (int) $p['pegawai_id'] : null, $jenjang, $ta,
                    ),
                ]);
                $pengampu->put($mapelId, $baru);
                $petaPengampu[$mapelId] = $baru;
            }

            JadwalPelajaran::where('kelas_id', $kelas->id)->delete();

            foreach ($data['jadwal'] ?? [] as $j) {
                $slot = $petaSlot[$j['slot_key'] ?? ''] ?? null;

                if ($slot === null) {
                    continue;
                }

                $mapelId = $j['mata_pelajaran_id'] ?? null;
                $pengampuRow = $mapelId !== null ? ($petaPengampu[(int) $mapelId] ?? null) : null;

                if ($pengampuRow !== null && JadwalPelajaran::where('pengampu_mapel_id', $pengampuRow->id)
                    ->where('slot_jam_id', $slot->id)->where('hari', $j['hari'])->exists()) {
                    continue;
                }

                JadwalPelajaran::create([
                    'kelas_id' => $kelas->id,
                    'pengampu_mapel_id' => $pengampuRow?->id,
                    'keaktifan_pegawai_id' => $pengampuRow === null
                        ? $this->guruDariPegawai(isset($j['pegawai_id']) ? (int) $j['pegawai_id'] : null, $jenjang, $ta)
                        : null,
                    'slot_jam_id' => $slot->id,
                    'hari' => $j['hari'],
                    'ruangan' => $j['ruangan'] ?? null,
                ]);
                $hasil['jadwal']++;
            }

            $hasil['kelas']++;
        }

        return $hasil;
    }

    /** Keaktifan aktif sebuah pegawai pada jenjang + TA; null bila tidak ada. */
    private function guruDariPegawai(?int $pegawaiId, string $jenjang, string $ta): ?int
    {
        if ($pegawaiId === null) {
            return null;
        }

        return KeaktifanPegawai::where('pegawai_id', $pegawaiId)
            ->where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
            ->value('id');
    }

    /**
     * GET /admin/kurikulum/jadwal/salin/pratinjau — perkiraan salin jadwal
     * antar tahun ajaran untuk satu jenjang. Tidak menulis apa pun.
     */
    public function pratinjauSalinJadwal(Request $request): JsonResponse
    {
        [$jenjang, $taSumber, $taTujuan] = $this->taSalinJadwal($request);

        return response()->json($this->jalankanSalinJadwal($jenjang, $taSumber, $taTujuan, false));
    }

    /**
     * POST /admin/kurikulum/jadwal/salin — salin jadwal dari TA sumber ke TA
     * tujuan (jenjang sama). Aturannya:
     *  - hanya kelas yang SUDAH ada di TA tujuan (dicocokkan lewat nama kelas);
     *  - slot, pengampu, dan sel jadwal ikut disalin;
     *  - guru tanpa keaktifan di TA tujuan dikosongkan;
     *  - sel yang sudah terisi di TA tujuan TIDAK ditimpa.
     */
    public function salinJadwal(Request $request): JsonResponse
    {
        [$jenjang, $taSumber, $taTujuan] = $this->taSalinJadwal($request);

        $hasil = DB::transaction(fn (): array => $this->jalankanSalinJadwal($jenjang, $taSumber, $taTujuan, true));

        return response()->json($hasil + ['pesan' => sprintf(
            'Salin jadwal selesai: %d kelas, %d slot, %d pengampu, %d sel jadwal.',
            count($hasil['kelas']),
            $hasil['hitung']['slot'],
            $hasil['hitung']['pengampu'],
            $hasil['hitung']['jadwal'],
        )]);
    }

    /** Validasi bersama salin/pratinjau jadwal antar tahun ajaran. */
    private function taSalinJadwal(Request $request): array
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran_sumber' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'tahun_ajaran_tujuan' => ['required', 'string', 'exists:tahun_ajaran,nama', 'different:tahun_ajaran_sumber'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return [$data['jenjang'], $data['tahun_ajaran_sumber'], $data['tahun_ajaran_tujuan']];
    }

    /**
     * Hitung (dan bila `$terapkan` benar, jalankan) salin jadwal antar TA.
     *
     * Dipakai pratinjau dan eksekusi supaya angkanya tidak mungkin berbeda.
     *
     * @return array<string, mixed>
     */
    private function jalankanSalinJadwal(string $jenjang, string $taSumber, string $taTujuan, bool $terapkan): array
    {
        $kelasSumber = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $taSumber)
            ->orderBy('nama_kelas')->get();
        $kelasTujuan = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $taTujuan)->get()
            ->keyBy(fn (Kelas $k): string => Kelas::normalisasiNama($k->nama_kelas));

        $hasil = [
            'jenjang' => $jenjang,
            'sumber' => $taSumber,
            'tujuan' => $taTujuan,
            'kelas' => [],
            'kelas_dilewati' => [],
            'hitung' => ['slot' => 0, 'pengampu' => 0, 'jadwal' => 0, 'jadwal_dilewati' => 0, 'guru_dikosongkan' => 0],
        ];

        foreach ($kelasSumber as $asal) {
            $tujuan = $kelasTujuan->get(Kelas::normalisasiNama($asal->nama_kelas));

            if (! $tujuan) {
                $hasil['kelas_dilewati'][] = [
                    'nama' => $asal->nama_kelas,
                    'alasan' => 'Kelas tidak ada di tahun ajaran tujuan.',
                ];

                continue;
            }

            if ($tujuan->jadwalTerkunci()) {
                $hasil['kelas_dilewati'][] = [
                    'nama' => $asal->nama_kelas,
                    'alasan' => 'Jadwal kelas tujuan sudah Final.',
                ];

                continue;
            }

            $ringkas = $this->salinJadwalKelas($asal, $tujuan, $taTujuan, $terapkan);
            $hasil['kelas'][] = ['dari' => $asal->nama_kelas, 'ke' => $tujuan->nama_kelas] + $ringkas;

            foreach ($ringkas as $kunci => $nilai) {
                if (array_key_exists($kunci, $hasil['hitung'])) {
                    $hasil['hitung'][$kunci] += $nilai;
                }
            }
        }

        return $hasil;
    }

    /**
     * Salin slot, pengampu, dan jadwal satu kelas sumber ke kelas tujuan.
     *
     * @return array{slot:int, pengampu:int, jadwal:int, jadwal_dilewati:int, guru_dikosongkan:int}
     */
    private function salinJadwalKelas(Kelas $asal, Kelas $tujuan, string $taTujuan, bool $terapkan): array
    {
        $hitung = ['slot' => 0, 'pengampu' => 0, 'jadwal' => 0, 'jadwal_dilewati' => 0, 'guru_dikosongkan' => 0];

        $jadwalAsal = JadwalPelajaran::where('kelas_id', $asal->id)->get();

        // Slot yang dipakai kelas sumber: slot per kelas bila ada, selain itu slot jenjang.
        // Slot yang dirujuk jadwal tetapi tidak ikut daftar tetap disertakan.
        $slotAsal = $this->slotKelas($asal);
        $kurang = $jadwalAsal->pluck('slot_jam_id')->unique()->diff($slotAsal->pluck('id'));
        if ($kurang->isNotEmpty()) {
            $slotAsal = $slotAsal->concat(SlotJamPelajaran::whereIn('id', $kurang)->get());
        }

        $kandidatSlot = SlotJamPelajaran::where('jenjang', $asal->jenjang)
            ->where(fn ($q) => $q->whereNull('kelas_id')->orWhere('kelas_id', $tujuan->id))
            ->get();

        /** @var array<int, SlotJamPelajaran|null> $petaSlot null = akan dibuat (pratinjau) */
        $petaSlot = [];

        foreach ($slotAsal as $slot) {
            $kunci = $this->kunciSlot($slot);
            $ada = $kandidatSlot->first(fn (SlotJamPelajaran $s): bool => $this->kunciSlot($s) === $kunci);

            if ($ada) {
                $petaSlot[$slot->id] = $ada;

                continue;
            }

            // Slot jenjang dipakai bersama lintas TA — tidak perlu dibuat ulang.
            if ($slot->kelas_id === null) {
                $petaSlot[$slot->id] = $slot;

                continue;
            }

            $hitung['slot']++;

            if (! $terapkan) {
                $petaSlot[$slot->id] = null;

                continue;
            }

            $baru = SlotJamPelajaran::create([
                'jenjang' => $tujuan->jenjang,
                'kelas_id' => $tujuan->id,
                'hari' => $slot->hari,
                'nama_slot' => $slot->nama_slot,
                'jenis' => $slot->jenis,
                'jam_mulai' => $slot->jam_mulai,
                'jam_selesai' => $slot->jam_selesai,
                'urutan' => $slot->urutan,
            ]);
            $kandidatSlot->push($baru);
            $petaSlot[$slot->id] = $baru;
        }

        $pengampuAsal = PengampuMapel::where('kelas_id', $asal->id)->get();
        $pengampuTujuan = PengampuMapel::where('kelas_id', $tujuan->id)->get()->keyBy('mata_pelajaran_id');

        /** @var array<int, PengampuMapel|null> $petaPengampu null = akan dibuat (pratinjau) */
        $petaPengampu = [];

        foreach ($pengampuAsal as $p) {
            $ada = $pengampuTujuan->get($p->mata_pelajaran_id);

            if ($ada) {
                $petaPengampu[$p->id] = $ada;

                continue;
            }

            $guru = $this->guruTujuan($p->keaktifan_pegawai_id, $asal->jenjang, $taTujuan);
            if ($p->keaktifan_pegawai_id !== null && $guru === null) {
                $hitung['guru_dikosongkan']++;
            }

            $hitung['pengampu']++;

            if (! $terapkan) {
                $petaPengampu[$p->id] = null;

                continue;
            }

            $baru = PengampuMapel::create([
                'kelas_id' => $tujuan->id,
                'mata_pelajaran_id' => $p->mata_pelajaran_id,
                'keaktifan_pegawai_id' => $guru,
            ]);
            $pengampuTujuan->put($p->mata_pelajaran_id, $baru);
            $petaPengampu[$p->id] = $baru;
        }

        $terisi = JadwalPelajaran::where('kelas_id', $tujuan->id)->get()
            ->keyBy(fn (JadwalPelajaran $j): string => $j->slot_jam_id.'|'.$j->hari);
        $pengampuTerpakai = JadwalPelajaran::whereNotNull('pengampu_mapel_id')
            ->get(['pengampu_mapel_id', 'slot_jam_id', 'hari'])
            ->keyBy(fn (JadwalPelajaran $j): string => $j->pengampu_mapel_id.'|'.$j->slot_jam_id.'|'.$j->hari);

        foreach ($jadwalAsal as $j) {
            $slot = $petaSlot[$j->slot_jam_id] ?? null;
            $slotId = $slot?->id;

            if ($slotId !== null && $terisi->has($slotId.'|'.$j->hari)) {
                $hitung['jadwal_dilewati']++;

                continue;
            }

            $pengampu = $j->pengampu_mapel_id !== null ? ($petaPengampu[$j->pengampu_mapel_id] ?? null) : null;
            $pengampuId = $pengampu?->id;

            // Bentrok guru: pengampu yang sama di slot & hari yang sama pada kelas lain.
            if ($pengampuId !== null && $slotId !== null && $pengampuTerpakai->has($pengampuId.'|'.$slotId.'|'.$j->hari)) {
                $hitung['jadwal_dilewati']++;

                continue;
            }

            $hitung['jadwal']++;

            if (! $terapkan || $slotId === null) {
                continue;
            }

            $baru = JadwalPelajaran::create([
                'kelas_id' => $tujuan->id,
                'pengampu_mapel_id' => $pengampuId,
                'keaktifan_pegawai_id' => $pengampuId === null
                    ? $this->guruTujuan($j->keaktifan_pegawai_id, $asal->jenjang, $taTujuan)
                    : null,
                'slot_jam_id' => $slotId,
                'hari' => $j->hari,
                'ruangan' => $j->ruangan,
            ]);

            $terisi->put($slotId.'|'.$j->hari, $baru);
            if ($pengampuId !== null) {
                $pengampuTerpakai->put($pengampuId.'|'.$slotId.'|'.$j->hari, $baru);
            }
        }

        // Jadwal hasil salin selalu berstatus Draft (aturan produk).
        if ($terapkan) {
            $tujuan->update(['status_jadwal' => 'draft']);
        }

        return $hitung;
    }

    /** Slot yang dipakai sebuah kelas: per kelas bila ada, selain itu slot jenjang. */
    private function slotKelas(Kelas $kelas): Collection
    {
        $perKelas = SlotJamPelajaran::where('kelas_id', $kelas->id)
            ->orderBy('urutan')->orderBy('hari')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get();

        return $perKelas->isNotEmpty()
            ? $perKelas
            : SlotJamPelajaran::whereNull('kelas_id')->where('jenjang', $kelas->jenjang)
                ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
                ->get();
    }

    /** Kunci pencocokan slot lintas tahun ajaran: hari + nama slot. */
    private function kunciSlot(SlotJamPelajaran $slot): string
    {
        return mb_strtolower(trim((string) $slot->hari)).'|'.mb_strtolower(trim((string) $slot->nama_slot));
    }

    /** Keaktifan guru yang sama di TA tujuan; null bila tidak aktif di sana. */
    private function guruTujuan(?int $keaktifanAsal, string $jenjang, string $taTujuan): ?int
    {
        if ($keaktifanAsal === null) {
            return null;
        }

        $pegawaiId = KeaktifanPegawai::whereKey($keaktifanAsal)->value('pegawai_id');

        if ($pegawaiId === null) {
            return null;
        }

        return KeaktifanPegawai::where('pegawai_id', $pegawaiId)
            ->where('jenjang', $jenjang)
            ->where('tahun_ajaran', $taTujuan)
            ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
            ->value('id');
    }

    /** GET /admin/kurikulum/template-jadwal?jenjang= */
    public function indexTemplate(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);

        $daftar = TemplateJadwal::where('jenjang', $jenjang)
            ->withCount('baris')
            ->orderBy('kelas_id')
            ->orderBy('tingkat')
            ->orderBy('nama')
            ->get();

        return response()->json($daftar);
    }

    /** POST /admin/kurikulum/template-jadwal */
    public function storeTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'nama' => ['required', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);
        [$data['tingkat'], $data['kelas_id']] = $this->lingkupTemplate(
            $data['jenjang'], $data['tingkat'] ?? null, $data['kelas_id'] ?? null,
        );
        $this->pastikanNamaTemplateUnik($data['jenjang'], $data['tingkat'], $data['kelas_id'], $data['nama']);

        return response()->json(TemplateJadwal::create($data)->fresh(), 201);
    }

    /** PUT /admin/kurikulum/template-jadwal/{template} */
    public function updateTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'tingkat' => ['sometimes', 'nullable', 'string', 'max:20'],
            'kelas_id' => ['sometimes', 'nullable', 'integer', 'exists:kelas,id'],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $template->jenjang);

        if (array_key_exists('tingkat', $data) || array_key_exists('kelas_id', $data)) {
            [$data['tingkat'], $data['kelas_id']] = $this->lingkupTemplate(
                $template->jenjang,
                array_key_exists('tingkat', $data) ? $data['tingkat'] : $template->tingkat,
                array_key_exists('kelas_id', $data) ? $data['kelas_id'] : $template->kelas_id,
            );
        }

        if (isset($data['nama']) || array_key_exists('tingkat', $data) || array_key_exists('kelas_id', $data)) {
            $this->pastikanNamaTemplateUnik(
                $template->jenjang,
                array_key_exists('tingkat', $data) ? $data['tingkat'] : $template->tingkat,
                array_key_exists('kelas_id', $data) ? $data['kelas_id'] : $template->kelas_id,
                $data['nama'] ?? $template->nama,
                $template->id,
            );
        }

        $template->update($data);

        return response()->json($template->fresh());
    }

    /** DELETE /admin/kurikulum/template-jadwal/{template} */
    public function destroyTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $template->jenjang);
        $template->delete();

        return response()->json(['pesan' => 'Template jadwal dihapus.']);
    }

    /** GET /admin/kurikulum/template-jadwal/{template} — kerangka jam generik */
    public function showTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $template->jenjang);

        $baris = $template->baris()
            ->orderBy('urutan_slot')
            ->orderBy('hari')
            ->get()
            ->map(fn (TemplateJadwalBaris $b) => [
                'id' => $b->id,
                'hari' => $b->hari,
                'urutan_slot' => $b->urutan_slot,
                'nama_slot' => $b->nama_slot,
                'jam_mulai' => $b->jam_mulai ? substr((string) $b->jam_mulai, 0, 5) : null,
                'jam_selesai' => $b->jam_selesai ? substr((string) $b->jam_selesai, 0, 5) : null,
                'jenis' => $b->jenis,
            ])->values();

        return response()->json([
            'template' => $template,
            'baris' => $baris,
        ]);
    }

    /** POST /admin/kurikulum/template-jadwal/{template}/baris — tambah jam generik */
    public function storeBarisTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $data = $request->validate([
            'hari' => ['nullable', 'in:'.implode(',', JadwalPelajaran::HARI)],
            'nama_slot' => ['nullable', 'string', 'max:50'],
            'jam_mulai' => ['nullable', 'date_format:H:i'],
            'jam_selesai' => ['nullable', 'date_format:H:i', 'after:jam_mulai'],
            'jenis' => ['nullable', 'in:'.implode(',', SlotJamPelajaran::JENIS)],
            'urutan_slot' => ['nullable', 'integer', 'min:1', 'max:99'],
        ]);
        $this->authorizeLembaga($request->user(), $template->jenjang);

        $urutan = $data['urutan_slot'] ?? ((int) $template->baris()->max('urutan_slot') + 1);
        if ($urutan < 1) {
            $urutan = 1;
        }
        $hari = $data['hari'] ?? null;
        if ($this->urutanBarisBentrok($template->id, $hari, $urutan)) {
            throw ValidationException::withMessages([
                'urutan_slot' => 'Jam ke-'.$urutan.' sudah ada untuk '.($hari ?? 'semua hari').' di template ini.',
            ]);
        }

        return response()->json(TemplateJadwalBaris::create([
            'template_jadwal_id' => $template->id,
            'hari' => $hari,
            'urutan_slot' => $urutan,
            'nama_slot' => $data['nama_slot'] ?? null,
            'jam_mulai' => $data['jam_mulai'] ?? null,
            'jam_selesai' => $data['jam_selesai'] ?? null,
            'jenis' => $data['jenis'] ?? 'pelajaran',
        ]), 201);
    }

    /** PUT /admin/kurikulum/template-jadwal/baris/{baris} — ubah jam generik */
    public function updateBarisTemplate(Request $request, TemplateJadwalBaris $baris): JsonResponse
    {
        $data = $request->validate([
            'hari' => ['sometimes', 'nullable', 'in:'.implode(',', JadwalPelajaran::HARI)],
            'nama_slot' => ['nullable', 'string', 'max:50'],
            'jam_mulai' => ['nullable', 'date_format:H:i'],
            'jam_selesai' => ['nullable', 'date_format:H:i'],
            'jenis' => ['sometimes', 'in:'.implode(',', SlotJamPelajaran::JENIS)],
            'urutan_slot' => ['sometimes', 'integer', 'min:1', 'max:99'],
        ]);
        $this->authorizeLembaga($request->user(), $baris->template->jenjang);

        $keMenit = fn (?string $j) => $j === null ? null : substr($j, 0, 5);
        $mulai = $keMenit(array_key_exists('jam_mulai', $data) ? $data['jam_mulai'] : $baris->jam_mulai);
        $selesai = $keMenit(array_key_exists('jam_selesai', $data) ? $data['jam_selesai'] : $baris->jam_selesai);
        if ($mulai !== null && $selesai !== null && $selesai <= $mulai) {
            throw ValidationException::withMessages([
                'jam_selesai' => 'Jam selesai harus setelah jam mulai.',
            ]);
        }
        if (isset($data['urutan_slot']) || array_key_exists('hari', $data)) {
            $urutan = $data['urutan_slot'] ?? $baris->urutan_slot;
            $hari = array_key_exists('hari', $data) ? $data['hari'] : $baris->hari;
            if ($this->urutanBarisBentrok($baris->template_jadwal_id, $hari, $urutan, $baris->id)) {
                throw ValidationException::withMessages([
                    'urutan_slot' => 'Jam ke-'.$urutan.' sudah ada untuk '.($hari ?? 'semua hari').' di template ini.',
                ]);
            }
        }
        $baris->update($data);

        return response()->json($baris->fresh());
    }

    /** DELETE /admin/kurikulum/template-jadwal/baris/{baris} */
    public function destroyBarisTemplate(Request $request, TemplateJadwalBaris $baris): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $baris->template->jenjang);
        $baris->delete();

        return response()->json(['pesan' => 'Baris template dihapus.']);
    }

    /**
     * POST /admin/kurikulum/template-jadwal/{template}/terapkan
     * Membuat/mengganti FRAME JP kosong per kelas. Mapel/guru diisi manual.
     */
    public function terapkanTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $data = $request->validate([
            'sasaran' => ['required', 'in:kelas,tingkat,jenjang'],
            'sasaran_id' => ['required', 'string', 'max:50'],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'mode' => ['nullable', 'in:pratinjau,eksekusi'],
            'timpa' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $template->jenjang);

        if (! $template->is_active) {
            throw ValidationException::withMessages([
                'template' => 'Template "'.$template->nama.'" nonaktif — aktifkan dulu untuk diterapkan.',
            ]);
        }

        $mode = $data['mode'] ?? 'eksekusi';
        $timpa = (bool) ($data['timpa'] ?? false);
        $tulis = $mode === 'eksekusi';

        $kelasTarget = $this->kelasSasaranTemplate($template, $data);
        $baris = $template->baris()->orderBy('urutan_slot')->orderBy('hari')->get();
        if ($baris->isEmpty()) {
            throw ValidationException::withMessages(['template' => 'Template belum punya baris jam.']);
        }

        $kerja = function () use ($template, $kelasTarget, $baris, $timpa, $tulis): array {
            $slotDibuat = 0;
            $slotDihapus = 0;
            $dilewati = [];

            foreach ($kelasTarget as $kelas) {
                if ($kelas->jadwalTerkunci()) {
                    $dilewati[] = ['sel' => $kelas->nama_kelas, 'alasan' => 'Jadwal kelas sudah Final — ubah ke Draft dulu.'];

                    continue;
                }

                $punyaJadwal = JadwalPelajaran::where('kelas_id', $kelas->id)->exists();
                $jumlahSlotLama = SlotJamPelajaran::where('kelas_id', $kelas->id)->count();

                if ($jumlahSlotLama > 0 && ! $timpa) {
                    $dilewati[] = ['sel' => $kelas->nama_kelas, 'alasan' => 'Kelas sudah punya kerangka JP — aktifkan timpa untuk mengganti.'];

                    continue;
                }
                if ($punyaJadwal && ! $timpa) {
                    $dilewati[] = ['sel' => $kelas->nama_kelas, 'alasan' => 'Kelas sudah punya jadwal — aktifkan timpa untuk mengosongkan dan mengganti kerangka.'];

                    continue;
                }

                if ($timpa && $tulis) {
                    JadwalPelajaran::where('kelas_id', $kelas->id)->delete();
                    SlotJamPelajaran::where('kelas_id', $kelas->id)->delete();
                }
                if ($timpa) {
                    $slotDihapus += $jumlahSlotLama;
                }

                foreach ($baris as $b) {
                    if ($tulis) {
                        SlotJamPelajaran::create([
                            'jenjang' => $template->jenjang,
                            'kelas_id' => $kelas->id,
                            'hari' => $b->hari,
                            'nama_slot' => $b->nama_slot ?? 'Jam '.$b->urutan_slot,
                            'jam_mulai' => $b->jam_mulai ? substr((string) $b->jam_mulai, 0, 5) : null,
                            'jam_selesai' => $b->jam_selesai ? substr((string) $b->jam_selesai, 0, 5) : null,
                            'jenis' => $b->jenis,
                            'urutan' => $b->urutan_slot,
                        ]);
                    }
                    $slotDibuat++;
                }
            }

            return [
                'kelas' => $kelasTarget->count(),
                'slot' => $slotDibuat,
                'slot_dihapus' => $slotDihapus,
                'dilewati' => $dilewati,
            ];
        };

        $hasil = $tulis ? DB::transaction($kerja) : $kerja();
        $pesan = $mode === 'pratinjau'
            ? "Pratinjau: {$hasil['slot']} slot kerangka untuk {$hasil['kelas']} kelas, ".count($hasil['dilewati']).' dilewati.'
            : "Kerangka diterapkan: {$hasil['slot']} slot dibuat untuk {$hasil['kelas']} kelas, ".count($hasil['dilewati']).' dilewati.';
        if ($hasil['slot_dihapus'] > 0) {
            $pesan .= " {$hasil['slot_dihapus']} slot lama dihapus.";
        }

        return response()->json([
            'pesan' => $pesan,
            'kelas' => $hasil['kelas'],
            'dibuat' => 0,
            'bisa_dipasang' => $hasil['slot'],
            'slot_dibuat' => $tulis ? $hasil['slot'] : 0,
            'slot_bisa_dibuat' => $hasil['slot'],
            'slot_dihapus' => $tulis ? $hasil['slot_dihapus'] : 0,
            'dilewati' => $hasil['dilewati'],
        ]);
    }

    /** Normalisasi lingkup template; kelas menurunkan tingkat & mengunci jenjang. */
    private function lingkupTemplate(string $jenjang, ?string $tingkat, ?int $kelasId): array
    {
        $tingkat = $tingkat !== null ? trim($tingkat) : null;
        if ($tingkat === '') {
            $tingkat = null;
        }

        if ($kelasId !== null) {
            $kelas = Kelas::find($kelasId);
            if ($kelas === null) {
                throw ValidationException::withMessages(['kelas_id' => 'Kelas tidak ditemukan.']);
            }
            if ($kelas->jenjang !== $jenjang) {
                throw ValidationException::withMessages(['kelas_id' => 'Kelas harus sejenjang dengan template.']);
            }
            if ($tingkat !== null && $tingkat !== $kelas->tingkat) {
                throw ValidationException::withMessages(['tingkat' => 'Tingkat tidak cocok dengan kelas.']);
            }

            return [$kelas->tingkat, $kelas->id];
        }

        return [$tingkat, null];
    }

    /** Nama template unik per lingkup (jenjang + tingkat + kelas). */
    private function pastikanNamaTemplateUnik(string $jenjang, ?string $tingkat, ?int $kelasId, string $nama, ?int $abaikanId = null): void
    {
        $q = TemplateJadwal::where('jenjang', $jenjang)
            ->whereRaw('LOWER(nama) = ?', [mb_strtolower(trim($nama))]);
        if ($abaikanId !== null) {
            $q->where('id', '!=', $abaikanId);
        }
        $tingkat === null ? $q->whereNull('tingkat') : $q->where('tingkat', $tingkat);
        $kelasId === null ? $q->whereNull('kelas_id') : $q->where('kelas_id', $kelasId);

        if ($q->exists()) {
            throw ValidationException::withMessages(['nama' => 'Nama template sudah dipakai pada lingkup ini.']);
        }
    }

    private function urutanBarisBentrok(int $templateId, ?string $hari, int $urutan, ?int $abaikanId = null): bool
    {
        $q = TemplateJadwalBaris::where('template_jadwal_id', $templateId)
            ->where('urutan_slot', $urutan);
        $hari === null ? $q->whereNull('hari') : $q->where('hari', $hari);
        if ($abaikanId !== null) {
            $q->where('id', '!=', $abaikanId);
        }

        return $q->exists();
    }

    /** @return Collection<int, Kelas> */
    private function kelasSasaranTemplate(TemplateJadwal $template, array $data): Collection
    {
        $sasaran = $data['sasaran'];
        $id = (string) $data['sasaran_id'];

        if ($sasaran === 'kelas') {
            $kelas = Kelas::find((int) $id);
            if ($kelas === null) {
                throw ValidationException::withMessages(['sasaran_id' => 'Kelas tidak ditemukan.']);
            }
            if ($kelas->jenjang !== $template->jenjang) {
                throw ValidationException::withMessages(['sasaran_id' => 'Kelas harus sejenjang dengan template.']);
            }
            if ($template->kelas_id !== null && (int) $template->kelas_id !== $kelas->id) {
                throw ValidationException::withMessages(['sasaran_id' => 'Template ini khusus untuk kelas lain.']);
            }
            if ($template->tingkat !== null && $template->tingkat !== $kelas->tingkat) {
                throw ValidationException::withMessages(['sasaran_id' => 'Template ini khusus untuk tingkat lain.']);
            }

            return collect([$kelas]);
        }

        $ta = $data['tahun_ajaran'] ?? null;
        if ($ta === null || $ta === '') {
            throw ValidationException::withMessages(['tahun_ajaran' => 'Tahun ajaran wajib dipilih untuk sasaran tingkat/jenjang.']);
        }

        if ($sasaran === 'tingkat') {
            if ($template->kelas_id !== null) {
                throw ValidationException::withMessages(['sasaran' => 'Template per kelas tidak bisa diterapkan ke satu tingkat.']);
            }
            if ($template->tingkat !== null && $template->tingkat !== $id) {
                throw ValidationException::withMessages(['sasaran_id' => 'Template ini khusus untuk tingkat lain.']);
            }
            $q = Kelas::where('jenjang', $template->jenjang)
                ->where('tahun_ajaran', $ta)
                ->where('tingkat', $id);
        } else {
            if ($id !== $template->jenjang) {
                throw ValidationException::withMessages(['sasaran_id' => 'Jenjang sasaran tidak cocok dengan template.']);
            }
            if ($template->kelas_id !== null || $template->tingkat !== null) {
                throw ValidationException::withMessages(['sasaran' => 'Template per kelas/tingkat tidak bisa diterapkan ke seluruh jenjang.']);
            }
            $q = Kelas::where('jenjang', $template->jenjang)->where('tahun_ajaran', $ta);
        }

        $kelas = $q->orderBy('tingkat')->orderBy('nama_kelas')->get();
        if ($kelas->isEmpty()) {
            throw ValidationException::withMessages(['sasaran_id' => 'Tidak ada kelas pada sasaran tersebut.']);
        }

        return $kelas;
    }

    /**
     * Apakah ada jadwal dengan kelas/guru tertentu yang waktunya bertumpuk
     * dengan slot + hari ini? Dicek berdasarkan jam (bukan id slot) karena
     * tiap kelas kini punya slot sendiri.
     */
    private function slotBentrok(
        SlotJamPelajaran $slot,
        string $hari,
        ?int $kelasId,
        ?int $guruId,
        ?int $abaikanJadwalId = null,
    ): bool {
        $q = JadwalPelajaran::where('hari', $hari);
        if ($abaikanJadwalId !== null) {
            $q->where('id', '!=', $abaikanJadwalId);
        }
        if ($kelasId !== null) {
            $q->where('kelas_id', $kelasId);
        } elseif ($guruId !== null) {

            $q->where(function ($q) use ($guruId): void {
                $q->where('keaktifan_pegawai_id', $guruId)
                    ->orWhereHas('pengampuMapel', fn ($q) => $q->where('keaktifan_pegawai_id', $guruId));
            });
        } else {
            return false;
        }

        if ($slot->jam_mulai !== null && $slot->jam_selesai !== null) {
            $mulai = substr((string) $slot->jam_mulai, 0, 5);
            $selesai = substr((string) $slot->jam_selesai, 0, 5);
            $q->whereHas('slot', fn ($q) => $q
                ->where('jam_mulai', '<', $selesai)
                ->where('jam_selesai', '>', $mulai));
        } else {
            $q->where('slot_jam_id', $slot->id);
        }

        return $q->exists();
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
