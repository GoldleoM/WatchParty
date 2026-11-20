import { expect, test } from '@playwright/test';
import { register } from './email';

test('the oldest active guest takes over on logout and the next on tab loss', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.goto('/create');
  const hostEmail = await register(page, 'Founder');
  await page.getByLabel('YouTube video link').fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Create room' }).click();
  const close = { name: 'Close room', exact: true };
  await expect(page.getByRole('button', close)).toBeVisible();
  const invite = page.url();
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    await first.goto(invite);
    await register(first, 'First guest');
    await expect(page.getByText('First guest', { exact: true })).toBeVisible();
    await second.goto(invite);
    await register(second, 'Second guest');
    await expect(page.getByText('Second guest', { exact: true })).toBeVisible();
    const secondTab = await page.context().newPage();
    await secondTab.goto(invite);
    await expect(secondTab.getByRole('button', { name: 'Mark ready' })).toBeVisible();
    await secondTab.getByRole('link', { name: 'Lobby' }).click();
    await secondTab.close();
    await expect(page.getByRole('button', close)).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(first.getByRole('button', close)).toBeVisible({ timeout: 15000 });
    await first.close();
    await expect(second.getByRole('button', close)).toBeVisible({ timeout: 115000 });
    await page.getByLabel('Email address').fill(hostEmail);
    await page.getByLabel('Password', { exact: true }).fill('Example-test-42');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Founder (you)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', close)).toHaveCount(0);
    await second.getByRole('link', { name: 'Lobby' }).click();
    await expect(page.getByRole('button', close)).toBeVisible({ timeout: 15000 });
  } finally { await first.close(); await second.close(); }
});
