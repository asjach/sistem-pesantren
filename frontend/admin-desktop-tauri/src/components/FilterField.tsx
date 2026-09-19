import { Children, cloneElement, isValidElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger } from '@/components/ui/select';
import { daftarkanFilter, hapusFilter, pakaiLebarFilter } from './excel/lebarFilter';

/** Pembungkus kontrol filter toolbar tabel: label kecil di atas kontrol.
 *
 *  Bila ter-render di dalam toolbar tabel (konteks lebar tersedia), punya
 *  `htmlFor`, dan `kelolaLebar` tidak dimatikan, filter otomatis terdaftar
 *  di tab Kontrol Kelola tabel (kunci = `htmlFor`) dengan lebar bawaan
 *  terukur — dan override lebar tersimpan diterapkan ke kontrol anak via
 *  `style`. Tanpa override, anak Select diseragamkan 100px (bawaan toolbar);
 *  anak bukan Select (mis. input tanggal) memakai lebar alami. Kontrol
 *  bawaan toolbar (Urutkan, Kolom) mematikan ini karena lebarnya sudah
 *  diatur lewat jalur kontrol. Di luar toolbar: polos seperti semula. */
export default function FilterField({ label, htmlFor, children, className, kelolaLebar = true }: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Daftarkan ke kelola lebar filter (matikan untuk kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
}) {
  const konteks = pakaiLebarFilter();
  const ref = useRef<HTMLSpanElement>(null);
  const kunci = konteks && htmlFor && kelolaLebar ? htmlFor : '';
  const override = kunci ? konteks?.lebar[kunci] : undefined;

  useEffect(() => {
    if (!konteks || !kunci) return;
    // Ukur bawaan halaman hanya bila tak ada override aktif, agar angka
    // awal tidak tercemar setelan tersimpan.
    const px = override === undefined && ref.current ? Math.round(ref.current.offsetWidth) : undefined;
    daftarkanFilter(konteks.tableKey, kunci, label, px && px > 0 ? px : undefined);
    return () => hapusFilter(konteks.tableKey, kunci);
  }, [konteks, kunci, label, override]);

  let isi = children;
  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement<{ style?: CSSProperties; children?: ReactNode }>)
    : null;
  // Tanpa override: anak Select diseragamkan 100px (bawaan toolbar).
  const lebarBawaan = anakTunggal && anakTunggal.type === Select ? 100 : undefined;
  const lebarEfektif = override ?? lebarBawaan;
  if (lebarEfektif !== undefined && anakTunggal) {
    const el = anakTunggal;
    if (el.type === Select) {
      // Select Root tak me-render DOM (Fragment): teruskan lebar ke Trigger di dalamnya.
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

  return (
    <span ref={ref} className={cn('flex flex-col gap-0.5', className)}>
      <label htmlFor={htmlFor} className="text-[11px] leading-tight text-muted-foreground">
        {label}
      </label>
      {isi}
    </span>
  );
}
