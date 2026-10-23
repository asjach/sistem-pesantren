import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ActionIcon, DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Eye, Pencil, Trash2 } from '@/icons';
import type { AksiMenu } from './types';

/** Elemen non-interaktif yang lazim membungkus aksi, mis.
 *  `<span className="flex items-center gap-0.5">`. Tanpa diratakan, seluruh
 *  pembungkus terbaca sebagai satu aksi generik "Aksi" di menu klik kanan. */
const PEMBUNGKUS_AKSI = new Set(['span', 'div']);

/** Pembungkus layout tidak punya handler sendiri; elemen yang memegang
 *  `onClick`/`onConfirm` dianggap aksi dan tidak diturunkan lagi. */
function pembungkusAksi(el: ReactElement): boolean {
  const p = el.props as Record<string, unknown>;
  return typeof el.type === 'string'
    && PEMBUNGKUS_AKSI.has(el.type)
    && typeof p.onClick !== 'function'
    && typeof p.onConfirm !== 'function';
}

/** Tombol aksi yang tetap ditampilkan di menu walau belum diberi handler
 *  (mis. contoh hidup di halaman Komponen, tombolnya hanya peraga). */
const KOMPONEN_AKSI = new Set<unknown>([
  Button, ActionIcon, ViewAction, EditAction, DeleteAction, SetAktifAction,
]);

function elemenAksi(el: ReactElement): boolean {
  const p = el.props as { onClick?: () => void; onConfirm?: () => void };
  return typeof p.onClick === 'function'
    || typeof p.onConfirm === 'function'
    || el.type === 'button'
    || KOMPONEN_AKSI.has(el.type);
}

/** Ratakan `renderActions` khusus untuk menu klik kanan.
 *
 *  Menu hanya memuat tombol/aksi, jadi pembungkus layout ditelusuri dan
 *  kontrol seperti input atau teks hiasan dilewati. Dengan begitu
 *  `<span><Lihat/><Ubah/></span>` menjadi dua item menu, bukan satu item
 *  "Aksi". */
export function flattenAksiMenu(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment || child.type === TooltipTrigger) {
      out.push(...flattenAksiMenu((child.props as { children?: ReactNode }).children));
      return;
    }
    if (child.type === Tooltip) {
      Children.forEach((child.props as { children?: ReactNode }).children, (c) => {
        if (isValidElement(c) && c.type === TooltipTrigger) {
          out.push(...flattenAksiMenu((c.props as { children?: ReactNode }).children));
        }
      });
      return;
    }
    if (pembungkusAksi(child)) {
      out.push(...flattenAksiMenu((child.props as { children?: ReactNode }).children));
      return;
    }
    if (!elemenAksi(child)) return;
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
    /** TombolIkon memakai `tip` (bukan `title`) — dibaca juga agar label
     *  menu hamburger tidak jatuh ke "Aksi" generik. */
    tip?: string;
    /** Tombol ikon aksesibel hanya memberi `aria-label`; pakai sebagai label
     *  menu supaya aksi record tidak semuanya tampil sebagai "Aksi". */
    'aria-label'?: string;
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
  const title = typeof p.title === 'string'
    ? p.title.replace(/\?$/, '')
    : (typeof p.tip === 'string' ? p.tip : (typeof p['aria-label'] === 'string' ? p['aria-label'] : 'Aksi'));

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
