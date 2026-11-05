import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/app/pages/AuthPage';

afterEach(() => cleanup());

describe('explicit local preview entry', () => {
  it('offers an offline preview without submitting cloud credentials', () => {
    const onLocalPreview = vi.fn();
    render(<AuthPage onLocalPreview={onLocalPreview} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jogar prévia local sem conta' }));

    expect(onLocalPreview).toHaveBeenCalledOnce();
    expect(screen.getByText(/não há sincronização ou multiplayer/i)).toBeTruthy();
  });
});
