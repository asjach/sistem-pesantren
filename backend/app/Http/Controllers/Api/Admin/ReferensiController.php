<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReferensiStoreRequest;
use App\Http\Requests\Admin\ReferensiUpdateRequest;
use App\Models\Lembaga;
use App\Services\RefService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CRUD kamus per lembaga (tanpa baris global): super_admin menambah nilai
 * ke SEMUA lembaga operasional sekaligus (fan-out); tiap lembaga
 * mengaktifkan/menonaktifkan miliknya sendiri.
 *
 * POST menerima `jenjang` sebagai string (satu lembaga), array (beberapa
 * lembaga sekaligus — checkbox "Lembaga" di form Tambah entri), atau kosong
 * (fan-out ke semua).
 */
class ReferensiController extends Controller
{
    use FilterGlobal;

    protected function mustLembaga($actor, ?string $jenjang = null): string
    {
        if ($jenjang !== null && $jenjang !== '') {
            $this->canLembaga($actor, $jenjang) || abort(403, 'Di luar lembaga Anda.');

            return $jenjang;
        }
        $ids = $actor->lembagaIds();
        if (count($ids) === 1) {
            return $ids[0];
        }
        abort(422, 'jenjang wajib (pilih lembaga dulu).');
    }

    protected function canLembaga($actor, string $lembagaId): bool
    {
        return $actor->canAccessLembaga($lembagaId);
    }

    /**
     * Kolom tambahan kamus mapel (`ref_mapel.kode` & `ref_mapel.singkatan`).
     *
     * Tipe kamus lain tak punya kolomnya, jadi hasilnya kosong untuk mereka —
     * pemanggil bisa langsung menggabungkannya ke payload insert/update. Teks
     * kosong disimpan sebagai `null` supaya kolomnya benar-benar "belum diisi",
     * bukan string kosong.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, string|null>
     */
    protected function kolomTambahanMapel(string $tipe, array $data): array
    {
        if ($tipe !== 'mapel') {
            return [];
        }

        $bersih = function (string $kunci) use ($data): ?string {
            $nilai = trim((string) ($data[$kunci] ?? ''));

            return $nilai === '' ? null : $nilai;
        };

        return ['kode' => $bersih('kode'), 'singkatan' => $bersih('singkatan')];
    }

    public function index(Request $request, string $tipe)
    {
        $actor = $request->user();
        $lembagaIds = $this->nilaiFilter($request, 'jenjang');
        foreach ($lembagaIds as $lembagaId) {
            $this->canLembaga($actor, $lembagaId) || abort(403);
        }

        if ($lembagaIds !== []) {
            $rows = [];
            foreach ($lembagaIds as $lembagaId) {
                array_push($rows, ...($request->boolean('termasuk_nonaktif')
                    ? RefService::semua($tipe, $lembagaId)
                    : RefService::effective($tipe, $lembagaId)));
            }

            return response()->json($rows);
        }

        // Tanpa filter = Semua: gabung baris seluruh lembaga yang boleh
        // diakses (termasuk nonaktif, untuk kelola + pulihkan per baris).
        $ids = $actor->bolehPesantren()
            ? Lembaga::orderBy('jenjang')->pluck('jenjang')->all()
            : $actor->lembagaIdsDenganPasangan();
        $rows = [];
        foreach ($ids as $lid) {
            array_push($rows, ...RefService::semua($tipe, $lid));
        }

        return response()->json($rows);
    }

    /** Pulihkan baris lembaga yang nonaktif ("Tampilkan kembali"). */
    public function pulihkan(Request $request, string $tipe, int $id)
    {
        $actor = $request->user();
        RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $table = RefService::table($tipe);
        $row = DB::table($table)->find($id) ?? abort(404);

        if (is_null($row->jenjang)) {
            abort(422, 'Baris global selalu tampil; tidak ada yang perlu dipulihkan.');
        }
        if (! $this->canLembaga($actor, $row->jenjang)) {
            abort(403, 'Di luar lembaga Anda.');
        }

        DB::table($table)->where('id', $id)->update(['is_active' => true]);
        RefService::forget($row->jenjang);
        RefService::forgetAlamat($row->jenjang);

        return response()->json(DB::table($table)->find($id));
    }

    public function store(ReferensiStoreRequest $request, string $tipe)
    {
        $actor = $request->user();
        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);
        $key = RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');

        $data = $request->validated();

        if ($isStatus && $request->hasAny(['is_aktif_bawaan', 'terminal_ke']) && ! $actor->bolehSuperAdmin()) {
            abort(403, 'Sifat status hanya super_admin.');
        }

        $table = RefService::table($tipe);

        // Daftar lembaga (checkbox): satu permintaan untuk semua pilihan,agency
        // yang sudah punya nilainya dilewati — sama seperti fan-out "semua".
        $pilih = $request->input('jenjang');
        if (is_array($pilih)) {
            $lembagas = array_values(array_unique(array_filter(array_map(
                static fn ($j) => trim((string) $j),
                $pilih,
            ))));
            foreach ($lembagas as $lid) {
                $this->canLembaga($actor, $lid) || abort(403, 'Di luar lembaga Anda.');
            }
            // Array kosong = tak ada yang dicentang (bukan fan-out "semua";
            // fan-out hanya lewat `jenjang` yang tak dikirim sama sekali).
            if ($lembagas === []) {
                abort(422, 'Pilih minimal satu lembaga.');
            }

            return $this->storeSebar($actor, $tipe, $table, $key, $isStatus, $data, $lembagas);
        }

        // Tanpa jenjang = super_admin menambah ke SEMUA lembaga sekaligus.
        $targetLembaga = $data['jenjang'] ?? null;
        if (is_null($targetLembaga)) {
            if (! $actor->bolehSuperAdmin()) {
                $targetLembaga = $this->mustLembaga($actor);
            } else {
                return $this->storeSebar($actor, $tipe, $table, $key, $isStatus, $data);
            }
        } elseif (! $this->canLembaga($actor, $targetLembaga)) {
            abort(403);
        }

        if ($isStatus) {
            $q = DB::table($table)->where('kode', $data['kode'])
                ->where('jenjang', $targetLembaga);
            if ($q->first()) {
                abort(422, 'Kode sudah ada.');
            }
            // Custom lembaga: sifat netral (non-aktif, non-terminal); nama/urutan ikut input.
            $id = DB::table($table)->insertGetId([
                'jenjang' => $targetLembaga, 'kode' => $data['kode'],
                'nama' => $data['nama'] ?? $data['kode'],
                'is_aktif_bawaan' => false, 'terminal_ke' => null,
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ]);
        } else {
            // Cegah duplikat dalam lembaga yang sama.
            if (DB::table($table)->where('jenjang', $targetLembaga)->where('nama', $data['nama'])->exists()) {
                abort(422, 'Nilai sudah ada.');
            }
            $id = DB::table($table)->insertGetId([
                'jenjang' => $targetLembaga, 'nama' => $data['nama'],
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ] + $this->kolomTambahanMapel($tipe, $data));
        }

        RefService::forget($targetLembaga);
        RefService::forgetAlamat($targetLembaga);

        return response()->json(DB::table($table)->find($id), 201);
    }

    /**
     * Tambah satu nilai ke banyak lembaga sekaligus (tanpa baris global).
     * `$lembagas` kosong = SEMUA lembaga operasional; kalau diisi, hanya
     * lembaga pilihan itu. Lembaga yang sudah punya kuncinya dilewati;
     * bila tak ada yang terbentuk → 422.
     *
     * @param  list<string>|null  $lembagas
     */
    protected function storeSebar($actor, string $tipe, string $table, string $key, bool $isStatus, array $data, ?array $lembagas = null)
    {
        if ($isStatus) {
            $atribut = [
                $key => $data['kode'],
                'nama' => $data['nama'] ?? $data['kode'],
                'is_aktif_bawaan' => false, 'terminal_ke' => null,
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ];
        } else {
            $atribut = [
                $key => $data['nama'],
                'urutan' => $data['urutan'] ?? 0, 'is_active' => true,
            ] + $this->kolomTambahanMapel($tipe, $data);
        }

        $lembagas ??= Lembaga::orderBy('jenjang')->pluck('jenjang')->all();
        $terbentuk = RefService::sebar($table, $key, $atribut, $lembagas);
        if (empty($terbentuk)) {
            abort(422, 'Nilai sudah ada di semua lembaga yang dipilih.');
        }

        return response()->json([
            'pesan' => 'Nilai ditambahkan ke '.count($terbentuk).' lembaga.',
            'data' => $terbentuk,
        ], 201);
    }

    public function update(ReferensiUpdateRequest $request, string $tipe, int $id)
    {
        $actor = $request->user();
        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);
        RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $table = RefService::table($tipe);
        $row = DB::table($table)->find($id) ?? abort(404);
        if (is_null($row->jenjang)) {
            // Warisan global (pra fan-out): tak dikelola lagi.
            abort(422, 'Baris global tidak dipakai lagi.');
        }
        if (! $this->canLembaga($actor, $row->jenjang)) {
            abort(403, 'Di luar lembaga Anda.');
        }

        // Kode (status) TIDAK diubah: kunci yang dipakai data pemakai.
        // Nama (status & kamus) boleh diubah walau konsumen string bebas tanpa FK.
        $data = $request->validated();

        $upd = ['urutan' => $data['urutan'] ?? $row->urutan];
        if (! $isStatus) {
            // Cegah bentrok nama dalam lembaga yang sama.
            $q = DB::table($table)->where('nama', $data['nama'])->where('id', '!=', $id)
                ->where('jenjang', $row->jenjang);
            if ($q->exists()) {
                abort(422, 'Nilai sudah ada.');
            }
        }
        $upd['nama'] = $data['nama'];
        // Kolom tambahan kamus mapel boleh diperbaiki; tipe lain tak punya
        // kolomnya sehingga hasil helper kosong.
        $upd += $this->kolomTambahanMapel($tipe, $data);

        DB::table($table)->where('id', $id)->update($upd);
        RefService::forget($row->jenjang);
        RefService::forgetAlamat($row->jenjang);

        return response()->json(DB::table($table)->find($id));
    }

    public function destroy(Request $request, string $tipe, int $id)
    {
        $actor = $request->user();
        $table = RefService::table($tipe);
        $key = RefService::KEY[$tipe] ?? abort(422, 'Tipe tidak valid.');
        $row = DB::table($table)->find($id) ?? abort(404);
        if (is_null($row->jenjang)) {
            abort(422, 'Baris global tidak dipakai lagi.');
        }
        if (! $this->canLembaga($actor, $row->jenjang)) {
            abort(403);
        }
        // Hapus permanen: baris benar-benar dibuang (data pemakai yang
        // menyimpan teksnya tidak ikut berubah — konsumen string bebas).
        if ($request->boolean('permanen')) {
            DB::table($table)->where('id', $id)->delete();
            RefService::forget($row->jenjang);
            RefService::forgetAlamat($row->jenjang);

            return response()->json(['pesan' => 'Data referensi dihapus permanen.']);
        }
        // Padam = milik lembaga sendiri (tiap lembaga punya barisnya).
        DB::table($table)->where('id', $id)->update(['is_active' => false]);
        RefService::forget($row->jenjang);
        RefService::forgetAlamat($row->jenjang);

        return response()->json(['pesan' => 'Data referensi berhasil dinonaktifkan']);
    }

    /** Daftar tipe untuk dropdown FE. */
    public function types()
    {
        return response()->json(array_keys(RefService::KEY));
    }
}
