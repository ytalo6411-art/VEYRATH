import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function enterLocalWorkshopIfNeeded(page: Page) {
  const explicitLocalPreview = page.getByRole('button', { name: 'Jogar prévia local sem conta' });
  await expect.poll(async () => (
    await explicitLocalPreview.count() > 0
    || await page.getByText('Oficina local:', { exact: false }).count() > 0
  )).toBe(true);
  if (await explicitLocalPreview.count()) await explicitLocalPreview.click();
}

test('creates a local campaign, enters the playable preview and saves movement', async ({ page }) => {
  await page.goto('/');
  await enterLocalWorkshopIfNeeded(page);

  await expect(page.getByText('Oficina local:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha').fill('Aurora de Valedouro');
  await page.getByLabel(/Descrição/).fill('Uma estrada esquecida sob a neve.');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).last().click();

  await expect(page.getByRole('heading', { name: 'Aurora de Valedouro' })).toBeVisible();
  await expect(page.getByText('Este navegador · local')).toBeVisible();
  await page.getByRole('button', { name: 'Jogar prévia' }).click();
  await expect(page.getByText('PROGRESSO LOCAL · NESTE NAVEGADOR')).toBeVisible();
  await expect(page.locator('.adventure-viewport canvas')).toBeVisible();

  const campaignId = await page.evaluate(() => {
    const records = JSON.parse(window.localStorage.getItem('veyrath.local.campaigns.v1') ?? '[]') as Array<{ id: string }>;
    return records[0]?.id ?? '';
  });
  expect(campaignId).not.toBe('');
  await page.getByRole('button', { name: 'Mover para cima' }).click();
  const adventureKey = `veyrath.local.adventure.v1:${encodeURIComponent(campaignId)}`;
  await expect.poll(async () => page.evaluate((key) => {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { row?: number } | null;
    return saved?.row;
  }, adventureKey)).toBe(7);

  await page.reload();
  await enterLocalWorkshopIfNeeded(page);
  await page.getByRole('button', { name: 'Campanhas' }).click();
  await expect(page.getByRole('button', { name: /Aurora de Valedouro/ })).toBeVisible();
});
