import { test, expect } from '@playwright/test';

test.describe('Chat UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('chat input textarea exists with correct placeholder', async ({
    page,
  }) => {
    const textarea = page.getByPlaceholder('Type a message');
    await expect(textarea).toBeVisible();
  });

  test('can type into the chat textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type a message');
    await textarea.fill('Hello, world!');
    await expect(textarea).toHaveValue('Hello, world!');
  });

  test('send button is disabled when textarea is empty', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type a message');

    // Ensure textarea is empty
    await expect(textarea).toHaveValue('');

    // The send button is the sibling button next to the textarea
    const sendButton = textarea
      .locator('..')
      .locator('button');
    await expect(sendButton).toBeDisabled();
  });

  test('send button is enabled after typing text', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type a message');
    await textarea.fill('Test message');

    const sendButton = textarea
      .locator('..')
      .locator('button');
    await expect(sendButton).toBeEnabled();
  });

  test('empty-state message is shown when no messages exist', async ({
    page,
  }) => {
    const placeholder = page.getByText('Upload a PDF to get started');
    await expect(placeholder).toBeVisible();
  });
});
