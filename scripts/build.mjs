// Bundles src/main.ts into a single Apps Script file at dist/Code.js.
//
// Apps Script has no module system: functions are only callable from menus,
// triggers and the editor if they are top-level `function` declarations.
// esbuild's ESM output gives us exactly that, plus a trailing `export { … }`
// statement, which Apps Script would reject. We strip that statement.

import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const OUT_DIR = 'dist';
const OUT_FILE = `${OUT_DIR}/Code.js`;

await mkdir(OUT_DIR, { recursive: true });

await build({
  entryPoints: ['src/main.ts'],
  outfile: OUT_FILE,
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'neutral',
  legalComments: 'none',
  logLevel: 'warning',
});

const bundled = await readFile(OUT_FILE, 'utf8');
const stripped = bundled.replace(/^export\s*\{[^}]*\};?\s*$/m, '');
if (/^export\s/m.test(stripped)) {
  throw new Error(`${OUT_FILE} still contains an export statement after stripping`);
}
await writeFile(OUT_FILE, stripped);

await copyFile('appsscript.json', `${OUT_DIR}/appsscript.json`);
