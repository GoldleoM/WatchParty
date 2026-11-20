import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function verificationCode(email: string) {
  const res = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-watchparty/oobCodes');
  const { oobCodes } = await res.json();
  return oobCodes.findLast((code: { email: string; requestType: string }) => code.email === email && code.requestType === 'VERIFY_EMAIL')?.oobCode;
}

export async function register(page: Page, name: string) {
  const email = randomUUID() + '@example.test';
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your display name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: false }).fill('Example-test-42');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await expect.poll(() => verificationCode(email)).toBeTruthy();
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-watchparty', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: await verificationCode(email) }),
  });
  expect(response.ok).toBe(true);
  await page.getByRole('button', { name: 'I verified my email' }).click();
  return email;
}
