import { readFile, readdir, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';

const source = new URL('../extension/', import.meta.url);
const files = {};
for (const name of await readdir(source)) {
  files[name] = new Uint8Array(await readFile(new URL(name, source)));
}
await writeFile(new URL('../public/watchparty-youtube.zip', import.meta.url), zipSync(files));
