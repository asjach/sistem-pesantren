<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DesainKartuPesertaRequest;
use App\Http\Requests\Admin\PengaturanKartuPesertaRequest;
use App\Models\DesainKartuPeserta;
use App\Models\PengaturanKartuPeserta;
use App\Models\PeristiwaNilai;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DesainKartuPesertaController extends Controller
{
    use TenantGuard;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
        ]);
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $pengaturan = PengaturanKartuPeserta::query()
            ->where('peristiwa_id', $peristiwa->id)
            ->first();

        return response()->json([
            'desain' => DesainKartuPeserta::query()
                ->where('jenjang', $peristiwa->jenjang)
                ->orderBy('nama')
                ->orderBy('id')
                ->get()
                ->map(fn (DesainKartuPeserta $desain) => $this->untukRespons($desain)),
            'pengaturan' => [
                'peristiwa_id' => $peristiwa->id,
                'desain_id' => $pengaturan?->desain_id,
                'template_bawaan' => $pengaturan?->template_bawaan ?? 'klasik',
                'lebar_mm' => (float) ($pengaturan?->lebar_mm ?? 85.60),
                'tinggi_mm' => (float) ($pengaturan?->tinggi_mm ?? 53.98),
            ],
        ]);
    }

    public function simpan(DesainKartuPesertaRequest $request): JsonResponse
    {
        $data = $request->validated();
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $desain = isset($data['id'])
            ? DesainKartuPeserta::query()->findOrFail($data['id'])
            : new DesainKartuPeserta;
        if ($desain->exists && $desain->jenjang !== $peristiwa->jenjang) {
            abort(403, 'Akses ditolak.');
        }

        $namaDipakai = DesainKartuPeserta::query()
            ->where('jenjang', $peristiwa->jenjang)
            ->where('nama', trim($data['nama']))
            ->when($desain->exists, fn ($query) => $query->whereKeyNot($desain->id))
            ->exists();
        if ($namaDipakai) {
            throw ValidationException::withMessages(['nama' => 'Nama desain sudah dipakai pada lembaga ini.']);
        }

        $pathLama = $desain->latar_path;
        $pathBaru = null;
        if ($request->hasFile('latar')) {
            $pathBaru = $request->file('latar')->store('penilaian/kartu-peserta', 'local');
        }

        try {
            $desain->fill([
                'jenjang' => $peristiwa->jenjang,
                'nama' => trim($data['nama']),
                'elemen' => $data['elemen'],
                'warna_latar' => strtolower($data['warna_latar']),
                'gaya_latar' => $data['gaya_latar'],
                'latar_path' => $pathBaru
                    ?? (($data['hapus_latar'] ?? false) ? null : $pathLama),
            ])->save();
        } catch (\Throwable $e) {
            if ($pathBaru !== null) {
                Storage::disk('local')->delete($pathBaru);
            }

            throw $e;
        }

        if ($pathLama !== null && $pathLama !== $desain->latar_path) {
            Storage::disk('local')->delete($pathLama);
        }

        return response()->json([
            'pesan' => 'Desain kartu disimpan.',
            'desain' => $this->untukRespons($desain->fresh()),
        ], isset($data['id']) ? 200 : 201);
    }

    public function simpanPengaturan(PengaturanKartuPesertaRequest $request): JsonResponse
    {
        $data = $request->validated();
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $desainId = $data['desain_id'] ?? null;
        if ($desainId !== null) {
            $sesuaiLembaga = DesainKartuPeserta::query()
                ->whereKey($desainId)
                ->where('jenjang', $peristiwa->jenjang)
                ->exists();
            if (! $sesuaiLembaga) {
                throw ValidationException::withMessages(['desain_id' => 'Desain bukan milik lembaga peristiwa ini.']);
            }
        }

        $pengaturan = PengaturanKartuPeserta::query()->updateOrCreate(
            ['peristiwa_id' => $peristiwa->id],
            [
                'desain_id' => $desainId,
                'template_bawaan' => $desainId === null ? ($data['template_bawaan'] ?? 'klasik') : null,
                'lebar_mm' => $data['lebar_mm'],
                'tinggi_mm' => $data['tinggi_mm'],
            ],
        );

        return response()->json(['pesan' => 'Ukuran dan pilihan desain disimpan.', 'pengaturan' => $pengaturan]);
    }

    public function latar(Request $request, DesainKartuPeserta $desain): BinaryFileResponse
    {
        $this->authorizeLembaga($request->user(), $desain->jenjang);
        if ($desain->latar_path === null || ! Storage::disk('local')->exists($desain->latar_path)) {
            abort(404, 'Desain belum memiliki gambar latar.');
        }

        return response()->file(Storage::disk('local')->path($desain->latar_path));
    }

    public function hapus(Request $request, DesainKartuPeserta $desain): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $desain->jenjang);
        $path = $desain->latar_path;
        $desain->delete();
        if ($path !== null) {
            Storage::disk('local')->delete($path);
        }

        return response()->json(['pesan' => 'Desain kartu dihapus.']);
    }

    /** @return array<string, mixed> */
    private function untukRespons(DesainKartuPeserta $desain): array
    {
        return [
            ...$desain->toArray(),
            'latar_ada' => $desain->latar_path !== null,
            'latar_url' => $desain->latar_path === null ? null : "/admin/penilaian/desain-kartu/{$desain->id}/latar",
        ];
    }
}
