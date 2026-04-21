import { test, expect } from '@playwright/test';

test.describe('Settings in sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Default UI language is English (see app/page.tsx initial config).
  // Accessible names are driven by the translation strings: Model, Language, TTS Speed.

  test('settings section has accessible region', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    await expect(settings).toBeVisible();
  });

  test('model input is queryable by role/name', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    const modelInput = settings.getByRole('textbox', { name: 'Model' });
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toBeEditable();
  });

  test('language select is queryable by role/name with correct options', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    const select = settings.getByRole('combobox', { name: 'Language' });
    await expect(select).toBeVisible();

    // Verify the required language options are present (by role). We don't
    // enforce an exact count so adding future locales won't break this test.
    await expect(select.getByRole('option', { name: '中文' })).toBeAttached();
    await expect(select.getByRole('option', { name: 'English' })).toBeAttached();

    // Default is English.
    await expect(select).toHaveValue('en');
  });

  test('TTS speed slider is queryable by role/name with default and bounds', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    const slider = settings.getByRole('slider', { name: 'TTS Speed' });
    await expect(slider).toBeVisible();

    // Default TTS speed is 1.0.
    await expect(slider).toHaveValue('1');

    // Slider bounds.
    await expect(slider).toHaveAttribute('min', '0.5');
    await expect(slider).toHaveAttribute('max', '2');
    await expect(slider).toHaveAttribute('step', '0.1');
  });

  test('changing model input propagates to the field value', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    const modelInput = settings.getByRole('textbox', { name: 'Model' });
    await modelInput.fill('claude-3.5');
    await expect(modelInput).toHaveValue('claude-3.5');
  });

  test('changing language re-renders labels in the selected language', async ({ page }) => {
    const settings = page.getByRole('region', { name: 'Settings' });
    const select = settings.getByRole('combobox', { name: 'Language' });
    await select.selectOption('zh');

    // After switching to Chinese, the region name and control names should update.
    const zhSettings = page.getByRole('region', { name: '设置' });
    await expect(zhSettings).toBeVisible();
    await expect(zhSettings.getByRole('textbox', { name: '模型' })).toBeVisible();
    await expect(zhSettings.getByRole('combobox', { name: '语言' })).toBeVisible();
    await expect(zhSettings.getByRole('slider', { name: '语音速度' })).toBeVisible();
  });
});
