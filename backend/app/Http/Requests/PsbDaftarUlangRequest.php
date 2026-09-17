<?php

namespace App\Http\Requests;

use App\Models\PsbCalonSantri;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class PsbDaftarUlangRequest extends FormRequest
{
    /** Otorisasi calon dipindah ke authorize() agar 403 tetap sebelum 422. */
    public function authorize(): bool
    {
        $calon = $this->route('calon');
        $user = $this->user();

        return $calon instanceof PsbCalonSantri
            && $user instanceof User
            && $calon->bolehDiaksesOleh($user);
    }

    public function rules(): array
    {
        return [
            'lolos' => ['nullable', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ];
    }
}
