import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('works offline after the first online visit', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByText('Curious Starter', { exact: true })).toBeVisible();
  // Wait for the service worker to install and take control (precache complete).
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Curious Starter', { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline — everything still works/)).toBeVisible();

  // Bundled lesson content and glossary search work offline.
  await page.goto('/#/lesson/ship-1-1');
  await expect(page.getByRole('heading', { name: 'Carriers, parcels & service levels' })).toBeVisible();
  await page.goto('/#/glossary');
  await page.getByPlaceholder(/Search terms/).fill('MOQ');
  await expect(page.getByRole('link', { name: /MOQ \(minimum order quantity\)/ })).toBeVisible();
  await context.setOffline(false);
});
