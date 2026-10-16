<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\LegerPenilaianExport;
use App\Exports\PenilaianTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PenilaianPotongRequest;
use App\Models\Ekstrakurikuler;
use App\Models\ImportSesi;
use App\Models\KkmKegiatan;
use App\Models\KomponenNilai;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Models\PeristiwaNilai;
use App\Models\PredikatEkskul;
use App\Models\PrestasiSantri;
use App\Models\RentangPredikat;
use App\Services\PenilaianImporService;
use App\Services\PenilaianService;
use App\Support\NilaiRapor;
use App\Support\Terbilang;
use App\Support\TingkatJenjang;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Modul Penilaian — nilai diikat PERISTIWA (ASAS, ASAT, UJIAN, UAP).
 *
 *  Peristiwa milik (jenjang, tahun ajaran), bukan semester; semester tetap
 *  dimensi instans pencatatan skor. Rapor & leger dicetak PER PERISTIWA.
 *  Cakupan peserta peristiwa (`semua` / `kecuali_akhir` / `tingkat_akhir`)
 *  disaring memakai tingkat akhir jenjang dari `ref_tingkat.urutan`.
 */
class PenilaianController extends Controller
{
    use ImporBertahap;
    use TenantGuard;

    /** Bawaan peristiwa per jenjang (UJIAN dilewati untuk MD — jalur Kemenag). */
    private const PERISTIWA_BAWAAN = [
        ['kode' => 'ASAS', 'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua', 'kurikulum' => 'keduanya', 'urutan' => 1, 'kemenag' => true],
        ['kode' => 'ASAT', 'nama' => 'Asesmen Sumatif Akhir Tahun', 'cakupan' => 'kecuali_akhir', 'kurikulum' => 'keduanya', 'urutan' => 2, 'kemenag' => true],
        ['kode' => 'UJIAN', 'nama' => 'Ujian Madrasah (Kemenag)', 'cakupan' => 'tingkat_akhir', 'kurikulum' => 'kemenag', 'urutan' => 3, 'kemenag' => false],
        ['kode' => 'UAP', 'nama' => 'Ujian Akhir Pesantren', 'cakupan' => 'tingkat_akhir', 'kurikulum' => 'pesantren', 'urutan' => 4, 'kemenag' => true],
    ];

    /** Komponen bawaan peristiwa sumatif (ASAS/ASAT/UAP). */
    private const KOMPONEN_SUMATIF = [
        ['nama' => 'Harian', 'kode' => 'HARIAN', 'bobot' => 20, 'urutan' => 1],
        ['nama' => 'Tugas', 'kode' => 'TUGAS', 'bobot' => 20, 'urutan' => 2],
        ['nama' => 'PTS', 'kode' => 'PTS', 'bobot' => 20, 'urutan' => 3],
        ['nama' => 'Sumatif', 'kode' => 'SUMATIF', 'bobot' => 40, 'urutan' => 4],
    ];

    // ========================================================= PERISTIWA

    /** GET /admin/penilaian/peristiwa?jenjang=&tahun_ajaran= */
    public function indexPeristiwa(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $peristiwa = PeristiwaNilai::with('komponen')
            ->where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->orderBy('urutan')->orderBy('kode')
            ->get()
            ->map(function (PeristiwaNilai $p) {
                $p->setAttribute('jumlah_komponen', $p->komponen->count());
                $p->setAttribute('total_bobot', (float) $p->komponen->sum('bobot'));

                return $p;
            });

        return response()->json([
            'peristiwa' => $peristiwa,
            'tingkat_akhir' => TingkatJenjang::akhir($jenjang),
        ]);
    }

    /** POST /admin/penilaian/peristiwa */
    public function storePeristiwa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'kode' => ['required', 'string', 'max:20'],
            'nama' => ['required', 'string', 'max:100'],
            'cakupan' => ['required', 'in:semua,kecuali_akhir,tingkat_akhir'],
            'kurikulum' => ['nullable', 'in:kemenag,pesantren,keduanya'],
            'urutan' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $peristiwa = PeristiwaNilai::create($data + ['kurikulum' => $data['kurikulum'] ?? 'keduanya']);

        return response()->json($peristiwa, 201);
    }

    /** PUT /admin/penilaian/peristiwa/{peristiwa} */
    public function updatePeristiwa(Request $request, PeristiwaNilai $peristiwa): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'cakupan' => ['sometimes', 'in:semua,kecuali_akhir,tingkat_akhir'],
            'kurikulum' => ['sometimes', 'in:kemenag,pesantren,keduanya'],
            'urutan' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);
        $peristiwa->update($data);

        return response()->json($peristiwa->fresh());
    }

    /** DELETE /admin/penilaian/peristiwa/{peristiwa} */
    public function destroyPeristiwa(Request $request, PeristiwaNilai $peristiwa): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);
        if (NilaiSantri::where('peristiwa_id', $peristiwa->id)->exists()) {
            abort(422, 'Peristiwa sudah punya nilai. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }
        $peristiwa->delete();

        return response()->json(['pesan' => 'Peristiwa dihapus.']);
    }

    /**
     * POST /admin/penilaian/bawaan — muat 4 peristiwa bawaan per (jenjang, TA):
     * ASAS (semua) & ASAT (kecuali tingkat akhir) & UAP (tingkat akhir) dengan
     * komponen Harian 20 + Tugas 20 + PTS 20 + Sumatif 40; UJIAN (tingkat
     * akhir, jenjang non-MD) dengan UM 60 + Rata-rata Rapor 40 (otomatis).
     * KKM 75 dan predikat A/B/C/D ikut dibuat.
     */
    public function bawaan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);
        $jenjang = $data['jenjang'];
        $ta = $data['tahun_ajaran'];

        $dibuat = [];
        DB::transaction(function () use ($jenjang, $ta, &$dibuat) {
            foreach (self::PERISTIWA_BAWAAN as $p) {
                // UJIAN = jalur Kemenag → MD dilewati.
                if ($p['kode'] === PeristiwaNilai::UJIAN && $jenjang === 'MD') {
                    continue;
                }
                $peristiwa = PeristiwaNilai::updateOrCreate(
                    ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'kode' => $p['kode']],
                    ['nama' => $p['nama'], 'cakupan' => $p['cakupan'], 'kurikulum' => $p['kurikulum'], 'urutan' => $p['urutan'], 'is_active' => true],
                );
                $dibuat[] = $p['kode'];

                $komponen = $p['kode'] === PeristiwaNilai::UJIAN
                    ? [
                        ['nama' => 'UM', 'kode' => 'UM', 'bobot' => 60, 'urutan' => 1, 'sumber' => KomponenNilai::MANUAL, 'n' => null],
                        ['nama' => 'Rata-rata Rapor', 'kode' => 'RAPOR', 'bobot' => 40, 'urutan' => 2, 'sumber' => KomponenNilai::RAPOR_OTOMATIS, 'n' => 2],
                    ]
                    : array_map(fn ($k) => $k + ['sumber' => KomponenNilai::MANUAL, 'n' => null], self::KOMPONEN_SUMATIF);

                foreach ($komponen as $k) {
                    KomponenNilai::updateOrCreate(
                        ['peristiwa_id' => $peristiwa->id, 'nama' => $k['nama']],
                        [
                            'kode' => $k['kode'], 'bobot' => $k['bobot'], 'urutan' => $k['urutan'],
                            'sumber' => $k['sumber'], 'jumlah_tingkat_rapor' => $k['n'], 'is_active' => true,
                        ],
                    );
                    KkmKegiatan::updateOrCreate(
                        ['peristiwa_id' => $peristiwa->id, 'kegiatan' => $k['nama']],
                        ['kkm' => 75],
                    );
                }

                KkmKegiatan::updateOrCreate(
                    ['peristiwa_id' => $peristiwa->id, 'kegiatan' => KkmKegiatan::AKHIR],
                    ['kkm' => 75],
                );

                foreach ([['A', 20.0], ['B', 10.0], ['C', 0.0], ['D', null]] as [$predikat, $offset]) {
                    RentangPredikat::updateOrCreate(
                        ['peristiwa_id' => $peristiwa->id, 'predikat' => $predikat],
                        ['offset_bawah' => $offset],
                    );
                }
            }
        });

        return response()->json(['pesan' => 'Bawaan dimuat: '.implode(', ', $dibuat).'.', 'peristiwa' => $dibuat]);
    }

    // ========================================================= KOMPONEN

    /** GET /admin/penilaian/komponen?peristiwa_id= */
    public function indexKomponen(Request $request): JsonResponse
    {
        $peristiwa = $this->peristiwaWajib($request);

        $komponen = KomponenNilai::where('peristiwa_id', $peristiwa->id)
            ->orderBy('urutan')->orderBy('nama')
            ->get();

        return response()->json([
            'komponen' => $komponen,
            'total_bobot' => (float) $komponen->sum('bobot'),
            'peristiwa' => $peristiwa,
        ]);
    }

    /** POST /admin/penilaian/komponen */
    public function storeKomponen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'nama' => ['required', 'string', 'max:100'],
            'kode' => ['nullable', 'string', 'max:20'],
            'bobot' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'sumber' => ['nullable', 'in:manual,rapor_otomatis'],
            'jumlah_tingkat_rapor' => ['nullable', 'integer', 'min:1', 'max:6'],
            'urutan' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        return response()->json(KomponenNilai::create($data), 201);
    }

    /** PUT /admin/penilaian/komponen/{komponen} */
    public function updateKomponen(Request $request, KomponenNilai $komponen): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'kode' => ['nullable', 'string', 'max:20'],
            'bobot' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'sumber' => ['sometimes', 'in:manual,rapor_otomatis'],
            'jumlah_tingkat_rapor' => ['nullable', 'integer', 'min:1', 'max:6'],
            'urutan' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $komponen->peristiwa->jenjang);
        $komponen->update($data);

        return response()->json($komponen->fresh());
    }

    /** DELETE /admin/penilaian/komponen/{komponen} */
    public function destroyKomponen(Request $request, KomponenNilai $komponen): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $komponen->peristiwa->jenjang);
        $komponen->delete();

        return response()->json(['pesan' => 'Komponen dihapus.']);
    }

    // ========================================================= KKM & PREDIKAT

    /** GET /admin/penilaian/kkm?peristiwa_id= */
    public function indexKkm(Request $request): JsonResponse
    {
        $peristiwa = $this->peristiwaWajib($request);
        $kkm = KkmKegiatan::where('peristiwa_id', $peristiwa->id)->pluck('kkm', 'kegiatan');

        $baris = KomponenNilai::where('peristiwa_id', $peristiwa->id)
            ->orderBy('urutan')->orderBy('nama')
            ->get()
            ->map(fn (KomponenNilai $k) => [
                'kegiatan' => $k->nama,
                'komponen_nilai_id' => $k->id,
                'kkm' => (float) ($kkm[$k->nama] ?? 0),
            ])->values();

        $baris->push([
            'kegiatan' => KkmKegiatan::AKHIR,
            'komponen_nilai_id' => null,
            'kkm' => (float) ($kkm[KkmKegiatan::AKHIR] ?? 0),
        ]);

        return response()->json(['baris' => $baris]);
    }

    /** PUT /admin/penilaian/kkm */
    public function simpanKkm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'baris' => ['required', 'array'],
            'baris.*.kegiatan' => ['required', 'string', 'max:50'],
            'baris.*.kkm' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        DB::transaction(function () use ($data, $peristiwa) {
            foreach ($data['baris'] as $b) {
                KkmKegiatan::updateOrCreate(
                    ['peristiwa_id' => $peristiwa->id, 'kegiatan' => $b['kegiatan']],
                    ['kkm' => $b['kkm']],
                );
            }
        });

        return response()->json(['pesan' => 'KKM disimpan.']);
    }

    /** GET /admin/penilaian/predikat?peristiwa_id= */
    public function indexPredikat(Request $request): JsonResponse
    {
        $peristiwa = $this->peristiwaWajib($request);

        $baris = RentangPredikat::where('peristiwa_id', $peristiwa->id)
            ->orderByRaw('offset_bawah IS NULL')->orderByDesc('offset_bawah')
            ->get();

        return response()->json(['baris' => $baris]);
    }

    /** PUT /admin/penilaian/predikat */
    public function simpanPredikat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'baris' => ['required', 'array'],
            'baris.*.predikat' => ['required', 'string', 'max:2'],
            'baris.*.offset_bawah' => ['nullable', 'numeric'],
            'baris.*.keterangan' => ['nullable', 'string', 'max:100'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        DB::transaction(function () use ($data, $peristiwa) {
            foreach ($data['baris'] as $b) {
                RentangPredikat::updateOrCreate(
                    ['peristiwa_id' => $peristiwa->id, 'predikat' => strtoupper($b['predikat'])],
                    ['offset_bawah' => $b['offset_bawah'] ?? null, 'keterangan' => $b['keterangan'] ?? null],
                );
            }
        });

        return response()->json(['pesan' => 'Predikat disimpan.']);
    }

    // ========================================================= EKSKUL & PRESTASI

    /** GET /admin/penilaian/ekskul?jenjang=&tahun_ajaran= */
    public function indexEkskul(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        return response()->json(
            Ekstrakurikuler::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)->orderBy('nama')->get()
        );
    }

    /** POST /admin/penilaian/ekskul */
    public function storeEkskul(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'nama' => ['required', 'string', 'max:100'],
            'pembimbing' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return response()->json(Ekstrakurikuler::create($data + ['is_active' => $data['is_active'] ?? true]), 201);
    }

    /** PUT /admin/penilaian/ekskul/{ekskul} */
    public function updateEkskul(Request $request, Ekstrakurikuler $ekskul): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'pembimbing' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $ekskul->jenjang);
        $ekskul->update($data);

        return response()->json($ekskul->fresh());
    }

    /** DELETE /admin/penilaian/ekskul/{ekskul} */
    public function destroyEkskul(Request $request, Ekstrakurikuler $ekskul): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $ekskul->jenjang);
        $ekskul->delete();

        return response()->json(['pesan' => 'Ekstrakurikuler dihapus.']);
    }

    /** GET /admin/penilaian/predikat-ekskul */
    public function indexPredikatEkskul(Request $request): JsonResponse
    {
        return response()->json(
            PredikatEkskul::orderByRaw('jenjang IS NULL')->orderBy('jenjang')->orderBy('urutan')->orderBy('predikat')->get()
        );
    }

    /** PUT /admin/penilaian/predikat-ekskul */
    public function simpanPredikatEkskul(Request $request): JsonResponse
    {
        $data = $request->validate([
            'baris' => ['required', 'array'],
            'baris.*.jenjang' => ['nullable', 'string', 'exists:lembaga,jenjang'],
            'baris.*.predikat' => ['required', 'string', 'max:2'],
            'baris.*.deskripsi' => ['required', 'string', 'max:100'],
            'baris.*.urutan' => ['nullable', 'integer', 'min:0'],
        ]);
        foreach ($data['baris'] as $b) {
            if (! empty($b['jenjang'])) {
                $this->authorizeLembaga($request->user(), $b['jenjang']);
            } elseif (! $request->user()->bolehSuperAdmin()) {
                abort(403, 'Predikat global hanya boleh diubah super_admin.');
            }
        }

        DB::transaction(function () use ($data) {
            foreach ($data['baris'] as $b) {
                PredikatEkskul::updateOrCreate(
                    ['jenjang' => $b['jenjang'] ?? null, 'predikat' => strtoupper($b['predikat'])],
                    ['deskripsi' => $b['deskripsi'], 'urutan' => $b['urutan'] ?? 0],
                );
            }
        });

        return response()->json(['pesan' => 'Predikat ekstrakurikuler disimpan.']);
    }

    /** GET /admin/penilaian/prestasi?tahun_ajaran=&santri_id=&q= */
    public function indexPrestasi(Request $request): JsonResponse
    {
        $ta = $this->taWajib($request);
        $q = PrestasiSantri::with('santri:id,nama_lengkap')->where('tahun_ajaran', $ta);
        if ($request->filled('santri_id')) {
            $q->where('santri_id', (int) $request->input('santri_id'));
        }
        if ($request->filled('q')) {
            $cari = (string) $request->input('q');
            $q->whereHas('santri', fn ($s) => $s->where('nama_lengkap', 'like', "%{$cari}%"));
        }

        return response()->json($q->orderByDesc('id')->limit(500)->get());
    }

    /** POST /admin/penilaian/prestasi */
    public function storePrestasi(Request $request): JsonResponse
    {
        $data = $request->validate([
            'santri_id' => ['required', 'integer', 'exists:santri,id'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'semester' => ['nullable', 'in:1,2'],
            'prestasi' => ['required', 'string', 'max:150'],
            'level' => ['nullable', 'string', 'max:50'],
            'keterangan' => ['nullable', 'string', 'max:500'],
        ]);

        return response()->json(PrestasiSantri::create($data), 201);
    }

    /** DELETE /admin/penilaian/prestasi/{prestasi} */
    public function destroyPrestasi(PrestasiSantri $prestasi): JsonResponse
    {
        $prestasi->delete();

        return response()->json(['pesan' => 'Prestasi dihapus.']);
    }

    // ========================================================= HITUNG ULANG

    /**
     * POST /admin/penilaian/hitung — hitung ulang nilai akhir dari komponen
     * untuk seluruh santri dalam lingkup. Baris ber-`sumber='impor'` DILEWATI
     * kecuali `paksa=1` (sesuai keputusan PRD).
     */
    public function hitungUlang(Request $request, PenilaianService $nilai): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'semester' => ['required', 'in:1,2'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'paksa' => ['nullable', 'boolean'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);
        $jenjang = $peristiwa->jenjang;
        $ta = $peristiwa->tahun_ajaran;
        $semester = (string) $data['semester'];
        $paksa = $request->boolean('paksa');

        $pengampu = PengampuMapel::query()
            ->join('kelas', 'kelas.id', '=', 'pengampu_mapel.kelas_id')
            ->where('kelas.jenjang', $jenjang)->where('kelas.tahun_ajaran', $ta)
            ->when($request->filled('kelas_id'), fn ($q) => $q->where('kelas.id', (int) $data['kelas_id']))
            ->get(['pengampu_mapel.id', 'pengampu_mapel.kelas_id', 'pengampu_mapel.mata_pelajaran_id']);

        $dihitung = 0;
        $dilewatiImpor = 0;
        $belumLengkap = 0;

        foreach ($pengampu as $pm) {
            $santri = $this->santriKelas($pm->kelas_id, $jenjang, $ta, $semester);
            foreach ($santri as $s) {
                if (! $nilai->tingkatCocokCakupan($peristiwa, $s->tingkat)) {
                    continue;
                }
                $ada = NilaiSantri::where('santri_id', $s->santri_id)
                    ->where('pengampu_mapel_id', $pm->id)
                    ->where('tahun_ajaran', $ta)->where('semester', $semester)
                    ->where('peristiwa_id', $peristiwa->id)
                    ->first();
                if ($ada !== null && $ada->sumber === NilaiSantri::IMPOR && ! $paksa) {
                    $dilewatiImpor++;

                    continue;
                }
                $hasil = $nilai->hitungAkhir(
                    (int) $s->santri_id, (int) $pm->id, (int) $pm->mata_pelajaran_id,
                    $jenjang, $s->tingkat, $ta, $semester, $peristiwa->id,
                );
                if ($hasil['nilai'] === null) {
                    $belumLengkap++;

                    continue;
                }
                $nilai->simpanAkhir((int) $s->santri_id, (int) $pm->id, $ta, $semester, $peristiwa->id, $hasil['nilai'], NilaiSantri::HITUNG);
                $dihitung++;
            }
        }

        return response()->json([
            'pesan' => "Hitung ulang selesai: {$dihitung} baris dihitung, {$dilewatiImpor} dilewati (impor), {$belumLengkap} belum lengkap.",
            'dihitung' => $dihitung,
            'dilewati_impor' => $dilewatiImpor,
            'belum_lengkap' => $belumLengkap,
        ]);
    }

    // ========================================================= LEGER

    /** GET /admin/penilaian/leger — crosstab santri × mapel untuk satu peristiwa. */
    public function leger(Request $request): JsonResponse
    {
        $peristiwa = $this->peristiwaWajib($request);
        $semester = $this->semesterWajib($request);
        [$jenjang, $ta] = [$peristiwa->jenjang, $peristiwa->tahun_ajaran];
        $this->authorizeLembaga($request->user(), $jenjang);

        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        $q = trim((string) $request->input('q', ''));

        $santri = $this->santriLeger($peristiwa, $semester, $kelasIds, $tingkat, $q);
        $kolom = $this->kolomLeger($jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester, $peristiwa->id);

        $perPage = $this->perPage($request);
        $page = max(1, (int) $request->input('page', 1));
        $total = $santri->count();
        $halaman = $santri->slice(($page - 1) * $perPage, $perPage)->values();

        $baris = $halaman->map(function ($s) use ($kolom, $peta) {
            $nilai = [];
            $angka = [];
            foreach ($kolom as $k) {
                $sel = $peta[$s->santri_id][$k['key']] ?? null;
                $nilai[$k['key']] = $sel;
                $angka[] = $sel['nilai'] ?? null;
            }

            return [
                'santri_id' => $s->santri_id,
                'nis_lokal' => $s->nis_lokal,
                'nama' => $s->nama,
                'kelas' => $s->kelas,
                'tingkat' => $s->tingkat,
                'sel' => $nilai,
                'rata_rata' => NilaiRapor::rataRata($angka),
            ];
        });

        return response()->json([
            'peristiwa' => $peristiwa,
            'kolom' => $kolom,
            'baris' => $baris,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => $perPage > 0 ? (int) max(1, ceil($total / $perPage)) : 1,
        ]);
    }

    /** GET /admin/penilaian/leger/unduh — Excel leger satu peristiwa. */
    public function unduhLeger(Request $request)
    {
        $peristiwa = $this->peristiwaWajib($request);
        $semester = $this->semesterWajib($request);
        [$jenjang, $ta] = [$peristiwa->jenjang, $peristiwa->tahun_ajaran];
        $this->authorizeLembaga($request->user(), $jenjang);

        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        $santri = $this->santriLeger($peristiwa, $semester, $kelasIds, $tingkat, trim((string) $request->input('q', '')));
        $kolom = $this->kolomLeger($jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester, $peristiwa->id);

        $headings = array_merge(
            ['nis_lokal', 'nama', 'kelas'],
            array_map(fn ($k) => $k['nama_mapel'], $kolom),
            ['rata_rata'],
        );
        $rows = $santri->map(function ($s) use ($kolom, $peta) {
            $nilai = [];
            $angka = [];
            foreach ($kolom as $k) {
                $sel = $peta[$s->santri_id][$k['key']] ?? null;
                $nilai[] = $sel['nilai'] ?? '';
                $angka[] = $sel['nilai'] ?? null;
            }

            return array_merge(
                [(string) $s->nis_lokal, $s->nama, (string) $s->kelas],
                array_map(fn ($v) => $v === null ? '' : (string) $v, $nilai),
                [(string) (NilaiRapor::rataRata($angka) ?? '')],
            );
        })->all();

        return Excel::download(
            new LegerPenilaianExport($headings, $rows),
            "leger-{$peristiwa->kode}-{$jenjang}-{$semester}.xlsx",
        );
    }

    // ========================================================= RAPOR

    /** GET /admin/penilaian/rapor?santri_id=&semester=&peristiwa_id=&peringkat= */
    public function rapor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'santri_id' => ['required', 'integer', 'exists:santri,id'],
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'semester' => ['required', 'in:1,2'],
            'peringkat' => ['nullable', 'in:3,10,semua'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $ta = $peristiwa->tahun_ajaran;
        $semester = (string) $data['semester'];
        $batasPeringkat = $data['peringkat'] ?? '10';

        $riwayat = DB::table('riwayat_belajar')
            ->join('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
            ->leftJoin('lembaga_santri', function ($j) {
                $j->on('lembaga_santri.santri_id', '=', 'riwayat_belajar.santri_id')
                    ->on('lembaga_santri.jenjang', '=', 'riwayat_belajar.jenjang');
            })
            ->where('riwayat_belajar.santri_id', $data['santri_id'])
            ->where('riwayat_belajar.jenjang', $peristiwa->jenjang)
            ->where('riwayat_belajar.tahun_ajaran', $ta)
            ->where('riwayat_belajar.semester', $semester)
            ->orderByDesc('riwayat_belajar.is_active_riwayat')
            ->select(
                'riwayat_belajar.jenjang', 'riwayat_belajar.kelas_id', 'riwayat_belajar.tingkat',
                'santri.nama_lengkap', 'santri.nisn', 'santri.jk',
                'kelas.nama_kelas', 'lembaga_santri.nis_lokal',
            )
            ->first();

        if ($riwayat === null) {
            throw ValidationException::withMessages(['santri_id' => 'Santri tidak punya riwayat pada jenjang/TA/semester itu.']);
        }
        $this->authorizeLembaga($request->user(), $riwayat->jenjang);

        $nilai = NilaiSantri::with(['pengampuMapel.mataPelajaran', 'pengampuMapel.keaktifan.pegawai'])
            ->where('santri_id', $data['santri_id'])
            ->where('tahun_ajaran', $ta)
            ->where('semester', $semester)
            ->where('peristiwa_id', $peristiwa->id)
            ->get();

        $mapel = $nilai->map(function (NilaiSantri $n) {
            return [
                'nama_mapel' => $n->pengampuMapel?->mataPelajaran?->nama_mapel ?? '—',
                'guru' => $this->namaGuru($n->pengampuMapel?->keaktifan?->pegawai),
                'nilai_akhir' => $n->nilai_akhir,
                'predikat' => $n->predikat,
                'terbilang' => Terbilang::perDigit($n->nilai_akhir),
                'sumber' => $n->sumber,
            ];
        })->sortBy('nama_mapel')->values();

        $angka = $mapel->pluck('nilai_akhir')->all();
        $rekap = $this->rekapKelas($peristiwa->id, $riwayat->kelas_id, $ta, $semester, (int) $data['santri_id'], $batasPeringkat);

        $catatan = DB::table('rapor_catatan_wali')
            ->where('santri_id', $data['santri_id'])
            ->where('tahun_ajaran', $ta)->where('semester', $semester)
            ->first();

        $ekskul = DB::table('nilai_ekstrakurikuler as ne')
            ->join('ekstrakurikuler as e', 'e.id', '=', 'ne.ekstrakurikuler_id')
            ->leftJoin('predikat_ekskul as pe', 'pe.predikat', '=', 'ne.predikat')
            ->where('ne.santri_id', $data['santri_id'])
            ->where('ne.tahun_ajaran', $ta)->where('ne.semester', $semester)
            ->select('e.nama', 'e.pembimbing', 'ne.predikat', 'ne.nilai', 'ne.deskripsi', 'pe.deskripsi as deskripsi_predikat')
            ->orderBy('e.nama')
            ->get()
            ->map(fn ($r) => [
                'nama' => $r->nama,
                'pembimbing' => $r->pembimbing,
                'predikat' => $r->predikat,
                'nilai' => $r->nilai,
                'deskripsi' => $r->deskripsi ?? $r->deskripsi_predikat,
            ]);

        $prestasi = PrestasiSantri::where('santri_id', $data['santri_id'])
            ->where('tahun_ajaran', $ta)
            ->where(fn ($w) => $w->whereNull('semester')->orWhere('semester', $semester))
            ->get(['prestasi', 'level', 'keterangan']);

        $lembaga = DB::table('lembaga')->where('jenjang', $riwayat->jenjang)
            ->select('nama', 'alamat', 'kab_kota', 'logo_url', 'mudir_am', 'template_rapor', 'mode_rapor')
            ->first();
        $walas = DB::table('kelas')->leftJoin('pegawai', 'pegawai.id', '=', 'kelas.walas_id')
            ->where('kelas.id', $riwayat->kelas_id)
            ->select('pegawai.nama_lengkap', 'pegawai.gelar_depan', 'pegawai.gelar_belakang', 'pegawai.jenis_kelamin')
            ->first();

        return response()->json([
            'peristiwa' => $peristiwa,
            'santri' => [
                'id' => (int) $data['santri_id'],
                'nama' => $riwayat->nama_lengkap,
                'nis_lokal' => $riwayat->nis_lokal,
                'nisn' => $riwayat->nisn,
                'jk' => $riwayat->jk,
            ],
            'identitas' => [
                'jenjang' => $riwayat->jenjang,
                'kelas' => $riwayat->nama_kelas,
                'tingkat' => $riwayat->tingkat,
                'semester' => $semester,
                'tahun_ajaran' => $ta,
            ],
            'kop' => [
                'nama' => $lembaga->nama ?? $riwayat->jenjang,
                'alamat' => $lembaga->alamat,
                'kab_kota' => $lembaga->kab_kota,
                'logo_url' => $lembaga->logo_url,
                'kepala' => $lembaga->mudir_am,
                'template_rapor' => $lembaga->template_rapor ?? 'default',
                'mode_rapor' => $lembaga->mode_rapor ?? 'digabung',
            ],
            'mapel' => $mapel,
            'rekap' => [
                'jumlah' => NilaiRapor::rataRata($angka) === null ? null : round(array_sum(array_filter($angka, fn ($v) => $v !== null)), 2),
                'rata_rata' => NilaiRapor::rataRata($angka),
                'peringkat' => $rekap['peringkat'],
                'peringkat_ordinal' => $rekap['peringkat'] === null ? null : Terbilang::ordinal($rekap['peringkat']),
                'peringkat_total' => $rekap['total'],
            ],
            'catatan_wali' => [
                'sakit' => $catatan->sakit ?? 0,
                'izin' => $catatan->izin ?? 0,
                'alpa' => $catatan->alpa ?? 0,
                'catatan' => $catatan->catatan_akademik ?? null,
                'status_kenaikan' => $catatan->keputusan_kenaikan ?? null,
            ],
            'ekskul' => $ekskul,
            'prestasi' => $prestasi,
            'penandatangan' => [
                'wali_kelas' => $this->namaGuru($walas),
                'kepala' => $lembaga->mudir_am ?? null,
            ],
        ]);
    }

    /** GET /admin/penilaian/rapor-kelas?peristiwa_id=&semester=&kelas_id= */
    public function raporKelas(Request $request): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'semester' => ['required', 'in:1,2'],
            'kelas_id' => ['required', 'integer', 'exists:kelas,id'],
        ]);
        $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);
        $ta = $peristiwa->tahun_ajaran;
        $semester = (string) $data['semester'];

        $kelasIds = DB::table('kelas')->where('id', (int) $data['kelas_id'])
            ->where('jenjang', $peristiwa->jenjang)->where('tahun_ajaran', $ta)
            ->pluck('id')->map(fn ($v) => (int) $v)->all();
        if ($kelasIds === []) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas tidak ada pada jenjang/TA peristiwa ini.']);
        }

        $santri = $this->santriLeger($peristiwa, $semester, $kelasIds, [], '');
        $kolom = $this->kolomLeger($peristiwa->jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester, $peristiwa->id);
        $jumlahMapel = count($kolom);

        $catatanAda = DB::table('rapor_catatan_wali')
            ->whereIn('santri_id', $santri->pluck('santri_id')->all())
            ->where('tahun_ajaran', $ta)->where('semester', $semester)
            ->pluck('santri_id')->flip();

        $baris = $santri->map(function ($s) use ($kolom, $peta, $jumlahMapel, $catatanAda) {
            $terisi = 0;
            foreach ($kolom as $k) {
                if (($peta[$s->santri_id][$k['key']]['nilai'] ?? null) !== null) {
                    $terisi++;
                }
            }

            return [
                'santri_id' => $s->santri_id,
                'nis_lokal' => $s->nis_lokal,
                'nama' => $s->nama,
                'mapel_terisi' => $terisi,
                'mapel_total' => $jumlahMapel,
                'lengkap' => $jumlahMapel > 0 && $terisi === $jumlahMapel,
                'ada_catatan' => $catatanAda->has($s->santri_id),
            ];
        });

        return response()->json([
            'peristiwa' => $peristiwa,
            'kolom' => $kolom,
            'baris' => $baris,
            'ringkasan' => [
                'santri' => $baris->count(),
                'lengkap' => $baris->where('lengkap', true)->count(),
                'tanpa_catatan' => $baris->where('ada_catatan', false)->count(),
                'mapel' => $jumlahMapel,
            ],
        ]);
    }

    // ========================================================= IMPOR

    /** GET /admin/penilaian/import-template?tipe=&peristiwa_id=&kelas_id= */
    public function template(Request $request)
    {
        $tipe = (string) $request->input('tipe', 'nilai');
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);
        $this->authorizeLembaga($request->user(), $jenjang);

        $ekspor = match ($tipe) {
            'catatan_wali' => new PenilaianTemplateExport(
                $tipe, 'Catatan Wali',
                ['nis_lokal', 'nama', 'kelas', 'sakit', 'izin', 'alpa', 'catatan', 'status_kenaikan'],
                ['nis_lokal' => '26001', 'nama' => '', 'kelas' => '1A', 'sakit' => '0', 'izin' => '0', 'alpa' => '0', 'catatan' => '', 'status_kenaikan' => ''],
                ['jenjang' => PenilaianTemplateExport::pilihanJenjang()],
            ),
            'prestasi' => new PenilaianTemplateExport(
                $tipe, 'Prestasi',
                ['nis_lokal', 'nama', 'kelas', 'prestasi', 'level', 'keterangan'],
                ['nis_lokal' => '26001', 'nama' => '', 'kelas' => '1A', 'prestasi' => '', 'level' => '', 'keterangan' => ''],
                ['jenjang' => PenilaianTemplateExport::pilihanJenjang()],
            ),
            'ekskul' => $this->templateEkskul($jenjang, $ta),
            default => $this->templateNilai($request, $jenjang, $ta),
        };

        return Excel::download($ekspor, "template-import-penilaian-{$tipe}.xlsx");
    }

    /** POST /admin/penilaian/import-potong — potongan JSON (maks 1000). */
    public function potongImport(PenilaianPotongRequest $request): JsonResponse
    {
        $data = $request->validated();
        $jenjang = $data['jenjang'] ?? [];
        if ($jenjang === []) {
            $jenjang = $this->jenjangUntukBerkas($request);
        } else {
            $this->authorizeLembagaMany($request->user(), $jenjang);
        }

        if (! empty($data['peristiwa_id'])) {
            $peristiwa = PeristiwaNilai::findOrFail($data['peristiwa_id']);
            $this->authorizeLembaga($request->user(), $peristiwa->jenjang);
        }

        $layanan = new PenilaianImporService(
            $data['tipe'],
            $data['tahun_ajaran'],
            (string) $data['semester'],
            array_values(array_map('strval', $jenjang)),
            $data['peristiwa_id'] ?? null,
            $data['komponen_id'] ?? null,
        );

        return $this->jalankanImporSesi($request, 'penilaian', $layanan, 'penilaian');
    }

    /** POST /admin/penilaian/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /admin/penilaian/import-potong/{sesi}/galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-penilaian.csv');
    }

    // ========================================================= BANTUAN

    private function templateNilai(Request $request, string $jenjang, string $ta): PenilaianTemplateExport
    {
        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        $mapel = DB::table('mata_pelajaran')->where('jenjang', $jenjang)->orderBy('nama_mapel')->pluck('nama_mapel')->all();
        if ($kelasIds !== []) {
            $mapel = DB::table('pengampu_mapel')
                ->join('mata_pelajaran', 'mata_pelajaran.id', '=', 'pengampu_mapel.mata_pelajaran_id')
                ->whereIn('pengampu_mapel.kelas_id', $kelasIds)
                ->orderBy('mata_pelajaran.nama_mapel')
                ->distinct()->pluck('mata_pelajaran.nama_mapel')->all();
        }
        $kolom = array_merge(['nis_lokal', 'nama', 'jenjang', 'kelas', 'tahun_ajaran', 'semester'], $mapel);
        $contoh = ['nis_lokal' => '26001', 'nama' => '', 'jenjang' => $jenjang, 'kelas' => '1A', 'tahun_ajaran' => $ta, 'semester' => '1'];
        foreach ($mapel as $m) {
            $contoh[$m] = '';
        }

        return new PenilaianTemplateExport('nilai', 'Nilai / Leger', $kolom, $contoh, [
            'jenjang' => PenilaianTemplateExport::pilihanJenjang(),
            'semester' => ['1', '2'],
        ]);
    }

    private function templateEkskul(string $jenjang, string $ta): PenilaianTemplateExport
    {
        $nama = Ekstrakurikuler::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)->orderBy('nama')->pluck('nama')->all();
        $jumlah = max(3, count($nama));
        $kolom = ['nis_lokal', 'nama', 'kelas'];
        $contoh = ['nis_lokal' => '26001', 'nama' => '', 'kelas' => '1A'];
        for ($i = 1; $i <= $jumlah; $i++) {
            $kolom[] = "ekskul{$i}";
            $kolom[] = "predikat{$i}";
            $contoh["ekskul{$i}"] = $nama[$i - 1] ?? '';
            $contoh["predikat{$i}"] = '';
        }

        return new PenilaianTemplateExport('ekskul', 'Ekstrakurikuler', $kolom, $contoh, [
            'jenjang' => PenilaianTemplateExport::pilihanJenjang(),
        ]);
    }

    private function peristiwaWajib(Request $request): PeristiwaNilai
    {
        $id = $request->input('peristiwa_id');
        if ($id === null || $id === '') {
            throw ValidationException::withMessages(['peristiwa_id' => 'Pilih peristiwa penilaian.']);
        }
        $peristiwa = PeristiwaNilai::find($id);
        if ($peristiwa === null) {
            throw ValidationException::withMessages(['peristiwa_id' => 'Peristiwa tidak ditemukan.']);
        }
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        return $peristiwa;
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

    private function semesterWajib(Request $request): string
    {
        $semester = $this->nilaiFilter($request, 'semester');
        if (count($semester) !== 1 || ! in_array($semester[0], ['1', '2'], true)) {
            throw ValidationException::withMessages(['semester' => 'Pilih semester 1 atau 2.']);
        }

        return $semester[0];
    }

    /** @return list<int> */
    private function kelasFilter(Request $request, string $jenjang, string $ta): array
    {
        $ids = array_map('intval', $this->nilaiFilter($request, 'kelas_id'));
        if ($ids === []) {
            return [];
        }

        return DB::table('kelas')->whereIn('id', $ids)
            ->where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->pluck('id')->map(fn ($v) => (int) $v)->all();
    }

    /**
     * Santri peserta leger: riwayat pada (jenjang, TA, semester) + saringan
     * CAKUPAN peristiwa (tingkat akhir) + filter kelas/tingkat/pencarian.
     *
     * @param  list<int>  $kelasIds
     * @param  list<string>  $tingkat
     */
    private function santriLeger(PeristiwaNilai $peristiwa, string $semester, array $kelasIds, array $tingkat, string $q)
    {
        $jenjang = $peristiwa->jenjang;
        $ta = $peristiwa->tahun_ajaran;
        $akhir = TingkatJenjang::akhir($jenjang);

        $query = DB::table('riwayat_belajar as rb')
            ->join('santri', 'santri.id', '=', 'rb.santri_id')
            ->leftJoin('kelas', 'kelas.id', '=', 'rb.kelas_id')
            ->leftJoin('lembaga_santri as ls', function ($j) {
                $j->on('ls.santri_id', '=', 'rb.santri_id')->on('ls.jenjang', '=', 'rb.jenjang');
            })
            ->where('rb.jenjang', $jenjang)
            ->where('rb.tahun_ajaran', $ta)
            ->where('rb.semester', $semester)
            ->where('rb.status_akhir', '!=', 'pindah_keluar')
            ->select(
                'rb.santri_id', 'santri.nama_lengkap as nama', 'ls.nis_lokal',
                'rb.kelas_id', 'kelas.nama_kelas as kelas', 'rb.tingkat', 'rb.no_absen',
            )
            ->orderBy('rb.tingkat')->orderBy('kelas.nama_kelas')->orderBy('rb.no_absen')->orderBy('santri.nama_lengkap');

        // Cakupan peserta peristiwa.
        if ($akhir !== null) {
            if ($peristiwa->cakupan === PeristiwaNilai::CAKUPAN_TINGKAT_AKHIR) {
                $query->where('rb.tingkat', $akhir);
            } elseif ($peristiwa->cakupan === PeristiwaNilai::CAKUPAN_KECUALI_AKHIR) {
                $query->where(fn ($w) => $w->whereNull('rb.tingkat')->orWhere('rb.tingkat', '!=', $akhir));
            }
        }

        if ($kelasIds !== []) {
            $query->whereIn('rb.kelas_id', $kelasIds);
        }
        if ($tingkat !== []) {
            $query->whereIn('rb.tingkat', $tingkat);
        }
        if ($q !== '') {
            $query->where(fn ($w) => $w->where('santri.nama_lengkap', 'like', "%{$q}%")
                ->orWhere('ls.nis_lokal', 'like', "%{$q}%"));
        }

        return $query->get();
    }

    /** Santri satu kelas pada (jenjang, TA, semester) — untuk hitung ulang. */
    private function santriKelas(int $kelasId, string $jenjang, string $ta, string $semester)
    {
        return DB::table('riwayat_belajar')
            ->where('kelas_id', $kelasId)
            ->where('jenjang', $jenjang)
            ->where('tahun_ajaran', $ta)
            ->where('semester', $semester)
            ->where('status_akhir', '!=', 'pindah_keluar')
            ->get(['santri_id', 'tingkat']);
    }

    /**
     * Kolom leger: satu kolom per mapel yang punya pengampu dalam lingkup.
     *
     * @param  list<int>  $kelasIds
     * @return list<array{key: string, mapel_id: int, nama_mapel: string}>
     */
    private function kolomLeger(string $jenjang, array $kelasIds): array
    {
        $q = DB::table('pengampu_mapel')
            ->join('mata_pelajaran', 'mata_pelajaran.id', '=', 'pengampu_mapel.mata_pelajaran_id')
            ->join('kelas', 'kelas.id', '=', 'pengampu_mapel.kelas_id')
            ->where('kelas.jenjang', $jenjang);
        if ($kelasIds !== []) {
            $q->whereIn('pengampu_mapel.kelas_id', $kelasIds);
        }

        return $q->orderBy('mata_pelajaran.nama_mapel')
            ->distinct()
            ->get(['mata_pelajaran.id as mapel_id', 'mata_pelajaran.nama_mapel'])
            ->map(fn ($r) => ['key' => 'm'.$r->mapel_id, 'mapel_id' => (int) $r->mapel_id, 'nama_mapel' => $r->nama_mapel])
            ->all();
    }

    /**
     * Peta nilai: santri_id → key kolom → sel (nilai/predikat/sumber/guru).
     *
     * @param  list<int>  $santriIds
     * @param  list<array{key: string, mapel_id: int}>  $kolom
     */
    private function petaNilai(array $santriIds, array $kolom, string $ta, string $semester, int $peristiwaId): array
    {
        if ($santriIds === [] || $kolom === []) {
            return [];
        }
        $mapelIds = array_column($kolom, 'mapel_id');
        $kunciMapel = array_column($kolom, 'key', 'mapel_id');

        $rows = DB::table('nilai_santri as ns')
            ->join('pengampu_mapel as pm', 'pm.id', '=', 'ns.pengampu_mapel_id')
            ->leftJoin('keaktifan_pegawai as kp', 'kp.id', '=', 'pm.keaktifan_pegawai_id')
            ->leftJoin('pegawai as pg', 'pg.id', '=', 'kp.pegawai_id')
            ->whereIn('ns.santri_id', $santriIds)
            ->whereIn('pm.mata_pelajaran_id', $mapelIds)
            ->where('ns.tahun_ajaran', $ta)
            ->where('ns.semester', $semester)
            ->where('ns.peristiwa_id', $peristiwaId)
            ->select(
                'ns.santri_id', 'pm.mata_pelajaran_id', 'ns.nilai_akhir', 'ns.predikat', 'ns.sumber',
                'pg.nama_lengkap', 'pg.gelar_depan', 'pg.gelar_belakang', 'pg.jenis_kelamin',
            )
            ->get();

        $peta = [];
        foreach ($rows as $r) {
            $key = $kunciMapel[$r->mata_pelajaran_id] ?? null;
            if ($key === null) {
                continue;
            }
            $peta[(int) $r->santri_id][$key] = [
                'nilai' => $r->nilai_akhir === null ? null : (float) $r->nilai_akhir,
                'predikat' => $r->predikat,
                'sumber' => $r->sumber,
                'guru' => $this->namaGuru($r),
            ];
        }

        return $peta;
    }

    /** @return array{peringkat: ?int, total: int} */
    private function rekapKelas(int $peristiwaId, ?int $kelasId, string $ta, string $semester, int $santriId, string $batas): array
    {
        if ($kelasId === null) {
            return ['peringkat' => null, 'total' => 0];
        }
        $rows = DB::table('nilai_santri as ns')
            ->join('riwayat_belajar as rb', 'rb.santri_id', '=', 'ns.santri_id')
            ->where('rb.tahun_ajaran', $ta)->where('rb.semester', $semester)
            ->where('rb.kelas_id', $kelasId)
            ->where('ns.tahun_ajaran', $ta)->where('ns.semester', $semester)
            ->where('ns.peristiwa_id', $peristiwaId)
            ->groupBy('ns.santri_id')
            ->selectRaw('ns.santri_id, AVG(ns.nilai_akhir) as rata')
            ->pluck('rata', 'ns.santri_id')
            ->map(fn ($v) => $v === null ? null : (float) $v)
            ->all();

        $peringkat = NilaiRapor::peringkat($rows);
        $nilai = $peringkat[$santriId] ?? null;
        $total = count($rows);
        $cutoff = $batas === 'semua' ? $total : (int) $batas;
        if ($nilai !== null && $nilai > $cutoff) {
            $nilai = null; // di luar cutoff: sel peringkat dikosongkan (spesimen)
        }

        return ['peringkat' => $nilai, 'total' => $total];
    }

    private function namaGuru(?object $pegawai): ?string
    {
        if ($pegawai === null || ($pegawai->nama_lengkap ?? null) === null) {
            return null;
        }
        $sapaan = ($pegawai->jenis_kelamin ?? null) === 'P' ? 'Ibu' : 'Ust.';
        $gelarDepan = trim((string) ($pegawai->gelar_depan ?? ''));
        $gelarBelakang = trim((string) ($pegawai->gelar_belakang ?? ''));
        $nama = trim((string) $pegawai->nama_lengkap);
        $nama = ($gelarDepan !== '' ? $gelarDepan.' ' : '').$nama.($gelarBelakang !== '' ? ', '.$gelarBelakang : '');

        return trim("{$sapaan} {$nama}");
    }
}
