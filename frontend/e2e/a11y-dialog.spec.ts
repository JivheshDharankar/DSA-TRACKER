import { test, expect } from '@playwright/test';

/**
 * Modal-dialog accessibility gate (tests only).
 * =============================================
 * Focus containment, Escape, focus restoration and scroll locking are already covered by
 * `focus-trap.spec.ts` and `tests/unit/useFocusTrap.test.tsx`; they are not duplicated
 * here. This file adds the two checks that only a real browser can make:
 *
 *   1. the dialog's accessible name/description and its presence in the accessibility
 *      tree (the jsdom suite asserts the same attributes, but not the computed tree);
 *   2. whether the **background application chrome is isolated from assistive
 *      technology** while the dialog is open — the known open defect.
 *
 * Test 2 is declared `test.fail()` because the application does not implement
 * background isolation yet (no `inert`, no `aria-hidden` on the shell). The behaviour
 * it asserts is the requirement, not the current behaviour, so the assertion is not
 * inverted to fit today's implementation. Playwright treats an expected failure as a
 * non-failing outcome (exit code 0, reported with a ✘ and the `known-defect`
 * annotation), which keeps CI informative rather than red. Once isolation is
 * implemented the assertions pass, Playwright reports *"passed unexpectedly"* and the
 * suite turns red — the signal to remove `test.fail()` and keep the assertions as a
 * permanent guarantee.
 */

test.describe('Modal dialog accessibility gate', () => {
  test.beforeEach(async ({ page }) => {
    // Unique per test: both tests register, and a reused address would be rejected.
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const testUser = {
      name: `A11y Tester ${unique}`,
      email: `a11y-${unique}@example.com`,
      password: 'password12345!',
    };

    // 1. Register a fresh user
    await page.goto('/register');
    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator('#password').fill(testUser.password);
    await page.locator('#confirmPassword').fill(testUser.password);
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Seed one due problem so the recall dialog can be opened
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

  test('exposes the open dialog with an accessible name, description and modal semantics', async ({
    page,
  }) => {
    await page.goto('/review');
    await page.getByRole('button', { name: /start revision/i }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Invert Binary Tree' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleDescription(/PERSONAL DSA #1/i);

    const snapshot = await page.locator('body').ariaSnapshot();
    expect(snapshot).toContain('dialog "Invert Binary Tree"');
  });

  test.fail(
    'keeps background application chrome out of the accessibility tree while the dialog is open',
    async ({ page }) => {
      test.info().annotations.push({
        type: 'known-defect',
        description:
          'Background chrome (sidebar/header/main) stays in the accessibility tree while a modal ' +
          'dialog is open; no inert or aria-hidden isolation is applied to the app shell yet.',
      });

      await page.goto('/review');
      await page.getByRole('button', { name: /start revision/i }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Invert Binary Tree' });
      await expect(dialog).toBeVisible();

      const snapshot = await page.locator('body').ariaSnapshot();

      // The dialog itself must stay reachable — isolation must never hide the overlay.
      expect(snapshot, 'the open dialog must remain in the accessibility tree').toContain(
        'dialog "Invert Binary Tree"'
      );

      // Background navigation must NOT be reachable by an assistive-technology cursor.
      expect(
        snapshot,
        'background chrome is still exposed to assistive technology: while a modal dialog is open, ' +
          'the application shell behind it must be removed from the accessibility tree (native inert ' +
          'on the shell, or an aria-hidden subtree that excludes the portal)'
      ).not.toContain('link "Patterns"');

      // Mechanism check: isolation must actually be applied to a background root.
      const backgroundIsIsolated = await page.evaluate(() => {
        const isIsolated = (element: Element | null) => {
          if (!element) return false;
          const inertElement = element as Element & { inert?: boolean };
          return (
            Boolean(inertElement.inert) ||
            element.closest('[inert]') !== null ||
            element.closest('[aria-hidden="true"]') !== null
          );
        };

        // Any of these carrying inert / aria-hidden satisfies the requirement; the
        // shell may be isolated directly or through an ancestor such as `#root`.
        return [
          document.getElementById('root'),
          document.querySelector('#root > div'),
          document.querySelector('aside'),
          document.querySelector('main'),
        ].some(isIsolated);
      });

      expect(
        backgroundIsIsolated,
        'no background root is isolated: expected inert/aria-hidden on the app shell, sidebar or main region'
      ).toBe(true);
    }
  );
});
