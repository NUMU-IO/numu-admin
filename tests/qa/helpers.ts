import { expect, type Frame, type Page } from '@playwright/test';

export const STOREFRONT_URL =
  process.env.NUMU_STOREFRONT_URL ?? 'http://localhost:8081';
export const DASHBOARD_URL =
  process.env.NUMU_DASHBOARD_URL ?? 'http://localhost:8080';

type BrowsingContext = Page | Frame;

const REACT_RENDER_WARNING_RE =
  /Cannot update a component while rendering a different component/i;

/** Known harmless console.error messages to ignore */
const IGNORED_CONSOLE_ERRORS: RegExp[] = [
  /React does not recognize the `%s` prop/i,       // React DOM prop casing (fetchPriority)
  /fetchPriority/i,                                  // Same — React 18 vs DOM attribute casing
  /Each child in a list should have a unique/i,      // React key warning (non-breaking)
  /Failed to load resource.*favicon/i,               // Missing favicon (cosmetic)
  /Download the React DevTools/i,                    // React dev tools suggestion
  /Function components cannot be given refs/i,       // framer-motion AnimatePresence + functional components
  /cannot be given refs.*PopChild/i,                 // framer-motion PopChild ref warning
  /forwardRef/i,                                     // React.forwardRef suggestion (non-breaking)
];

function formatErrors(context: string, errors: string[]) {
  return [
    `${context} emitted browser errors:`,
    ...errors.map((error, index) => `${index + 1}. ${error}`),
  ].join('\n');
}

export function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  const push = (message: string) => {
    if (!message.trim()) return;
    errors.push(message.trim());
  };

  page.on('pageerror', (error) => {
    push(`pageerror: ${error.message}`);
  });

  page.on('console', (msg) => {
    const text = msg.text();

    if (msg.type() === 'error') {
      if (IGNORED_CONSOLE_ERRORS.some((re) => re.test(text))) return;
      push(`console.error: ${text}`);
      return;
    }

    if (msg.type() === 'warning' && REACT_RENDER_WARNING_RE.test(text)) {
      push(`console.warning: ${text}`);
    }
  });

  return {
    errors,
    expectNone(context: string) {
      expect(
        errors,
        errors.length ? formatErrors(context, errors) : `${context} emitted no browser errors.`,
      ).toEqual([]);
    },
  };
}

export async function expectStorefrontShell(page: Page) {
  await expect(page.getByTestId('storefront-layout')).toBeVisible();
  await expect(page.getByTestId('storefront-header')).toBeVisible();
  await expect(page.getByTestId('storefront-footer')).toBeVisible();
  await expect(page.getByTestId('storefront-main')).toBeVisible();
}

export async function expectVisibleMainContent(context: BrowsingContext) {
  await expect
    .poll(async () => {
      const text = await context
        .getByTestId('storefront-main')
        .innerText()
        .catch(async () => context.locator('body').innerText());
      return text.replace(/\s+/g, ' ').trim().length;
    })
    .toBeGreaterThan(20);
}

export async function expectRtl(context: BrowsingContext) {
  await expect
    .poll(async () =>
      context.evaluate(() => getComputedStyle(document.body).direction),
    )
    .toBe('rtl');
}

export async function expectNoBrokenImages(
  context: BrowsingContext,
  label: string,
) {
  const brokenImages = await context.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.currentSrc && img.complete)
      .filter((img) => img.naturalWidth === 0)
      .map((img) => ({
        alt: img.alt,
        src: img.currentSrc,
      })),
  );

  expect(
    brokenImages,
    brokenImages.length
      ? `${label} has broken images:\n${brokenImages
          .map((img, index) => `${index + 1}. ${img.alt || '(no alt)'} -> ${img.src}`)
          .join('\n')}`
      : `${label} images loaded successfully.`,
  ).toEqual([]);
}

export async function gotoStorefrontPage(page: Page, path: string) {
  await page.goto(`${STOREFRONT_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await expectStorefrontShell(page);
  await expectVisibleMainContent(page);
  await expectRtl(page);
}

async function isVisible(page: Page, selector: string) {
  return page.locator(selector).isVisible({ timeout: 2_000 }).catch(() => false);
}

export async function openThemeEditor(page: Page): Promise<{ skipReason?: string }> {
  const editorUrl = `${DASHBOARD_URL}/online-store/themes/editor`;

  await page.goto(editorUrl, { waitUntil: 'domcontentloaded' });

  // Wait a moment for any redirects to settle
  await page.waitForTimeout(2000);

  // Check if we landed on a login page (various detection methods)
  const url = page.url();
  const needsLogin =
    (await isVisible(page, '#email')) ||
    (await isVisible(page, 'input[type="email"]')) ||
    (await isVisible(page, 'input[name="email"]')) ||
    /\/login(?:$|\?)/i.test(url) ||
    /\/auth(?:$|\?)/i.test(url) ||
    !(await isVisible(page, '[data-testid="theme-editor"]'));

  if (needsLogin) {
    const email = process.env.NUMU_DASHBOARD_EMAIL;
    const password = process.env.NUMU_DASHBOARD_PASSWORD;

    if (!email || !password) {
      return {
        skipReason:
          'Theme editor requires login. Set NUMU_DASHBOARD_EMAIL and NUMU_DASHBOARD_PASSWORD to run these tests.',
      };
    }

    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').first().click();

    const twoFactorVisible = await page
      .locator('#twoFACode')
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (twoFactorVisible) {
      const code = process.env.NUMU_DASHBOARD_2FA_CODE;

      if (!code) {
        return {
          skipReason:
            'Theme editor login requires 2FA. Set NUMU_DASHBOARD_2FA_CODE to run these tests.',
        };
      }

      await page.locator('#twoFACode').fill(code);
      await page.locator('button[type="submit"]').first().click();
    }

    await page.goto(editorUrl, { waitUntil: 'domcontentloaded' });
  }

  await expect(page.getByTestId('theme-editor')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('theme-editor-left-panel')).toBeVisible();
  await expect(page.getByTestId('theme-editor-preview-panel')).toBeVisible();

  return {};
}

export async function openThemeEditorWithTheme(page: Page, themeId: string) {
  const baseUrl = `${DASHBOARD_URL}/online-store/themes/editor?theme=${themeId}`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
}

export async function getPreviewFrame(page: Page) {
  const iframe = page.getByTestId('theme-editor-preview-iframe');
  await expect(iframe).toBeVisible();

  const handle = await iframe.elementHandle();
  if (!handle) {
    throw new Error('Theme editor preview iframe handle is unavailable.');
  }

  const frame = await handle.contentFrame();
  if (!frame) {
    throw new Error('Theme editor preview frame is unavailable.');
  }

  return frame;
}

export async function waitForPreviewPath(page: Page, expectedPath: string) {
  await expect
    .poll(async () => {
      const frame = await getPreviewFrame(page);
      try {
        return new URL(frame.url()).pathname;
      } catch {
        return frame.url();
      }
    })
    .toBe(expectedPath);
}

export async function switchThemeEditorPage(page: Page, pageId: string) {
  await page.getByTestId('theme-editor-page-selector').click();
  await expect(page.getByTestId(`theme-editor-page-option-${pageId}`)).toBeVisible();
  await page.getByTestId(`theme-editor-page-option-${pageId}`).click();
}
