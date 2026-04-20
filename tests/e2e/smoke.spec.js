import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - New UI', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page title is set
    await expect(page).toHaveTitle(/newvelles/);

    // Wait for app to load
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('displays masthead with title', async ({ page }) => {
    await page.goto('/');

    // Wait for masthead
    const masthead = page.locator('.masthead');
    await expect(masthead).toBeVisible();

    // Check title
    const title = masthead.locator('.masthead-title');
    await expect(title).toContainText('newvelles');
  });

  test('displays metadata in masthead', async ({ page }) => {
    await page.goto('/');

    // Wait for metadata to load
    const metadata = page.locator('.masthead-metadata');
    await expect(metadata).toBeVisible();

    // Should contain "newvelles.com" and "News fetched at"
    await expect(metadata).toContainText('newvelles.com');
    await expect(metadata).toContainText('News fetched at');
  });

  test('displays search bar', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /Search/i);
  });

  test('displays grouping cards on home view', async ({ page }) => {
    await page.goto('/');

    // Wait for grouping cards to render
    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Should have multiple grouping cards
    const cards = page.locator('.grouping-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('grouping cards have tags and article count', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    const firstCard = page.locator('.grouping-card').first();

    // Should have tags
    const tags = firstCard.locator('.tag');
    const tagCount = await tags.count();
    expect(tagCount).toBeGreaterThan(0);

    // Should have article count
    const articleCount = firstCard.locator('.article-count');
    await expect(articleCount).toBeVisible();
    await expect(articleCount).toContainText(/article/);
  });

  test('clicking grouping card navigates to sub-groupings', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Click first grouping card
    await page.locator('.grouping-card').first().click();

    // Should show breadcrumb
    const breadcrumb = page.locator('.breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('Home');

    // Should show sub-grouping cards (they also use grouping-card class)
    await page.waitForSelector('[data-sub-grouping-id]', { timeout: 5000 });
  });

  test('search filters groupings in real time', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    const searchInput = page.locator('#search-input');
    const initialCount = await page.locator('.grouping-card').count();

    // Type in search
    await searchInput.fill('technology');
    await page.waitForTimeout(200); // Wait for debounce

    // Should have fewer cards
    const filteredCount = await page.locator('.grouping-card').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Search stats should update
    const stats = page.locator('.search-stats');
    await expect(stats).toContainText(/Showing \d+ groupings?/);
  });

  test('search clear button works', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    const searchInput = page.locator('#search-input');

    // Type in search
    await searchInput.fill('test query');
    await page.waitForTimeout(200);

    // Clear button should appear
    const clearButton = page.locator('#search-clear');
    await expect(clearButton).toBeVisible();

    // Click clear
    await clearButton.click();

    // Input should be empty
    await expect(searchInput).toHaveValue('');
  });

  test('breadcrumb navigation works', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Click first grouping card
    await page.locator('.grouping-card').first().click();

    // Wait for breadcrumb
    const breadcrumb = page.locator('.breadcrumb');
    await expect(breadcrumb).toBeVisible();

    // Click Home in breadcrumb
    const homeLink = breadcrumb.locator('[data-nav="home"]');
    await homeLink.click();

    // Should be back at home view with all grouping cards
    await page.waitForSelector('[data-grouping-id]', { timeout: 5000 });
  });

  test('footer displays attribution', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('.footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('2026');
    await expect(footer).toContainText('@glhuilli');
  });

  test('Google Analytics is loaded', async ({ page }) => {
    await page.goto('/');

    // Check that gtag is defined
    const gtagDefined = await page.evaluate(() => {
      return typeof window.gtag === 'function';
    });
    expect(gtagDefined).toBe(true);
  });

  test('drill-down navigation: home → sub-groupings → expand articles', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Click first grouping
    await page.locator('[data-grouping-id]').first().click();

    // Should be in sub-groupings view
    await page.waitForSelector('[data-sub-grouping-id]', { timeout: 5000 });

    // Click first sub-grouping to expand it
    await page.locator('[data-sub-grouping-id]').first().click();

    // Should show expanded articles
    await page.waitForSelector('.expanded-articles', { timeout: 5000 });

    // Should have article items
    const articles = page.locator('.article-item-inline');
    const articleCount = await articles.count();
    expect(articleCount).toBeGreaterThan(0);
  });

  test('expanded article items have title, source tag, and timestamp', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Navigate to sub-groupings and expand first one
    await page.locator('[data-grouping-id]').first().click();
    await page.waitForSelector('[data-sub-grouping-id]', { timeout: 5000 });
    await page.locator('[data-sub-grouping-id]').first().click();

    // Wait for expanded articles
    await page.waitForSelector('.expanded-articles', { timeout: 5000 });

    // Check first article
    const firstArticle = page.locator('.article-item-inline').first();

    // Should have title link
    const titleLink = firstArticle.locator('.article-title-link');
    await expect(titleLink).toBeVisible();

    // Should have source tag
    const sourceTag = firstArticle.locator('.tag-source');
    await expect(sourceTag).toBeVisible();

    // Should have timestamp
    const timestamp = firstArticle.locator('.article-timestamp');
    await expect(timestamp).toBeVisible();
    await expect(timestamp).toContainText(/ago|Just now/);
  });
});
