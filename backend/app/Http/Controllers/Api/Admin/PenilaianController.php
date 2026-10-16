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
use App\Models\KomponenNilaiBobot;
use App\Models\NilaiSantri;
use App\Models\PredikatEkskul;
use App\Models\PrestasiSantri;
use App\Models\RentangPredikat;
use App\Services\PenilaianImporService;
use App\Support\NilaiRapor;
use App\Support\Terbilang;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Modul Penilaian: master (komponen+bobot, KKM, predikat, ekskul, prestasi),
 * leger (crosstab santri × mapel), rapor per santri, dan impor 4 template.
 *
 *  Dua jalur nilai: HITUNG (komponen × bobot) dan IMPOR leger — lihat
 *  `PenilaianImporService` + `App\Support\NilaiRapor`.
 */
class PenilaianController extends Controller
{
    use ImporBertahap;
    use TenantGuard;

    // =========================================================== MASTER

    /** GET /admin/penilaian/komponen?jenjang=&tahun_ajaran= */
    public function indexKomponen(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $komponen = KomponenNilai::where('jenjang', $jenjang)
            ->orderBy('urutan')->orderBy('nama')
            ->get();

        $bobot = KomponenNilaiBobot::where('tahun_ajaran', $ta)
            ->whereIn('komponen_nilai_id', $komponen->pluck('id'))
            ->pluck('bobot', 'komponen_nilai_id');

        $komponen->each(fn (KomponenNilai $k) => $k->setAttribute('bobot', (float) ($bobot[$k->id] ?? 0)));

        return response()->json([
            'komponen' => $komponen,
            'total_bobot' => (float) $komponen->sum('bobot'),
        ]);
    }

    /** POST /admin/penilaian/komponen */
    public function storeKomponen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'nama' => ['required', 'string', 'max:100'],
            'kode' => ['nullable', 'string', 'max:20'],
            'urutan' => ['nullable', 'integer', 'min:0'],
            'bobot' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $komponen = KomponenNilai::create([
            'jenjang' => $data['jenjang'],
            'nama' => $data['nama'],
            'kode' => $data['kode'] ?? null,
            'urutan' => $data['urutan'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        KomponenNilaiBobot::create([
            'komponen_nilai_id' => $komponen->id,
            'tahun_ajaran' => $data['tahun_ajaran'],
            'bobot' => $data['bobot'] ?? 0,
        ]);

        return response()->json($komponen->setAttribute('bobot', (float) ($data['bobot'] ?? 0)), 201);
    }

    /** PUT /admin/penilaian/komponen/{komponen} */
    public function updateKomponen(Request $request, KomponenNilai $komponen): JsonResponse
    {
        $data = $request->validate([
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'nama' => ['sometimes', 'string', 'max:100'],
            'kode' => ['nullable', 'string', 'max:20'],
            'urutan' => ['sometimes', 'integer', 'min:0'],
            'bobot' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), $komponen->jenjang);

        $komponen->update(collect($data)->only(['nama', 'kode', 'urutan', 'is_active'])->all());
        if (array_key_exists('bobot', $data)) {
            KomponenNilaiBobot::updateOrCreate(
                ['komponen_nilai_id' => $komponen->id, 'tahun_ajaran' => $data['tahun_ajaran']],
                ['bobot' => $data['bobot']],
            );
        }

        return response()->json($komponen->fresh()->setAttribute('bobot', (float) ($data['bobot'] ?? 0)));
    }

    /** DELETE /admin/penilaian/komponen/{komponen} */
    public function destroyKomponen(Request $request, KomponenNilai $komponen): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $komponen->jenjang);
        $komponen->delete();

        return response()->json(['pesan' => 'Komponen dihapus.']);
    }

    /**
     * POST /admin/penilaian/bawaan — muat bawaan per (jenjang, TA):
     * UH 20 + Tugas 20 + PTS 20 + ASAS 40, KKM AKHIR 75, predikat A/B/C/D.
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

        $bawaan = [['UH', 20, 1], ['Tugas', 20, 2], ['PTS', 20, 3], ['ASAS', 40, 4]];
        foreach ($bawaan as [$nama, $bobot, $urutan]) {
            $komponen = KomponenNilai::firstOrCreate(
                ['jenjang' => $jenjang, 'nama' => $nama],
                ['kode' => mb_substr($nama, 0, 20), 'urutan' => $urutan, 'is_active' => true],
            );
            KomponenNilaiBobot::updateOrCreate(
                ['komponen_nilai_id' => $komponen->id, 'tahun_ajaran' => $ta],
                ['bobot' => $bobot],
            );
            KkmKegiatan::updateOrCreate(
                ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'kegiatan' => $nama],
                ['komponen_nilai_id' => $komponen->id, 'kkm' => 75],
            );
        }

        KkmKegiatan::updateOrCreate(
            ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'kegiatan' => KkmKegiatan::AKHIR],
            ['komponen_nilai_id' => null, 'kkm' => 75],
        );

        foreach ([['A', 20.0], ['B', 10.0], ['C', 0.0], ['D', null]] as [$predikat, $offset]) {
            RentangPredikat::updateOrCreate(
                ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'predikat' => $predikat],
                ['offset_bawah' => $offset],
            );
        }

        return response()->json(['pesan' => 'Bawaan komponen, KKM, dan predikat dimuat.']);
    }

    /** GET /admin/penilaian/kkm?jenjang=&tahun_ajaran= */
    public function indexKkm(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $komponen = KomponenNilai::where('jenjang', $jenjang)->orderBy('urutan')->orderBy('nama')->get();
        $kkm = KkmKegiatan::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)->pluck('kkm', 'kegiatan');

        $baris = $komponen->map(fn (KomponenNilai $k) => [
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

    /** PUT /admin/penilaian/kkm — upsert batch (jenjang, TA, baris[]). */
    public function simpanKkm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'baris' => ['required', 'array'],
            'baris.*.kegiatan' => ['required', 'string', 'max:50'],
            'baris.*.komponen_nilai_id' => ['nullable', 'integer', 'exists:komponen_nilai,id'],
            'baris.*.kkm' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        DB::transaction(function () use ($data) {
            foreach ($data['baris'] as $b) {
                KkmKegiatan::updateOrCreate(
                    ['jenjang' => $data['jenjang'], 'tahun_ajaran' => $data['tahun_ajaran'], 'kegiatan' => $b['kegiatan']],
                    ['komponen_nilai_id' => $b['komponen_nilai_id'] ?? null, 'kkm' => $b['kkm']],
                );
            }
        });

        return response()->json(['pesan' => 'KKM disimpan.']);
    }

    /** GET /admin/penilaian/predikat?jenjang=&tahun_ajaran= */
    public function indexPredikat(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);

        $baris = RentangPredikat::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->orderByRaw('offset_bawah IS NULL')->orderByDesc('offset_bawah')
            ->get();

        return response()->json(['baris' => $baris]);
    }

    /** PUT /admin/penilaian/predikat — upsert batch. */
    public function simpanPredikat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'baris' => ['required', 'array'],
            'baris.*.predikat' => ['required', 'string', 'max:2'],
            'baris.*.offset_bawah' => ['nullable', 'numeric'],
            'baris.*.keterangan' => ['nullable', 'string', 'max:100'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        DB::transaction(function () use ($data) {
            foreach ($data['baris'] as $b) {
                RentangPredikat::updateOrCreate(
                    ['jenjang' => $data['jenjang'], 'tahun_ajaran' => $data['tahun_ajaran'], 'predikat' => strtoupper($b['predikat'])],
                    ['offset_bawah' => $b['offset_bawah'] ?? null, 'keterangan' => $b['keterangan'] ?? null],
                );
            }
        });

        return response()->json(['pesan' => 'Predikat disimpan.']);
    }

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

    /** PUT /admin/penilaian/predikat-ekskul — upsert batch (bawaan bila kosong). */
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

    // =========================================================== LEGER

    /**
     * GET /admin/penilaian/leger — crosstab santri × mapel. Kolom = mapel yang
     * punya pengampu dalam lingkup; sel = nilai akhir (+ predikat & sumber).
     */
    public function leger(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);
        $semester = $this->semesterWajib($request);
        $this->authorizeLembaga($request->user(), $jenjang);

        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        $q = trim((string) $request->input('q', ''));

        $santri = $this->santriLeger($jenjang, $ta, $semester, $kelasIds, $tingkat, $q);

        $kolom = $this->kolomLeger($jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester);

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
            'kolom' => $kolom,
            'baris' => $baris,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => $perPage > 0 ? (int) max(1, ceil($total / $perPage)) : 1,
        ]);
    }

    /** GET /admin/penilaian/leger/unduh — Excel leger (lingkup filter). */
    public function unduhLeger(Request $request)
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);
        $semester = $this->semesterWajib($request);
        $this->authorizeLembaga($request->user(), $jenjang);

        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        $santri = $this->santriLeger($jenjang, $ta, $semester, $kelasIds, $tingkat, trim((string) $request->input('q', '')));
        $kolom = $this->kolomLeger($jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester);

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

        return Excel::download(new LegerPenilaianExport($headings, $rows), "leger-{$jenjang}-{$semester}.xlsx");
    }

    // =========================================================== RAPOR

    /** GET /admin/penilaian/rapor?santri_id=&tahun_ajaran=&semester= */
    public function rapor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'santri_id' => ['required', 'integer', 'exists:santri,id'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'semester' => ['required', 'in:1,2'],
            'peringkat' => ['nullable', 'in:3,10,semua'],
        ]);
        $ta = $data['tahun_ajaran'];
        $semester = $data['semester'];
        $batasPeringkat = $data['peringkat'] ?? '10';

        $riwayat = DB::table('riwayat_belajar')
            ->join('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
            ->leftJoin('lembaga_santri', function ($j) {
                $j->on('lembaga_santri.santri_id', '=', 'riwayat_belajar.santri_id')
                    ->on('lembaga_santri.jenjang', '=', 'riwayat_belajar.jenjang');
            })
            ->where('riwayat_belajar.santri_id', $data['santri_id'])
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
            throw ValidationException::withMessages(['santri_id' => 'Santri tidak punya riwayat pada TA/semester itu.']);
        }
        $this->authorizeLembaga($request->user(), $riwayat->jenjang);

        $nilai = NilaiSantri::with(['pengampuMapel.mataPelajaran', 'pengampuMapel.keaktifan.pegawai'])
            ->where('santri_id', $data['santri_id'])
            ->where('tahun_ajaran', $ta)
            ->where('semester', $semester)
            ->get();

        $mapel = $nilai->map(function (NilaiSantri $n) {
            $guru = $this->namaGuru($n->pengampuMapel?->keaktifan?->pegawai);

            return [
                'nama_mapel' => $n->pengampuMapel?->mataPelajaran?->nama_mapel ?? '—',
                'guru' => $guru,
                'nilai_akhir' => $n->nilai_akhir,
                'predikat' => $n->predikat,
                'terbilang' => Terbilang::perDigit($n->nilai_akhir),
                'sumber' => $n->sumber,
            ];
        })->sortBy('nama_mapel')->values();

        $angka = $mapel->pluck('nilai_akhir')->all();
        $rekap = $this->rekapKelas($riwayat->kelas_id, $ta, $semester, (int) $data['santri_id'], $batasPeringkat);

        $catatan = DB::table('rapor_catatan_wali')
            ->where('santri_id', $data['santri_id'])
            ->where('tahun_ajaran', $ta)->where('semester', $semester)
            ->first();

        $ekskul = DB::table('nilai_ekstrakurikuler as ne')
            ->join('ekstrakurikuler as e', 'e.id', '=', 'ne.ekstrakurikuler_id')
            ->leftJoin('predikat_ekskul as pe', function ($j) {
                $j->on('pe.predikat', '=', 'ne.predikat');
            })
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
            ->select('pegawai.nama_lengkap', 'pegawai.gelar_depan', 'pegawai.gelar_belakang')
            ->first();

        return response()->json([
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
                'wali_kelas' => $this->namaGuru((object) [
                    'nama_lengkap' => $walas->nama_lengkap ?? null,
                    'gelar_depan' => $walas->gelar_depan ?? null,
                    'gelar_belakang' => $walas->gelar_belakang ?? null,
                    'jenis_kelamin' => null,
                ]),
                'kepala' => $lembaga->mudir_am ?? null,
            ],
        ]);
    }

    /**
     * GET /admin/penilaian/rapor-kelas?jenjang=&tahun_ajaran=&semester=&kelas_id=
     * Daftar santri satu kelas + status kelengkapan (cek sebelum cetak).
     */
    public function raporKelas(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangWajib($request);
        $ta = $this->taWajib($request);
        $semester = $this->semesterWajib($request);
        $this->authorizeLembaga($request->user(), $jenjang);
        $kelasIds = $this->kelasFilter($request, $jenjang, $ta);
        if (count($kelasIds) !== 1) {
            throw ValidationException::withMessages(['kelas_id' => 'Pilih satu kelas.']);
        }

        $santri = $this->santriLeger($jenjang, $ta, $semester, $kelasIds, [], '');
        $kolom = $this->kolomLeger($jenjang, $kelasIds);
        $peta = $this->petaNilai($santri->pluck('santri_id')->all(), $kolom, $ta, $semester);
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

    // =========================================================== IMPOR

    /** GET /admin/penilaian/import-template?tipe=&jenjang=&tahun_ajaran=&kelas_id= */
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

        $layanan = new PenilaianImporService(
            $data['tipe'],
            $data['tahun_ajaran'],
            (string) $data['semester'],
            array_values(array_map('strval', $jenjang)),
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

    // =========================================================== BANTUAN

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
     * Baris santri leger: riwayat pada (jenjang, TA, semester) + keanggotaan.
     *
     * @param  list<int>  $kelasIds
     * @param  list<string>  $tingkat
     */
    private function santriLeger(string $jenjang, string $ta, string $semester, array $kelasIds, array $tingkat, string $q)
    {
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
     * @return array<int, array<string, array{nilai: float|null, predikat: ?string, sumber: ?string, guru: ?string}>>
     */
    private function petaNilai(array $santriIds, array $kolom, string $ta, string $semester): array
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
    private function rekapKelas(?int $kelasId, string $ta, string $semester, int $santriId, string $batas): array
    {
        if ($kelasId === null) {
            return ['peringkat' => null, 'total' => 0];
        }
        $rows = DB::table('nilai_santri as ns')
            ->join('riwayat_belajar as rb', 'rb.santri_id', '=', 'ns.santri_id')
            ->where('rb.tahun_ajaran', $ta)->where('rb.semester', $semester)
            ->where('rb.kelas_id', $kelasId)
            ->where('ns.tahun_ajaran', $ta)->where('ns.semester', $semester)
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
