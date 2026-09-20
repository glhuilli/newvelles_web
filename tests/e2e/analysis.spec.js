import { test, expect } from '@playwright/test';

test.describe('Analysis tab', () => {
  test('is reachable from the header and shows the first entry with panels', async ({ page }) => {
    // Vite dev serves the classic UI at /; the redesign is its own entry.
    await page.goto('/redesign.html');
    const tab = page.locator('.nv-tabs [data-go-analysis]');
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.an-entry-head h2')).toBeVisible();
    await expect(page.locator('#strip svg')).toBeVisible();
    await page.locator('.an-strip [data-panel="topstories"]').click();
    await expect(page.locator('#ts-table table.ledger')).toBeVisible();
    await expect(page.locator('#ts-table tbody svg').first()).toBeVisible();
    await page.locator('.nv-tabs [data-go-board]').click();
    await expect(page.locator('.nv-lead')).toBeVisible();
  });
});
