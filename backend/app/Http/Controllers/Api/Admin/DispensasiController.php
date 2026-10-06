<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DispensasiIndexRequest;
use App\Http\Requests\Admin\DispensasiRequest;
use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Tagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use Illuminate\Support\Facades\DB;

/** Keuangan: dispensasi (keringanan) tagihan. */
class DispensasiController extends Controller
{
    use KeuanganLembaga;
    use TenantGuard;
    use UrutDaftar;

    /**
     * Daftar dispensasi. Filter TA/jenis/status; `santri_id` = hanya yang
     * berlaku untuk santri itu (dipakai profil santri).
     */
    public function indexDispensasi(DispensasiIndexRequest $request)
    {
        $data = $request->validated();

        $q = Dispensasi::with(['aturan.jenis', 'santriTambahan']);
        if (! empty($data['tahun_ajaran'])) {
            $q->where('tahun_ajaran', $data['tahun_ajaran']);
        }
        if (! empty($data['jenis_id'])) {
            $jenisId = (int) $data['jenis_id'];
            $q->whereHas('aturan', fn ($w) => $w->whereNull('jenis_id')->orWhere('jenis_id', $jenisId));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_dispensasi'));
        if ($urut === null) {
            $q->orderBy('tahun_ajaran')->orderBy('nama');
        } else {
            $this->terapkanUrut($q, $urut, [['dispensasi.tahun_ajaran', 'naik'], ['dispensasi.nama', 'naik']]);
        }

        $daftar = $q->get();

        if (! empty($data['santri_id'])) {
            if (empty($data['tahun_ajaran'])) {
                abort(422, 'Sertakan tahun ajaran untuk melihat dispensasi satu santri.');
            }
            $peta = $this->petaSantriGenerate($data['tahun_ajaran'], [(int) $data['santri_id']]);
            $info = $peta[(int) $data['santri_id']] ?? null;
            if ($info === null) {
                return response()->json([]);
            }
            $this->canLembaga($request->user(), $info['jenjang_utama']) || abort(403);
            $daftar = app(DispensasiService::class)->saring($daftar, (int) $data['santri_id']);
        }

        return response()->json($daftar->values());
    }

    public function storeDispensasi(DispensasiRequest $request)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);

        $dispensasi = DB::transaction(function () use ($data) {
            $d = Dispensasi::create($this->bersihkanDispensasi($data));
            $this->simpanAturan($d, $data['aturan']);
            $d->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));

            return $d;
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan']), 201);
    }

    public function updateDispensasi(DispensasiRequest $request, Dispensasi $dispensasi)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);
        DB::transaction(function () use ($dispensasi, $data) {
            $dispensasi->update($this->bersihkanDispensasi($data));
            $this->simpanAturan($dispensasi, $data['aturan']);
            $dispensasi->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan']));
    }

    public function destroyDispensasi(Dispensasi $dispensasi)
    {
        if (Tagihan::whereJsonContains('dispensasi_ids', $dispensasi->id)->exists()) {
            abort(422, 'Dispensasi sudah dipakai tagihan. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }
        $dispensasi->delete();

        return response()->json(['pesan' => 'Dispensasi dihapus.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validasiDispensasi(DispensasiRequest $request): array
    {
        $data = $request->validated();
        $data['aturan'] = $this->normalisasiAturan($data['aturan']);
        foreach ($data['aturan'] as $a) {
            if ($a['tipe'] === 'persen' && $a['nilai'] > 100) {
                abort(422, 'Nilai persen maksimal 100.');
            }
        }

        return $data;
    }

    /**
     * Normalisasi daftar aturan: dedupe per jenis (`jenis_id` null = semua
     * jenis, bila ada harus menjadi satu-satunya baris).
     *
     * @return list<array{jenis_id: ?int, tipe: string, nilai: int}>
     */
    private function normalisasiAturan(mixed $nilai): array
    {
        if (! is_array($nilai)) {
            abort(422, 'Aturan dispensasi tidak valid.');
        }
        $perJenis = [];
        foreach ($nilai as $a) {
            if (! is_array($a)) {
                continue;
            }
            $jenisId = ($a['jenis_id'] ?? null) === null || ($a['jenis_id'] ?? '') === ''
                ? null
                : (int) $a['jenis_id'];
            $kunci = $jenisId === null ? 'semua' : "jenis-{$jenisId}";
            $perJenis[$kunci] ??= [
                'jenis_id' => $jenisId,
                'tipe' => in_array($a['tipe'] ?? null, ['persen', 'nominal', 'bebas'], true) ? $a['tipe'] : 'nominal',
                'nilai' => max(0, (int) ($a['nilai'] ?? 0)),
            ];
        }
        $hasil = array_values($perJenis);
        if ($hasil === []) {
            abort(422, 'Isi minimal satu jenis tagihan.');
        }
        if (count($hasil) > 1 && array_any($hasil, fn ($a) => $a['jenis_id'] === null)) {
            abort(422, 'Aturan "semua jenis" harus berdiri sendiri.');
        }

        return $hasil;
    }

    /**
     * Lingkup lembaga mengikuti jenis tagihan yang dipilih: aturan semua
     * jenis atau seluruh jenis berjenjang global → super_admin saja;
     * selain itu tiap jenjang jenis wajib boleh diakses.
     *
     * @param  array<string, mixed>  $data
     */
    private function authorizeDispensasi($actor, array $data): void
    {
        $aturan = $data['aturan'] ?? [];
        if (array_any($aturan, fn ($a) => ($a['jenis_id'] ?? null) === null)) {
            $actor->bolehSuperAdmin() || abort(403, 'Dispensasi semua jenis hanya boleh dibuat super_admin.');
        }
        $ids = array_values(array_unique(array_map(
            fn ($a) => (int) $a['jenis_id'],
            array_filter($aturan, fn ($a) => ($a['jenis_id'] ?? null) !== null)
        )));
        if ($ids === []) {
            return;
        }
        $jenjang = JenisTagihan::whereIn('id', $ids)->pluck('jenjang')
            ->filter(fn ($j) => $j !== null && $j !== '')->unique()->values()->all();
        if ($jenjang === []) {
            $actor->bolehSuperAdmin() || abort(403, 'Dispensasi jenis global hanya boleh dibuat super_admin.');
        }
        $this->authorizeLembagaMany($actor, array_map('strval', $jenjang));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function bersihkanDispensasi(array $data): array
    {
        unset($data['aturan'], $data['santri_ids']);

        return $data;
    }

    /** Simpan ulang daftar aturan satu paket dispensasi. */
    private function simpanAturan(Dispensasi $dispensasi, array $aturan): void
    {
        $dispensasi->aturan()->delete();
        $sekarang = now();
        $baris = array_map(fn ($a) => [
            'jenis_id' => $a['jenis_id'],
            'tipe' => $a['tipe'],
            'nilai' => $a['nilai'],
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ], $aturan);
        $dispensasi->aturan()->createMany($baris);
    }

    /** Normalisasi daftar santri tambahan menjadi id unik terurut. */
    private function normalisasiSantriIds(mixed $nilai): array
    {
        if (! is_array($nilai)) {
            return [];
        }
        $ids = array_values(array_unique(array_map('intval', array_filter($nilai, fn ($v) => $v !== null && $v !== ''))));
        sort($ids);

        return array_values(array_filter($ids, fn ($id) => $id > 0));
    }
}
