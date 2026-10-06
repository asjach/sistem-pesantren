<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\DokumenTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DokumenPotongRequest;
use App\Http\Requests\Admin\DokumenStatusBerkasRequest;
use App\Http\Requests\Admin\DokumenStoreRequest;
use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\ImportSesi;
use App\Models\Lembaga;
use App\Models\Pegawai;
use App\Models\Santri;
use App\Services\DokumenImporService;
use App\Services\Impor\DataDokumen;
use App\Support\NamaBerkasDokumen;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Tiga halaman dokumen (santri / pegawai-guru / lembaga) dalam satu controller:
 * pola identik, yang membedakan hanya tabel + identitas pemiliknya.
 * Unduh berkas = `Storage::download($path_file, basename($path_file))` —
 *  tampil & unduh memakai nama template; `nama_file` menyimpan nama asli
 *  pengunggah sebagai arsip.
 */
class DokumenController extends Controller
{
    use ImporBertahap;
    use TenantGuard;

    /** Konfigurasi per tipe: tabel (query builder), kolom jenis/pemilik, label. */
    private const TIPE = ['santri', 'pegawai', 'lembaga'];

    /** GET /api/admin/dokumen/{tipe} — daftar dokumen (filter lembaga + pencarian). */
    public function index(Request $request, string $tipe): JsonResponse
    {
        $this->cekTipe($tipe);
        $auth = $request->user();
        $lembaga = $this->selectedLembaga($request, $auth);
        $q = trim((string) $request->input('q', ''));
        $status = $request->input('status_verifikasi');

        if ($tipe === 'santri') {
            // Penempatan via whereExists (bukan join) agar santri dengan
            // lebih dari satu penempatan (mis. MI + MD) tidak duplikat.
            // Sengaja TANPA syarat aktif: lingkup lembaga memakai riwayat
            // penempatan, agar dokumen santri yang sudah pindah/keluar
            // tetap tampil di lembaga konteksnya.
            $penempatan = function ($w, array $jenjang = []) {
                $w->from('lembaga_santri as ls')
                    ->whereColumn('ls.santri_id', 'dokumen_santri.santri_id');
                if ($jenjang !== []) {
                    $w->whereIn('ls.jenjang', $jenjang);
                }

                return $w;
            };
            $query = DokumenSantri::query()
                ->whereNotNull('dokumen_santri.santri_id')
                ->select('dokumen_santri.*')
                ->join('santri', 'santri.id', '=', 'dokumen_santri.santri_id')
                ->with('santri:id,nama_lengkap')
                ->addSelect(DB::raw("(select ls.nis_lokal from lembaga_santri ls where ls.santri_id = dokumen_santri.santri_id order by ls.is_active_lembaga = 'Ya' desc, ls.id limit 1) as nis_lokal"))
                ->addSelect(DB::raw("(select ls.jenjang from lembaga_santri ls where ls.santri_id = dokumen_santri.santri_id order by ls.is_active_lembaga = 'Ya' desc, ls.id limit 1) as lembaga_jenjang"));
            if ($lembaga !== []) {
                $query->whereExists(fn ($w) => $penempatan($w, $lembaga));
            } elseif (! $auth->bolehPesantren()) {
                $ids = $auth->lembagaIdsDenganPasangan();
                $ids === [] ? $query->whereRaw('1 = 0') : $query->whereExists(fn ($w) => $penempatan($w, $ids));
            }
            if ($q !== '') {
                $query->where(fn ($w) => $w
                    ->where('santri.nama_lengkap', 'like', "%{$q}%")
                    ->orWhere('dokumen_santri.jenis_dokumen_santri', 'like', "%{$q}%")
                    ->orWhereExists(fn ($s) => $penempatan($s)->where('ls.nis_lokal', 'like', "%{$q}%")));
            }
            if ($request->filled('santri_id')) {
                $query->where('dokumen_santri.santri_id', (int) $request->input('santri_id'));
            }
            $this->tersierSort($query);
            $hasil = $query->orderBy('santri.nama_lengkap')->orderBy('dokumen_santri.id')
                ->paginate($this->perPage($request));
            $hasil->getCollection()->transform(fn ($r) => $this->tampahkanDokumen($r, 'santri'));

            return response()->json($hasil);
        }

        if ($tipe === 'pegawai') {
            // Penempatan aktif via whereExists agar pegawai di >1 lembaga tidak duplikat.
            $penempatanPeg = function ($w, array $jenjang = []) {
                $w->from('lembaga_pegawai as lp')
                    ->whereColumn('lp.pegawai_id', 'dokumen_pegawai.pegawai_id')
                    ->where('lp.is_active_lembaga', 'Ya');
                if ($jenjang !== []) {
                    $w->whereIn('lp.jenjang', $jenjang);
                }

                return $w;
            };
            $query = DB::table('dokumen_pegawai')
                ->join('pegawai', 'pegawai.id', '=', 'dokumen_pegawai.pegawai_id')
                ->select('dokumen_pegawai.*', 'pegawai.nama_lengkap', 'pegawai.nipp')
                ->addSelect(DB::raw("(select lp.jenjang from lembaga_pegawai lp where lp.pegawai_id = dokumen_pegawai.pegawai_id and lp.is_active_lembaga = 'Ya' order by lp.id limit 1) as lembaga_jenjang"));
            if ($lembaga !== []) {
                $query->whereExists(fn ($w) => $penempatanPeg($w, $lembaga));
            } elseif (! $auth->bolehPesantren()) {
                $ids = $auth->lembagaIdsDenganPasangan();
                $ids === [] ? $query->whereRaw('1 = 0') : $query->whereExists(fn ($w) => $penempatanPeg($w, $ids));
            }
            if ($q !== '') {
                $query->where(fn ($w) => $w
                    ->where('pegawai.nama_lengkap', 'like', "%{$q}%")
                    ->orWhere('dokumen_pegawai.jenis_dokumen_pegawai', 'like', "%{$q}%")
                    ->orWhere('pegawai.nipp', 'like', "%{$q}%"));
            }
            if ($request->filled('pegawai_id')) {
                $query->where('dokumen_pegawai.pegawai_id', (int) $request->input('pegawai_id'));
            }
            $hasil = $query->orderBy('pegawai.nama_lengkap')->orderBy('dokumen_pegawai.id')
                ->paginate($this->perPage($request));
            $hasil->getCollection()->transform(fn ($r) => $this->tampahkanDokumen($r, 'pegawai'));

            return response()->json($hasil);
        }

        // lembaga
        $query = DB::table('dokumen_lembaga')->join('lembaga', 'lembaga.jenjang', '=', 'dokumen_lembaga.jenjang')
            ->select('dokumen_lembaga.*', 'lembaga.nama as lembaga_nama');
        $this->scopeDokumen($query, $auth, $lembaga, 'dokumen_lembaga.jenjang');
        if ($q !== '') {
            $query->where(fn ($w) => $w
                ->where('dokumen_lembaga.jenis_dokumen', 'like', "%{$q}%")
                ->orWhere('lembaga.nama', 'like', "%{$q}%"));
        }
        if ($status) {
            $query->where('dokumen_lembaga.status_verifikasi', $status);
        }
        $hasil = $query->orderBy('dokumen_lembaga.jenjang')->orderBy('dokumen_lembaga.id')
            ->paginate($this->perPage($request));
        $hasil->getCollection()->transform(fn ($r) => $this->tampahkanDokumen($r, 'lembaga'));

        return response()->json($hasil);
    }

    /** POST /api/admin/dokumen/{tipe} — buat baris dokumen (opsional sekalian unggah berkas). */
    public function store(DokumenStoreRequest $request, string $tipe): JsonResponse
    {
        $this->cekTipe($tipe);
        $data = $request->validated();
        $this->cekLingkupDokumen($request, $tipe, $data);

        $row = DB::transaction(function () use ($request, $tipe, $data) {
            $berkas = $request->file('file');
            $tujuan = $data['tujuan'] ?? 'server';
            $arsipPerangkat = in_array($tujuan, ['lokal', 'test'], true);
            if ($arsipPerangkat && config('dokumen.mode') === 'server') {
                throw ValidationException::withMessages(['tujuan' => 'Mode server menolak penyimpanan lokal.']);
            }
            if ($arsipPerangkat && $berkas) {
                throw ValidationException::withMessages(['tujuan' => 'Pilih satu: berkas untuk server, tanpa berkas untuk lokal.']);
            }
            if ($arsipPerangkat && empty($data['ekstensi'])) {
                throw ValidationException::withMessages(['ekstensi' => 'Ekstensi wajib untuk simpanan lokal.']);
            }
            $namaPemilik = $this->namaPemilik($tipe, $data);
            $nama = $berkas
                ? basename($this->simpanBerkasTemplate(
                    $berkas, $tipe, $namaPemilik, $data['jenis_dokumen'], $data['catatan'] ?? null,
                ))
                : ($arsipPerangkat
                    ? NamaBerkasDokumen::buat($namaPemilik, $data['jenis_dokumen'], $data['catatan'] ?? null, $data['ekstensi'])
                    : null);

            if ($tipe === 'santri') {
                $dok = DokumenSantri::create([
                    'santri_id' => $data['santri_id'],
                    'jenis_dokumen_santri' => $data['jenis_dokumen'],
                    'lembaga' => $data['lembaga'] ?? null,
                    'nama_file' => $nama,
                    'penyimpanan' => $tujuan,
                    'catatan' => $data['catatan'] ?? null,
                ]);
                // Satu aktif per kunci: baris baru yang terakhir.
                DokumenSantri::where('santri_id', $dok->santri_id)
                    ->where('jenis_dokumen_santri', $dok->jenis_dokumen_santri)
                    ->where('lembaga', $dok->lembaga)
                    ->where('id', '!=', $dok->id)
                    ->update(['is_active' => false]);

                return $dok;
            }

            if ($tipe === 'pegawai') {
                $id = DB::table('dokumen_pegawai')->insertGetId([
                    'pegawai_id' => $data['pegawai_id'],
                    'jenis_dokumen_pegawai' => $data['jenis_dokumen'],
                    'nama_file' => $nama,
                    'penyimpanan' => $tujuan,
                    'catatan' => $data['catatan'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                // Satu aktif per kunci (pegawai, jenis, nama_file): baris baru
                // yang terakhir; berkas sejenis lain tidak tersentuh.
                DB::table('dokumen_pegawai')
                    ->where('pegawai_id', $data['pegawai_id'])
                    ->where('jenis_dokumen_pegawai', $data['jenis_dokumen'])
                    ->where('nama_file', $nama)
                    ->where('id', '!=', $id)
                    ->update(['is_active' => false]);

                return $this->barisPegawaiSegar($id);
            }

            return DokumenLembaga::create([
                'jenjang' => $data['jenjang'],
                'jenis_dokumen' => $data['jenis_dokumen'],
                'nama_file' => $nama,
                'penyimpanan' => $tujuan,
                'status_verifikasi' => $data['status_verifikasi'] ?? 'menunggu',
                'catatan' => $data['catatan'] ?? null,
            ]);
        });

        return response()->json(['pesan' => 'Dokumen disimpan.', 'data' => $row], 201);
    }

    /** PATCH /api/admin/dokumen/{tipe}/{id} — ubah jenis/status/catatan (berkas via upload terpisah). */
    public function update(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);
        $data = $request->validate([
            'jenis_dokumen' => ['sometimes', 'string', 'max:100'],
            // Kolom status hanya tersisa di tabel lembaga.
            'status_verifikasi' => $tipe === 'lembaga' ? ['sometimes', 'in:menunggu,valid,ditolak'] : ['prohibited'],
            // Konteks lembaga pemakaian hanya ada di tabel santri; penanda
            // aktif ada di tabel santri & pegawai.
            'lembaga' => $tipe === 'santri' ? ['sometimes', 'nullable', 'string', 'exists:lembaga,jenjang'] : ['prohibited'],
            'is_active' => in_array($tipe, ['santri', 'pegawai'], true) ? ['sometimes', 'boolean'] : ['prohibited'],
            // Nama berkas hasil tulis arsip perangkat (disanitasi
            // basename; byte ditulis langsung oleh aplikasi desktop).
            'nama_file' => ['sometimes', 'string', 'max:255'],
            // Lokasi byte (edit data langsung; tanpa memindah berkas).
            'penyimpanan' => ['sometimes', 'in:server,lokal,test'],
            'catatan' => ['sometimes', 'nullable', 'string'],
            // `true` = pemanggil menjamin byte ikut dipindah (server: backend
            // di bawah; arsip perangkat: aplikasi desktop asal). Tanpa ini
            // nama berkas tidak diubah agar DB tak beda dari fisik.
            'selaraskan_nama' => ['sometimes', 'boolean'],
        ]);

        $kolomJenis = $tipe === 'santri' ? 'jenis_dokumen_santri' : ($tipe === 'pegawai' ? 'jenis_dokumen_pegawai' : 'jenis_dokumen');
        $ubah = [];
        if (isset($data['jenis_dokumen'])) {
            $ubah[$kolomJenis] = $data['jenis_dokumen'];
        }
        if (isset($data['status_verifikasi']) && $tipe === 'lembaga') {
            $ubah['status_verifikasi'] = $data['status_verifikasi'];
        }
        if ($tipe === 'santri' && array_key_exists('lembaga', $data)) {
            $ubah['lembaga'] = $data['lembaga'];
        }
        if (in_array($tipe, ['santri', 'pegawai'], true) && array_key_exists('is_active', $data)) {
            $ubah['is_active'] = $data['is_active'];
        }
        if (array_key_exists('penyimpanan', $data)) {
            $ubah['penyimpanan'] = $data['penyimpanan'];
        }
        if (isset($data['nama_file'])) {
            $bersih = basename(trim($data['nama_file']));
            $ubah['nama_file'] = $bersih !== '' ? $bersih : null;
        }
        if ($tipe === 'santri' && isset($data['nama_file'])) {
            $ubah['nama_file'] = basename(trim($data['nama_file'])) ?: null;
        }
        if (array_key_exists('catatan', $data)) {
            $ubah['catatan'] = $data['catatan'];
        }

        // Jenis/catatan adalah segmen template nama — bila berubah dan
        // pemanggil menjamin byte ikut pindah, susun ulang nama berkas.
        $jenisEfektif = $data['jenis_dokumen'] ?? $model->{$kolomJenis};
        $catatanEfektif = array_key_exists('catatan', $data) ? $data['catatan'] : $model->catatan;
        $namaLama = $model->nama_file ?? null;
        if (
            $request->boolean('selaraskan_nama')
            && is_string($namaLama) && $namaLama !== ''
            && ($jenisEfektif !== $model->{$kolomJenis} || $catatanEfektif !== $model->catatan)
        ) {
            $namaPemilik = match ($tipe) {
                'santri' => (string) ($model->santri?->nama_lengkap ?? 'santri-'.$model->santri_id),
                'pegawai' => (string) (Pegawai::find($model->pegawai_id)?->nama_lengkap ?? 'pegawai-'.$model->pegawai_id),
                default => (string) (Lembaga::where('jenjang', $model->jenjang)->value('nama') ?? $model->jenjang),
            };
            $titik = strrpos($namaLama, '.');
            $ekstensi = $titik === false ? 'pdf' : substr($namaLama, $titik + 1);
            $namaBaru = NamaBerkasDokumen::buat($namaPemilik, (string) $jenisEfektif, $catatanEfektif, $ekstensi);
            // Baris cermin ikut rename sisi server; pemanggil (desktop)
            // me-rename sisi lokal dari nama_baru di respons.
            if (in_array($model->penyimpanan ?? 'server', ['server', 'cermin'], true)) {
                $direktori = $this->direktoriBerkas($tipe);
                $namaBaru = NamaBerkasDokumen::unik('local', $direktori, $namaBaru, $namaLama);
                $jalurLama = NamaBerkasDokumen::jalur($tipe, $namaLama);
                if ($jalurLama && Storage::disk('local')->exists($jalurLama)) {
                    Storage::disk('local')->move($jalurLama, "{$direktori}/{$namaBaru}");
                }
            }
            $ubah['nama_file'] = $namaBaru;
        }

        if ($model instanceof Model) {
            $model->update($ubah);
            // Invarian satu aktif per kunci: baris aktif menonaktifkan
            // saudara se-kunci (mencakup pindah jenis/lembaga).
            if ($tipe === 'santri' && (bool) $model->is_active) {
                DokumenSantri::where('santri_id', $model->santri_id)
                    ->where('jenis_dokumen_santri', $model->jenis_dokumen_santri)
                    ->where('lembaga', $model->lembaga)
                    ->where('id', '!=', $model->id)
                    ->update(['is_active' => false]);
            }

            return response()->json(['pesan' => 'Dokumen diubah.', 'data' => $model->fresh()]);
        }

        // stdClass (tabel pegawai tanpa model).
        $ubah['updated_at'] = now();
        DB::table('dokumen_pegawai')->where('id', $id)->update($ubah);
        // Invarian satu aktif per kunci (pegawai, jenis, nama_file) — cermin santri.
        if ((bool) ($ubah['is_active'] ?? false)) {
            $segar = $this->barisPegawaiSegar($id);
            DB::table('dokumen_pegawai')
                ->where('pegawai_id', $segar->pegawai_id)
                ->where('jenis_dokumen_pegawai', $segar->jenis_dokumen_pegawai)
                ->where('nama_file', $segar->nama_file)
                ->where('id', '!=', $id)
                ->update(['is_active' => false]);
        }

        return response()->json(['pesan' => 'Dokumen diubah.', 'data' => $this->barisPegawaiSegar($id)]);
    }

    /** POST /api/admin/dokumen/{tipe}/{id}/unggah — unggah/ganti berkas pada baris (isi checklist). */
    public function unggah(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);
        $request->validate(['file' => $tipe === 'pegawai'
            ? ['required', 'file', 'max:10240']
            : ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240']]);

        $berkas = $request->file('file');
        $nama = match ($tipe) {
            'santri' => $model->santri?->nama_lengkap ?? 'santri-'.$model->santri_id,
            'pegawai' => Pegawai::find($model->pegawai_id)?->nama_lengkap ?? 'pegawai-'.$model->pegawai_id,
            default => Lembaga::where('jenjang', $model->jenjang)->value('nama') ?? $model->jenjang,
        };
        $jenis = $tipe === 'santri' ? $model->jenis_dokumen_santri : ($tipe === 'pegawai' ? $model->jenis_dokumen_pegawai : $model->jenis_dokumen);
        $path = $this->simpanBerkasTemplate($berkas, $tipe, (string) $nama, (string) $jenis, $model->catatan ?? null);
        // Byte kini di server — baris arsip perangkat ikut pindah ke server.
        $ubah = ['nama_file' => basename($path), 'penyimpanan' => 'server'];

        if ($model instanceof Model) {
            // Berkas lama dibuang agar storage tak menumpuk (lokasi dari nama).
            $lama = NamaBerkasDokumen::jalur($tipe, $model->nama_file ?? null);
            if ($lama) {
                Storage::disk('local')->delete($lama);
            }
            $model->update($ubah);

            return response()->json(['pesan' => 'Berkas diunggah.', 'data' => $model->fresh()]);
        }

        $lama = DB::table('dokumen_pegawai')->find($id);
        $jalurLama = NamaBerkasDokumen::jalur($tipe, $lama->nama_file ?? null);
        if ($jalurLama) {
            Storage::disk('local')->delete($jalurLama);
        }
        $ubah['updated_at'] = now();
        DB::table('dokumen_pegawai')->where('id', $id)->update($ubah);

        return response()->json(['pesan' => 'Berkas diunggah.', 'data' => $this->barisPegawaiSegar($id)]);
    }

    /** DELETE /api/admin/dokumen/{tipe}/{id} — hapus baris + berkas fisiknya. */
    public function destroy(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);

        $path = NamaBerkasDokumen::jalur($tipe, $model->nama_file ?? null);
        if ($model instanceof Model) {
            $model->delete();
        } else {
            DB::table('dokumen_pegawai')->where('id', $id)->delete();
        }
        if ($path) {
            Storage::disk('local')->delete($path);
        }

        return response()->json(['pesan' => 'Dokumen dihapus.']);
    }

    /** GET /api/admin/dokumen/{tipe}/unduh — unduh berkas (nama template). */
    public function unduh(Request $request, string $tipe, int $id): BinaryFileResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);

        $path = NamaBerkasDokumen::jalur($tipe, $model->nama_file ?? null);
        if ($path === null || ! Storage::disk('local')->exists($path)) {
            $lokasi = $model->penyimpanan ?? 'server';
            abort(404, in_array($lokasi, ['server', 'cermin'], true)
                ? 'Berkas tidak ditemukan.'
                : 'Berkas tersimpan di arsip perangkat, bukan di server.');
        }
        $disk = Storage::disk('local');

        return response()->download(
            $disk->path($path),
            basename($path),
        );
    }

    /** GET /api/admin/dokumen/{tipe}/status-berkas — status byte server per
     *  nama (batch ≤100, sinkronus tanpa antrean untuk shared hosting). */
    public function statusBerkas(DokumenStatusBerkasRequest $request, string $tipe): JsonResponse
    {
        $this->cekTipe($tipe);
        $data = $request->validated();

        $disk = Storage::disk('local');
        $hasil = [];
        foreach ($data['nama'] as $mentah) {
            $nama = basename(trim((string) $mentah));
            if ($nama === '') {
                continue;
            }
            $path = NamaBerkasDokumen::jalur($tipe, $nama);
            if ($path === null || ! $disk->exists($path)) {
                $hasil[$nama] = ['ada' => false];

                continue;
            }
            $hasil[$nama] = [
                'ada' => true,
                'ukuran' => $disk->size($path),
                'mtime' => $disk->lastModified($path),
                'md5' => md5_file($disk->path($path)),
                // SHA-256 untuk klien (Web Crypto tidak menyediakan MD5).
                'sha256' => hash_file('sha256', $disk->path($path)),
            ];
        }

        return response()->json(['data' => $hasil]);
    }

    /** POST /api/admin/dokumen/{tipe}/{id}/sinkron-unggah — terima byte lokal
     *  TANPA ganti nama (identitas cermin = nama_file sama di kedua sisi).
     *  Hash diklaim pemanggil diverifikasi ulang; beda = transfer rusak. */
    public function sinkronUnggah(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);
        $data = $request->validate([
            'file' => $tipe === 'pegawai'
                ? ['required', 'file', 'max:10240']
                : ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
            'hash' => ['required', 'string', 'regex:/^[a-f0-9]{32}([a-f0-9]{32})?$/i'],
            'mtime' => ['required', 'integer', 'min:0'],
        ]);

        $nama = basename((string) ($model->nama_file ?? ''));
        if ($nama === '') {
            abort(422, 'Baris tanpa nama_file tidak bisa disinkron.');
        }
        $path = $data['file']->storeAs($this->direktoriBerkas($tipe), $nama, 'local');
        // Verifikasi integritas dengan algoritma sesuai panjang hash yang
        // diklaim (32 = md5, 64 = sha256; klien Web Crypto hanya punya sha256).
        $penuh = Storage::disk('local')->path($path);
        $klaim = strtolower($data['hash']);
        $cocok = $klaim === strtolower((string) (strlen($klaim) === 64 ? hash_file('sha256', $penuh) : md5_file($penuh)));
        if (! $cocok) {
            Storage::disk('local')->delete($path);
            throw ValidationException::withMessages(['file' => 'Berkas rusak saat transfer (hash beda); ulangi.']);
        }

        return response()->json([
            'pesan' => 'Berkas tersinkron ke server.',
            'data' => $this->tandaiSinkronModel($tipe, $id, $model, strtolower((string) hash_file('sha256', $penuh))),
        ]);
    }

    /** PATCH /api/admin/dokumen/{tipe}/{id}/tandai-sinkron — catat sisi lokal
     *  sudah sama (pemanggil menjamin byte sudah tertulis di perangkat). */
    public function tandaiSinkron(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);
        $data = $request->validate([
            'hash' => ['required', 'string', 'regex:/^[a-f0-9]{32}([a-f0-9]{32})?$/i'],
        ]);

        return response()->json([
            'pesan' => 'Sinkron dicatat.',
            'data' => $this->tandaiSinkronModel($tipe, $id, $model, strtolower($data['hash'])),
        ]);
    }

    /** GET /api/admin/dokumen/{tipe}/import-template — template Excel per tipe. */
    public function templateImport(string $tipe)
    {
        $this->cekTipe($tipe);

        return Excel::download(
            new DokumenTemplateExport($tipe),
            "template-import-dokumen-{$tipe}.xlsx",
        );
    }

    /** GET /api/admin/dokumen/{tipe}/data-existing — data dokumen existing
     *  sebagai JSON (kolom = template import). Berkas Excel disusun di browser. */
    public function dataExisting(Request $request, string $tipe): JsonResponse
    {
        $this->cekTipe($tipe);
        $data = new DataDokumen($tipe, $this->jenjangUntukBerkas($request));

        return response()->json([
            'kolom' => $data->kolom(),
            'wajib' => $data->wajib(),
            'baris' => $data->baris(),
        ]);
    }

    /** POST /api/admin/dokumen/{tipe}/import-potong — potongan JSON 1000 baris. */
    public function potongImport(DokumenPotongRequest $request, DokumenImporService $layanan): JsonResponse
    {
        $tipe = $request->tipe();

        return $this->jalankanImporSesi($request, "dokumen_{$tipe}", $layanan->setTipe($tipe));
    }

    /** POST /api/admin/dokumen/{tipe}/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, string $tipe, ImportSesi $sesi): JsonResponse
    {
        $this->cekTipe($tipe);

        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/dokumen/{tipe}/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, string $tipe, ImportSesi $sesi)
    {
        $this->cekTipe($tipe);

        return $this->unduhGalatImpor($request, $sesi, "galat-import-dokumen-{$tipe}.csv");
    }

    // ---------------- Helper internal ----------------

    private function cekTipe(string $tipe): void
    {
        if (! in_array($tipe, self::TIPE, true)) {
            abort(404);
        }
    }

    /** Direktori storage per tipe (sumber tunggal: helper penamaan). */
    private function direktoriBerkas(string $tipe): string
    {
        return NamaBerkasDokumen::direktori($tipe);
    }

    /** Tandai baris tersinkron (cermin): hash + waktu; kembalikan baris segar. */
    private function tandaiSinkronModel(string $tipe, int $id, object $model, string $hash): object
    {
        $tandai = ['penyimpanan' => 'cermin', 'sinkron_hash' => $hash, 'tersinkron_pada' => now()];
        if ($model instanceof Model) {
            $model->update($tandai);

            return $model->fresh();
        }

        // stdClass (tabel pegawai tanpa model).
        $tandai['updated_at'] = now();
        DB::table('dokumen_pegawai')->where('id', $id)->update($tandai);

        return $this->barisPegawaiSegar($id);
    }

    /** Simpan berkas memakai template nama; kembalikan path relatif storage. */
    private function simpanBerkasTemplate(UploadedFile $berkas, string $tipe, string $nama, string $jenis, ?string $catatan): string
    {
        return NamaBerkasDokumen::simpan($berkas, 'local', $this->direktoriBerkas($tipe), $nama, $jenis, $catatan);
    }

    /** Nama pemilik untuk segmen template (fallback id bila relasi hilang). */
    private function namaPemilik(string $tipe, array $data): string
    {
        return match ($tipe) {
            'santri' => (string) (Santri::find($data['santri_id'])?->nama_lengkap ?? 'santri-'.$data['santri_id']),
            'pegawai' => (string) (Pegawai::find($data['pegawai_id'])?->nama_lengkap ?? 'pegawai-'.$data['pegawai_id']),
            default => (string) (Lembaga::where('jenjang', $data['jenjang'])->value('nama') ?? $data['jenjang']),
        };
    }

    /** Cakupan lembaga dokumen: wajib satu filter lembaga (semua baris milik lembaga). */
    private function scopeDokumen($query, $auth, array $lembaga, string $kolom): void
    {
        if ($lembaga !== []) {
            $query->whereIn($kolom, $lembaga);
        } elseif (! $auth->bolehPesantren()) {
            $ids = $auth->lembagaIdsDenganPasangan();
            empty($ids) ? $query->whereRaw('1 = 0') : $query->whereIn($kolom, $ids);
        }
    }

    private function tersierSort($query): void
    {
        // (placeholder — urutan utama ditetapkan di index)
    }

    /** Tambahkan field tampilan seragam (jenis, pemilik, unduh_url). */
    private function tampahkanDokumen($r, string $tipe)
    {
        $jenis = $tipe === 'santri' ? ($r->jenis_dokumen_santri ?? null)
            : ($tipe === 'pegawai' ? ($r->jenis_dokumen_pegawai ?? null) : ($r->jenis_dokumen ?? null));
        $r->jenis_dokumen = $jenis;
        $r->tipe = $tipe;
        // Kontrak API: is_active boolean (baris pegawai stdClass mentahnya 0/1).
        if (property_exists($r, 'is_active')) {
            $r->is_active = (bool) $r->is_active;
        }
        $r->unduh_url = "/api/admin/dokumen/{$tipe}/".($r->id ?? '').'/unduh';
        if ($tipe === 'santri') {
            $r->pemilik = $r->santri?->nama_lengkap ?? null;
            $r->nis_lokal = $r->nis_lokal ?? null;
        } elseif ($tipe === 'pegawai') {
            $r->pemilik = $r->nama_lengkap ?? null;
        } else {
            $r->pemilik = $r->lembaga_nama ?? null;
        }

        return $r;
    }

    /** Cek lingkup lembaga untuk payload store (bentuk sudah divalidasi FormRequest). */
    private function cekLingkupDokumen(Request $request, string $tipe, array $data): void
    {
        // Cakupan lembaga: pemilik harus milik lembaga yang boleh diakses.
        $auth = $request->user();
        if ($tipe === 'santri') {
            $jenjang = Santri::find($data['santri_id'])?->lembagaAktif()->value('jenjang');
            if ($jenjang !== null && ! $auth->canAccessLembaga($jenjang)) {
                throw ValidationException::withMessages(['santri_id' => 'Santri di luar lingkup akses Anda.']);
            }
        } elseif ($tipe === 'pegawai') {
            if (! $auth->canAccessLembaga($data['jenjang'])) {
                throw ValidationException::withMessages(['jenjang' => 'Lembaga di luar lingkup akses Anda.']);
            }
            $penempatan = DB::table('lembaga_pegawai')
                ->where('pegawai_id', $data['pegawai_id'])
                ->where('jenjang', $data['jenjang'])
                ->exists();
            if (! $penempatan) {
                throw ValidationException::withMessages(['pegawai_id' => 'Pegawai tidak ditempatkan di lembaga ini.']);
            }
        } elseif (! $auth->canAccessLembaga($data['jenjang'])) {
            throw ValidationException::withMessages(['jenjang' => 'Lembaga di luar lingkup akses Anda.']);
        }
    }

    /** Baris pegawai segar dengan is_active boolean (kontrak API). */
    private function barisPegawaiSegar(int $id): ?object
    {
        $row = DB::table('dokumen_pegawai')->find($id);
        if ($row) {
            $row->is_active = (bool) $row->is_active;
        }

        return $row;
    }

    /** Temukan baris dokumen milik $id (Eloquent model untuk santri/lembaga; stdClass untuk pegawai). */
    private function temukan(string $tipe, int $id, Request $request): object
    {
        if ($tipe === 'santri') {
            $row = DokumenSantri::with('santri:id,nama_lengkap')->findOrFail($id);
            if ($row->santri_id === null) {
                abort(404);
            }
            // Akses mengikuti konteks lembaga baris dulu (selaras lingkup
            // daftar yang memakai riwayat penempatan), baru penempatan aktif.
            $jenjang = $row->lembaga ?? $row->santri->lembagaAktif()->value('jenjang');
            if ($jenjang !== null && ! $request->user()->canAccessLembaga($jenjang)) {
                abort(403, 'Akses ditolak.');
            }

            return $row;
        }

        if ($tipe === 'pegawai') {
            $row = DB::table('dokumen_pegawai')->find($id);
            if (! $row) {
                abort(404);
            }
            $jenjang = DB::table('lembaga_pegawai')->where('pegawai_id', $row->pegawai_id)->value('jenjang');
            if ($jenjang !== null && ! $request->user()->canAccessLembaga($jenjang)) {
                abort(403, 'Akses ditolak.');
            }

            return $row;
        }

        $row = DokumenLembaga::findOrFail($id);
        if (! $request->user()->canAccessLembaga($row->jenjang)) {
            abort(403, 'Akses ditolak.');
        }

        return $row;
    }
}
