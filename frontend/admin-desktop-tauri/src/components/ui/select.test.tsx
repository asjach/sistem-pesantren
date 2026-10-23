import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from './select';

function Contoh({ tanpaAutoPilih, onValueChange }: {
  tanpaAutoPilih?: boolean;
  onValueChange: (nilai: string) => void;
}) {
  return (
    <Select value="" onValueChange={onValueChange} tanpaAutoPilih={tanpaAutoPilih}>
      <SelectTrigger aria-label="Pilihan">Pilih</SelectTrigger>
      <SelectContent>
        <SelectItem value="MI">MI</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('memilih otomatis saat hanya ada satu opsi', async () => {
    const onValueChange = vi.fn();
    renderDenganTema(<Contoh onValueChange={onValueChange} />);

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('MI'));
  });

  it('tanpaAutoPilih melewati pemindaian opsi dan tidak memilih otomatis', () => {
    const onValueChange = vi.fn();
    renderDenganTema(<Contoh onValueChange={onValueChange} tanpaAutoPilih />);

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
