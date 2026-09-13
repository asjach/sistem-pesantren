import { Check, Eye, Pencil, Trash2 } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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

/** Tombol aksi baris: ikon saja (tanpa label teks). forwardRef agar bisa
 *  dipakai sebagai trigger Radix `asChild` (mis. AlertDialog di ConfirmDelete). */
export const ActionIcon = forwardRef<
  HTMLButtonElement,
  ActionIconProps & ComponentPropsWithoutRef<'button'>
>(function ActionIcon({ id, title, onClick, className, children, ...rest }, ref) {
  return (
    <Button
      ref={ref}
      id={id}
      title={title}
      aria-label={title}
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      {...rest}
    >
      {children}
    </Button>
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
    <ConfirmDelete title={title} description={description} onConfirm={onConfirm}>
      <ActionIcon
        id={id}
        title="Hapus"
        className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={16} />
      </ActionIcon>
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
