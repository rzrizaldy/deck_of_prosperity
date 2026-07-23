import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'release', 'screenshots');
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1920, height: 1080 };

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview server did not start on ${BASE}`);
}

function startPreview() {
  const proc = spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: ROOT, stdio: 'ignore', shell: true },
  );
  proc.on('exit', (code) => {
    if (code && code !== 0 && code !== null) process.exitCode = code;
  });
  return proc;
}

async function snap(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, type: 'png' });
  return file;
}

async function startRun(page) {
  await page.getByRole('button', { name: /Mulai main/i }).click();
  await page.getByRole('button', { name: /Deal pasar pertama/i }).click();
  await page.getByLabel('Market progress').waitFor({ state: 'visible' });
}

async function reachShop(page) {
  await page.evaluate(() => {
    const key = 'deck-of-prosperity-save-v2';
    const save = JSON.parse(localStorage.getItem(key));
    save.state.player.handsLeft = 1;
    save.state.player.score = 1_000_000;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: /Lanjut ronde 1/i }).click();
  await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
  await page.getByRole('button', { name: /Mainkan/i }).click();
  await page.getByRole('heading', { name: /Pasar Bersama/i }).waitFor({ timeout: 15_000 });
}

async function seedVictory(page) {
  await page.evaluate(() => {
    const key = 'deck-of-prosperity-save-v2';
    const save = JSON.parse(localStorage.getItem(key));
    save.state.round = 8;
    save.state.player.handsLeft = 1;
    save.state.player.score = 1_000_000;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: /Lanjut ronde 8/i }).click();
  await page.locator('.hand-cards').getByRole('button', { name: /^1\./ }).click();
  await page.getByRole('button', { name: /Mainkan/i }).click();
  await page.getByRole('heading', { name: /Negara naik bareng kamu/i }).waitFor({ timeout: 15_000 });
}

const preview = startPreview();
await waitForServer();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });

await page.addInitScript(() => {
  localStorage.setItem('doc-muted', 'true');
  localStorage.setItem('doc-bgm', 'false');
  localStorage.removeItem('doc-locale');
});

const shots = [];

await page.goto(BASE);
await page.waitForTimeout(600);
shots.push(await snap(page, '01-title-menu.png'));

await page.getByRole('button', { name: /^Kartu$/i }).click();
await page.getByRole('dialog', { name: /Katalog aset/i }).waitFor();
await page.waitForTimeout(400);
shots.push(await snap(page, '02-card-catalog.png'));
await page.getByRole('button', { name: /^Close$/i }).click();

await page.getByRole('button', { name: /Mulai main/i }).click();
await page.getByRole('button', { name: /Deal pasar pertama/i }).click();
await page.getByLabel('Market progress').waitFor();
const handCards = page.locator('.hand-cards .asset-card');
const count = Math.min(await handCards.count(), 5);
for (let i = 0; i < count; i += 1) await handCards.nth(i).click();
await page.waitForTimeout(500);
shots.push(await snap(page, '03-gameplay.png'));

await reachShop(page);
await page.waitForTimeout(500);
shots.push(await snap(page, '04-community-market.png'));

await page.goto(BASE);
await startRun(page);
await seedVictory(page);
await page.waitForTimeout(800);
shots.push(await snap(page, '05-victory.png'));

await browser.close();
preview.kill('SIGTERM');

console.log('Saved itch.io screenshots:');
for (const file of shots) console.log(`  ${file}`);
