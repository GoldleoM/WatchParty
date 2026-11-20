import { chromium, expect, test } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

test('packaged companion pairs one YouTube tab, shares Shorts and queues the selected link', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium', 'The companion targets Chromium browsers.');
  test.setTimeout(45000);
  const dir = info.outputPath('companion');
  await mkdir(dir, { recursive: true });
  for (const [name, data] of Object.entries(unzipSync(await readFile('public/watchparty-youtube.zip')))) {
    await writeFile(join(dir, name), data);
  }
  const browser = await chromium.launchPersistentContext('', { channel: 'chromium', args: [
    '--disable-extensions-except=' + dir, '--load-extension=' + dir,
  ] });
  try {
    await browser.route('https://watchparty-d9b26.web.app/**', r => r.fulfill({ contentType:'text/html', body:
      '<body><button id="open">Open tab</button><script>window.events=[];onmessage=e=>{if(e.data.source==="watchparty-companion"){events.push(e.data);postMessage({source:"watchparty-room",kind:"reply",request:e.data.request,ok:true},location.origin)}};open.onclick=()=>{};document.querySelector("button").onclick=()=>postMessage({source:"watchparty-room",kind:"open",session:"test",share:true,shorts:true},location.origin)</script></body>' }));
    await browser.route('https://www.youtube.com/**', r => r.fulfill({ contentType:'text/html', body:
      '<body><title>Test Short - YouTube</title><a href="/watch?v=M7lc1UVf-VE">Party pick</a><video preload="auto" src="https://video.example.test/test.webm"></video><script>history.replaceState(null,"","/shorts/aqz-KE-bpKQ")</script></body>' }));
    await browser.route('https://video.example.test/test.webm', r => r.fulfill({path:'tests/fixtures/screen.webm',contentType:'video/webm'}));
    const room = await browser.newPage();
    await room.goto('https://watchparty-d9b26.web.app/room/ABC123');
    await expect.poll(async () => room.evaluate(() => {
      window.postMessage({source:'watchparty-room',kind:'ping'},location.origin);
      return (window as unknown as {events: {kind:string}[]}).events.some(m => m.kind === 'installed');
    })).toBe(true);
    const tabOpened = browser.waitForEvent('page');
    await room.getByRole('button').click();
    const yt = await tabOpened;
    await yt.waitForURL('https://www.youtube.com/**');
    await expect(yt.locator('html > div').last()).toBeVisible();
    const messages = () => room.evaluate(() => (window as unknown as {events: {kind:string; video?: {id:string}}[]}).events);
    await expect.poll(messages).toContainEqual(expect.objectContaining({ kind:'media', video:expect.objectContaining({id:'aqz-KE-bpKQ',short:true}) }));
    await expect.poll(messages).toContainEqual(expect.objectContaining({kind:'shelf'}));
    await yt.getByRole('link',{name:'Party pick'}).hover();
    // The companion uses a closed shadow root so youtube.com cannot modify its controls.
    const buttonHost = yt.locator('html > div').last();
    const bounds = await buttonHost.boundingBox();
    expect(bounds).toBeTruthy();
    await yt.mouse.click(bounds!.x + 70, bounds!.y + bounds!.height - 20);
    await expect.poll(messages).toContainEqual(expect.objectContaining({kind:'queue',video:expect.objectContaining({id:'M7lc1UVf-VE'})}));
    await yt.close();
    await expect.poll(messages).toContainEqual(expect.objectContaining({kind:'away'}));
  } finally { await browser.close(); }
});
