<?php

namespace App\Services;

use App\Models\PsbCalonSantri;
use App\Models\User;
use App\Notifications\RingkasanAntreanNotification;
use Illuminate\Support\Facades\DB;

/**
 * Notifikasi ringkasan agregat per admin (database notifications, gratis).
 *
 * Notifikasi dikirim bila kelas RingkasanAntreanNotification tersedia
 * (fase lain); bila belum ada, method tetap menghitung antrean dan
 * mengembalikan jumlahnya tanpa gagal.
 */
class PsbSummaryNotificationService
{
    public function refreshBiodata(User $admin): int
    {
        $count = DB::table('pengajuan_biodata_santri as p')
            ->where('p.status', 'diajukan')
            ->where(function ($q) use ($admin) {
                $this->scopeTenant($q, $admin);
            })
            ->count();
        $this->kirim($admin, 'pengajuan_biodata_summary', $count, '/admin/biodata/pengajuan');

        return $count;
    }

    public function refreshDaftarUlang(User $admin): int
    {
        $count = PsbCalonSantri::where('status_pendaftaran', 'ajukan_daftar_ulang')
            ->where(function ($q) use ($admin) {
                $this->scopeCalon($q, $admin);
            })
            ->count();
        $this->kirim($admin, 'psb_daftar_ulang_summary', $count, '/admin/psb/antrean');

        return $count;
    }

    protected function kirim(User $admin, string $type, int $count, string $url): void
    {
        if (! class_exists(RingkasanAntreanNotification::class)) {
            return;
        }
        $admin->notify(new RingkasanAntreanNotification($type, $count, $url));
    }

    protected function scopeTenant($q, User $admin): void
    {
        if ($admin->bolehPesantren()) {
            return;
        }

        $ids = $admin->lembagaIds();
        $q->where(function ($sub) use ($ids) {
            $sub->whereExists(function ($inner) use ($ids) {
                $inner->select(DB::raw(1))
                    ->from('lembaga_santri as ls')
                    ->whereColumn('ls.santri_id', 'p.santri_id')
                    ->whereIn('ls.jenjang', $ids);
            })->orWhereNotExists(function ($inner) {
                $inner->select(DB::raw(1))
                    ->from('lembaga_santri as ls2')
                    ->whereColumn('ls2.santri_id', 'p.santri_id');
            });
        });
    }

    protected function scopeCalon($q, User $admin): void
    {
        if ($admin->bolehPesantren()) {
            return;
        }
        $q->whereIn('jenjang', $admin->lembagaIds() ?: [-1]);
    }
}
