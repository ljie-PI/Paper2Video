import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('sidebar renders with "Paper2Video" branding', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Paper2Video')).toBeVisible();
  });

  test('"New" button is visible in the sidebar', async ({ page }) => {
    const newButton = page.locator('aside').getByRole('button', { name: /new/i });
    await expect(newButton).toBeVisible();
  });

  test('chat input area is visible', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type a message');
    await expect(textarea).toBeVisible();
  });

  test('settings section is visible with "Model" label', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Settings')).toBeVisible();
    await expect(sidebar.getByText('Model')).toBeVisible();
  });
});
