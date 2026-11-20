import { expect, test } from '@playwright/test';
import { register } from './email';

test('both viewers can use native YouTube controls while the guest follows the host timeline', async ({ page: host, browser }) => {
  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    for (const viewer of [host, guest]) {
      await viewer.route('https://www.youtube.com/iframe_api', route => route.fulfill({
        contentType: 'text/javascript',
        body: `
          window.YT = { Player: class {
            constructor(node, options) {
              this.frame = document.createElement('iframe');
              node.replaceWith(this.frame);
              this.frame.onload = () => {
                const doc = this.frame.contentDocument;
                doc.querySelector('button').onclick = () => { this.time = 57; };
                options.events.onReady();
              };
              this.time = 0;
              this.frame.srcdoc = options.playerVars.controls === 1
                ? '<select aria-label="Quality"><option>Auto</option><option>720p</option></select><button>Seek</button>'
                : '<button hidden>Seek</button>';
            }
            getIframe() { return this.frame; }
            getCurrentTime() { return this.time; }
            getDuration() { return 120; }
            getPlayerState() { return 2; }
            getPlaybackRate() { return 1; }
            seekTo(time) { this.time = time; this.frame.dataset.time = time; }
            destroy() { this.frame.remove(); }
          }};
          window.onYouTubeIframeAPIReady();`,
      }));
    }
    await host.goto('/create');
    await register(host, 'Host');
    await host.getByLabel('YouTube video link').fill('https://youtu.be/M7lc1UVf-VE');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.locator('.youtube iframe')).toHaveAttribute('title', 'YouTube room video');
    await guest.goto(host.url());
    await register(guest, 'Guest');
    const guestFrame = guest.frameLocator('.youtube iframe');
    const quality = guestFrame.getByRole('combobox', { name: 'Quality' });
    await quality.click();
    await quality.selectOption('720p');
    await expect(host.frameLocator('.youtube iframe').getByRole('combobox')).toHaveValue('Auto');
    await guestFrame.getByRole('button', { name: 'Seek' }).click();
    await expect(guest.locator('.youtube iframe')).toHaveAttribute('data-time', '0');
    await expect(quality).toHaveValue('720p');
    await expect(guest.getByText('Paused by host')).toBeVisible();
  } finally { await guest.close(); }
});

test('members discover and queue YouTube videos while the host shares and selects Shorts', async ({ page: host, browser }) => {
  test.setTimeout(60000);
  const guest = await browser.newPage();
  const ids = ['M7lc1UVf-VE','aqz-KE-bpKQ','jNQXAC9IVRw'];
  try {
    for (const p of [host, guest]) {
      await p.route('https://www.googleapis.com/youtube/v3/**', route => route.fulfill({
        json: { items: ids.map((id,i) => ({ id:{ videoId:id }, snippet:{ title:'Clip ' + i } })) },
      }));
      await p.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType:'text/javascript', body:
        'window.YT={Player:class{constructor(node,options){this.node=node;node.dataset.playingId=options.videoId}destroy(){this.node.remove()}}};window.onYouTubeIframeAPIReady();' }));
    }
    await host.goto('/create'); await register(host,'Director');
    await host.getByRole('radio',{name:'Shorts',exact:true}).check();
    await host.getByRole('button',{name:'Create room'}).click();
    await expect(host.getByRole('heading',{name:'Pick the first Short'})).toBeVisible();
    await guest.goto(host.url()); await register(guest,'Viewer');
    const search = guest.getByRole('textbox',{name:'Search YouTube or paste a link'});
    await search.fill('https://youtu.be/' + ids[0]);
    await guest.getByRole('button',{name:'Add to queue'}).click();
    await expect(host.locator('.yt-queue')).toContainText('Added by Viewer');
    await expect(guest.getByRole('button',{name:'Play next'})).toHaveCount(0);
    await host.getByRole('button',{name:'Play next'}).click();
    await expect(guest.locator('[data-playing-id]')).toHaveAttribute('data-playing-id',ids[0]);
    await expect(guest.locator('.yt-queue li')).toHaveCount(0);
    await host.getByRole('button',{name:'Switch to Shorts'}).click();
    await host.getByRole('textbox',{name:'Search YouTube or paste a link'}).fill('surfing');
    await host.getByRole('button',{name:'Search',exact:true}).click();
    await host.getByRole('button',{name:'Share browsing with room'}).click();
    await expect(guest.getByRole('heading',{name:'On the host’s screen'})).toBeVisible();
    await host.getByRole('button',{name:'Scroll Shorts together'}).click();
    await host.locator('.shorts-rail').evaluate(el => el.scrollTop = el.clientHeight);
    await expect(guest.locator('[data-playing-id]')).toHaveAttribute('data-playing-id',ids[1]);
    await guest.reload();
    await expect(guest.locator('[data-playing-id]')).toHaveAttribute('data-playing-id',ids[1]);
    await host.evaluate(() => {
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg?.source === 'watchparty-room' && msg.kind === 'open') {
          window.postMessage({ source:'watchparty-companion', session:msg.session, kind:'media', request:'sample',
            video:{ id:'jNQXAC9IVRw', title:'Native Short', short:true }, playing:true, time:1, rate:1 }, location.origin);
        }
      });
      window.postMessage({source:'watchparty-companion',kind:'installed'},location.origin);
    });
    await host.getByRole('button',{name:'Open shared YouTube tab'}).click();
    await expect(host.getByRole('heading',{name:'Sharing from YouTube'})).toBeVisible();
    await expect(guest.locator('[data-playing-id]')).toHaveAttribute('data-playing-id',ids[2]);
    await host.getByRole('button',{name:'Return playback here'}).click();
    await expect(host.locator('[data-playing-id]')).toHaveAttribute('data-playing-id',ids[2]);
  } finally { await guest.close(); }
});
