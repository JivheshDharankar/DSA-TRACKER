import { test, expect } from '@playwright/test';

test.describe('Flow 4 — Spaced Repetition Recall & Review Workflow', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Recall Tester ${timestamp}`,
    email: `recall-${timestamp}@example.com`,
    password: 'password12345!',
  };

  test.beforeEach(async ({ page }) => {
    // 1. Register new user
    await page.goto('/register');
    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator('#password').fill(testUser.password);
    await page.locator('#confirmPassword').fill(testUser.password);
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Create a problem so the due queue has an item
    await page.goto('/personal-dsa');
    await page.getByRole('button', { name: /add problem/i }).first().click();
    await page.getByPlaceholder(/e\.g\. Longest Substring/i).fill('Invert Binary Tree');
    await page.getByPlaceholder(/e\.g\. Arrays, Strings, Trees, DP/i).fill('Trees');
    await page.getByPlaceholder(/Key invariants, time\/space/i).fill('Recursively invert left and right children.');
    await page.getByRole('button', { name: /save problem/i }).click();
    await expect(page.getByText('Invert Binary Tree')).toBeVisible();
  });

  test('navigates to review queue, starts session, reveals notes, submits recall score, and verifies progression', async ({ page }) => {
    // 1. Navigate to Review Page
    await page.goto('/review');
    await expect(page.getByRole('heading', { name: 'Due Revisions' })).toBeVisible();

    // 2. Problem should appear in due queue
    await expect(page.getByText('Invert Binary Tree')).toBeVisible();

    // 3. Start revision session
    await page.getByRole('button', { name: /start revision/i }).first().click();

    // 4. Verify RecallSessionModal opens in ATTEMPT step
    await expect(page.getByText("I've Finished My Attempt")).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /cold solve attempt/i })).toBeChecked();

    // 5. Finish Attempt -> Advances to EVALUATE step
    await page.getByText("I've Finished My Attempt").click();
    await expect(page.getByText('Evaluate your recall quality:')).toBeVisible();

    // 6. Reveal solution notes
    await page.getByRole('button', { name: /reveal solution notes/i }).click();
    await expect(page.getByText('Recursively invert left and right children.')).toBeVisible();

    // 7. Submit recall score: EASY
    await page.getByRole('button', { name: /EASY/i }).click();

    // 8. Verify RESULT step displays progression and updated schedule
    await expect(page.getByText('Revision Recorded!')).toBeVisible();
    await expect(page.getByText(/Stage Progression/i)).toBeVisible();
    await expect(page.getByText(/Next Review Date/i)).toBeVisible();

    // 9. Close modal and return to due queue
    await page.getByRole('button', { name: /back to due queue/i }).click();
    await expect(page.getByText('Revision Recorded!')).not.toBeVisible();
  });
});
