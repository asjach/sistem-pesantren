import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { bisa } from '../api/auth';
import {
  attachLembaga,
  createUser,
  deleteUser,
  detachLembaga,
  listUsers,
  updateUser,
  type AdminUser,
} from '../api/users';
import { listLembaga, type Lembaga } from '../api/master';
import { errorMessage } from '../api/client';
import { Button } from '@/components/ui/button';
import LabeledTextInput from '@/components/LabeledTextInput';
import { FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon, DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { Landmark } from '@/icons';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const ALL_ROLES = ['super_admin', 'admin', 'guru', 'orang_tua', 'santri'];
const ADMIN_ROLES = ['guru', 'orang_tua', 'santri'];
/** Peran yang boleh dicatat per lembaga (super_admin selalu global). */
const PERAN_LEMBAGA_OPSI = ['admin', 'guru', 'orang_tua', 'santri'];
// Khusus dialog Tambah pengguna: admin boleh membuat role `admin` (lembaga
// dibatasi backend). Dialog Ubah role & filter tetap memakai ADMIN_ROLES.
const ADMIN_CREATE_ROLES = ['admin', ...ADMIN_ROLES];

/** Lebar label seragam untuk SELURUH kontrol form Tambah Pengguna: kotak label
 *  `LabeledTextInput` (prop `lebarLabel`) dan kolom label grid Role/Lembaga
 *  memakai angka yang sama, sehingga semua label selebar ini dan semua kontrol
 *  mulai di x yang sama. Dipatok dari label terpanjang, "Kata sandi (min 8)". */
const LEBAR_LABEL_FORM = 140;

const emailRule = (v: string | null) =>
  v && !v.includes('@') ? 'Email tidak valid.' : null;

// Baris privileged (pemegang admin/super_admin) hanya bisa dimutasi super_admin.
function privileged(u: AdminUser) {
  return u.roles.some((r) => r.name === 'admin' || r.name === 'super_admin');
}

const USER_FIELDS_BASE: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 200, kind: 'text', maxLength: 255,
    
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama wajib diisi.' : null),
  },
  {
    key: 'email', label: 'Email', width: 220, kind: 'text', maxLength: 255,
    
    validate: emailRule,
  },
  {
    key: 'phone', label: 'No. HP', width: 150, kind: 'text', maxLength: 20,
    
  },
  {
    key: 'username', label: 'Nama Pengguna', width: 150, kind: 'text', maxLength: 50,
    
  },
  // Kolom khusus mode Input: kata sandi & peran/lembaga (baca-saja di mode
  // biasa). Default peran = orang_tua (lihat inputRowValues).
  {
    key: 'sandi', label: 'Kata Sandi', width: 150, kind: 'static',
    inputKind: 'text', maxLength: 100, required: true,
    validate: (v) => (!v || v.trim().length < 8 ? 'Kata sandi minimal 8 karakter.' : null),
  },
  { key: 'peran', label: 'Peran', width: 200, kind: 'static', inputKind: 'select' },
  { key: 'lembaga', label: 'Jenjang', width: 200, kind: 'static', inputKind: 'select',  },
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
          ...lembagas.map((l) => ({ value: l.jenjang, label: ` — ` })),
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
    lembaga: (u.lembagas ?? []).map((l) => (l.pivot?.role ? `${l.jenjang} (${l.pivot.role})` : l.jenjang)).join(', '),
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
  /** Hak kelola role = super_admin EFEKTIF (mati saat bertindak sebagai lembaga). */
  const { efektifSuper: isSuper } = useLembagaAktif();
  // Gerbang aksi = izin matriks (backend menegakkan yang sama).
  const canUbah = bisa(me, 'pengguna.ubah');
  const canTambah = bisa(me, 'pengguna.tambah');
  const canHapus = bisa(me, 'pengguna.hapus');
  const assignable = isSuper ? ALL_ROLES : ADMIN_ROLES;
  const creatable = isSuper ? ALL_ROLES : ADMIN_CREATE_ROLES;

  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const fields = useMemo(() => buatUserFields(creatable, lembagas), [creatable, lembagas]);
  /** Pencarian tunggal halaman (topBar) — menggantikan input cari per tabel. */
  const [cari, setCari] = useState('');
  const lembagaReqRef = useRef(0);
  const {
    rows,
    loading,
    err,
    setErr,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSaved,
  } = useDaftarTabel<AdminUser>({
    tableKey: 'users',
    search: cari,
    ambil: (a) => listUsers({
      search: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  /** Galat khusus form Tambah Pengguna — ditampilkan DI DALAM sheet, sebab
   *  `err` halaman tampil di balik overlay sheet (tak terlihat). */
  const [errTambah, setErrTambah] = useState('');
  const [password, setPassword] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>(['orang_tua']);
  const [newLembaga, setNewLembaga] = useState<string[]>([]);
  const [viewRow, setViewRow] = useState<AdminUser | null>(null);
  const [editRow, setEditRow] = useState<AdminUser | null>(null);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editLembaga, setEditLembaga] = useState<string[]>([]);
  /** Dialog peran per lembaga: baris pivot (jenjang + peran tercatat). */
  const [peranRow, setPeranRow] = useState<AdminUser | null>(null);
  const [tambahJenjang, setTambahJenjang] = useState('');
  const [tambahPeran, setTambahPeran] = useState('admin');

  const isSelf = useCallback((id: number) => me?.id === id, [me]);
  const locked = useCallback(
    (u: AdminUser) => !isSuper && privileged(u) && !isSelf(u.id),
    [isSuper, isSelf],
  );
  const roleLocked = useCallback((u: AdminUser) => isSelf(u.id) || locked(u), [isSelf, locked]);
  /** Opsi peran per lembaga sesuai kewenangan (irisan daftar pivot × assignable). */
  const peranOpsi = useMemo(
    () => PERAN_LEMBAGA_OPSI.filter((r) => assignable.includes(r)),
    [assignable],
  );

  const openPeran = useCallback((u: AdminUser) => {
    setPeranRow(u);
    setTambahJenjang('');
    setTambahPeran('admin');
  }, []);

  async function onTambahPeran() {
    if (!peranRow || !tambahJenjang) return;
    try {
      const res = await attachLembaga(peranRow.id, tambahJenjang, tambahPeran);
      toast.success(`Peran ${tambahPeran} di ${tambahJenjang} ditambahkan.`);
      setTambahJenjang('');
      setPeranRow(res.user);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onLepasPeran(jenjang: string, role: string | null) {
    if (!peranRow) return;
    try {
      const res = await detachLembaga(peranRow.id, jenjang, role);
      toast.success(`Akses ${jenjang}${role ? ` (${role})` : ''} dilepas.`);
      setPeranRow(res.user);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const getValues = useCallback(userGridValues, []);

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
    setEditLembaga((u.lembagas ?? []).map((l) => l.jenjang));
  }, []);

  function toggle(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function toggleId(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrTambah('');
    if (newRoles.length === 0) {
      setErrTambah('Pilih minimal 1 role.');
      return;
    }
    /* Identitas kini tiga kolom terpisah (email / phone / username), sama
       seperti baris input grid. Aturan "minimal salah satu" mencerminkan
       backend (`email` = required_without_all:phone,username). */
    const emailIsi = email.trim();
    const phoneIsi = phone.trim();
    const usernameIsi = username.trim();
    if (!emailIsi && !phoneIsi && !usernameIsi) {
      setErrTambah('Isi minimal salah satu: Email, No. HP, atau Nama Pengguna.');
      return;
    }
    const salahEmail = emailRule(emailIsi || null);
    if (salahEmail) {
      setErrTambah(salahEmail);
      return;
    }
    try {
      await createUser({
        name,
        password,
        roles: newRoles,
        jenjangs: newLembaga,
        ...(emailIsi ? { email: emailIsi } : {}),
        ...(phoneIsi ? { phone: phoneIsi } : {}),
        ...(usernameIsi ? { username: usernameIsi } : {}),
      });
      toast.success(`Pengguna dibuat (${newRoles.join(', ')}).`);
      setName(''); setEmail(''); setPhone(''); setUsername(''); setPassword('');
      setNewRoles(['orang_tua']); setNewLembaga([]);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErrTambah(errorMessage(e2));
    }
  }

  async function onUpdateRoles() {
    if (!editRow) return;
    if (editRoles.length === 0) {
      setErr('Pilih minimal 1 role.');
      return;
    }
    try {
      await updateUser(editRow.id, { roles: editRoles, jenjangs: editLembaga });
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

  /** Mode Input (admin & super_admin): buat pengguna baru dari baris input.
   *  Peran default orang_tua, tanpa lembaga — ubah lewat tombol Ubah bila perlu. */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    const email = (f.email ?? '').trim();
    const username = (f.username ?? '').trim();
    if (!email && !username) throw new Error('Email atau username wajib diisi.');
    const jenjang = (f.lembaga ?? '').trim();
    await createUser({
      name: (f.nama ?? '').trim(),
      password: (f.sandi ?? '').trim(),
      roles: f.peran ? [f.peran] : ['orang_tua'],
      jenjangs: jenjang ? [jenjang] : [],
      phone: (f.phone ?? '').trim() || undefined,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
    });
    toast.success('Pengguna dibuat.');
    await load(1);
  }, [load]);

  const renderActions = useCallback((u: AdminUser) => (
    <>
      <ViewAction id={`btn_lihat_user_${u.id}`} onClick={() => setViewRow(u)} />
      {canUbah && !roleLocked(u) && (
        <EditAction id={`btn_ubah_user_${u.id}`} onClick={() => openEdit(u)} />
      )}
      {canUbah && !locked(u) && (!isSelf(u.id) || isSuper) && peranOpsi.length > 0 && (
        <ActionIcon
          id={`btn_peran_lembaga_${u.id}`}
          title="Atur peran per lembaga"
          aria-label={`Atur peran per lembaga untuk ${u.name}`}
          onClick={() => openPeran(u)}
        >
          <Landmark size={16} />
        </ActionIcon>
      )}
      {canHapus && !isSelf(u.id) && !locked(u) && (
        <DeleteAction
          id={`btn_hapus_user_${u.id}`}
          title="Hapus pengguna?"
          description="Pengguna dihapus permanen dan semua sesinya dicabut."
          onConfirm={() => onDelete(u.id)}
        />
      )}
    </>
  ), [openEdit, onDelete, roleLocked, isSelf, locked, canUbah, canHapus, isSuper, peranOpsi.length, openPeran]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari pengguna (nama/email/username/phone/role)…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'users', judul: 'Pengguna', fields }]} />
      {/* Tombol "+ Pengguna" tampil langsung di bilah judul (bukan di balik
          tombol hamburger `MenuAksiToolbar`): aksi utama halaman ini. */}
      <ExcelTable
        tableKey="users"
        sumberTabel="users"
        fields={fields}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText="Belum ada pengguna."
        canEdit={canUbah}
        onCommit={commitDraft}
        onSaved={onSaved}
        onCreateRow={canTambah ? createRow : undefined}
        inputRowValues={{ peran: 'orang_tua' }}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        addButtonLangsung
        addButton={canTambah ? (
          /* Tambah pengguna sebagai SHEET: panel penuh tinggi yang menggeser
             masuk dari tepi kanan, jadi tabel tetap terlihat di belakangnya.
             Tombol jadi SheetTrigger — status buka tetap state `tambahOpen`. */
          <Sheet open={tambahOpen} onOpenChange={setTambahOpen}>
            <SheetTrigger asChild>
              <Button id="btn_buka_tambah_user">+ Pengguna</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Tambah pengguna</SheetTitle>
                <SheetDescription className="sr-only">
                  Buat akun pengguna baru beserta role dan lembaganya.
                </SheetDescription>
              </SheetHeader>
              {/* Kolom label grid (Role/Lembaga) memakai LEBAR_LABEL_FORM yang
                  sama dengan `lebarLabel` tiap LabeledTextInput → semua label
                  seragam. Ditulis lewat `style` supaya angkanya satu sumber. */}
              <form
                id="form_tambah_user"
                onSubmit={onCreate}
                autoComplete="off"
                className="grid items-center gap-x-4 gap-y-4"
                style={{ gridTemplateColumns: `${LEBAR_LABEL_FORM}px 1fr` }}
              >
                {errTambah && (
                  <p id="galat_tambah_user" className="col-span-2 text-xs text-destructive">
                    {errTambah}
                  </p>
                )}
                {/* Field teks memakai LabeledTextInput (label menyatu di dalam
                    kotak) — membentang kedua kolom grid karena labelnya kini
                    bagian dari kotak, bukan kolom label terpisah.
                    `kelolaLebar={false}` WAJIB: form ini hidup di dalam toolbar
                    ExcelTable yang menyediakan konteks Kelola Tabel — tanpa itu
                    tiap field ikut terdaftar sebagai "filter" tabel `users`
                    dan lebarnya dipatok LEBAR_BAWAHAN_FILTER (160px). */}
                <LabeledTextInput
                  className="col-span-2"
                  label="Nama"
                  htmlFor="input_nama"
                  kelolaLebar={false}
                  lebarLabel={LEBAR_LABEL_FORM}
                  /* Nama selalu teks: baris "Tipe input:" disembunyikan supaya
                     setelan tersimpan (server, berlaku semua user) tak bisa
                     mengubahnya jadi tanggal/nominal. */
                  tipeTerkunci
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="off"
                />

                {/* Identitas = tiga kolom terpisah (sama seperti baris input
                    grid): minimal salah satu diisi, sisanya boleh kosong.
                    Urutan mengikuti urutan kolom grid. */}
                <LabeledTextInput
                  className="col-span-2"
                  label="Email"
                  htmlFor="input_email"
                  kelolaLebar={false}
                  lebarLabel={LEBAR_LABEL_FORM}
                  tipeKontrol="email"
                  pilihanTipe={['email', 'teks']}
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />

                <LabeledTextInput
                  className="col-span-2"
                  label="No. HP"
                  htmlFor="input_phone"
                  kelolaLebar={false}
                  lebarLabel={LEBAR_LABEL_FORM}
                  tipeKontrol="telepon"
                  pilihanTipe={['telepon', 'teks']}
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="off"
                />

                <LabeledTextInput
                  className="col-span-2"
                  label="Nama Pengguna"
                  htmlFor="input_username"
                  kelolaLebar={false}
                  lebarLabel={LEBAR_LABEL_FORM}
                  tipeTerkunci
                  maxLength={50}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />

                <LabeledTextInput
                  className="col-span-2"
                  label="Kata sandi (min 8)"
                  htmlFor="input_password_baru"
                  kelolaLebar={false}
                  lebarLabel={LEBAR_LABEL_FORM}
                  type="password"
                  /* Sandi wajib tetap sandi — jangan sampai bisa diubah jadi
                     teks biasa dari popover. */
                  tipeTerkunci
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

                <FieldLabel className="self-start pt-1.5">Role</FieldLabel>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {isSuper ? 'Pilih 1 atau lebih (5 opsi).' : 'Pilih 1 atau lebih (5 opsi — termasuk admin untuk lembaga Anda).'}
                  </p>
                  {/* Chip pil: `<label>` + `Checkbox` Radix, status aktif lewat
                      `has-checked:` (butuh `<form>` leluhur agar Radix merender
                      input tersembunyinya — di sini ada, `form_tambah_user`).
                      Sama persis dengan chip Lembaga di bawah. */}
                  <div id="group_role_baru" className="flex flex-wrap gap-2">
                    {creatable.map((r) => (
                      <label
                        key={r}
                        htmlFor={`check_role_baru_${r}`}
                        className="inline-flex h-6 min-w-32 cursor-pointer items-center gap-2 rounded-pil border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
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
                  <p className="text-xs text-muted-foreground">Kosong = ikut pivot saya bila scoped.</p>
                  <div id="group_lembaga_baru" className="flex flex-wrap gap-2">
                    {lembagas.map((l) => (
                      <label
                        key={l.jenjang}
                        htmlFor={`check_lembaga_baru_${l.jenjang}`}
                        className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-pil border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                      >
                        <Checkbox
                          id={`check_lembaga_baru_${l.jenjang}`}
                          checked={newLembaga.includes(l.jenjang)}
                          onCheckedChange={() => setNewLembaga((s) => toggleId(s, l.jenjang))}
                        /> {l.jenjang} — {l.nama}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
                  <Button id="btn_tambah_user" type="submit">Tambah</Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        ) : undefined}
        renderActions={renderActions}
        pager={(
          <Pager
            page={pager.page}
            lastPage={lastPage}
            total={total}
            perPage={pager.perPage}
            onPage={(p) => { pager.setPage(p); load(p); }}
            onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
          />
        )}
      />
      <UserViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        user={viewRow}
      />
      <Dialog open={peranRow !== null} onOpenChange={(o) => { if (!o) setPeranRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Peran per lembaga{peranRow ? `: ${peranRow.name}` : ''}</DialogTitle>
            <DialogDescription>
              Satu akun bisa memegang peran berbeda di tiap lembaga (mis. admin di MI, guru di MLN).
              Baris tanpa peran = cakupan data warisan.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 space-y-1 overflow-auto text-xs">
            {(peranRow?.lembagas ?? []).map((l) => (
              <li
                key={`${l.jenjang}-${l.pivot?.role ?? 'cakupan'}`}
                className="flex items-center justify-between gap-2 rounded border px-3 py-1.5"
              >
                <span>{l.jenjang} — {l.nama} · <b>{l.pivot?.role ?? 'cakupan'}</b></span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  id={`btn_lepas_peran_${l.jenjang}_${l.pivot?.role ?? 'cakupan'}`}
                  onClick={() => void onLepasPeran(l.jenjang, l.pivot?.role ?? null)}
                >
                  Lepas
                </Button>
              </li>
            ))}
            {(peranRow?.lembagas ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground">Belum ada akses lembaga.</li>
            )}
          </ul>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="select_tambah_jenjang">Lembaga</FieldLabel>
            <Select value={tambahJenjang || '_pilih'} onValueChange={(v) => setTambahJenjang(v === '_pilih' ? '' : v)}>
              <SelectTrigger id="select_tambah_jenjang"><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_pilih">Pilih lembaga</SelectItem>
                  {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="select_tambah_peran">Peran</FieldLabel>
            <Select value={tambahPeran} onValueChange={setTambahPeran}>
              <SelectTrigger id="select_tambah_peran"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {peranOpsi.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPeranRow(null)}>Tutup</Button>
            <Button id="btn_tambah_peran_lembaga" disabled={!tambahJenjang} onClick={() => void onTambahPeran()}>
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah role & lembaga{editRow ? `: ${editRow.name}` : ''}</DialogTitle>
            <DialogDescription>Menyimpan akan mencabut semua sesi pengguna tersebut.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel className="self-start pt-1.5">Role</FieldLabel>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {isSuper ? 'Pilih 1 atau lebih (6 opsi).' : 'Pilih 1 atau lebih (4 opsi — tanpa admin/super_admin).'}
              </p>
              <div id="group_ubah_role" className="flex flex-wrap gap-2">
                {assignable.map((r) => (
                  <label
                    key={r}
                    htmlFor={`check_ubah_role_${r}`}
                    className="inline-flex h-6 min-w-32 cursor-pointer items-center gap-2 rounded-pil border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
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
                  key={l.jenjang}
                  htmlFor={`check_ubah_lembaga_${l.jenjang}`}
                  className="inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-pil border bg-card px-3.5 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <Checkbox
                    id={`check_ubah_lembaga_${l.jenjang}`}
                    checked={editLembaga.includes(l.jenjang)}
                    onCheckedChange={() => setEditLembaga((s) => toggleId(s, l.jenjang))}
                  /> {l.jenjang} — {l.nama}
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
