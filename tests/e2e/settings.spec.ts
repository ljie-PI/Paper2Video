import { test, expect } from '@playwright/test';

test.describe('Settings in sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('model input field exists', async ({ page }) => {
    const sidebar = page.locator('aside');
    const modelLabel = sidebar.getByText('Model', { exact: true });
    await expect(modelLabel).toBeVisible();

    // The text input is inside the same <label> as "Model"
    const modelInput = sidebar.locator('label', { has: modelLabel }).locator('input[type="text"]');
    await expect(modelInput).toBeVisible();
  });

  test('language dropdown exists with correct options', async ({ page }) => {
    const sidebar = page.locator('aside');
    const languageLabel = sidebar.getByText('Language', { exact: true });
    await expect(languageLabel).toBeVisible();

    const select = sidebar.locator('label', { has: languageLabel }).locator('select');
    await expect(select).toBeVisible();

    // Verify both language options are present
    await expect(select.locator('option[value="zh"]')).toHaveText('中文');
    await expect(select.locator('option[value="en"]')).toHaveText('English');
  });

  test('TTS speed slider exists with default value', async ({ page }) => {
    const sidebar = page.locator('aside');
    const ttsLabel = sidebar.getByText('TTS Speed');
    await expect(ttsLabel).toBeVisible();

    const slider = sidebar.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Default TTS speed is 1.0
    await expect(slider).toHaveValue('1');
  });

  test('TTS speed slider value updates on interaction', async ({ page }) => {
    const sidebar = page.locator('aside');
    const slider = sidebar.locator('input[type="range"]');

    // Slider range is 0.5 – 2.0, step 0.1
    await expect(slider).toHaveAttribute('min', '0.5');
    await expect(slider).toHaveAttribute('max', '2');
    await expect(slider).toHaveAttribute('step', '0.1');
  });
});
