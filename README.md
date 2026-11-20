# WatchParty

WatchParty lets friends share a video room with synchronized playback, chat, reactions and ready status. The host controls the timeline and can transfer control to another guest. Rooms stay available across refreshes until the host closes them.

## Run locally

Use Node.js 22.12+ or 24 and npm. Install with `npm ci`, copy `.env.example` to `.env` and supply the Firebase web app settings. Enable email/password sign-in and Cloud Firestore in the Firebase project. Publish the repository's `firestore.rules` to that database.

Run `npm run dev` to start Vite. For isolated testing, start `firebase emulators:start --only auth,firestore --project demo-watchparty` with the Firebase CLI and a supported Java runtime. Start Vite with `VITE_USE_EMULATORS=true` in the environment. Emulator mode uses a demo project and only works in development.

## Watching together

Create a room using a YouTube video, an HTTPS link to browser-playable media, or a download link for local-file viewing. In a local-file room, each viewer selects their own copy. Share the six-character room code or copy the invite link. Guests may need to enable playback in their browser. The captions control loads SRT or WebVTT subtitles for the current viewer.

Verify your email before entering a room. Sign back in with the same account to retain host access. Existing anonymous users can register in their original browser to keep their room ownership. When the host leaves, the earliest joined active viewer takes over. A closed tab or lost connection is detected after about 90 seconds. Other active tabs keep the same viewer present.

## Production

The browser regression suite covers a host and a mobile guest using isolated Firebase emulators. Install the test browser with `npx playwright install chromium`, then run `firebase emulators:exec --only auth,firestore --project demo-watchparty "npm run test:e2e"`. The suite starts its own dev server. Set `WATCHPARTY_BROWSER_CHANNEL=chrome` to use an installed Chrome browser.

Run `npm run lint` and `npm run build`. The deployable files are in `dist/`. Set the Firebase web configuration at build time and configure the host to serve `index.html` for room links and other application routes. Firebase Hosting rewrites are defined in `firebase.json`.

Firestore rules are deployed separately from static assets unless the deployment pipeline handles both. Use `firebase deploy --only auth,firestore:rules --project <project-id>` with the intended project. The rules restrict playback and host transfer to the host and allow chat and reactions from room members. Closing a room retires its code and prevents access to its chat and reactions.

The lobby photograph is served locally. [Cinema photograph on Unsplash](https://images.unsplash.com/photo-1489599849927-2ee91cede3ba).
