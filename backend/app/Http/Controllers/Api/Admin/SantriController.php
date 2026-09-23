<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\SantriLembagaDataExport;
use App\Exports\SantriLembagaTemplateExport;
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
use App\Services\PenerimaanService;
use App\Services\RefService;
use App\Services\SantriImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\Failure;

/**
 * Buku Induk santri — identitas murni (`santri`).
 * Keanggotaan per lembaga (`lembaga_santri`): dikelola endpoint khusus +
 * import gabungan siswa; riwayat akademik (`riwayat_belajar`) controller terpisah.
 */
class SantriController extends Controller
{
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
        if ($request->filled('jenjang')) {
            $lembagaId = (string) $request->input('jenjang');
            $this->authorizeLembaga($request->user(), $lembagaId);
            $query->whereHas('lembagaSantri', fn ($ls) => $ls->where('jenjang', $lembagaId));
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nik', 'like', "%{$q}%")
                ->orWhere('nisn', 'like', "%{$q}%")
                ->orWhere(function ($nama) use ($q) {
                    // MySQL/MariaDB: FULLTEXT ngram (index) untuk nama; driver
                    // lain (SQLite di tes) tetap LIKE substring.
                    if ($this->bisaFulltext() && mb_strlen($q) >= 2) {
                        $nama->whereRaw('MATCH(nama_lengkap) AGAINST (? IN BOOLEAN MODE)', [$this->istilahBoolean($q)]);
                    } else {
                        $nama->where('nama_lengkap', 'like', "%{$q}%");
                    }
                }));
        }

        $this->terapkanUrut($query, $urut, [
            ['santri.jk', 'naik'], ['santri.nama_lengkap', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    /** Driver dengan dukungan FULLTEXT ngram (lihat migrasi index santri). */
    private function bisaFulltext(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    /** Kata kunci → istilah BOOLEAN MODE yang aman untuk parser ngram. */
    private function istilahBoolean(string $q): string
    {
        $token = preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $token = array_map(fn (string $t): string => preg_replace('/[+\-><()~*"@]+/', '', $t) ?? '', $token);
        $token = array_values(array_filter($token, fn (string $t): bool => $t !== ''));

        return implode(' ', array_map(fn (string $t): string => '+'.$t, $token));
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
        $path = $request->file('file')->store('santri/dokumen', 'local');
        $dok = DokumenSantri::where('santri_id', $santri->id)
            ->where('jenis_dokumen_santri', $data['jenis_dokumen_santri'])
            ->whereNull('path_file')
            ->latest('id')
            ->first();
        if ($dok) {
            $dok->update([
                'path_file' => $path,
                'catatan' => $data['catatan'] ?? $dok->catatan,
                'tidak_memiliki' => false,
            ]);
        } else {
            $dok = DokumenSantri::create([
                'santri_id' => $santri->id,
                'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
                'path_file' => $path,
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

    /** @param  iterable<Failure>  $failures */
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

    /** GET /api/admin/santri/data-gabungan — pra-isi data existing (round-trip update).
     *  Satu lembaga via `jenjang`, beberapa via `jenjang[]`; tanpa parameter →
     *  semua lembaga dalam lingkup pengunduh. */
    public function dataGabungan(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $ids = $this->resolveDaftarLembagaGabungan($request);
        if (count($ids) === 1) {
            return Excel::download(new SantriLembagaDataExport($ids), "data-siswa-{$ids[0]}.xlsx");
        }

        return Excel::download(new SantriLembagaDataExport($ids), 'data-siswa-pilihan.xlsx');
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
        $data = $request->validated();
        $pengguna = $request->user();

        $this->buangSesiBasi();

        if (! empty($data['sesi_id'])) {
            $sesi = ImportSesi::whereKey($data['sesi_id'])->where('user_id', $pengguna->id)->first();
            if ($sesi === null) {
                return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
            }
            if ($sesi->status !== ImportSesi::JALAN) {
                return response()->json(['message' => 'Sesi sudah selesai atau dibatalkan.'], 422);
            }
            if ($sesi->mode !== $data['mode']) {
                return response()->json(['message' => 'Mode potongan berbeda dari sesi.'], 422);
            }
        } else {
            $sesi = ImportSesi::create([
                'user_id' => $pengguna->id,
                'tipe' => 'santri',
                'mode' => $data['mode'],
                'total' => $data['total'],
            ]);
        }

        $kering = $sesi->mode === 'periksa';
        $normal = array_map(fn ($baris) => $layanan->normalisasiBaris((array) $baris), $data['baris']);
        $layanan->prosesPotongan($normal, $sesi->offset + 1, $kering);

        $baru = $layanan->gagal;
        if ($baru !== []) {
            $this->tambahGalatSesi($sesi, $baru);
        }
        $sesi->offset += count($data['baris']);
        $sesi->dibuat += $layanan->dibuat;
        $sesi->diperbarui += $layanan->diperbarui;
        $sesi->riwayat_dibuat += $layanan->barisRiwayat;
        $sesi->gagal += count($baru);

        $selesai = $request->boolean('terakhir') || $sesi->offset >= $sesi->total;
        if ($selesai) {
            $sesi->status = ImportSesi::SELESAI;
        }
        $sesi->save();

        return response()->json([
            'sesi_id' => $sesi->id,
            'offset' => $sesi->offset,
            'total' => $sesi->total,
            'selesai' => $selesai,
            'ringkasan' => $sesi->ringkasan(),
            'galat_baru' => count($baru),
            'galat_contoh' => array_slice($sesi->galat_contoh ?? [], 0, 10),
            'galat_unduh' => $selesai && $sesi->gagal > 0,
        ]);
    }

    /** POST /api/admin/santri/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        if ($sesi->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
        }
        $this->hapusBerkasGalat($sesi);
        $sesi->update(['status' => ImportSesi::BATAL]);

        return response()->json(['pesan' => 'Sesi import dibatalkan.']);
    }

    /** GET /api/admin/santri/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        if ($sesi->user_id !== $request->user()->id || $sesi->galat_file === null) {
            abort(404);
        }
        $path = storage_path('app/'.$sesi->galat_file);
        if (! is_file($path)) {
            abort(404);
        }

        return response()->download($path, 'galat-import-santri.csv', ['Content-Type' => 'text/csv']);
    }

    /** Tambah galat potongan ke berkas CSV sesi + contoh (maks 200). */
    private function tambahGalatSesi(ImportSesi $sesi, array $baru): void
    {
        $relatif = $sesi->galat_file ?? "imports/galat-{$sesi->id}.csv";
        $path = storage_path('app/'.$relatif);
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        $baruBerkas = ! is_file($path);
        $tulis = fopen($path, 'ab');
        if ($baruBerkas) {
            fputcsv($tulis, ['baris', 'nis_lokal', 'kolom', 'pesan']);
        }
        foreach ($baru as $galat) {
            fputcsv($tulis, [$galat['baris'], $galat['nis_lokal'] ?? '', $galat['kolom'], $galat['pesan']]);
        }
        fclose($tulis);

        $contoh = $sesi->galat_contoh ?? [];
        foreach ($baru as $galat) {
            if (count($contoh) >= 200) {
                break;
            }
            $contoh[] = $galat;
        }
        $sesi->galat_file = $relatif;
        $sesi->galat_contoh = $contoh;
    }

    private function hapusBerkasGalat(ImportSesi $sesi): void
    {
        if ($sesi->galat_file !== null) {
            $path = storage_path('app/'.$sesi->galat_file);
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /** Bersihkan sesi basi (melewati TTL) beserta berkas galatnya. */
    private function buangSesiBasi(): void
    {
        ImportSesi::where('created_at', '<', now()->subHours(ImportSesi::TTL_JAM))
            ->chunkById(100, function ($daftar) {
                foreach ($daftar as $sesi) {
                    $this->hapusBerkasGalat($sesi);
                    $sesi->delete();
                }
            });
    }
}
