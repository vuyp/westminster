// Shared headless-Chromium launcher (uses the globally installed playwright if present).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function launch({ width = 1280, height = 720 } = {}) {
  let pw;
  try { pw = require('playwright'); } catch (e) { try { pw = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { throw new Error('playwright not found; npm i -g playwright'); } }
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const logs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => logs.push('[requestfailed] ' + r.url()));
  return { browser, page, logs, close: () => browser.close() };
}
