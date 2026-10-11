import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderDenganTema } from '@/test/utils';
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
});
