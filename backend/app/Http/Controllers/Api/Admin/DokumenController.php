<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\DokumenTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DokumenPotongRequest;
use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\ImportSesi;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
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
            // Penempatan aktif via whereExists (bukan join) agar santri dengan
            // lebih dari satu penempatan aktif (mis. MI + MD) tidak duplikat.
            $penempatan = function ($w, array $jenjang = []) {
                $w->from('lembaga_santri as ls')
                    ->whereColumn('ls.santri_id', 'dokumen_santri.santri_id')
                    ->where('ls.is_active_lembaga', LembagaSantri::YA);
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
                ->addSelect(DB::raw("(select ls.nis_lokal from lembaga_santri ls where ls.santri_id = dokumen_santri.santri_id and ls.is_active_lembaga = 'Ya' order by ls.id limit 1) as nis_lokal"))
                ->addSelect(DB::raw("(select ls.jenjang from lembaga_santri ls where ls.santri_id = dokumen_santri.santri_id and ls.is_active_lembaga = 'Ya' order by ls.id limit 1) as lembaga_jenjang"));
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
            if ($status) {
                $query->where('dokumen_pegawai.status_verifikasi', $status);
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
    public function store(Request $request, string $tipe): JsonResponse
    {
        $this->cekTipe($tipe);
        $data = $this->validasi($request, $tipe);

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
                return DokumenSantri::create([
                    'santri_id' => $data['santri_id'],
                    'jenis_dokumen_santri' => $data['jenis_dokumen'],
                    'nama_file' => $nama,
                    'penyimpanan' => $tujuan,
                    'catatan' => $data['catatan'] ?? null,
                ]);
            }

            if ($tipe === 'pegawai') {
                $id = DB::table('dokumen_pegawai')->insertGetId([
                    'pegawai_id' => $data['pegawai_id'],
                    'jenis_dokumen_pegawai' => $data['jenis_dokumen'],
                    'nama_file' => $nama,
                    'penyimpanan' => $tujuan,
                    'status_verifikasi' => $data['status_verifikasi'] ?? 'menunggu',
                    'catatan' => $data['catatan'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $row = DB::table('dokumen_pegawai')->find($id);
                $row->id = $row->id;

                return $row;
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
            // Kolom status hanya ada di tabel pegawai/lembaga.
            'status_verifikasi' => $tipe === 'santri' ? ['prohibited'] : ['sometimes', 'in:menunggu,valid,ditolak'],
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
        if (isset($data['status_verifikasi']) && $tipe !== 'santri') {
            $ubah['status_verifikasi'] = $data['status_verifikasi'];
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
            if (($model->penyimpanan ?? 'server') === 'server') {
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

            return response()->json(['pesan' => 'Dokumen diubah.', 'data' => $model->fresh()]);
        }

        // stdClass (tabel pegawai tanpa model).
        $ubah['updated_at'] = now();
        DB::table('dokumen_pegawai')->where('id', $id)->update($ubah);

        return response()->json(['pesan' => 'Dokumen diubah.', 'data' => DB::table('dokumen_pegawai')->find($id)]);
    }

    /** POST /api/admin/dokumen/{tipe}/{id}/unggah — unggah/ganti berkas pada baris (isi checklist). */
    public function unggah(Request $request, string $tipe, int $id): JsonResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);
        $request->validate(['file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240']]);

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

        return response()->json(['pesan' => 'Berkas diunggah.', 'data' => DB::table('dokumen_pegawai')->find($id)]);
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

    /** GET /api/admin/dokumen/{tipe}/{id}/unduh — unduh berkas (nama template). */
    public function unduh(Request $request, string $tipe, int $id): BinaryFileResponse
    {
        $this->cekTipe($tipe);
        $model = $this->temukan($tipe, $id, $request);

        $path = NamaBerkasDokumen::jalur($tipe, $model->nama_file ?? null);
        if ($path === null || ! Storage::disk('local')->exists($path)) {
            $lokasi = $model->penyimpanan ?? 'server';
            abort(404, $lokasi === 'server'
                ? 'Berkas tidak ditemukan.'
                : 'Berkas tersimpan di arsip perangkat, bukan di server.');
        }
        $disk = Storage::disk('local');

        return response()->download(
            $disk->path($path),
            basename($path),
        );
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

    /** Validasi store per tipe (pemilik wajib sesuai tipe; lingkup lembaga dicek). */
    private function validasi(Request $request, string $tipe): array
    {
        $aturanPemilik = match ($tipe) {
            'santri' => ['required', 'integer', 'exists:santri,id'],
            'pegawai' => ['required', 'integer', 'exists:pegawai,id'],
            'lembaga' => ['required', 'string', 'exists:lembaga,jenjang'],
        };

        $data = $request->validate([
            'santri_id' => $tipe === 'santri' ? $aturanPemilik : ['prohibited'],
            'pegawai_id' => $tipe === 'pegawai' ? $aturanPemilik : ['prohibited'],
            'jenjang' => $tipe === 'lembaga' ? $aturanPemilik : ($tipe === 'pegawai' ? ['required', 'string', 'exists:lembaga,jenjang'] : ['nullable', 'string']),
            'jenis_dokumen' => ['required', 'string', 'max:100'],
            // Kolom status hanya ada di tabel pegawai/lembaga.
            'status_verifikasi' => $tipe === 'santri' ? ['prohibited'] : ['sometimes', 'in:menunggu,valid,ditolak'],
            'catatan' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
            // Simpanan lokal/test (dev): tanpa byte, nama dicadangkan untuk arsip perangkat.
            'tujuan' => ['sometimes', 'in:server,lokal,test'],
            'ekstensi' => ['sometimes', 'nullable', 'string', 'regex:/^[a-z0-9]{2,5}$/'],
        ]);

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

        return $data;
    }

    /** Temukan baris dokumen milik $id (Eloquent model untuk santri/lembaga; stdClass untuk pegawai). */
    private function temukan(string $tipe, int $id, Request $request): object
    {
        if ($tipe === 'santri') {
            $row = DokumenSantri::with('santri:id,nama_lengkap')->findOrFail($id);
            if ($row->santri_id === null) {
                abort(404);
            }
            $jenjang = $row->santri->lembagaAktif()->value('jenjang');
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
