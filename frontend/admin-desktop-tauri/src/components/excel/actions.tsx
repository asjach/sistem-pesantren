import { Children, Fragment, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { ActionIcon, DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, Eye, MoreVertical, Pencil, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';
import type { AksiMenu, ActionsColData, GridRow } from './types';

/** Ratakan aksi (bisa berupa fragment/conditional) menjadi daftar elemen. */
export function flattenAksi(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(...flattenAksi((child.props as { children?: ReactNode }).children));
      return;
    }
    out.push(child);
  });
  return out;
}

/** Ambil isi ikon dari elemen tombol aksi agar menu tidak menyarangkan button. */
export function ikonAksi(node: ReactNode): ReactNode {
  if (isValidElement(node) && node.type === ActionIcon) {
    return (node.props as { children?: ReactNode }).children;
  }
  return node;
}

export function metaAksi(el: ReactElement): AksiMenu {
  const p = el.props as {
    title?: string;
    onClick?: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    description?: string;
    children?: ReactNode;
  };
  if (el.type === DeleteAction) {
    return {
      label: 'Hapus',
      icon: <Trash2 size={16} />,
      konfirmasi: { title: p.title ?? 'Hapus?', description: p.description ?? '', onConfirm: p.onConfirm ?? (() => {}) },
    };
  }
  if (el.type === EditAction) return { label: 'Ubah', icon: <Pencil size={16} />, onClick: p.onClick };
  if (el.type === ViewAction) return { label: 'Lihat', icon: <Eye size={16} />, onClick: p.onClick };
  if (el.type === SetAktifAction) return { label: 'Set aktif', icon: <Check size={16} />, onClick: p.onClick };
  const title = typeof p.title === 'string' ? p.title.replace(/\?$/, '') : 'Aksi';
  // Pembungkus konfirmasi umum (mis. ConfirmDelete): teruskan ke dialog konfirmasi menu.
  if (typeof p.onConfirm === 'function') {
    return {
      label: title,
      icon: ikonAksi(p.children),
      konfirmasi: {
        title: p.title ?? 'Konfirmasi?',
        description: p.description ?? '',
        confirmLabel: p.confirmLabel,
        onConfirm: p.onConfirm,
      },
    };
  }

  return { label: title, icon: ikonAksi(p.children), onClick: p.onClick };
}

/** Sel Aksi: tombol ikon dialog (klik tidak mengubah seleksi grid).
 *  Bila aksi lebih dari 3, diringkas jadi dropdown titik-tiga vertikal. */
export function ActionsCell({ rowData, columnData }: CellProps<GridRow, ActionsColData>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<AksiMenu['konfirmasi'] | null>(null);
  const aksi = flattenAksi(columnData.render(rowData.id));
  const stop = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  if (columnData.ringkas) {
    // Tabel berkapasitas > 3 aksi: selalu hamburger agar konsisten, walau baris
    // ini sendiri beraksi ≤ 3. Baris tanpa aksi tidak menampilkan apa pun
    // (fragment kosong: tipe component kolom DSG menolak null).
    if (aksi.length === 0) return <></>;
  } else if (aksi.length <= 3) {
    return (
      <div className="simpes-dsg-actions flex h-full flex-1 items-center justify-center gap-1" {...stop}>
        {aksi.map((el, i) => (
          <Fragment key={el.key ?? i}>{el}</Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="simpes-dsg-actions flex h-full flex-1 items-center justify-end gap-1" {...stop}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <ActionIcon id={`btn_aksi_lain_${rowData.id}`} title="Aksi lainnya">
            <MoreVertical size={16} />
          </ActionIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {aksi.map((el, i) => {
            const m = metaAksi(el);
            return (
              <DropdownMenuItem
                key={el.key ?? i}
                onSelect={() => {
                  setMenuOpen(false);
                  if (m.konfirmasi) setKonfirmasi(m.konfirmasi);
                  else m.onClick?.();
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={konfirmasi !== null} onOpenChange={(o) => { if (!o) setKonfirmasi(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{konfirmasi?.title}</AlertDialogTitle>
            <AlertDialogDescription>{konfirmasi?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={() => {
                konfirmasi?.onConfirm();
                setKonfirmasi(null);
              }}
            >
              {konfirmasi?.confirmLabel ?? 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
