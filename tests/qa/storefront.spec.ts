import { expect, test, type Page } from '@playwright/test';

import {
  collectBrowserErrors,
  expectNoBrokenImages,
  gotoStorefrontPage,
} from './helpers';

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

test.describe('Storefront - Pages Load', () => {
  const pages = [
    { path: '/', name: 'Home', allowedPaths: ['/'] },
    { path: '/products', name: 'Products', allowedPaths: ['/products'] },
    { path: '/contact', name: 'Contact', allowedPaths: ['/contact'] },
    { path: '/shipping', name: 'Shipping', allowedPaths: ['/shipping'] },
    { path: '/returns', name: 'Returns', allowedPaths: ['/returns'] },
    { path: '/auth', name: 'Auth', allowedPaths: ['/auth'] },
    { path: '/profile', name: 'Profile', allowedPaths: ['/profile', '/auth'] },
    {
      path: '/checkout',
      name: 'Checkout',
      allowedPaths: ['/checkout', '/auth'],
    },
  ];

  for (const pageConfig of pages) {
    test(`${pageConfig.name} page loads without runtime errors`, async ({ page }) => {
      const browser = collectBrowserErrors(page);

      await gotoStorefrontPage(page, pageConfig.path);

      await expect
        .poll(async () => pageConfig.allowedPaths.includes(await currentPath(page)))
        .toBeTruthy();

      browser.expectNone(`${pageConfig.name} page`);
    });
  }
});

test.describe('Storefront - Functional Coverage', () => {
  test('home page renders storefront content and rabbitsocks theme can load when switching is available', async ({
    page,
  }) => {
    const browser = collectBrowserErrors(page);

    await page.addInitScript(() => {
      localStorage.setItem('numu-theme', 'rabbitsocks');
    });

    await gotoStorefrontPage(page, '/');

    await expect(page.locator('[data-testid="storefront-main"] h1, [data-testid="storefront-main"] h2').first()).toBeVisible();
    await expect(page.getByTestId('storefront-product-card').first()).toBeVisible();
    await expectNoBrokenImages(page, 'storefront home page');

    let activeTheme = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme'),
    );

    if (activeTheme !== 'rabbitsocks') {
      const switcherVisible = await page
        .getByTestId('storefront-theme-switcher-trigger')
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      if (switcherVisible) {
        await page.getByTestId('storefront-theme-switcher-trigger').click();
        await page.getByTestId('storefront-theme-option-rabbitsocks').click();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.getAttribute('data-theme')),
          )
          .toBe('rabbitsocks');
        activeTheme = 'rabbitsocks';
      }
    }

    if (activeTheme !== 'rabbitsocks') {
      test.skip(
        true,
        'Theme switching is locked by merchant theme settings in this storefront instance.',
      );
    }

    await expect(
      page.locator('.rs-headline, .rs-headline-lg, .material-symbols-outlined').first(),
    ).toBeVisible();
    await expectNoBrokenImages(page, 'rabbitsocks home page');

    browser.expectNone('home page and rabbitsocks theme');
  });

  test('products page supports category filters, search, sort, and product detail navigation', async ({
    page,
  }) => {
    const browser = collectBrowserErrors(page);

    await gotoStorefrontPage(page, '/products');

    const grid = page.getByTestId('storefront-products-grid');
    const productCards = page.getByTestId('storefront-product-card');

    await expect(grid).toBeVisible();
    await expect.poll(async () => productCards.count()).toBeGreaterThan(2);

    const categoryButtons = page.getByTestId('storefront-products-category');
    await expect.poll(async () => categoryButtons.count()).toBeGreaterThan(1);

    const initialCardCount = await productCards.count();
    const nonAllCategory = page.locator(
      '[data-testid="storefront-products-category"]:not([data-category-id="all"])',
    );
    await expect(nonAllCategory.first()).toBeVisible();
    await nonAllCategory.first().click();
    await page.waitForTimeout(300);

    const filteredCount = await productCards.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCardCount);

    await page.locator('[data-testid="storefront-products-category"][data-category-id="all"]').click();
    await page.waitForTimeout(300);

    const getProductHrefs = (cards: Element[]) =>
      cards
        .map((card) => {
          // The card itself might be the <a> tag, or it might contain one
          const el = card.tagName === 'A' ? card : card.querySelector('a[href*="/product/"]');
          return el?.getAttribute('href') ?? '';
        })
        .filter(Boolean)
        .slice(0, 4);

    const defaultOrder = await productCards.evaluateAll(getProductHrefs);

    await page.getByTestId('storefront-products-sort').selectOption('price-desc');
    await page.waitForTimeout(400);

    const sortedOrder = await productCards.evaluateAll(getProductHrefs);

    expect(sortedOrder.length).toBeGreaterThan(0);
    expect(sortedOrder).not.toEqual(defaultOrder);

    const firstProductTitle = await productCards
      .first()
      .locator('h3')
      .first()
      .innerText()
      .catch(async () => productCards.first().innerText());
    const searchQuery = firstProductTitle
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');

    expect(searchQuery).toBeTruthy();

    await page.getByTestId('storefront-products-search').fill(searchQuery ?? '');
    await page.waitForTimeout(300);

    const searchedCount = await productCards.count();
    expect(searchedCount).toBeGreaterThan(0);
    await expect(productCards.first()).toContainText(searchQuery ?? '');

    await expectNoBrokenImages(page, 'products page');

    await page
      .locator('[data-testid="storefront-products-grid"] a[href*="/product/"]')
      .first()
      .click();

    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByTestId('storefront-product-detail')).toBeVisible();
    await expect(page.getByTestId('storefront-breadcrumb')).toBeVisible();
    await expect(page.getByTestId('storefront-product-detail-main-image')).toBeVisible();
    await expect(page.getByTestId('storefront-product-detail-name')).toBeVisible();
    await expect(page.getByTestId('storefront-product-detail-description')).toBeVisible();
    await expect(page.getByText(/ج\.?\s*م/).first()).toBeVisible();

    const sizeOptions = page.getByTestId('storefront-product-detail-size-option');
    const colorOptions = page.getByTestId('storefront-product-detail-color-option');

    if ((await sizeOptions.count()) > 0) {
      await sizeOptions.first().click();
    }

    if ((await colorOptions.count()) > 0) {
      await colorOptions.first().click();
    }

    await page.getByTestId('storefront-add-to-cart').click();

    // Cart may not auto-open — click cart trigger if needed
    const cartDrawer = page.getByTestId('storefront-cart-drawer');
    if (!(await cartDrawer.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByTestId('storefront-cart-trigger').click();
    }
    await expect(cartDrawer).toBeVisible();

    // Verify cart has content (items, subtotal, checkout button)
    await expect(cartDrawer.locator('[data-testid="storefront-cart-checkout"], a[href*="checkout"]').first()).toBeVisible();
    await expect(page.getByTestId('storefront-cart-count')).toHaveText(/[1-9]/);

    await expect(page.getByTestId('storefront-related-products')).toBeVisible();
    await expect.poll(async () =>
      page.getByTestId('storefront-related-products-grid').getByTestId('storefront-product-card').count(),
    ).toBeGreaterThan(0);
    await expectNoBrokenImages(page, 'product detail page');

    browser.expectNone('products and product detail flow');
  });

  test('contact page renders methods and submits the form successfully', async ({
    page,
  }) => {
    const browser = collectBrowserErrors(page);

    await gotoStorefrontPage(page, '/contact');

    const form = page.getByTestId('storefront-contact-form');
    await expect(page.getByTestId('storefront-contact-page')).toBeVisible();
    await expect(
      page.locator('[data-testid="storefront-contact-page"] h1, [data-testid="storefront-contact-page"] h2').first(),
    ).toBeVisible();
    await expect(form).toBeVisible();
    await expect(form.locator('input').first()).toBeVisible();
    await expect(form.locator('input[type="tel"]')).toBeVisible();
    await expect(form.locator('textarea')).toBeVisible();
    await expect.poll(async () =>
      page.getByTestId('storefront-contact-method').count(),
    ).toBeGreaterThan(0);

    await form.locator('input').first().fill('QA Tester');
    await form.locator('input[type="tel"]').fill('01012345678');
    await form.locator('textarea').fill('Automated QA submission for NUMU storefront contact flow.');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByTestId('storefront-contact-success')).toBeVisible();

    browser.expectNone('contact page flow');
  });

  test('cart drawer can route to checkout after adding an item', async ({ page }) => {
    const browser = collectBrowserErrors(page);

    await gotoStorefrontPage(page, '/products');

    await page
      .locator('[data-testid="storefront-products-grid"] a[href*="/product/"]')
      .first()
      .click();

    await expect(page).toHaveURL(/\/product\//);
    await page.getByTestId('storefront-add-to-cart').click();

    // Cart doesn't auto-open on add — click the cart icon in header to open it
    const cartDrawer = page.getByTestId('storefront-cart-drawer');
    if (!(await cartDrawer.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByTestId('storefront-cart-trigger').click();
    }
    await expect(cartDrawer).toBeVisible();
    await page.getByTestId('storefront-cart-checkout').click();

    await expect
      .poll(async () => {
        const pathname = await currentPath(page);
        return pathname === '/checkout' || pathname === '/auth';
      })
      .toBeTruthy();

    browser.expectNone('cart to checkout flow');
  });
});
