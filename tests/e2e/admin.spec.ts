import { test, expect } from '@playwright/test';

test.describe('Admin Backoffice', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|\/$/);
  });
});
