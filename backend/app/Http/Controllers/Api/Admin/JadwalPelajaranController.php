<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\JadwalPelajaran;
use App\Models\Kelas;
use App\Models\Lembaga;
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

        $slot = SlotJamPelajaran::where('jenjang', $kelas->jenjang)
            ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get(['id', 'nama_slot', 'jenis', 'jam_mulai', 'jam_selesai', 'urutan']);

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
     * Generate jadwal mingguan untuk sasaran kelas/tingkat/jenjang.
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
        $kelasIds = $kelasTarget->pluck('id')->all();
        $hariAktif = $this->hariLembaga($template->jenjang)['aktif'];
        $baris = $template->baris()->orderBy('urutan_slot')->orderBy('hari')->get();
        if ($baris->isEmpty()) {
            throw ValidationException::withMessages(['template' => 'Template belum punya baris jam.']);
        }
        $slotDefs = $this->definisiSlotTemplate($baris);

        $kerja = function () use ($template, $kelasTarget, $kelasIds, $hariAktif, $baris, $slotDefs, $timpa, $tulis): array {
            $ada = SlotJamPelajaran::where('jenjang', $template->jenjang)->get()->keyBy('urutan');
            $terpakaiQuery = JadwalPelajaran::whereIn('slot_jam_id', $ada->pluck('id'))
                ->whereIn('hari', $hariAktif);
            if ($timpa && $kelasIds !== []) {
                $terpakaiQuery->whereHas('pengampuMapel', fn ($q) => $q->whereNotIn('kelas_id', $kelasIds));
            }
            $terpakai = $terpakaiQuery->distinct()->pluck('slot_jam_id')->flip()->all();

            $slotPerUrutan = [];
            $slotBaru = 0;
            $dilewati = [];

            foreach ($slotDefs as $urutan => $def) {
                $slot = $ada->get($urutan);
                $dataSlot = $def + ['jenjang' => $template->jenjang, 'urutan' => $urutan];
                if ($slot !== null) {
                    $beda = $slot->nama_slot !== $dataSlot['nama_slot']
                        || $slot->jenis !== $dataSlot['jenis']
                        || substr((string) $slot->jam_mulai, 0, 5) !== $dataSlot['jam_mulai']
                        || substr((string) $slot->jam_selesai, 0, 5) !== $dataSlot['jam_selesai'];
                    if ($beda && isset($terpakai[$slot->id])) {
                        $dilewati[] = [
                            'sel' => 'jam ke-'.$urutan,
                            'alasan' => 'Slot jam masih dipakai jadwal dan berbeda dari template — jadwal jam ini dilewati.',
                        ];

                        continue;
                    }
                    if ($beda && $timpa && $tulis) {
                        $slot->update($dataSlot);
                    }
                } else {
                    $slot = new SlotJamPelajaran($dataSlot);
                    if ($tulis) {
                        $slot->save();
                    }
                    $slotBaru++;
                }
                $slotPerUrutan[$urutan] = $slot;
            }

            // Hari × jam: baris `hari = null` berlaku semua hari; baris hari
            // tertentu menimpa baris umum pada jam yang sama.
            $slotPerHari = [];
            foreach ($hariAktif as $hari) {
                $peta = [];
                foreach ($baris as $b) {
                    if ($b->hari !== null && $b->hari !== $hari) {
                        continue;
                    }
                    if (isset($slotPerUrutan[$b->urutan_slot])) {
                        $peta[$b->urutan_slot] = $slotPerUrutan[$b->urutan_slot];
                    }
                }
                ksort($peta);
                $slotPerHari[$hari] = array_values($peta);
            }

            // Guru yang sudah mengajar di kelas lain pada slot/hari yang sama.
            $sibuk = [];
            $querySibuk = JadwalPelajaran::with('pengampuMapel:id,kelas_id,keaktifan_pegawai_id')
                ->whereIn('hari', $hariAktif)
                ->whereHas('pengampuMapel.kelas', fn ($q) => $q->where('jenjang', $template->jenjang));
            if ($timpa && $kelasIds !== []) {
                $querySibuk->whereHas('pengampuMapel', fn ($q) => $q->whereNotIn('kelas_id', $kelasIds));
            }
            foreach ($querySibuk->get() as $j) {
                $guru = $j->pengampuMapel?->keaktifan_pegawai_id;
                if ($guru !== null) {
                    $sibuk[$guru.'|'.$j->slot_jam_id.'|'.$j->hari] = true;
                }
            }

            $pengampuPerKelas = PengampuMapel::with('mataPelajaran:id,nama_mapel,urutan')
                ->whereIn('kelas_id', $kelasIds)
                ->get()
                ->groupBy('kelas_id');

            $jadwalDibuat = 0;

            foreach ($kelasTarget as $kelas) {
                $pengampu = collect($pengampuPerKelas->get($kelas->id, []))
                    ->sortBy(fn (PengampuMapel $p) => sprintf(
                        '%05d|%s|%010d',
                        $p->mataPelajaran?->urutan ?? 999,
                        $p->mataPelajaran?->nama_mapel ?? '',
                        $p->id,
                    ))->values();

                $pengampuIds = $pengampu->pluck('id')->all();
                $sudahAda = $pengampuIds !== []
                    && JadwalPelajaran::whereIn('pengampu_mapel_id', $pengampuIds)->exists();
                if ($sudahAda && ! $timpa) {
                    $dilewati[] = ['sel' => $kelas->nama_kelas, 'alasan' => 'Kelas sudah punya jadwal — aktifkan timpa untuk mengganti.'];

                    continue;
                }
                if ($timpa && $tulis && $pengampuIds !== []) {
                    JadwalPelajaran::whereIn('pengampu_mapel_id', $pengampuIds)->delete();
                }

                $sel = [];
                foreach ($hariAktif as $hari) {
                    foreach ($slotPerHari[$hari] as $slot) {
                        if ($slot->jenis === 'pelajaran') {
                            $sel[] = ['hari' => $hari, 'slot' => $slot];
                        }
                    }
                }
                if ($pengampu->isEmpty() || $sel === []) {
                    $dilewati[] = ['sel' => $kelas->nama_kelas, 'alasan' => 'Tidak ada pengampu atau JP pelajaran untuk diisi.'];

                    continue;
                }

                $token = [];
                $adaKuota = $pengampu->contains(fn (PengampuMapel $p) => ($p->jp_per_minggu ?? 0) > 0);
                foreach ($pengampu as $p) {
                    $n = $adaKuota ? max(0, (int) ($p->jp_per_minggu ?? 0)) : 0;
                    for ($i = 0; $i < $n; $i++) {
                        $token[] = $p;
                    }
                }
                $sisa = count($sel) - count($token);
                if ($sisa > 0) {
                    // Tanpa kuota = bergilir merata; kuota kurang = sisanya bergilir.
                    $m = $pengampu->count();
                    for ($i = 0; $i < $sisa; $i++) {
                        $token[] = $pengampu[$i % $m];
                    }
                }
                if (count($token) > count($sel)) {
                    $token = array_slice($token, 0, count($sel));
                }

                foreach ($sel as $i => $cell) {
                    $p = $token[$i] ?? null;
                    if ($p === null) {
                        break;
                    }
                    $slot = $cell['slot'];
                    $guru = $p->keaktifan_pegawai_id;
                    $kunci = $guru === null || $slot->id === null
                        ? null
                        : $guru.'|'.$slot->id.'|'.$cell['hari'];
                    if ($kunci !== null && isset($sibuk[$kunci])) {
                        $dilewati[] = [
                            'sel' => $kelas->nama_kelas.' · '.$cell['hari'].' · jam ke-'.$slot->urutan,
                            'alasan' => 'Guru '.($p->mataPelajaran?->nama_mapel ?? '#'.$p->id).' sudah mengajar di kelas lain.',
                        ];

                        continue;
                    }
                    if ($tulis && $slot->id !== null) {
                        JadwalPelajaran::create([
                            'pengampu_mapel_id' => $p->id,
                            'slot_jam_id' => $slot->id,
                            'hari' => $cell['hari'],
                        ]);
                    }
                    if ($kunci !== null) {
                        $sibuk[$kunci] = true;
                    }
                    $jadwalDibuat++;
                }
            }

            return [
                'kelas' => $kelasTarget->count(),
                'jadwal' => $jadwalDibuat,
                'slot' => $slotBaru,
                'dilewati' => $dilewati,
            ];
        };

        $hasil = $tulis ? DB::transaction($kerja) : $kerja();
        $pesan = $mode === 'pratinjau'
            ? "Pratinjau: {$hasil['jadwal']} jadwal bisa dibuat untuk {$hasil['kelas']} kelas, ".count($hasil['dilewati']).' dilewati.'
            : "Template diterapkan: {$hasil['jadwal']} jadwal dibuat untuk {$hasil['kelas']} kelas, ".count($hasil['dilewati']).' dilewati.';

        return response()->json([
            'pesan' => $pesan,
            'kelas' => $hasil['kelas'],
            'dibuat' => $tulis ? $hasil['jadwal'] : 0,
            'bisa_dipasang' => $hasil['jadwal'],
            'slot_dibuat' => $tulis ? $hasil['slot'] : 0,
            'slot_bisa_dibuat' => $hasil['slot'],
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
     * Satu definisi slot per nomor jam. Slot nyata per jenjang tidak bisa
     * menyimpan jam/jenis berbeda antar hari, jadi template mingguan wajib
     * konsisten untuk nomor jam yang sama.
     *
     * @return array<int, array{nama_slot: string, jenis: string, jam_mulai: ?string, jam_selesai: ?string}>
     */
    private function definisiSlotTemplate(Collection $baris): array
    {
        $defs = [];
        foreach ($baris as $b) {
            $urutan = (int) $b->urutan_slot;
            $data = [
                'nama_slot' => $b->nama_slot ?? 'Jam '.$urutan,
                'jenis' => $b->jenis,
                'jam_mulai' => $b->jam_mulai ? substr((string) $b->jam_mulai, 0, 5) : null,
                'jam_selesai' => $b->jam_selesai ? substr((string) $b->jam_selesai, 0, 5) : null,
            ];
            if (isset($defs[$urutan])) {
                foreach (['jenis', 'jam_mulai', 'jam_selesai'] as $kunci) {
                    if ($defs[$urutan][$kunci] !== $data[$kunci]) {
                        throw ValidationException::withMessages([
                            'template' => "Jam ke-{$urutan} punya {$kunci} berbeda antar hari. Slot jam per jenjang harus seragam — samakan template atau pisahkan per tingkat.",
                        ]);
                    }
                }

                continue;
            }
            $defs[$urutan] = $data;
        }
        ksort($defs);

        return $defs;
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
