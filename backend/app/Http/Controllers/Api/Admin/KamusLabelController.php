<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LabelKolom;
use App\Services\KamusKolomService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Kamus kolom level tabel database (global se-pesantren): nama header,
 * perataan, lebar, tooltip, format, dan kontrol urut per kolom.
 * Baca bebas (semua admin); tulis hanya admin pesantren (pola TA global).
 */
class KamusLabelController extends Controller
{
    /** Format tampil yang didukung kolom. */
    public const FORMAT = ['teks', 'angka', 'tanggal', 'ya_tidak'];

    /** Gaya penulisan label otomatis dari nama kolom database. */
    public const MODE_LABEL = ['upper', 'proper', 'lower'];

    /** Tabel infrastruktur/kamus (bukan data bisnis) yang tak perlu diatur. */
    private const TABEL_DIABAIKAN = [
        'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        'sessions', 'password_reset_tokens', 'personal_access_tokens',
        'permissions', 'roles', 'model_has_permissions', 'model_has_roles',
        'role_has_permissions', 'label_kolom',
        'preset_tabel', 'preset_tabel_aktif', 'pengaturan_tampilan', 'sqlite_sequence',
    ];

    /** GET /api/admin/kamus-kolom/skema — tabel + kolomnya untuk pemilih otomatis. */
    public function skema(): JsonResponse
    {
        return response()->json(['pesan' => 'Skema kolom dimuat.', 'data' => $this->daftarTabelKolom()]);
    }

    /**
     * Semua tabel data + kolomnya (tabel infra dikecualikan, duplikat dibuang).
     *
     * @return list<array{tabel: string, kolom: list<string>}>
     */
    protected function daftarTabelKolom(): array
    {
        $tabel = [];
        $sudah = [];
        foreach (Schema::getTables() as $t) {
            $nama = $t['name'] ?? null;
            if (! $nama || isset($sudah[$nama]) || in_array($nama, self::TABEL_DIABAIKAN, true)) {
                continue;
            }
            $kolom = array_values(array_unique(array_map(
                fn ($c) => $c['name'],
                Schema::getColumns($nama),
            )));
            if ($kolom !== []) {
                $sudah[$nama] = true;
                $tabel[] = ['tabel' => $nama, 'kolom' => $kolom];
            }
        }
        usort($tabel, fn ($a, $b) => strcmp($a['tabel'], $b['tabel']));

        return $tabel;
    }

    /**
     * Kolom teknis/audit yang tak perlu diberi label (dilewati saat generasi).
     */
    protected function kolomTeknis(string $kolom): bool
    {
        return $kolom === 'id'
            || $kolom === 'password'
            || $kolom === 'remember_token'
            || str_ends_with($kolom, '_id')
            || str_ends_with($kolom, '_at')
            || str_ends_with($kolom, '_by');
    }

    /** Label dari nama kolom: underscore → spasi lalu digayakan sesuai mode. */
    protected function labelDariKolom(string $kolom, string $mode): string
    {
        $teks = trim((string) preg_replace('/_+/', ' ', $kolom));

        return match ($mode) {
            'upper' => mb_strtoupper($teks),
            'lower' => mb_strtolower($teks),
            default => mb_convert_case($teks, MB_CASE_TITLE, 'UTF-8'),
        };
    }

    /**
     * POST /api/admin/kamus-kolom/generasi — isi label semua kolom (seluruh
     * tabel, kolom teknis dilewati) dari nama kolom; label lama ditimpa,
     * atribut lain (perataan, lebar, tooltip, dst) dibiarkan.
     */
    public function generasi(Request $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'mode' => ['required', Rule::in(self::MODE_LABEL)],
        ]);

        $tabel = $this->daftarTabelKolom();
        $sekarang = now();
        $baris = [];
        foreach ($tabel as $t) {
            foreach ($t['kolom'] as $kolom) {
                if ($this->kolomTeknis($kolom)) {
                    continue;
                }
                $baris[] = [
                    'tabel' => $t['tabel'],
                    'kolom' => $kolom,
                    'label' => $this->labelDariKolom($kolom, $data['mode']),
                    'created_at' => $sekarang,
                    'updated_at' => $sekarang,
                ];
            }
        }

        DB::transaction(function () use ($baris) {
            foreach (array_chunk($baris, 500) as $chunk) {
                LabelKolom::upsert($chunk, ['tabel', 'kolom'], ['label', 'updated_at']);
            }
        });
        KamusKolomService::bump();

        return response()->json([
            'pesan' => count($baris).' label kolom dibuat.',
            'data' => ['jumlah' => count($baris), 'tabel' => count($tabel)],
        ]);
    }

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

    /** @return array<string, mixed> */
    protected function validasi(Request $request): array
    {
        $data = $request->validate([
            'tabel' => ['required', 'string', 'max:64'],
            'kolom' => ['required', 'string', 'max:64'],
            'label' => ['nullable', 'string', 'max:100'],
            'align' => ['nullable', Rule::in(['left', 'center', 'right'])],
            'lebar' => ['nullable', 'integer', 'min:40', 'max:600'],
            'kunci_lebar' => ['sometimes', 'boolean'],
            'tooltip' => ['nullable', 'string', 'max:200'],
            'format' => ['nullable', Rule::in(self::FORMAT)],
        ]);

        if (! Schema::hasTable($data['tabel']) || ! Schema::hasColumn($data['tabel'], $data['kolom'])) {
            throw ValidationException::withMessages([
                'kolom' => 'Kolom ini tidak ada di tabel database.',
            ]);
        }

        return $data;
    }

    /** @param array<string, mixed> $data */
    protected function bersihkan(array $data): array
    {
        $teks = fn (?string $v) => ($v === null || trim($v) === '') ? null : trim($v);
        $data['label'] = $teks($data['label'] ?? null);
        $data['tooltip'] = $teks($data['tooltip'] ?? null);
        $data['align'] = $data['align'] ?? null;
        $data['format'] = $data['format'] ?? null;
        $data['kunci_lebar'] = (bool) ($data['kunci_lebar'] ?? false);

        return $data;
    }

    protected function pastikanAdminPesantren(): void
    {
        if (! auth()->user()?->bolehPesantren()) {
            abort(403, 'Kamus label hanya dikelola admin pesantren.');
        }
    }
}
