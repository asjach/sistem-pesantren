import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { UserViewDialog } from '@/components/UserViewDialog';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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
// Khusus dialog Tambah pengguna: admin boleh membuat role `admin` (lembaga
// dibatasi backend). Dialog Ubah role & filter tetap memakai ADMIN_ROLES.
const ADMIN_CREATE_ROLES = ['admin', ...ADMIN_ROLES];

const emailRule = (v: string | null) =>
  v && !v.includes('@') ? 'Email tidak valid.' : null;

// Baris privileged (pemegang admin/super_admin) hanya bisa dimutasi super_admin.
function privileged(u: AdminUser) {
  return u.roles.some((r) => r.name === 'admin' || r.name === 'super_admin');
}

const USER_FIELDS_BASE: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 200, minWidth: 120, kind: 'text', maxLength: 255,
    required: true,
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
  // Kolom khusus mode Input: kata sandi & peran/lembaga (baca-saja di mode
  // biasa). Default peran = orang_tua (lihat inputRowValues).
  {
    key: 'sandi', label: 'Kata sandi', width: 150, minWidth: 120, kind: 'static',
    inputKind: 'text', maxLength: 100, required: true,
    validate: (v) => (!v || v.trim().length < 8 ? 'Kata sandi minimal 8 karakter.' : null),
  },
  { key: 'peran', label: 'Peran', width: 200, minWidth: 120, kind: 'static', inputKind: 'select' },
  { key: 'lembaga', label: 'Lembaga', width: 200, minWidth: 120, kind: 'static', inputKind: 'select' },
];

/** Kolom grid pengguna: pilihan peran (sesuai kewenangan) & lembaga disuntik. */
function buatUserFields(creatable: string[], lembagas: Lembaga[]): ExcelField[] {
  return USER_FIELDS_BASE.map((f) => {
    if (f.key === 'peran') {
      return { ...f, inputChoices: creatable.map((r) => ({ value: r, label: r })) };
    }
    if (f.key === 'lembaga') {
      return {
        ...f,
        inputChoices: [
          { value: '', label: '— tanpa lembaga —' },
          ...lembagas.map((l) => ({ value: String(l.id), label: l.kode ?? l.nama })),
        ],
      };
    }
    return f;
  });
}

function userGridValues(u: AdminUser): Record<string, string | null> {
  return {
    nama: u.name,
    email: u.email,
    phone: u.phone,
    username: u.username,
    peran: u.roles.map((r) => r.name).join(', '),
    lembaga: (u.lembagas ?? []).map((l) => l.kode ?? l.nama).join(', '),
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

export default function UsersPage() {
  const { user: me } = useAuth();
  const isSuper = me?.roles.some((r) => r.name === 'super_admin') ?? false;
  const isAdmin = me?.roles.some((r) => r.name === 'admin') ?? false;
  // Admin & super_admin boleh mengubah pengguna (backend tetap menolak target
  // privileged), dan boleh menambah baris lewat mode Input inline.
  const canManage = isSuper || isAdmin;
  const assignable = isSuper ? ALL_ROLES : ADMIN_ROLES;
  const creatable = isSuper ? ALL_ROLES : ADMIN_CREATE_ROLES;

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const fields = useMemo(() => buatUserFields(creatable, lembagas), [creatable, lembagas]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const pager = usePager('users');
  const reqRef = useRef(0);
  const lembagaReqRef = useRef(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>(['orang_tua']);
  const [newLembaga, setNewLembaga] = useState<number[]>([]);
  const [viewRow, setViewRow] = useState<AdminUser | null>(null);
  const [editRow, setEditRow] = useState<AdminUser | null>(null);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editLembaga, setEditLembaga] = useState<number[]>([]);

  const isSelf = useCallback((id: number) => me?.id === id, [me]);
  const locked = useCallback(
    (u: AdminUser) => !isSuper && privileged(u) && !isSelf(u.id),
    [isSuper, isSelf],
  );
  const roleLocked = useCallback((u: AdminUser) => isSelf(u.id) || locked(u), [isSelf, locked]);

  const getValues = useCallback(userGridValues, []);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listUsers({ search: search || undefined, role: roleFilter || undefined, page: p, per_page: pp });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, search, roleFilter],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search, roleFilter]);

  useEffect(() => {
    const req = ++lembagaReqRef.current;
    listLembaga({ per_page: 100 })
      .then((p) => {
        if (req !== lembagaReqRef.current) return;
        setLembagas(p.data);
      })
      .catch((e) => {
        if (req !== lembagaReqRef.current) return;
        setErr(errorMessage(e));
      });
  }, []);

  const openEdit = useCallback((u: AdminUser) => {
    setEditRow(u);
    setEditRoles(u.roles.map((r) => r.name));
    setEditLembaga((u.lembagas ?? []).map((l) => l.id));
  }, []);

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
      setName(''); setIdentifier(''); setPassword(''); setNewRoles(['orang_tua']); setNewLembaga([]);
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

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteUser(id);
      toast.success('Pengguna dihapus permanen.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSaved = useCallback(() => load(), [load]);

  /** Mode Input (admin & super_admin): buat pengguna baru dari baris input.
   *  Peran default orang_tua, tanpa lembaga — ubah lewat tombol Ubah bila perlu. */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    const email = (f.email ?? '').trim();
    const username = (f.username ?? '').trim();
    if (!email && !username) throw new Error('Email atau username wajib diisi.');
    const lembagaId = (f.lembaga ?? '').trim();
    await createUser({
      name: (f.nama ?? '').trim(),
      password: (f.sandi ?? '').trim(),
      roles: f.peran ? [f.peran] : ['orang_tua'],
      lembaga_ids: lembagaId ? [Number(lembagaId)] : [],
      phone: (f.phone ?? '').trim() || undefined,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
    });
    toast.success('Pengguna dibuat.');
    await load(1);
  }, [load]);

  const onSearchChange = useCallback((v: string) => {
    setSearch(v);
    pager.goFirst();
  }, [pager.goFirst]);

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

  const renderActions = useCallback((u: AdminUser) => (
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
  ), [openEdit, onDelete, roleLocked, isSelf, locked]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="users"
        fields={fields}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText="Belum ada pengguna."
        canEdit={canManage}
        onCommit={commitDraft}
        onSaved={onSaved}
        onCreateRow={canManage ? createRow : undefined}
        inputRowValues={{ peran: 'orang_tua' }}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama / email / HP / username"
        searchIds={{ form: 'form_cari_user', input: 'input_cari_user', button: 'btn_cari_user' }}
        addButton={(
          <Button id="btn_buka_tambah_user" onClick={() => setTambahOpen(true)}>
            + Pengguna
          </Button>
        )}
        filter={(
          <FilterField label="Role" htmlFor="select_filter_role">
          <Select value={roleFilter || '_semua'} onValueChange={(v) => { setRoleFilter(v === '_semua' ? '' : v); pager.goFirst(); }}>
            <SelectTrigger id="select_filter_role" title="Filter role" aria-label="Filter role" size="sm" className="w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_semua">Semua</SelectItem>
                {assignable.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          </FilterField>
        )}
        renderActions={renderActions}
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah pengguna</DialogTitle>
            <DialogDescription className="sr-only">
              Buat akun pengguna baru beserta role dan lembaganya.
            </DialogDescription>
          </DialogHeader>
          <form id="form_tambah_user" onSubmit={onCreate} autoComplete="off" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_nama">Nama</FieldLabel>
            <Input id="input_nama" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />

            <FieldLabel htmlFor="input_identitas">Email atau username</FieldLabel>
            <Input id="input_identitas" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="off" />

            <FieldLabel htmlFor="input_password_baru">Kata sandi (min 8)</FieldLabel>
            <Input id="input_password_baru" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />

            <FieldLabel className="self-start pt-1.5">Role</FieldLabel>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {isSuper ? 'Pilih 1 atau lebih (6 opsi).' : 'Pilih 1 atau lebih (5 opsi — termasuk admin untuk lembaga Anda).'}
              </p>
              <div id="group_role_baru" className="flex flex-wrap gap-2">
                {creatable.map((r) => (
                  <label
                    key={r}
                    htmlFor={`check_role_baru_${r}`}
                    className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                  >
                    <Checkbox
                      id={`check_role_baru_${r}`}
                      checked={newRoles.includes(r)}
                      onCheckedChange={() => setNewRoles((s) => toggle(s, r))}
                    /> {r}
                  </label>
                ))}
              </div>
            </div>

            <FieldLabel className="self-start pt-1.5">Lembaga</FieldLabel>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Kosong = ikut pivot saya bila scoped.</p>
              <div id="group_lembaga_baru" className="flex flex-wrap gap-2">
                {lembagas.map((l) => (
                  <label
                    key={l.id}
                    htmlFor={`check_lembaga_baru_${l.id}`}
                    className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                  >
                    <Checkbox
                      id={`check_lembaga_baru_${l.id}`}
                      checked={newLembaga.includes(l.id)}
                      onCheckedChange={() => setNewLembaga((s) => toggleId(s, l.id))}
                    /> {l.kode ?? l.nama}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_user" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <UserViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        user={viewRow}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah role & lembaga{editRow ? `: ${editRow.name}` : ''}</DialogTitle>
            <DialogDescription>Menyimpan akan mencabut semua sesi pengguna tersebut.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel className="self-start pt-1.5">Role</FieldLabel>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {isSuper ? 'Pilih 1 atau lebih (6 opsi).' : 'Pilih 1 atau lebih (4 opsi — tanpa admin/super_admin).'}
              </p>
              <div id="group_ubah_role" className="flex flex-wrap gap-2">
                {assignable.map((r) => (
                  <label
                    key={r}
                    htmlFor={`check_ubah_role_${r}`}
                    className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                  >
                    <Checkbox
                      id={`check_ubah_role_${r}`}
                      checked={editRoles.includes(r)}
                      onCheckedChange={() => setEditRoles((s) => toggle(s, r))}
                    /> {r}
                  </label>
                ))}
              </div>
            </div>
            <FieldLabel className="self-start pt-1.5">Lembaga</FieldLabel>
            <div id="group_ubah_lembaga" className="flex flex-wrap gap-2">
              {lembagas.map((l) => (
                <label
                  key={l.id}
                  htmlFor={`check_ubah_lembaga_${l.id}`}
                  className="inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-full border bg-card px-3.5 py-0 text-[13.5px] has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <Checkbox
                    id={`check_ubah_lembaga_${l.id}`}
                    checked={editLembaga.includes(l.id)}
                    onCheckedChange={() => setEditLembaga((s) => toggleId(s, l.id))}
                  /> {l.kode ?? l.nama}
                </label>
              ))}
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
              <Button id="btn_simpan_user" onClick={onUpdateRoles}>Simpan</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
