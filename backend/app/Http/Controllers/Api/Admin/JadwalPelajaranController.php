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

        // Matriks tak boleh kosong: sisakan minimal satu hari belajar.
        if (count($baru) >= count(JadwalPelajaran::HARI)) {
            throw ValidationException::withMessages([
                'hari_libur' => 'Minimal satu hari harus tetap aktif (tidak libur).',
            ]);
        }

        $lama = $this->hariLembaga($data['jenjang'])['libur'];
        $tambahan = array_values(array_diff($baru, $lama));

        if ($tambahan !== []) {
            $pengampuIds = PengampuMapel::whereHas('kelas', fn ($q) => $q->where('jenjang', $data['jenjang']))->pluck('id');
            $terisi = JadwalPelajaran::whereIn('pengampu_mapel_id', $pengampuIds)
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

    // =========================================================== JADWAL

    /** GET /admin/kurikulum/jadwal?kelas_id= */
    public function indexJadwal(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        // Frame kelas: kalau kelas sudah punya slot sendiri, pakai itu. Kelas
        // lama yang belum pernah menerapkan template memakai slot jenjang.
        $slotKelas = SlotJamPelajaran::where('kelas_id', $kelas->id)
            ->orderBy('urutan')->orderBy('hari')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get(['id', 'kelas_id', 'hari', 'nama_slot', 'jenis', 'jam_mulai', 'jam_selesai', 'urutan']);
        $slot = $slotKelas->isNotEmpty()
            ? $slotKelas
            : SlotJamPelajaran::whereNull('kelas_id')->where('jenjang', $kelas->jenjang)
                ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
                ->get(['id', 'kelas_id', 'hari', 'nama_slot', 'jenis', 'jam_mulai', 'jam_selesai', 'urutan']);

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
                'mata_pelajaran_id' => $j->pengampuMapel?->mata_pelajaran_id,
                'keaktifan_pegawai_id' => $j->pengampuMapel?->keaktifan_pegawai_id,
                'nama_mapel' => $j->pengampuMapel?->mataPelajaran?->nama_mapel,
                'guru' => $j->pengampuMapel?->keaktifan?->pegawai?->nama_lengkap,
                'ruangan' => $j->ruangan,
            ])
            ->values();

        // Semua pengampu kelas ini = pilihan tiap sel. Mapel yang sudah
        // terjadwal tetap ditawarkan agar bisa dipakai di slot lain (2 JP+).
        $terjadwal = $baris->pluck('pengampu_mapel_id')->unique();
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

        // Hari libur mingguan lembaga tak boleh diisi jadwal.
        $hari = $this->hariLembaga($kelas->jenjang);
        if (! in_array($data['hari'], $hari['aktif'], true)) {
            throw ValidationException::withMessages([
                'hari' => "Hari {$data['hari']} adalah hari libur mingguan lembaga ini.",
            ]);
        }

        // Satu kelas tidak boleh punya dua pelajaran pada waktu yang sama.
        if ($this->slotBentrok($slot, $data['hari'], $kelas->id, null)) {
            throw ValidationException::withMessages([
                'slot_jam_id' => "Kelas {$kelas->nama_kelas} sudah punya pelajaran pada {$data['hari']} jam itu.",
            ]);
        }

        // Satu guru tidak boleh mengajar dua kelas pada waktu yang sama.
        if ($pengampu->keaktifan_pegawai_id !== null
            && $this->slotBentrok($slot, $data['hari'], null, $pengampu->keaktifan_pegawai_id)) {
            throw ValidationException::withMessages([
                'pengampu_mapel_id' => "Guru ini sudah mengajar pada {$data['hari']} jam itu.",
            ]);
        }

        return response()->json(JadwalPelajaran::create($data), 201);
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

        $pengampuIds = PengampuMapel::where('kelas_id', $kelas->id)->pluck('id');
        $jadwal = JadwalPelajaran::where('slot_jam_id', $slot->id)
            ->where('hari', $data['hari'])
            ->whereIn('pengampu_mapel_id', $pengampuIds)
            ->first();

        $mapelId = $data['mata_pelajaran_id'] ?? null;
        if ($mapelId === null) {
            if ($jadwal !== null) {
                $jadwal->delete();
            }

            return response()->json(['pesan' => 'Jadwal dikosongkan.', 'jadwal' => null]);
        }

        $mapel = MataPelajaran::findOrFail($mapelId);
        if ($mapel->jenjang !== $kelas->jenjang) {
            throw ValidationException::withMessages(['mata_pelajaran_id' => 'Mapel harus sejenjang dengan kelas.']);
        }
        $guruId = $data['keaktifan_pegawai_id'] ?? null;
        if ($guruId !== null && ! KeaktifanPegawai::whereKey($guruId)
            ->where('jenjang', $kelas->jenjang)
            ->where('tahun_ajaran', $kelas->tahun_ajaran)
            ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
            ->exists()) {
            throw ValidationException::withMessages([
                'keaktifan_pegawai_id' => 'Guru tidak aktif untuk jenjang/tahun ajaran kelas ini.',
            ]);
        }

        // Kelas tak boleh punya pelajaran lain pada waktu yang bertumpuk.
        if ($this->slotBentrok($slot, $data['hari'], $kelas->id, null, $jadwal?->id)) {
            throw ValidationException::withMessages([
                'slot_jam_id' => 'Kelas ini sudah punya pelajaran pada waktu yang bertumpuk.',
            ]);
        }

        $pengampu = PengampuMapel::firstOrNew([
            'kelas_id' => $kelas->id,
            'mata_pelajaran_id' => $mapelId,
        ]);
        $pengampu->kelas_id = $kelas->id;
        $pengampu->mata_pelajaran_id = $mapelId;
        $pengampu->keaktifan_pegawai_id = $guruId;

        // Guru baru tidak boleh bentrok di sel tujuan maupun di jadwal lain
        // yang sudah memakai pengampu ini (guru diganti untuk semuanya).
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

        DB::transaction(function () use (&$jadwal, $pengampu, $slot, $data): void {
            $pengampu->save();
            if ($jadwal !== null) {
                $jadwal->update(['pengampu_mapel_id' => $pengampu->id]);
            } else {
                $jadwal = JadwalPelajaran::create([
                    'pengampu_mapel_id' => $pengampu->id,
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
        $jenjang = $jadwal->pengampuMapel?->kelas?->jenjang;
        if ($jenjang === null) {
            abort(404);
        }
        $this->authorizeLembaga($request->user(), $jenjang);
        $jadwal->delete();

        return response()->json(['pesan' => 'Jadwal dihapus.']);
    }

    // ================================================== TEMPLATE JADWAL
    //
    // Kerangka jam generik per jenjang (jam ke-n, nama, jam mulai–selesai,
    // penanda istirahat), tanpa mapel/guru. Diterapkan = membuat slot jam
    // nyata; pengisian mapel/guru tetap manual di matriks jadwal.

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

        // Bandingkan nilai efektif (termasuk jam lama bila hanya satu sisi
        // yang dikirim), bukan hanya saat kedua kunci ada di payload.
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
                $pengampuIds = PengampuMapel::where('kelas_id', $kelas->id)->pluck('id')->all();
                $punyaJadwal = $pengampuIds !== []
                    && JadwalPelajaran::whereIn('pengampu_mapel_id', $pengampuIds)->exists();
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
                    if ($pengampuIds !== []) {
                        JadwalPelajaran::whereIn('pengampu_mapel_id', $pengampuIds)->delete();
                    }
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
            $q->whereHas('pengampuMapel', fn ($q) => $q->where('kelas_id', $kelasId));
        } elseif ($guruId !== null) {
            $q->whereHas('pengampuMapel', fn ($q) => $q->where('keaktifan_pegawai_id', $guruId));
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
