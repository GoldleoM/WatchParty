import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const clip = readFileSync(resolve('tests/fixtures/screen.webm'));

test('host and guest share playback, presence, captions, chat and room ownership', async ({ page: host, browser }) => {
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) {
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://media.example.test/screen.webm', route => {
      const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
      if (!range) return route.fulfill({ contentType: 'video/webm', body: clip });
      const start = Number(range[1]);
      const end = Math.min(Number(range[2] || clip.length - 1), clip.length - 1);
      return route.fulfill({ status: 206, contentType: 'video/webm', headers: {
        'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${clip.length}`,
      }, body: clip.subarray(start, end + 1) });
    });
  }
  try {
    await host.goto('/');
    await host.getByRole('link', { name: 'Create room' }).click();
    await host.getByLabel('Your display name').fill('Host');
    await host.getByRole('radio', { name: 'Video link' }).check();
    await host.getByLabel('Direct video link').fill('https://media.example.test/screen.webm');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('heading', { name: /^Room [A-Z0-9]{6}$/ })).toBeVisible();
    const invite = host.url();
    await guest.goto('/');
    await guest.getByLabel('Room code or invite link').fill(invite.toLowerCase() + '?from=friend');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await guest.getByLabel('Your display name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.getByText('Guest', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: 'Mark ready' }).click();
    await expect(host.getByText('Ready', { exact: true })).toBeVisible();
    await guest.getByLabel('Message', { exact: true }).fill('See you at the credits');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByRole('log')).toContainText('See you at the credits');
    await guest.getByRole('button', { name: 'Love', exact: true }).click();
    await expect(host.locator('.floating-reactions')).toContainText('❤️');
    await host.getByRole('button', { name: 'Play', exact: true }).click();
    const enable = guest.getByRole('button', { name: 'Enable playback' });
    await expect.poll(async () => {
      if (await enable.isVisible()) await enable.click();
      return guest.locator('video').evaluate(v => !v.paused && v.currentTime > 0);
    }).toBe(true);
    await host.getByRole('button', { name: 'Pause', exact: true }).click();
    await host.locator('video').evaluate(v => { v.currentTime = 4; });
    await expect.poll(() => host.locator('video').evaluate(v => v.currentTime)).toBeCloseTo(4, 1);
    await expect.poll(() => guest.locator('video').evaluate(v => v.paused && Math.abs(v.currentTime - 4) < 0.35)).toBe(true);
    await guest.getByLabel('Load subtitles').setInputFiles({ name: 'movie.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:03.000 --> 00:06.000 align:start\nOpening credits') });
    await expect(guest.getByText('Opening credits')).toBeVisible();
    await host.reload();
    await expect(host.getByRole('button', { name: 'Close room', exact: true })).toBeVisible();
    await expect.poll(() => host.locator('video').evaluate(v => v.currentTime)).toBeCloseTo(4, 0);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.getByRole('button', { name: 'Make host' }).click();
    await host.getByRole('button', { name: 'Transfer host' }).click();
    await expect(guest.getByRole('button', { name: 'Close room', exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Close room', exact: true })).toHaveCount(0);
    await guest.getByRole('button', { name: 'Close room', exact: true }).click();
    await guest.getByRole('button', { name: 'Yes, close room' }).click();
    await expect(host.getByRole('heading', { name: 'Room unavailable' })).toBeVisible();
    await guest.goto(invite);
    await expect(guest.getByRole('heading', { name: 'Room unavailable' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await guestContext.close(); }
});

test('validates invites, source links and loads a local video', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Room code or invite link').fill('oops');
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByRole('alert')).toContainText('six-character');
  await page.getByRole('link', { name: 'Create room' }).click();
  await page.getByLabel('Your display name').fill('Local host');
  await page.getByLabel('YouTube video link').fill('https://www.youtube.com/');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByRole('alert')).toContainText('specific YouTube video');
  await page.getByRole('radio', { name: 'Local file' }).check();
  await page.getByLabel('File download link').fill('https://media.example.test/download');
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.getByLabel('Choose video file').setInputFiles({ name: 'screen.webm', mimeType: 'video/webm', buffer: clip });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(0);
});
