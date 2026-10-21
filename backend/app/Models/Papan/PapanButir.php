<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu butir pekerjaan di bawah sub-modul, dengan statusnya sendiri.
 *
 * `status` memakai workflow: backlog | todo | in_progress | for_review | done.
 * `keterangan` adalah requirement khusus pengguna; agen merisetnya, menyusun
 * subpoin, lalu mengosongkannya setelah subpoin tersimpan.
 */
class PapanButir extends Model
{
    protected $connection = 'papan';

    protected $table = 'papan_butir';

    protected $fillable = ['item_id', 'status', 'deskripsi', 'keterangan', 'subpoin', 'urutan'];

    protected function casts(): array
    {
        return ['subpoin' => 'array'];
    }

    /** @return BelongsTo<PapanItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(PapanItem::class, 'item_id');
    }
}
