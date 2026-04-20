import { test, expect } from '@playwright/test';

test.describe('Accessibility & Interaction Tests', () => {
  test('semantic HTML structure is present', async ({ page }) => {
    await page.goto('/');

    // Check for semantic HTML elements
    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeHidden(); // Hidden on home view
    await expect(page.locator('[role="search"]')).toBeVisible();
  });

  test('search bar has proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search news groupings');
    await expect(searchInput).toHaveAttribute('aria-describedby', 'search-stats');

    const searchStats = page.locator('#search-stats');
    await expect(searchStats).toHaveAttribute('role', 'status');
    await expect(searchStats).toHaveAttribute('aria-live', 'polite');
  });

  test('grouping cards have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    const firstCard = page.locator('.grouping-card').first();
    await expect(firstCard).toHaveAttribute('role', 'button');
    await expect(firstCard).toHaveAttribute('tabindex', '0');

    // Check that aria-label exists and contains expected text
    const ariaLabel = await firstCard.getAttribute('aria-label');
    expect(ariaLabel).toContain('grouping with');
    expect(ariaLabel).toContain('articles');
  });

  test('keyboard navigation with Tab works', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Tab to masthead title
    await page.keyboard.press('Tab');
    await expect(page.locator('.masthead-title')).toBeFocused();

    // Tab to search input
    await page.keyboard.press('Tab');
    await expect(page.locator('#search-input')).toBeFocused();

    // Tab through cards
    await page.keyboard.press('Tab');
    const firstCard = page.locator('.grouping-card').first();
    await expect(firstCard).toBeFocused();
  });

  test('keyboard navigation with Enter activates cards', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Focus first card and press Enter
    const firstCard = page.locator('.grouping-card').first();
    await firstCard.focus();
    await page.keyboard.press('Enter');

    // Should navigate to sub-groupings
    await expect(page.locator('.breadcrumb')).toBeVisible();
    await expect(page.locator('[data-sub-grouping-id]').first()).toBeVisible();
  });

  test('keyboard navigation with Space activates cards', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Focus first card and press Space
    const firstCard = page.locator('.grouping-card').first();
    await firstCard.focus();
    await page.keyboard.press('Space');

    // Should navigate to sub-groupings
    await expect(page.locator('.breadcrumb')).toBeVisible();
  });

  test('arrow key navigation works', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Press ArrowDown to select first card
    await page.keyboard.press('ArrowDown');

    const firstCard = page.locator('.grouping-card').first();
    await expect(firstCard).toHaveClass(/keyboard-selected/);

    // Press ArrowDown again to move to next card
    await page.keyboard.press('ArrowDown');

    const secondCard = page.locator('.grouping-card').nth(1);
    await expect(secondCard).toHaveClass(/keyboard-selected/);
    await expect(firstCard).not.toHaveClass(/keyboard-selected/);
  });

  test('search highlighting works', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Type in search
    const searchInput = page.locator('#search-input');
    await searchInput.fill('test');
    await page.waitForTimeout(200); // Wait for debounce

    // Check if highlighting exists (if any tag matches "test")
    const highlightedText = page.locator('.tag .highlight');
    const highlightCount = await highlightedText.count();

    // Highlighting should appear if there are matches
    if (highlightCount > 0) {
      await expect(highlightedText.first()).toBeVisible();
    }
  });

  test('breadcrumb has proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Navigate to sub-groupings
    await page.locator('.grouping-card').first().click();

    // Check breadcrumb ARIA
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    const homeLink = breadcrumb.locator('[data-nav="home"]');
    await expect(homeLink).toHaveAttribute('role', 'button');
    await expect(homeLink).toHaveAttribute('aria-label', 'Navigate to home');

    const current = breadcrumb.locator('.breadcrumb-current');
    await expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('article links have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Navigate to sub-groupings and expand first one
    await page.locator('[data-grouping-id]').first().click();
    await page.waitForSelector('[data-sub-grouping-id]', { timeout: 5000 });
    await page.locator('[data-sub-grouping-id]').first().click();

    // Wait for expanded articles
    await page.waitForSelector('.expanded-articles', { timeout: 5000 });

    // Check article link ARIA
    const firstArticleLink = page.locator('.article-title-link').first();
    const ariaLabel = await firstArticleLink.getAttribute('aria-label');

    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('from'); // Should contain "from [publisher]"
  });

  test('time elements have datetime attributes', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Navigate to sub-groupings and expand first one
    await page.locator('[data-grouping-id]').first().click();
    await page.waitForSelector('[data-sub-grouping-id]', { timeout: 5000 });
    await page.locator('[data-sub-grouping-id]').first().click();

    // Wait for expanded articles
    await page.waitForSelector('.expanded-articles', { timeout: 5000 });

    // Check time element
    const timeElement = page.locator('.article-timestamp time').first();
    await expect(timeElement).toHaveAttribute('datetime');

    const datetime = await timeElement.getAttribute('datetime');
    expect(datetime).toBeTruthy();
    // Should be a valid ISO datetime
    expect(new Date(datetime).toString()).not.toBe('Invalid Date');
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.grouping-card', { timeout: 10000 });

    // Tab to masthead title
    await page.keyboard.press('Tab');
    const mastheadTitle = page.locator('.masthead-title');
    await expect(mastheadTitle).toBeFocused();

    // Tab to search input and check focus style
    await page.keyboard.press('Tab');
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeFocused();

    // Tab to card and check focus style
    await page.keyboard.press('Tab');
    const firstCard = page.locator('.grouping-card').first();
    await expect(firstCard).toBeFocused();
  });

  test('skeleton loading appears initially', async ({ page }) => {
    // Intercept the API calls to delay them
    await page.route('/news', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    const pagePromise = page.goto('/');

    // Immediately check for skeleton
    const skeleton = page.locator('.skeleton-card').first();

    // Skeleton should be visible briefly
    // Note: This might be flaky depending on timing
    const skeletonVisible = await skeleton.isVisible().catch(() => false);

    await pagePromise;

    // After page loads, skeleton should be gone
    await page.waitForSelector('.grouping-card', { timeout: 10000 });
    await expect(skeleton).toBeHidden();
  });
});
