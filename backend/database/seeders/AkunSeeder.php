<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Akun bawaan (dev): reviewer lintas sesi + akun dev. Idempoten
 * (updateOrCreate per email) sehingga aman dijalankan ulang.
 */
class AkunSeeder extends Seeder
{
    public function run(): void
    {
        $akun = [
            ['Reviewer Sementara', 'reviewer.tmp@example.com', '081200000001', 'password', 'super_admin'],
            ['Asjach', 'asjach@gmail.com', '081200000002', 'rahayu45', 'super_admin'],
            ['Reviewer Orang Tua', 'reviewer.orangtua@simpes.local', '081200000003', 'password', 'orang_tua'],
            ['Reviewer Santri', 'reviewer.santri@simpes.local', '081200000004', 'password', 'santri'],
        ];
        foreach ($akun as [$nama, $email, $phone, $password, $role]) {
            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $nama, 'phone' => $phone, 'password' => $password],
            );
            $user->syncRoles([$role]);
        }
    }
}
