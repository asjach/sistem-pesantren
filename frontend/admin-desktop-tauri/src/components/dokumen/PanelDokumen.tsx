import type { ReactNode } from 'react';
import { isTauri } from '@/api/client';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ComboCari from '@/components/ComboCari';
import { cn } from '@/lib/utils';
import PenampilBerkas from '@/components/dokumen/PenampilBerkas';
import DialogSinkronDokumen from '@/components/dokumen/DialogSinkronDokumen';
import { useHalamanDokumen, type EntitasDokumen } from '@/components/dokumen/useHalamanDokumen';
import { Check, Download, FolderOpen, MoreVertical, Plus, RefreshCw, Save, Trash2, Undo2, Upload, X } from '@/icons';

/** Id elemen per entitas (NFR-05: snake_case). Sengaja eksplisit, bukan pola
 *  sufiks, karena beberapa id menyisipkan "pegawai" di tengah
 *  (mis. panel_lihat_dokumen[_pegawai]_daftar). */
interface IdDokumen {
  grup: string;
  grupKelas: string;
  panelDaftar: string;
  gagang: string;
  panelPratinjau: string;
  labelDaftar: string;
  tombolSinkron: string;
  btnAksi: (id: number) => string;
  menuToggle: (id: number) => string;
  labelInfo: string;
  btnReset: string;
  btnSimpanInfo: string;
  infoDok: string;
  comboJenis: string;
  inputJenis: string;
  comboLembaga: string;
  inputLembaga: string;
  comboStatus: string;
  inputStatus: string;
  inputNama: string;
  comboLokasi: string;
  inputLokasi: string;
  inputCatatan: string;
  tombolTambah: string;
  btnSimpanEdit: string;
  inputGanti: string;
  btnProsesGanti: string;
  idPrefixViewer: string;
}

/** Bagian tampilan yang berbeda antar entitas. */
interface KonfigEntitas {
  /** Label baris pemilik di Info dokumen. */
  labelNama: string;
  /** Santri menampilkan NIS lokal + medan Lembaga; pegawai tidak. */
  punyaNis: boolean;
  punyaLembaga: boolean;
  /** Tinggi kotak Info dokumen (santri lebih tinggi karena dua baris ekstra). */
  tinggiInfo: string;
  /** Tooltip tombol simpan info dokumen. */
  tipSimpanInfo: string;
  /** Filter berkas pada input ganti versi web (pegawai tanpa batasan). */
  acceptBerkas?: string;
}

const ID: Record<EntitasDokumen, IdDokumen> = {
  santri: {
    grup: 'grup_lihat_dokumen',
    grupKelas: 'min-h-0 min-w-0 flex-1 overflow-hidden',
    panelDaftar: 'panel_lihat_dokumen_daftar',
    gagang: 'gagang_lihat_dokumen',
    panelPratinjau: 'panel_lihat_dokumen_pratinjau',
    labelDaftar: 'label_daftar_dokumen_lihat',
    tombolSinkron: 'tombol_sinkron_dok_lihat',
    btnAksi: (id) => 'btn_aksi_dok_lihat_' + id,
    menuToggle: (id) => 'menu_toggle_aktif_dok_lihat_' + id,
    labelInfo: 'label_info_dokumen_lihat',
    btnReset: 'btn_reset_info_dok_lihat',
    btnSimpanInfo: 'btn_simpan_info_dok_lihat',
    infoDok: 'info_dokumen_lihat',
    comboJenis: 'combo_jenis_info_dok_lihat',
    inputJenis: 'input_jenis_info_dok_lihat',
    comboLembaga: 'combo_lembaga_info_dok_lihat',
    inputLembaga: 'input_lembaga_info_dok_lihat',
    comboStatus: 'combo_status_info_dok_lihat',
    inputStatus: 'input_status_info_dok_lihat',
    inputNama: 'input_nama_info_dok_lihat',
    comboLokasi: 'combo_lokasi_info_dok_lihat',
    inputLokasi: 'input_lokasi_info_dok_lihat',
    inputCatatan: 'input_catatan_info_dok_lihat',
    tombolTambah: 'tombol_tambah_dok_lihat',
    btnSimpanEdit: 'btn_simpan_edit_dok_lihat',
    inputGanti: 'input_ganti_dok_lihat',
    btnProsesGanti: 'btn_proses_ganti_dok_lihat',
    idPrefixViewer: 'lihat_dokumen',
  },
  pegawai: {
    grup: 'grup_lihat_dokumen_pegawai',
    grupKelas: 'min-h-0 flex-1 overflow-hidden',
    panelDaftar: 'panel_lihat_dokumen_pegawai_daftar',
    gagang: 'gagang_lihat_dokumen_pegawai',
    panelPratinjau: 'panel_lihat_dokumen_pegawai_pratinjau',
    labelDaftar: 'label_daftar_dokumen_lihat_pegawai',
    tombolSinkron: 'tombol_sinkron_dok_lihat_pegawai',
    btnAksi: (id) => 'btn_aksi_dok_lihat_pegawai_' + id,
    menuToggle: (id) => 'menu_toggle_aktif_dok_lihat_pegawai_' + id,
    labelInfo: 'label_info_dokumen_lihat_pegawai',
    btnReset: 'btn_reset_info_dok_lihat_pegawai',
    btnSimpanInfo: 'btn_simpan_info_dok_lihat_pegawai',
    infoDok: 'info_dokumen_lihat_pegawai',
    comboJenis: 'combo_jenis_info_dok_lihat_pegawai',
    inputJenis: 'input_jenis_info_dok_lihat_pegawai',
    comboLembaga: 'combo_lembaga_info_dok_lihat_pegawai',
    inputLembaga: 'input_lembaga_info_dok_lihat_pegawai',
    comboStatus: 'combo_status_info_dok_lihat_pegawai',
    inputStatus: 'input_status_info_dok_lihat_pegawai',
    inputNama: 'input_nama_info_dok_lihat_pegawai',
    comboLokasi: 'combo_lokasi_info_dok_lihat_pegawai',
    inputLokasi: 'input_lokasi_info_dok_lihat_pegawai',
    inputCatatan: 'input_catatan_info_dok_lihat_pegawai',
    tombolTambah: 'tombol_tambah_dok_lihat_pegawai',
    btnSimpanEdit: 'btn_simpan_edit_dok_lihat_pegawai',
    inputGanti: 'input_ganti_dok_lihat_pegawai',
    btnProsesGanti: 'btn_proses_ganti_dok_lihat_pegawai',
    idPrefixViewer: 'lihat_dokumen_pegawai',
  },
};

const KONFIG: Record<EntitasDokumen, KonfigEntitas> = {
  santri: {
    labelNama: 'Nama santri',
    punyaNis: true,
    punyaLembaga: true,
    tinggiInfo: 'h-56',
    tipSimpanInfo: 'Simpan perubahan',
    acceptBerkas: '.jpg,.jpeg,.png,.pdf,.heic,.heif,.webp',
  },
  pegawai: {
    labelNama: 'Nama guru',
    punyaNis: false,
    punyaLembaga: false,
    tinggiInfo: 'h-44',
    tipSimpanInfo: 'Simpan perubahan jenis/catatan',
  },
};

interface Props {
  entitas: EntitasDokumen;
  /** Subjek terpilih (santri/pegawai); null = belum ada. */
  subjekId: number | null;
  /** Subjek terpilih di daftar halaman (null = belum/tak ada di daftar). */
  subjekTerpilih: { namaLengkap: string } | null;
  jenjangs: readonly string[];
  filterLoading: boolean;
  bolehUbah: boolean;
  bolehHapus: boolean;
  bolehTambah: boolean;
  /** Segarkan peta jumlah dokumen subjek di halaman (badge "Dok"). */
  segarkanJumlah: () => void;
  /** Blok daftar subjek (kolom 1 baris 1) milik halaman. */
  panelSubjek: ReactNode;
  /** Dialog tambah milik entitas, dibuka dari tombol "Tambah Dokumen". */
  dialogTambah: (args: { terbuka: boolean; onTutup: () => void; onSelesai: () => void }) => ReactNode;
}

/** Panel dokumen bersama halaman Dokumen Santri & Dokumen Pegawai:
 *  daftar dokumen subjek terpilih + Info dokumen (kolom kiri) dan pratinjau
 *  (kolom kanan), beserta dialog sinkron/hapus/ganti. Semua logika ada di
 *  `useHalamanDokumen`; perbedaan entitas lewat konfigurasi di atas. */
export default function PanelDokumen({
  entitas,
  subjekId,
  subjekTerpilih,
  jenjangs,
  filterLoading,
  bolehUbah,
  bolehHapus,
  bolehTambah,
  segarkanJumlah,
  panelSubjek,
  dialogTambah,
}: Props) {
  const desktop = isTauri();
  const id = ID[entitas];
  const cfg = KONFIG[entitas];
  const Label = entitas === 'santri' ? 'Santri' : 'Pegawai';
  const d = useHalamanDokumen({ entitas, subjekId, segarkanJumlah, jenjangs, filterLoading, bolehUbah });

  const namaPemilik = cfg.punyaLembaga
    ? (d.dokPratinjau?.pemilik ?? subjekTerpilih?.namaLengkap ?? '—')
    : (d.dokPratinjau?.nama_lengkap ?? subjekTerpilih?.namaLengkap ?? '—');

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" id={id.grup} className={id.grupKelas}>
        {/* Kolom 1: daftar subjek (baris 1) + daftar dokumen (baris 2). */}
        <ResizablePanel defaultSize={400} minSize={300} maxSize="70%" id={id.panelDaftar} className="min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          {panelSubjek}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id={id.labelDaftar}>Daftar dokumen{subjekId != null && d.dokumens.length > 0 ? ' (' + d.dokumens.length + ')' : ''}</FieldLabel>
              {desktop && bolehUbah && subjekId != null && (
                <Button
                  id={id.tombolSinkron}
                  size="sm"
                  variant="outline"
                  onClick={() => d.setSinkronTerbuka(true)}
                  title={'Sinkronkan dokumen ' + entitas + ' ini (cermin dua arah)'}
                >
                  <RefreshCw size={14} /> Sinkronkan
                </Button>
              )}
            </div>
            <div className="min-h-[120px] flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Jenis</th>
                    <th className="px-2 py-1 font-medium">Catatan</th>
                    <th className="px-2 py-1 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {subjekId == null ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">{'Pilih ' + entitas + ' dahulu.'}</td></tr>
                  ) : d.loadingDok ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : d.dokumens.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Belum ada dokumen.</td></tr>
                  ) : d.dokumens.map((row) => {
                    const aktif = row.id === d.dokId;
                    const kunci = d.perluDesktop(row);
                    return (
                      <ContextMenu key={row.id}>
                        <ContextMenuTrigger asChild>
                      <tr
                        onClick={() => { if (!kunci) void d.muatPratinjau(row); }}
                        title={kunci ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Klik untuk pratinjau'}
                        aria-selected={aktif}
                        className={cn(
                          'border-t',
                          kunci ? 'opacity-60' : 'cursor-pointer',
                          aktif ? 'bg-accent font-medium' : (!kunci && 'hover:bg-muted/60'),
                        )}
                      >
                        <td className="px-2">
                          <span
                            title={row.is_active === false ? 'Nonaktif' : 'Aktif'}
                            className={cn(
                              'mr-1.5 inline-block size-2 rounded-full align-middle',
                              row.is_active === false ? 'bg-red-500' : 'bg-green-500',
                            )}
                          />
                          {row.jenis_dokumen}
                          {cfg.punyaLembaga && row.lembaga ? <Badge variant="outline" className="ml-1 py-0 text-[10px] leading-3">{row.lembaga}</Badge> : null}
                        </td>
                        <td className="max-w-40 truncate px-2 text-muted-foreground" title={row.catatan ?? undefined}>{row.catatan || '—'}</td>
                        <td className="px-2 text-right">
                          <span className="inline-block" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  id={id.btnAksi(row.id)}
                                  size="sm"
                                  variant="ghost"
                                  title="Aksi dokumen"
                                  className="size-6 px-0"
                                >
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {row.nama_file && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Unduh berkas'}
                                    onClick={() => void d.unduhCerdas(row)}
                                  >
                                    <Download size={14} /> Unduh
                                  </DropdownMenuItem>
                                )}
                                {bolehUbah && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Baris arsip perangkat hanya bisa diganti lewat aplikasi desktop' : 'Ganti berkas'}
                                    onClick={() => { d.setGantiFile(null); d.setGantiRow(row); }}
                                  >
                                    <Upload size={14} /> Ganti
                                  </DropdownMenuItem>
                                )}
                                {bolehUbah && row.is_active === false && (
                                  <DropdownMenuItem
                                    title="Jadikan dokumen aktif (menonaktifkan yang lain se-kunci)"
                                    onClick={() => void d.onToggleAktif(row)}
                                  >
                                    <Check size={14} /> Jadikan aktif
                                  </DropdownMenuItem>
                                )}
                                {bolehHapus && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Baris arsip perangkat hanya bisa dihapus lewat aplikasi desktop (agar salinannya ikut bersih)' : 'Hapus dokumen'}
                                    onClick={() => d.setHapusRow(row)}
                                  >
                                    <Trash2 size={14} /> Hapus
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        </td>
                      </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          {bolehUbah && (
                            <ContextMenuItem
                              id={id.menuToggle(row.id)}
                              disabled={d.busy}
                              onClick={() => void d.onToggleAktif(row)}
                            >
                              {row.is_active === false ? <Check size={14} /> : <X size={14} />}
                              {row.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id={id.labelInfo}>Info dokumen</FieldLabel>
              {d.infoKotor && (
                <>
                  <TombolIkon
                    tip="Kembalikan ke nilai awal"
                    id={id.btnReset}
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={d.busy}
                    onClick={d.resetEdit}
                  >
                    <Undo2 size={14} />
                  </TombolIkon>
                  <TombolIkon
                    tip={cfg.tipSimpanInfo}
                    id={id.btnSimpanInfo}
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={d.busy || d.editJenis.trim() === '' || !d.infoBisaUbah}
                    onClick={() => void d.onUbah()}
                  >
                    <Save size={14} />
                  </TombolIkon>
                </>
              )}
            </div>
            {d.dokPratinjau == null ? (
              <div className={cn(cfg.tinggiInfo, 'overflow-y-auto rounded-md border px-2 py-1.5')}>
                <p className="text-xs text-muted-foreground">Pilih baris dokumen untuk melihat info.</p>
              </div>
            ) : (
              <dl id={id.infoDok} className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 overflow-y-auto rounded-md border px-2 py-1.5 text-xs', cfg.tinggiInfo)}>
                <dt className="text-muted-foreground">{cfg.labelNama}</dt>
                <dd>{namaPemilik}</dd>
                {cfg.punyaNis && (
                  <>
                    <dt className="text-muted-foreground">NIS Lokal</dt>
                    <dd>{d.dokPratinjau.nis_lokal ?? '—'}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Jenis</dt>
                <dd>
                  {d.infoBisaUbah ? (
                    <ComboCari
                      id={id.comboJenis}
                      inputId={id.inputJenis}
                      value={d.editJenis}
                      onChange={d.setEditJenis}
                      options={d.opsiJenisUbah}
                      placeholder="Pilih jenis…"
                      className="w-full"
                    />
                  ) : (
                    <span title={bolehUbah && d.dokPratinjau ? d.judulSelaras(d.dokPratinjau) : undefined}>{d.dokPratinjau.jenis_dokumen}</span>
                  )}
                </dd>
                {cfg.punyaLembaga && (
                  <>
                    <dt className="text-muted-foreground">Lembaga</dt>
                    <dd>
                      {d.infoBisaUbah ? (
                        <ComboCari
                          id={id.comboLembaga}
                          inputId={id.inputLembaga}
                          value={d.editLembaga}
                          onChange={d.setEditLembaga}
                          options={[{ value: '', label: '—' }, ...jenjangs.map((j) => ({ value: j, label: j }))]}
                          placeholder="Tanpa lembaga…"
                          className="w-full"
                        />
                      ) : (
                        d.dokPratinjau.lembaga ?? '—'
                      )}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {d.infoBisaUbah ? (
                    <ComboCari
                      id={id.comboStatus}
                      inputId={id.inputStatus}
                      value={d.editAktif}
                      onChange={d.setEditAktif}
                      options={[{ value: 'Ya', label: 'Aktif' }, { value: 'Tidak', label: 'Nonaktif' }]}
                      placeholder="Pilih status…"
                      className="w-full"
                    />
                  ) : (
                    d.dokPratinjau.is_active === false ? 'Nonaktif' : 'Aktif'
                  )}
                </dd>
                <dt className="text-muted-foreground">Nama berkas</dt>
                <dd>
                  {d.infoBisaUbah ? (
                    <Input
                      id={id.inputNama}
                      value={d.editNama}
                      onChange={(e) => d.setEditNama(e.target.value)}
                      placeholder="nama berkas…"
                      className="h-6 text-xs"
                    />
                  ) : (
                    <span className="block truncate" title={d.dokPratinjau.nama_file ?? undefined}>{d.dokPratinjau.nama_file ?? '—'}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Lokasi</dt>
                <dd>
                  {d.infoBisaUbah ? (
                    <ComboCari
                      id={id.comboLokasi}
                      inputId={id.inputLokasi}
                      value={d.editLokasi}
                      onChange={d.setEditLokasi}
                      options={[
                        { value: 'server', label: 'Server' },
                        { value: 'lokal', label: 'Lokal' },
                        { value: 'test', label: 'Test' },
                        ...((d.dokPratinjau.penyimpanan ?? 'server') === 'cermin'
                          ? [{ value: 'cermin', label: 'Cermin' }]
                          : []),
                      ]}
                      placeholder="Pilih lokasi…"
                      className="w-full"
                    />
                  ) : (
                    d.lokasiLabel(d.dokPratinjau)
                  )}
                </dd>
                <dt className="text-muted-foreground">Catatan</dt>
                <dd>
                  {d.infoBisaUbah ? (
                    <Input
                      id={id.inputCatatan}
                      value={d.editCatatan}
                      onChange={(e) => d.setEditCatatan(e.target.value)}
                      placeholder="opsional"
                      className="h-6 text-xs"
                    />
                  ) : (
                    <span className="block truncate" title={d.dokPratinjau.catatan ?? undefined}>{d.dokPratinjau.catatan || '—'}</span>
                  )}
                </dd>
              </dl>
            )}
          </div>
          {bolehTambah && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <Button
                id={id.tombolTambah}
                size="sm"
                disabled={subjekTerpilih == null}
                onClick={() => d.setTambahTerbuka(true)}
                title={subjekTerpilih ? 'Tambah dokumen untuk ' + entitas + ' ini' : 'Pilih ' + entitas + ' dahulu'}
              >
                <Plus size={14} /> Tambah Dokumen
              </Button>
            </div>
          )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id={id.gagang} aria-label="Atur lebar kolom daftar dan pratinjau" />
        {/* Kolom 2: pratinjau + edit (fungsi sama dengan Tambah Dokumen). */}
        <ResizablePanel minSize="25%" id={id.panelPratinjau} className="min-h-0 min-w-0">
          <div className="flex h-full min-h-0 flex-col gap-1.5">
            {d.kotor && d.keluaran && d.dokId !== null && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-dashed px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {d.prosesViewer ? 'Menyiapkan hasil…' : 'Ada perubahan belum disimpan.'}
                </span>
                <TombolIkon tip="Buang perubahan" variant="outline" size="icon" onClick={() => d.setKunciViewer((k) => k + 1)}>
                  <Undo2 size={14} />
                </TombolIkon>
                <TombolIkon tip={d.prosesViewer ? 'Menyiapkan hasil…' : 'Simpan hasil edit'} id={id.btnSimpanEdit} size="icon" disabled={d.busy || d.prosesViewer} onClick={() => void d.onSimpanEdit()}>
                  <Save size={14} />
                </TombolIkon>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <PenampilBerkas
                key={id.idPrefixViewer + '_' + (d.dokId ?? 'kosong') + '_' + d.kunciViewer}
                sumber={d.pratinjau}
                kualitas="asli"
                onKeluaran={d.setKeluaran}
                onKotor={d.setKotor}
                onProses={d.setProsesViewer}
                idPrefix={id.idPrefixViewer}
                bisaUbah={d.bisaUbahViewer}
                teksKosong={'Belum ada dokumen dipilih — pilih ' + entitas + ' lalu klik baris dokumen.'}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {dialogTambah({
        terbuka: d.tambahTerbuka,
        onTutup: () => d.setTambahTerbuka(false),
        onSelesai: () => { void d.segarkanSetelahSinkron(); },
      })}
      <DialogSinkronDokumen
        tipe={entitas}
        terbuka={d.sinkronTerbuka}
        onTutup={() => d.setSinkronTerbuka(false)}
        ambilBaris={d.ambilBarisSubjek}
        lingkup={subjekId == null ? Label + ' belum dipilih' : Label + ': ' + (subjekTerpilih?.namaLengkap || '#' + subjekId)}
        onSelesai={() => { void d.segarkanSetelahSinkron(); }}
      />
      <AlertDialog open={d.hapusRow !== null} onOpenChange={(o) => { if (!o) d.setHapusRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen "{d.hapusRow?.jenis_dokumen}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen milik {entitas} terpilih dihapus permanen beserta berkas fisiknya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogCancel disabled={d.busy} aria-label="Batal">
                  <X size={14} />
                </AlertDialogCancel>
              </TooltipTrigger>
              <TooltipContent><p>Batal</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={d.busy} aria-label="Hapus dokumen" onClick={() => void d.onHapus()}>
                  <Trash2 size={14} />
                </AlertDialogAction>
              </TooltipTrigger>
              <TooltipContent><p>Hapus dokumen</p></TooltipContent>
            </Tooltip>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={d.gantiRow !== null} onOpenChange={(o) => { if (!o) d.setGantiRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ganti berkas: {d.gantiRow?.jenis_dokumen}</DialogTitle>
            <DialogDescription>Berkas lama diganti di lokasi yang sama; salinan arsip lama (bila ada) ikut dibuang.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <TombolIkon tip="Pilih berkas" variant="outline" size="icon" onClick={() => void d.onBrowseGanti()}>
              <FolderOpen size={14} />
            </TombolIkon>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={d.gantiFile?.name}>
              {d.gantiFile ? d.gantiFile.name + ' (' + (d.gantiFile.size / 1024).toFixed(0) + ' KB)' : 'Belum ada berkas dipilih.'}
            </span>
          </div>
          <input
            ref={d.inputGantiWebRef}
            id={id.inputGanti}
            type="file"
            accept={cfg.acceptBerkas}
            className="hidden"
            onChange={d.onFileGantiWeb}
          />
          <DialogFooter>
            <TombolIkon tip="Batal" variant="outline" size="icon" onClick={() => d.setGantiRow(null)}>
              <X size={14} />
            </TombolIkon>
            <TombolIkon tip="Ganti berkas" id={id.btnProsesGanti} size="icon" disabled={!d.gantiFile || d.busy} onClick={() => void d.onGanti()}>
              <Upload size={14} />
            </TombolIkon>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
