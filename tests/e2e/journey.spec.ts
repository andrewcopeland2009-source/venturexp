import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Answers whatever activity is on screen (not necessarily correctly), then checks and continues. */
async function answerCurrent(page: Page) {
  const reveal = page.getByRole('button', { name: 'Reveal the answer' });
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
    await page.getByRole('button', { name: 'Good', exact: true }).click();
    return;
  }
  const caseQ = page.getByText(/^Question \d+ of \d+$/);
  if (await caseQ.isVisible().catch(() => false)) {
    for (;;) {
      await page.getByRole('radiogroup').getByRole('radio').first().click();
      const next = page.getByRole('button', { name: /Next question/ });
      if (await next.isVisible().catch(() => false)) await next.click();
      else break;
    }
  } else if (await page.getByRole('group', { name: 'Terms' }).isVisible().catch(() => false)) {
    const terms = page.getByRole('group', { name: 'Terms' }).getByRole('button');
    const defs = page.getByRole('group', { name: 'Definitions' }).getByRole('button');
    const n = await terms.count();
    for (let i = 0; i < n; i++) {
      await terms.nth(i).click();
      await defs.nth(i).click();
    }
  } else if (await page.getByText('Steps to place').isVisible().catch(() => false)) {
    while (await page.getByText('Steps to place').isVisible().catch(() => false)) {
      await page.getByText('Steps to place').locator('xpath=following-sibling::div//button').first().click();
    }
  } else if (await page.getByRole('textbox').isVisible().catch(() => false)) {
    await page.getByRole('textbox').fill('1');
  } else {
    await page.getByRole('radio').first().click();
  }
  await page.getByRole('button', { name: 'Check' }).click();
}

async function playLesson(page: Page) {
  await page.getByRole('button', { name: 'Start practice' }).click();
  for (let i = 0; i < 40; i++) {
    if (page.url().includes('/results')) return;
    await answerCurrent(page);
    const cont = page.getByRole('button', { name: /^(Continue|Finish lesson)$/ });
    await expect(cont).toBeVisible();
    await cont.click();
    await page.waitForTimeout(250);
  }
}

test('full personal learning journey', async ({ page }) => {
  // Onboarding
  await page.goto('/');
  await expect(page.getByText('Level up your future.')).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('checkbox', { name: /Shipping & Logistics/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Nickname').fill('Tester');
  await page.getByRole('button', { name: /Start Shipping Terminology/ }).click();

  // Course → first lesson
  await expect(page.getByRole('heading', { name: 'Shipping Terminology' })).toBeVisible();
  await page.getByRole('link', { name: /Start course/ }).click();
  await expect(page.getByRole('heading', { name: 'Carriers, parcels & service levels' })).toBeVisible();
  await playLesson(page);

  // Results: XP earned, next lesson unlocked
  await expect(page).toHaveURL(/results/);
  await expect(page.getByRole('heading', { name: /Lesson complete|Perfect lesson/ })).toBeVisible();
  await expect(page.getByText('+20 XP')).toBeVisible();
  await expect(page.getByText(/Unlocked: Labels, tracking/)).toBeVisible();
  await expect(page.getByText('First Step', { exact: true })).toBeVisible();

  // Reload persists progress
  await page.goto('/#/course/shipping-terminology');
  await page.reload();
  await expect(page.getByText(/1\/15 lessons completed/)).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByText('Tester')).toBeVisible();
  await expect(page.getByText('Labels, tracking & scan events')).toBeVisible();

  // Glossary search for MOQ
  await page.goto('/#/glossary');
  await page.getByPlaceholder(/Search terms/).fill('MOQ');
  await page.getByRole('link', { name: /MOQ \(minimum order quantity\)/ }).click();
  await expect(page.getByText(/smallest number of units/)).toBeVisible();

  // Flashcard review
  await page.goto('/#/practice/flashcards');
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await expect(page.getByText('Recall Rookie')).toBeVisible(); // achievement toast

  // Quick quiz practice
  await page.goto('/#/practice/quick');
  for (let i = 0; i < 12; i++) {
    if (await page.getByText(/Quick Quiz complete/).isVisible().catch(() => false)) break;
    await answerCurrent(page);
    await page.getByRole('button', { name: /^(Continue|Finish)$/ }).click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByText(/Quick Quiz complete/)).toBeVisible();

  // Simulation
  await page.goto('/#/simulate');
  await page.getByRole('button', { name: 'Start the simulation' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Launch the brand' }).click();
  for (let m = 1; m <= 3; m++) {
    await page.getByRole('button', { name: `Run month ${m}` }).click();
    await expect(page.getByText(`Month ${m} results`)).toBeVisible();
    await page.getByRole('button', { name: m < 3 ? `Plan month ${m + 1}` : 'See summary' }).click();
  }
  await expect(page.getByText('3-month summary')).toBeVisible();
  await expect(page.getByRole('button', { name: /Replay/ })).toBeVisible();

  // Export backup
  await page.goto('/#/settings/backup');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Progress' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^venturexp-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  const path = await download.path();
  const json = JSON.parse(readFileSync(path!, 'utf8'));
  expect(json.app).toBe('venturexp');
  expect(json.data.lessonProgress.some((p: { lessonId: string; status: string }) => p.lessonId === 'ship-1-1' && p.status === 'completed')).toBe(true);

  // Import backup (replace) with preview + confirmation
  await page.getByTestId('backup-file').setInputFiles(path!);
  await expect(page.getByText(/Preview:/)).toBeVisible();
  await page.getByRole('radio', { name: /Replace/ }).click();
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText('Progress replaced with the backup.')).toBeVisible();
  await page.goto('/#/course/shipping-terminology');
  await expect(page.getByText(/1\/15 lessons completed/)).toBeVisible();
});

for (const width of [320, 375, 390, 430]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('Curious Starter', { exact: true })).toBeVisible();
    for (const route of ['/', '/learn', '/course/shipping-terminology', '/course/shipping-terminology/path', '/practice', '/glossary', '/achievements', '/profile', '/settings', '/settings/backup', '/simulate', '/search', '/lesson/ship-1-1']) {
      await page.goto(`/#${route}`);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
}
