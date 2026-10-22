import { useEffect, useRef } from 'react';
import type { ExcelField } from '@/components/excel/types';
import { bisaInput, type BarisInputV2State } from './useBarisInputV2';

/** Editor row input memakai state record baru, terpisah dari edit sel lama. */
export default function SelInputV2({ field, state, tableKey }: {
  field: ExcelField; state: BarisInputV2State; tableKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.focusKey !== field.key || state.menyimpan) return;
    ref.current?.querySelector<HTMLElement>('input, select')?.focus();
    // Perubahan galat saat mengetik tidak boleh merebut focus. Pemindahan
    // focus hanya mengikuti buka mode, hasil submit, dan selesai request.
  }, [state.generasi, state.menyimpan, field.key]);
  const raw = state.nilai[field.key] ?? '';
  const tipe = field.inputKind ?? field.kind;
  const pilihan = typeof field.inputChoices === 'function'
    ? field.inputChoices(state.nilai) : (field.inputChoices ?? field.choices ?? []);
  const errorId = `galat_input_${tableKey}_${field.key}`;
  const props = {
    id: `input_baris_${tableKey}_${field.key}`,
    'aria-label': field.label,
    'aria-invalid': !!state.galat[field.key],
    'aria-describedby': state.galat[field.key] ? errorId : undefined,
    'aria-required': !!field.required,
    disabled: state.menyimpan,
    className: 'h-full w-full min-w-0 border border-input bg-background px-1 text-inherit focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary aria-[invalid=true]:border-destructive',
  };
  return (
    <div ref={ref} data-baris-input={field.key} data-col-key={field.key}
      className="flex h-full min-w-0 w-full items-center bg-primary/5 px-1"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void state.simpan(); }
        if (e.key === 'Escape') { e.preventDefault(); state.batal(); }
      }}>
      {!bisaInput(field) ? <span className="truncate">{raw}</span>
        : tipe === 'select' ? (
          <select {...props} value={raw} onChange={(e) => state.ubah(field.key, e.target.value || null)}>
            <option value="">Pilih…</option>
            {pilihan.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        ) : tipe === 'toggle' ? (
          <input {...props} type="checkbox" checked={raw === 'ya'}
            onChange={(e) => state.ubah(field.key, e.target.checked ? 'ya' : 'tidak')} />
        ) : (
          <input {...props} value={raw} maxLength={field.maxLength}
            onChange={(e) => state.ubah(field.key, e.target.value)} />
        )}
      {state.galat[field.key] && <span id={errorId} className="sr-only">{state.galat[field.key]}</span>}
    </div>
  );
}
