import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ENTRY_POINTS = ['onOpen', 'setup', 'syncNow', 'onLogEdit', 'dailySync', 'remove'];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('Apps Script bundle', () => {
  let code: string;

  beforeAll(() => {
    execFileSync('node', ['scripts/build.mjs'], { stdio: 'inherit' });
    code = readFileSync('dist/Code.js', 'utf8');
  }, 30_000);

  it.each(ENTRY_POINTS)('declares %s as a top-level function', (name) => {
    expect(code).toMatch(new RegExp(`^function ${name}\\(`, 'm'));
  });

  it('every function named by a menu item or trigger is an entry point', async () => {
    const { EDIT_HANDLER, DAILY_HANDLER } = await import('../src/gas/triggers');
    const menuSource = readFileSync('src/gas/menu.ts', 'utf8');
    const menuHandlers = [...menuSource.matchAll(/\.addItem\('[^']*', '(\w+)'\)/g)].map(
      (m) => m[1],
    );

    expect(menuHandlers).toEqual(['setup', 'syncNow', 'remove']);
    for (const name of [...menuHandlers, EDIT_HANDLER, DAILY_HANDLER]) {
      expect(ENTRY_POINTS).toContain(name);
    }
  });

  it('contains no ES module syntax', () => {
    expect(code).not.toMatch(/^\s*(export|import)\s/m);
  });

  it('ships the manifest alongside the code', () => {
    const manifest = JSON.parse(readFileSync('dist/appsscript.json', 'utf8'));
    expect(manifest.oauthScopes).toHaveLength(4);
  });

  it('never makes network calls (no UrlFetchApp in src or dist)', () => {
    for (const file of [...filesUnder('src'), ...filesUnder('dist')]) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('UrlFetchApp');
    }
  });
});
