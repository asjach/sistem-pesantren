import { Check, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDelete from '@/components/ConfirmDelete';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ActionIconProps {
  id: string;
  /** Teks aksesibilitas + tooltip (Bahasa Indonesia). */
  title: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

/** Tombol aksi baris: ikon saja (tanpa label teks). */
export function ActionIcon({ id, title, onClick, className, children }: ActionIconProps) {
  return (
    <Button
      id={id}
      title={title}
      aria-label={title}
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      {children}
    </Button>
  );
}

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
      className="text-primary/80 hover:text-primary"
    >
      <Check size={16} />
    </ActionIcon>
  );
}
