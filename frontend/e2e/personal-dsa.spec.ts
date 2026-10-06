import { test, expect } from '@playwright/test';

test.describe('Flow 3 — Personal DSA Workflow & LeetCode Integration', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Personal Tester ${timestamp}`,
    email: `personal-${timestamp}@example.com`,
    password: 'password12345!',
  };

  test.beforeEach(async ({ page }) => {
    // Register unique test user for test isolation
    await page.goto('/register');
    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator('#password').fill(testUser.password);
    await page.locator('#confirmPassword').fill(testUser.password);
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('creates a Personal DSA problem with LeetCode number, switches views, and filters by difficulty', async ({ page }) => {
    // 1. Navigate to Personal DSA
    await page.goto('/personal-dsa');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Personal DSA Tracker');

    // 2. Open Add Problem Modal
    await page.getByRole('button', { name: /add problem/i }).first().click();
    await expect(page.getByText('Add Personal DSA Problem')).toBeVisible();

    // 3. Fill and submit problem form with LeetCode metadata
    await page.getByPlaceholder(/e\.g\. Longest Substring/i).fill('Trapping Rain Water');
    await page.getByPlaceholder(/e\.g\. Arrays, Strings, Trees, DP/i).fill('Two Pointers');
    await page.getByPlaceholder(/https:\/\/leetcode\.com\/problems/i).fill('https://leetcode.com/problems/trapping-rain-water');
    await page.getByPlaceholder(/e\.g\. 3/i).fill('42');

    // Select Hard difficulty in the modal form
    await page.locator('form select').filter({ hasText: 'Hard' }).selectOption('Hard');

    await page.getByRole('button', { name: /save problem/i }).click();

    // 4. Verify problem appears with S.No and LeetCode details
    await expect(page.getByText('Trapping Rain Water')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('#42')).toBeVisible();
    await expect(page.locator('table').getByText('Hard')).toBeVisible();

    // 5. Switch view mode: Table -> Cards
    await page.getByTitle('Card view').click();
    await expect(page.getByText('Trapping Rain Water')).toBeVisible();
    await expect(page.getByText('LC #42')).toBeVisible();
    await expect(page.locator('table')).not.toBeVisible();

    // Switch view mode: Cards -> Table
    await page.getByTitle('Table view').click();
    await expect(page.locator('table')).toBeVisible();

    // 6. Filter by difficulty
    const diffSelect = page.locator('select').filter({ hasText: 'All Difficulties' });
    await diffSelect.selectOption('Hard');
    await expect(page.getByText('Trapping Rain Water')).toBeVisible();

    // Filter by Easy -> should find nothing
    await diffSelect.selectOption('Easy');
    await expect(page.getByText('No matching problems found')).toBeVisible();

    // Clear filters
    await page.getByRole('button', { name: 'Clear All Filters' }).click();
    await expect(page.getByText('Trapping Rain Water')).toBeVisible();
  });
});
