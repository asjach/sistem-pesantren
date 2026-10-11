import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { ukuranKombo } from '@/components/ukuranKombo';
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
    expect(ukuranKombo(kunci)).toEqual({ lebarLabel: 84, lebarKontrol: 76 });
  });
});
