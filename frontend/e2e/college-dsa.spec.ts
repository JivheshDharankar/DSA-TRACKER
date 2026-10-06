import { test, expect } from '@playwright/test';

test.describe('Flow 2 — College DSA Workflow & CRUD', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `College Tester ${timestamp}`,
    email: `college-${timestamp}@example.com`,
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

  test('creates, filters, edits, and deletes a College DSA problem', async ({ page }) => {
    // 1. Navigate to College DSA
    await page.goto('/college-dsa');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('College DSA Tracker');

    // 2. Open Add Problem Modal
    await page.getByRole('button', { name: /add problem/i }).first().click();
    await expect(page.getByText('Add College DSA Problem')).toBeVisible();

    // 3. Fill and submit problem form
    await page.getByPlaceholder(/e\.g\. Longest Substring/i).fill('Merge Two Sorted Lists');
    await page.getByPlaceholder(/e\.g\. Arrays, Strings, Trees, DP/i).fill('Linked Lists');
    await page.getByPlaceholder(/Key invariants, time\/space/i).fill('Maintain dummy head and advance smaller pointer.');
    await page.getByRole('button', { name: /save problem/i }).click();

    // 4. Verify problem appears in table
    await expect(page.getByText('Merge Two Sorted Lists')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();

    // 5. Search for the problem
    const searchInput = page.getByPlaceholder(/search problems by title or topic/i);
    await searchInput.fill('Merge');
    await expect(page.getByText('Merge Two Sorted Lists')).toBeVisible();

    // Search for non-existent term
    await searchInput.fill('NonExistentTermXYZ');
    await expect(page.getByText('No matching problems found')).toBeVisible();

    // Clear search
    await page.getByTitle('Clear search').click();
    await expect(page.getByText('Merge Two Sorted Lists')).toBeVisible();

    // 6. Edit the problem
    await page.getByTitle('Edit Problem').click();
    const titleInput = page.getByPlaceholder(/e\.g\. Longest Substring/i);
    await titleInput.fill('Merge Two Sorted Lists (Iterative)');
    await page.getByRole('button', { name: /update problem/i }).click();

    // Verify updated title
    await expect(page.getByText('Merge Two Sorted Lists (Iterative)')).toBeVisible();

    // 7. Delete the problem
    await page.getByTitle('Delete Problem').click();
    await expect(page.getByText('Delete Problem #1?')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /delete permanently/i }).click();

    // 8. Verify problem is removed and empty state appears
    await expect(page.getByText('No College DSA problems yet')).toBeVisible();
  });
});
