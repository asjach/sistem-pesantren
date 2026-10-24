import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { renderDenganTema } from '@/test/utils';
import { BackupRestorePapan } from './BackupRestorePapan';

const mock = vi.hoisted(() => ({
  unduhBackupPapan: vi.fn(),
  pratinjauRestorePapan: vi.fn(),
  restorePapan: vi.fn(),
  unduhBackupKeamanan: vi.fn(),
}));
vi.mock('@/api/papan', () => mock);
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ringkasan = {
  dibuat_pada: '2026-10-23T21:00:00+07:00',
  versi: 1,
  modul: 2,
  sub_modul: 5,
  butir: 10,
  riwayat: 7,
  status: { pending: 0, backlog: 1, todo: 2, in_progress: 0, for_review: 3, done: 4 },
  workflow: {
    master: true,
    aplikasi: [
      { kode: 'desktop-admin', nama: 'Desktop Admin', aktif: true, efektif: true },
      { kode: 'mobile-guru', nama: 'Mobile Guru', aktif: false, efektif: false },
    ],
  },
};

function berkasBackup() {
  return new File([JSON.stringify({ format: 'simpes-papan' })], 'papan-backup.json', { type: 'application/json' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.unduhBackupPapan.mockResolvedValue(undefined);
  mock.pratinjauRestorePapan.mockResolvedValue({ ringkasan });
  mock.restorePapan.mockResolvedValue({
    pesan: 'Restore Board selesai.',
    ringkasan,
    backup_keamanan: 'papan-backup-sebelum-restore-20261023-120000.json',
  });
  mock.unduhBackupKeamanan.mockResolvedValue(undefined);
});

describe('BackupRestorePapan', () => {
  it('mengunduh backup saat tombol Backup diklik', async () => {
    const user = userEvent.setup();
    renderDenganTema(<BackupRestorePapan onSelesai={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Backup Board' }));

    await waitFor(() => expect(mock.unduhBackupPapan).toHaveBeenCalledTimes(1));
  });

  it('menampilkan ringkasan file lalu Batal tidak memulihkan', async () => {
    const user = userEvent.setup();
    const onSelesai = vi.fn();
    renderDenganTema(<BackupRestorePapan onSelesai={onSelesai} />);

    await user.upload(screen.getByLabelText('File backup Board'), berkasBackup());

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('papan-backup.json')).toBeInTheDocument();
    expect(within(dialog).getByText(/2 modul/)).toBeInTheDocument();
    expect(within(dialog).getByText(/10 poin/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Desktop Admin/)).toBeInTheDocument();
    expect(mock.restorePapan).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Batal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSelesai).not.toHaveBeenCalled();
  });

  it('konfirmasi memulihkan, memuat ulang Board, dan menyediakan backup keamanan', async () => {
    const user = userEvent.setup();
    const onSelesai = vi.fn(async () => {});
    renderDenganTema(<BackupRestorePapan onSelesai={onSelesai} />);

    await user.upload(screen.getByLabelText('File backup Board'), berkasBackup());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Restore Board' }));

    await waitFor(() => expect(mock.restorePapan).toHaveBeenCalledTimes(1));
    expect(onSelesai).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Restore Board selesai.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unduh backup sebelum restore' }));

    expect(mock.unduhBackupKeamanan).toHaveBeenCalledWith('papan-backup-sebelum-restore-20261023-120000.json');
  });

  it('menampilkan galat restore di dalam dialog tanpa menutupnya', async () => {
    const user = userEvent.setup();
    const onSelesai = vi.fn();
    mock.restorePapan.mockRejectedValueOnce(new Error('Restore gagal; Board lama tidak diubah.'));
    renderDenganTema(<BackupRestorePapan onSelesai={onSelesai} />);

    await user.upload(screen.getByLabelText('File backup Board'), berkasBackup());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Restore Board' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Board lama tidak diubah');
    expect(onSelesai).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('menolak file selain JSON tanpa memanggil pratinjau', async () => {
    renderDenganTema(<BackupRestorePapan onSelesai={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('File backup Board'), {
      target: { files: [new File(['bukan json'], 'papan.txt', { type: 'text/plain' })] },
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Pilih file backup berformat .json.'));
    expect(mock.pratinjauRestorePapan).not.toHaveBeenCalled();
  });

  it('menampilkan galat pratinjau sebagai toast', async () => {
    const user = userEvent.setup();
    mock.pratinjauRestorePapan.mockRejectedValueOnce(new Error('File bukan JSON yang valid.'));
    renderDenganTema(<BackupRestorePapan onSelesai={vi.fn()} />);

    await user.upload(screen.getByLabelText('File backup Board'), berkasBackup());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('File bukan JSON yang valid.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
