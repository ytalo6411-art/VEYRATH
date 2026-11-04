import { expect, test } from '@playwright/test';

test('creates a local campaign and restores it after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Oficina local:', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Criar campanha', exact: true }).first().click();
  await page.getByLabel('Nome da campanha').fill('Aurora de Valedouro');
  await page.getByLabel(/Descrição/).fill('Uma estrada esquecida sob a neve.');
  await page.getByRole('button', { name: 'Criar campanha', exact: true }).last().click();

  await expect(page.getByRole('heading', { name: 'Aurora de Valedouro' })).toBeVisible();
  await expect(page.getByText('Este navegador · local')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Campanhas' }).click();
  await expect(page.getByRole('button', { name: /Aurora de Valedouro/ })).toBeVisible();
});
