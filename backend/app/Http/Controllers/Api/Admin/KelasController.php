<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\TahunAjaran;
use App\Services\RefService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * FB-004-01: CRUD kelas. tahun_ajaran wajib se-lembaga dengan kelas.
 */
class KelasController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = $this->scopeLembaga(
            Kelas::with(['lembaga:id,nama', 'tahunAjaran:id,nama']),
            auth()->user(),
            $request
        );

        if ($request->filled('tahun_ajaran_id')) {
            $query->where('tahun_ajaran_id', $request->input('tahun_ajaran_id'));
        }
        if ($request->filled('tingkat')) {
            $query->where('tingkat', $request->input('tingkat'));
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where('nama_kelas', 'like', "%{$s}%");
        }

        // Urut default nama ascending agar no. urut grid mengikuti abjad.
        return response()->json($query->orderBy('nama_kelas')->orderBy('id')->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Kelas selalu milik lembaga operasional (bukan root pesantren).
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran_id' => ['required', 'exists:tahun_ajaran,id'],
            // Mode tunggal (kompatibel lama) atau bulk via items (sub-form dialog).
            'nama_kelas' => ['required_without:items', 'string', 'max:50'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.nama_kelas' => ['required', 'string', 'max:50'],
            'items.*.tingkat' => ['nullable', 'string', 'max:20'],
            'items.*.kapasitas' => ['nullable', 'integer', 'min:1'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $tahun = TahunAjaran::findOrFail($data['tahun_ajaran_id']);
        if ((int) $tahun->lembaga_id !== (int) $data['lembaga_id']) {
            return response()->json(['message' => 'Tahun ajaran tidak se-lembaga dengan kelas.'], 422);
        }

        $items = isset($data['items'])
            ? array_values($data['items'])
            : [[
                'nama_kelas' => $data['nama_kelas'],
                'tingkat' => $data['tingkat'] ?? null,
                'kapasitas' => $data['kapasitas'] ?? null,
            ]];

        try {
            $dibuat = DB::transaction(function () use ($data, $items) {
                $rows = [];
                $namaPayload = [];
                foreach ($items as $item) {
                    $nama = Kelas::normalisasiNama($item['nama_kelas']);
                    $kunci = mb_strtolower($nama);

                    if (isset($namaPayload[$kunci])) {
                        abort(response()->json(['message' => "Nama kelas \"{$nama}\" duplikat di daftar yang dikirim."], 422));
                    }
                    $namaPayload[$kunci] = true;

                    $this->cekTingkat((int) $data['lembaga_id'], $item['tingkat'] ?? null);
                    $this->pastikanNamaUnik((int) $data['lembaga_id'], (int) $data['tahun_ajaran_id'], $nama);

                    $rows[] = Kelas::create([
                        'lembaga_id' => (int) $data['lembaga_id'],
                        'tahun_ajaran_id' => (int) $data['tahun_ajaran_id'],
                        'nama_kelas' => $nama,
                        'tingkat' => $item['tingkat'] ?? null,
                        'kapasitas' => $item['kapasitas'] ?? null,
                    ]);
                }

                return $rows;
            });
        } catch (QueryException $e) {
            if (! $this->pelanggaranUnik($e)) {
                throw $e;
            }

            return response()->json(['message' => 'Nama kelas sudah dipakai di lembaga + tahun ajaran ini.'], 422);
        }

        if (! isset($data['items'])) {
            return response()->json($dibuat[0], 201);
        }

        return response()->json(['pesan' => count($dibuat).' kelas dibuat.', 'data' => $dibuat], 201);
    }

    /** Validasi kamus no.50: tingkat via RefService efektif (null = semua). */
    protected function cekTingkat(int $lembagaId, ?string $tingkat): void
    {
        if (! empty($tingkat)
            && ! in_array($tingkat, RefService::kodeAktif('tingkat', $lembagaId), true)
            && ! in_array($tingkat, RefService::kodeAktif('tingkat', null), true)) {
            abort(response()->json(['message' => 'Tingkat tidak dikenal.'], 422));
        }
    }

    /**
     * Nama kelas wajib unik per lembaga + tahun ajaran (mengikuti kolasi kolom
     * yang case-insensitive). Dipanggil sebelum tulis untuk pesan yang jelas.
     */
    protected function pastikanNamaUnik(int $lembagaId, int $tahunAjaranId, string $nama, ?int $kecualikanId = null): void
    {
        $query = Kelas::where('lembaga_id', $lembagaId)
            ->where('tahun_ajaran_id', $tahunAjaranId)
            // LOWER() agar perbandingan case-insensitive di semua driver (DB uji SQLite).
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower($nama)]);

        if ($kecualikanId !== null) {
            $query->whereKeyNot($kecualikanId);
        }

        if ($query->exists()) {
            abort(response()->json(['message' => "Kelas \"{$nama}\" sudah ada di lembaga + tahun ajaran ini."], 422));
        }
    }

    /** Deteksi pelanggaran unique MySQL (race dua penulis nama yang sama). */
    protected function pelanggaranUnik(QueryException $e): bool
    {
        return (int) ($e->errorInfo[1] ?? 0) === 1062;
    }

    public function update(Request $request, Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->lembaga_id);

        $data = $request->validate([
            'tingkat' => ['nullable', 'string', 'max:20'],
            'nama_kelas' => ['sometimes', 'required', 'string', 'max:50'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
        ]);

        if (array_key_exists('nama_kelas', $data)) {
            $data['nama_kelas'] = Kelas::normalisasiNama($data['nama_kelas']);
            $this->pastikanNamaUnik(
                (int) $kela->lembaga_id,
                (int) $kela->tahun_ajaran_id,
                $data['nama_kelas'],
                (int) $kela->id
            );
        }

        try {
            $kela->update($data);
        } catch (QueryException $e) {
            if (! $this->pelanggaranUnik($e)) {
                throw $e;
            }

            return response()->json(['message' => 'Nama kelas sudah dipakai di lembaga + tahun ajaran ini.'], 422);
        }

        return response()->json($kela);
    }

    public function destroy(Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->lembaga_id);
        $kela->delete();

        return response()->json(['message' => 'Kelas dihapus.']);
    }
}
