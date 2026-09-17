<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\SantriLembagaDataExport;
use App\Exports\SantriLembagaTemplateExport;
use App\Exports\SantriTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImportSantriRequest;
use App\Imports\SantriLembagaImport;
use App\Imports\SantriLengkapImport;
use App\Models\DokumenSantri;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\User;
use App\Services\PenerimaanService;
use App\Services\RefService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException as ServiceValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\Failure;
use Maatwebsite\Excel\Validators\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Buku Induk santri — identitas murni (`santri`).
 * Keanggotaan per lembaga (`lembaga_santri`): dikelola endpoint khusus +
 * import gabungan siswa; riwayat akademik (`riwayat_belajar`) controller terpisah.
 */
class SantriController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/santri — daftar buku induk (identitas + keanggotaan aktif). */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $query = Santri::tenantScope()
            ->with(['lembagaAktif:id,santri_id,lembaga_id,nis_lokal,nis_kemenag', 'lembagaAktif.lembaga:id,nama,kode']);

        if ($request->filled('status_global')) {
            $query->where('status_global', $request->boolean('status_global'));
        }
        if ($request->filled('lembaga_id')) {
            $lembagaId = $request->integer('lembaga_id');
            $this->authorizeLembaga($request->user(), $lembagaId);
            $query->whereHas('lembagaSantri', fn ($ls) => $ls->where('lembaga_id', $lembagaId));
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%")
                ->orWhere('nisn', 'like', "%{$q}%"));
        }

        return response()->json($query->latest('id')->paginate($this->perPage($request)));
    }

    /** POST /api/admin/santri — input manual identitas (buku induk). */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Santri::class);

        $aturan = $this->aturanProfil();
        $aturan['nama_lengkap'] = ['required', 'string', 'max:255'];
        $aturan['jk'] = ['required', 'in:L,P'];

        $data = $request->validate($aturan);

        $santri = Santri::create($data);

        return response()->json(['pesan' => 'Santri ditambahkan.', 'data' => $santri], 201);
    }

    /** Aturan validasi kolom profil identitas (dipakai store & update). */
    private function aturanProfil(): array
    {
        $aturan = [];
        foreach (Santri::KOLOM_PROFIL as $kolom) {
            $aturan[$kolom] = ['sometimes', 'nullable', 'string', 'max:255'];
        }
        $aturan['nama_lengkap'] = ['sometimes', 'required', 'string', 'max:255'];
        $aturan['alamat'] = ['sometimes', 'nullable', 'string', 'max:500'];
        $aturan['nik'] = $aturan['ayah_nik'] = $aturan['ibu_nik'] = $aturan['wali_nik'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['no_kk'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['nisn'] = ['sometimes', 'nullable', 'digits:10'];
        $aturan['jk'] = ['sometimes', 'nullable', 'in:L,P'];
        $aturan['tipe_santri'] = ['sometimes', 'nullable', 'in:asrama,non_asrama'];
        $aturan['anak_ke'] = $aturan['j_saudara'] = ['sometimes', 'nullable', 'integer', 'min:0'];
        $aturan['email_santri'] = ['sometimes', 'nullable', 'email', 'max:255'];
        $aturan['no_hp_santri'] = $aturan['ayah_telp'] = $aturan['ibu_telp'] = $aturan['wali_telp'] = ['sometimes', 'nullable', 'string', 'max:20'];
        $aturan['rt'] = $aturan['rw'] = ['sometimes', 'nullable', 'string', 'max:3'];
        foreach (['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk'] as $k) {
            $aturan[$k] = ['sometimes', 'nullable', 'date'];
        }

        return $aturan;
    }

    /** Resolusi lembaga untuk lingkup kamus efektif (template import). */
    private function resolveLembagaInput(User $auth, ?int $lembagaId): ?int
    {
        if ($lembagaId !== null) {
            $this->authorizeLembaga($auth, $lembagaId);
            if (! Lembaga::where('id', $lembagaId)->whereNotNull('parent_id')->exists()) {
                throw ServiceValidationException::withMessages(['lembaga_id' => 'Lembaga harus lembaga operasional (bukan induk pesantren).']);
            }

            return $lembagaId;
        }
        if ($auth->bolehPesantren()) {
            return null;
        }
        $ids = $auth->lembagaIds();

        return count($ids) === 1 ? (int) $ids[0] : null;
    }

    /** PATCH /api/admin/santri/{santri} — edit kolom identitas (partial). */
    public function update(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('update', $santri);

        $data = $request->validate($this->aturanProfil());

        if ($data === []) {
            return response()->json(['pesan' => 'Tidak ada perubahan.', 'data' => $santri->fresh()]);
        }

        $santri->update($data);

        return response()->json(['pesan' => 'Data santri diperbarui.', 'data' => $santri->fresh()]);
    }

    // Upload foto profil santri. Storage: storage/app/santri/foto/* ; DB hanya path di santri.foto_url.
    public function uploadFoto(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('update', $santri);

        $request->validate([
            'foto' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:2048'],
        ]);

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
    public function uploadDokumen(Request $request, Santri $santri)
    {
        $this->authorize('update', $santri);

        $data = $request->validate([
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'catatan' => ['nullable', 'string'],
        ]);
        $lembagaUntukKamus = $santri->lembagaAktif()->value('lembaga_id');
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
    public function tidakMemiliki(Request $request, Santri $santri, DokumenSantri $dokumen): JsonResponse
    {
        $this->authorize('update', $santri);

        if ((int) $dokumen->santri_id !== (int) $santri->id) {
            abort(404, 'Dokumen tidak tertaut ke santri ini.');
        }
        $data = $request->validate(['tidak_memiliki' => ['required', 'boolean']]);
        $dokumen->update(['tidak_memiliki' => $data['tidak_memiliki']]);

        return response()->json(['pesan' => 'Status dokumen diperbarui.', 'data' => $dokumen->fresh()]);
    }

    /** GET /api/admin/santri/import-template — template Excel identitas (buku induk).
     *  `lembaga_id` opsional: dropdown kamus mengikuti referensi efektif lembaga tsb. */
    public function template(Request $request)
    {
        $this->authorize('create', Santri::class);

        $lembagaId = $this->resolveLembagaInput(
            $request->user(),
            $request->filled('lembaga_id') ? (int) $request->lembaga_id : null,
        );

        return Excel::download(new SantriTemplateExport($lembagaId), 'template-import-santri.xlsx');
    }

    /** POST /api/admin/santri/import-periksa — validasi file TANPA menulis (dry-run). */
    public function periksaImport(ImportSantriRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: true);
    }

    /** POST /api/admin/santri/import-lengkap — import identitas massal. */
    public function importLengkap(ImportSantriRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: false);
    }

    /** Alur bersama import identitas. Mode periksa: transaksi selalu di-rollback. */
    private function prosesImport(ImportSantriRequest $request, bool $periksa): JsonResponse
    {
        $this->authorize('create', Santri::class);

        $import = new SantriLengkapImport;
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

        return response()->json(['pesan' => 'Data santri berhasil diimport.']);
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

        $miId = Lembaga::where('kode', 'MI')->value('id');
        $mdId = Lembaga::where('kode', 'MD')->value('id');
        if (! $miId || ! $mdId) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }

        $auth = $request->user();
        $kandidat = Santri::tenantScope()
            ->whereHas('lembagaAktif', fn ($q) => $q->where('lembaga_id', $miId))
            ->whereHas('lembagaAktif', fn ($q) => $q->where('lembaga_id', $mdId))
            ->pluck('id');

        $layanan = app(PenerimaanService::class);
        $rincian = [];
        foreach ($kandidat as $id) {
            if (! $auth->canAccessLembaga((int) $miId) || ! $auth->canAccessLembaga((int) $mdId)) {
                continue;
            }
            $santri = Santri::find($id);
            if (! $santri) {
                continue;
            }
            $hasil = $layanan->samakanNisSatu($santri, (int) $miId, (int) $mdId, ! $periksa);
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

    /** Lembaga operasional yang boleh diakses pengunduh (dropdown kode template). */
    private function lembagaDiizinkan(User $auth): array
    {
        if ($auth->bolehPesantren()) {
            return Lembaga::whereNotNull('parent_id')->pluck('id')->map(fn ($v) => (int) $v)->all();
        }

        return array_values(array_filter(
            $auth->lembagaIdsDenganPasangan(),
            fn (int $id) => Lembaga::where('id', $id)->whereNotNull('parent_id')->exists(),
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
            ? Lembaga::whereKey($tunggal)->pluck('kode')->filter()->all()
            : Lembaga::whereIn('id', $boleh)->whereNotNull('kode')->orderBy('kode')->pluck('kode')->all();

        return Excel::download(
            new SantriLembagaTemplateExport($tunggal, array_values($kode)),
            'template-import-siswa-gabungan.xlsx',
        );
    }

    /** GET /api/admin/santri/data-gabungan — pra-isi data existing (round-trip update).
     *  Satu lembaga via `kode_lembaga`/`lembaga_id`, beberapa via `lembaga_id[]`;
     *  tanpa parameter → semua lembaga dalam lingkup pengunduh. */
    public function dataGabungan(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $ids = $this->resolveDaftarLembagaGabungan($request);
        if (count($ids) === 1) {
            $kode = Lembaga::whereKey($ids[0])->value('kode');

            return Excel::download(new SantriLembagaDataExport($ids), "data-siswa-{$kode}-{$ids[0]}.xlsx");
        }

        return Excel::download(new SantriLembagaDataExport($ids), 'data-siswa-pilihan.xlsx');
    }

    /** Daftar lembaga untuk unduh data: eksplisit (satu/lebih) atau semua dalam lingkup. */
    private function resolveDaftarLembagaGabungan(Request $request): array
    {
        if (trim((string) $request->input('kode_lembaga', '')) !== '') {
            return [$this->resolveLembagaGabungan($request)];
        }

        $mentah = $request->input('lembaga_id');
        $ids = array_values(array_unique(array_filter(
            array_map('intval', is_array($mentah) ? $mentah : [$mentah]),
            fn (int $id) => $id > 0,
        )));
        if ($ids !== []) {
            foreach ($ids as $id) {
                $this->authorizeLembaga($request->user(), $id);
                if (! Lembaga::where('id', $id)->whereNotNull('parent_id')->exists()) {
                    abort(422, 'Lembaga harus operasional (bukan induk pesantren).');
                }
            }

            return $ids;
        }

        $boleh = $this->lembagaDiizinkan($request->user());
        if ($boleh === []) {
            abort(422, 'Tidak ada lembaga operasional dalam lingkup akses Anda.');
        }

        return $boleh;
    }

    /** Resolusi lembaga wajib untuk unduh data & validasi tenant (kode/id, operasional). */
    private function resolveLembagaGabungan(Request $request): int
    {
        $kode = trim((string) $request->input('kode_lembaga', ''));
        if ($kode !== '') {
            $lembaga = Lembaga::whereRaw('UPPER(kode) = ?', [mb_strtoupper($kode)])->first();
            if (! $lembaga || $lembaga->parent_id === null) {
                abort(422, 'Kode lembaga tidak valid.');
            }
            $this->authorizeLembaga($request->user(), (int) $lembaga->id);

            return (int) $lembaga->id;
        }

        $lembagaId = $request->filled('lembaga_id') ? (int) $request->lembaga_id : null;
        if ($lembagaId === null) {
            $boleh = $this->lembagaDiizinkan($request->user());
            if (count($boleh) !== 1) {
                abort(422, 'Pilih satu lembaga (kode_lembaga / lembaga_id).');
            }
            $lembagaId = $boleh[0];
        }
        $this->authorizeLembaga($request->user(), $lembagaId);
        if (! Lembaga::where('id', $lembagaId)->whereNotNull('parent_id')->exists()) {
            abort(422, 'Lembaga harus operasional (bukan induk pesantren).');
        }

        return $lembagaId;
    }

    /** POST /api/admin/santri/import-periksa-gabungan — validasi file TANPA menulis (dry-run). */
    public function periksaImportGabungan(ImportSantriRequest $request): JsonResponse
    {
        return $this->prosesImportGabungan($request, periksa: true);
    }

    /** POST /api/admin/santri/import-gabungan — import siswa massal (identitas + keanggotaan). */
    public function importGabungan(ImportSantriRequest $request): JsonResponse
    {
        return $this->prosesImportGabungan($request, periksa: false);
    }

    /** Alur bersama import gabungan. Mode periksa: transaksi selalu di-rollback. */
    private function prosesImportGabungan(ImportSantriRequest $request, bool $periksa): JsonResponse
    {
        $this->authorizeTulisGabungan($request);

        $salah = $this->cekHeadingGabungan($request->file('file'));
        if ($salah !== null) {
            return response()->json(['pesan' => $salah, 'siap_import' => false, 'errors' => []], 422);
        }

        $import = new SantriLembagaImport;
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

        return response()->json(['pesan' => 'Data siswa berhasil diimport.']);
    }

    /**
     * Penjaga salah-template: file identitas (tanpa blok keanggotaan) ditolak
     * dengan pesan jelas sebelum validasi per baris.
     */
    /**
     * Penjaga salah-file: endpoint gabungan menerima file gabungan maupun
     * identitas (tanpa blok lembaga → hanya santri). Syarat minimal hanya
     * kolom identitas kunci.
     */
    private function cekHeadingGabungan($file): ?string
    {
        try {
            $sheet = IOFactory::load($file->getRealPath())->getSheet(0);
            $baris = $sheet->rangeToArray('A1:ZZ1', null, true, false)[0] ?? [];
        } catch (\Throwable $e) {
            return 'File tidak dapat dibaca sebagai Excel.';
        }

        $judul = array_map(fn ($v) => strtolower(trim((string) $v)), $baris);
        if (! in_array('nama_lengkap', $judul, true)) {
            return 'File bukan template siswa (kolom nama_lengkap tidak ada).';
        }

        return null;
    }
}
