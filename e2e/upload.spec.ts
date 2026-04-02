import { test, expect } from '@playwright/test';

test.describe('PDF upload zone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('upload area is visible on initial load', async ({ page }) => {
    const dropZone = page.getByText('Drag a PDF here or browse');
    await expect(dropZone).toBeVisible();
  });

  test('upload area shows subtitle about research papers', async ({ page }) => {
    const subtitle = page.getByText('Optimized for long-form research papers');
    await expect(subtitle).toBeVisible();
  });

  test('hidden file input accepts PDF files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await expect(fileInput).toBeAttached();
  });
});
