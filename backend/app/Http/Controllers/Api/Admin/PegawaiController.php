<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\PegawaiTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PegawaiFotoRequest;
use App\Http\Requests\Admin\PegawaiPotongRequest;
use App\Http\Requests\Admin\PegawaiStoreRequest;
use App\Http\Requests\Admin\PegawaiUpdateRequest;
use App\Models\ImportSesi;
use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\User;
use App\Services\AkunPegawaiService;
use App\Services\PegawaiImporService;
use App\Services\UrutKatalog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Buku Induk Guru (`pegawai`): CRUD identitas + import bertahap +
 * tautan akun + daftar opsi aktif (dropdown walas).
 * Penempatan (`lembaga_pegawai`) & riwayat TA (`keaktifan_pegawai`):
 * controller terpisah di bawah.
 */
class PegawaiController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['pegawai.nip', 'pegawai.nik', 'pegawai.tgl_mulai_kerja', 'pegawai.tgl_sk_awal'];

    /** GET /api/admin/pegawai — daftar buku induk (global; filter lembaga/TA via penempatan/keaktifan). */
    public function index(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('pegawai'));
        $query = Pegawai::with(['penempatan.lembaga:jenjang,nama', 'akun:id,name,email']);

        $lembaga = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($request->user(), $lembaga);
        if ($lembaga !== []) {
            $query->whereHas('penempatan', fn ($p) => $p->whereIn('jenjang', $lembaga));
        }
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        if ($tahunAjaran !== []) {
            $query->whereHas('keaktifan', fn ($k) => $k->whereIn('tahun_ajaran', $tahunAjaran));
        }
        if ($request->filled('status_aktif')) {
            $query->where('pegawai.status_aktif', $request->input('status_aktif'));
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nip', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%")
                ->orWhere('no_sk_awal', 'like', "%{$q}%"));
        }

        $this->terapkanUrut($query, $urut, [
            ['pegawai.nama_lengkap', 'naik'], ['pegawai.id', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(PegawaiStoreRequest $request): JsonResponse
    {
        try {
            $pegawai = Pegawai::create($request->validated());
        } catch (QueryException $e) {
            return response()->json(['message' => 'NIP/NIPP/NIK sudah dipakai pegawai lain.'], 422);
        }

        return response()->json(['pesan' => 'Pegawai disimpan.', 'data' => $pegawai], 201);
    }

    public function update(PegawaiUpdateRequest $request, Pegawai $pegawai): JsonResponse
    {
        try {
            $pegawai->update($request->validated());
        } catch (QueryException $e) {
            return response()->json(['message' => 'NIP/NIPP/NIK sudah dipakai pegawai lain.'], 422);
        }

        return response()->json(['pesan' => 'Pegawai diperbarui.', 'data' => $pegawai->fresh()]);
    }

    public function destroy(Pegawai $pegawai): JsonResponse
    {
        $pegawai->delete();

        return response()->json(['pesan' => 'Pegawai dihapus.']);
    }

    /** POST /api/admin/pegawai/{pegawai}/tautkan-akun — tautkan/lepas akun login. */
    public function tautkanAkun(Request $request, Pegawai $pegawai): JsonResponse
    {
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id']]);
        $pegawai->update(['user_id' => $data['user_id'] ?? null]);

        return response()->json(['pesan' => 'Akun ditautkan.', 'data' => $pegawai->fresh()]);
    }

    /**
     * POST /api/admin/pegawai/{pegawai}/buatkan-akun — buat user dari
     * `email_pribadi` + `no_hp`, role `guru`, scope lembaga = penempatan aktif.
     * Tanpa email tapi `no_hp` bebas → akun dibuat tanpa email (login via
     * no. HP). Menolak bila sudah tertaut, tanpa kontak layak, email dipakai
     * akun lain (tautkan manual saja), atau no. HP dipakai akun lain.
     */
    public function buatkanAkun(Request $request, Pegawai $pegawai, AkunPegawaiService $akun): JsonResponse
    {
        $this->authorize('create', User::class);

        if ($pegawai->user_id !== null) {
            return response()->json(['message' => 'Pegawai ini sudah tertaut ke akun.'], 422);
        }

        $hasil = $akun->sediakan($pegawai, $request->user());

        if ($hasil['status'] === AkunPegawaiService::DIBUAT) {
            return response()->json([
                'pesan' => "Akun guru dibuat untuk {$pegawai->nama_lengkap}.",
                'data' => [
                    'pegawai' => $pegawai->fresh(),
                    'user_id' => $hasil['user']->id,
                    'email' => $hasil['user']->email,
                    'telepon' => $hasil['user']->phone,
                    'sandi_bawaan' => AkunPegawaiService::SANDI_BAWAAN,
                    'catatan' => $hasil['catatan'],
                ],
            ], 201);
        }

        return match ($hasil['kode']) {
            'wewenang' => response()->json(['message' => 'Anda tidak berwenang membuat akun guru.'], 403),
            'kontak_kosong' => response()->json(['message' => 'Tidak ada email/no. HP yang dapat dipakai untuk akun.'], 422),
            'email_bentrok' => response()->json(['message' => 'Email sudah dipakai akun lain; tautkan manual lewat dialog akun.'], 422),
            'telepon_bentrok' => response()->json(['message' => 'No. HP sudah dipakai akun lain; tautkan manual lewat dialog akun.'], 422),
            'lembaga_akses' => response()->json(['message' => 'Penempatan pegawai di luar kewenangan Anda.'], 403),
            default => response()->json(['message' => 'Pegawai belum ditempatkan di lembaga mana pun.'], 422),
        };
    }

    /**
     * POST /api/admin/pegawai/generate-akun — buat/selaraskan akun guru massal.
     * Tanpa tautan + kontak layak → buat (sandi bawaan dev); email dipakai
     * akun lain → tambahkan peran guru ke akun itu (tanpa menautkan);
     * sudah tertaut → selaraskan nama + telepon + email + pastikan role +
     * pastikan pivot `user_lembaga` untuk penempatan aktif. Filter `q` /
     * `status_aktif` opsional membatasi cakupan.
     */
    public function generateAkun(Request $request, AkunPegawaiService $akun): JsonResponse
    {
        $this->authorize('create', User::class);
        $aktor = $request->user();
        if (! in_array('guru', $aktor->creatableRoles(), true)) {
            return response()->json(['message' => 'Anda tidak berwenang membuat akun guru.'], 403);
        }

        $alasan = [
            'wewenang' => 'tanpa wewenang akun',
            'kontak_kosong' => 'tanpa email/no. HP layak',
            'email_bentrok' => 'email dipakai akun lain',
            'telepon_bentrok' => 'no. HP dipakai akun lain',
            'lembaga_akses' => 'di luar kewenangan',
            'lembaga_kosong' => 'tanpa penempatan',
        ];
        $hasil = ['dibuat' => 0, 'diperbarui' => 0, 'dilewati' => 0];
        $gagal = [];

        $query = Pegawai::query();
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nip', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%")
                ->orWhere('no_sk_awal', 'like', "%{$q}%"));
        }
        if ($request->filled('status_aktif')) {
            $query->where('pegawai.status_aktif', $request->input('status_aktif'));
        }

        $query->chunkById(200, function ($baris) use ($akun, $aktor, $alasan, &$hasil, &$gagal) {
            foreach ($baris as $pegawai) {
                $akun->cobaTautkan($pegawai, $aktor);
                $r = $akun->sediakan($pegawai, $aktor, false, true, true);
                if ($r['status'] === AkunPegawaiService::DIBUAT) {
                    $hasil['dibuat']++;
                } elseif ($r['status'] === AkunPegawaiService::DISINKRON && $r['diubah']) {
                    $hasil['diperbarui']++;
                } else {
                    $hasil['dilewati']++;
                    if (($r['kode'] ?? '') !== 'ok' && count($gagal) < 100) {
                        $gagal[] = [
                            'pegawai_id' => $pegawai->id,
                            'nama' => $pegawai->nama_lengkap,
                            'alasan' => $alasan[$r['kode']] ?? $r['kode'],
                        ];
                    }
                }
            }
        });

        return response()->json([
            'pesan' => "{$hasil['dibuat']} akun dibuat, {$hasil['diperbarui']} diperbarui, {$hasil['dilewati']} dilewati.",
            'data' => $hasil + ['gagal' => $gagal],
        ]);
    }

    // Upload foto profil pegawai. Storage: storage/app/pegawai/foto/* ; DB hanya path di pegawai.foto_url.
    public function uploadFoto(PegawaiFotoRequest $request, Pegawai $pegawai): JsonResponse
    {
        $path = $request->file('foto')->store('pegawai/foto', 'local');

        if ($pegawai->foto_url && Storage::disk('local')->exists($pegawai->foto_url)) {
            Storage::disk('local')->delete($pegawai->foto_url);
        }

        $pegawai->update(['foto_url' => $path]);

        return response()->json([
            'pesan' => 'Foto pegawai diupload.',
            'data' => $pegawai->fresh(),
        ], 201);
    }

    /** GET /api/admin/pegawai/aktif — opsi dropdown wali: pegawai aktif di lembaga + TA. */
    public function aktif(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $rows = Pegawai::where('pegawai.status_aktif', Pegawai::AKTIF)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('lembaga_pegawai')
                ->whereColumn('lembaga_pegawai.pegawai_id', 'pegawai.id')
                ->where('lembaga_pegawai.jenjang', $data['jenjang'])
                ->where('lembaga_pegawai.is_active_lembaga', LembagaPegawai::YA))
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('keaktifan_pegawai')
                ->whereColumn('keaktifan_pegawai.pegawai_id', 'pegawai.id')
                ->where('keaktifan_pegawai.jenjang', $data['jenjang'])
                ->where('keaktifan_pegawai.tahun_ajaran', $data['tahun_ajaran'])
                ->where('keaktifan_pegawai.status_keaktifan', KeaktifanPegawai::AKTIF))
            ->orderBy('pegawai.nama_lengkap')
            ->get(['id', 'nip', 'nama_lengkap']);

        return response()->json($rows);
    }

    /** GET /api/admin/pegawai/import-template — template Excel buku induk. */
    public function templateImport()
    {
        return Excel::download(new PegawaiTemplateExport, 'template-import-pegawai.xlsx');
    }

    /**
     * GET /api/admin/pegawai/data-existing — JSON kolom template + baris nyata
     * (Excel dirakit di browser). Baris dikembalikan posisional sejajar
     * `kolom` (cermin `DataSantri::baris()`), karena perakit browser membaca
     * per indeks, bukan per kunci.
     */
    public function dataExisting(): JsonResponse
    {
        $kolom = PegawaiTemplateExport::kolom();
        $teks = fn (mixed $nilai): string => $nilai === null ? '' : (string) $nilai;
        $baris = Pegawai::orderBy('nama_lengkap')->limit(5000)->get()
            ->map(function (Pegawai $p) use ($kolom, $teks) {
                $peta = [
                    'pegawai_id' => (string) $p->id,
                    'nama_lengkap' => $teks($p->nama_lengkap),
                    'nip' => $teks($p->nip),
                    'nipp' => $teks($p->nipp),
                    'nik' => $teks($p->nik),
                    'jenis_kelamin' => $teks($p->jenis_kelamin),
                    'gelar_depan' => $teks($p->gelar_depan),
                    'gelar_belakang' => $teks($p->gelar_belakang),
                    'tempat_lahir' => $teks($p->tempat_lahir),
                    'tanggal_lahir' => $p->tanggal_lahir?->format('Y-m-d') ?? '',
                    'no_hp' => $teks($p->no_hp),
                    'email_pribadi' => $teks($p->email_pribadi),
                    'email_gws' => $teks($p->email_gws),
                    'status_aktif' => $teks($p->status_aktif),
                    'tgl_mulai_kerja' => $p->tgl_mulai_kerja?->format('Y-m-d') ?? '',
                    'no_sk_awal' => $teks($p->no_sk_awal),
                    'tgl_sk_awal' => $p->tgl_sk_awal?->format('Y-m-d') ?? '',
                    'pendidikan_terakhir' => $teks($p->pendidikan_terakhir),
                    'jenis_ptk' => $teks($p->jenis_ptk),
                    'status_pernikahan' => $teks($p->status_pernikahan),
                    'agama' => $teks($p->agama),
                    'gol_darah' => $teks($p->gol_darah),
                    'npwp' => $teks($p->npwp),
                    'no_kk' => $teks($p->no_kk),
                    'no_bpjs' => $teks($p->no_bpjs),
                    'status_tempat_tinggal' => $teks($p->status_tempat_tinggal),
                    'niat_npa' => $teks($p->niat_npa),
                    'jarak_ke_pesantren' => $teks($p->jarak_ke_pesantren),
                    'waktu_tempuh' => $teks($p->waktu_tempuh),
                    'transportasi' => $teks($p->transportasi),
                    'sertifikasi' => $teks($p->sertifikasi),
                    'provinsi' => $teks($p->provinsi),
                    'kab_kota' => $teks($p->kab_kota),
                    'kecamatan' => $teks($p->kecamatan),
                    'desa_kelurahan' => $teks($p->desa_kelurahan),
                    'rt' => $teks($p->rt),
                    'rw' => $teks($p->rw),
                    'kode_pos' => $teks($p->kode_pos),
                    'alamat' => $teks($p->alamat),
                ];

                return array_map(fn (string $kunci) => $peta[$kunci] ?? '', $kolom);
            })->all();

        return response()->json([
            'kolom' => $kolom,
            'wajib' => PegawaiTemplateExport::kolomWajib(),
            'baris' => $baris,
        ]);
    }

    /** POST /api/admin/pegawai/import-potong — import bertahap 1000 baris/panggilan. */
    public function potongImport(PegawaiPotongRequest $request, PegawaiImporService $layanan): JsonResponse
    {
        $layanan->setAktor($request->user());

        return $this->jalankanImporSesi($request, 'pegawai', $layanan, 'import', function (ImportSesi $sesi, $layanan) {
            $sesi->akun_dibuat += $layanan->akunDibuat;
            $sesi->akun_dilewati += $layanan->akunDilewati;
        });
    }

    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-pegawai.csv');
    }

    /**
     * GET /api/admin/pegawai-akun — guru yang sudah punya akun + info akunnya
     * (login, peran, akses lembaga). Baca-saja untuk halaman Akun Pegawai.
     */
    public function akunIndex(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('pegawai_akun'));
        $query = Pegawai::with([
            'akun:id,name,email,phone,username',
            'akun.roles:id,name',
            'akun.lembagas:jenjang,nama',
        ])->whereNotNull('user_id');

        // Filter lembaga topbar = cakupan akses akun (pivot user_lembaga).
        $lembaga = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($request->user(), $lembaga);
        if ($lembaga === [] && ! $request->user()->bolehPesantren()) {
            $lembaga = $request->user()->lembagaIds();
        }
        if ($lembaga !== []) {
            $query->whereHas('akun.lembagas', fn ($l) => $l->whereIn('lembaga.jenjang', $lembaga));
        }

        if ($request->filled('status_aktif')) {
            $query->where('pegawai.status_aktif', $request->input('status_aktif'));
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nipp', 'like', "%{$q}%")
                ->orWhere('email_pribadi', 'like', "%{$q}%")
                ->orWhere('no_hp', 'like', "%{$q}%")
                ->orWhereHas('akun', fn ($a) => $a
                    ->where('email', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('username', 'like', "%{$q}%")));
        }

        $this->terapkanUrut($query, $urut, [
            ['pegawai.nama_lengkap', 'naik'], ['pegawai.id', 'naik'],
        ], []);

        return response()->json($query->paginate($this->perPage($request)));
    }
}
