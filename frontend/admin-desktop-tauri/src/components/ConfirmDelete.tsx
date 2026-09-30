import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: React.ReactNode;
  /** Tooltip shadcn untuk tombol pemicu. Anak harus tombol telanjang
   *  (tanpa pembungkus) agar rantai `asChild` AlertDialog→Tooltip→Button utuh. */
  tip?: string;
}

/** Tombol hapus dengan dialog konfirmasi (AlertDialog: role="alertdialog"). */
export default function ConfirmDelete({ title, description, confirmLabel = 'Hapus', onConfirm, children, tip }: Props) {
  const [open, setOpen] = useState(false);
  const pemicu = (
    <AlertDialogTrigger asChild>
      {tip ? <TooltipTrigger asChild>{children}</TooltipTrigger> : children}
    </AlertDialogTrigger>
  );
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {tip ? (
        <Tooltip>
          {pemicu}
          <TooltipContent>
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      ) : pemicu}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
