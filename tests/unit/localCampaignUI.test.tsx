import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DashboardPage } from '../../src/app/pages/DashboardPage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('Local Workshop campaign flow', () => {
  it('creates a campaign in the UI and recovers it from browser storage', async () => {
    const firstRender = render(<DashboardPage mode="local" workspaceId="local-workshop" />);
    await screen.findByText('Nenhuma campanha por aqui — ainda.');

    fireEvent.click(screen.getByRole('button', { name: 'Criar campanha' }));
    fireEvent.change(screen.getByLabelText('Nome da campanha'), { target: { value: 'Aurora de Valedouro' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'Uma estrada esquecida sob a neve.' } });
    const createButtons = screen.getAllByRole('button', { name: 'Criar campanha' });
    fireEvent.click(createButtons[createButtons.length - 1]!);

    await screen.findByRole('heading', { name: 'Aurora de Valedouro' });
    expect(window.localStorage.getItem('veyrath.local.campaigns.v1')).toContain('Uma estrada esquecida sob a neve.');

    firstRender.unmount();
    render(<DashboardPage mode="local" workspaceId="local-workshop" />);
    expect(await screen.findByRole('button', { name: /Aurora de Valedouro/ })).toBeTruthy();
  });
});
