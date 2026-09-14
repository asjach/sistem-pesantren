import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Landmark, Users } from '@/icons';
import type { AdminUser } from '@/api/users';

const LABEL_ROLE: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  kasir: 'Kasir',
  guru: 'Guru',
  orang_tua: 'Orang Tua',
  santri: 'Santri',
};

const VARIAN_ROLE: Record<string, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  admin: 'secondary',
};

function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return '?';
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[1][0]).toUpperCase();
}

/** Dialog lihat detail pengguna: identitas, kontak, peran, dan lembaga. */
export function UserViewDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: AdminUser | null;
}) {
  const roles = user?.roles ?? [];
  const lembagas = user?.lembagas ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Detail pengguna</DialogTitle>
          <DialogDescription className="sr-only">
            Informasi akun, peran, dan lembaga pengguna (baca-saja).
          </DialogDescription>
        </DialogHeader>

        {user && (
          <>
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
                {inisial(user.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{user.name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {user.email ?? user.username ?? 'Tanpa kontak'}
                </div>
              </div>
            </div>

            <Separator />

            <dl className="grid grid-cols-[7rem_1fr] items-start gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-medium">{user.username ?? '—'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">{user.email ?? '—'}</dd>
              <dt className="text-muted-foreground">HP</dt>
              <dd className="font-medium">{user.phone ?? '—'}</dd>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-medium tabular-nums">#{user.id}</dd>
            </dl>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users size={16} /> Peran
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <Badge key={r.id} variant={VARIAN_ROLE[r.name] ?? 'outline'}>
                      {LABEL_ROLE[r.name] ?? r.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Belum ada peran.</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Landmark size={16} /> Lembaga
              </div>
              <div className="flex flex-wrap gap-2">
                {lembagas.length > 0 ? (
                  lembagas.map((l) => (
                    <Badge key={l.id} variant="outline" title={l.nama}>
                      {l.kode ?? l.nama}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Tanpa lembaga (admin global).</span>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
