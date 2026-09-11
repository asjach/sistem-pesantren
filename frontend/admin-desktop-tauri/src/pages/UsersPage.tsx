import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type AdminUser,
} from '../api/users';
import { listLembaga, type Lembaga } from '../api/master';
import { errorMessage } from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ViewDialog } from '@/components/ViewDialog';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const ALL_ROLES = ['super_admin', 'admin', 'kasir', 'guru', 'orang_tua', 'santri'];
const ADMIN_ROLES = ['kasir', 'guru', 'orang_tua', 'santri'];

export default function UsersPage() {
  const { user: me } = useAuth();
  const isSuper = me?.roles.some((r) => r.name === 'super_admin') ?? false;
  const assignable = isSuper ? ALL_ROLES : ADMIN_ROLES;
  const isSelf = (id: number) => me?.id === id;
  // Baris privileged (pemegang admin/super_admin) hanya bisa dimutasi super_admin.
  const privileged = (u: AdminUser) => u.roles.some((r) => r.name === 'admin' || r.name === 'super_admin');
  const locked = (u: AdminUser) => !isSuper && privileged(u) && !isSelf(u.id);
  const roleLocked = (u: AdminUser) => isSelf(u.id) || locked(u);

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const pager = usePager('users');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>(['kasir']);
  const [newLembaga, setNewLembaga] = useState<number[]>([]);
  const [viewRow, setViewRow] = useState<AdminUser | null>(null);
  const [editRow, setEditRow] = useState<AdminUser | null>(null);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editLembaga, setEditLembaga] = useState<number[]>([]);

  const emailRule = (v: string | null) =>
    v && !v.includes('@') ? 'Email tidak valid.' : null;

  const fields: ExcelField[] = [
    {
      key: 'nama', label: 'Nama', width: 200, minWidth: 120, kind: 'text', maxLength: 255,
      validate: (v) => (!v || !v.trim() ? 'Nama wajib diisi.' : null),
    },
    {
      key: 'email', label: 'Email', width: 220, minWidth: 140, kind: 'text', maxLength: 255,
      validate: emailRule,
    },
    {
      key: 'phone', label: 'HP', width: 150, minWidth: 110, kind: 'text', maxLength: 20,
    },
    {
      key: 'username', label: 'Username', width: 150, minWidth: 110, kind: 'text', maxLength: 50,
    },
    { key: 'peran', label: 'Peran', width: 200, minWidth: 120, kind: 'static' },
    { key: 'lembaga', label: 'Lembaga', width: 200, minWidth: 120, kind: 'static' },
  ];

  function gridValues(u: AdminUser): Record<string, string | null> {
    return {
      nama: u.name,
      email: u.email,
      phone: u.phone,
      username: u.username,
      peran: u.roles.map((r) => r.name).join(', '),
      lembaga: (u.lembagas ?? []).map((l) => l.nama).join(', '),
    };
  }

  async function commitDraft(id: number, f: Record<string, string | null>) {
    await updateUser(id, {
      ...(f.nama !== undefined ? { name: f.nama ?? '' } : {}),
      ...(f.email !== undefined ? { email: f.email || null } : {}),
      ...(f.phone !== undefined ? { phone: f.phone || null } : {}),
      ...(f.username !== undefined ? { username: f.username || null } : {}),
    });
  }

  function openEdit(u: AdminUser) {
    setEditRow(u);
    setEditRoles(u.roles.map((r) => r.name));
    setEditLembaga((u.lembagas ?? []).map((l) => l.id));
  }

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listUsers({ search: search || undefined, role: roleFilter || undefined, page: p, per_page: pp });
      const fix = pager.sync(res.current_page, res.last_page);
      if (fix != null && fix !== p) {
        await load(fix, pp);
        return;
      }
      setRows(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pager.ready) load(pager.page);
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready]);

  function toggle(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function toggleId(list: number[], v: number): number[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (newRoles.length === 0) {
      setErr('Pilih minimal 1 role.');
      return;
    }
    try {
      const field = identifier.includes('@') ? { email: identifier } : { username: identifier };
      await createUser({ name, password, roles: newRoles, lembaga_ids: newLembaga, ...field });
      toast.success(`Pengguna dibuat (${newRoles.join(', ')}).`);
      setName(''); setIdentifier(''); setPassword(''); setNewRoles(['kasir']); setNewLembaga([]);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }

  async function onUpdateRoles() {
    if (!editRow) return;
    if (editRoles.length === 0) {
      setErr('Pilih minimal 1 role.');
      return;
    }
    try {
      await updateUser(editRow.id, { roles: editRoles, lembaga_ids: editLembaga });
      toast.success('Role & lembaga pengguna diubah (sesinya dicabut).');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteUser(id);
      toast.success('Pengguna dihapus permanen.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        titleId="title_users"
        title="Pengguna"
        description="Role diri sendiri terkunci untuk semua peran. Baris pemegang admin/super_admin hanya bisa diubah super_admin; hanya super_admin yang dapat memberi role admin/super_admin."
      />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="users"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada pengguna."
        canEdit={isSuper}
        onCommit={commitDraft}
        onSaved={() => load()}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { pager.goFirst(); load(1); }}
        searchPlaceholder="Nama / email / HP / username"
        searchIds={{ form: 'form_cari_user', input: 'input_cari_user', button: 'btn_cari_user' }}
        addButton={(
          <Button id="btn_buka_tambah_user" onClick={() => setTambahOpen(true)}>
            + Pengguna
          </Button>
        )}
        filter={(
          <Select value={roleFilter || '_semua'} onValueChange={(v) => setRoleFilter(v === '_semua' ? '' : v)}>
            <SelectTrigger id="select_filter_role" title="Filter role" aria-label="Filter role" className="h-8 w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_semua">Semua</SelectItem>
              {assignable.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        renderActions={(u) => (
          <>
            <ViewAction id={`btn_lihat_user_${u.id}`} onClick={() => setViewRow(u)} />
            {!roleLocked(u) && (
              <EditAction id={`btn_ubah_user_${u.id}`} onClick={() => openEdit(u)} />
            )}
            {!isSelf(u.id) && !locked(u) && (
              <DeleteAction
                id={`btn_hapus_user_${u.id}`}
                title="Hapus pengguna?"
                description="Pengguna dihapus permanen dan semua sesinya dicabut."
                onConfirm={() => onDelete(u.id)}
              />
            )}
          </>
        )}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah pengguna</DialogTitle>
          </DialogHeader>
          <form id="form_tambah_user" onSubmit={onCreate} autoComplete="off" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="input_nama">Nama</Label>
            <Input id="input_nama" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_identitas">Email atau username</Label>
            <Input id="input_identitas" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_password_baru">Kata sandi (min 8)</Label>
            <Input id="input_password_baru" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Role {isSuper ? '(6 opsi)' : '(admin: 4 opsi — tanpa admin/super_admin)'}</div>
        <div id="group_role_baru" className="flex flex-wrap gap-2">
          {assignable.map((r) => (
            <label
              key={r}
              htmlFor={`check_role_baru_${r}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[13.5px] has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
            >
              <Checkbox
                id={`check_role_baru_${r}`}
                checked={newRoles.includes(r)}
                onCheckedChange={() => setNewRoles((s) => toggle(s, r))}
              /> {r}
            </label>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">Lembaga (kosong = ikut pivot saya bila scoped)</div>
        <div id="group_lembaga_baru" className="flex flex-wrap gap-2">
          {lembagas.map((l) => (
            <label
              key={l.id}
              htmlFor={`check_lembaga_baru_${l.id}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[13.5px] has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
            >
              <Checkbox
                id={`check_lembaga_baru_${l.id}`}
                checked={newLembaga.includes(l.id)}
                onCheckedChange={() => setNewLembaga((s) => toggleId(s, l.id))}
              /> {l.nama}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
          <Button id="btn_tambah_user" type="submit">Tambah</Button>
        </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Pengguna: ${viewRow.name}` : 'Pengguna'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah role & lembaga{editRow ? `: ${editRow.name}` : ''}</DialogTitle>
            <DialogDescription>Menyimpan akan mencabut semua sesi pengguna tersebut.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">Role {isSuper ? '(6 opsi)' : '(admin: 4 opsi — tanpa admin/super_admin)'}</div>
          <div id="group_ubah_role" className="flex flex-wrap gap-2">
            {assignable.map((r) => (
              <label
                key={r}
                htmlFor={`check_ubah_role_${r}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[13.5px] has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
              >
                <Checkbox
                  id={`check_ubah_role_${r}`}
                  checked={editRoles.includes(r)}
                  onCheckedChange={() => setEditRoles((s) => toggle(s, r))}
                /> {r}
              </label>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">Lembaga</div>
          <div id="group_ubah_lembaga" className="flex flex-wrap gap-2">
            {lembagas.map((l) => (
              <label
                key={l.id}
                htmlFor={`check_ubah_lembaga_${l.id}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[13.5px] has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
              >
                <Checkbox
                  id={`check_ubah_lembaga_${l.id}`}
                  checked={editLembaga.includes(l.id)}
                  onCheckedChange={() => setEditLembaga((s) => toggleId(s, l.id))}
                /> {l.nama}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_user" onClick={onUpdateRoles}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
