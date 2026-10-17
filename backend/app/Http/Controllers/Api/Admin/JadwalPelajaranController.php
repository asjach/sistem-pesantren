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
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        $hari = $this->hariLembaga($kelas->jenjang);

        return response()->json([
            'kelas' => ['id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas, 'tingkat' => $kelas->tingkat, 'jenjang' => $kelas->jenjang],
            'hari' => $hari['aktif'],
            'hari_libur' => $hari['libur'],
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
            ->orderBy('nama')
            ->get();

        return response()->json($daftar);
    }

    /** POST /admin/kurikulum/template-jadwal */
    public function storeTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'nama' => [
                'required', 'string', 'max:100',
                function (string $attr, mixed $nilai, Closure $gagal) use ($request) {
                    $ada = TemplateJadwal::where('jenjang', $request->input('jenjang'))
                        ->whereRaw('LOWER(nama) = ?', [mb_strtolower(trim((string) $nilai))])
                        ->exists();
                    if ($ada) {
                        $gagal('Nama template sudah dipakai di lembaga ini.');
                    }
                },
            ],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json(TemplateJadwal::create($data)->fresh(), 201);
    }

    /** PUT /admin/kurikulum/template-jadwal/{template} */
    public function updateTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        // Unik (jenjang, nama) case-insensitive bila nama diubah.
        if (isset($data['nama'])) {
            $ada = TemplateJadwal::where('jenjang', $template->jenjang)
                ->where('id', '!=', $template->id)
                ->whereRaw('LOWER(nama) = ?', [mb_strtolower(trim($data['nama']))])
                ->exists();
            if ($ada) {
                throw ValidationException::withMessages(['nama' => 'Nama template sudah dipakai di lembaga ini.']);
            }
        }
        $this->authorizeLembaga($request->user(), $template->jenjang);
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
            ->get()
            ->map(fn (TemplateJadwalBaris $b) => [
                'id' => $b->id,
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
        $bentrok = TemplateJadwalBaris::where('template_jadwal_id', $template->id)
            ->where('urutan_slot', $urutan)
            ->exists();
        if ($bentrok) {
            throw ValidationException::withMessages([
                'urutan_slot' => "Jam ke-{$urutan} sudah ada di template ini.",
            ]);
        }

        return response()->json(TemplateJadwalBaris::create([
            'template_jadwal_id' => $template->id,
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
        if (isset($data['urutan_slot'])) {
            $bentrok = TemplateJadwalBaris::where('template_jadwal_id', $baris->template_jadwal_id)
                ->where('id', '!=', $baris->id)
                ->where('urutan_slot', $data['urutan_slot'])
                ->exists();
            if ($bentrok) {
                throw ValidationException::withMessages([
                    'urutan_slot' => "Jam ke-{$data['urutan_slot']} sudah ada di template ini.",
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

    /** POST /admin/kurikulum/template-jadwal/{template}/terapkan — buat slot jam nyata */
    public function terapkanTemplate(Request $request, TemplateJadwal $template): JsonResponse
    {
        $data = $request->validate([
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

        // Slot nyata yang sudah ada di jenjang ini, DIKUNCI NOMOR JAM (`urutan`),
        // bukan posisi dalam daftar. Semua baris template menghasilkan slot,
        // termasuk istirahat/pembiasaan yang tidak bisa diisi pelajaran.
        $ada = SlotJamPelajaran::where('jenjang', $template->jenjang)
            ->orderBy('urutan')->orderBy('jam_mulai')->orderBy('nama_slot')
            ->get();
        $slotPerUrutan = $ada->keyBy('urutan');
        $terpakai = JadwalPelajaran::whereIn('slot_jam_id', $ada->map->id)->distinct()->pluck('slot_jam_id')->flip()->all();

        $dibuat = 0;
        $dilewati = [];
        $tulis = [];

        foreach ($template->baris()->orderBy('urutan_slot')->get() as $b) {
            $kunci = "jam ke-{$b->urutan_slot}";
            $slotNyata = $slotPerUrutan->get($b->urutan_slot);
            if ($slotNyata !== null && ! $timpa) {
                $dilewati[] = ['sel' => $kunci, 'alasan' => 'Slot jam ke-'.$b->urutan_slot.' sudah ada (aktifkan timpa untuk menimpa).'];

                continue;
            }
            if ($slotNyata !== null && isset($terpakai[$slotNyata->id])) {
                $dilewati[] = ['sel' => $kunci, 'alasan' => 'Slot jam ke-'.$b->urutan_slot.' masih dipakai jadwal — hapus jadwalnya dulu.'];

                continue;
            }
            $tulis[] = [
                'slot' => $slotNyata,
                'data' => [
                    'jenjang' => $template->jenjang,
                    'nama_slot' => $b->nama_slot ?? 'Jam '.$b->urutan_slot,
                    'jenis' => $b->jenis,
                    'jam_mulai' => $b->jam_mulai ? substr((string) $b->jam_mulai, 0, 5) : null,
                    'jam_selesai' => $b->jam_selesai ? substr((string) $b->jam_selesai, 0, 5) : null,
                    'urutan' => $b->urutan_slot,
                ],
            ];
            $dibuat++;
        }

        if ($mode === 'eksekusi' && $tulis !== []) {
            DB::transaction(function () use ($tulis, $timpa) {
                foreach ($tulis as $t) {
                    if ($t['slot'] !== null && $timpa) {
                        $t['slot']->update($t['data']);
                    } else {
                        SlotJamPelajaran::create($t['data']);
                    }
                }
            });
        }

        $pesan = $mode === 'pratinjau'
            ? "Pratinjau: {$dibuat} slot bisa dibuat, ".count($dilewati).' dilewati.'
            : "Template diterapkan: {$dibuat} slot dibuat, ".count($dilewati).' dilewati.';

        return response()->json([
            'pesan' => $pesan,
            'dibuat' => $mode === 'pratinjau' ? 0 : $dibuat,
            'bisa_dipasang' => $dibuat,
            'dilewati' => $dilewati,
        ]);
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
