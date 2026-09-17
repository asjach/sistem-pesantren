import { AlignCenter, AlignLeft, AlignRight } from '@/icons';
import type { AlignName } from '@/components/GridPrefs';
import { cn } from '@/lib/utils';

/** Tombol segmented perataan kolom (kiri/tengah/kanan) untuk satu field.
 *  Perataan bersifat global per field (berlaku di semua tabel), jadi
 *  langsung tersimpan saat diklik — tidak menunggu Simpan preset. */
export default function AlignToggle({
  fieldKey,
  sumber,
  align,
  onSet,
}: {
  fieldKey: string;
  /** Sumber kontrol (semua/terpilih) — bagian dari id agar unik di DOM. */
  sumber: 'semua' | 'terpilih';
  align: AlignName;
  onSet: (fieldKey: string, a: AlignName) => void;
}) {
  const opsi = [
    { nilai: 'left' as const, id: 'kiri', label: 'Kiri', Icon: AlignLeft },
    { nilai: 'center' as const, id: 'tengah', label: 'Tengah', Icon: AlignCenter },
    { nilai: 'right' as const, id: 'kanan', label: 'Kanan', Icon: AlignRight },
  ];
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Perataan ${fieldKey}`}>
      {opsi.map(({ nilai, id, label, Icon }) => (
        <button
          key={nilai}
          id={`btn_align_${id}_${sumber}_${fieldKey}`}
          type="button"
          title={`Rata ${label.toLowerCase()} (berlaku semua tabel)`}
          aria-label={`Rata ${label.toLowerCase()}`}
          aria-pressed={align === nilai}
          onClick={() => onSet(fieldKey, nilai)}
          className={cn(
            'grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            align === nilai && 'bg-accent text-foreground',
          )}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
