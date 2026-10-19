<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

/** Validasi formulir generate tagihan massal. */
class TagihanGenerateRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'jatuh_tempo' => 'nullable|date',
            'nominal' => 'required|integer|min:0',
            'santri' => 'required|array|min:1',
            'santri.*.santri_id' => 'required|integer',
            'santri.*.nominal' => 'nullable|integer|min:0',
        ];
    }

    /** ID integer diperiksa ganda dan keberadaannya sekaligus untuk seluruh batch. */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $items = $this->input('santri');
            if (! is_array($items)) {
                return;
            }
            $ids = [];
            foreach ($items as $index => $item) {
                if (is_array($item) && isset($item['santri_id'])
                    && ! $validator->errors()->has("santri.{$index}.santri_id")) {
                    $ids[$index] = (int) $item['santri_id'];
                }
            }
            if ($ids === []) {
                return;
            }
            $jumlah = array_count_values($ids);
            $ada = collect(array_unique($ids))->chunk(1000)
                ->flatMap(fn ($lot) => DB::table('santri')->whereIn('id', $lot)->pluck('id'))
                ->flip();
            foreach ($ids as $index => $id) {
                if ($jumlah[$id] > 1) {
                    $validator->addFailure("santri.{$index}.santri_id", 'Distinct');
                }
                if (! $ada->has($id)) {
                    $validator->addFailure("santri.{$index}.santri_id", 'Exists', ['santri', 'id']);
                }
            }
        }];
    }
}
