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
use App\Models\MataPelajaran;
use App\Models\NilaiKomponen;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Services\MapelImporService;
use App\Services\PengampuImporService;
use App\Services\RefService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Modul Kurikulum & Mapel (BLOK 5) — master mapel (lengkap dengan KKM &
 * urutan tampil rapor) serta pengampu mapel per kelas (kelas × mapel → guru).
 *
 *  Daftar mapel sebuah kelas YAITUH baris `pengampu_mapel` itu sendiri: begitu
 *  guru ditugaskan, mapel masuk ke kelas; begitu baris dihapus, mapel keluar
 *  dari kelas. Modul kurikulum (per jenjang) + komposisi + cakupan tingkat
 *  sudah dihapus, jadi tidak ada lagi "peta mapel" terpisah per jenjang.
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
                ->orWhere('kode_mapel', 'like', "%{$cari}%")
                ->orWhere('singkatan', 'like', "%{$cari}%"));
        }

        return response()->json($q->orderBy('nama_mapel')->get());
    }

    /** POST /admin/kurikulum/mapel */
    public function storeMapel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'nama_mapel' => [
                'required', 'string', 'max:100',
                function (string $attr, mixed $nilai, Closure $gagal) use ($request) {
                    // Unik (jenjang, nama) case-insensitive eksplisit agar
                    // seragam di MySQL (collation ci) dan SQLite (ujian).
                    $ada = MataPelajaran::where('jenjang', $request->input('jenjang'))
                        ->whereRaw('LOWER(nama_mapel) = ?', [mb_strtolower(trim((string) $nilai))])
                        ->exists();
                    if ($ada) {
                        $gagal('Nama mapel sudah dipakai di lembaga ini.');
                    }
                },
            ],
            'kelompok' => ['required', 'in:formal,pesantren'],
            'kode_mapel' => ['nullable', 'string', 'max:20'],
            // Singkatan tampilan (mis. 'Mat.'); opsional.
            'singkatan' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
            // KKM & urutan tampil rapor milik mapel (satu tempat per jenjang,
            // bukan per kelas). KKM kosong = predikat manual (modul 202).
            'kkm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'urutan' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        // `fresh()` agar respons membawa nilai bawaan DB (mis. urutan 0), bukan
        // atribut yang belum di-refresh setelah create.
        return response()->json(MataPelajaran::create($data)->fresh(), 201);
    }

    /** PUT /admin/kurikulum/mapel/{mapel} */
    public function updateMapel(Request $request, MataPelajaran $mapel): JsonResponse
    {
        $data = $request->validate([
            'nama_mapel' => [
                'sometimes', 'string', 'max:100',
                function (string $attr, mixed $nilai, Closure $gagal) use ($mapel) {
                    $ada = MataPelajaran::where('jenjang', $mapel->jenjang)
                        ->where('id', '!=', $mapel->id)
                        ->whereRaw('LOWER(nama_mapel) = ?', [mb_strtolower(trim((string) $nilai))])
                        ->exists();
                    if ($ada) {
                        $gagal('Nama mapel sudah dipakai di lembaga ini.');
                    }
                },
            ],
            'kelompok' => ['sometimes', 'in:formal,pesantren'],
            'kode_mapel' => ['nullable', 'string', 'max:20'],
            'singkatan' => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'kkm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'urutan' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
        $this->authorizeLembaga($request->user(), $mapel->jenjang);
        $mapel->update($data);

        return response()->json($mapel->fresh());
    }

    /** DELETE /admin/kurikulum/mapel/{mapel} */
    public function destroyMapel(Request $request, MataPelajaran $mapel): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $mapel->jenjang);
        $dipakai = PengampuMapel::where('mata_pelajaran_id', $mapel->id)->exists();
        if ($dipakai) {
            abort(422, 'Mapel sudah dipakai di pengampu kelas. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }
        $mapel->delete();

        return response()->json(['pesan' => 'Mapel dihapus.']);
    }

    /**
     * POST /admin/kurikulum/mapel/terapkan-kamus
     *
     * Isi `kode_mapel` & `singkatan` mapel jenjang ini dari kamus `ref_mapel`
     * berdasarkan NAMA yang sama (dibandingkan tanpa spasi tepi dan tanpa beda
     * huruf besar/kecil). Bawaan hanya mengisi kolom yang MASIH KOSONG — nilai
     * yang sudah diisi manual/impor tidak ditimpa; `timpa: true` membuat kamus
     * menang.
     *
     * `mode: periksa` hanya menghitung + mengambil contoh perubahan (tanpa
     * menulis apa pun) supaya dialog bisa menampilkan pratinjau lebih dulu;
     * `mode: eksekusi` (bawaan) yang menyimpan.
     */
    public function terapkanKamusMapel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'timpa' => ['nullable', 'boolean'],
            'mode' => ['nullable', 'in:periksa,eksekusi'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $jenjang = $data['jenjang'];
        $timpa = (bool) ($data['timpa'] ?? false);
        $periksa = ($data['mode'] ?? 'eksekusi') === 'periksa';

        // Kamus jenjang ini: nama ternormalisasi → kode/singkatan yang terisi.
        // Baris kamus tanpa kode & tanpa singkatan tak bisa menyumbang apa pun,
        // jadi diperlakukan sama seperti nama yang tak ada di kamus.
        $kamus = [];
        foreach (RefService::effective('mapel', $jenjang) as $entri) {
            $nama = $this->kunciNamaMapel((string) ($entri->nama ?? ''));
            $kode = trim((string) ($entri->kode ?? ''));
            $singkatan = trim((string) ($entri->singkatan ?? ''));
            if ($nama === '' || ($kode === '' && $singkatan === '')) {
                continue;
            }
            $kamus[$nama] = [
                'kode_mapel' => $kode === '' ? null : $kode,
                'singkatan' => $singkatan === '' ? null : $singkatan,
            ];
        }

        $diubah = 0;
        $sudahLengkap = 0;
        $tanpaKamus = 0;
        $contoh = [];

        foreach (MataPelajaran::where('jenjang', $jenjang)->orderBy('nama_mapel')->get() as $mapel) {
            $sumber = $kamus[$this->kunciNamaMapel($mapel->nama_mapel)] ?? null;
            if ($sumber === null) {
                $tanpaKamus++;

                continue;
            }

            // Nilai yang SUDAH SAMA tidak dihitung sebagai perubahan: tanpa ini
            // `timpa` akan melaporkan baris yang sebenarnya tak berubah, dan
            // pemanggilan kedua tak lagi idempoten (diubah harus 0).
            $ubah = [];
            foreach (['kode_mapel', 'singkatan'] as $kolom) {
                $baru = $sumber[$kolom];
                $lama = $mapel->{$kolom};
                if ($baru === null || $baru === $lama || (! $timpa && filled($lama))) {
                    continue;
                }
                $ubah[$kolom] = $baru;
            }
            if ($ubah === []) {
                $sudahLengkap++;

                continue;
            }

            $diubah++;
            if (count($contoh) < 5) {
                $contoh[] = [
                    'nama_mapel' => $mapel->nama_mapel,
                    'kode_mapel' => $ubah['kode_mapel'] ?? $mapel->kode_mapel,
                    'singkatan' => $ubah['singkatan'] ?? $mapel->singkatan,
                ];
            }
            if (! $periksa) {
                $mapel->update($ubah);
            }
        }

        $pesan = $diubah === 0
            ? 'Tidak ada mapel yang perlu diisi dari kamus.'
            : $diubah.' mapel '.($periksa ? 'akan diisi' : 'diisi').' dari kamus.';

        return response()->json([
            'pesan' => $pesan,
            'jenjang' => $jenjang,
            'diubah' => $diubah,
            'sudah_lengkap' => $sudahLengkap,
            'tanpa_kamus' => $tanpaKamus,
            'contoh' => $contoh,
        ]);
    }

    /**
     * Kunci pembanding nama mapel ↔ kamus: spasi tepi dibuang dan huruf
     * diseragamkan ke kecil. Spasi di TENGAH sengaja tidak dirapatkan supaya
     * dua nama berbeda tidak dianggap sama.
     */
    private function kunciNamaMapel(string $nama): string
    {
        return mb_strtolower(trim($nama));
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
     * Satu baris per mapel kelas: setiap mapel yang sudah punya baris pengampu di
     * kelas itu, lengkap dengan guru terpasang (boleh kosong).
     */
    public function indexPengampu(Request $request): JsonResponse
    {
        $data = $request->validate(['kelas_id' => ['required', 'integer', 'exists:kelas,id']]);
        $kelas = Kelas::findOrFail($data['kelas_id']);
        $this->authorizeLembaga($request->user(), $kelas->jenjang);

        return response()->json($this->dataPengampuKelas($kelas));
    }

    /**
     * GET /admin/kurikulum/pengampus?kelas_ids[]=1&kelas_ids[]=2
     * Pengampu BANYAK kelas dalam satu request (daftar mapel tiap kelas = baris
     * pengampu kelas itu sendiri). Tabel pengampu bisa menampilkan
     * beberapa kelas sekaligus (rel Kelas di kiri tabel), dan memanggil endpoint
     * per-kelas berarti N request yang saling antre, sehingga tabel tampil jauh
     * lebih lambat. Setiap baris dilabeli `kelas_id` + `nama_kelas` asalnya.
     *
     * Wewenang TETAP per kelas: satu saja di luar wewenang pengguna → 403.
     */
    public function indexPengampus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas_ids' => ['required', 'array', 'min:1', 'max:100'],
            'kelas_ids.*' => ['integer', 'exists:kelas,id'],
        ]);

        // Urutan kelas mengikuti urutan permintaan (pilihan pengguna di rel).
        $urutan = [];
        foreach ($data['kelas_ids'] as $pos => $id) {
            $urutan[(int) $id] = $pos;
        }
        $kelasList = Kelas::whereIn('id', array_keys($urutan))
            ->get()
            ->sortBy(fn (Kelas $k) => $urutan[$k->id])
            ->values();

        $respKelas = [];
        $respBaris = [];
        foreach ($kelasList as $kelas) {
            $this->authorizeLembaga($request->user(), $kelas->jenjang);
            $satu = $this->dataPengampuKelas($kelas);
            $respKelas[] = $satu['kelas'];
            foreach ($satu['baris'] as $baris) {
                $respBaris[] = $baris + ['kelas_id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas];
            }
        }

        return response()->json(['kelas' => $respKelas, 'baris' => $respBaris]);
    }

    /**
     * Isi tabel pengampu satu kelas: seluruh baris pengampu kelas itu, lengkap
     * dengan guru terpasang (boleh kosong). Daftar mapel sebuah kelas YAITUH baris
     * `pengampu_mapel` itu sendiri, jadi urutannya mengikuti `urutan` mapel
     * (urutan tampil rapor/leger) lalu nama mapel.
     *
     * @return array{kelas: array, baris: Collection}
     */
    private function dataPengampuKelas(Kelas $kelas): array
    {
        $terpasang = PengampuMapel::with('keaktifan.pegawai:id,nama_lengkap,nip,gelar_depan,gelar_belakang,jenis_kelamin')
            ->where('kelas_id', $kelas->id)
            ->get()
            ->keyBy('mata_pelajaran_id');

        $mapel = MataPelajaran::whereIn('id', $terpasang->keys()->all())
            ->orderBy('urutan')
            ->orderBy('nama_mapel')
            ->get(['id', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active', 'kkm', 'urutan']);

        return [
            'kelas' => ['id' => $kelas->id, 'nama_kelas' => $kelas->nama_kelas, 'tingkat' => $kelas->tingkat, 'jenjang' => $kelas->jenjang],
            'baris' => $mapel->map(function (MataPelajaran $m) use ($terpasang) {
                $p = $terpasang[$m->id] ?? null;

                return [
                    'mata_pelajaran_id' => $m->id,
                    'nama_mapel' => $m->nama_mapel,
                    'kelompok' => $m->kelompok,
                    'is_active' => $m->is_active,
                    'kkm' => $m->kkm,
                    'pengampu_id' => $p?->id,
                    'keaktifan_pegawai_id' => $p?->keaktifan_pegawai_id,
                    'guru' => $p?->keaktifan?->pegawai?->nama_lengkap,
                ];
            }),
        ];
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

        // Mapel wajib sejenjang dengan kelas (dulu dijamin lewat kurikulum
        // kelas; sekarang pengampu berdiri sendiri jadi diperiksa di sini).
        foreach ($data['baris'] as $b) {
            $this->pastikanMapelSeJenjang((int) $b['mata_pelajaran_id'], $kelas->jenjang);
        }

        $diinginkan = collect($data['baris'])->keyBy('mata_pelajaran_id');
        $ada = PengampuMapel::where('kelas_id', $kelas->id)->get();

        $akanDihapus = $ada->reject(fn (PengampuMapel $p) => $diinginkan->has($p->mata_pelajaran_id));
        foreach ($akanDihapus as $p) {
            $punyaNilai = NilaiSantri::where('pengampu_mapel_id', $p->id)->exists()
                || NilaiKomponen::where('pengampu_mapel_id', $p->id)->exists()
                || JadwalPelajaran::where('pengampu_mapel_id', $p->id)->exists();
            if ($punyaNilai) {
                throw ValidationException::withMessages([
                    'baris' => sprintf(
                        'Mapel "%s" sudah punya nilai/jadwal — tidak bisa dikeluarkan dari pengampu kelas.',
                        $p->mataPelajaran?->nama_mapel ?? "#{$p->mata_pelajaran_id}",
                    ),
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
     * POST /admin/kurikulum/pengampu/salin — salin daftar mapel dari kelas lain
     * ke kelas tujuan. Guru TIDAK ikut (baris baru selalu kosong), dan mapel yang
     * sudah ada di kelas tujuan dibiarkan apa adanya.
     */
    public function salinPengampus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas_id' => ['required', 'integer', 'exists:kelas,id'],
            'dari_kelas_id' => ['required', 'integer', 'exists:kelas,id', 'different:kelas_id'],
        ]);
        $tujuan = Kelas::findOrFail($data['kelas_id']);
        $sumber = Kelas::findOrFail($data['dari_kelas_id']);
        $this->authorizeLembaga($request->user(), $tujuan->jenjang);
        $this->authorizeLembaga($request->user(), $sumber->jenjang);

        if ($sumber->jenjang !== $tujuan->jenjang) {
            throw ValidationException::withMessages([
                'dari_kelas_id' => 'Kelas sumber harus sejenjang dengan kelas tujuan.',
            ]);
        }

        $sudah = PengampuMapel::where('kelas_id', $tujuan->id)->pluck('mata_pelajaran_id')->all();
        $mapelIds = PengampuMapel::where('kelas_id', $sumber->id)
            ->whereNotIn('mata_pelajaran_id', $sudah)
            ->pluck('mata_pelajaran_id')
            ->all();

        DB::transaction(function () use ($tujuan, $mapelIds) {
            foreach ($mapelIds as $mapelId) {
                PengampuMapel::create([
                    'kelas_id' => $tujuan->id,
                    'mata_pelajaran_id' => $mapelId,
                    'keaktifan_pegawai_id' => null,
                ]);
            }
        });

        return response()->json([
            'pesan' => count($mapelIds) > 0
                ? sprintf('Daftar mapel disalin: %d mapel ditambahkan (guru belum diisi).', count($mapelIds))
                : 'Semua mapel kelas sumber sudah ada di kelas tujuan — tidak ada yang ditambahkan.',
            'ditambah' => count($mapelIds),
        ]);
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

    private function pastikanMapelSeJenjang(int $mapelId, string $jenjang): void
    {
        $mapel = MataPelajaran::find($mapelId);
        if ($mapel === null || $mapel->jenjang !== $jenjang) {
            throw ValidationException::withMessages([
                'mata_pelajaran_id' => 'Mapel harus sejenjang dengan kelas.',
            ]);
        }
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
