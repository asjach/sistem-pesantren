import { useState } from 'react';

/** Spinbox angka ringkas (−/+, commit saat blur/Enter) — versi netral untuk
 *  popover pengaturan (tabel & ukuran dropdown combobox).
 *
 *  Nilai yang diketik disimpan sebagai `draft` selama fokus supaya pengguna
 *  bisa menghapus isinya; commit dilakukan saat blur/Enter, dan selalu dijepit
 *  ke rentang `min`..`max`.
 *
 *  `lebar` mengunci lebar KOTAK spinbox; tanpa itu kotaknya mengikuti panjang
 *  angka (mis. "26" lebih sempit dari "160"), sehingga beberapa spinbox
 *  berjajar tak pernah rata. */
export default function SpinBox({
  id,
  value,
  min,
  max,
  step = 1,
  lebar,
  title,
  ariaLabel,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  /** Langkah tombol −/+ (bawaan 1). */
  step?: number;
  /** Lebar tetap kotak (px); absen = mengikuti panjang angka. */
  lebar?: number;
  title: string;
  ariaLabel: string;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const jepit = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = (raw: string | null) => {
    setDraft(null);
    if (raw === null || raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(jepit(n));
  };
  const stepBy = (d: number) => {
    const typed = draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
      ? Number(draft)
      : value;
    setDraft(null);
    onChange(jepit(typed + d));
  };
  const tombol = 'grid w-5 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40';
  const teks = draft ?? String(value);
  const lebarIsi = `calc(${Math.max(2, teks.length)}ch + 8px)`;
  const lebarTetap = lebar !== undefined;
  return (
    <div
      title={title}
      data-part="spinbox"
      className="flex h-6 items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring/30"
      style={lebarTetap ? { width: `${lebar}px` } : undefined}
    >
      <button type="button" id={`${id}_kurang`} aria-label={`${ariaLabel} kurang`} disabled={value <= min} className={tombol} onClick={() => stepBy(-step)}>
        <span aria-hidden className="text-sm leading-none">−</span>
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}

        className={lebarTetap
          ? 'min-w-0 flex-1 border-x border-input bg-transparent px-0 text-center text-xs outline-none'
          : 'border-x border-input bg-transparent px-0 text-center text-xs outline-none'}
        style={lebarTetap ? undefined : { width: lebarIsi }}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <button type="button" id={`${id}_tambah`} aria-label={`${ariaLabel} tambah`} disabled={value >= max} className={tombol} onClick={() => stepBy(step)}>
        <span aria-hidden className="text-sm leading-none">+</span>
      </button>
    </div>
  );
}
