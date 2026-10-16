<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\MapelTemplateExport;
use App\Exports\PengampuTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MapelPotongRequest;
use App\Http\Requests\Admin\PengampuPotongRequest;
use App\Models\ImportSesi;
use App\Models\JadwalPelajaran;
use App\Models\Kelas;
use App\Models\KelasKurikulum;
use App\Models\Kurikulum;
use App\Models\KurikulumMapel;
use App\Models\MataPelajaran;
use App\Models\NilaiKomponen;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Services\MapelImporService;
use App\Services\PengampuImporService;
use App\Services\RefService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Modul Kurikulum & Mapel (BLOK 5) — master mapel, kurikulum + komposisi
 * mapelnya, pemetaan kelas→kurikulum, dan pengampu (kelas × mapel → guru).
 *
 *  Pengampu memakai `keaktifan_pegawai` (guru aktif per jenjang + TA), jadi
 *  pemilih guru langsung tersedia dari data kepegawaian yang sudah ada.
 */
class KurikulumController extends Controller
{
    use ImporBertahap;
    use TenantGuard;

    // ============================================================ MAPEL

    /** GET /admin/kurikulum/mapel?jenjang=&q=&kelompok=&keaktifan= */
    public function indexMapel(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);

        $q = MataPelajaran::where('jenjang', $jenjang);
        if ($request->filled('kelompok')) {
            $q->where('kelompok', $request->input('kelompok'));
        }
        if ($request->filled('keaktifan') && $request->input('keaktifan') !== 'semua') {
            $q->where('is_active', $request->input('keaktifan') === 'aktif');
        }
        if ($request->filled('q')) {
            $cari = (string) $request->input('q');
            $q->where(fn ($w) => $w->where('nama_mapel', 'like', "%{$cari}%")
                ->orWhere('kode_mapel', 'like', "%{$cari}%"));
        }

        return response()->json($q->orderBy('nama_mapel')->get());
    }

    /** POST /admin/kurikulum/mapel */
    public function storeMapel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'nama_mapel' => ['required', 'string', 'max:100'],
            'kelompok' => ['required', 'in:formal,pesantren'],
            'kode_mapel' => ['nullable', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json(MataPelajaran::create($data), 201);
    }

    /** PUT /admin/kurikulum/mapel/{mapel} */
    public function updateMapel(Request $request, MataPelajaran $mapel): JsonResponse
    {
        $data = $request->validate([
            'nama_mapel' => ['sometimes', 'string', 'max:100'],
            'kelompok' => ['sometimes', 'in:formal,pesantren'],
            'kode_mapel' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $mapel->jenjang);
        $mapel->update($data);

        return response()->json($mapel->fresh());
    }

    /** DELETE /admin/kurikulum/mapel/{mapel} */
    public function destroyMapel(Request $request, MataPelajaran $mapel): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $mapel->jenjang);
        $dipakai = KurikulumMapel::where('mata_pelajaran_id', $mapel->id)->exists()
            || PengampuMapel::where('mata_pelajaran_id', $mapel->id)->exists();
        if ($dipakai) {
            abort(422, 'Mapel sudah dipakai di kurikulum/pengampu. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }
        $mapel->delete();

        return response()->json(['pesan' => 'Mapel dihapus.']);
    }

    // -------------------------------------------- IMPOR MAPEL BERTAHAP

    /** GET /api/admin/kurikulum/mapel/import-template — template Excel import mapel (multi-lembaga). */
    public function templateMapel()
    {
        return Excel::download(new MapelTemplateExport, 'template-import-mapel.xlsx');
    }

    /**
     * POST /api/admin/kurikulum/mapel/import-potong — import bertahap
     * (potongan JSON 1000 baris/panggilan) dari browser. Lingkup ada per
     * baris dan izin dicek di MapelImporService, bukan 403 di depan.
     */
    public function potongMapel(MapelPotongRequest $request, MapelImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'mapel', $layanan, 'mapel');
    }

    /** POST /api/admin/kurikulum/mapel/import-potong/{sesi}/batal. */
    public function batalPotongMapel(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/kurikulum/mapel/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotongMapel(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-mapel.csv');
    }

    // ========================================================= KURIKULUM

    /** GET /admin/kurikulum/kurikulum?jenjang= */
    public function indexKurikulum(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);

        $rows = Kurikulum::withCount('mapel')
            ->withCount('kelas')
            ->where('jenjang', $jenjang)
            ->orderBy('nama')
            ->get();

        return response()->json($rows);
    }

    /** POST /admin/kurikulum/kurikulum */
    public function storeKurikulum(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'nama' => ['required', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string', 'max:500'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json(Kurikulum::create($data), 201);
    }

    /** PUT /admin/kurikulum/kurikulum/{kurikulum} */
    public function updateKurikulum(Request $request, Kurikulum $kurikulum): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string', 'max:500'],
        ]);
        $this->authorizeLembaga($request->user(), $kurikulum->jenjang);
        $kurikulum->update($data);

        return response()->json($kurikulum->fresh());
    }

    /** DELETE /admin/kurikulum/kurikulum/{kurikulum} */
    public function destroyKurikulum(Request $request, Kurikulum $kurikulum): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $kurikulum->jenjang);
        if (KelasKurikulum::where('kurikulum_id', $kurikulum->id)->exists()) {
            abort(422, 'Kurikulum masih dipakai kelas. Lepas dari kelas dulu.');
        }
        $kurikulum->delete();

        return response()->json(['pesan' => 'Kurikulum dihapus.']);
    }

    // ================================================= KOMPOSISI MAPEL

    /** GET /admin/kurikulum/komposisi?kurikulum_id= */
    public function indexKomposisi(Request $request): JsonResponse
    {
        $kurikulum = $this->kurikulumWajib($request);

        $baris = KurikulumMapel::with('mataPelajaran:id,nama_mapel,kelompok,kode_mapel,is_active')
            ->where('kurikulum_id', $kurikulum->id)
            ->orderBy('urutan')->orderBy('id')
            ->get();

        // Mapel jenjang ini yang BELUM masuk kurikulum — untuk panel pilih.
        $dipakai = $baris->pluck('mata_pelajaran_id');
        $tersedia = MataPelajaran::where('jenjang', $kurikulum->jenjang)
            ->whereNotIn('id', $dipakai)
            ->orderBy('nama_mapel')
            ->get(['id', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active']);

        return response()->json([
            'kurikulum' => $kurikulum,
            'baris' => $baris,
            'tersedia' => $tersedia,
            'tingkat' => collect(RefService::efektifSemuaLembaga('tingkat'))
                ->filter(fn ($r) => ($r->jenjang ?? null) === null || $r->jenjang === $kurikulum->jenjang)
                ->values(),
        ]);
    }

    /** POST /admin/kurikulum/komposisi — tambah mapel ke kurikulum. */
    public function storeKomposisi(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kurikulum_id' => ['required', 'integer', 'exists:kurikulum,id'],
            'mata_pelajaran_id' => ['required', 'integer', 'exists:mata_pelajaran,id'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kkm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        $kurikulum = Kurikulum::findOrFail($data['kurikulum_id']);
        $this->authorizeLembaga($request->user(), $kurikulum->jenjang);
        $this->pastikanMapelSeJenjang((int) $data['mata_pelajaran_id'], $kurikulum->jenjang);

        $baris = KurikulumMapel::updateOrCreate(
            [
                'kurikulum_id' => $kurikulum->id,
                'mata_pelajaran_id' => $data['mata_pelajaran_id'],
                'tingkat' => $data['tingkat'] ?? null,
            ],
            ['kkm' => $data['kkm'] ?? null, 'urutan' => $data['urutan'] ?? 0],
        );

        return response()->json($baris->load('mataPelajaran:id,nama_mapel,kelompok,kode_mapel,is_active'), 201);
    }

    /** PUT /admin/kurikulum/komposisi/{item} */
    public function updateKomposisi(Request $request, KurikulumMapel $item): JsonResponse
    {
        $data = $request->validate([
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kkm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        $this->authorizeLembaga($request->user(), $item->kurikulum->jenjang);
        $item->update($data);

        return response()->json($item->fresh()->load('mataPelajaran:id,nama_mapel,kelompok,kode_mapel,is_active'));
    }

    /** DELETE /admin/kurikulum/komposisi/{item} */
    public function destroyKomposisi(Request $request, KurikulumMapel $item): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $item->kurikulum->jenjang);
        $item->delete();

        return response()->json(['pesan' => 'Mapel dikeluarkan dari kurikulum.']);
    }

    // ================================================= KELAS → KURIKULUM

    /** GET /admin/kurikulum/kelas?jenjang=&tahun_ajaran= */
    public function indexKelasKurikulum(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $peta = KelasKurikulum::whereIn('kelas_id', function ($q) use ($jenjang, $ta) {
            $q->select('id')->from('kelas')->where('jenjang', $jenjang)->where('tahun_ajaran', $ta);
        })->get()->groupBy('kelas_id');

        $kelas = Kelas::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->orderBy('tingkat')->orderBy('nama_kelas')
            ->get(['id', 'nama_kelas', 'tingkat'])
            ->map(fn (Kelas $k) => [
                'id' => $k->id,
                'nama_kelas' => $k->nama_kelas,
                'tingkat' => $k->tingkat,
                'kurikulum_ids' => ($peta[$k->id] ?? collect())->pluck('kurikulum_id')->values()->all(),
            ]);

        return response()->json(['kelas' => $kelas]);
    }

    /** PUT /admin/kurikulum/kelas/{kelas} — set kurikulum kelas (sync). */
    public function simpanKelasKurikulum(Request $request, Kelas $kelas): JsonResponse
    {
        $data = $request->validate([
            'kurikulum_ids' => ['present', 'array'],
            'kurikulum_ids.*' => ['integer', 'exists:kurikulum,id'],
        ]);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        foreach ($data['kurikulum_ids'] as $id) {
            $k = Kurikulum::find($id);
            if ($k === null || $k->jenjang !== $kelas->jenjang) {
                throw ValidationException::withMessages([
                    'kurikulum_ids' => 'Kurikulum harus sejenjang dengan kelas.',
                ]);
            }
        }

        DB::transaction(function () use ($kelas, $data) {
            KelasKurikulum::where('kelas_id', $kelas->id)
                ->whereNotIn('kurikulum_id', $data['kurikulum_ids'])
                ->delete();
            foreach ($data['kurikulum_ids'] as $id) {
                KelasKurikulum::firstOrCreate(['kelas_id' => $kelas->id, 'kurikulum_id' => $id]);
            }
        });

        return response()->json(['pesan' => 'Kurikulum kelas disimpan.']);
    }

    // ============================================================ GURU

    /** GET /admin/kurikulum/guru-aktif?jenjang=&tahun_ajaran= */
    public function guruAktif(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $rows = DB::table('keaktifan_pegawai as kp')
            ->join('pegawai as pg', 'pg.id', '=', 'kp.pegawai_id')
            ->where('kp.jenjang', $jenjang)
            ->where('kp.tahun_ajaran', $ta)
            ->where('kp.status_keaktifan', 'Ya')
            ->orderBy('pg.nama_lengkap')
            ->get([
                'kp.id as keaktifan_pegawai_id', 'pg.id as pegawai_id',
                'pg.nama_lengkap', 'pg.nip', 'pg.gelar_depan', 'pg.gelar_belakang', 'pg.jenis_kelamin',
            ]);

        return response()->json($rows);
    }

    // ========================================================= PENGAMPU

    /**
     * GET /admin/kurikulum/pengampu?kelas_id=
     * Satu baris per mapel kelas: mapel dari kurikulum kelas ∪ pengampu yang
     * sudah ada, lengkap dengan guru terpasang (boleh kosong).
     */
    public function indexPengampu(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $kurikulum = Kurikulum::whereIn('id', function ($q) use ($kelas) {
            $q->select('kurikulum_id')->from('kelas_kurikulum')->where('kelas_id', $kelas->id);
        })->get(['id', 'nama']);

        $dariKurikulum = $this->mapelKurikulumKelas($kelas, $kurikulum->pluck('id')->all());
        $terpasang = PengampuMapel::with('keaktifan.pegawai:id,nama_lengkap,nip,gelar_depan,gelar_belakang,jenis_kelamin')
            ->where('kelas_id', $kelas->id)
            ->get()
            ->keyBy('mata_pelajaran_id');

        $mapelIds = collect($dariKurikulum)->pluck('mata_pelajaran_id')
            ->merge($terpasang->keys())
            ->unique()->values();

        $mapel = MataPelajaran::whereIn('id', $mapelIds)
            ->orderBy('nama_mapel')
            ->get(['id', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active']);

        $urutan = collect($dariKurikulum)->keyBy('mata_pelajaran_id');

        return response()->json([
            'kelas' => ['id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas, 'tingkat' => $kelas->tingkat, 'jenjang' => $kelas->jenjang],
            'kurikulum' => $kurikulum,
            'baris' => $mapel->map(function (MataPelajaran $m) use ($terpasang, $urutan) {
                $p = $terpasang[$m->id] ?? null;

                return [
                    'mata_pelajaran_id' => $m->id,
                    'nama_mapel' => $m->nama_mapel,
                    'kelompok' => $m->kelompok,
                    'is_active' => $m->is_active,
                    'dari_kurikulum' => isset($urutan[$m->id]),
                    'pengampu_id' => $p?->id,
                    'keaktifan_pegawai_id' => $p?->keaktifan_pegawai_id,
                    'guru' => $p?->keaktifan?->pegawai?->nama_lengkap,
                ];
            }),
        ]);
    }

    /**
     * PUT /admin/kurikulum/pengampu — sync pengampu satu kelas.
     * Baris di luar daftar dihapus, TAPI ditolak bila sudah punya nilai/jadwal.
     */
    public function simpanPengampu(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas_id' => ['required', 'integer', 'exists:kelas,id'],
            'baris' => ['present', 'array'],
            'baris.*.mata_pelajaran_id' => ['required', 'integer', 'exists:mata_pelajaran,id'],
            'baris.*.keaktifan_pegawai_id' => ['nullable', 'integer', 'exists:keaktifan_pegawai,id'],
        ]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $diinginkan = collect($data['baris'])->keyBy('mata_pelajaran_id');
        $ada = PengampuMapel::where('kelas_id', $kelas->id)->get();

        $akanDihapus = $ada->reject(fn (PengampuMapel $p) => $diinginkan->has($p->mata_pelajaran_id));
        foreach ($akanDihapus as $p) {
            $punyaNilai = NilaiSantri::where('pengampu_mapel_id', $p->id)->exists()
                || NilaiKomponen::where('pengampu_mapel_id', $p->id)->exists()
                || JadwalPelajaran::where('pengampu_mapel_id', $p->id)->exists();
            if ($punyaNilai) {
                throw ValidationException::withMessages([
                    'baris' => "Pengampu mapel #{$p->mata_pelajaran_id} sudah punya nilai/jadwal — tidak bisa dihapus.",
                ]);
            }
        }

        DB::transaction(function () use ($kelas, $diinginkan, $akanDihapus) {
            foreach ($akanDihapus as $p) {
                $p->delete();
            }
            foreach ($diinginkan as $mapelId => $b) {
                PengampuMapel::updateOrCreate(
                    ['kelas_id' => $kelas->id, 'mata_pelajaran_id' => $mapelId],
                    ['keaktifan_pegawai_id' => $b['keaktifan_pegawai_id'] ?? null],
                );
            }
        });

        return response()->json(['pesan' => 'Pengampu disimpan.']);
    }

    /**
     * POST /admin/kurikulum/pengampu/generate — buatkan baris pengampu untuk
     * SELURUH mapel kurikulum kelas yang belum punya pengampu (guru kosong).
     */
    public function generatePengampu(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        $kurikulumIds = KelasKurikulum::where('kelas_id', $kelas->id)->pluck('kurikulum_id')->all();
        if ($kurikulumIds === []) {
            throw ValidationException::withMessages([
                'kelas_id' => 'Kelas ini belum dipetakan ke kurikulum mana pun.',
            ]);
        }

        $mapel = $this->mapelKurikulumKelas($kelas, $kurikulumIds);
        $dibuat = 0;
        DB::transaction(function () use ($kelas, $mapel, &$dibuat) {
            foreach ($mapel as $m) {
                $row = PengampuMapel::firstOrCreate([
                    'kelas_id' => $kelas->id,
                    'mata_pelajaran_id' => $m['mata_pelajaran_id'],
                ], ['keaktifan_pegawai_id' => null]);
                if ($row->wasRecentlyCreated) {
                    $dibuat++;
                }
            }
        });

        return response()->json(['pesan' => "{$dibuat} pengampu dibuat.", 'dibuat' => $dibuat]);
    }

    // ------------------------------------------ IMPOR PENGAMPU BERTAHAP

    /** GET /api/admin/kurikulum/pengampu/import-template — template Excel import pengampu (multi-lembaga/TA). */
    public function templatePengampu()
    {
        return Excel::download(new PengampuTemplateExport, 'template-import-pengampu.xlsx');
    }

    /**
     * POST /api/admin/kurikulum/pengampu/import-potong — import bertahap
     * (potongan JSON 1000 baris/panggilan) dari browser. Lingkup ada per
     * baris dan izin dicek di PengampuImporService, bukan 403 di depan.
     * Tanpa penghapusan: baris di luar file dibiarkan (hapus tetap via
     * PUT sync yang punya guard sudah-punya-nilai/jadwal).
     */
    public function potongPengampu(PengampuPotongRequest $request, PengampuImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'pengampu_mapel', $layanan, 'pengampu');
    }

    /** POST /api/admin/kurikulum/pengampu/import-potong/{sesi}/batal. */
    public function batalPotongPengampu(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/kurikulum/pengampu/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotongPengampu(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-pengampu.csv');
    }

    // ============================================================ BANTUAN

    /**
     * Mapel yang berlaku untuk satu kelas: gabungan `kurikulum_mapel` dari
     * seluruh kurikulum kelas, disaring `tingkat` (null = semua tingkat).
     * Urut `kurikulum_mapel.urutan` lalu nama mapel.
     *
     * @param  list<int>  $kurikulumIds
     * @return list<array{mata_pelajaran_id: int, nama_mapel: string, urutan: int}>
     */
    private function mapelKurikulumKelas(Kelas $kelas, array $kurikulumIds): array
    {
        if ($kurikulumIds === []) {
            return [];
        }

        return KurikulumMapel::query()
            ->join('mata_pelajaran as mp', 'mp.id', '=', 'kurikulum_mapel.mata_pelajaran_id')
            ->whereIn('kurikulum_mapel.kurikulum_id', $kurikulumIds)
            ->where('mp.is_active', true)
            ->where(fn ($w) => $w->whereNull('kurikulum_mapel.tingkat')
                ->orWhere('kurikulum_mapel.tingkat', $kelas->tingkat))
            ->orderBy('kurikulum_mapel.urutan')
            ->orderBy('mp.nama_mapel')
            ->get(['mp.id as mata_pelajaran_id', 'mp.nama_mapel', 'kurikulum_mapel.urutan'])
            ->unique('mata_pelajaran_id')
            ->map(fn ($r) => [
                'mata_pelajaran_id' => (int) $r->mata_pelajaran_id,
                'nama_mapel' => $r->nama_mapel,
                'urutan' => (int) $r->urutan,
            ])
            ->values()
            ->all();
    }

    private function pastikanMapelSeJenjang(int $mapelId, string $jenjang): void
    {
        $mapel = MataPelajaran::find($mapelId);
        if ($mapel === null || $mapel->jenjang !== $jenjang) {
            throw ValidationException::withMessages([
                'mata_pelajaran_id' => 'Mapel harus sejenjang dengan kurikulum.',
            ]);
        }
    }

    private function kurikulumWajib(Request $request): Kurikulum
    {
        $id = $request->input('kurikulum_id');
        if ($id === null || $id === '') {
            throw ValidationException::withMessages(['kurikulum_id' => 'Pilih kurikulum.']);
        }
        $kurikulum = Kurikulum::find($id);
        if ($kurikulum === null) {
            throw ValidationException::withMessages(['kurikulum_id' => 'Kurikulum tidak ditemukan.']);
        }
        $this->authorizeLembaga($request->user(), $kurikulum->jenjang);

        return $kurikulum;
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

    private function taWajib(Request $request): string
    {
        $ta = $this->nilaiFilter($request, 'tahun_ajaran');
        if (count($ta) !== 1) {
            throw ValidationException::withMessages(['tahun_ajaran' => 'Pilih satu tahun ajaran.']);
        }

        return $ta[0];
    }
}
