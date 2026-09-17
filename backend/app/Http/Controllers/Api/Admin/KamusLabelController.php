<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LabelKolom;
use App\Models\UrutBawaan;
use App\Services\KamusKolomService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Kamus kolom level tabel database (global se-pesantren): nama header,
 * perataan, lebar, tooltip, format, kontrol urut + urut bawaan per endpoint.
 * Baca bebas (semua admin); tulis hanya admin pesantren (pola TA global).
 */
class KamusLabelController extends Controller
{
    /** Format tampil yang didukung kolom. */
    public const FORMAT = ['teks', 'angka', 'tanggal', 'ya_tidak'];

    /** GET /api/admin/kamus-kolom — daftar baris kamus (kelola). */
    public function index(Request $request): JsonResponse
    {
        $q = LabelKolom::query();

        if ($request->filled('tabel')) {
            $q->where('tabel', $request->input('tabel'));
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $q->where(fn ($sub) => $sub->where('tabel', 'like', "%{$s}%")
                ->orWhere('kolom', 'like', "%{$s}%")
                ->orWhere('label', 'like', "%{$s}%"));
        }

        return response()->json([
            'pesan' => 'Kamus kolom dimuat.',
            'data' => $q->orderBy('tabel')->orderBy('kolom')->get(),
        ]);
    }

    /** GET /api/admin/kamus-kolom/peta?tabel=santri,lembaga — peta untuk grid. */
    public function peta(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tabel' => ['required', 'string', 'max:2000'],
        ]);
        $tabel = array_filter(array_map('trim', explode(',', $data['tabel'])));

        return response()->json([
            'pesan' => 'Peta kolom dimuat.',
            'data' => KamusKolomService::peta($tabel),
        ]);
    }

    /** POST /api/admin/kamus-kolom */
    public function store(Request $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $this->validasi($request);

        if (LabelKolom::where('tabel', $data['tabel'])->where('kolom', $data['kolom'])->exists()) {
            throw ValidationException::withMessages(['kolom' => 'Kolom ini sudah ada di kamus.']);
        }

        $row = LabelKolom::create($this->bersihkan($data));
        KamusKolomService::bump();

        return response()->json(['pesan' => 'Kolom kamus disimpan.', 'data' => $row], 201);
    }

    /** PUT /api/admin/kamus-kolom/{labelKolom} */
    public function update(Request $request, LabelKolom $labelKolom): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $this->validasi($request);

        if (LabelKolom::where('tabel', $data['tabel'])->where('kolom', $data['kolom'])
            ->where('id', '!=', $labelKolom->id)->exists()) {
            throw ValidationException::withMessages(['kolom' => 'Kolom ini sudah ada di kamus.']);
        }

        $labelKolom->update($this->bersihkan($data));
        KamusKolomService::bump();

        return response()->json(['pesan' => 'Kolom kamus diubah.', 'data' => $labelKolom->fresh()]);
    }

    /** DELETE /api/admin/kamus-kolom/{labelKolom} */
    public function destroy(LabelKolom $labelKolom): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $labelKolom->delete();
        KamusKolomService::bump();

        return response()->json(['pesan' => 'Kolom kamus dihapus.']);
    }

    /** GET /api/admin/kamus-kolom/urut — daftar urut bawaan. */
    public function indexUrut(): JsonResponse
    {
        return response()->json([
            'pesan' => 'Urut bawaan dimuat.',
            'data' => UrutBawaan::orderBy('endpoint')->get(),
        ]);
    }

    /** POST /api/admin/kamus-kolom/urut — upsert urut bawaan satu endpoint. */
    public function simpanUrut(Request $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:120'],
            'kunci' => ['nullable', 'array', 'max:3'],
            'kunci.*' => ['string', 'max:60'],
            'arah' => ['nullable', Rule::in(['naik', 'turun'])],
        ]);

        $kunci = array_values(array_filter(array_map(
            fn ($v) => trim((string) $v),
            $data['kunci'] ?? [],
        )));

        if ($kunci === []) {
            UrutBawaan::where('endpoint', $data['endpoint'])->delete();
            KamusKolomService::bump();

            return response()->json(['pesan' => 'Urut bawaan dikembalikan ke bawaan sistem.', 'data' => null]);
        }

        $row = UrutBawaan::updateOrCreate(
            ['endpoint' => $data['endpoint']],
            ['kunci' => $kunci, 'arah' => $data['arah'] ?? 'naik'],
        );
        KamusKolomService::bump();

        return response()->json(['pesan' => 'Urut bawaan disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/kamus-kolom/urut/{urutBawaan} */
    public function hapusUrut(UrutBawaan $urutBawaan): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $urutBawaan->delete();
        KamusKolomService::bump();

        return response()->json(['pesan' => 'Urut bawaan dihapus.']);
    }

    /** @return array<string, mixed> */
    protected function validasi(Request $request): array
    {
        return $request->validate([
            'tabel' => ['required', 'string', 'max:64'],
            'kolom' => ['required', 'string', 'max:64'],
            'label' => ['nullable', 'string', 'max:100'],
            'align' => ['nullable', Rule::in(['left', 'center', 'right'])],
            'lebar' => ['nullable', 'integer', 'min:40', 'max:600'],
            'kunci_lebar' => ['sometimes', 'boolean'],
            'bisa_urut' => ['sometimes', 'boolean'],
            'arah_bawaan' => ['nullable', Rule::in(['naik', 'turun'])],
            'tooltip' => ['nullable', 'string', 'max:200'],
            'format' => ['nullable', Rule::in(self::FORMAT)],
        ]);
    }

    /** @param array<string, mixed> $data */
    protected function bersihkan(array $data): array
    {
        $teks = fn (?string $v) => ($v === null || trim($v) === '') ? null : trim($v);
        $data['label'] = $teks($data['label'] ?? null);
        $data['tooltip'] = $teks($data['tooltip'] ?? null);
        $data['align'] = $data['align'] ?? null;
        $data['arah_bawaan'] = $data['arah_bawaan'] ?? null;
        $data['format'] = $data['format'] ?? null;
        $data['kunci_lebar'] = (bool) ($data['kunci_lebar'] ?? false);
        $data['bisa_urut'] = (bool) ($data['bisa_urut'] ?? true);

        return $data;
    }

    protected function pastikanAdminPesantren(): void
    {
        if (! auth()->user()?->bolehPesantren()) {
            abort(403, 'Kamus label hanya dikelola admin pesantren.');
        }
    }
}
