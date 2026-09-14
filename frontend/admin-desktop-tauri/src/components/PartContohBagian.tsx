import type { ReactElement } from 'react';
import { PART_BY_ID, type PartId } from '@/parts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** Contoh isi pratinjau per bagian (meniru markup asli agar gaya terbaca).
 *  Dipakai editor Tampilan; bagian yang belum pernah dipakai di aplikasi
 *  tetap punya contoh agar pengaturannya bisa dinilai secara visual. */
export function contohBagian(id: PartId): ReactElement {
  // Sub-komponen memakai contoh induknya (slot aslinya sudah ada di komponen
  // nyata sehingga gaya sub bisa di-scope ke slot tersebut).
  const meta = PART_BY_ID.get(id);
  if (meta?.induk) return contohBagian(meta.induk);
  switch (id) {
    case 'ribbon':
    case 'tab_ribbon':
      return (
        <div className="flex gap-1 rounded bg-[var(--sidebar-deep)] p-2">
          <span className="rounded-t-md bg-white/20 px-3 py-1 text-xs font-semibold text-white">Beranda</span>
          <span className="rounded-t-md px-3 py-1 text-xs text-white/70">Master</span>
          <span className="rounded-t-md px-3 py-1 text-xs text-white/70">PSB</span>
        </div>
      );
    case 'grup_ribbon':
    case 'menu_ribbon':
      return (
        <div className="flex items-end gap-2 rounded bg-[var(--sidebar-deep)] p-2">
          <span className="flex h-[48px] w-[64px] items-center justify-center rounded bg-white/20 text-[11px] font-semibold text-white">Santri</span>
          <span className="flex h-[48px] w-[64px] items-center justify-center rounded text-[11px] text-white/80">Kelas</span>
          <span className="pb-1 text-[10px] uppercase tracking-wide text-white/50">Grup</span>
        </div>
      );
    case 'separator':
      return (
        <div className="w-full max-w-xs">
          <div className="h-6 rounded bg-muted" />
          <Separator className="my-2" />
          <div className="h-6 rounded bg-muted" />
        </div>
      );
    case 'aspect_ratio':
      return (
        <div className="w-40">
          <div className="grid aspect-video w-full place-items-center rounded border bg-muted text-xs text-muted-foreground">
            16 : 9
          </div>
        </div>
      );
    case 'scroll_area':
      return (
        <div className="h-24 w-48 overflow-y-auto rounded border p-2 text-xs">
          <div>Baris 1</div>
          <div>Baris 2</div>
          <div>Baris 3</div>
          <div>Baris 4</div>
          <div>Baris 5</div>
          <div>Baris 6</div>
          <div>Baris 7</div>
          <div>Baris 8</div>
        </div>
      );
    case 'resizable':
      return (
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-20 w-56 overflow-hidden rounded border"
        >
          <ResizablePanel id="pratinjau_resizable_kiri" className="p-2 text-xs">
            Panel kiri
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="pratinjau_resizable_kanan" className="p-2 text-xs">
            Panel kanan
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    case 'collapsible':
      return (
        <div className="w-56 rounded-lg border">
          <div className="flex items-center justify-between px-3 py-2 text-sm font-medium">
            Detail tambahan <span className="text-muted-foreground">▾</span>
          </div>
          <div className="border-t px-3 py-2 text-sm text-muted-foreground">Isi yang bisa dilipat.</div>
        </div>
      );
    case 'tabs':
      return (
        <div>
          <div className="inline-flex rounded-md bg-muted p-1">
            <span className="rounded bg-background px-3 py-1 text-sm font-medium shadow-sm">Umum</span>
            <span className="px-3 py-1 text-sm text-muted-foreground">Alamat</span>
            <span className="px-3 py-1 text-sm text-muted-foreground">Wali</span>
          </div>
          <div className="mt-2 rounded border p-2 text-sm">Isi tab Umum…</div>
        </div>
      );
    case 'breadcrumb':
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Beranda</span>
          <span>/</span>
          <span>Master</span>
          <span>/</span>
          <span className="font-medium text-foreground">Kelas</span>
        </div>
      );
    case 'pagination':
      return (
        <div className="flex items-center gap-1">
          <span className="rounded border px-2 py-0.5 text-xs">‹</span>
          <span className="rounded border bg-accent px-2 py-0.5 text-xs text-accent-foreground">1</span>
          <span className="rounded border px-2 py-0.5 text-xs">2</span>
          <span className="rounded border px-2 py-0.5 text-xs">3</span>
          <span className="rounded border px-2 py-0.5 text-xs">›</span>
        </div>
      );
    case 'menubar':
      return (
        <div className="flex gap-1 rounded border bg-background p-1 text-sm">
          <span className="rounded px-2 py-1 font-medium">Berkas</span>
          <span className="rounded px-2 py-1 text-muted-foreground">Ubah</span>
          <span className="rounded px-2 py-1 text-muted-foreground">Tampilan</span>
        </div>
      );
    case 'navigation_menu':
      return (
        <div className="flex items-center gap-1 rounded border bg-background p-1 text-sm">
          <span className="rounded px-2 py-1 font-medium">Master</span>
          <span className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground">
            PSB <span className="text-[10px]">▾</span>
          </span>
          <span className="rounded px-2 py-1 text-muted-foreground">Keuangan</span>
        </div>
      );
    case 'sidebar':
      return (
        <div className="flex w-40 flex-col gap-1 rounded bg-[var(--sidebar)] p-2">
          <span className="px-2 py-1 text-[10px] uppercase tracking-wide text-white/50">Master</span>
          <span className="rounded bg-white/20 px-2 py-1 text-xs font-medium text-white">Santri</span>
          <span className="px-2 py-1 text-xs text-white/80">Kelas</span>
        </div>
      );
    case 'judul_halaman':
      return <h2 className="text-lg font-semibold">Data Santri</h2>;
    case 'subjudul':
      return <h3 className="text-sm font-semibold">Ringkasan Keuangan</h3>;
    case 'teks_isi':
      return (
        <p className="max-w-md text-center text-sm">
          Total santri aktif tahun ajaran ini bertambah 24 orang dari periode sebelumnya.
        </p>
      );
    case 'kartu':
      return (
        <section className="w-full max-w-sm rounded-xl border bg-card p-3">
          <div className="text-sm font-medium">Ringkasan</div>
          <p className="text-sm text-muted-foreground">12 kelas · 345 santri aktif</p>
        </section>
      );
    case 'badge':
      return (
        <div className="flex gap-1.5">
          <Badge>Aktif</Badge>
          <Badge variant="secondary">Sekunder</Badge>
          <Badge variant="outline">Nonaktif</Badge>
        </div>
      );
    case 'kbd':
      return (
        <div className="flex items-center gap-1 text-sm">
          <span>Simpan</span>
          <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl</span>
          <span>+</span>
          <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">S</span>
        </div>
      );
    case 'item':
      return (
        <Item variant="outline" size="sm" className="w-64">
          <ItemMedia className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
            AF
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Ahmad Fauzi</ItemTitle>
            <ItemDescription>Kelas VII-A · Aktif</ItemDescription>
          </ItemContent>
        </Item>
      );
    case 'empty':
      return (
        <div className="grid w-64 place-items-center gap-1 rounded-lg border border-dashed p-6 text-center">
          <div className="text-sm font-medium">Belum ada data</div>
          <div className="text-xs text-muted-foreground">Tambahkan data untuk memulai.</div>
        </div>
      );
    case 'accordion':
      return (
        <Accordion
          type="single"
          collapsible
          defaultValue="identitas"
          className="w-64 rounded-lg border px-3"
        >
          <AccordionItem value="identitas">
            <AccordionTrigger className="py-2">Identitas</AccordionTrigger>
            <AccordionContent className="pb-2">Nama, NIS, jenis kelamin…</AccordionContent>
          </AccordionItem>
          <AccordionItem value="wali">
            <AccordionTrigger className="py-2">Wali</AccordionTrigger>
            <AccordionContent className="pb-2">Nama & kontak wali santri.</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    case 'tabel_header':
      return (
        <div className="simpes-dsg w-full max-w-sm overflow-hidden rounded border">
          <div className="dsg-row dsg-row-header flex">
            {['Nama', 'Kelas', 'Status'].map((t) => (
              <div
                key={t}
                className="dsg-cell dsg-cell-header flex flex-1 items-center justify-center"
                style={{ borderRight: '1px solid var(--dsg-border-color)' }}
              >
                <div
                  className="dsg-cell-header-container py-1"
                  style={{ color: 'var(--dsg-header-text-color, var(--muted-foreground))' }}
                >
                  {t}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'tabel_sel':
      return (
        <div className="simpes-dsg w-full max-w-sm overflow-hidden rounded border">
          {[
            ['Ahmad Fauzi', 'VII-A', 'Aktif'],
            ['Siti Aminah', 'VIII-B', 'Aktif'],
          ].map((baris) => (
            <div key={baris[0]} className="dsg-row flex">
              {baris.map((t) => (
                <div
                  key={t}
                  className="dsg-cell simpes-dsg-fill flex-1 py-1"
                  style={{
                    background: 'var(--dsg-cell-background-color)',
                    color: 'var(--part-tabel_sel-fg, var(--foreground))',
                    borderTop: '1px solid var(--dsg-border-color)',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case 'tabel':
      return (
        <table className="w-full max-w-sm overflow-hidden rounded border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Nama</th>
              <th className="px-3 py-1.5 text-left font-medium">Kelas</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-3 py-1.5">Ahmad Fauzi</td>
              <td className="px-3 py-1.5">VII-A</td>
            </tr>
            <tr className="border-t">
              <td className="px-3 py-1.5">Siti Aminah</td>
              <td className="px-3 py-1.5">VIII-B</td>
            </tr>
          </tbody>
        </table>
      );
    case 'pager':
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded border px-1.5 py-0.5">‹</span>
          <span>Hal 1 / 4 · 345 data</span>
          <span className="rounded border px-1.5 py-0.5">›</span>
        </div>
      );
    case 'toolbar_tabel':
      return (
        <div className="flex w-full max-w-md flex-wrap items-center gap-2 rounded border bg-card p-2">
          <span className="rounded border px-2 py-1 text-xs">Cari…</span>
          <span className="text-xs text-muted-foreground">2 baris dipilih</span>
          <span className="ml-auto rounded border bg-primary px-2 py-1 text-xs text-primary-foreground">＋ Tambah</span>
        </div>
      );
    case 'label_form':
      return (
        <div className="flex flex-col gap-1">
          <Label>Nama lengkap</Label>
          <span className="text-xs text-muted-foreground">Label di atas kotak isian.</span>
        </div>
      );
    case 'input_form':
      return (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Input placeholder="Nama santri" />
          <Select defaultValue="vii-a">
            <SelectTrigger id="pratinjau_select_kelas" className="w-full">
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vii-a">VII-A</SelectItem>
              <SelectItem value="viii-b">VIII-B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case 'field':
      return (
        <Field className="w-56">
          <FieldLabel htmlFor="pratinjau_field_nama">Nama santri</FieldLabel>
          <Input id="pratinjau_field_nama" placeholder="Ahmad Fauzi" />
          <FieldDescription>Sesuai akta kelahiran.</FieldDescription>
        </Field>
      );
    case 'keterangan_field':
      return (
        <Field className="w-56">
          <FieldLabel htmlFor="pratinjau_ket_field">Nama santri</FieldLabel>
          <Input id="pratinjau_ket_field" placeholder="Ahmad Fauzi" />
          <FieldDescription>Sesuai akta kelahiran.</FieldDescription>
        </Field>
      );
    case 'input_group':
      return (
        <div className="flex w-56 items-center gap-1 rounded-md border px-2">
          <span className="text-xs text-muted-foreground">Rp</span>
          <span className="flex h-6 flex-1 items-center text-xs">150.000</span>
        </div>
      );
    case 'textarea':
      return (
        <div className="h-16 w-56 rounded-md border p-2 text-sm text-muted-foreground">
          Catatan tambahan untuk santri…
        </div>
      );
    case 'checkbox':
      return (
        <div className="flex flex-col gap-1.5">
          <Label className="gap-2">
            <Checkbox defaultChecked /> Aktif
          </Label>
          <Label className="gap-2 text-muted-foreground">
            <Checkbox /> Nonaktif
          </Label>
        </div>
      );
    case 'radio':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm">
            <span className="size-4 rounded-full border-4 border-primary" /> Laki-laki
          </span>
          <span className="flex items-center gap-2 text-sm">
            <span className="size-4 rounded-full border" /> Perempuan
          </span>
        </div>
      );
    case 'switch':
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-5 w-9 items-center rounded-full bg-primary p-0.5">
            <span className="ml-auto size-4 rounded-full bg-white" />
          </span>
          Aktifkan
        </div>
      );
    case 'slider':
      return (
        <div className="flex w-48 items-center gap-2">
          <span className="relative h-1.5 flex-1 rounded-full bg-muted">
            <span className="absolute left-0 top-0 h-1.5 w-2/3 rounded-full bg-primary" />
            <span className="absolute -top-1 left-2/3 size-3.5 rounded-full border-2 border-primary bg-background" />
          </span>
          <span className="text-xs text-muted-foreground">66</span>
        </div>
      );
    case 'input_otp':
      return (
        <div className="flex gap-1.5">
          {['4', '8', '2', ''].map((t, i) => (
            <span
              key={i}
              className="grid size-9 place-items-center rounded-md border text-sm font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      );
    case 'calendar':
      return (
        <div className="w-48 rounded-md border p-2">
          <div className="mb-1 text-center text-xs font-medium">September 2026</div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
            {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className={i === 9 ? 'rounded bg-primary text-primary-foreground' : ''}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      );
    case 'tombol':
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm">Simpan</Button>
          <Button size="sm" variant="secondary">Batal</Button>
          <Button size="sm" variant="outline">Filter</Button>
          <Button size="sm" variant="destructive">Hapus</Button>
        </div>
      );
    case 'toggle':
      return (
        <ToggleGroup type="multiple" variant="outline" defaultValue={['miring']}>
          <ToggleGroupItem value="miring">Miring</ToggleGroupItem>
          <ToggleGroupItem value="tebal">Tebal</ToggleGroupItem>
          <ToggleGroupItem value="garis">Garis bawah</ToggleGroupItem>
        </ToggleGroup>
      );
    case 'button_group':
      return (
        <div className="inline-flex overflow-hidden rounded-md border">
          <span className="border-r bg-background px-3 py-1 text-sm">Hari</span>
          <span className="border-r bg-accent px-3 py-1 text-sm text-accent-foreground">Minggu</span>
          <span className="bg-background px-3 py-1 text-sm">Bulan</span>
        </div>
      );
    case 'dropdown':
    case 'popover':
    case 'command':
      return (
        <div className="flex w-48 flex-col gap-1">
          <div
            data-slot="dropdown-menu-trigger"
            className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"
          >
            Pilihan <span className="text-muted-foreground">▾</span>
          </div>
          <div
            data-slot="dropdown-menu-content"
            className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <div
              data-slot="dropdown-menu-label"
              className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Aksi
            </div>
            <div data-slot="dropdown-menu-item" className="rounded px-2 py-1.5 text-sm">Ubah</div>
            <div
              data-slot="dropdown-menu-item"
              className="rounded bg-accent px-2 py-1.5 text-sm text-accent-foreground"
            >
              Lihat detail
            </div>
            <div
              data-slot="dropdown-menu-sub-trigger"
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm"
            >
              Lainnya <span className="text-muted-foreground">▸</span>
            </div>
            <div data-slot="dropdown-menu-separator" className="my-1 h-px bg-border" />
            <div data-slot="dropdown-menu-item" className="rounded px-2 py-1.5 text-sm text-destructive">
              Hapus
            </div>
          </div>
        </div>
      );
    case 'hover_card':
      return (
        <div className="flex items-center gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
          <span className="grid size-9 place-items-center rounded-full bg-muted text-xs">AF</span>
          <div>
            <div className="text-sm font-medium">Ahmad Fauzi</div>
            <div className="text-xs text-muted-foreground">Santri · VII-A</div>
          </div>
        </div>
      );
    case 'tooltip':
      return (
        <div className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md">
          Simpan data (Ctrl+S)
        </div>
      );
    case 'dialog':
      return (
        <div
          data-slot="dialog-content"
          className="w-full max-w-xs rounded-lg border bg-background p-4 shadow-lg"
        >
          <div data-slot="dialog-header">
            <div data-slot="dialog-title" className="font-semibold">Tambah Santri</div>
            <p data-slot="dialog-description" className="text-sm text-muted-foreground">
              Lengkapi data lalu simpan.
            </p>
          </div>
          <div data-slot="dialog-footer" className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" data-slot="alert-dialog-cancel">Batal</Button>
            <Button size="sm" data-slot="alert-dialog-action">Simpan</Button>
          </div>
        </div>
      );
    case 'sheet':
      return (
        <div className="flex h-28 w-full max-w-sm justify-end overflow-hidden rounded-lg border">
          <div className="w-2/3 border-l bg-background p-3 shadow-lg">
            <div className="text-sm font-medium">Filter</div>
            <p className="text-xs text-muted-foreground">Panel geser dari kanan.</p>
          </div>
        </div>
      );
    case 'drawer':
      return (
        <div className="flex h-28 w-full max-w-sm items-end rounded-lg border">
          <div className="w-full rounded-t-lg border-t bg-background p-3 shadow-lg">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted" />
            <div className="text-sm font-medium">Pilih lembaga</div>
          </div>
        </div>
      );
    case 'alert':
      return (
        <div className="flex w-64 gap-2 rounded-lg border bg-card p-3">
          <span className="text-sm">⚠️</span>
          <div>
            <div className="text-sm font-medium">Perhatian</div>
            <div className="text-xs text-muted-foreground">3 santri belum lengkap berkasnya.</div>
          </div>
        </div>
      );
    case 'progress':
      return (
        <div className="flex w-48 items-center gap-2">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full w-3/5 rounded-full bg-primary" />
          </span>
          <span className="text-xs text-muted-foreground">60%</span>
        </div>
      );
    case 'skeleton':
      return (
        <div className="flex w-48 items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      );
    case 'spinner':
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          Memuat…
        </div>
      );
    case 'toast':
      return (
        <div className="flex w-64 items-start gap-2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <span className="text-sm">✓</span>
          <div>
            <div className="text-sm font-medium">Data tersimpan</div>
            <div className="text-xs text-muted-foreground">Perubahan berhasil disimpan.</div>
          </div>
        </div>
      );
    case 'avatar':
      return (
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-sm font-medium">AF</span>
          <span className="grid size-10 place-items-center rounded-full border text-sm text-muted-foreground">SA</span>
        </div>
      );
    case 'carousel':
      return (
        <div className="flex w-56 items-center gap-2">
          <span className="rounded border px-1.5 py-0.5 text-xs">‹</span>
          <span className="grid h-16 flex-1 place-items-center rounded border bg-muted text-xs text-muted-foreground">
            Slide 1 / 3
          </span>
          <span className="rounded border px-1.5 py-0.5 text-xs">›</span>
        </div>
      );
    case 'chart':
      return (
        <div className="flex h-20 w-48 items-end gap-2 rounded border p-2">
          {[40, 65, 30, 80, 55].map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      );
    case 'multiselect':
      return (
        <div className="w-52 rounded-md border px-2 py-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="truncate">VII-A, VIII-B</span>
            <span className="text-muted-foreground">▾</span>
          </div>
        </div>
      );
    case 'spinbox':
      return (
        <div className="flex h-6 w-32 items-stretch overflow-hidden rounded-md border">
          <span className="grid w-5 place-items-center text-muted-foreground">−</span>
          <span className="grid flex-1 place-items-center border-x text-xs">38</span>
          <span className="grid w-5 place-items-center text-muted-foreground">+</span>
        </div>
      );
    case 'pesan_galat':
      return (
        <p className="max-w-xs rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          Gagal memuat data. Coba lagi.
        </p>
      );
    case 'pemisah_ribbon':
      return (
        <div className="flex h-16 items-center gap-2 rounded bg-[var(--sidebar-deep)] px-2">
          <span className="rounded bg-white/20 px-2 py-1 text-[11px] text-white">Santri</span>
          <span aria-hidden className="mx-0.5 h-10 w-px self-center bg-white/15" />
          <span className="rounded px-2 py-1 text-[11px] text-white/80">Kelas</span>
        </div>
      );
    case 'area_akun':
      return (
        <div className="ml-auto flex items-center gap-1 rounded bg-[var(--sidebar-deep)] p-2">
          <span className="grid size-6 place-items-center rounded-md text-white/75">☀</span>
          <span className="grid size-6 place-items-center rounded-md bg-white/20 text-white">☾</span>
          <span className="grid size-6 place-items-center rounded-md text-white/75">▮</span>
          <span className="ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white">
            <span className="grid size-4 place-items-center rounded-full bg-white/20">AF</span>
            Reviewer
          </span>
        </div>
      );
    default:
      return <div className="rounded border p-3 text-sm">{id}</div>;
  }
}
