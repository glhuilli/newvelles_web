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

test.describe('deep links', () => {
  test('#analysis/five-years/categories opens that entry and panel directly', async ({ page }) => {
    await page.goto('/redesign.html#analysis/five-years/categories');
    await expect(page.locator('.nv-tabs [data-go-analysis]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#cat-table table.ledger')).toBeVisible();
    await expect(page.locator('.an-strip [data-panel="categories"]')).toHaveClass(/nv-pill--active/);
  });

  test('the URL follows navigation and Back returns to the previous view', async ({ page }) => {
    await page.goto('/redesign.html');
    await page.locator('.nv-tabs [data-go-analysis]').click();
    await expect(page).toHaveURL(/#analysis$/);
    await page.locator('.an-strip [data-panel="archetypes"]').click();
    await expect(page).toHaveURL(/#analysis\/archetypes$/);
    await page.goBack();
    await expect(page.locator('.nv-lead')).toBeVisible();
  });
});
