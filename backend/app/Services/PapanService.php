<?php

namespace App\Services;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Operasi baca-tulis papan perkembangan proyek (koneksi \`papan\`).
 *
 * Satu pintu supaya aturan berikut berlaku di semua jalur (command artisan
 * maupun API nanti):
 * - status hanya boleh salah satu dari {@see self::STATUS};
 * - perpindahan status selalu meninggalkan jejak di \`papan_riwayat\`;
 * - kode sub-modul (mis. "E.3") unik per modul.
 */
class PapanService
{
    public const STATUS = ['sudah', 'sedang', 'akan', 'ditunda'];

    /**
     * Ringkasan seluruh papan: modul -> sub-modul -> butir.
     *
     * @return array<int, array<string, mixed>>
     */
    public function semua(): array
    {
        return PapanModul::query()
            ->with(['item.butir'])
            ->orderBy('urutan')
            ->get()
            ->map(fn (PapanModul $m) => [
                'kode' => $m->kode,
                'nama' => $m->nama,
                'urut' => (int) $m->urutan,
                'catatan' => $m->catatan,
                'sub' => $m->item->map(fn (PapanItem $i) => [
                    'kode' => $i->kode,
                    'nama' => $i->nama,
                    'status' => $i->status,
                    'rujukan' => $i->rujukan,
                    'butir' => $i->butir->map(fn (PapanButir $b) => [
                        'status' => $b->status,
                        'deskripsi' => $b->deskripsi,
                    ])->all(),
                ])->all(),
            ])
            ->all();
    }

    /**
     * Cari sub-modul lewat kodenya (mis. "E.3").
     *
     * @throws InvalidArgumentException bila kode tidak dikenal
     */
    public function item(string $kode): PapanItem
    {
        $item = PapanItem::query()->with(['modul', 'butir'])->where('kode', $kode)->first();

        if ($item === null) {
            $tersedia = PapanItem::query()->orderBy('kode')->pluck('kode')->implode(', ');

            throw new InvalidArgumentException("Sub-modul \`{$kode}\` tidak ada. Yang tersedia: {$tersedia}.");
        }

        return $item;
    }

    /**
     * Pindahkan status sebuah sub-modul dan catat jejaknya.
     *
     * @param  string  $kode  kode sub-modul, mis. "E.3"
     * @param  string  $status  salah satu {@see self::STATUS}
     * @param  string  $oleh  pencatat: \`agent\` atau \`pengguna\`
     * @param  string|null  $catatan  alasan singkat perpindahan
     *
     * @throws InvalidArgumentException bila status atau kode tidak sah
     */
    public function pindah(string $kode, string $status, string $oleh = 'agent', ?string $catatan = null): PapanItem
    {
        if (! in_array($status, self::STATUS, true)) {
            throw new InvalidArgumentException(
                "Status \`{$status}\` tidak dikenal. Pakai salah satu: ".implode(', ', self::STATUS).'.'
            );
        }

        $item = $this->item($kode);
        $asal = $item->status;

        if ($asal === $status && $catatan === null) {
            return $item;
        }

        DB::connection('papan')->transaction(function () use ($item, $asal, $status, $oleh, $catatan) {
            $item->update(['status' => $status]);

            PapanRiwayat::create([
                'item_id' => $item->id,
                'dari_status' => $asal,
                'ke_status' => $status,
                'catatan' => $catatan,
                'diubah_oleh' => $oleh,
                'waktu' => now(),
            ]);
        });

        return $item->refresh();
    }

    /**
     * Tambah butir di bawah sebuah sub-modul.
     *
     * @param  string  $status  status butir, salah satu {@see self::STATUS}
     */
    public function tambahButir(string $kode, string $status, string $deskripsi): PapanButir
    {
        if (! in_array($status, self::STATUS, true)) {
            throw new InvalidArgumentException(
                "Status \`{$status}\` tidak dikenal. Pakai salah satu: ".implode(', ', self::STATUS).'.'
            );
        }

        $item = $this->item($kode);

        $urutan = (int) PapanButir::query()->where('item_id', $item->id)->max('urutan');

        return PapanButir::create([
            'item_id' => $item->id,
            'status' => $status,
            'deskripsi' => $deskripsi,
            'urutan' => $urutan + 1,
        ]);
    }

    /**
     * Hapus satu butir milik sebuah sub-modul.
     *
     * @param  int  $butirId  id butir
     * @return bool true bila terhapus, false bila tidak ada / bukan milik kode itu
     */
    public function hapusButir(string $kode, int $butirId): bool
    {
        $item = $this->item($kode);

        return PapanButir::query()
            ->where('item_id', $item->id)
            ->where('id', $butirId)
            ->delete() > 0;
    }

    /**
     * Riwayat perpindahan status, terbaru lebih dulu.
     *
     * @return array<int, array<string, mixed>>
     */
    public function riwayat(?string $kode = null, int $batas = 20): array
    {
        return PapanRiwayat::query()
            ->with('item')
            ->when($kode !== null, fn ($q) => $q->whereHas('item', fn ($w) => $w->where('kode', $kode)))
            ->orderByDesc('waktu')
            ->orderByDesc('id')
            ->limit($batas)
            ->get()
            ->map(fn (PapanRiwayat $r) => [
                'kode' => $r->item?->kode,
                'dari' => $r->dari_status,
                'ke' => $r->ke_status,
                'catatan' => $r->catatan,
                'oleh' => $r->diubah_oleh,
                'waktu' => $r->waktu?->format('Y-m-d H:i'),
            ])
            ->all();
    }

    /**
     * Hitung jumlah sub-modul per status.
     *
     * @return array<string, int>
     */
    public function ringkasan(): array
    {
        $hasil = array_fill_keys(self::STATUS, 0);

        foreach (PapanItem::query()->selectRaw('status, count(*) as jumlah')->groupBy('status')->get() as $baris) {
            $hasil[$baris->status] = (int) $baris->jumlah;
        }

        return $hasil;
    }
}
