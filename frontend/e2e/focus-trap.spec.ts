import { test, expect } from '@playwright/test';

/**
 * Regression coverage for the shared `useFocusTrap` hardening.
 *
 * The original trap relied on the browser's default Tab order and only intervened at
 * the boundaries, so a Tab dispatched while the overlay was still opening could land on
 * a control behind it. These tests use the real `Dialog` (via the recall session modal)
 * in Chromium, because jsdom cannot exercise layout-based focusability.
 */
test.describe('Shared focus trap', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Focus Tester ${timestamp}`,
    email: `focus-${timestamp}@example.com`,
    password: 'password12345!',
  };

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  test.beforeEach(async ({ page }) => {
    // 1. Register a fresh user
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
    await page
      .getByPlaceholder(/Key invariants, time\/space/i)
      .fill('Recursively invert left and right children.');
    await page.getByRole('button', { name: /save problem/i }).click();
    await expect(page.getByText('Invert Binary Tree')).toBeVisible();
  });

  test('traps Tab during the opening transition, cycles, and restores focus on Escape', async ({
    page,
  }) => {
    await page.goto('/review');
    await expect(page.getByRole('heading', { name: 'Due Revisions' })).toBeVisible();

    const trigger = page.getByRole('button', { name: /start revision/i }).first();
    await expect(trigger).toBeVisible();
    await trigger.focus();

    // Open and press Tab immediately — before the panel's enter animation has finished.
    await trigger.click();
    await page.keyboard.press('Tab');

    const insideDialog = () =>
      page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const active = document.activeElement;
        return Boolean(dialog && active && dialog.contains(active));
      });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(insideDialog).toBe(true);

    // Body scroll is locked while the dialog owns focus.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const activeLabel = () =>
      page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return '';
        const control = active as HTMLInputElement;
        const label =
          active.getAttribute('aria-label') ||
          control.labels?.[0]?.textContent ||
          control.name ||
          active.id ||
          active.textContent ||
          active.tagName;
        return label.trim().replace(/\s+/g, ' ').slice(0, 60);
      });

    const focusableCount = await page.evaluate((selector) => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return 0;
      return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.getClientRects().length > 0
      ).length;
    }, FOCUSABLE_SELECTOR);

    expect(focusableCount).toBeGreaterThan(2);

    const firstLabel = await activeLabel();
    expect(firstLabel.length).toBeGreaterThan(0);

    // Forward cycling wraps from the last element back to the first.
    for (let i = 0; i < focusableCount; i += 1) {
      await page.keyboard.press('Tab');
      expect(await insideDialog()).toBe(true);
    }
    expect(await activeLabel()).toBe(firstLabel);

    // Reverse cycling wraps from the first element to the last.
    await page.keyboard.press('Shift+Tab');
    expect(await insideDialog()).toBe(true);
    const lastLabel = await activeLabel();
    expect(lastLabel).not.toBe(firstLabel);

    await page.keyboard.press('Tab');
    expect(await activeLabel()).toBe(firstLabel);

    // A control behind the overlay must not be able to take focus.
    const foundBackgroundControl = await page.evaluate(() => {
      const behind = document.querySelector<HTMLElement>(
        'aside a[href], header a[href], nav a[href], main a[href]'
      );
      if (!behind) return false;
      behind.focus();
      return true;
    });
    expect(foundBackgroundControl).toBe(true);
    await expect.poll(insideDialog).toBe(true);

    // Escape closes and focus returns to the trigger, with scroll released.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});
