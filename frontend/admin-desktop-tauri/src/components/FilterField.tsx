import { Children, cloneElement, isValidElement, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger } from '@/components/ui/select';
import ComboCari from './ComboCari';
import { LEBAR_BAWAHAN_FILTER } from './kelolaTabel/jenis';
import { useLebarFilter } from './excel/lebarFilter';
import { useSetelanKomponen } from './komponenCustom';

/** Pembungkus kontrol filter toolbar tabel: label kecil di atas kontrol.
 *
 *  Bila ter-render di dalam toolbar tabel (konteks tersedia), punya
 *  `htmlFor`, dan `kelolaLebar` tidak dimatikan, lebar tersimpan pada setelan
 *  komponen (dari popover klik-kanan kontrol) diterapkan ke kontrol anak via
 *  `style`.
 *  Tanpa override, anak Select/ComboCari memakai `LEBAR_BAWAHAN_FILTER`;
 *  anak selain combobox (mis. input tanggal) memakai lebar alami. Di luar
 *  toolbar: polos seperti semula. */
export default function FilterField({ label, htmlFor, children, className, kelolaLebar = true, sejajar = false }: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Daftarkan ke kelola lebar filter (matikan untuk kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  /** Label sejajar horizontal dengan kontrol (bukan di atasnya). Dipakai di
   *  luar toolbar, mis. baris filter halaman Rekap Santri. */
  sejajar?: boolean;
}) {
  const konteks = useLebarFilter();
  const ref = useRef<HTMLSpanElement>(null);
  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement<{ style?: CSSProperties; children?: ReactNode }>)
    : null;
  const anakCombobox = anakTunggal?.type === Select || anakTunggal?.type === ComboCari;
  const kunci = konteks && htmlFor && kelolaLebar && anakCombobox ? htmlFor : '';

  const override = useSetelanKomponen(konteks?.tableKey ?? '', kunci).lebar;

  let isi = children;
  const lebarBawaan = kunci && anakTunggal && anakCombobox ? LEBAR_BAWAHAN_FILTER : undefined;
  const lebarEfektif = override ?? lebarBawaan;
  if (lebarEfektif !== undefined && anakTunggal) {
    const el = anakTunggal;
    if (el.type === Select) {

      const anak = Children.map(el.props.children, (c) => {
        if (isValidElement(c) && (c.type as unknown) === SelectTrigger) {
          const p = c.props as { style?: CSSProperties };
          return cloneElement(c, { style: { ...(p.style ?? {}), width: `${lebarEfektif}px` } } as { style?: CSSProperties });
        }
        return c;
      });
      isi = cloneElement(el, { ...el.props, children: anak });
    } else {
      isi = cloneElement(el, { style: { ...(el.props.style ?? {}), width: `${lebarEfektif}px` } });
    }
  }

  const mendatar = konteks || sejajar;
  return (
    <span ref={ref} className={cn(mendatar ? 'flex items-center gap-1.5' : 'flex flex-col gap-0.5', className)}>
      <label
        htmlFor={htmlFor}
        className={cn('text-[11px] text-muted-foreground', mendatar ? 'leading-none whitespace-nowrap' : 'leading-tight')}
      >
        {label}
      </label>
      {isi}
    </span>
  );
}
