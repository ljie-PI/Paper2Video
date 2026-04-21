import { test, expect } from '@playwright/test';

// NOTE: Session creation requires the backend API to be running.
// These tests verify the UI interaction flow; they may fail without
// a fully functional backend (API route that persists sessions).

test.describe('Session management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking "New" button creates a session entry in the sidebar', async ({
    page,
  }) => {
    const sidebar = page.locator('aside');
    const nav = sidebar.locator('nav');

    // Count existing session entries before clicking
    const countBefore = await nav.locator('button').count();

    const createSessionRequest = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && response.url().includes('/api/sessions')
      && response.ok()
    ));

    // Click the "New" button
    await sidebar.getByRole('button', { name: /new/i }).click();
    await createSessionRequest;

    // Other tests may create sessions in parallel, so only require growth.
    await expect.poll(async () => nav.locator('button').count()).toBeGreaterThan(countBefore);
  });
});
