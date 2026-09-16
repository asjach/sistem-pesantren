<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Akun bawaan (dev): reviewer lintas sesi + akun dev. Idempoten
 * (updateOrCreate per email) sehingga aman dijalankan ulang.
 */
class AkunSeeder extends Seeder
{
    public function run(): void
    {
        $akun = [
            ['Reviewer Sementara', 'reviewer.tmp@example.com', '081200000001', 'rahayu45', 'super_admin'],
            ['Asjach', 'asjach@gmail.com', '081200000002', 'rahayu45', 'super_admin'],
            ['Reviewer Orang Tua', 'reviewer.orangtua@simpes.local', '081200000003', 'rahayu45', 'orang_tua'],
            ['Reviewer Santri', 'reviewer.santri@simpes.local', '081200000004', 'rahayu45', 'santri'],
        ];
        foreach ($akun as [$nama, $email, $phone, $password, $role]) {
            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $nama, 'phone' => $phone, 'password' => $password],
            );
            $user->syncRoles([$role]);
        }

        // Admin pesantren: role admin tanpa pivot (akses semua lembaga).
        User::updateOrCreate(
            ['email' => 'admin.pesantren@simpes.local'],
            ['name' => 'Admin Pesantren', 'phone' => '081200000005', 'password' => 'rahayu45'],
        )->syncRoles(['admin']);

        // Admin lembaga: role admin + satu pivot (lembaga unit pertama yang ada).
        $adminLembaga = User::updateOrCreate(
            ['email' => 'admin.lembaga@simpes.local'],
            ['name' => 'Admin Lembaga', 'phone' => '081200000006', 'password' => 'rahayu45'],
        );
        $adminLembaga->syncRoles(['admin']);
        $lembaga = Lembaga::where('kode', 'MTS')->first()
            ?? Lembaga::whereNotNull('parent_id')->orderBy('id')->first()
            ?? Lembaga::orderBy('id')->first();
        if ($lembaga) {
            DB::table('user_lembaga')->updateOrInsert(
                ['user_id' => $adminLembaga->id, 'lembaga_id' => $lembaga->id],
                ['created_at' => now(), 'updated_at' => now()],
            );
            $this->command?->info("Admin Lembaga terhubung ke {$lembaga->nama} ({$lembaga->kode}).");
        } else {
            $this->command?->warn('Belum ada lembaga: Admin Lembaga dibuat tanpa pivot (jadi admin-full sementara).');
        }
    }
}
