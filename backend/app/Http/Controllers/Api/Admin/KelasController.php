<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\KelasNamaExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Services\RefService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

/**
 * FB-004-01: CRUD kelas. tahun_ajaran wajib berlaku untuk lembaga kelas (TA global).
 */
class KelasController extends Controller
{
    use TenantGuard;

    public function index(Request $request)
    {
        $query = $this->scopeLembaga(
            Kelas::with(['lembaga:id,nama,kode', 'tahunAjaran:id,nama']),
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

        // Urut default: `urutan` (diatur admin) lalu nama kelas.
        return response()->json(
            $query->orderBy('urutan')->orderBy('nama_kelas')->orderBy('id')->paginate($this->perPage($request))
        );
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
            'urutan' => ['nullable', 'integer', 'min:0'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.nama_kelas' => ['required', 'string', 'max:50'],
            'items.*.tingkat' => ['nullable', 'string', 'max:20'],
            'items.*.kapasitas' => ['nullable', 'integer', 'min:1'],
            'items.*.urutan' => ['nullable', 'integer', 'min:0'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);

        $auth = auth()->user();
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $this->cekTaEfektif((int) $data['lembaga_id'], (int) $data['tahun_ajaran_id']);

        $items = isset($data['items'])
            ? array_values($data['items'])
            : [[
                'nama_kelas' => $data['nama_kelas'],
                'tingkat' => $data['tingkat'] ?? null,
                'kapasitas' => $data['kapasitas'] ?? null,
                'urutan' => $data['urutan'] ?? 0,
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
                        'urutan' => (int) ($item['urutan'] ?? 0),
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

    /** GET /api/admin/kelas/export-nama — unduh daftar nama kelas (pasangan import-nama). */
    public function exportNama(Request $request)
    {
        $data = $request->validate([
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran_id' => ['required', 'exists:tahun_ajaran,id'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);

        $lembagaId = (int) $data['lembaga_id'];
        $taId = (int) $data['tahun_ajaran_id'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->cekTaEfektif($lembagaId, $taId);

        $kode = Lembaga::whereKey($lembagaId)->value('kode');
        $ta = TahunAjaran::find($taId);

        return Excel::download(
            new KelasNamaExport($lembagaId, $taId),
            "daftar-kelas-{$kode}-".preg_replace('/[^0-9]/', '', (string) ($ta?->nama ?? $taId)).'.xlsx',
        );
    }

    /** POST /api/admin/kelas/import-nama — salin nama+tingkat kelas pasangan MI↔MD.
     *  Dua mode: ambil (`lembaga_id` + `tahun_ajaran_id` target, `dari_kode` sumber)
     *  atau copy (`dari_lembaga_id` + `dari_tahun_ajaran_id` sumber, `ke_kode` target
     *  + TA target = nama sama, fallback aktif). */
    public function importNama(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => ['nullable', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran_id' => ['nullable', 'exists:tahun_ajaran,id'],
            'dari_kode' => ['nullable', 'in:MI,MD'],
            'dari_lembaga_id' => ['nullable', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'dari_tahun_ajaran_id' => ['nullable', 'exists:tahun_ajaran,id'],
            'ke_kode' => ['nullable', 'in:MI,MD'],
            'periksa' => ['nullable', 'boolean'],
        ], [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
            'dari_lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ]);
        $periksa = (bool) ($data['periksa'] ?? true);

        if (! empty($data['ke_kode'])) {
            // Mode copy: sumber eksplisit, target via kode + TA otomatis.
            if (empty($data['dari_lembaga_id']) || empty($data['dari_tahun_ajaran_id'])) {
                return response()->json(['pesan' => 'Mode copy butuh dari_lembaga_id + dari_tahun_ajaran_id.'], 422);
            }
            $sumberId = (int) $data['dari_lembaga_id'];
            $taSumber = TahunAjaran::find((int) $data['dari_tahun_ajaran_id']);
            if (! $taSumber) {
                return response()->json(['pesan' => 'Tahun ajaran sumber tidak ditemukan.'], 422);
            }
            $this->cekTaEfektif($sumberId, (int) $taSumber->id);
            $sumberKode = Lembaga::whereKey($sumberId)->value('kode');
            $targetKode = $data['ke_kode'];
            if (! in_array($sumberKode, ['MI', 'MD'], true) || $sumberKode === $targetKode) {
                return response()->json(['pesan' => 'Copy nama hanya untuk pasangan MI↔MD.'], 422);
            }
            $target = Lembaga::where('kode', $targetKode)->whereNotNull('parent_id')->first();
            if (! $target) {
                return response()->json(['pesan' => "Lembaga tujuan {$targetKode} tidak ditemukan."], 422);
            }
            $targetId = (int) $target->id;
            $this->authorizeLembaga($request->user(), $targetId);
            $taId = TahunAjaran::efektif($targetId)->firstWhere('nama', $taSumber->nama)?->id
                ?? TahunAjaran::aktif($targetId)?->id;
            if (! $taId) {
                return response()->json(['pesan' => "Tidak ada tahun ajaran acuan di {$targetKode}."], 422);
            }
            $sumber = Lembaga::find($sumberId);
        } else {
            // Mode ambil: target eksplisit, sumber via kode.
            if (empty($data['lembaga_id']) || empty($data['tahun_ajaran_id']) || empty($data['dari_kode'])) {
                return response()->json(['pesan' => 'Pilih mode ambil atau copy.'], 422);
            }
            $targetId = (int) $data['lembaga_id'];
            $taId = (int) $data['tahun_ajaran_id'];
            $this->authorizeLembaga($request->user(), $targetId);
            $this->cekTaEfektif($targetId, $taId);

            $targetKode = Lembaga::whereKey($targetId)->value('kode');
            $sumberKode = $data['dari_kode'];
            // Pasangan MI↔MD dua arah: target salah satu, sumber yang lain.
            if (! in_array($targetKode, ['MI', 'MD'], true) || $targetKode === $sumberKode) {
                return response()->json(['pesan' => 'Import nama hanya untuk pasangan MI↔MD.'], 422);
            }
            $sumber = Lembaga::where('kode', $sumberKode)->whereNotNull('parent_id')->first();
            if (! $sumber) {
                return response()->json(['pesan' => "Lembaga sumber {$sumberKode} tidak ditemukan."], 422);
            }
            // TA sumber: nama sama → fallback TA aktif sumber.
            $taTarget = TahunAjaran::find($taId);
            $taSumber = TahunAjaran::efektif((int) $sumber->id)->firstWhere('nama', $taTarget?->nama)
                ?? TahunAjaran::aktif((int) $sumber->id);
            if (! $taSumber) {
                return response()->json(['pesan' => "Tidak ada tahun ajaran acuan di {$sumberKode}."], 422);
            }
        }

        // Pengecualian pasangan MI↔MD: sumber boleh dibaca bila pemanggil boleh
        // akses target (sudah diauthorize di atas); tulis tetap target saja.
        // Tanpa ini admin satu lembaga selalu 403 saat import dari pasangannya.
        if (! $request->user()->canAccessLembaga((int) $sumber->id)
            && ! $request->user()->canAccessLembaga($targetId)) {
            return response()->json(['pesan' => 'Akses ditolak.'], 403);
        }

        $sudahAda = Kelas::where('lembaga_id', $targetId)
            ->where('tahun_ajaran_id', $taId)
            ->pluck('nama_kelas')
            ->map(fn ($n) => mb_strtolower(Kelas::normalisasiNama((string) $n)))
            ->all();

        $sumberKelas = Kelas::where('lembaga_id', $sumber->id)
            ->where('tahun_ajaran_id', $taSumber->id)
            ->orderBy('urutan')->orderBy('nama_kelas')
            ->get(['id', 'nama_kelas', 'tingkat', 'urutan']);

        $rincian = [];
        foreach ($sumberKelas as $k) {
            $nama = Kelas::normalisasiNama($k->nama_kelas);
            if (in_array(mb_strtolower($nama), $sudahAda, true)) {
                $rincian[] = ['nama' => $nama, 'tingkat' => $k->tingkat, 'status' => 'dilewati'];

                continue;
            }
            $sudahAda[] = mb_strtolower($nama);
            if (! $periksa) {
                $this->cekTingkat($targetId, $k->tingkat);
                Kelas::create([
                    'lembaga_id' => $targetId,
                    'tahun_ajaran_id' => $taId,
                    'nama_kelas' => $nama,
                    'tingkat' => $k->tingkat,
                    'urutan' => (int) $k->urutan,
                ]);
            }
            $rincian[] = ['nama' => $nama, 'tingkat' => $k->tingkat, 'status' => 'dibuat'];
        }

        $hitung = fn (string $s) => count(array_filter($rincian, fn ($r) => $r['status'] === $s));

        return response()->json([
            'pesan' => $periksa
                ? 'Pratinjau selesai: eksekusi untuk menyalin.'
                : 'Import nama kelas selesai.',
            'periksa' => $periksa,
            'sumber' => ['kode' => $sumberKode, 'tahun_ajaran' => $taSumber->nama],
            'tujuan' => ['kode' => $targetKode, 'tahun_ajaran' => TahunAjaran::find($taId)?->nama],
            'ringkasan' => [
                'sumber' => count($sumberKelas),
                'dibuat' => $hitung('dibuat'),
                'dilewati' => $hitung('dilewati'),
            ],
            'rincian' => array_slice($rincian, 0, 200),
        ]);
    }

    public function update(Request $request, Kelas $kela)
    {
        $this->authorizeLembaga(auth()->user(), $kela->lembaga_id);

        $data = $request->validate([
            'tingkat' => ['nullable', 'string', 'max:20'],
            'nama_kelas' => ['sometimes', 'required', 'string', 'max:50'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ]);

        if (array_key_exists('urutan', $data) && $data['urutan'] === null) {
            // Kolom NOT NULL default 0: null dari form dianggap 0.
            $data['urutan'] = 0;
        }

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
