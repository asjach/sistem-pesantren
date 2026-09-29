<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\SantriLembagaTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SantriDokumenRequest;
use App\Http\Requests\Admin\SantriFotoRequest;
use App\Http\Requests\Admin\SantriPotongRequest;
use App\Http\Requests\Admin\SantriStoreRequest;
use App\Http\Requests\Admin\SantriTidakMemilikiRequest;
use App\Http\Requests\Admin\SantriUpdateRequest;
use App\Models\DokumenSantri;
use App\Models\ImportSesi;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\User;
use App\Services\Impor\DataSantri;
use App\Services\PenerimaanService;
use App\Services\RefService;
use App\Services\SantriImporService;
use App\Services\UrutKatalog;
use App\Support\NamaBerkasDokumen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Buku Induk santri — identitas murni (`santri`).
 * Keanggotaan per lembaga (`lembaga_santri`): dikelola endpoint khusus +
 * import gabungan siswa; riwayat akademik (`riwayat_belajar`) controller terpisah.
 */
class SantriController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['santri.nik', 'santri.nisn'];

    /** GET /api/admin/santri — daftar buku induk (identitas + keanggotaan aktif). */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $urut = $this->parseUrut($request, UrutKatalog::peta('santri'));

        $query = Santri::tenantScope()
            ->with(['lembagaAktif:id,santri_id,jenjang,nis_lokal,nis_kemenag', 'lembagaAktif.lembaga:jenjang,nama']);

        if ($request->filled('is_active_pst')) {
            $query->where('is_active_pst', $request->boolean('is_active_pst') ? Santri::YA : Santri::TIDAK);
        }
        $lembaga = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($request->user(), $lembaga);
        if ($lembaga !== []) {
            $query->whereHas('lembagaSantri', fn ($ls) => $ls->whereIn('jenjang', $lembaga));
        }
        if ($this->hasAcademicFilter($request)) {
            $query->whereHas('riwayatBelajar', function ($riwayat) use ($lembaga, $request) {
                if ($lembaga !== []) {
                    $riwayat->whereIn('jenjang', $lembaga);
                }
                $this->applyAcademicFilters($riwayat, $request);
            });
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            // LIKE substring untuk semua driver: index FULLTEXT ngram di DB
            // ini terbukti tak mengembalikan baris apa pun (dicek langsung
            // via MATCH — kosong untuk semua istilah, LIKE menemukan data),
            // sementara LIKE benar dan cukup cepat untuk skala ini.
            $query->where(fn ($sub) => $sub
                ->where('nisn', 'like', "%{$q}%")
                ->orWhere('ayah_nama', 'like', "%{$q}%")
                ->orWhere('ibu_nama', 'like', "%{$q}%")
                ->orWhere('nama_lengkap', 'like', "%{$q}%"));
        }

        $this->terapkanUrut($query, $urut, [
            ['santri.jk', 'naik'], ['santri.nama_lengkap', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    /** POST /api/admin/santri — input manual identitas + keanggotaan (wajib 1 jenjang). */
    public function store(SantriStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $jenjang = (string) $data['jenjang'];
        $nisLokal = $data['nis_lokal'] ?? null;
        $this->authorizeLembaga($request->user(), $jenjang);
        unset($data['jenjang'], $data['nis_lokal']);

        $santri = DB::transaction(function () use ($data, $jenjang, $nisLokal) {
            $santri = Santri::create($data);
            app(PenerimaanService::class)->pastikanKeanggotaan($santri, $jenjang, [
                'nis_lokal' => $nisLokal,
            ]);

            return $santri;
        });

        return response()->json([
            'pesan' => 'Santri ditambahkan.',
            'data' => $santri->load('lembagaAktif.lembaga:jenjang,nama'),
        ], 201);
    }

    /** PATCH /api/admin/santri/{santri} — edit kolom identitas (partial). */
    public function update(SantriUpdateRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        if ($data === []) {
            return response()->json(['pesan' => 'Tidak ada perubahan.', 'data' => $santri->fresh()]);
        }

        $santri->update($data);

        return response()->json(['pesan' => 'Data santri diperbarui.', 'data' => $santri->fresh()]);
    }

    // Upload foto profil santri. Storage: storage/app/santri/foto/* ; DB hanya path di santri.foto_url.
    public function uploadFoto(SantriFotoRequest $request, Santri $santri): JsonResponse
    {
        $path = $request->file('foto')->store('santri/foto', 'local');

        if ($santri->foto_url && Storage::disk('local')->exists($santri->foto_url)) {
            Storage::disk('local')->delete($santri->foto_url);
        }

        $santri->update(['foto_url' => $path]);

        return response()->json([
            'pesan' => 'Foto santri diupload.',
            'data' => $santri->fresh(),
        ], 201);
    }

    // Upload dokumen milik santri (pasca-ACC; pola sama dengan calon di 100).
    public function uploadDokumen(SantriDokumenRequest $request, Santri $santri)
    {
        $data = $request->validated();
        $lembagaUntukKamus = $santri->lembagaAktif()->value('jenjang');
        if (! in_array($data['jenis_dokumen_santri'], RefService::kodeAktif('jenis_dokumen_santri', $lembagaUntukKamus), true)) {
            abort(422, 'Jenis dokumen tidak aktif di lembaga ini.');
        }
        $berkas = $request->file('file');
        $path = NamaBerkasDokumen::simpan(
            $berkas, 'local', 'santri/dokumen',
            (string) ($santri->nama_lengkap ?? 'santri-'.$santri->id),
            $data['jenis_dokumen_santri'], $data['catatan'] ?? null,
        );
        $dok = DokumenSantri::where('santri_id', $santri->id)
            ->where('jenis_dokumen_santri', $data['jenis_dokumen_santri'])
            ->whereNull('nama_file')
            ->latest('id')
            ->first();
        if ($dok) {
            $dok->update([
                'nama_file' => basename($path),
                'catatan' => $data['catatan'] ?? $dok->catatan,
                'tidak_memiliki' => false,
            ]);
        } else {
            $dok = DokumenSantri::create([
                'santri_id' => $santri->id,
                'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
                'nama_file' => basename($path),
                'catatan' => $data['catatan'] ?? null,
            ]);
        }

        return response()->json(['pesan' => 'Dokumen diupload.', 'data' => $dok], 201);
    }

    // Daftar dokumen santri (checklist termasuk baris tanpa file).
    public function listDokumen(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);

        return response()->json([
            'pesan' => 'Dokumen santri berhasil dimuat.',
            'data' => DokumenSantri::where('santri_id', $santri->id)->latest('id')->get(),
        ]);
    }

    // Tandai "tidak memiliki dokumen" (tidak menghalangi proses apa pun).
    public function tidakMemiliki(SantriTidakMemilikiRequest $request, Santri $santri, DokumenSantri $dokumen): JsonResponse
    {
        if ((int) $dokumen->santri_id !== (int) $santri->id) {
            abort(404, 'Dokumen tidak tertaut ke santri ini.');
        }
        $data = $request->validated();
        $dokumen->update(['tidak_memiliki' => $data['tidak_memiliki']]);

        return response()->json(['pesan' => 'Status dokumen diperbarui.', 'data' => $dokumen->fresh()]);
    }

    /** Izin tulis gabungan: tambah (santri baru) DAN ubah (update + keanggotaan). */
    private function authorizeTulisGabungan(Request $request): void
    {
        $auth = $request->user();
        if (! $auth || ! $auth->can('santri.tambah') || ! $auth->can('santri.ubah')) {
            abort(403, 'Akses ditolak.');
        }
    }

    /** POST /api/admin/santri/samakan-nis — samakan NIS paket MI↔MD (pratinjau/tulis). */
    public function samakanNis(Request $request): JsonResponse
    {
        $this->authorize('update', new Santri);
        $periksa = $request->boolean('periksa', true);

        $miId = Lembaga::whereKey('MI')->value('jenjang');
        $mdId = Lembaga::whereKey('MD')->value('jenjang');
        if (! $miId || ! $mdId) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }

        $auth = $request->user();
        $kandidat = Santri::tenantScope()
            ->whereHas('lembagaAktif', fn ($q) => $q->where('jenjang', $miId))
            ->whereHas('lembagaAktif', fn ($q) => $q->where('jenjang', $mdId))
            ->pluck('id');

        $layanan = app(PenerimaanService::class);
        $rincian = [];
        foreach ($kandidat as $id) {
            if (! $auth->canAccessLembaga($miId) || ! $auth->canAccessLembaga($mdId)) {
                continue;
            }
            $santri = Santri::find($id);
            if (! $santri) {
                continue;
            }
            $hasil = $layanan->samakanNisSatu($santri, $miId, $mdId, ! $periksa);
            if ($hasil !== null) {
                $rincian[] = array_merge(['santri_id' => (int) $id, 'nama' => $santri->nama_lengkap], $hasil);
            }
        }

        $hitung = fn (string $s) => count(array_filter($rincian, fn ($r) => $r['status'] === $s));

        return response()->json([
            'pesan' => $periksa
                ? 'Pratinjau selesai: centang dan eksekusi untuk menyamakan.'
                : 'Penyamaan NIS selesai.',
            'periksa' => $periksa,
            'ringkasan' => [
                'kandidat' => count($kandidat),
                'disamakan' => $hitung('disamakan'),
                'beda' => $hitung('beda'),
                'tabrakan' => $hitung('tabrakan'),
            ],
            'rincian' => array_slice($rincian, 0, 200),
        ]);
    }

    /** Lembaga yang boleh diakses pengunduh (dropdown jenjang template). */
    private function lembagaDiizinkan(User $auth): array
    {
        if ($auth->bolehPesantren()) {
            return Lembaga::orderBy('jenjang')->pluck('jenjang')->all();
        }

        return array_values(array_filter(
            $auth->lembagaIdsDenganPasangan(),
            fn (string $jenjang) => Lembaga::whereKey($jenjang)->exists(),
        ));
    }

    /** GET /api/admin/santri/import-template-gabungan — template Excel siswa (keanggotaan + identitas). */
    public function templateGabungan(Request $request)
    {
        $this->authorize('create', Santri::class);

        $auth = $request->user();
        $boleh = $this->lembagaDiizinkan($auth);
        $tunggal = count($boleh) === 1 ? $boleh[0] : null;
        $kode = $tunggal !== null
            ? Lembaga::whereKey($tunggal)->pluck('jenjang')->filter()->all()
            : Lembaga::whereIn('jenjang', $boleh)->orderBy('jenjang')->pluck('jenjang')->all();

        return Excel::download(
            new SantriLembagaTemplateExport($tunggal, array_values($kode)),
            'template-import-siswa-gabungan.xlsx',
        );
    }

    /**
     * GET /api/admin/santri/data-existing — data siswa existing sebagai JSON
     * (kolom = template gabungan, terisi `santri_id`) untuk round-trip update.
     * `jenjang`/`jenjang[]` opsional; tanpa parameter = seluruh lingkup akses.
     * Berkas Excel disusun di browser.
     */
    public function dataExisting(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $ids = $this->resolveDaftarLembagaGabungan($request);
        $data = new DataSantri($ids);

        return response()->json([
            'kolom' => $data->kolom(),
            'wajib' => $data->wajib(),
            'baris' => $data->baris(),
        ]);
    }

    /** Daftar lembaga untuk unduh data: eksplisit (satu/lebih) atau semua dalam lingkup. */
    private function resolveDaftarLembagaGabungan(Request $request): array
    {
        $mentah = $request->input('jenjang');
        $ids = array_values(array_unique(array_filter(
            is_array($mentah) ? $mentah : [$mentah],
            fn ($v) => trim((string) $v) !== '',
        )));
        if ($ids !== []) {
            foreach ($ids as $id) {
                $this->authorizeLembaga($request->user(), (string) $id);
                if (! Lembaga::whereKey($id)->exists()) {
                    abort(422, 'Lembaga tidak ditemukan.');
                }
            }

            return $ids;
        }

        $boleh = $this->lembagaDiizinkan($request->user());
        if ($boleh === []) {
            abort(422, 'Tidak ada lembaga dalam lingkup akses Anda.');
        }

        return $boleh;
    }

    // ---------------- Import bertahap (potongan JSON) ----------------

    /**
     * POST /api/admin/santri/import-potong — satu potongan baris
     * (maks 1000) dari browser. Panggilan pertama tanpa `sesi_id` membuat
     * sesi (wajib `mode` + `total`); berikutnya wajib `sesi_id` milik sendiri.
     * Frontend mengirim SEMUA baris data berurutan (termasuk yang kosong)
     * agar nomor galat absolut selaras nomor file (1 = heading).
     */
    public function potongImport(SantriPotongRequest $request, SantriImporService $layanan): JsonResponse
    {
        $this->authorizeTulisGabungan($request);

        return $this->jalankanImporSesi(
            $request,
            'santri',
            $layanan,
            'galat-import-santri.csv',
            fn (ImportSesi $sesi, SantriImporService $svc) => $sesi->riwayat_dibuat += $svc->barisRiwayat
        );
    }

    /** POST /api/admin/santri/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/santri/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-santri.csv');
    }
}
