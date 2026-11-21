import { expect, test } from '@playwright/test';

test('a mobile viewer can find, save and reopen an Indian channel when its stream is offline', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('https://iptv-org.github.io/**', route => route.abort());
  await page.route('**/*.m3u8*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByRole('link', { name: /Indian live TV/ }).click();
  await page.getByLabel('Filter by language').selectOption('Tamil');
  await page.getByLabel('Search channels').fill('DD Tamil');
  const station = page.locator('.station-list button');
  await expect(station).toHaveCount(1);
  await station.click();
  await expect(page).toHaveURL(/\/live\?channel=DDTamil$/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Broadcast unavailable' })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Retry channel' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Saved only' }).click();
  await expect(station).toHaveCount(1);
  await expect(station).toContainText('DD Tamil');
  await page.getByLabel('Search channels').fill('no such station');
  await page.getByRole('button', { name: 'Show all channels' }).click();
  await expect(station.first()).toContainText('DD Sports');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
