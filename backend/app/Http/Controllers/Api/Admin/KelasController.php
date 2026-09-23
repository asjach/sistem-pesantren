<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\KelasNamaExport;
use App\Exports\KelasTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\KelasExportNamaRequest;
use App\Http\Requests\Admin\KelasImportNamaRequest;
use App\Http\Requests\Admin\KelasImportRequest;
use App\Http\Requests\Admin\KelasStoreRequest;
use App\Http\Requests\Admin\KelasUpdateRequest;
use App\Http\Requests\Admin\KelasWalasRequest;
use App\Imports\KelasImport;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Services\KelasService;
use App\Services\RefService;
use App\Services\UrutKatalog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException;

/**
 * FB-004-01: CRUD kelas. tahun_ajaran wajib berlaku untuk lembaga kelas (TA global).
 */
class KelasController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['kelas.tingkat', 'kelas.kapasitas'];

    public function index(Request $request)
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('kelas'));

        // JANGAN eager-load `tahunAjaran`: Laravel meng-snake-case kunci relasi
        // saat serialisasi sehingga menimpa atribut string `tahun_ajaran`
        // (frontend menerima objek → tampil "[object Object]"). Nilai FK-nya
        // sendiri sudah berupa nama TA yang siap tampil.
        $query = $this->scopeLembaga(
            Kelas::with(['lembaga:jenjang,nama', 'walas:id,nama_lengkap']),
            auth()->user(),
            $request,
            'kelas.jenjang'
        );

        if ($request->filled('tahun_ajaran')) {
            $query->where('kelas.tahun_ajaran', $request->input('tahun_ajaran'));
        }
        if ($request->filled('tingkat')) {
            $query->where('kelas.tingkat', $request->input('tingkat'));
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where('kelas.nama_kelas', 'like', "%{$s}%");
        }

        // Urut default: `urutan` (diatur admin) lalu nama kelas.
        if ($urut !== null) {
            $query->select('kelas.*')
                ->leftJoin('lembaga', 'lembaga.jenjang', '=', 'kelas.jenjang')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.nama', '=', 'kelas.tahun_ajaran');
        }
        $this->terapkanUrut($query, $urut, [
            ['kelas.urutan', 'naik'], ['kelas.nama_kelas', 'naik'], ['kelas.id', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(KelasStoreRequest $request)
    {
        $data = $request->validated();

        $auth = auth()->user();
        $this->authorizeLembaga($auth, $data['jenjang']);

        $this->cekTaEfektif($data['jenjang'], (string) $data['tahun_ajaran']);

        $items = isset($data['items'])
            ? array_values($data['items'])
            : [[
                'nama_kelas' => $data['nama_kelas'],
                'nama_alias' => $data['nama_alias'] ?? null,
                'tingkat' => $data['tingkat'] ?? null,
                'kapasitas' => $data['kapasitas'] ?? null,
                'urutan' => $data['urutan'] ?? 0,
            ]];

        try {
            $dibuat = DB::transaction(function () use ($data, $items) {
                $rows = [];
                $namaPayload = [];
                foreach ($items as $item) {
                    $nama = Kelas::normalisasiNama($item['nama_kelas']);
                    $kunci = mb_strtolower($nama);

                    if (isset($namaPayload[$kunci])) {
                        abort(response()->json(['message' => "Nama kelas \"{$nama}\" duplikat di daftar yang dikirim."], 422));
                    }
                    $namaPayload[$kunci] = true;

                    $this->cekTingkat($data['jenjang'], $item['tingkat'] ?? null);
                    $this->pastikanNamaUnik($data['jenjang'], (string) $data['tahun_ajaran'], $nama);

                    $rows[] = Kelas::create([
                        'jenjang' => $data['jenjang'],
                        'tahun_ajaran' => $data['tahun_ajaran'],
                        'nama_kelas' => $nama,
                        'nama_alias' => isset($item['nama_alias']) && trim((string) $item['nama_alias']) !== ''
                            ? trim((string) $item['nama_alias'])
                            : null,
                        'tingkat' => $item['tingkat'] ?? null,
                        'kapasitas' => $item['kapasitas'] ?? null,
                        'urutan' => (int) ($item['urutan'] ?? 0),
                    ]);
                }

                return $rows;
            });
        } catch (QueryException $e) {
            if (! $this->pelanggaranUnik($e)) {
                throw $e;
            }

            return response()->json(['message' => 'Nama kelas sudah dipakai di lembaga + tahun ajaran ini.'], 422);
        }

        if (! isset($data['items'])) {
            return response()->json($dibuat[0], 201);
        }

        return response()->json(['pesan' => count($dibuat).' kelas dibuat.', 'data' => $dibuat], 201);
    }

    /** Validasi kamus no.50: tingkat via RefService efektif milik lembaga. */
    protected function cekTingkat(string $jenjang, ?string $tingkat): void
    {
        if (! empty($tingkat)
            && ! in_array($tingkat, RefService::kodeAktif('tingkat', $jenjang), true)) {
            abort(response()->json(['message' => 'Tingkat tidak dikenal.'], 422));
        }
    }

    /**
     * Nama kelas wajib unik per lembaga + tahun ajaran (mengikuti kolasi kolom
     * yang case-insensitive). Dipanggil sebelum tulis untuk pesan yang jelas.
     */
    protected function pastikanNamaUnik(string $jenjang, string $tahunAjaran, string $nama, ?int $kecualikanId = null): void
    {
        $query = Kelas::where('jenjang', $jenjang)
            ->where('tahun_ajaran', $tahunAjaran)
            // LOWER() agar perbandingan case-insensitive di semua driver (DB uji SQLite).
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower($nama)]);

        if ($kecualikanId !== null) {
            $query->whereKeyNot($kecualikanId);
        }

        if ($query->exists()) {
            abort(response()->json(['message' => "Kelas \"{$nama}\" sudah ada di lembaga + tahun ajaran ini."], 422));
        }
    }

    /** Deteksi pelanggaran unique MySQL (race dua penulis nama yang sama). */
    protected function pelanggaranUnik(QueryException $e): bool
    {
        return (int) ($e->errorInfo[1] ?? 0) === 1062;
    }

    /** GET /api/admin/kelas/export-nama — unduh daftar nama kelas (pasangan import-nama). */
    public function exportNama(KelasExportNamaRequest $request)
    {
        $data = $request->validated();

        $lembagaId = $data['jenjang'];
        $ta = (string) $data['tahun_ajaran'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->cekTaEfektif($lembagaId, $ta);

        $kode = Lembaga::whereKey($lembagaId)->value('jenjang');

        return Excel::download(
            new KelasNamaExport($lembagaId, $ta),
            "daftar-kelas-{$kode}-".preg_replace('/[^0-9]/', '', $ta).'.xlsx',
        );
    }

    /** POST /api/admin/kelas/import-nama — salin nama+tingkat kelas pasangan MI↔MD.
     *  Dua mode: ambil (`jenjang` + `tahun_ajaran` target, `dari_kode` sumber)
     *  atau copy (`dari_jenjang` + `dari_tahun_ajaran` sumber, `ke_kode` target
     *  + TA target = nama sama, fallback aktif). */
    public function importNama(KelasImportNamaRequest $request): JsonResponse
    {
        $data = $request->validated();

        $periksa = (bool) ($data['periksa'] ?? true);

        if (! empty($data['ke_kode'])) {
            // Mode copy: sumber eksplisit, target via kode + TA otomatis.
            if (empty($data['dari_jenjang']) || empty($data['dari_tahun_ajaran'])) {
                return response()->json(['pesan' => 'Mode copy butuh dari_jenjang + dari_tahun_ajaran.'], 422);
            }
            $sumberJenjang = (string) $data['dari_jenjang'];
            $taSumber = TahunAjaran::find((string) $data['dari_tahun_ajaran']);
            if (! $taSumber) {
                return response()->json(['pesan' => 'Tahun ajaran sumber tidak ditemukan.'], 422);
            }
            $this->cekTaEfektif($sumberJenjang, $taSumber->nama);
            $sumberKode = $sumberJenjang;
            $targetKode = $data['ke_kode'];
            if (! in_array($sumberKode, ['MI', 'MD'], true) || $sumberKode === $targetKode) {
                return response()->json(['pesan' => 'Copy nama hanya untuk pasangan MI↔MD.'], 422);
            }
            $target = Lembaga::whereKey($targetKode)->first();
            if (! $target) {
                return response()->json(['pesan' => "Lembaga tujuan {$targetKode} tidak ditemukan."], 422);
            }
            $targetId = $target->jenjang;
            $this->authorizeLembaga($request->user(), $targetId);
            $taId = TahunAjaran::efektif($targetId)->firstWhere('nama', $taSumber->nama)?->nama
                ?? TahunAjaran::aktif($targetId)?->nama;
            if (! $taId) {
                return response()->json(['pesan' => "Tidak ada tahun ajaran acuan di {$targetKode}."], 422);
            }
            $sumber = Lembaga::whereKey($sumberJenjang)->first();
        } else {
            // Mode ambil: target eksplisit, sumber via kode.
            if (empty($data['jenjang']) || empty($data['tahun_ajaran']) || empty($data['dari_kode'])) {
                return response()->json(['pesan' => 'Pilih mode ambil atau copy.'], 422);
            }
            $targetId = $data['jenjang'];
            $taId = (string) $data['tahun_ajaran'];
            $this->authorizeLembaga($request->user(), $targetId);
            $this->cekTaEfektif($targetId, $taId);

            $targetKode = $targetId;
            $sumberKode = $data['dari_kode'];
            // Pasangan MI↔MD dua arah: target salah satu, sumber yang lain.
            if (! in_array($targetKode, ['MI', 'MD'], true) || $targetKode === $sumberKode) {
                return response()->json(['pesan' => 'Import nama hanya untuk pasangan MI↔MD.'], 422);
            }
            $sumber = Lembaga::whereKey($sumberKode)->first();
            if (! $sumber) {
                return response()->json(['pesan' => "Lembaga sumber {$sumberKode} tidak ditemukan."], 422);
            }
            // TA sumber: nama sama → fallback TA aktif sumber.
            $taTarget = TahunAjaran::find($taId);
            $taSumber = TahunAjaran::efektif($sumber->jenjang)->firstWhere('nama', $taTarget?->nama)
                ?? TahunAjaran::aktif($sumber->jenjang);
            if (! $taSumber) {
                return response()->json(['pesan' => "Tidak ada tahun ajaran acuan di {$sumberKode}."], 422);
            }
        }

        // Pengecualian pasangan MI↔MD: sumber boleh dibaca bila pemanggil boleh
        // akses target (sudah diauthorize di atas); tulis tetap target saja.
        // Tanpa ini admin satu lembaga selalu 403 saat import dari pasangannya.
        if (! $request->user()->canAccessLembaga($sumber->jenjang)
            && ! $request->user()->canAccessLembaga($targetId)) {
            return response()->json(['pesan' => 'Akses ditolak.'], 403);
        }

        $sudahAda = Kelas::where('jenjang', $targetId)
            ->where('tahun_ajaran', $taId)
            ->pluck('nama_kelas')
            ->map(fn ($n) => mb_strtolower(Kelas::normalisasiNama((string) $n)))
            ->all();

        $sumberKelas = Kelas::where('jenjang', $sumber->jenjang)
            ->where('tahun_ajaran', $taSumber->nama)
            ->orderBy('urutan')->orderBy('nama_kelas')
            ->get(['id', 'nama_kelas', 'tingkat', 'urutan']);

        $rincian = [];
        foreach ($sumberKelas as $k) {
            $nama = Kelas::normalisasiNama($k->nama_kelas);
            if (in_array(mb_strtolower($nama), $sudahAda, true)) {
                $rincian[] = ['nama' => $nama, 'tingkat' => $k->tingkat, 'status' => 'dilewati'];

                continue;
            }
            $sudahAda[] = mb_strtolower($nama);
            if (! $periksa) {
                $this->cekTingkat($targetId, $k->tingkat);
                Kelas::create([
                    'jenjang' => $targetId,
                    'tahun_ajaran' => $taId,
                    'nama_kelas' => $nama,
                    'tingkat' => $k->tingkat,
                    'urutan' => (int) $k->urutan,
                ]);
            }
            $rincian[] = ['nama' => $nama, 'tingkat' => $k->tingkat, 'status' => 'dibuat'];
        }

        $hitung = fn (string $s) => count(array_filter($rincian, fn ($r) => $r['status'] === $s));

        return response()->json([
            'pesan' => $periksa
                ? 'Pratinjau selesai: eksekusi untuk menyalin.'
                : 'Import nama kelas selesai.',
            'periksa' => $periksa,
            'sumber' => ['kode' => $sumberKode, 'tahun_ajaran' => $taSumber->nama],
            'tujuan' => ['kode' => $targetKode, 'tahun_ajaran' => TahunAjaran::find($taId)?->nama],
            'ringkasan' => [
                'sumber' => count($sumberKelas),
                'dibuat' => $hitung('dibuat'),
                'dilewati' => $hitung('dilewati'),
            ],
            'rincian' => array_slice($rincian, 0, 200),
        ]);
    }

    /** GET /api/admin/kelas/import-template — template Excel import file kelas (multi-lembaga/TA). */
    public function templateImport()
    {
        return Excel::download(new KelasTemplateExport, 'template-import-kelas.xlsx');
    }

    /** POST /api/admin/kelas/import-periksa — validasi file TANPA menulis (dry-run). */
    public function periksaImport(KelasImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: true);
    }

    /** POST /api/admin/kelas/import — import file kelas massal satu lingkup. */
    public function importLengkap(KelasImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: false);
    }

    /** Alur bersama import file kelas multi-lembaga/TA. Mode periksa:
     *  transaksi selalu di-rollback. Izin dicek per baris di import
     *  (mengikuti akun), bukan 403 di depan. */
    private function prosesImport(KelasImportRequest $request, bool $periksa): JsonResponse
    {
        $request->validated();

        $import = new KelasImport;
        $errors = [];

        if ($periksa) {
            DB::beginTransaction();
        }

        try {
            Excel::import($import, $request->file('file'));
        } catch (ValidationException $e) {
            $errors = $this->formatFailures($e->failures());
        } finally {
            if ($periksa) {
                DB::rollBack();
            }
        }

        if ($errors === []) {
            $errors = $this->formatFailures($import->failures());
        }

        if ($periksa) {
            return response()->json([
                'pesan' => $errors === [] ? 'Pengecekan selesai: file siap diimport.' : 'Pengecekan menemukan masalah.',
                'siap_import' => $errors === [],
                'ringkasan' => $import->ringkasan(),
                'errors' => $errors,
            ]);
        }

        if ($errors !== []) {
            return response()->json([
                'pesan' => 'Gagal mengimport beberapa data.',
                'errors' => $errors,
            ], 422);
        }

        $ringkasan = $import->ringkasan();

        return response()->json([
            'pesan' => "{$ringkasan['dibuat']} kelas dibuat, {$ringkasan['diperbarui']} diperbarui, {$ringkasan['dilewati']} dilewati.",
            'ringkasan' => $ringkasan,
        ]);
    }

    private function formatFailures(iterable $failures): array
    {
        $errors = [];
        foreach ($failures as $failure) {
            $errors[] = [
                'row' => $failure->row(),
                'attribute' => $failure->attribute(),
                'errors' => $failure->errors(),
            ];
        }

        return $errors;
    }

    public function update(KelasUpdateRequest $request, Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->jenjang);

        $data = $request->validated();

        // Wali lewat pintu 3 lapis (boleh null = lepas).
        $adaWalas = array_key_exists('walas_id', $data);
        $walasId = $adaWalas && $data['walas_id'] !== null ? (int) $data['walas_id'] : null;
        unset($data['walas_id']);

        if (array_key_exists('urutan', $data) && $data['urutan'] === null) {
            // Kolom NOT NULL default 0: null dari form dianggap 0.
            $data['urutan'] = 0;
        }

        if (array_key_exists('nama_alias', $data) && trim((string) $data['nama_alias']) === '') {
            // Alias kosong = tanpa alias (bukan string kosong).
            $data['nama_alias'] = null;
        }

        if (array_key_exists('nama_kelas', $data)) {
            $data['nama_kelas'] = Kelas::normalisasiNama($data['nama_kelas']);
            $this->pastikanNamaUnik(
                $kela->jenjang,
                (string) $kela->tahun_ajaran,
                $data['nama_kelas'],
                (int) $kela->id
            );
        }

        try {
            $kela->update($data);
        } catch (QueryException $e) {
            if (! $this->pelanggaranUnik($e)) {
                throw $e;
            }

            return response()->json(['message' => 'Nama kelas sudah dipakai di lembaga + tahun ajaran ini.'], 422);
        }

        if ($adaWalas) {
            $kela = app(KelasService::class)->tetapkanWalas($kela->fresh(), $walasId);
        }

        return response()->json($kela->fresh());
    }

    /** POST /api/admin/kelas/{kela}/set-walas — tetapkan/lepas wali (3 lapis). */
    public function setWalas(KelasWalasRequest $request, Kelas $kela, KelasService $layanan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $kela->jenjang);

        $data = $request->validated();
        $kela = $layanan->tetapkanWalas(
            $kela,
            isset($data['pegawai_id']) && $data['pegawai_id'] !== null ? (int) $data['pegawai_id'] : null
        );

        return response()->json([
            'pesan' => $kela->walas_id ? 'Wali kelas ditetapkan.' : 'Wali kelas dilepas.',
            'data' => $kela,
        ]);
    }

    public function destroy(Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->jenjang);
        $kela->delete();

        return response()->json(['message' => 'Kelas dihapus.']);
    }
}
