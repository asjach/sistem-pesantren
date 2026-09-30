import { Check, Eye, Pencil, Trash2 } from '@/icons';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ConfirmDelete from '@/components/ConfirmDelete';
import { cn } from '@/lib/utils';

interface ActionIconProps {
  id: string;
  /** Teks aksesibilitas + tooltip (Bahasa Indonesia). */
  title: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

/** Tombol aksi baris: ikon saja (tanpa label teks) + tooltip shadcn.
 *  forwardRef ke Button dalam (bukan ke Tooltip) agar komposisi langsung aman.
 *  PENGECUALIAN: jangan dibungkus elemen apa pun bila dipakai sebagai anak
 *  `*Trigger asChild` (mis. di dalam ConfirmDelete) — gunakan Button telanjang
 *  + `tip` pada ConfirmDelete (lihat DeleteAction). */
export const ActionIcon = forwardRef<
  HTMLButtonElement,
  ActionIconProps & ComponentPropsWithoutRef<'button'>
>(function ActionIcon({ id, title, onClick, className, children, ...rest }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          id={id}
          aria-label={title}
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          className={cn('text-muted-foreground hover:text-foreground', className)}
          {...rest}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
});

export function ViewAction({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <ActionIcon id={id} title="Lihat" onClick={onClick}>
      <Eye size={16} />
    </ActionIcon>
  );
}

export function EditAction({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <ActionIcon id={id} title="Ubah" onClick={onClick}>
      <Pencil size={16} />
    </ActionIcon>
  );
}

export function DeleteAction({
  id,
  title,
  description,
  onConfirm,
}: {
  id: string;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDelete title={title} description={description} onConfirm={onConfirm} tip="Hapus">
      <Button
        id={id}
        aria-label="Hapus"
        variant="ghost"
        size="icon-sm"
        className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={16} />
      </Button>
    </ConfirmDelete>
  );
}

export function SetAktifAction({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <ActionIcon
      id={id}
      title="Set aktif"
      onClick={onClick}
      className="text-success hover:bg-success/10 hover:text-success"
    >
      <Check size={16} />
    </ActionIcon>
  );
}
