import { test, expect } from '@playwright/test';

test.describe('Flow 1 — Authentication & Protected Route Enforcement', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Auth Test User ${timestamp}`,
    email: `authtest-${timestamp}@example.com`,
    password: 'password12345!',
  };

  test('registers new user, accesses protected dashboard, logs out, and logs back in', async ({ page }) => {
    // 1. Visit register page
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Create Account');

    // 2. Fill registration form
    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator('#password').fill(testUser.password);
    await page.locator('#confirmPassword').fill(testUser.password);

    // 3. Submit registration
    await page.getByRole('button', { name: /get started/i }).click();

    // 4. Verify redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: new RegExp(testUser.name) })).toBeVisible();

    // 5. Log out
    await page.getByRole('button', { name: /sign out/i }).first().click();

    // 6. Verify redirected to login
    await expect(page).toHaveURL(/.*login/);

    // 7. Attempt accessing protected page directly while logged out
    await page.goto('/college-dsa');
    await expect(page).toHaveURL(/.*login/);

    // 8. Log in with created credentials
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator('#password').fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // 9. Verify successfully access protected page
    await expect(page).toHaveURL(/.*college-dsa/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('College DSA Tracker');
  });
});
