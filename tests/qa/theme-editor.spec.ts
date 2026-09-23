import { expect, test } from '@playwright/test';

import {
  collectBrowserErrors,
  DASHBOARD_URL,
  expectNoBrokenImages,
  getPreviewFrame,
  openThemeEditor,
  switchThemeEditorPage,
  waitForPreviewPath,
} from './helpers';

const NON_HOME_PAGE_CASES = [
  {
    pageId: 'products',
    sectionType: 'products-page',
    controls: [
      'theme-editor-setting-show-view-toggle-switch',
      'theme-editor-setting-show-category-subtitle-switch',
      'theme-editor-setting-columns-desktop-slider',
      'theme-editor-setting-columns-mobile-slider',
    ],
  },
  {
    pageId: 'checkout',
    sectionType: 'checkout',
    controls: [
      'theme-editor-setting-show-steps-switch',
      'theme-editor-setting-show-security-badge-switch',
      'theme-editor-setting-show-free-shipping-hint-switch',
      'theme-editor-setting-show-landmark-switch',
      'theme-editor-setting-show-page-title-switch',
    ],
  },
  {
    pageId: 'product-detail',
    sectionType: 'product-detail',
    controls: [
      'theme-editor-setting-show-rating-switch',
      'theme-editor-setting-show-stock-switch',
      'theme-editor-setting-show-whatsapp-switch',
      'theme-editor-setting-show-guarantees-switch',
      'theme-editor-setting-show-share-buttons-switch',
      'theme-editor-setting-related-products-count-slider',
    ],
  },
  {
    pageId: 'contact',
    sectionType: 'contact',
    controls: [
      'theme-editor-setting-show-working-hours-switch',
      'theme-editor-setting-show-map-switch',
    ],
  },
  {
    pageId: 'order-confirmation',
    sectionType: 'order-confirmation',
    controls: [
      'theme-editor-setting-show-progress-switch',
      'theme-editor-setting-show-whatsapp-switch',
      'theme-editor-setting-show-track-order-switch',
      'theme-editor-setting-show-emoji-switch',
    ],
  },
  {
    pageId: 'profile',
    sectionType: 'profile',
    controls: [
      'theme-editor-setting-show-stats-switch',
      'theme-editor-setting-show-order-tracking-switch',
    ],
  },
] as const;

test.describe('Theme Editor - Multi Page QA', () => {
  test('editor exposes page selector, home controls, and non-home section settings', async ({
    page,
  }) => {
    test.slow();

    const browser = collectBrowserErrors(page);
    const access = await openThemeEditor(page);
    if (access.skipReason) test.skip(true, access.skipReason);

    await expect(page.getByTestId('theme-editor-topbar')).toBeVisible();
    await expect(page.getByTestId('theme-editor-left-panel')).toBeVisible();
    await expect(page.getByTestId('theme-editor-preview-panel')).toBeVisible();
    await expect(page.getByTestId('theme-editor-settings-panel')).toBeVisible();

    await expect(page.getByTestId('theme-editor-global-identity')).toBeVisible();
    await expect(page.getByTestId('theme-editor-global-header')).toBeVisible();
    await expect(page.getByTestId('theme-editor-global-footer')).toBeVisible();
    await expect(page.getByTestId('theme-editor-page-selector')).toBeVisible();

    await page.getByTestId('theme-editor-page-selector').click();
    await expect(page.locator('[data-testid^="theme-editor-page-option-"]')).toHaveCount(7);
    await page.keyboard.press('Escape');

    await expect.poll(async () =>
      page.getByTestId('theme-editor-section-item').count(),
    ).toBeGreaterThan(1);
    await expect(page.getByTestId('theme-editor-add-section')).toBeVisible();
    await expect(page.locator('[data-testid="theme-editor-section-move-down"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="theme-editor-section-toggle"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="theme-editor-section-delete"]').first()).toBeVisible();

    await page.locator('[data-testid^="theme-editor-section-select-"]').first().click();
    await expect(page.getByTestId('theme-editor-section-settings')).toBeVisible();

    for (const pageCase of NON_HOME_PAGE_CASES) {
      await switchThemeEditorPage(page, pageCase.pageId);

      const sectionItems = page.getByTestId('theme-editor-section-item');
      await expect(sectionItems).toHaveCount(1);
      await expect(sectionItems.first()).toHaveAttribute(
        'data-section-type',
        pageCase.sectionType,
      );

      await expect(page.getByTestId('theme-editor-add-section')).toHaveCount(0);
      await expect(page.locator('[data-testid="theme-editor-section-move-up"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="theme-editor-section-move-down"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="theme-editor-section-delete"]')).toHaveCount(0);

      await page.locator('[data-testid^="theme-editor-section-select-"]').first().click();
      await expect(page.getByTestId('theme-editor-section-settings')).toBeVisible();

      for (const controlId of pageCase.controls) {
        await expect(page.getByTestId(controlId)).toBeVisible();
      }
    }

    browser.expectNone('theme editor multi-page controls');
  });

  test('page switching updates the preview iframe without replacing its document and dirty state works on non-home pages', async ({
    page,
  }) => {
    test.slow();

    const browser = collectBrowserErrors(page);
    const access = await openThemeEditor(page);
    if (access.skipReason) test.skip(true, access.skipReason);

    const previewShell = page.getByTestId('theme-editor-preview-shell');
    const iframe = page.getByTestId('theme-editor-preview-iframe');

    await waitForPreviewPath(page, '/');

    const initialSrc = await iframe.getAttribute('src');
    const initialFrame = await getPreviewFrame(page);
    const marker = await initialFrame.evaluate(() => {
      const win = window as Window & { __numuQaMarker?: string };
      win.__numuQaMarker ??= Math.random().toString(36).slice(2);
      return win.__numuQaMarker;
    });

    const desktopWidth = (await previewShell.boundingBox())?.width ?? 0;
    expect(desktopWidth).toBeGreaterThan(700);

    await switchThemeEditorPage(page, 'products');
    await waitForPreviewPath(page, '/products');
    await expect((await getPreviewFrame(page)).getByTestId('storefront-products-page')).toBeVisible();

    const productsMarker = await (await getPreviewFrame(page)).evaluate(
      () => (window as Window & { __numuQaMarker?: string }).__numuQaMarker ?? null,
    );
    expect(productsMarker).toBe(marker);
    await expect(iframe).toHaveAttribute('src', initialSrc ?? '');

    await switchThemeEditorPage(page, 'contact');
    await waitForPreviewPath(page, '/contact');
    await expect((await getPreviewFrame(page)).getByTestId('storefront-contact-page')).toBeVisible();
    await expect(iframe).toHaveAttribute('src', initialSrc ?? '');

    await page.getByTestId('theme-editor-device-mobile').click();
    await page.waitForTimeout(300);

    const mobileWidth = (await previewShell.boundingBox())?.width ?? 0;
    expect(mobileWidth).toBeGreaterThan(300);
    expect(mobileWidth).toBeLessThan(desktopWidth);

    await page.getByTestId('theme-editor-device-desktop').click();
    await page.waitForTimeout(300);

    const restoredWidth = (await previewShell.boundingBox())?.width ?? 0;
    expect(restoredWidth).toBeGreaterThan(mobileWidth);

    await switchThemeEditorPage(page, 'products');
    await page.locator('[data-testid^="theme-editor-section-select-"]').first().click();

    const saveButton = page.getByTestId('theme-editor-save');
    await expect(saveButton).toBeDisabled();
    await page.getByTestId('theme-editor-setting-show-view-toggle-switch').click();
    await expect(page.getByTestId('theme-editor-unsaved-badge')).toBeVisible();
    await expect(saveButton).toBeEnabled();

    await switchThemeEditorPage(page, 'home');
    await waitForPreviewPath(page, '/');
    await expect(page.getByTestId('theme-editor-add-section')).toBeVisible();
    await expect.poll(async () =>
      page.getByTestId('theme-editor-section-item').count(),
    ).toBeGreaterThan(1);

    browser.expectNone('theme editor iframe navigation and dirty state');
  });

  test('rabbitsocks preview loads through the editor without broken storefront rendering', async ({
    page,
  }) => {
    test.slow();

    const browser = collectBrowserErrors(page);
    const access = await openThemeEditor(page);
    if (access.skipReason) test.skip(true, access.skipReason);

    await page.goto(`${DASHBOARD_URL}/online-store/themes/editor?theme=rabbitsocks`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId('theme-editor')).toBeVisible({ timeout: 20_000 });
    await waitForPreviewPath(page, '/');

    const previewFrame = await getPreviewFrame(page);

    await expect
      .poll(() =>
        previewFrame.evaluate(() => document.documentElement.getAttribute('data-theme')),
      )
      .toBe('rabbitsocks');

    await expect(
      previewFrame
        .locator('.rs-headline, .rs-headline-lg, .material-symbols-outlined')
        .first(),
    ).toBeVisible();
    await expect(previewFrame.getByTestId('storefront-footer')).toBeVisible();
    await expect.poll(async () =>
      previewFrame.getByTestId('storefront-product-card').count(),
    ).toBeGreaterThan(0);
    await expectNoBrokenImages(previewFrame, 'rabbitsocks editor preview');

    browser.expectNone('rabbitsocks editor preview');
  });
});
