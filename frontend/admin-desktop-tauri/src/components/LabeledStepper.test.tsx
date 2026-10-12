import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen, setelanKomponen } from '@/components/komponenCustom';

/* Setelan komponen custom disimpan di server; API-nya dimock agar tes bisa
   menyemai setelan lewat store klien tanpa jaringan. */
const { petaServer } = vi.hoisted(() => ({
  petaServer: { current: {} as Record<string, unknown> },
}));
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: petaServer.current } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  petaServer.current = {};
  resetSetelanKomponen();
});
import LabeledStepper from '@/components/LabeledStepper';

function Contoh({ min = 0, max = 10, step = 1, awal = 4 }: { min?: number; max?: number; step?: number; awal?: number }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <LabeledStepper
      label="Jumlah"
      htmlFor="uji_stepper_jumlah"
      min={min}
      max={max}
      step={step}
      value={nilai}
      onChange={setNilai}
    />
  );
}

describe('LabeledStepper', () => {
  it('tombol kurang/tambah menggeser nilai sesuai langkah', () => {
    renderDenganTema(<Contoh />);
    fireEvent.click(screen.getByRole('button', { name: 'Jumlah tambah' }));
    expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('5');
    fireEvent.click(screen.getByRole('button', { name: 'Jumlah kurang' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jumlah kurang' }));
    expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('3');
  });

  it('nilai dijepit ke min/maks dan tombol mati di batas', () => {
    renderDenganTema(<Contoh awal={10} />);
    expect(screen.getByRole('button', { name: 'Jumlah tambah' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Jumlah tambah' }));
    expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('10');
    fireEvent.click(screen.getByRole('button', { name: 'Jumlah kurang' }));
    expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('9');
  });

  it('ketikan di-commit saat blur dan id tombol snake_case', () => {
    renderDenganTema(<Contoh />);
    const input = screen.getByRole('textbox', { name: 'Jumlah' });
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('7');
    expect(document.getElementById('uji_stepper_jumlah_kurang')).not.toBeNull();
    expect(document.getElementById('uji_stepper_jumlah_tambah')).not.toBeNull();
  });

  it('klik kanan membuka popover ukuran (judul stepper): label menautkan kontrol', async () => {
    const kunci = `uji_stepper_pop_${Date.now()}`;
    function ContohPop() {
      const [nilai, setNilai] = useState(5);
      return (
        <LabeledStepper label="Jumlah" htmlFor={kunci} min={0} max={99} value={nilai} onChange={setNilai} />
      );
    }
    const { container } = renderDenganTema(<ContohPop />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(await screen.findByLabelText('Tinggi kotak stepper (px)')).not.toBeNull();
    // Label +4 → kontrol menyusut 4 (total tetap 160).
    await userEvent.click(await screen.findByLabelText('Lebar label stepper (px) tambah'));
    expect(setelanKomponen('', kunci)).toEqual({ lebarLabel: 84, lebarKontrol: 76 });
  });

  /* Baris "Langkah" di bagian "Lainnya" popover: interval perubahan nilai
     tombol −/+. Bawaan tertutup, jadi barisnya baru ada setelah pengalih
     kepala panel ditekan. */
  describe('popover: pengaturan langkah', () => {
    const kunci = 'uji_stepper_langkah';
    function ContohLangkah() {
      const [nilai, setNilai] = useState(4);
      return (
        <LabeledStepper label="Jumlah" htmlFor={kunci} min={0} max={100} value={nilai} onChange={setNilai} />
      );
    }
    const bukaPopover = async () => {
      const { container } = renderDenganTema(<ContohLangkah />);
      fireEvent.contextMenu(container.firstElementChild as HTMLElement);
      await screen.findByLabelText('Tinggi kotak stepper (px)');
      await userEvent.click(screen.getByRole('button', { name: 'Tampilkan pengaturan lainnya' }));
    };
    const tutupPopover = () => userEvent.click(document.body);

    it('langkah dari popover jadi interval tombol kurang/tambah & tersimpan', async () => {
      await bukaPopover();

      const langkah = screen.getByLabelText('Langkah stepper');
      expect(langkah).toHaveValue('1');
      await userEvent.click(screen.getByRole('button', { name: 'Langkah stepper tambah' }));
      await userEvent.click(screen.getByRole('button', { name: 'Langkah stepper tambah' }));
      await userEvent.click(screen.getByRole('button', { name: 'Langkah stepper tambah' }));
      await userEvent.click(screen.getByRole('button', { name: 'Langkah stepper tambah' }));
      expect(langkah).toHaveValue('5');
      // Tersimpan sebagai setelan komponen (server via store klien di tes).
      expect(setelanKomponen('', kunci).langkah).toBe(5);

      await tutupPopover();

      // Tombol stepper kini menggeser 5 per klik (4 → 9 → 4).
      fireEvent.click(screen.getByRole('button', { name: 'Jumlah tambah' }));
      expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('9');
      fireEvent.click(screen.getByRole('button', { name: 'Jumlah kurang' }));
      expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('4');
    });

    it('langkah tersimpan dibaca saat kotak dimuat ulang', async () => {
      petaServer.current = { '|uji_stepper_langkah': { langkah: 5 } };
      renderDenganTema(<ContohLangkah />);

      // Tunggu setelan dari "server" termuat ke store klien.
      await waitFor(() => expect(setelanKomponen('', kunci).langkah).toBe(5));
      fireEvent.click(screen.getByRole('button', { name: 'Jumlah tambah' }));
      expect(screen.getByRole('textbox', { name: 'Jumlah' })).toHaveValue('9');
    });

    it('reset baris Langkah mengembalikan interval ke prop pemanggil', async () => {
      petaServer.current = { '|uji_stepper_langkah': { langkah: 5 } };
      renderDenganTema(<ContohLangkah />);
      fireEvent.contextMenu(document.querySelector(`#${kunci}`)?.closest('span')?.parentElement as HTMLElement);
      await screen.findByLabelText('Tinggi kotak stepper (px)');
      await userEvent.click(screen.getByRole('button', { name: 'Tampilkan pengaturan lainnya' }));

      // Nilai tersimpan tampil di stepper popover (bukan bawaan 1).
      await waitFor(() => expect(screen.getByLabelText('Langkah stepper')).toHaveValue('5'));
      await userEvent.click(screen.getByRole('button', { name: 'Kembalikan langkah ke bawaan' }));
      expect(setelanKomponen('', kunci).langkah).toBeUndefined();
      expect(screen.getByLabelText('Langkah stepper')).toHaveValue('1');
    });
  });
});
