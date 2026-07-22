import { expect, test } from '@playwright/test';

test('starts a solo market, scores, and persists the run', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start market run/i }).click();
  await page.getByRole('button', { name: /Next/i }).click();
  await page.getByRole('button', { name: /Next/i }).click();
  await page.getByRole('button', { name: /Deal market one/i }).click();
  await expect(page.getByLabel('Market score and target')).toBeVisible();
  await page.getByRole('button', { name: /^1\./ }).click();
  await page.getByRole('button', { name: /Commit portfolio/i }).click();
  await expect(page.getByText(/You scored/)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue round 1/i })).toBeVisible();
});

test('landscape gameplay has no document overflow', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 844, height: 390 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: /Start market run/i }).click();
    await page.getByRole('button', { name: /Next/i }).click();
    await page.getByRole('button', { name: /Next/i }).click();
    await page.getByRole('button', { name: /Deal market one/i }).click();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);
    await expect(page.getByRole('button', { name: /Commit portfolio/i })).toBeVisible();
  }
});

test('portrait view shows the rotation gate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('status').getByText('Rotate to trade')).toBeVisible();
});

test('mute preference persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Sound/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-muted'))).toBe('true');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-muted'))).toBe('true');
});

test('compendium cards open a full-size artwork preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Cards$/i }).click();
  await page.getByRole('button', { name: /^Medan, 5 chips/i }).click();
  await expect(page.getByRole('dialog', { name: /Medan card preview/i })).toBeVisible();
});
