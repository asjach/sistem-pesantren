<?php

namespace App\Http\Controllers\Api;

use App\Exports\PsbTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\PsbDaftarRequest;
use App\Http\Requests\PsbSeleksiRequest;
use App\Imports\PsbImport;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use App\Models\User;
use App\Services\KeuanganService;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException as ExcelValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PsbController extends Controller
{
    use TenantGuard;

    /** GET /api/psb/antrean-daftar-ulang?status=ajukan_daftar_ulang (scope tenant).
     *  `status` boleh beberapa dipisah koma (dipakai tahapan timeline FE). */
    public function antrean(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'ajukan_daftar_ulang');
        $statuses = array_values(array_filter(array_map('trim', explode(',', $status))));

        $base = $this->scopeLembagaRelasi(PsbCalonSantri::query(), $request->user(), $request);

        // Jumlah per status (tanpa filter status) untuk badge tahapan timeline.
        $badge = (clone $base)
            ->selectRaw('status_pendaftaran, COUNT(*) as jumlah')
            ->groupBy('status_pendaftaran')
            ->pluck('jumlah', 'status_pendaftaran');

        $query = (clone $base)
            ->whereIn('status_pendaftaran', $statuses)
            ->with(['lembagaTujuan:id,nama,kode', 'lembagaDetail.lembaga:id,nama,kode', 'gelombang:id,nama'])
            ->latest('id');
        if ($request->boolean('terhapus')) {
            $query->onlyTrashed();
        }

        $page = $query->paginate($this->perPage($request));

        // Tandai kebutuhan seleksi per calon (mengikuti kuota lembaga primer + tipe santri).
        $items = collect($page->items());
        $kuota = PsbKuotaBiaya::with('lembaga:id,is_seleksi')
            ->whereIn('gelombang_id', $items->pluck('gelombang_id')->unique()->filter())
            ->whereIn('lembaga_id', $items->pluck('lembaga_id')->unique()->filter())
            ->get();
        $page->getCollection()->transform(function (PsbCalonSantri $calon) use ($kuota) {
            $cocok = fn (PsbKuotaBiaya $r) => (int) $r->gelombang_id === (int) $calon->gelombang_id
                && (int) $r->lembaga_id === (int) $calon->lembaga_id;
            $baris = $kuota->first(fn (PsbKuotaBiaya $r) => $cocok($r) && $r->tipe_santri === ($calon->tipe_santri ?? 'semua'))
                ?? $kuota->first(fn (PsbKuotaBiaya $r) => $cocok($r) && $r->tipe_santri === 'semua');

            return array_merge($calon->toArray(), [
                'butuh_seleksi' => $baris ? $baris->butuhSeleksi() : false,
                'butuh_pemberkasan' => $baris ? (bool) $baris->membutuhkan_pemberkasan : false,
            ]);
        });

        return response()->json([
            'pesan' => 'Antrean berhasil dimuat.',
            'data' => $page,
            'badge' => $badge,
        ]);
    }

    /** Aksi per calon: admin salah satu lembaga tujuan (paket: MI atau MD), admin full, atau super_admin. */
    protected function authorizeCalon(User $auth, PsbCalonSantri $calon): void
    {
        if ($auth->bolehPesantren()) {
            return;
        }
        $ids = $calon->lembagaDetail()->pluck('lembaga_id');
        if ($ids->isEmpty()) {
            $ids = collect([$calon->lembaga_id]);
        }
        if (! $ids->contains(fn ($id) => $auth->canAccessLembaga((int) $id))) {
            abort(403, 'Akses ditolak.');
        }
    }

    /** POST /api/psb/{calon}/verifikasi — baru -> terverifikasi. */
    public function verifikasi(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);

        return response()->json([
            'pesan' => 'Calon terverifikasi.',
            'data' => $service->verifikasi($calon->id, auth()->id()),
        ]);
    }

    /** POST /api/psb/{calon}/seleksi — -> lolos/tidak_lolos (jalur langsung ditolak service). */
    public function seleksi(PsbSeleksiRequest $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Hasil seleksi disimpan.',
            'data' => $service->setSeleksi($calon->id, (bool) $data['lolos'], auth()->id(), $data['catatan'] ?? null),
        ]);
    }

    /** POST /api/psb/{calon}/undur-diri — pengunduran diri (terdaftar/daftar ulang/diterima). */
    public function undurDiri(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $data = $request->validate(['catatan' => ['nullable', 'string']]);

        return response()->json([
            'pesan' => 'Pengunduran diri dicatat.',
            'data' => $service->undurDiri($calon->id, auth()->id(), $data['catatan'] ?? null),
        ]);
    }

    /** POST /api/psb/{calon}/batalkan-fase — kembali ke fase sebelumnya (log terakhir). */
    public function batalkanFase(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $data = $request->validate(['catatan' => ['nullable', 'string']]);

        $hasil = $service->batalkanFase($calon->id, auth()->id(), $data['catatan'] ?? null);

        return response()->json([
            'pesan' => 'Fase dibatalkan (kembali ke fase sebelumnya).',
            'data' => $hasil,
        ]);
    }

    /** POST /api/psb/{calon}/daftar-ulang — masuk fase daftar ulang (lembaga ber-seleksi wajib kirim lolos). */
    public function daftarUlang(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $data = $request->validate([
            'lolos' => ['nullable', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ]);

        $hasil = $service->masukDaftarUlang(
            $calon->id,
            auth()->id(),
            array_key_exists('lolos', $data) ? (bool) $data['lolos'] : null,
            $data['catatan'] ?? null,
        );

        return response()->json([
            'pesan' => $hasil->status_pendaftaran === 'tidak_lolos'
                ? 'Calon tidak lolos seleksi.'
                : 'Calon masuk fase daftar ulang.',
            'data' => $hasil,
        ]);
    }

    /** POST /api/psb/{calon}/acc-daftar-ulang — INSERT santri (atau reuse santri_asal_id). */
    public function acc(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $data = $request->validate(['nis' => ['nullable', 'string', 'max:20']]);

        return response()->json([
            'pesan' => 'Daftar ulang disetujui.',
            'data' => $service->accDaftarUlang($calon->id, auth()->id(), $data['nis'] ?? null),
        ], 201);
    }

    /** POST /api/psb/{calon}/promosi — waiting_list -> baru (kuota dicek service). */
    public function promosi(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);

        return response()->json([
            'pesan' => 'Calon dipromosikan dari waiting list.',
            'data' => $service->promosikanWaiting($calon->id, auth()->id()),
        ]);
    }

    /** DELETE /api/psb/{calon} — soft delete calon (tagihan belum bayar dibatalkan). */
    public function destroy(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeCalon(auth()->user(), $calon);
        $service->hapusCalon($calon->id, auth()->id());

        return response()->json(['pesan' => 'Calon dihapus.']);
    }

    /** POST /api/psb/{calon}/pulihkan — restore calon ter-soft delete + aktifkan tagihan kembali. */
    public function pulihkan(int $id, PsbService $service): JsonResponse
    {
        $calon = PsbCalonSantri::withTrashed()->findOrFail($id);
        $this->authorizeCalon(auth()->user(), $calon);

        return response()->json([
            'pesan' => 'Calon dipulihkan.',
            'data' => $service->pulihkanCalon($calon->id, auth()->id()),
        ]);
    }

    /** POST /api/psb/bulk/verifikasi */
    public function bulkVerifikasi(Request $request, PsbService $service): JsonResponse
    {
        $data = $this->validasiBulkIds($request);

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service) {
            $service->verifikasi($calon->id, auth()->id());
        });
    }

    /** POST /api/psb/bulk/seleksi */
    public function bulkSeleksi(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate(array_merge($this->aturanBulkIds(), [
            'lolos' => ['required', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ]));

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service, $data) {
            $service->setSeleksi($calon->id, (bool) $data['lolos'], auth()->id(), $data['catatan'] ?? null);
        });
    }

    /** POST /api/psb/bulk/daftar-ulang */
    public function bulkDaftarUlang(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate(array_merge($this->aturanBulkIds(), [
            'lolos' => ['nullable', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ]));

        $lolos = array_key_exists('lolos', $data) ? (bool) $data['lolos'] : null;

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service, $lolos, $data) {
            $service->masukDaftarUlang($calon->id, auth()->id(), $lolos, $data['catatan'] ?? null);
        });
    }

    /** POST /api/psb/bulk/undur-diri */
    public function bulkUndurDiri(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate(array_merge($this->aturanBulkIds(), [
            'catatan' => ['nullable', 'string'],
        ]));

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service, $data) {
            $service->undurDiri($calon->id, auth()->id(), $data['catatan'] ?? null);
        });
    }

    /** POST /api/psb/bulk/batalkan-fase */
    public function bulkBatalkanFase(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate(array_merge($this->aturanBulkIds(), [
            'catatan' => ['nullable', 'string'],
        ]));

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service, $data) {
            $service->batalkanFase($calon->id, auth()->id(), $data['catatan'] ?? null);
        });
    }

    /** POST /api/psb/bulk/acc-daftar-ulang — `nis` opsional: {"<id>": "NIS"} per calon. */
    public function bulkAcc(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate(array_merge($this->aturanBulkIds(), [
            'nis' => ['nullable', 'array'],
            'nis.*' => ['nullable', 'string', 'max:20'],
        ]));
        $nisPer = $data['nis'] ?? [];

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service, $nisPer) {
            $service->accDaftarUlang($calon->id, auth()->id(), $nisPer[$calon->id] ?? null);
        });
    }

    /** POST /api/psb/bulk/hapus */
    public function bulkHapus(Request $request, PsbService $service): JsonResponse
    {
        $data = $this->validasiBulkIds($request);

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service) {
            $service->hapusCalon($calon->id, auth()->id());
        }, izinkanTerhapus: false);
    }

    /** POST /api/psb/bulk/pulihkan */
    public function bulkPulihkan(Request $request, PsbService $service): JsonResponse
    {
        $data = $this->validasiBulkIds($request);

        return $this->loopBulk($data['ids'], function (PsbCalonSantri $calon) use ($service) {
            $service->pulihkanCalon($calon->id, auth()->id());
        }, izinkanTerhapus: true);
    }

    protected function aturanBulkIds(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct'],
        ];
    }

    protected function validasiBulkIds(Request $request): array
    {
        return $request->validate($this->aturanBulkIds());
    }

    /** Aksi massal per calon: partial success + laporan kegagalan per baris. */
    protected function loopBulk(array $ids, callable $aksi, bool $izinkanTerhapus = false): JsonResponse
    {
        $berhasil = [];
        $gagal = [];
        foreach ($ids as $id) {
            $calon = PsbCalonSantri::withTrashed()->find((int) $id);
            try {
                if (! $calon) {
                    throw ValidationException::withMessages(['calon' => 'Calon tidak ditemukan.']);
                }
                if ($calon->trashed() && ! $izinkanTerhapus) {
                    throw ValidationException::withMessages(['calon' => 'Calon sudah dihapus.']);
                }
                $this->authorizeCalon(auth()->user(), $calon);
                $aksi($calon);
                $berhasil[] = (int) $id;
            } catch (ValidationException $e) {
                $gagal[] = $this->barisGagal($calon, (int) $id, collect($e->errors())->flatten()->first());
            } catch (HttpException $e) {
                $gagal[] = $this->barisGagal($calon, (int) $id, $e->getMessage() ?: 'Akses ditolak.');
            } catch (\Throwable $e) {
                $gagal[] = $this->barisGagal($calon, (int) $id, 'Gagal diproses.');
            }
        }

        return response()->json([
            'pesan' => count($berhasil).' calon berhasil, '.count($gagal).' gagal.',
            'data' => ['berhasil' => $berhasil, 'gagal' => $gagal],
        ]);
    }

    protected function barisGagal(?PsbCalonSantri $calon, int $id, mixed $pesan): array
    {
        return [
            'id' => $id,
            'no_pendaftaran' => $calon?->no_pendaftaran,
            'nama_lengkap' => $calon?->nama_lengkap,
            'pesan' => is_string($pesan) && $pesan !== '' ? $pesan : 'Gagal diproses.',
        ];
    }

    /** GET /api/psb/gelombang — dropdown gelombang admin (opsional ?kegiatan_id=/?tahun_ajaran_id=). */
    public function gelombang(Request $request): JsonResponse
    {
        $rows = PsbGelombang::with('kegiatan:id,nama,tahun_ajaran_id')
            ->when($request->filled('kegiatan_id'), fn ($q) => $q->where('psb_kegiatan_id', $request->integer('kegiatan_id')))
            ->when($request->filled('tahun_ajaran_id'), fn ($q) => $q->whereHas('kegiatan', fn ($qq) => $qq->where('tahun_ajaran_id', $request->integer('tahun_ajaran_id'))))
            ->orderBy('psb_kegiatan_id')
            ->orderBy('nomor')
            ->get(['id', 'psb_kegiatan_id', 'nomor', 'nama', 'tgl_buka', 'tgl_tutup'])
            ->map(fn (PsbGelombang $g) => [
                'id' => $g->id,
                'psb_kegiatan_id' => $g->psb_kegiatan_id,
                'nomor' => $g->nomor,
                'nama' => $g->nama,
                'tgl_buka' => $g->tgl_buka?->toDateString(),
                'tgl_tutup' => $g->tgl_tutup?->toDateString(),
                'kegiatan' => $g->kegiatan,
            ]);

        return response()->json(['pesan' => 'Gelombang dimuat.', 'data' => $rows]);
    }

    /** POST /api/psb/calon — input pendaftar manual oleh admin (tanpa buka/tutup gelombang;
     *  kuota & dedup NIK tetap dijalankan service yang sama dengan pendaftaran publik). */
    public function storeCalon(PsbDaftarRequest $request, PsbService $service): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        $calon = $service->daftarPublik($data);

        return response()->json([
            'pesan' => 'Pendaftar dibuat oleh admin.',
            'data' => $calon->fresh(),
        ], 201);
    }

    /** GET /api/psb/import-template — unduh template Excel (kolom = rules PsbImport). */
    public function template()
    {
        return Excel::download(new PsbTemplateExport, 'template-import-psb.xlsx');
    }

    /** POST /api/psb/import — Excel kolom inti, NIK required -> create() langsung. */
    public function import(Request $request, PsbService $psbService): JsonResponse
    {
        $data = $request->validate([
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);
        $this->authorizeLembaga(auth()->user(), (int) $data['lembaga_id']);

        try {
            Excel::import(
                new PsbImport((int) $data['gelombang_id'], (int) $data['lembaga_id'], $psbService, app(KeuanganService::class)),
                $request->file('file')
            );

            return response()->json(['pesan' => 'Data PSB berhasil diimport.']);
        } catch (ExcelValidationException $e) {
            $errors = [];
            foreach ($e->failures() as $failure) {
                $errors[] = [
                    'row' => $failure->row(),
                    'attribute' => $failure->attribute(),
                    'errors' => $failure->errors(),
                ];
            }

            return response()->json(['pesan' => 'Gagal mengimport beberapa data.', 'errors' => $errors], 422);
        }
    }
}
