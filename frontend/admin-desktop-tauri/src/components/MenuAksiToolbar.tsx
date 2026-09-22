import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from '@/icons';

/** Ratakan tombol aksi (boleh fragment/bersyarat) jadi daftar elemen. */
function ratakan(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(...ratakan((child.props as { children?: ReactNode }).children));
      return;
    }
    out.push(child);
  });
  return out;
}

/** Ambil teks label dari isi tombol (elemen ikon diabaikan). */
function teksLabel(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(teksLabel).join('');
  return '';
}

export interface MenuAksiToolbarProps {
  /** Tombol aksi (boleh fragment/bersyarat) yang dijadikan item menu. */
  children: ReactNode;
  /** id tombol pemicu (hamburger) — harus unik per tabel. */
  triggerId: string;
  /** Label tombol pemicu (bawaan "Aksi"). */
  label?: string;
}

/** Kelompokkan tombol aksi toolbar jadi satu menu dropdown (ikon titik-tiga). */
export default function MenuAksiToolbar({ children, triggerId, label = 'Aksi' }: MenuAksiToolbarProps) {
  const aksi = ratakan(children);
  if (aksi.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id={triggerId} size="sm" variant="outline" aria-label={label} title={label}>
          <MoreVertical data-icon="inline-start" size={16} /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {aksi.map((el, i) => {
          const p = el.props as {
            id?: string;
            onClick?: () => void;
            disabled?: boolean;
            title?: string;
            children?: ReactNode;
          };
          const teks = teksLabel(p.children).trim();
          return (
            <DropdownMenuItem
              key={el.key ?? p.id ?? i}
              id={p.id}
              disabled={p.disabled}
              title={p.title}
              onSelect={() => p.onClick?.()}
            >
              {teks || p.title || p.id || 'Aksi'}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
