<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\SantriLembagaTemplateExport;
use App\Http\Controllers\Api\Admin\Concerns\PetaSantriRiwayat;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SantriDokumenRequest;
use App\Http\Requests\Admin\SantriFotoRequest;
use App\Http\Requests\Admin\SantriPotongRequest;
use App\Http\Requests\Admin\SantriStoreRequest;
use App\Http\Requests\Admin\SantriUpdateRequest;
use App\Models\DokumenSantri;
use App\Models\ImportSesi;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\Impor\DataSantri;
use App\Services\PenerimaanService;
use App\Services\RefService;
use App\Services\SantriImporService;
use App\Services\UrutKatalog;
use App\Support\NamaBerkasDokumen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Buku Induk santri — identitas murni (`santri`).
 * Keanggotaan per lembaga (`lembaga_santri`): dikelola endpoint khusus +
 * import gabungan siswa; riwayat akademik (`riwayat_belajar`) controller terpisah.
 */
class SantriController extends Controller
{
    use ImporBertahap;
    use PetaSantriRiwayat;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['santri.nik', 'santri.nisn'];

    /** GET /api/admin/santri — daftar buku induk (identitas + keanggotaan aktif
     *  + kolom `kelas` dari riwayat TA acuan). */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $urut = $this->parseUrut($request, UrutKatalog::peta('santri'));

        $query = Santri::tenantScope()
            ->with(['lembagaAktif:id,santri_id,jenjang,nis_lokal,nis_kemenag', 'lembagaAktif.lembaga:jenjang,nama']);

        // `semua` = tanpa filter (nilai eksplisit opsi "Semua" dari UI).
        if ($request->filled('is_active_pst') && $request->input('is_active_pst') !== 'semua') {
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

        $this->urutKelasJenjang($query, $urut, $this->taKelas($request));
        $this->terapkanUrut($query, $urut, [
            ['santri.jk', 'naik'], ['santri.nama_lengkap', 'naik'],
        ], self::SORT_NULLABLE);

        $halaman = $query->paginate($this->perPage($request));
        $this->sertakanKelas($halaman->getCollection(), $this->taKelas($request));

        return response()->json($halaman);
    }

    /** TA acuan kolom `kelas`: filter `tahun_ajaran` topBar bila ada (nilai
     *  pertama bila lebih dari satu), selain itu TA yang sedang aktif. */
    private function taKelas(Request $request): ?string
    {
        $ta = $this->nilaiFilter($request, 'tahun_ajaran');

        return $ta === [] ? TahunAjaran::aktif()?->nama : (string) $ta[0];
    }

    /** Kelas & jenjang TIDAK ada sebagai kolom di tabel `santri`, jadi tak bisa
     *  di-`orderBy` langsung: keduanya hasil pemilihan dari banyak baris
     *  `riwayat_belajar`/`lembaga_santri` (aturan sama dengan yang MENAMPILKAN
     *  nilainya). Supaya opsi urut tetap jujur, keduanya diurutkan lewat
     *  subquery skalar yang memakai aturan pilih yang sama.
     *
     *  Dipisah dari `terapkanUrut` karena yang itu hanya bisa `orderBy` nama
     *  kolom mentah, sedangkan di sini perlu ekspresi. Token yang ditangani di
     *  sini dibuang dari `$urut` supaya tidak ikut di-`orderBy` sebagai kolom.
     *
     *  Aturan pilih (samakan dengan `PetaSantriRiwayat::petaSantriGenerate`):
     *  semester 2 menang, `pindah_keluar` dibuang, jenjang utama MI > MD > lain.
     *
     * @param  array{arah: array<string, 'naik'|'turun'>, kunci: list<string>}|null  $urut
     * @param  string|null  $ta  TA acuan kelas (sama dengan `sertakanKelas`).
     */
    private function urutKelasJenjang(mixed $query, ?array &$urut, ?string $ta): void
    {
        if ($urut === null) {
            return;
        }

        $ditangani = [];

        foreach ($urut['kunci'] as $i => $kolom) {
            if ($kolom !== 'kelas-sub' && $kolom !== 'jenjang-sub') {
                continue;
            }
            $arahKolom = $urut['arah'][$kolom] ?? 'naik';

            if ($kolom === 'kelas-sub') {
                // Nama kelas ('1A' < '2A') memang urut secara leksikografis,
                // jadi nilainya sendiri sudah jadi kunci urut yang benar.
                $ekspresi = $this->subqueryKelas($ta);
                $kunciUrut = $ekspresi;
            } else {
                // Jenjang BUKAN kunci urut yang benar: urut abjad menaruh MD
                // sebelum MI. Yang diinginkan urutan baku MI > MD > lain, jadi
                // yang diurutkan adalah PERINGKAT-nya, bukan namanya.
                // `subqueryJenjang` tetap dipakai untuk uji NULL (punya riwayat
                // atau tidak); peringkatnya diturunkan dari nilai itu.
                $ekspresi = $this->subqueryJenjang($ta);
                $kunciUrut = "CASE ({$ekspresi}) WHEN 'MI' THEN 0 WHEN 'MD' THEN 1".
                    " WHEN 'MTS' THEN 2 ELSE 3 END";
            }

            $arahSql = $arahKolom === 'naik' ? 'asc' : 'desc';

            // NULL selalu di bawah agar santri tanpa riwayat tidak menumpuk di atas.
            $query->orderByRaw("({$ekspresi}) IS NULL");
            $query->orderByRaw("({$kunciUrut}) {$arahSql}");

            $ditangani[] = $i;
        }

        if ($ditangani === []) {
            return;
        }

        // Buang token yang sudah ditangani agar `terapkanUrut` tidak mencoba
        // meng-`orderBy` nama pseudo-kolomnya.
        $kunci = [];
        foreach ($urut['kunci'] as $i => $kolom) {
            if (! in_array($i, $ditangani, true)) {
                $kunci[] = $kolom;
            }
        }
        $urut['kunci'] = $kunci;
    }

    /**
     * Subquery nama kelas acuan satu santri (NULL bila tak ada riwayat hidup).
     *
     * Nilai TA & status disisipkan sebagai literal berkutip, BUKAN parameter
     * bind: `orderByRaw` tidak menerima binding, sedangkan `toSql()`
     * mengembalikan placeholder `?` — subquerynya jadi membandingkan NULL dan
     * diam-diam tidak mengurutkan apa pun. Karena itu semua nilai di sini
     * WAJIB lolos `quote()` (bukan disisipkan mentah dari input pengguna).
     */
    private function subqueryKelas(?string $ta): string
    {
        if ($ta === null) {
            return 'NULL';
        }

        $taSql = DB::getPdo()->quote($ta);
        $pindah = DB::getPdo()->quote('pindah_keluar');

        return DB::table('riwayat_belajar as rb_k')
            ->join('kelas as k_k', 'k_k.id', '=', 'rb_k.kelas_id')
            ->whereColumn('rb_k.santri_id', 'santri.id')
            ->whereRaw("rb_k.tahun_ajaran = {$taSql}")
            ->whereRaw("rb_k.status_akhir != {$pindah}")
            ->orderByRaw("CASE WHEN rb_k.semester = '2' THEN 0 ELSE 1 END")
            ->orderByRaw("CASE rb_k.jenjang WHEN 'MI' THEN 0 WHEN 'MD' THEN 1 ELSE 2 END")
            ->limit(1)
            ->select('k_k.nama_kelas')
            ->toSql();
    }

    /**
     * Subquery jenjang utama satu santri (MI > MD > lain).
     *
     * Sama seperti `subqueryKelas`: nilai disisipkan sebagai literal berkutip
     * karena `orderByRaw` tak menerima binding (lihat catatan di sana).
     */
    private function subqueryJenjang(?string $ta): string
    {
        $pindah = DB::getPdo()->quote('pindah_keluar');

        $q = DB::table('riwayat_belajar as rb_j')
            ->whereColumn('rb_j.santri_id', 'santri.id')
            ->whereRaw("rb_j.status_akhir != {$pindah}");
        if ($ta !== null) {
            $q->whereRaw('rb_j.tahun_ajaran = '.DB::getPdo()->quote($ta));
        }

        return $q
            ->orderByRaw("CASE rb_j.jenjang WHEN 'MI' THEN 0 WHEN 'MD' THEN 1 ELSE 2 END")
            ->limit(1)
            ->select('rb_j.jenjang')
            ->toSql();
    }

    /**
     * Tempelkan kolom `kelas` ke baris halaman: nama kelas dari
     * `riwayat_belajar` TA acuan — semester 2 menang, jenjang utama MI > MD
     * (aturan sama dengan peta keuangan, lihat `PetaSantriRiwayat`). Santri
     * tanpa riwayat pada TA itu (atau yang `pindah_keluar`) bernilai null.
     *
     * @param  Collection<int, Santri>  $santri
     */
    private function sertakanKelas($santri, ?string $ta): void
    {
        if ($ta === null || $santri->isEmpty()) {
            return;
        }
        $peta = $this->petaSantriGenerate(
            $ta,
            $santri->pluck('id')->map(fn ($v) => (int) $v)->all(),
        );
        foreach ($santri as $s) {
            $s->setAttribute('kelas', $peta[(int) $s->id]['kelas'] ?? null);
        }
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

    // Upload foto profil santri. Storage: dokumen/santri/foto_profil/* ; DB hanya path di santri.foto_url.
    public function uploadFoto(SantriFotoRequest $request, Santri $santri): JsonResponse
    {
        $path = $request->file('foto')->store('dokumen/santri/foto_profil', 'local');

        if ($santri->foto_url && Storage::disk('local')->exists($santri->foto_url)) {
            Storage::disk('local')->delete($santri->foto_url);
        }

        $santri->update(['foto_url' => $path]);

        return response()->json([
            'pesan' => 'Foto santri diupload.',
            'data' => $santri->fresh(),
        ], 201);
    }

    // Byte mentah foto profil (tampil inline di <img> avatar; bukan unduhan).
    public function lihatFoto(Santri $santri): BinaryFileResponse
    {
        $path = $santri->foto_url;
        if ($path === null || $path === '' || ! Storage::disk('local')->exists($path)) {
            abort(404, 'Santri ini belum punya foto profil.');
        }

        return response()->file(Storage::disk('local')->path($path));
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
            $berkas, 'local', NamaBerkasDokumen::direktori('santri'),
            (string) ($santri->nama_lengkap ?? 'santri-'.$santri->id),
            $data['jenis_dokumen_santri'], $data['catatan'] ?? null,
        );
        $lembaga = $data['lembaga'] ?? null;
        $dok = DokumenSantri::where('santri_id', $santri->id)
            ->where('jenis_dokumen_santri', $data['jenis_dokumen_santri'])
            ->where('lembaga', $lembaga)
            ->whereNull('nama_file')
            ->latest('id')
            ->first();
        if ($dok) {
            $dok->update([
                'nama_file' => basename($path),
                'catatan' => $data['catatan'] ?? $dok->catatan,
                'is_active' => true,
            ]);
        } else {
            $dok = DokumenSantri::create([
                'santri_id' => $santri->id,
                'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
                'lembaga' => $lembaga,
                'nama_file' => basename($path),
                'catatan' => $data['catatan'] ?? null,
            ]);
        }
        // Satu aktif per kunci: berkas yang baru diupload yang terakhir.
        DokumenSantri::where('santri_id', $santri->id)
            ->where('jenis_dokumen_santri', $data['jenis_dokumen_santri'])
            ->where('lembaga', $lembaga)
            ->where('id', '!=', $dok->id)
            ->update(['is_active' => false]);

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
        // Model dimuat sekali; sebelumnya satu Santri::find() per kandidat.
        $kandidat = Santri::tenantScope()
            ->whereHas('lembagaAktif', fn ($q) => $q->where('jenjang', $miId))
            ->whereHas('lembagaAktif', fn ($q) => $q->where('jenjang', $mdId))
            ->get();

        $layanan = app(PenerimaanService::class);
        $rincian = [];
        foreach ($kandidat as $santri) {
            if (! $auth->canAccessLembaga($miId) || ! $auth->canAccessLembaga($mdId)) {
                continue;
            }
            $hasil = $layanan->samakanNisSatu($santri, $miId, $mdId, ! $periksa);
            if ($hasil !== null) {
                $rincian[] = array_merge(['santri_id' => (int) $santri->id, 'nama' => $santri->nama_lengkap], $hasil);
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
