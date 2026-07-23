import { expect, test, type Page } from '@playwright/test';

const LANDSCAPE_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 844, height: 390 },
  { width: 740, height: 360 },
];

// Most interaction coverage intentionally uses EN selectors; the application
// itself defaults to Indonesian and has dedicated locale coverage below.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('doc-locale', 'en'));
});

/** The document itself must never scroll: every screen lives inside the canvas. */
async function expectNoDocumentOverflow(page: Page, label: string) {
  const box = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }));
  expect(box.width, `${label}: horizontal overflow`).toBeLessThanOrEqual(box.viewportWidth);
  expect(box.height, `${label}: vertical overflow`).toBeLessThanOrEqual(box.viewportHeight);
}

/** The canvas must sit inside the viewport on both axes. */
async function expectFrameFits(page: Page, label: string) {
  const frame = page.locator('.game-frame');
  await expect(frame, `${label}: frame present`).toBeVisible();
  const box = (await frame.boundingBox())!;
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(Math.ceil(box.width), `${label}: frame wider than viewport`).toBeLessThanOrEqual(viewport.width);
  expect(Math.ceil(box.height), `${label}: frame taller than viewport`).toBeLessThanOrEqual(viewport.height);
}

async function startRun(page: Page) {
  await page.getByRole('button', { name: /Start market run/i }).click();
  await page.getByRole('button', { name: /Deal market one/i }).click();
  await expect(page.getByLabel('Market progress')).toBeVisible();
}

test('defaults to Indonesian and persists a language choice', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Mulai pasar/i })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('button', { name: /Start market run/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Start market run/i })).toBeVisible();
  await context.close();
});

/**
 * Seeds the live save one hand short of a cleared first market, then resumes.
 * Greedy play does not clear every seed, so shop tests seed instead of grinding.
 */
async function reachShop(page: Page) {
  await page.evaluate(() => {
    const key = 'deck-of-prosperity-save-v2';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.state.player.handsLeft = 1;
    save.state.player.score = 1_000_000;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: /Continue round 1/i }).click();
  await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
  await page.getByRole('button', { name: /Commit portfolio/i }).click();
  await expect(page.getByRole('heading', { name: /Community Market/i })).toBeVisible({ timeout: 15_000 });
}

test('starts a solo market, scores, and persists the run', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
  await page.getByRole('button', { name: /Commit portfolio/i }).click();
  await expect(page.getByText(/You scored/)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue round 1/i })).toBeVisible();
});

test('the intro reaches the first decision in one click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start market run/i }).click();
  await expect(page.getByRole('button', { name: /Deal market one/i })).toBeVisible();
  await page.getByRole('button', { name: /Deal market one/i }).click();
  await expect(page.getByRole('button', { name: /Commit portfolio/i })).toBeVisible();
});

test('every screen fits the canvas without scrolling the document', async ({ page }) => {
  test.setTimeout(180_000);
  for (const viewport of LANDSCAPE_VIEWPORTS) {
    const at = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/');

    // Menu
    await expectNoDocumentOverflow(page, `menu ${at}`);
    await expectFrameFits(page, `menu ${at}`);
    await expect(page.getByRole('button', { name: /Start market run/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /How to play/i })).toBeVisible();
    await expect(page.getByLabel('Volume')).toBeVisible();

    // Compendium (overflows the canvas, so it must scroll inside it)
    await page.getByRole('button', { name: /^Cards$/i }).click();
    await expect(page.getByRole('dialog', { name: /Property Compendium/i })).toBeVisible();
    await expectNoDocumentOverflow(page, `compendium ${at}`);
    await page.getByRole('button', { name: /^Close$/i }).click();

    // Guide
    await page.getByRole('button', { name: /How to play/i }).click();
    await expect(page.getByRole('dialog', { name: /The Market Ledger/i })).toBeVisible();
    await expectNoDocumentOverflow(page, `guide ${at}`);
    await page.getByRole('button', { name: /^Close$/i }).click();

    // Intro
    await page.getByRole('button', { name: /Start market run/i }).click();
    await expectNoDocumentOverflow(page, `intro ${at}`);
    await expectFrameFits(page, `intro ${at}`);
    await expect(page.getByRole('button', { name: /Deal market one/i })).toBeVisible();

    // Table
    await page.getByRole('button', { name: /Deal market one/i }).click();
    await expectNoDocumentOverflow(page, `table ${at}`);
    await expectFrameFits(page, `table ${at}`);
    await expect(page.getByRole('button', { name: /Commit portfolio/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Discard/i })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(2);
  }
});

test('the shop fits the canvas at every landscape size', async ({ page }) => {
  test.setTimeout(180_000);
  for (const viewport of LANDSCAPE_VIEWPORTS) {
    const at = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/');
    await startRun(page);
    await reachShop(page);
    await expectNoDocumentOverflow(page, `shop ${at}`);
    await expectFrameFits(page, `shop ${at}`);
    await expect(page.getByRole('button', { name: /Enter round 2/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reroll/i })).toBeVisible();
    // The deed desk is the point of the shop, so its controls must be reachable.
    await expect(page.getByRole('button', { name: /^Acquire ·/i })).toBeInViewport();
    await expect(page.getByRole('button', { name: /^Renovate ·/i })).toBeInViewport();
    await expect(page.getByRole('button', { name: /Liquidate/i })).toBeInViewport();
  }
});

test('the deed rack picks a card and drives both deck services', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await startRun(page);
  await reachShop(page);

  const rack = page.locator('.deed-picker .asset-card');
  await expect(rack.first()).toBeVisible();
  // One card is always pre-selected, so the explanation is never ambiguous.
  await expect(page.locator('.deed-picker .asset-card.selected')).toHaveCount(1);

  const target = rack.nth(6);
  const name = (await target.locator('strong').textContent())!.trim();
  await target.click();
  await expect(target).toHaveClass(/selected/);
  // Rack cards ellipsize, so the sentence under the buttons must name the card.
  await expect(page.locator('.deed-action').first()).toContainText(name);

  await page.getByRole('button', { name: /^Renovate ·/i }).click();
  await expect(page.getByRole('button', { name: /Renovate · \$8/i })).toBeVisible();
  await page.getByRole('button', { name: /Liquidate/i }).click();
  await expect(page.getByRole('button', { name: /Liquidated/i })).toBeVisible();
});

test('the hand never collides with the play actions', async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of LANDSCAPE_VIEWPORTS) {
    const at = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/');
    await startRun(page);
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.hand-cards .asset-card')];
      const last = cards[cards.length - 1].getBoundingClientRect();
      const actions = document.querySelector('.play-actions')!.getBoundingClientRect();
      const frame = document.querySelector('.game-frame')!.getBoundingClientRect();
      const names = cards.map((card) => card.querySelector('strong')!);
      return {
        overlap: last.right - actions.left,
        pastFrame: last.right - frame.right,
        clippedNames: names.filter((n) => n.scrollWidth > n.clientWidth).length,
      };
    });
    expect(Math.round(geometry.overlap), `${at}: hand runs under the action panel`).toBeLessThanOrEqual(0);
    expect(Math.round(geometry.pastFrame), `${at}: hand spills past the canvas`).toBeLessThanOrEqual(0);
    expect(geometry.clippedNames, `${at}: deed names truncated in hand`).toBe(0);
  }
});

test('the hand can be sorted by rank or asset class', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  const sort = page.getByRole('group', { name: /Sort your hand/i });
  await sort.getByRole('button', { name: /^Rank$/i }).click();
  const ranks = await page.locator('.hand-cards .card-rank').allTextContents();
  expect(ranks.map(Number)).toEqual([...ranks.map(Number)].sort((a, b) => a - b));

  await sort.getByRole('button', { name: /^Class$/i }).click();
  await expect(sort.getByRole('button', { name: /^Class$/i })).toHaveClass(/active/);
});

/**
 * Rewrites the live save so the next hand resolves the run, then resumes it.
 * The reducer still decides the outcome; only the starting position is seeded.
 */
async function seedFinalHand(page: Page, score: number) {
  await page.evaluate((finalScore) => {
    const key = 'deck-of-prosperity-save-v2';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.state.round = 8;
    save.state.player.handsLeft = 1;
    save.state.player.score = finalScore;
    localStorage.setItem(key, JSON.stringify(save));
  }, score);
  await page.reload();
  await page.getByRole('button', { name: /Continue round 8/i }).click();
}

test('both endings fit the canvas', async ({ page }) => {
  test.setTimeout(180_000);
  for (const viewport of [LANDSCAPE_VIEWPORTS[0], LANDSCAPE_VIEWPORTS[2]]) {
    const at = `${viewport.width}x${viewport.height}`;

    // Victory: already past the final target when the last hand resolves.
    await page.setViewportSize(viewport);
    await page.goto('/');
    await startRun(page);
    await seedFinalHand(page, 1_000_000);
    await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
    await page.getByRole('button', { name: /Commit portfolio/i }).click();
    await expect(page.getByRole('heading', { name: /The city thrives with you/i })).toBeVisible({ timeout: 15_000 });
    await expectNoDocumentOverflow(page, `victory ${at}`);
    await expectFrameFits(page, `victory ${at}`);
    await expect(page.getByRole('button', { name: /Run it back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Return to title/i })).toBeVisible();

    // Defeat: nowhere near the final target when the last hand resolves.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await startRun(page);
    await seedFinalHand(page, 0);
    await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
    await page.getByRole('button', { name: /Commit portfolio/i }).click();
    await expect(page.getByRole('heading', { name: /The next market can be brighter/i })).toBeVisible({ timeout: 15_000 });
    await expectNoDocumentOverflow(page, `gameover ${at}`);
    await expectFrameFits(page, `gameover ${at}`);
    await expect(page.getByRole('button', { name: /Run it back/i })).toBeVisible();
    await page.evaluate(() => localStorage.clear());
  }
});

test('portrait view shows the rotation gate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('status').getByText('Rotate to play')).toBeVisible();
  await expectNoDocumentOverflow(page, 'portrait gate');
});

test('mute preference persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Mute sound/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-muted'))).toBe('true');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-muted'))).toBe('true');
});

test('volume level persists across reloads', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByLabel('Volume');
  await slider.fill('30');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-volume'))).toBe('0.3');
  await page.reload();
  await expect(page.getByLabel('Volume')).toHaveValue('30');
});

test('the music toggle persists independently of mute', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Turn background music off/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('doc-bgm'))).toBe('false');
  await page.reload();
  await expect(page.getByRole('button', { name: /Turn background music on/i })).toBeVisible();
});

test('the in-game HUD exposes mute and volume', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  const hud = page.locator('.hud-actions');
  await expect(hud.getByLabel('Volume')).toBeVisible();
  await expect(hud.getByRole('button', { name: /Mute sound|Unmute sound/i })).toBeVisible();
  await expect(hud.getByRole('button', { name: /background music/i })).toBeVisible();
  await expect(hud.getByRole('button', { name: /Full screen/i })).toBeVisible();
});

test('a chosen Konco follows the run from briefing to table', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Bima Pradana.*Penggerak Koperasi/i }).click();
  await page.getByRole('button', { name: /Start market run/i }).click();
  await expect(page.getByText('Bima Pradana', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Deal market one/i }).click();
  await expect(page.getByRole('region', { name: /Bima Pradana, your Konco/i })).toBeVisible();
});

test('holding a gameplay card opens its large artwork preview', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  const card = page.locator('.hand-cards .asset-card').first();
  const name = (await card.locator('strong').textContent())!.trim();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(670);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: new RegExp(`${name} card preview`, 'i') })).toBeVisible();
});

test('hovering a gameplay card for two seconds opens its large artwork preview', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  const card = page.locator('.hand-cards .asset-card').first();
  const name = (await card.locator('strong').textContent())!.trim();
  await card.hover();
  await page.waitForTimeout(2100);
  await expect(page.getByRole('dialog', { name: new RegExp(`${name} card preview`, 'i') })).toBeVisible();
});

test('the guide states each rule once and shows a worked score', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /How to play/i }).click();
  const guide = page.getByRole('dialog', { name: /The Market Ledger/i });
  await expect(guide).toBeVisible();

  // The chips x mult formula is the one thing the guide has to teach outright.
  const example = guide.locator('.scoring-example');
  await expect(example).toContainText('chips');
  await expect(example).toContainText('mult');
  await expect(example).toContainText('125');

  // The 4×13 ruleset publishes each legal poker hand exactly once.
  const rows = guide.locator('.guide-grid .rank-row');
  await expect(rows).toHaveCount(9);
  await expect(rows.locator('strong')).toHaveText([
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
  ]);
  const fullHouse = rows.filter({ hasText: 'Full House' });
  await expect(fullHouse.locator('.recipe-cards b')).toHaveText(['7', '7', '7', '3', '3']);
});

test('one word for one concept across briefing and table', async ({ page }) => {
  await page.goto('/');
  await startRun(page);
  const table = (await page.locator('.game-frame').innerText()).toLowerCase();
  // "blind" and "ante" were extra names for what the HUD already calls a market.
  expect(table).not.toContain('blind');
  expect(table).not.toContain('ante ');
  expect(table).toContain('market');
});

test('compendium cards open a full-size artwork preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Cards$/i }).click();
  await page.getByRole('button', { name: /^Kampung Naga, 5 chips/i }).click();
  await expect(page.getByRole('dialog', { name: /Kampung Naga card preview/i })).toBeVisible();
});
