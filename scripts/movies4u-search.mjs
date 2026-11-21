import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

// Read the same public search results that visitors see. Ignore titles without a result.
const queries = JSON.parse(readFileSync(0, 'utf8'));
const browser = await chromium.launch();
try {
  const hits = [];
  const page = await browser.newPage();
  for (const q of queries) {
    const url = new URL('https://new8.movies4u.garden/search.html');
    url.searchParams.set('q', q);
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 12000 });
      const cards = page.locator('article.post a.post-thumbnail[aria-label]');
      await cards.first().waitFor({ timeout: 5500 });
      hits.push(await cards.evaluateAll(links => links.map(a => ({
        title: a.getAttribute('aria-label'), url: a.href, image: a.querySelector('img')?.src || '',
      }))));
    } catch { hits.push([]); }
  }
  process.stdout.write(JSON.stringify(hits));
} finally { await browser.close(); }
