<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;

class UsersImport implements ToModel, WithHeadingRow, WithValidation
{
    protected array $lembagaIds;
    protected array $allowedRoles;

    protected array $seenIdentifiers = [];

    public function __construct(array $lembagaIds, array $allowedRoles)
    {
        $this->lembagaIds = $lembagaIds;
        $this->allowedRoles = $allowedRoles;
    }

    public function model(array $row): Model|array|null
    {
        $email = isset($row['email']) ? strtolower(trim((string) $row['email'])) : null;
        $phone = isset($row['phone']) ? trim((string) $row['phone']) : null;
        $username = isset($row['username']) ? trim((string) $row['username']) : null;
        $key = ($email ?: '') . '|' . ($phone ?: '') . '|' . ($username ?: '');

        if (in_array($key, $this->seenIdentifiers, true)) {
            return null;
        }
        $this->seenIdentifiers[] = $key;

        $user = User::create([
            'name' => $row['name'],
            'email' => $email ?: null,
            'phone' => $phone ?: null,
            'username' => $username ?: null,
            'password' => $row['password'],
            'email_verified_at' => now(),
        ]);

        // Pivot tenant user_lembaga (users tanpa kolom tenant).
        foreach ($this->lembagaIds as $lid) {
            \Illuminate\Support\Facades\DB::table('user_lembaga')->insert([
                'user_id' => $user->id, 'lembaga_id' => (int) $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        if (! empty($row['roles'])) {
            $requested = array_map('trim', explode(',', (string) $row['roles']));
            $filtered = array_values(array_intersect($requested, $this->allowedRoles));
            if (! empty($filtered)) {
                $user->assignRole($filtered);
            }
        }

        return $user;
    }

    /**
     * Key flat (tanpa '*.') — ToModel + WithValidation validasi per baris.
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'required_without_all:phone,username', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:users,phone'],
            'username' => ['nullable', 'string', 'max:50', 'unique:users,username'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['required', 'string'],
        ];
    }
}
